import React, { useRef, useState } from 'react';
import type {
  ActionType,
  ProColumns,
  ProDescriptionsItemProps,
} from '@ant-design/pro-components';
import {
  FooterToolbar,
  PageContainer,
  ProDescriptions,
  ProTable,
} from '@ant-design/pro-components';
import { useRequest } from '@umijs/max';
import {
  Button,
  Drawer,
  message,
  Modal,
  Tag,
  Space,
  Typography,
  Tooltip,
  Popconfirm
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import {
  queryPromptTemplates,
  deletePromptTemplate,
  createPromptTemplate,
  updatePromptTemplate
} from '@/services/prompt-templates';
import type { PromptTemplate } from '@/services/prompt-templates';
import TemplateEditor from './components/TemplateEditor';

const { Text } = Typography;

const PromptTemplates: React.FC = () => {
  const actionRef = useRef<ActionType>();
  const [showDetail, setShowDetail] = useState<boolean>(false);
  const [currentRow, setCurrentRow] = useState<PromptTemplate>();
  const [selectedRowsState, setSelectedRows] = useState<PromptTemplate[]>([]);
  const [editorVisible, setEditorVisible] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null);

  // 删除模板
  const { run: runDelete, loading: deleteLoading } = useRequest(deletePromptTemplate, {
    manual: true,
    onSuccess: () => {
      setSelectedRows([]);
      actionRef.current?.reloadAndRest?.();
      message.success('删除成功');
    },
    onError: (error) => {
      message.error(`删除失败: ${error.message}`);
    },
  });

  // 创建模板
  const { run: runCreate } = useRequest(createPromptTemplate, {
    manual: true,
    onSuccess: () => {
      actionRef.current?.reload?.();
      message.success('创建成功');
    },
    onError: (error) => {
      message.error(`创建失败: ${error.message}`);
    },
  });

  // 更新模板
  const { run: runUpdate } = useRequest(updatePromptTemplate, {
    manual: true,
    onSuccess: () => {
      actionRef.current?.reload?.();
      message.success('更新成功');
    },
    onError: (error) => {
      message.error(`更新失败: ${error.message}`);
    },
  });



  const columns: ProColumns<PromptTemplate>[] = [
    {
      title: '模板名称',
      dataIndex: 'name',
      render: (dom, entity) => {
        return (
          <a
            onClick={() => {
              setCurrentRow(entity);
              setShowDetail(true);
            }}
          >
            {entity.name}
          </a>
        );
      },
    },
    {
      title: '提示词',
      dataIndex: 'prompt',
      hideInSearch: true,
      ellipsis: true,
      width: 300,
      render: (_, record) => {
        const template = record.prompt;
        if (!template) return '-';
        return (
          <Text
            style={{ fontSize: 12, fontFamily: 'monospace' }}
            ellipsis={true}
          >
            {template.substring(0, 80)}...
          </Text>
        );
      },
    },
    {
      title: '创建时间',
      sorter: true,
      dataIndex: 'createdAt',
      valueType: 'dateTime',
      hideInForm: true,
      hideInSearch: true,
    },
    {
      title: '更新时间',
      sorter: true,
      dataIndex: 'updatedAt',
      valueType: 'dateTime',
      hideInForm: true,
      hideInSearch: true,
    },
    {
      title: '操作',
      dataIndex: 'option',
      valueType: 'option',
      render: (_, record) => [
        <Button
          key="edit"
          type="link"
          size="small"
          icon={<EditOutlined />}
          onClick={() => {
            setEditingTemplate(record);
            setEditorVisible(true);
          }}
        >
          编辑
        </Button>,
        <Popconfirm
          key="delete"
          title="确认删除"
          description={`确定要删除模板"${record.name}"吗？此操作不可恢复。`}
          onConfirm={() => runDelete(record.id)}
          okText="确定"
          cancelText="取消"
        >
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
          >
            删除
          </Button>
        </Popconfirm>,
      ].filter(Boolean),
    },
  ];

  // 处理编辑器保存
  const handleEditorSave = async (templateData: Partial<PromptTemplate>) => {
    if (editingTemplate) {
      // 更新模板
      await runUpdate(editingTemplate.id, templateData);
    } else {
      // 创建模板
      await runCreate(templateData as Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'>);
    }
    setEditorVisible(false);
    setEditingTemplate(null);
  };

  // 批量删除
  const handleRemove = async (selectedRows: PromptTemplate[]) => {
    if (!selectedRows?.length) {
      message.warning('请选择要删除的模板');
      return;
    }

    Modal.confirm({
      title: '确认批量删除',
      content: `确定要删除选中的 ${selectedRows.length} 个模板吗？此操作不可恢复。`,
      okText: '确定',
      okType: 'danger',
      cancelText: '取消',
      async onOk() {
        for (const row of selectedRows) {
          await runDelete(row.id);
        }
      },
    });
  };

  return (
    <PageContainer
      header={{
        title: '提示词模板管理',
        subTitle: '管理提示词模板，自定义AI生成逻辑'
      }}
    >
      <ProTable<PromptTemplate>
        headerTitle="提示词模板列表"
        actionRef={actionRef}
        rowKey="id"
        search={{
          labelWidth: 120,
        }}
        toolBarRender={() => [
          <Button
            type="primary"
            key="create"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingTemplate(null);
              setEditorVisible(true);
            }}
          >
            新建模板
          </Button>,
        ]}
        request={queryPromptTemplates}
        columns={columns}
        defaultSorter={{
          updatedAt: 'descend',
        }}
        pagination={{
          defaultPageSize: 20,
          showQuickJumper: true,
          showSizeChanger: true,
        }}
        rowSelection={{
          onChange: (_, selectedRows) => {
            setSelectedRows(selectedRows);
          },
        }}
      />

      {selectedRowsState?.length > 0 && (
        <FooterToolbar
          extra={
            <div>
              已选择{' '}
              <a style={{ fontWeight: 600 }}>{selectedRowsState.length}</a>{' '}
              个模板
            </div>
          }
        >
          <Button
            onClick={() => {
              handleRemove(selectedRowsState);
            }}
            loading={deleteLoading}
            danger
          >
            批量删除
          </Button>
        </FooterToolbar>
      )}

      <Drawer
        width={800}
        open={showDetail}
        onClose={() => {
          setCurrentRow(undefined);
          setShowDetail(false);
        }}
        closable={false}
      >
        {currentRow?.name && (
          <ProDescriptions<PromptTemplate>
            column={1}
            title={currentRow.name}
            request={async () => ({
              data: currentRow || {},
            })}
            params={{
              id: currentRow?.id,
            }}
            columns={[
              {
                title: '模板名称',
                dataIndex: 'name',
              },
              {
                title: '模板内容',
                dataIndex: 'prompt',
                valueType: 'code',
              },
              {
                title: '创建时间',
                dataIndex: 'createdAt',
                valueType: 'dateTime',
              },
              {
                title: '更新时间',
                dataIndex: 'updatedAt',
                valueType: 'dateTime',
              },
            ] as ProDescriptionsItemProps<PromptTemplate>[]}
          />
        )}
      </Drawer>

      <TemplateEditor
        visible={editorVisible}
        onCancel={() => {
          setEditorVisible(false);
          setEditingTemplate(null);
        }}
        onSave={handleEditorSave}
        initialValues={editingTemplate}
        isEdit={!!editingTemplate}
      />
    </PageContainer>
  );
};

export default PromptTemplates;