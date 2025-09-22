import { PlusOutlined } from '@ant-design/icons';
import type { ProFormInstance } from '@ant-design/pro-components';
import { ModalForm, ProFormText, ProFormDigit } from '@ant-design/pro-components';
import { Button, message, Image, Card } from 'antd';
import React, { useRef, useState } from 'react';
import { addCategory } from '@/services/categories';
import MultiLanguageForm from '@/components/MultiLanguageForm';
import ImageSelector from '@/components/ImageSelector';
import { generateMinIOUrl } from '@/utils/config';

type CreateFormProps = {
  reload?: () => void;
};

// 分类表单字段配置
const CATEGORY_FIELDS = [
  { key: 'name', label: '分类名称', type: 'text' as const, required: true },
  { key: 'description', label: '描述', type: 'textarea' as const, rows: 3 },
  { key: 'seoTitle', label: 'SEO标题', type: 'text' as const },
  { key: 'seoDesc', label: 'SEO描述', type: 'textarea' as const, rows: 2 },
];

const CreateForm: React.FC<CreateFormProps> = ({ reload }) => {
  const formRef = useRef<ProFormInstance>();
  const [messageApi, contextHolder] = message.useMessage();
  const [activeLanguages, setActiveLanguages] = useState<string[]>(['en', 'zh']);
  const [selectedImageId, setSelectedImageId] = useState<string>('');
  const [selectedImageUrl, setSelectedImageUrl] = useState<string>('');

  // 合并多语言字段的工具函数
  const mergeLanguageFields = (fieldPrefix: string, values: any) => {
    const result: Record<string, string> = {};
    activeLanguages.forEach(lang => {
      const fieldValue = values[`${fieldPrefix}_${lang}`];
      if (fieldValue) {
        result[lang] = fieldValue;
      }
    });
    return result;
  };

  const handleSubmit = async (values: any) => {
    try {
      const params = {
        name: mergeLanguageFields('name', values),
        description: mergeLanguageFields('description', values),
        slug: values.slug,
        hotness: values.hotness || 0,
        imageId: selectedImageId || null,
        seoTitle: mergeLanguageFields('seoTitle', values),
        seoDesc: mergeLanguageFields('seoDesc', values),
      };

      await addCategory(params);
      messageApi.success('新增分类成功');
      formRef.current?.resetFields();
      setSelectedImageId('');
      setSelectedImageUrl('');
      reload?.();
      return true;
    } catch (error) {
      messageApi.error('新增分类失败');
      return false;
    }
  };

  return (
    <ModalForm
      title="新增分类"
      trigger={
        <Button type="primary" icon={<PlusOutlined />}>
          新增
        </Button>
      }
      formRef={formRef}
      autoFocusFirstInput={false}
      modalProps={{
        destroyOnHidden: true,
        onCancel: () => {
          formRef.current?.resetFields();
          setActiveLanguages(['en', 'zh']);
          setSelectedImageId('');
          setSelectedImageUrl('');
        },
      }}
      submitTimeout={2000}
      onFinish={handleSubmit}
      width={700}
    >
      {contextHolder}

      {/* 多语言表单 */}
      <MultiLanguageForm
        fields={CATEGORY_FIELDS}
        activeLanguages={activeLanguages}
        onLanguagesChange={setActiveLanguages}
        formRef={formRef}
        onFieldChange={(fieldKey: string, lang: string, value: string) => {
          // 当英文名称发生变化时，自动生成slug
          if (fieldKey === 'name' && lang === 'en' && value) {
            const slug = value.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
            formRef.current?.setFieldValue('slug', slug);
          }
        }}
      />

      {/* 基础信息 */}
      <div style={{ marginBottom: 24 }}>
        <ProFormText
          name="slug"
          label="Slug"
          placeholder="将根据英文分类名称自动生成"
          disabled
          tooltip="URL友好的标识符，将根据英文分类名称自动生成"
        />
        <ProFormDigit
          name="hotness"
          label="热度值"
          min={0}
          max={1000}
          initialValue={0}
          placeholder="请输入热度值（0-1000）"
        />
      </div>

      {/* 封面图片选择 */}
      <Card title="封面图片" size="small" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ flex: 1 }}>
            {selectedImageUrl ? (
              <div style={{ textAlign: 'center' }}>
                <Image
                  src={generateMinIOUrl(selectedImageUrl)}
                  alt="选中的封面图片"
                  style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 8 }}
                  preview
                />
                <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                  已选择封面图片
                </div>
              </div>
            ) : (
              <div style={{
                width: 100,
                height: 100,
                border: '2px dashed #d9d9d9',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                color: '#999',
                fontSize: 12,
              }}>
                <div>暂无封面</div>
              </div>
            )}
          </div>
          <div style={{ flex: 2 }}>
            <ImageSelector
              trigger={<Button type={selectedImageUrl ? 'default' : 'primary'}>
                {selectedImageUrl ? '重新选择' : '选择封面图片'}
              </Button>}
              value={selectedImageId}
              onChange={(imageId, imageUrl) => {
                setSelectedImageId(imageId);
                setSelectedImageUrl(imageUrl);
              }}
              onClear={() => {
                setSelectedImageId('');
                setSelectedImageUrl('');
              }}
            />
            {selectedImageUrl && (
              <Button
                style={{ marginLeft: 8 }}
                onClick={() => {
                  setSelectedImageId('');
                  setSelectedImageUrl('');
                }}
              >
                清空
              </Button>
            )}
            <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
              选择一张图片作为分类的封面图片（可选）
            </div>
          </div>
        </div>
      </Card>
    </ModalForm>
  );
};

export default CreateForm;
