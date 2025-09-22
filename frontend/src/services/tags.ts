import { request } from '@umijs/max';

const API_BASE = '/api/tags';

export async function queryTags(
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
      currentPage: params.current,
      pageSize: params.pageSize,
      ...params,
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

export async function addTag(data: {
  name: { en: string; zh: string };
  description: { en: string; zh: string };
}) {
  return request(API_BASE, {
    method: 'POST',
    data,
  });
}

export async function updateTag(id: string, data: any) {
  return request(`${API_BASE}/${id}`, {
    method: 'PUT',
    data,
  });
}

export async function removeTag(params: { id: string }) {
  return request(`${API_BASE}/${params.id}`, {
    method: 'DELETE',
  });
}

export async function getTagById(id: string) {
  return request(`${API_BASE}/${id}`, {
    method: 'GET',
  });
}

export async function getPopularTags(limit?: number) {
  return request(`${API_BASE}/popular`, {
    method: 'GET',
    params: { limit },
  });
}

export async function getTagUsageStats(id: string) {
  return request(`${API_BASE}/${id}/stats`, {
    method: 'GET',
  });
}
