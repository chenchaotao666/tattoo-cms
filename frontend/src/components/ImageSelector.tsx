import React, { useState, useEffect } from 'react';
import { Modal, Button, Image, Pagination, Empty, Input, Spin, message } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { queryImages } from '@/services/images';
import { generateMinIOUrl } from '@/utils/config';

interface ImageItem {
  id: string;
  name: { en: string; zh: string };
  tattooUrl: string;
  slug: string;
}

interface ImageSelectorProps {
  trigger: React.ReactElement;
  value?: string; // 当前选中的图片ID
  onChange?: (imageId: string, imageUrl: string) => void;
  onClear?: () => void;
}

const ImageSelector: React.FC<ImageSelectorProps> = ({
  trigger,
  value,
  onChange,
  onClear
}) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string>(value || '');
  const [selectedImageUrl, setSelectedImageUrl] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchValue, setSearchValue] = useState('');
  const pageSize = 12;

  // 加载图片列表（只加载无userId的图片）
  const loadImages = async (page = 1, search = '') => {
    setLoading(true);
    try {
      const params: any = {
        current: page,
        pageSize,
        // 只查询无userId的图片（cms创建的图片）
        userId: { operator: 'IS', value: null },
      };

      if (search.trim()) {
        params.name = search.trim();
      }

      const result = await queryImages(params);
      if (result.success) {
        setImages(result.data || []);
        setTotal(result.total || 0);
      }
    } catch (error) {
      console.error('Load images error:', error);
      message.error('加载图片失败');
    } finally {
      setLoading(false);
    }
  };

  // 搜索处理
  const handleSearch = (value: string) => {
    setSearchValue(value);
    setCurrentPage(1);
    loadImages(1, value);
  };

  // 选择图片
  const handleSelectImage = (image: ImageItem) => {
    setSelectedImageId(image.id);
    setSelectedImageUrl(image.tattooUrl);
  };

  // 确认选择
  const handleConfirm = () => {
    if (selectedImageId && selectedImageUrl) {
      onChange?.(selectedImageId, selectedImageUrl);
      setOpen(false);
      message.success('图片选择成功');
    } else {
      message.warning('请先选择图片');
    }
  };

  // 清空选择
  const handleClearSelection = () => {
    setSelectedImageId('');
    setSelectedImageUrl('');
    onClear?.();
    setOpen(false);
    message.success('已清空图片选择');
  };

  // 分页变化
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    loadImages(page, searchValue);
  };

  // 打开弹窗时加载数据
  useEffect(() => {
    if (open) {
      setSelectedImageId(value || '');
      setCurrentPage(1);
      setSearchValue('');
      loadImages(1, '');
    }
  }, [open, value]);

  return (
    <>
      {React.cloneElement(trigger, {
        onClick: () => setOpen(true),
      })}

      <Modal
        title="选择封面图片"
        open={open}
        onCancel={() => setOpen(false)}
        width={1000}
        footer={[
          <Button key="clear" onClick={handleClearSelection}>
            清空选择
          </Button>,
          <Button key="cancel" onClick={() => setOpen(false)}>
            取消
          </Button>,
          <Button key="confirm" type="primary" onClick={handleConfirm}>
            确认选择
          </Button>,
        ]}
      >
        {/* 搜索框 */}
        <div style={{ marginBottom: 16 }}>
          <Input.Search
            placeholder="搜索图片名称"
            allowClear
            enterButton={<SearchOutlined />}
            onSearch={handleSearch}
            style={{ width: '100%' }}
          />
        </div>

        {/* 图片网格 */}
        <Spin spinning={loading}>
          {images.length > 0 ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                gap: 16,
                minHeight: 400,
                maxHeight: 500,
                overflowY: 'auto',
                padding: 4,
              }}
            >
              {images.map((image) => (
                <div
                  key={image.id}
                  style={{
                    border: selectedImageId === image.id ? '3px solid #1890ff' : '2px solid #d9d9d9',
                    borderRadius: 8,
                    padding: 8,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    backgroundColor: selectedImageId === image.id ? '#f0f9ff' : '#fff',
                    boxShadow: selectedImageId === image.id ? '0 2px 8px rgba(24, 144, 255, 0.2)' : '0 2px 4px rgba(0,0,0,0.1)',
                  }}
                  onClick={() => handleSelectImage(image)}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: 120,
                  }}>
                    <Image
                      src={generateMinIOUrl(image.tattooUrl)}
                      alt={image.name?.en || image.name?.zh || '图片'}
                      style={{
                        width: '100%',
                        height: 120,
                        objectFit: 'cover',
                        borderRadius: 4,
                      }}
                      preview={false}
                    />
                  </div>
                  <div style={{
                    marginTop: 8,
                    fontSize: 12,
                    textAlign: 'center',
                    color: selectedImageId === image.id ? '#1890ff' : '#666',
                    fontWeight: selectedImageId === image.id ? 'bold' : 'normal',
                  }}>
                    <div style={{ marginBottom: 4 }}>
                      {image.name?.en || image.name?.zh || '未命名'}
                    </div>
                    {selectedImageId === image.id && (
                      <div style={{
                        color: '#1890ff',
                        backgroundColor: '#e6f7ff',
                        padding: '2px 6px',
                        borderRadius: 4,
                        display: 'inline-block',
                      }}>
                        ✓ 已选择
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="暂无图片"
              style={{ height: 400, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
            />
          )}
        </Spin>

        {/* 分页 */}
        {total > pageSize && (
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <Pagination
              current={currentPage}
              total={total}
              pageSize={pageSize}
              onChange={handlePageChange}
              showSizeChanger={false}
              showQuickJumper
              showTotal={(total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`}
            />
          </div>
        )}
      </Modal>
    </>
  );
};

export default ImageSelector;