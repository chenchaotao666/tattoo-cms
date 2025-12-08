import { request } from '@umijs/max';

const API_BASE = '/api/users';

export async function queryUsers(
  params: {
    current?: number;
    pageSize?: number;
    username?: string;
    email?: string;
    role?: string;
    level?: string;
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
    // 默认按注册时间降序排序
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
    },
  });

  return {
    data: response.data?.data || [],
    success: response.status === 'success',
    total: response.data?.pagination?.total || 0,
  };
}

export async function addUser(data: {
  username: string;
  email: string;
  password?: string;
  role?: string;
  level?: string;
  credits?: number;
  balance?: number;
  avatarUrl?: string;
}) {
  return request(API_BASE, {
    method: 'POST',
    data,
  });
}

export async function updateUser(id: string, data: any) {
  return request(`${API_BASE}/${id}`, {
    method: 'PUT',
    data,
  });
}

export async function removeUser(params: { id: string }) {
  return request(`${API_BASE}/${params.id}`, {
    method: 'DELETE',
  });
}

export async function getUserById(id: string) {
  return request(`${API_BASE}/${id}`, {
    method: 'GET',
  });
}

export async function getUserByEmail(email: string) {
  return request(`${API_BASE}/email/${email}`, {
    method: 'GET',
  });
}

export async function getUserStats(id: string) {
  return request(`${API_BASE}/${id}/stats`, {
    method: 'GET',
  });
}

export async function updateUserCredits(id: string, creditsChange: number) {
  return request(`${API_BASE}/${id}/credits`, {
    method: 'POST',
    data: { creditsChange },
  });
}

export async function updateUserBalance(id: string, balanceChange: number) {
  return request(`${API_BASE}/${id}/balance`, {
    method: 'POST',
    data: { balanceChange },
  });
}

export async function resetUserPassword(id: string, newPassword: string) {
  return request(`${API_BASE}/${id}/reset-password`, {
    method: 'PATCH',
    data: { newPassword },
  });
}

export async function batchUpdateUserRole(userIds: string[], role: string) {
  return request(`${API_BASE}/batch/role`, {
    method: 'PATCH',
    data: { userIds, role },
  });
}

export async function batchUpdateUserLevel(userIds: string[], level: string) {
  return request(`${API_BASE}/batch/level`, {
    method: 'PATCH',
    data: { userIds, level },
  });
}

export async function getExpiringMemberships(days?: number) {
  return request(`${API_BASE}/memberships/expiring`, {
    method: 'GET',
    params: { days },
  });
}

export async function getUserRecharges(
  userId: string,
  params?: {
    current?: number;
    pageSize?: number;
  }
) {
  return request(`${API_BASE}/${userId}/recharges`, {
    method: 'GET',
    params: {
      currentPage: params?.current || 1,
      pageSize: params?.pageSize || 10,
    },
  });
}