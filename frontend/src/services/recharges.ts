import { request } from '@umijs/max';

const API_BASE = '/api/recharges';

export async function queryRecharges(
  params: {
    current?: number;
    pageSize?: number;
    userId?: string;
    userName?: string;
    userEmail?: string;
    status?: string;
    method?: string;
    chargeType?: string;
    orderId?: string;
    [key: string]: any;
  },
  sort?: Record<string, any>,
  filter?: Record<string, any>,
) {
  // 处理排序参数
  let sortParams = {};
  if (sort && Object.keys(sort).length > 0) {
    Object.entries(sort).forEach(([key, value]) => {
      if (value === 'descend') {
        sortParams = { sortBy: key, sortOrder: 'DESC' };
      } else if (value === 'ascend') {
        sortParams = { sortBy: key, sortOrder: 'ASC' };
      }
    });
  } else {
    // 默认按充值时间降序排序
    sortParams = { sortBy: 'createdAt', sortOrder: 'DESC' };
  }

  const response = await request<{
    status: string;
    data: {
      data: any[];
      pagination: {
        currentPage: number;
        pageSize: number;
        total: number;
        totalPages: number;
      };
    };
    message: string;
  }>(API_BASE, {
    method: 'GET',
    params: {
      currentPage: params.current || 1,
      pageSize: params.pageSize || 20,
      ...Object.fromEntries(
        Object.entries(params).filter(([key]) => !['current', 'pageSize'].includes(key))
      ),
      ...sortParams,
      ...filter,
      // 过滤掉系统赠送类型
      method: params.method || '!system',
    },
  });

  return {
    data: response.data?.data || [],
    success: response.status === 'success',
    total: response.data?.pagination?.total || 0,
  };
}

export async function getRechargeById(id: string) {
  return request(`${API_BASE}/${id}`, {
    method: 'GET',
  });
}