import type {
  ActionType,
  ProColumns,
  ProDescriptionsItemProps,
} from '@ant-design/pro-components';
import {
  PageContainer,
  ProDescriptions,
  ProTable,
} from '@ant-design/pro-components';
import { useIntl } from '@umijs/max';
import {
  Drawer,
  Tag,
  Tooltip,
} from 'antd';
import React, { useRef, useState } from 'react';
import { queryRecharges } from '@/services/recharges';

export type RechargeItem = {
  id: string;
  userId: string;
  userName?: string;  // 添加用户名字段
  userEmail?: string; // 添加用户邮箱字段
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

const Recharges: React.FC = () => {
  const actionRef = useRef<ActionType | null>(null);

  const [showDetail, setShowDetail] = useState<boolean>(false);
  const [currentRow, setCurrentRow] = useState<RechargeItem>();

  const intl = useIntl();

  const columns: ProColumns<RechargeItem>[] = [
    {
      title: '订单号',
      dataIndex: 'orderId',
      render: (dom, entity) => {
        return entity.orderId ? (
          <a
            onClick={() => {
              setCurrentRow(entity);
              setShowDetail(true);
            }}
          >
            {entity.orderId}
          </a>
        ) : (
          <a
            onClick={() => {
              setCurrentRow(entity);
              setShowDetail(true);
            }}
          >
            {entity.id.substring(0, 8)}...
          </a>
        );
      },
      copyable: true,
    },
    {
      title: '用户名称',
      dataIndex: 'userName',
      render: (userName, record) => {
        return userName || (
          <Tooltip title={`用户ID: ${record.userId}`}>
            <span style={{ color: '#999' }}>未知用户</span>
          </Tooltip>
        );
      },
    },
    {
      title: '用户邮箱',
      dataIndex: 'userEmail',
      render: (userEmail) => userEmail || '-',
      copyable: true,
    },
    {
      title: '金额',
      dataIndex: 'amount',
      hideInSearch: true,
      render: (amount, record) => {
        const numAmount = Number(amount) || 0;
        return (
          <span style={{
            color: record.status === 'success' ? '#52c41a' :
                   record.status === 'failed' ? '#ff4d4f' : '#666',
            fontWeight: record.status === 'success' ? 'bold' : 'normal'
          }}>
            {record.currency} {numAmount.toFixed(2)}
          </span>
        );
      },
    },
    {
      title: '积分',
      dataIndex: 'creditsAdded',
      hideInSearch: true,
      render: (credits) => {
        const numCredits = Number(credits) || 0;
        return <span style={{ color: '#1890ff', fontWeight: 'bold' }}>{numCredits}</span>;
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
      valueEnum: {
        paypal: { text: 'PayPal' },
        stripe: { text: 'Stripe' },
      },
      render: (method) => {
        const colorMap = {
          paypal: '#1890ff',
          stripe: '#722ed1',
        };
        return (
          <Tag color={colorMap[method as string] || 'default'}>
            {method === 'paypal' ? 'PayPal' :
             method === 'stripe' ? 'Stripe' : method}
          </Tag>
        );
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
      hideInSearch: true,
    },
    {
      title: '充值时间',
      sorter: true,
      dataIndex: 'createdAt',
      valueType: 'dateTime',
      hideInSearch: true,
    },
  ];

  return (
    <PageContainer>
      <ProTable<RechargeItem>
        headerTitle="充值管理"
        actionRef={actionRef}
        rowKey="id"
        search={{
          labelWidth: 120,
        }}
        request={queryRecharges}
        columns={columns}
        defaultSort={{
          createdAt: 'descend',
        }}
        options={{
          reload: true,
          setting: true,
          density: true,
        }}
      />

      <Drawer
        width={800}
        open={showDetail}
        onClose={() => {
          setCurrentRow(undefined);
          setShowDetail(false);
        }}
        closable={false}
        title={`充值详情 - ${currentRow?.orderId || currentRow?.id?.substring(0, 8) || ''}`}
      >
        {currentRow && (
          <ProDescriptions<RechargeItem>
            column={2}
            request={async () => ({
              data: currentRow || {},
            })}
            params={{
              id: currentRow?.id,
            }}
            columns={columns as ProDescriptionsItemProps<RechargeItem>[]}
          />
        )}
      </Drawer>
    </PageContainer>
  );
};

export default Recharges;