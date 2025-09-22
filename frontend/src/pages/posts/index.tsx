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
import { Button, Drawer, message, Tag, Space, Modal, Typography, Image } from 'antd';
import RichTextEditor from '@/components/RichTextEditor';
import CreateForm from './components/CreateForm';
import UpdateForm from './components/UpdateForm';
import React, { useRef, useState } from 'react';
import {
  queryPosts,
  removePost,
  publishPost,
  unpublishPost,
  batchPublishPosts,
  batchUnpublishPosts,
} from '@/services/posts';
import { generateMinIOUrl } from '@/utils/config';

const { Paragraph } = Typography;

export type PostItem = {
  id: string;
  title: { en: string; zh: string };
  excerpt: { en: string; zh: string };
  content: { en: string; zh: string };
  slug: string;
  author: string;
  status: 'draft' | 'published';
  featuredImageUrl?: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
};

const Posts: React.FC = () => {
  const [updateModalOpen, handleUpdateModalOpen] = useState<boolean>(false);
  const [showDetail, setShowDetail] = useState<boolean>(false);

  const actionRef = useRef<ActionType>();
  const [currentRow, setCurrentRow] = useState<PostItem>();
  const [selectedRowsState, setSelectedRows] = useState<PostItem[]>([]);

  const intl = useIntl();
  const [messageApi, contextHolder] = message.useMessage();

  const { run: publishRun } = useRequest(publishPost, {
    manual: true,
    onSuccess: () => {
      messageApi.success('发布成功');
      actionRef.current?.reloadAndRest?.();
    },
    onError: () => {
      messageApi.error('发布失败，请重试');
    },
  });

  const { run: unpublishRun } = useRequest(unpublishPost, {
    manual: true,
    onSuccess: () => {
      messageApi.success('取消发布成功');
      actionRef.current?.reloadAndRest?.();
    },
    onError: () => {
      messageApi.error('取消发布失败，请重试');
    },
  });

  const { run: delRun } = useRequest(removePost, {
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

  const columns: ProColumns<PostItem>[] = [
    {
      title: '封面图片',
      dataIndex: 'featuredImageUrl',
      hideInSearch: true,
      width: 100,
      render: (_, record) => {
        if (record.featuredImageUrl) {
          return (
            <Image
              width={60}
              height={60}
              src={generateMinIOUrl(record.featuredImageUrl)}
              preview={true}
              style={{ objectFit: 'cover', borderRadius: 4 }}
            />
          );
        }
        return <div style={{ width: 60, height: 60, background: '#f5f5f5', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#999' }}>暂无图片</div>;
      },
    },
    {
      title: '标题',
      dataIndex: 'title',
      render: (dom, entity) => {
        const displayTitle = entity.title?.en || entity.title?.zh || '未命名';
        return (
          <a
            onClick={() => {
              setCurrentRow(entity);
              setShowDetail(true);
            }}
          >
            {displayTitle}
          </a>
        );
      },
    },
    {
      title: '作者',
      dataIndex: 'author',
      hideInSearch: true,
    },
    {
      title: 'Slug',
      dataIndex: 'slug',
      hideInSearch: true,
      render: (slug) => (
        <Typography.Text code copyable style={{ fontSize: '12px' }}>
          {slug}
        </Typography.Text>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      hideInForm: true,
      valueEnum: {
        draft: {
          text: '草稿',
          status: 'Default',
        },
        published: {
          text: '已发布',
          status: 'Success',
        },
      },
    },
    {
      title: '发布时间',
      sorter: true,
      dataIndex: 'publishedAt',
      valueType: 'dateTime',
      hideInForm: true,
      hideInSearch: true,
      render: (publishedAt) => {
        if (!publishedAt) return '-';
        return new Date(publishedAt as string).toLocaleString();
      },
    },
    {
      title: '创建时间',
      sorter: true,
      dataIndex: 'createdAt',
      valueType: 'dateRange',
      hideInForm: true,
      search: {
        transform: (value: any) => {
          return {
            createdAtStart: value?.[0],
            createdAtEnd: value?.[1],
          };
        },
      },
      render: (_, record) => {
        return new Date(record.createdAt).toLocaleString();
      },
    },
    {
      title: '更新时间',
      sorter: true,
      dataIndex: 'updatedAt',
      valueType: 'dateTime',
      hideInForm: true,
      hideInSearch: true,
      render: (_, record) => {
        return new Date(record.updatedAt).toLocaleString();
      },
    },
    {
      title: '操作',
      dataIndex: 'option',
      valueType: 'option',
      render: (_, record) => [
        <a
          key="edit"
          onClick={() => {
            handleUpdateModalOpen(true);
            setCurrentRow(record);
          }}
        >
          编辑
        </a>,
        record.status === 'published' ? (
          <a
            key="unpublish"
            onClick={() => {
              Modal.confirm({
                title: '确认取消发布',
                content: `确定要取消发布文章"${record.title?.en || record.title?.zh || '未命名'}"吗？`,
                okText: '确定',
                cancelText: '取消',
                onOk() {
                  unpublishRun(record.id);
                },
              });
            }}
          >
            取消发布
          </a>
        ) : (
          <a
            key="publish"
            onClick={() => {
              Modal.confirm({
                title: '确认发布',
                content: `确定要发布文章"${record.title?.en || record.title?.zh || '未命名'}"吗？`,
                okText: '确定',
                cancelText: '取消',
                onOk() {
                  publishRun(record.id);
                },
              });
            }}
          >
            发布
          </a>
        ),
        <a
          key="delete"
          style={{ color: '#ff4d4f' }}
          onClick={() => {
            Modal.confirm({
              title: '确认删除',
              content: `确定要删除文章"${record.title?.en || record.title?.zh || '未命名'}"吗？`,
              okText: '确定',
              okType: 'danger',
              cancelText: '取消',
              onOk() {
                delRun(record.id);
              },
            });
          }}
        >
          删除
        </a>,
      ],
    },
  ];

  return (
    <PageContainer>
      {contextHolder}
      <ProTable<PostItem>
        headerTitle="博客文章管理"
        actionRef={actionRef}
        rowKey="id"
        search={{
          labelWidth: 120,
        }}
        toolBarRender={() => [
          <CreateForm key="create" reload={() => actionRef.current?.reloadAndRest?.()} />,
        ]}
        request={queryPosts}
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
              项
            </div>
          }
        >
          <Button
            onClick={async () => {
              Modal.confirm({
                title: '批量发布',
                content: `确定要发布选中的 ${selectedRowsState.length} 篇文章吗？`,
                okText: '确定',
                cancelText: '取消',
                async onOk() {
                  try {
                    await batchPublishPosts(selectedRowsState.map((row) => row.id));
                    messageApi.success('批量发布成功');
                    setSelectedRows([]);
                    actionRef.current?.reloadAndRest?.();
                  } catch (error) {
                    messageApi.error('批量发布失败，请重试');
                  }
                },
              });
            }}
          >
            批量发布
          </Button>
          <Button
            onClick={async () => {
              Modal.confirm({
                title: '批量取消发布',
                content: `确定要取消发布选中的 ${selectedRowsState.length} 篇文章吗？`,
                okText: '确定',
                cancelText: '取消',
                async onOk() {
                  try {
                    await batchUnpublishPosts(selectedRowsState.map((row) => row.id));
                    messageApi.success('批量取消发布成功');
                    setSelectedRows([]);
                    actionRef.current?.reloadAndRest?.();
                  } catch (error) {
                    messageApi.error('批量取消发布失败，请重试');
                  }
                },
              });
            }}
          >
            批量取消发布
          </Button>
          <Button
            danger
            onClick={async () => {
              Modal.confirm({
                title: '批量删除',
                content: `确定要删除选中的 ${selectedRowsState.length} 篇文章吗？`,
                okText: '确定',
                okType: 'danger',
                cancelText: '取消',
                async onOk() {
                  try {
                    await Promise.all(selectedRowsState.map((row) => removePost(row.id)));
                    messageApi.success('批量删除成功');
                    setSelectedRows([]);
                    actionRef.current?.reloadAndRest?.();
                  } catch (error) {
                    messageApi.error('批量删除失败，请重试');
                  }
                },
              });
            }}
          >
            批量删除
          </Button>
        </FooterToolbar>
      )}

      <UpdateForm
        open={updateModalOpen}
        onOpenChange={handleUpdateModalOpen}
        currentRow={currentRow}
        reload={() => {
          actionRef.current?.reloadAndRest?.();
          setCurrentRow(undefined);
        }}
      />

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
          <ProDescriptions<PostItem>
            column={2}
            title={currentRow?.title?.en || currentRow?.title?.zh}
            request={async () => ({
              data: currentRow || {},
            })}
            params={{
              id: currentRow?.id,
            }}
            columns={[
              {
                title: '封面图片',
                dataIndex: 'featuredImageUrl',
                span: 2,
                render: (featuredImageUrl) => {
                  if (featuredImageUrl) {
                    return (
                      <Image
                        src={generateMinIOUrl(featuredImageUrl)}
                        alt="文章封面"
                        style={{ maxWidth: 300, maxHeight: 200, objectFit: 'cover' }}
                        preview={true}
                      />
                    );
                  }
                  return <span style={{ color: '#999' }}>暂无封面图片</span>;
                },
              },
              {
                title: '英文标题',
                dataIndex: ['title', 'en'],
              },
              {
                title: '中文标题',
                dataIndex: ['title', 'zh'],
              },
              {
                title: '作者',
                dataIndex: 'author',
              },
              {
                title: 'Slug',
                dataIndex: 'slug',
                render: (slug) => (
                  <Typography.Text code copyable>
                    {slug}
                  </Typography.Text>
                ),
              },
              {
                title: '状态',
                dataIndex: 'status',
                valueEnum: {
                  draft: {
                    text: '草稿',
                    status: 'Default',
                  },
                  published: {
                    text: '已发布',
                    status: 'Success',
                  },
                },
              },
              {
                title: '发布时间',
                dataIndex: 'publishedAt',
                valueType: 'dateTime',
              },
              {
                title: '英文摘要',
                dataIndex: ['excerpt', 'en'],
                span: 2,
              },
              {
                title: '中文摘要',
                dataIndex: ['excerpt', 'zh'],
                span: 2,
              },
              {
                title: '英文内容',
                dataIndex: ['content', 'en'],
                span: 2,
                render: (content) => (
                  <div style={{ maxHeight: '400px', overflow: 'auto', border: '1px solid #d9d9d9', borderRadius: '4px' }}>
                    <RichTextEditor
                      value={content as string || ''}
                      readonly={true}
                      height={350}
                    />
                  </div>
                ),
              },
              {
                title: '中文内容',
                dataIndex: ['content', 'zh'],
                span: 2,
                render: (content) => (
                  <div style={{ maxHeight: '400px', overflow: 'auto', border: '1px solid #d9d9d9', borderRadius: '4px' }}>
                    <RichTextEditor
                      value={content as string || ''}
                      readonly={true}
                      height={350}
                    />
                  </div>
                ),
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
            ]}
          />
        )}
      </Drawer>
    </PageContainer>
  );
};

export default Posts;