import { request } from '@umijs/max';

const API_BASE = '/api/categories';

export async function queryCategories(
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

export async function addCategory(data: {
  name: { en: string; zh: string };
  description: { en: string; zh: string };
  slug: string;
  hotness?: number;
  seoTitle?: { en: string; zh: string };
  seoDesc?: { en: string; zh: string };
}) {
  return request(API_BASE, {
    method: 'POST',
    data,
  });
}

export async function updateCategory(id: string, data: any) {
  return request(`${API_BASE}/${id}`, {
    method: 'PUT',
    data,
  });
}

export async function removeCategory(params: { id: string }) {
  return request(`${API_BASE}/${params.id}`, {
    method: 'DELETE',
  });
}

export async function getCategoryById(id: string) {
  return request(`${API_BASE}/${id}`, {
    method: 'GET',
  });
}

export async function getCategoryBySlug(slug: string) {
  return request(`${API_BASE}/slug/${slug}`, {
    method: 'GET',
  });
}

export async function getHotCategories(limit?: number) {
  return request(`${API_BASE}/hot`, {
    method: 'GET',
    params: { limit },
  });
}
