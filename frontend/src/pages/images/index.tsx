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
import { Button, Drawer, message, Image, Modal, Tag, Space } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import React, { useCallback, useRef, useState, useEffect } from 'react';
import { removeImage, queryImages } from '@/services/images';
import { queryCategories } from '@/services/categories';
import { queryStyles } from '@/services/styles';
import { queryTags } from '@/services/tags';
import UpdateForm from './components/UpdateForm';
import { generateMinIOUrl } from '@/utils/config';

export type ImageItem = {
  id: string;
  name?: { en: string; zh: string };
  description?: { en: string; zh: string };
  prompt?: { en: string; zh: string };
  slug?: string;
  tattooUrl?: string;
  scourceUrl?: string;
  type?: string;
  styleId?: string;
  categoryId?: string;
  categoryName?: { en: string; zh: string };
  categorySlug?: string;
  styleTitle?: { en: string; zh: string };
  isColor?: boolean;
  isPublic?: boolean;
  isOnline?: boolean;
  hotness?: number;
  batchId?: string;
  userId?: string;
  additionalInfo?: any;
  tags?: Array<{ id: string; name: { en: string; zh: string }; [key: string]: any }>;
  createdAt: string;
  updatedAt: string;
};

const Images: React.FC = () => {
  const actionRef = useRef<ActionType | null>(null);

  const [showDetail, setShowDetail] = useState<boolean>(false);
  const [currentRow, setCurrentRow] = useState<ImageItem>();
  const [selectedRowsState, setSelectedRows] = useState<ImageItem[]>([]);

  // 静态数据状态
  const [categories, setCategories] = useState<any[]>([]);
  const [styles, setStyles] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);

  const intl = useIntl();
  const [messageApi, contextHolder] = message.useMessage();

  // 加载静态数据
  useEffect(() => {
    loadCategories();
    loadStyles();
    loadTags();
  }, []);

  const loadCategories = async () => {
    try {
      const result = await queryCategories({ current: 1, pageSize: 1000 });
      if (result.success) {
        setCategories(result.data.map((item: any) => ({
          label: `${item.name?.en || 'Unnamed'} / ${item.name?.zh || '未命名'}`,
          value: item.id,
        })));
      }
    } catch (error) {
      console.error('Load categories error:', error);
    }
  };

  const loadStyles = async () => {
    try {
      const result = await queryStyles({ current: 1, pageSize: 1000 });
      if (result.success) {
        setStyles(result.data.map((item: any) => ({
          label: `${item.title?.en || 'Unnamed'} / ${item.title?.zh || '未命名'}`,
          value: item.id,
          title: item.title,
          description: item.description,
          prompt: item.prompt,
          originalData: item,
        })));
      }
    } catch (error) {
      console.error('Load styles error:', error);
    }
  };

  const loadTags = async () => {
    try {
      const result = await queryTags({ current: 1, pageSize: 1000 });
      if (result.success) {
        setTags(result.data.map((item: any) => ({
          label: `${item.name?.en || 'Unnamed'} / ${item.name?.zh || '未命名'}`,
          value: item.id,
        })));
      }
    } catch (error) {
      console.error('Load tags error:', error);
    }
  };

  const { run: delRun, loading } = useRequest(removeImage, {
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

  const columns: ProColumns<ImageItem>[] = [
    {
      title: '图片预览',
      dataIndex: 'tattooUrl',
      hideInSearch: true,
      width: 100,
      render: (_, record) => {
        if (record.tattooUrl) {
          return (
            <Image
              width={60}
              height={60}
              src={generateMinIOUrl(record.tattooUrl)}
              preview={true}
              style={{ objectFit: 'cover', borderRadius: 4 }}
            />
          );
        }
        return <div style={{ width: 60, height: 60, background: '#f5f5f5', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#999' }}>暂无图片</div>;
      },
    },
    {
      title: '图片名称',
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
      title: 'Slug',
      dataIndex: 'slug',
      copyable: true,
      ellipsis: true,
      hideInSearch: false,
    },
    {
      title: '类型',
      dataIndex: 'type',
      hideInSearch: true,
      render: (type) => {
        const typeMap = {
          'text2image': '文本生成',
          'image2image': '图像转换',
        };
        return typeMap[type as string] || type || '-';
      },
    },
    {
      title: '分类',
      dataIndex: 'categoryName',
      hideInSearch: false,
      render: (_, record) => {
        if (!record.categoryName) {
          return <span style={{ color: '#999' }}>未分类</span>;
        }

        // 处理分类名称 - 可能是JSON对象或字符串
        let categoryName = '-';
        if (typeof record.categoryName === 'object') {
          categoryName = record.categoryName?.zh || record.categoryName?.en || '-';
        } else if (typeof record.categoryName === 'string') {
          try {
            const parsed = JSON.parse(record.categoryName);
            categoryName = parsed?.zh || parsed?.en || record.categoryName;
          } catch {
            categoryName = record.categoryName;
          }
        }

        return (
          <Tag color="blue">
            {categoryName}
          </Tag>
        );
      },
    },
    {
      title: '标签',
      dataIndex: 'tags',
      hideInSearch: true,
      render: (_, record) => {
        if (!record.tags || record.tags.length === 0) {
          return <span style={{ color: '#999' }}>无标签</span>;
        }
        return (
          <Space wrap>
            {record.tags.slice(0, 3).map((tag) => {
              // 处理标签名称 - 可能是JSON对象或字符串
              let tagName = '-';
              if (typeof tag.name === 'object') {
                tagName = tag.name?.zh || tag.name?.en || '-';
              } else if (typeof tag.name === 'string') {
                try {
                  const parsed = JSON.parse(tag.name);
                  tagName = parsed?.zh || parsed?.en || tag.name;
                } catch {
                  tagName = tag.name;
                }
              }

              return (
                <Tag key={tag.id} color="green">
                  {tagName}
                </Tag>
              );
            })}
            {record.tags.length > 3 && (
              <Tag color="default">+{record.tags.length - 3}</Tag>
            )}
          </Space>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      hideInSearch: true,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Tag color={record.isPublic ? 'green' : 'default'}>
            {record.isPublic ? '公开' : '私有'}
          </Tag>
          <Tag color={record.isOnline ? 'blue' : 'default'}>
            {record.isOnline ? '已上线' : '未上线'}
          </Tag>
          <Tag color={record.isColor ? 'orange' : 'default'}>
            {record.isColor ? '彩色' : '黑白'}
          </Tag>
        </Space>
      ),
    },
    {
      title: '热度值',
      dataIndex: 'hotness',
      sorter: true,
      hideInSearch: true,
      render: (hotness) => (
        <Tag color={hotness > 800 ? 'red' : hotness > 500 ? 'orange' : hotness > 200 ? 'blue' : 'default'}>
          {hotness || 0}
        </Tag>
      ),
    },
    {
      title: '提示词',
      dataIndex: 'prompt',
      valueType: 'textarea',
      ellipsis: true,
      hideInSearch: true,
      render: (_, record) => {
        const prompt = record.prompt?.en || record.prompt?.zh || '-';
        return prompt.length > 50 ? `${prompt.substring(0, 50)}...` : prompt;
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
        <UpdateForm
          trigger={<a>编辑</a>}
          key="edit"
          onOk={actionRef.current?.reload}
          values={record}
          categories={categories}
          styles={styles}
          tags={tags}
        />,
        <a 
          key="delete" 
          style={{ color: '#ff4d4f' }}
          onClick={() => {
            Modal.confirm({
              title: '确认删除',
              content: `确定要删除图片"${record.name?.en || record.name?.zh || '未命名'}"吗？`,
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
    async (selectedRows: ImageItem[]) => {
      if (!selectedRows?.length) {
        messageApi.warning('请选择要删除的图片');
        return;
      }

      Modal.confirm({
        title: '确认批量删除',
        content: `确定要删除选中的 ${selectedRows.length} 张图片吗？`,
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
      <ProTable<ImageItem>
        headerTitle="图片管理"
        actionRef={actionRef}
        rowKey="id"
        search={{
          labelWidth: 120,
        }}
        toolBarRender={() => [
          <UpdateForm
            key="create"
            trigger={
              <Button type="primary" icon={<PlusOutlined />}>
                新增
              </Button>
            }
            onOk={() => actionRef.current?.reload?.()}
            values={null} // null 表示新增模式
            categories={categories}
            styles={styles}
            tags={tags}
          />,
        ]}
        request={queryImages}
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
              张图片
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
          <ProDescriptions<ImageItem>
            column={2}
            title={currentRow?.name?.en || currentRow?.name?.zh}
            request={async () => ({
              data: currentRow || {},
            })}
            params={{
              id: currentRow?.id,
            }}
            columns={columns as ProDescriptionsItemProps<ImageItem>[]}
          />
        )}
      </Drawer>
    </PageContainer>
  );
};

export default Images;