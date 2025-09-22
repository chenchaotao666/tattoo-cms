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
import { FormattedMessage, useIntl, useRequest } from '@umijs/max';
import { Button, Drawer, message, Image, Modal } from 'antd';
import { generateMinIOUrl } from '@/utils/config';
import React, { useCallback, useRef, useState } from 'react';
import { removeStyle, queryStyles } from '@/services/styles';
import CreateForm from './components/CreateForm';
import UpdateForm from './components/UpdateForm';

export type StyleItem = {
  id: string;
  title: { en: string; zh: string };
  prompt: { en: string; zh: string };
  imageUrl?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

const Styles: React.FC = () => {
  const actionRef = useRef<ActionType | null>(null);

  const [showDetail, setShowDetail] = useState<boolean>(false);
  const [currentRow, setCurrentRow] = useState<StyleItem>();
  const [selectedRowsState, setSelectedRows] = useState<StyleItem[]>([]);

  const intl = useIntl();
  const [messageApi, contextHolder] = message.useMessage();

  const { run: delRun, loading } = useRequest(removeStyle, {
    manual: true,
    onSuccess: () => {
      setSelectedRows([]);
      actionRef.current?.reloadAndRest?.();
      messageApi.success('删除成功');
    },
    onError: () => {
      messageApi.error('删除失败，请重试');
    },
  });

  const columns: ProColumns<StyleItem>[] = [
    {
      title: '样式名称',
      dataIndex: 'title',
      render: (dom, entity) => {
        const displayName = entity.title?.en || entity.title?.zh || '未命名';
        return (
          <a
            onClick={() => {
              setCurrentRow(entity);
              setShowDetail(true);
            }}
          >
            {displayName}
          </a>
        );
      },
    },
    {
      title: '中文名称',
      dataIndex: 'title',
      hideInSearch: true,
      render: (_, record) => {
        return record.title?.zh || '-';
      },
    },
    {
      title: '英文提示词',
      dataIndex: 'prompt',
      hideInSearch: true,
      valueType: 'textarea',
      ellipsis: true,
      render: (_, record) => {
        const prompt = record.prompt?.en || '-';
        return prompt.length > 50 ? `${prompt.substring(0, 50)}...` : prompt;
      },
    },
    {
      title: '中文提示词',
      dataIndex: 'prompt',
      hideInSearch: true,
      valueType: 'textarea',
      ellipsis: true,
      render: (_, record) => {
        const prompt = record.prompt?.zh || '-';
        return prompt.length > 50 ? `${prompt.substring(0, 50)}...` : prompt;
      },
    },
    {
      title: '示例图片',
      dataIndex: 'imageUrl',
      hideInSearch: true,
      render: (_, record) => {
        if (record.imageUrl) {
          return (
            <Image
              width={50}
              height={50}
              src={generateMinIOUrl(record.imageUrl)}
              preview={true}
              style={{ objectFit: 'cover', borderRadius: 4 }}
            />
          );
        }
        return <div style={{ width: 50, height: 50, background: '#f5f5f5', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#999' }}>暂无图片</div>;
      },
    },
    {
      title: '排序',
      dataIndex: 'sortOrder',
      width: 80,
      sorter: true,
      hideInSearch: true,
      render: (sortOrder) => sortOrder || 0,
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
        <UpdateForm
          trigger={<a>编辑</a>}
          key="edit"
          onOk={actionRef.current?.reload}
          values={record}
        />,
        <a 
          key="delete" 
          style={{ color: '#ff4d4f' }}
          onClick={() => {
            Modal.confirm({
              title: '确认删除',
              content: `确定要删除样式"${record.title?.en || record.title?.zh || '未命名'}"吗？`,
              okText: '确定',
              okType: 'danger',
              cancelText: '取消',
              onOk() {
                delRun({ id: record.id });
              },
            });
          }}
        >
          删除
        </a>,
      ],
    },
  ];

  const handleRemove = useCallback(
    async (selectedRows: StyleItem[]) => {
      if (!selectedRows?.length) {
        messageApi.warning('请选择要删除的样式');
        return;
      }

      Modal.confirm({
        title: '确认批量删除',
        content: `确定要删除选中的 ${selectedRows.length} 个样式吗？`,
        okText: '确定',
        okType: 'danger',
        cancelText: '取消',
        async onOk() {
          for (const row of selectedRows) {
            await delRun({ id: row.id });
          }
        },
      });
    },
    [delRun, messageApi],
  );

  return (
    <PageContainer>
      {contextHolder}
      <ProTable<StyleItem>
        headerTitle="样式管理"
        actionRef={actionRef}
        rowKey="id"
        search={{
          labelWidth: 120,
        }}
        toolBarRender={() => [
          <CreateForm key="create" reload={() => actionRef.current?.reload?.()} />,
        ]}
        request={queryStyles}
        columns={columns}
        pagination={{
          defaultPageSize: 20,
          showQuickJumper: true,
          showSizeChanger: true,
        }}
        defaultSorting={{
          sortBy: 'sortOrder',
          sortOrder: 'ASC',
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
              个样式
            </div>
          }
        >
          <Button
            loading={loading}
            onClick={() => {
              handleRemove(selectedRowsState);
            }}
            danger
          >
            批量删除
          </Button>
        </FooterToolbar>
      )}

      <Drawer
        width={600}
        open={showDetail}
        onClose={() => {
          setCurrentRow(undefined);
          setShowDetail(false);
        }}
        closable={false}
      >
        {currentRow?.title && (
          <ProDescriptions<StyleItem>
            column={2}
            title={currentRow?.title?.en || currentRow?.title?.zh}
            request={async () => ({
              data: currentRow || {},
            })}
            params={{
              id: currentRow?.id,
            }}
            columns={columns as ProDescriptionsItemProps<StyleItem>[]}
          />
        )}
      </Drawer>
    </PageContainer>
  );
};

export default Styles;