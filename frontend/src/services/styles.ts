import { request } from '@umijs/max';

const API_BASE = '/api/styles';

export async function queryStyles(
  params: {
    current?: number;
    pageSize?: number;
    [key: string]: any;
  },
  sort?: Record<string, any>,
  filter?: Record<string, any>,
) {
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
      ...sort,
      ...filter,
    },
  });

  return {
    data: response.data?.data || [],
    success: response.status === 'success',
    total: response.data?.pagination?.total || 0,
  };
}

export async function addStyle(data: {
  title: { en: string; zh: string };
  prompt: { en: string; zh: string };
  imageUrl?: string;
  sortOrder?: number;
}) {
  return request(API_BASE, {
    method: 'POST',
    data,
  });
}

export async function updateStyle(id: string, data: any) {
  return request(`${API_BASE}/${id}`, {
    method: 'PUT',
    data,
  });
}

export async function removeStyle(params: { id: string }) {
  return request(`${API_BASE}/${params.id}`, {
    method: 'DELETE',
  });
}

export async function getStyleById(id: string) {
  return request(`${API_BASE}/${id}`, {
    method: 'GET',
  });
}

export async function searchStyles(keyword: string, params?: any) {
  return request(`${API_BASE}/search`, {
    method: 'GET',
    params: {
      keyword,
      ...params,
    },
  });
}

export async function getPopularStyles(limit?: number) {
  return request(`${API_BASE}/popular`, {
    method: 'GET',
    params: { limit },
  });
}