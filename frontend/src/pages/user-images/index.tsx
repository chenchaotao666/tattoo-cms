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
import { removeImage, queryUserImages, getUserImageDetail } from '@/services/user-images';

export type UserImageItem = {
  id: string;
  name: { en: string; zh: string };
  description: { en: string; zh: string };
  prompt: { en: string; zh: string };
  slug: string;
  tattooUrl: string;
  userId: string;
  batchId?: string;
  batchCount?: number;
  batchImageUrls?: string[];
  authorName?: string;
  authorEmail?: string;
  categoryName?: string;
  categorySlug?: string;
  styleTitle?: string;
  type: 'manual' | 'text2image' | 'image2image';
  isColor: boolean;
  isPublic: boolean;
  isOnline: boolean;
  hotness: number;
  tags?: Array<{ id: string; name: { en: string; zh: string } }>;
  createdAt: string;
  updatedAt: string;
};

const UserImages: React.FC = () => {
  const actionRef = useRef<ActionType | null>(null);

  const [showDetail, setShowDetail] = useState<boolean>(false);
  const [currentRow, setCurrentRow] = useState<UserImageItem>();
  const [selectedRowsState, setSelectedRows] = useState<UserImageItem[]>([]);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);

  const intl = useIntl();
  const [messageApi, contextHolder] = message.useMessage();

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

  const columns: ProColumns<UserImageItem>[] = [
    {
      title: '图片预览',
      dataIndex: 'tattooUrl',
      hideInSearch: true,
      render: (_, record) => (
        <div
          style={{
            position: 'relative',
            cursor: 'pointer'
          }}
          onClick={async () => {
            setDetailLoading(true);
            setShowDetail(true);
            try {
              // 获取详细信息，包含批次图片
              const response = await getUserImageDetail(record.id);
              if (response.status === 'success') {
                setCurrentRow(response.data);
              } else {
                setCurrentRow(record);
              }
            } catch (error) {
              console.error('获取图片详情失败:', error);
              setCurrentRow(record);
            } finally {
              setDetailLoading(false);
            }
          }}
        >
          <Image
            width={50}
            height={50}
            src={generateMinIOUrl(record.tattooUrl)}
            preview={false}
            style={{ objectFit: 'cover', borderRadius: 4 }}
          />
          {record.batchCount && record.batchCount > 1 && (
            <span style={{
              position: 'absolute',
              top: -5,
              right: -5,
              background: '#1890ff',
              color: 'white',
              fontSize: '10px',
              padding: '2px 4px',
              borderRadius: '8px',
              minWidth: '16px',
              textAlign: 'center'
            }}>
              {record.batchCount}
            </span>
          )}
        </div>
      ),
    },
    {
      title: '图片名称',
      dataIndex: 'name',
      hideInSearch: true,
      render: (dom, entity) => {
        const displayName = entity.name?.en || entity.name?.zh || '未命名';
        return (
          <a
            onClick={async () => {
              setDetailLoading(true);
              setShowDetail(true);
              try {
                // 获取详细信息，包含批次图片
                const response = await getUserImageDetail(entity.id);
                if (response.status === 'success') {
                  setCurrentRow(response.data);
                } else {
                  setCurrentRow(entity);
                }
              } catch (error) {
                console.error('获取图片详情失败:', error);
                setCurrentRow(entity);
              } finally {
                setDetailLoading(false);
              }
            }}
          >
            {displayName}
          </a>
        );
      },
    },
    {
      title: '创建用户',
      dataIndex: 'authorName',
      render: (_, record) => (
        <Tag color="blue">{record.authorName || '未知用户'}</Tag>
      ),
    },
    {
      title: '用户邮箱',
      dataIndex: 'authorEmail',
      render: (_, record) => (
        <span style={{ fontSize: '12px', color: '#666' }}>
          {record.authorEmail || '-'}
        </span>
      ),
    },
    {
      title: '样式',
      dataIndex: 'styleTitle',
      hideInSearch: true,
      render: (_, record) => {
        if (record.styleTitle) {
          // 处理多语言对象
          const styleTitle = typeof record.styleTitle === 'object'
            ? (record.styleTitle?.en || record.styleTitle?.zh || '无样式')
            : record.styleTitle;
          return <Tag color="purple">{styleTitle}</Tag>;
        }
        return <span style={{ color: '#999' }}>无样式</span>;
      },
    },
    {
      title: '类型',
      dataIndex: 'type',
      hideInSearch: true,
      render: (_, record) => {
        const typeMap = {
          manual: { text: '手动上传', color: 'default' },
          text2image: { text: 'AI生成', color: 'blue' },
          image2image: { text: 'AI转换', color: 'orange' }
        };
        const typeInfo = typeMap[record.type] || { text: '未知', color: 'default' };
        return <Tag color={typeInfo.color}>{typeInfo.text}</Tag>;
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
      title: '提示词',
      dataIndex: 'prompt',
      valueType: 'textarea',
      ellipsis: true,
      hideInSearch: true,
      width: 300,
      render: (_, record) => {
        const prompt = record.prompt?.en || record.prompt?.zh || '-';
        return (
          <div style={{
            maxWidth: '280px',
            lineHeight: '1.4',
            fontSize: '12px'
          }}>
            {prompt.length > 80 ? `${prompt.substring(0, 80)}...` : prompt}
          </div>
        );
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
    },
  ];

  const handleRemove = useCallback(
    async (selectedRows: UserImageItem[]) => {
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
      <ProTable<UserImageItem>
        headerTitle="用户图片管理"
        actionRef={actionRef}
        rowKey="id"
        search={{
          labelWidth: 120,
        }}
        request={queryUserImages}
        columns={columns}
        defaultSorter={{
          updatedAt: 'descend',
        }}
        pagination={{
          defaultPageSize: 20,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50', '100'],
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
        {currentRow && (
          <div style={{ padding: 16 }}>
            <h3 style={{ marginBottom: 20, borderBottom: '1px solid #f0f0f0', paddingBottom: 16 }}>
              {currentRow?.name?.en || currentRow?.name?.zh || '未命名'}
            </h3>

            {/* 图片预览 */}
            <div style={{ marginBottom: 24 }}>
              {detailLoading ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <span>加载图片详情中...</span>
                </div>
              ) : (
                <>
                  {/* 如果有批次图片，显示所有图片 */}
                  {currentRow.batchImageUrls && currentRow.batchImageUrls.length > 1 ? (
                    <>
                      <div style={{ marginBottom: 16, fontWeight: 'bold' }}>
                        批次图片 ({currentRow.batchImageUrls.length} 张)
                      </div>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                        gap: 12,
                        marginBottom: 16
                      }}>
                        {currentRow.batchImageUrls.map((url, index) => (
                          <div key={index} style={{ position: 'relative' }}>
                            <Image
                              width="100%"
                              height={150}
                              src={generateMinIOUrl(url)}
                              style={{ objectFit: 'cover', borderRadius: 8 }}
                              placeholder={<div style={{ height: 150, background: '#f0f0f0', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>加载中...</div>}
                            />
                            <div style={{
                              position: 'absolute',
                              bottom: 4,
                              right: 4,
                              background: 'rgba(0,0,0,0.6)',
                              color: 'white',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}>
                              {index + 1}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    /* 单张图片 */
                    <div style={{ textAlign: 'center' }}>
                      <Image
                        width={200}
                        height={200}
                        src={generateMinIOUrl(currentRow.tattooUrl)}
                        style={{ objectFit: 'cover', borderRadius: 8 }}
                      />
                    </div>
                  )}
                </>
              )}
            </div>

            {/* 详细信息 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* 图片名称 */}
              <div>
                <strong>图片名称：</strong>
                <div style={{ marginTop: 4 }}>
                  {currentRow.name?.en && <div>英文：{currentRow.name.en}</div>}
                  {currentRow.name?.zh && <div>中文：{currentRow.name.zh}</div>}
                </div>
              </div>

              {/* 图片描述 */}
              {(currentRow.description?.en || currentRow.description?.zh) && (
                <div>
                  <strong>图片描述：</strong>
                  <div style={{ marginTop: 4 }}>
                    {currentRow.description?.en && <div>英文：{currentRow.description.en}</div>}
                    {currentRow.description?.zh && <div>中文：{currentRow.description.zh}</div>}
                  </div>
                </div>
              )}

              {/* 创建用户 */}
              <div>
                <strong>创建用户：</strong>
                <span style={{ marginLeft: 8 }}>
                  <Tag color="blue">{currentRow.authorName || '未知用户'}</Tag>
                </span>
              </div>

              {/* 分类 */}
              <div>
                <strong>分类：</strong>
                <span style={{ marginLeft: 8 }}>
                  <Tag color="green">
                    {currentRow.categoryName || '未分类'}
                  </Tag>
                </span>
              </div>

              {/* 样式 */}
              <div>
                <strong>样式：</strong>
                <span style={{ marginLeft: 8 }}>
                  {currentRow.styleTitle ? (
                    <Tag color="purple">{currentRow.styleTitle}</Tag>
                  ) : (
                    <span style={{ color: '#999' }}>无样式</span>
                  )}
                </span>
              </div>

              {/* 图片类型 */}
              <div>
                <strong>图片类型：</strong>
                <span style={{ marginLeft: 8 }}>
                  <Tag color={currentRow.type === 'manual' ? 'default' : currentRow.type === 'text2image' ? 'blue' : 'orange'}>
                    {currentRow.type === 'manual' ? '手动上传' :
                     currentRow.type === 'text2image' ? 'AI生成' :
                     currentRow.type === 'image2image' ? 'AI转换' : '未知'}
                  </Tag>
                </span>
              </div>

              {/* 状态信息 */}
              <div>
                <strong>状态信息：</strong>
                <div style={{ marginTop: 8 }}>
                  <Space wrap>
                    <Tag color={currentRow.isPublic ? 'green' : 'default'}>
                      {currentRow.isPublic ? '公开' : '私有'}
                    </Tag>
                    <Tag color={currentRow.isOnline ? 'blue' : 'default'}>
                      {currentRow.isOnline ? '已上线' : '未上线'}
                    </Tag>
                    <Tag color={currentRow.isColor ? 'orange' : 'default'}>
                      {currentRow.isColor ? '彩色' : '黑白'}
                    </Tag>
                  </Space>
                </div>
              </div>

              {/* 热度值 */}
              <div>
                <strong>热度值：</strong>
                <span style={{ marginLeft: 8 }}>
                  <Tag color={currentRow.hotness > 800 ? 'red' : currentRow.hotness > 500 ? 'orange' : currentRow.hotness > 200 ? 'blue' : 'default'}>
                    {currentRow.hotness || 0}
                  </Tag>
                </span>
              </div>

              {/* 提示词 */}
              {(currentRow.prompt?.en || currentRow.prompt?.zh) && (
                <div>
                  <strong>提示词：</strong>
                  <div style={{ marginTop: 4 }}>
                    {currentRow.prompt?.en && <div>英文：{currentRow.prompt.en}</div>}
                    {currentRow.prompt?.zh && <div>中文：{currentRow.prompt.zh}</div>}
                  </div>
                </div>
              )}

              {/* Slug */}
              {currentRow.slug && (
                <div>
                  <strong>Slug：</strong>
                  <span style={{ marginLeft: 8, fontFamily: 'monospace' }}>{currentRow.slug}</span>
                </div>
              )}

              {/* 时间信息 */}
              <div>
                <strong>创建时间：</strong>
                <span style={{ marginLeft: 8 }}>
                  {new Date(currentRow.createdAt).toLocaleString()}
                </span>
              </div>

              <div>
                <strong>更新时间：</strong>
                <span style={{ marginLeft: 8 }}>
                  {new Date(currentRow.updatedAt).toLocaleString()}
                </span>
              </div>

            </div>
          </div>
        )}
      </Drawer>
    </PageContainer>
  );
};

export default UserImages;