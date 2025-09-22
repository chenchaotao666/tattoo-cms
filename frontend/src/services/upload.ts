import { request } from '@umijs/max';

const API_BASE = '/api/upload';

export interface UploadImageParams {
  file: File;
  slug?: string;
  nameEn?: string;
  prefix?: string;
}

export interface UploadResponse {
  success: boolean;
  data?: {
    url: string; // 相对路径，用于保存到数据库
    fullUrl: string; // 完整URL，用于前端预览
    filename: string;
    size: number;
    originalName: string;
  };
  message: string;
}

// 上传单个图片
export async function uploadImage(params: UploadImageParams): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('image', params.file);

  if (params.slug) {
    formData.append('slug', params.slug);
  }

  if (params.nameEn) {
    formData.append('nameEn', params.nameEn);
  }

  if (params.prefix) {
    formData.append('prefix', params.prefix);
  }

  const response = await request<UploadResponse>(`${API_BASE}/image`, {
    method: 'POST',
    data: formData,
    headers: {
      // 不要设置 Content-Type，让浏览器自动设置，包含 boundary
    },
  });

  return response;
}

// 在表单提交时上传图片文件
export async function uploadImageOnSubmit(
  file: File,
  slug?: string,
  nameEn?: string,
  prefix?: string
): Promise<string> {
  if (!file) {
    throw new Error('No file provided');
  }

  const params: UploadImageParams = {
    file,
    slug,
    nameEn,
    prefix,
  };

  const response = await uploadImage(params);

  if (response.success && response.data) {
    return response.data.url;
  } else {
    throw new Error(response.message || 'Upload failed');
  }
}

// 上传多个图片
export async function uploadMultipleImages(params: {
  files: File[];
  slug?: string;
  nameEn?: string;
}): Promise<{
  success: boolean;
  data?: {
    uploadedFiles: Array<{
      url: string;
      filename: string;
      size: number;
      originalName: string;
    }>;
    totalUploaded: number;
    totalFiles: number;
  };
  message: string;
  errors?: string[];
}> {
  const formData = new FormData();
  
  params.files.forEach((file) => {
    formData.append('images', file);
  });
  
  if (params.slug) {
    formData.append('slug', params.slug);
  }
  
  if (params.nameEn) {
    formData.append('nameEn', params.nameEn);
  }

  return request(`${API_BASE}/images`, {
    method: 'POST',
    data: formData,
  });
}

// 删除图片
export async function deleteUploadedImage(objectName: string): Promise<{
  success: boolean;
  message: string;
}> {
  return request(`${API_BASE}/image`, {
    method: 'DELETE',
    data: { objectName },
  });
}

// 验证文件类型
export function validateImageFile(file: File): { valid: boolean; message?: string } {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp', 'image/tiff'];
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      message: '不支持的文件类型，请上传图片文件 (jpeg, jpg, png, gif, webp, svg, bmp, tiff)'
    };
  }

  if (file.size > maxSize) {
    return {
      valid: false,
      message: '文件大小超过限制，最大支持10MB'
    };
  }

  return { valid: true };
}