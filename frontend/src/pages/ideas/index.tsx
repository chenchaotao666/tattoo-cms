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
import { Button, Drawer, message, Modal } from 'antd';
import React, { useCallback, useRef, useState } from 'react';
import { removeIdea, queryIdeas } from '@/services/ideas';
import CreateForm from './components/CreateForm';
import UpdateForm from './components/UpdateForm';

export type IdeaItem = {
  id: string;
  title: { en: string; zh: string };
  prompt: { en: string; zh: string };
  createdAt: string;
  updatedAt: string;
};

const Ideas: React.FC = () => {
  const actionRef = useRef<ActionType | null>(null);

  const [showDetail, setShowDetail] = useState<boolean>(false);
  const [currentRow, setCurrentRow] = useState<IdeaItem>();
  const [selectedRowsState, setSelectedRows] = useState<IdeaItem[]>([]);

  const intl = useIntl();
  const [messageApi, contextHolder] = message.useMessage();

  const { run: delRun, loading } = useRequest(removeIdea, {
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

  const columns: ProColumns<IdeaItem>[] = [
    {
      title: '创意名称',
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
              content: `确定要删除创意"${record.title?.en || record.title?.zh || '未命名'}"吗？`,
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
    async (selectedRows: IdeaItem[]) => {
      if (!selectedRows?.length) {
        messageApi.warning('请选择要删除的创意');
        return;
      }

      Modal.confirm({
        title: '确认批量删除',
        content: `确定要删除选中的 ${selectedRows.length} 个创意吗？`,
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
      <ProTable<IdeaItem>
        headerTitle="创意管理"
        actionRef={actionRef}
        rowKey="id"
        search={{
          labelWidth: 120,
        }}
        toolBarRender={() => [
          <CreateForm key="create" reload={() => actionRef.current?.reload?.()} />,
        ]}
        request={queryIdeas}
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
              个创意
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
          <ProDescriptions<IdeaItem>
            column={2}
            title={currentRow?.title?.en || currentRow?.title?.zh}
            request={async () => ({
              data: currentRow || {},
            })}
            params={{
              id: currentRow?.id,
            }}
            columns={columns as ProDescriptionsItemProps<IdeaItem>[]}
          />
        )}
      </Drawer>
    </PageContainer>
  );
};

export default Ideas;