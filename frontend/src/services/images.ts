import { request } from '@umijs/max';

const API_BASE = '/api/images';

// AI生成相关的类型定义
export type GenerateTattooRequest = {
  prompt: string;
  width?: number;
  height?: number;
  num_outputs?: number;
  scheduler?: string;
  guidance_scale?: number;
  num_inference_steps?: number;
  lora_scale?: number;
  refine?: string;
  high_noise_frac?: number;
  apply_watermark?: boolean;
  styleId?: string;
  style?: string;
  styleNote?: string;
  isColor?: boolean;
  isPublic?: boolean;
  negative_prompt?: string;
  seed?: number;
  userId?: string;
  categoryId?: string;
};

export type TattooGenerationResponse = {
  status: string;
  message: string;
  data: {
    id: string;
    status: string;
    input: any;
    output?: string[];
    error?: string;
    logs?: string;
    created_at: string;
    started_at?: string;
    completed_at?: string;
    urls?: any;
  };
};

export type GenerationStatus = {
  status: string;
  message: string;
  data: {
    id: string;
    status: string;
    input: any;
    output?: string[];
    error?: string;
    logs?: string;
    created_at: string;
    started_at?: string;
    completed_at?: string;
    progress: {
      percentage: number;
      message: string;
    };
    urls?: any;
  };
};

export type CompleteGenerationResponse = {
  status: string;
  message: string;
  data: {
    predictionId: string;
    batchId: string;
    imageUrls: string[]; // Replicate的原始图片URL数组
    status: string;
    input: any;
    created_at: string;
    completed_at: string;
    originalParams: any;
  };
};

export async function queryImages(
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

export async function addImage(data: {
  name?: { en: string; zh: string };
  title?: { en: string; zh: string };
  description?: { en: string; zh: string };
  prompt?: { en: string; zh: string };
  slug?: string;
  tattooUrl?: string;
  scourceUrl?: string;
  type?: string;
  styleId?: string;
  categoryId?: string;
  isColor?: boolean;
  isPublic?: boolean;
  isOnline?: boolean;
  hotness?: number;
  batchId?: string;
  additionalInfo?: any;
}) {
  return request(API_BASE, {
    method: 'POST',
    data: {
      ...data
    },
  });
}

export async function updateImage(id: string, data: any) {
  return request(`${API_BASE}/${id}`, {
    method: 'PUT',
    data,
  });
}

export async function removeImage(params: { id: string }) {
  return request(`${API_BASE}/${params.id}`, {
    method: 'DELETE',
  });
}

export async function getImageById(id: string) {
  return request(`${API_BASE}/${id}`, {
    method: 'GET',
  });
}

export async function searchImages(keyword: string, params?: any) {
  return request(`${API_BASE}/search`, {
    method: 'GET',
    params: {
      keyword,
      ...params,
    },
  });
}

// 生成纹身图片相关接口
export async function generateTattooAsync(data: GenerateTattooRequest): Promise<TattooGenerationResponse> {
  return request(`${API_BASE}/generate-tattoo/async`, {
    method: 'POST',
    data,
  });
}

export async function completeGeneration(data: {
  predictionId: string;
  originalParams?: any;
  categoryId?: string;
  styleId?: string;
  prompt?: string;
}): Promise<CompleteGenerationResponse> {
  return request(`${API_BASE}/generate-tattoo/complete`, {
    method: 'POST',
    data,
  });
}

export async function getGenerationStatus(predictionId: string): Promise<GenerationStatus> {
  return request(`${API_BASE}/generate-tattoo/status/${predictionId}`, {
    method: 'GET',
  });
}

export async function getUserGeneratedImages(params?: any) {
  return request(`${API_BASE}/generated`, {
    method: 'GET',
    params,
  });
}