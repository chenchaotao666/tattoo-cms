import { request } from '@umijs/max';

const API_BASE = '/api/posts';

export async function queryPosts(
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

export async function addPost(data: any) {
  return request(API_BASE, {
    method: 'POST',
    data,
  });
}

export async function updatePost(id: string, data: any) {
  return request(`${API_BASE}/${id}`, {
    method: 'PUT',
    data,
  });
}

export async function removePost(id: string) {
  return request(`${API_BASE}/${id}`, {
    method: 'DELETE',
  });
}

export async function getPost(id: string) {
  return request(`${API_BASE}/${id}`, {
    method: 'GET',
  });
}

export async function getPostBySlug(slug: string) {
  return request(`${API_BASE}/slug/${slug}`, {
    method: 'GET',
  });
}

export async function publishPost(id: string) {
  return request(`${API_BASE}/${id}/publish`, {
    method: 'PATCH',
  });
}

export async function unpublishPost(id: string) {
  return request(`${API_BASE}/${id}/unpublish`, {
    method: 'PATCH',
  });
}

export async function batchPublishPosts(ids: string[]) {
  return request(`${API_BASE}/batch/publish`, {
    method: 'PATCH',
    data: { ids },
  });
}

export async function batchUnpublishPosts(ids: string[]) {
  return request(`${API_BASE}/batch/unpublish`, {
    method: 'PATCH',
    data: { ids },
  });
}

export async function getPostStats() {
  return request(`${API_BASE}/stats`, {
    method: 'GET',
  });
}

export async function getPublishedPosts(params?: any) {
  return request(`${API_BASE}/published`, {
    method: 'GET',
    params,
  });
}