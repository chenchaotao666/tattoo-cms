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
import { Button, Drawer, message, Tag, Space, Modal } from 'antd';
import React, { useCallback, useRef, useState } from 'react';
import { removeTag, queryTags } from '@/services/tags';
import CreateForm from './components/CreateForm';
import UpdateForm from './components/UpdateForm';

export type TagItem = {
  id: string;
  name: { en: string; zh: string };
  description: { en: string; zh: string };
  imageCount?: number;
  onlineImageCount?: number;
  createdAt: string;
  updatedAt: string;
};

const Tags: React.FC = () => {
  const actionRef = useRef<ActionType | null>(null);

  const [showDetail, setShowDetail] = useState<boolean>(false);
  const [currentRow, setCurrentRow] = useState<TagItem>();
  const [selectedRowsState, setSelectedRows] = useState<TagItem[]>([]);

  const intl = useIntl();
  const [messageApi, contextHolder] = message.useMessage();

  const { run: delRun, loading } = useRequest(removeTag, {
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

  const columns: ProColumns<TagItem>[] = [
    {
      title: '标签名称',
      dataIndex: 'name',
      render: (dom, entity) => {
        const displayName = entity.name?.en || entity.name?.zh || '未命名';
        return (
          <a
            onClick={() => {
              setCurrentRow(entity);
              setShowDetail(true);
            }}
          >
            <Tag color="blue">{displayName}</Tag>
          </a>
        );
      },
    },
    {
      title: '中文名称',
      dataIndex: ['name', 'zh'],
      hideInSearch: true,
      render: (_, record) => record.name?.zh || '-',
    },
    {
      title: '描述',
      dataIndex: 'description',
      hideInSearch: true,
      valueType: 'textarea',
      ellipsis: true,
      render: (_, record) => {
        const desc = record.description?.en || record.description?.zh || '-';
        return desc.length > 50 ? `${desc.substring(0, 50)}...` : desc;
      },
    },
    {
      title: '使用统计',
      dataIndex: 'imageCount',
      hideInSearch: true,
      hideInForm: true,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <span>总计: {record.imageCount || 0}</span>
          <span style={{ color: '#52c41a' }}>上线: {record.onlineImageCount || 0}</span>
        </Space>
      ),
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
              content: `确定要删除标签"${record.name?.en || record.name?.zh || '未命名'}"吗？`,
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
    async (selectedRows: TagItem[]) => {
      if (!selectedRows?.length) {
        messageApi.warning('请选择要删除的标签');
        return;
      }

      Modal.confirm({
        title: '确认批量删除',
        content: `确定要删除选中的 ${selectedRows.length} 个标签吗？`,
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
      <ProTable<TagItem>
        headerTitle="标签管理"
        actionRef={actionRef}
        rowKey="id"
        search={{
          labelWidth: 120,
        }}
        toolBarRender={() => [
          <CreateForm key="create" reload={() => actionRef.current?.reload?.()} />,
        ]}
        request={queryTags}
        columns={columns}
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
              个标签
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
        {currentRow?.name && (
          <ProDescriptions<TagItem>
            column={2}
            title={currentRow?.name?.en || currentRow?.name?.zh}
            request={async () => ({
              data: currentRow || {},
            })}
            params={{
              id: currentRow?.id,
            }}
            columns={columns as ProDescriptionsItemProps<TagItem>[]}
          />
        )}
      </Drawer>
    </PageContainer>
  );
};

export default Tags;
