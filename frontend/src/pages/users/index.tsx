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
import { useIntl } from '@umijs/max';
import {
  Button,
  Drawer,
  message,
  Modal,
  Tag,
  Space,
  Tooltip,
  Select,
  InputNumber,
  Tabs
} from 'antd';
import React, { useCallback, useRef, useState } from 'react';
import {
  queryUsers,
  batchUpdateUserRole,
  batchUpdateUserLevel,
  updateUserCredits,
  updateUserBalance,
  getUserRecharges
} from '@/services/users';
import CreateForm from './components/CreateForm';

export type UserItem = {
  id: string;
  userId: string;
  username: string;
  email: string;
  avatar?: string;
  credits: number;
  role: 'admin' | 'normal';
  level: 'free' | 'lite' | 'pro';
  balance: number;
  membershipExpiry?: string;
  firstlogintAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type RechargeItem = {
  id: string;
  userId: string;
  orderId?: string;
  amount: number;
  currency: string;
  status: 'pending' | 'success' | 'failed' | 'refund';
  method: string;
  planCode: string;
  creditsAdded: number;
  chargeType: 'Monthly' | 'Yearly' | 'Credit';
  duration: number;
  monthlyCredit: number;
  gift_month: string;
  createdAt: string;
  updatedAt: string;
};

const Users: React.FC = () => {
  const actionRef = useRef<ActionType | null>(null);

  const [showDetail, setShowDetail] = useState<boolean>(false);
  const [currentRow, setCurrentRow] = useState<UserItem>();
  const [selectedRowsState, setSelectedRows] = useState<UserItem[]>([]);

  const intl = useIntl();
  const [messageApi, contextHolder] = message.useMessage();

  // 充值记录列定义
  const rechargeColumns: ProColumns<RechargeItem>[] = [
    {
      title: '订单号',
      dataIndex: 'orderId',
      render: (orderId) => orderId || '-',
    },
    {
      title: '金额',
      dataIndex: 'amount',
      render: (amount, record) => {
        const numAmount = Number(amount) || 0;
        return (
          <span style={{ color: record.status === 'success' ? '#52c41a' : '#666' }}>
            {record.currency} {numAmount.toFixed(2)}
          </span>
        );
      },
    },
    {
      title: '积分',
      dataIndex: 'creditsAdded',
      render: (credits) => {
        const numCredits = Number(credits) || 0;
        return <span style={{ color: '#1890ff' }}>{numCredits}</span>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      valueEnum: {
        pending: { text: '待支付', status: 'Processing' },
        success: { text: '成功', status: 'Success' },
        failed: { text: '失败', status: 'Error' },
        refund: { text: '已退款', status: 'Warning' },
      },
    },
    {
      title: '支付方式',
      dataIndex: 'method',
      render: (method) => {
        const methodMap: Record<string, string> = {
          paypal: 'PayPal',
          stripe: 'Stripe',
          system: '系统赠送',
        };
        return methodMap[method] || method;
      },
    },
    {
      title: '套餐类型',
      dataIndex: 'chargeType',
      valueEnum: {
        Monthly: { text: '月付', status: 'Default' },
        Yearly: { text: '年付', status: 'Success' },
        Credit: { text: '积分', status: 'Processing' },
      },
    },
    {
      title: '套餐代码',
      dataIndex: 'planCode',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      valueType: 'dateTime',
    },
  ];

  const columns: ProColumns<UserItem>[] = [
    {
      title: '用户名',
      dataIndex: 'username',
      render: (dom, entity) => {
        return (
          <a
            onClick={() => {
              setCurrentRow(entity);
              setShowDetail(true);
            }}
          >
            {entity.username}
          </a>
        );
      },
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      copyable: true,
    },
    {
      title: '角色',
      dataIndex: 'role',
      hideInSearch: true,
      valueEnum: {
        admin: {
          text: '管理员',
          status: 'Error',
        },
        normal: {
          text: '普通用户',
          status: 'Default',
        },
      },
    },
    {
      title: '等级',
      dataIndex: 'level',
      hideInSearch: true,
      valueEnum: {
        free: {
          text: '免费版',
          status: 'Default',
        },
        lite: {
          text: '轻量版',
          status: 'Processing',
        },
        pro: {
          text: '专业版',
          status: 'Success',
        },
      },
    },
    {
      title: '积分',
      dataIndex: 'credits',
      hideInSearch: true,
      render: (_, record) => {
        return (
          <span style={{ color: record.credits > 0 ? '#52c41a' : '#ff4d4f' }}>
            {record.credits}
          </span>
        );
      },
    },
    {
      title: '注册时间',
      sorter: true,
      dataIndex: 'createdAt',
      valueType: 'dateTime',
      hideInForm: true,
      hideInSearch: true,
    },
    {
      title: '操作',
      dataIndex: 'option',
      valueType: 'option',
      render: (_, record) => [
        <a
          key="view"
          onClick={() => {
            setCurrentRow(record);
            setShowDetail(true);
          }}
        >
          查看
        </a>,
      ],
    },
  ];

  const handleBatchUpdateRole = useCallback(
    async (selectedRows: UserItem[], role: string) => {
      if (!selectedRows?.length) {
        messageApi.warning('请选择要更新的用户');
        return;
      }

      try {
        const userIds = selectedRows.map(row => row.id);
        await batchUpdateUserRole(userIds, role);
        messageApi.success(`成功将 ${selectedRows.length} 个用户角色更新为 ${role === 'admin' ? '管理员' : '普通用户'}`);
        setSelectedRows([]);
        actionRef.current?.reloadAndRest?.();
      } catch (error) {
        messageApi.error('批量更新角色失败');
      }
    },
    [messageApi],
  );

  const handleBatchUpdateLevel = useCallback(
    async (selectedRows: UserItem[], level: string) => {
      if (!selectedRows?.length) {
        messageApi.warning('请选择要更新的用户');
        return;
      }

      try {
        const userIds = selectedRows.map(row => row.id);
        await batchUpdateUserLevel(userIds, level);
        const levelText = level === 'free' ? '免费版' : level === 'lite' ? '轻量版' : '专业版';
        messageApi.success(`成功将 ${selectedRows.length} 个用户等级更新为 ${levelText}`);
        setSelectedRows([]);
        actionRef.current?.reloadAndRest?.();
      } catch (error) {
        messageApi.error('批量更新等级失败');
      }
    },
    [messageApi],
  );

  return (
    <PageContainer>
      {contextHolder}
      <ProTable<UserItem>
        headerTitle="用户管理"
        actionRef={actionRef}
        rowKey="id"
        search={{
          labelWidth: 120,
        }}
        toolBarRender={() => [
          <CreateForm key="create" reload={() => actionRef.current?.reload?.()} />,
        ]}
        request={queryUsers}
        columns={columns}
        rowSelection={{
          onChange: (_, selectedRows) => {
            setSelectedRows(selectedRows);
          },
        }}
        defaultSort={{
          createdAt: 'descend',
        }}
      />
      {selectedRowsState?.length > 0 && (
        <FooterToolbar
          extra={
            <div>
              已选择{' '}
              <a style={{ fontWeight: 600 }}>{selectedRowsState.length}</a>{' '}
              个用户
            </div>
          }
        >
          <Space>
            <Select
              placeholder="批量更新角色"
              style={{ width: 120 }}
              onChange={(role) => handleBatchUpdateRole(selectedRowsState, role)}
            >
              <Select.Option value="admin">管理员</Select.Option>
              <Select.Option value="normal">普通用户</Select.Option>
            </Select>

            <Select
              placeholder="批量更新等级"
              style={{ width: 120 }}
              onChange={(level) => handleBatchUpdateLevel(selectedRowsState, level)}
            >
              <Select.Option value="free">免费版</Select.Option>
              <Select.Option value="lite">轻量版</Select.Option>
              <Select.Option value="pro">专业版</Select.Option>
            </Select>
          </Space>
        </FooterToolbar>
      )}

      <Drawer
        width={1200}
        open={showDetail}
        onClose={() => {
          setCurrentRow(undefined);
          setShowDetail(false);
        }}
        closable={false}
        title={`用户详情 - ${currentRow?.username || ''}`}
      >
        {currentRow && (
          <Tabs
            defaultActiveKey="info"
            items={[
              {
                key: 'info',
                label: '基本信息',
                children: (
                  <ProDescriptions<UserItem>
                    column={2}
                    request={async () => ({
                      data: currentRow || {},
                    })}
                    params={{
                      id: currentRow?.id,
                    }}
                    columns={columns as ProDescriptionsItemProps<UserItem>[]}
                  />
                ),
              },
              {
                key: 'recharges',
                label: '充值记录',
                children: (
                  <ProTable<RechargeItem>
                    columns={rechargeColumns}
                    request={async (params) => {
                      try {
                        const response = await getUserRecharges(currentRow.id, {
                          current: params.current,
                          pageSize: params.pageSize,
                        });
                        return {
                          data: response.data?.data || [],
                          success: response.status === 'success',
                          total: response.data?.pagination?.total || 0,
                        };
                      } catch (error) {
                        return {
                          data: [],
                          success: false,
                          total: 0,
                        };
                      }
                    }}
                    rowKey="id"
                    search={false}
                    pagination={{
                      defaultPageSize: 10,
                      showSizeChanger: true,
                    }}
                    options={{
                      reload: false,
                      setting: false,
                      density: false,
                    }}
                    defaultSort={{
                      createdAt: 'descend',
                    }}
                    size="small"
                  />
                ),
              },
            ]}
          />
        )}
      </Drawer>
    </PageContainer>
  );
};

export default Users;