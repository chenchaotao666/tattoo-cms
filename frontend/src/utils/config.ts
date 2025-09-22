// 配置文件，用于存放系统配置
export const config = {
  // MinIO配置
  minio: {
    endpoint: 'http://localhost:9000', // 可以根据环境配置
    bucket: 'tattoo',
  },
  
  // API配置
  api: {
    baseUrl: '/api',
  },
};

// 生成MinIO文件访问URL
export function generateMinIOUrl(relativePath: string): string {
  console.log('generateMinIOUrl input:', relativePath);

  if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
    console.log('generateMinIOUrl output (already full URL):', relativePath);
    return relativePath; // 已经是完整URL
  }

  if (relativePath.startsWith('images/')) {
    // 使用后端代理路由访问图片：使用绝对路径避免相对路径问题
    const fullUrl = `/${relativePath}`;
    console.log('generateMinIOUrl output (absolute path):', fullUrl);
    return fullUrl;
  }

  console.log('generateMinIOUrl output (unchanged):', relativePath);
  return relativePath;
}

export default config;