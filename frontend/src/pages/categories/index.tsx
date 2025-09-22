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
import { Button, Drawer, message, Tag, Image, Space, Modal } from 'antd';
import { generateMinIOUrl } from '@/utils/config';
import React, { useCallback, useRef, useState } from 'react';
import { removeCategory, queryCategories } from '@/services/categories';
import CreateForm from './components/CreateForm';
import UpdateForm from './components/UpdateForm';

export type CategoryItem = {
  id: string;
  name: { en: string; zh: string };
  description: { en: string; zh: string };
  slug: string;
  imageId?: string;
  tattooUrl?: string;
  hotness: number;
  imageCount?: number;
  onlineImageCount?: number;
  seoTitle?: { en: string; zh: string };
  seoDesc?: { en: string; zh: string };
  createdAt: string;
  updatedAt: string;
};

const Categories: React.FC = () => {
  const actionRef = useRef<ActionType | null>(null);

  const [showDetail, setShowDetail] = useState<boolean>(false);
  const [currentRow, setCurrentRow] = useState<CategoryItem>();
  const [selectedRowsState, setSelectedRows] = useState<CategoryItem[]>([]);

  const intl = useIntl();
  const [messageApi, contextHolder] = message.useMessage();

  const { run: delRun, loading } = useRequest(removeCategory, {
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

  const columns: ProColumns<CategoryItem>[] = [
    {
      title: '分类名称',
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
            {displayName}
          </a>
        );
      },
    },
    {
      title: '封面图片',
      dataIndex: 'tattooUrl',
      hideInSearch: true,
      render: (_, record) => {
        if (record.tattooUrl) {
          return (
            <Image
              width={50}
              height={50}
              src={generateMinIOUrl(record.tattooUrl)}
              preview={false}
              style={{ objectFit: 'cover', borderRadius: 4 }}
            />
          );
        }
        return <div style={{ width: 50, height: 50, background: '#f5f5f5', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#999' }}>暂无图片</div>;
      },
    },
    {
      title: 'Slug',
      dataIndex: 'slug',
      copyable: true,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: '描述',
      dataIndex: 'description',
      valueType: 'textarea',
      ellipsis: true,
      hideInSearch: true,
      render: (_, record) => {
        const desc = record.description?.en || record.description?.zh || '-';
        return desc.length > 50 ? `${desc.substring(0, 50)}...` : desc;
      },
    },
    {
      title: '热度值',
      dataIndex: 'hotness',
      sorter: true,
      hideInForm: true,
      hideInSearch: true,
      render: (hotness) => (
        <Tag color={hotness > 800 ? 'red' : hotness > 500 ? 'orange' : hotness > 200 ? 'blue' : 'default'}>
          {hotness}
        </Tag>
      ),
    },
    {
      title: '图片统计',
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
              content: `确定要删除分类"${record.name?.en || record.name?.zh || '未命名'}"吗？`,
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
    async (selectedRows: CategoryItem[]) => {
      if (!selectedRows?.length) {
        messageApi.warning('请选择要删除的分类');
        return;
      }

      Modal.confirm({
        title: '确认批量删除',
        content: `确定要删除选中的 ${selectedRows.length} 个分类吗？`,
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
      <ProTable<CategoryItem>
        headerTitle="分类管理"
        actionRef={actionRef}
        rowKey="id"
        search={{
          labelWidth: 120,
        }}
        toolBarRender={() => [
          <CreateForm key="create" reload={() => actionRef.current?.reload?.()} />,
        ]}
        request={queryCategories}
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
              个分类
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
          <ProDescriptions<CategoryItem>
            column={2}
            title={currentRow?.name?.en || currentRow?.name?.zh}
            request={async () => ({
              data: currentRow || {},
            })}
            params={{
              id: currentRow?.id,
            }}
            columns={columns as ProDescriptionsItemProps<CategoryItem>[]}
          />
        )}
      </Drawer>
    </PageContainer>
  );
};

export default Categories;
