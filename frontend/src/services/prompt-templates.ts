import { request } from '@umijs/max';

const API_BASE = '/api/prompt-templates';

export interface PromptTemplate {
  id: string;
  name: string;
  prompt: string;  // Changed from completeTemplate to prompt
  createdAt?: string;
  updatedAt?: string;
}

export interface TestPromptParams {
  templateId: string;
  prompt: string;
  style?: string;
  isColor?: boolean;
  styleNote?: string;
}

// 获取所有模板
export async function queryPromptTemplates(
  params: {
    current?: number;
    pageSize?: number;
    name?: string;
    [key: string]: any;
  } = {}
) {
  const { current, ...otherParams } = params;
  const response = await request<{
    status: string;
    data: {
      data: PromptTemplate[];
      pagination: {
        currentPage: number;
        pageSize: number;
        total: number;
        totalPages: number;
      };
    };
    message: string;
  }>(`${API_BASE}`, {
    method: 'GET',
    params: {
      currentPage: current || 1,
      pageSize: params.pageSize || 20,
      ...otherParams,
    },
  });

  return {
    data: response.data?.data || [],
    success: response.status === 'success',
    total: response.data?.pagination?.total || 0,
  };
}

// 创建模板
export async function createPromptTemplate(data: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'>) {
  return request(`${API_BASE}`, {
    method: 'POST',
    data,
  });
}

// 更新模板
export async function updatePromptTemplate(id: string, data: Partial<PromptTemplate>) {
  return request(`${API_BASE}/${id}`, {
    method: 'PUT',
    data,
  });
}

// 删除模板
export async function deletePromptTemplate(id: string) {
  return request(`${API_BASE}/${id}`, {
    method: 'DELETE',
  });
}

// 获取单个模板
export async function getPromptTemplate(id: string) {
  return request(`${API_BASE}/${id}`, {
    method: 'GET',
  });
}

// 测试模板生成提示词
export async function testPromptTemplate(params: TestPromptParams) {
  return request(`${API_BASE}/test`, {
    method: 'POST',
    data: params,
  });
}


// 设置默认模板
export async function setDefaultTemplate(id: string) {
  return request(`${API_BASE}/${id}/set-default`, {
    method: 'PUT',
  });
}

// 获取默认模板
export async function getDefaultTemplate() {
  return request(`${API_BASE}/default`, {
    method: 'GET',
  });
}

