import React, { useState } from 'react';
import { Upload, Button, message, Image, Space, Spin, Modal } from 'antd';
import { UploadOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd/es/upload';
import { uploadImage, validateImageFile } from '@/services/upload';
import type { UploadImageParams } from '@/services/upload';
import { generateMinIOUrl } from '@/utils/config';

interface ImageUploadProps {
  value?: string | File; // 当前图片URL或File对象
  onChange?: (value: string | File) => void; // 上传成功后的回调
  disabled?: boolean;
  slug?: string; // 用于生成文件名的slug
  nameEn?: string; // 用于生成文件名的英文名
  accept?: string;
  maxSize?: number; // 最大文件大小，单位MB
  showPreview?: boolean; // 是否显示预览
  placeholder?: string;
}

const ImageUpload: React.FC<ImageUploadProps> = ({
  value,
  onChange,
  disabled = false,
  slug,
  nameEn,
  accept = 'image/*',
  maxSize = 10,
  showPreview = true,
  placeholder = '点击上传图片',
}) => {
  const [uploading, setUploading] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  // 根据value生成预览URL
  React.useEffect(() => {
    console.log('ImageUpload value changed:', value, typeof value);
    if (value instanceof File) {
      const url = URL.createObjectURL(value);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else if (typeof value === 'string' && value.trim()) {
      const finalUrl = generateMinIOUrl(value);
      console.log('Generated preview URL:', finalUrl);
      setPreviewUrl(finalUrl);
    } else {
      setPreviewUrl('');
    }
  }, [value]);


  const handleUpload = async (file: File): Promise<boolean> => {
    // 验证文件
    const validation = validateImageFile(file);
    if (!validation.valid) {
      message.error(validation.message);
      return false;
    }

    try {
      message.success('图片选择成功，将在保存时上传');
      onChange?.(file);
      return true;
    } catch (error: any) {
      console.error('File selection error:', error);
      message.error(`文件选择失败: ${error.message || '未知错误'}`);
      return false;
    }
  };

  const customRequest: UploadProps['customRequest'] = async (options) => {
    const { file, onSuccess, onError } = options;
    
    try {
      const success = await handleUpload(file as File);
      if (success) {
        onSuccess?.('ok');
      } else {
        onError?.(new Error('Upload failed'));
      }
    } catch (error) {
      onError?.(error as Error);
    }
  };

  const handleRemove = () => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这张图片吗？',
      onOk: () => {
        onChange?.(undefined as any);
        setPreviewUrl('');
        message.success('图片已删除');
      },
    });
  };

  const beforeUpload = (file: File) => {
    const validation = validateImageFile(file);
    if (!validation.valid) {
      message.error(validation.message);
      return false;
    }
    return true;
  };

  return (
    <div className="image-upload">
      <Space direction="vertical" style={{ width: '100%' }}>
        {/* 当前图片显示 */}
        {value && showPreview && previewUrl && (
          <div style={{ marginBottom: 8 }}>
            <Space>
              <Image
                src={previewUrl}
                alt="上传的图片"
                style={{ maxWidth: 200, maxHeight: 150, objectFit: 'cover' }}
                preview={{
                  visible: previewVisible,
                  onVisibleChange: setPreviewVisible,
                }}
              />
              <Space direction="vertical">
                <Button
                  type="text"
                  icon={<EyeOutlined />}
                  onClick={() => setPreviewVisible(true)}
                  size="small"
                >
                  预览
                </Button>
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={handleRemove}
                  disabled={disabled}
                  size="small"
                >
                  删除
                </Button>
              </Space>
            </Space>
          </div>
        )}

        {/* 上传按钮 */}
        <Upload
          name="image"
          accept={accept}
          showUploadList={false}
          customRequest={customRequest}
          beforeUpload={beforeUpload}
          disabled={disabled || uploading}
        >
          <Button
            type={value ? 'default' : 'primary'}
            icon={<UploadOutlined />}
            loading={uploading}
            disabled={disabled}
          >
            {uploading ? '选择中...' : (value ? '重新选择' : placeholder)}
          </Button>
        </Upload>

        {/* 当前文件信息显示（仅在有值且不显示预览时） */}
        {value && !showPreview && (
          <div style={{ fontSize: '12px', color: '#666', wordBreak: 'break-all' }}>
            {value instanceof File ? `选择的文件: ${value.name}` : `当前图片: ${value}`}
          </div>
        )}

        {/* 帮助文本 */}
        <div style={{ fontSize: '12px', color: '#999' }}>
          支持 JPG、PNG、GIF、WebP 等格式，文件大小不超过 {maxSize}MB<br/>
          图片将在表单保存时上传到服务器
        </div>
      </Space>
    </div>
  );
};

export default ImageUpload;