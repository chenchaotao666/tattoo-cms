import type { ProFormInstance } from '@ant-design/pro-components';
import { ModalForm, ProFormText, ProFormDigit } from '@ant-design/pro-components';
import { message, Image, Button, Card } from 'antd';
import React, { useRef, useState } from 'react';
import { updateCategory } from '@/services/categories';
import MultiLanguageForm from '@/components/MultiLanguageForm';
import ImageSelector from '@/components/ImageSelector';
import { generateMinIOUrl } from '@/utils/config';
import type { CategoryItem } from '../index';

type UpdateFormProps = {
  onOk?: () => void;
  trigger: React.ReactElement;
  values: CategoryItem;
};

// 分类表单字段配置
const CATEGORY_FIELDS = [
  { key: 'name', label: '分类名称', type: 'text' as const, required: true },
  { key: 'description', label: '描述', type: 'textarea' as const, rows: 3 },
  { key: 'seoTitle', label: 'SEO标题', type: 'text' as const },
  { key: 'seoDesc', label: 'SEO描述', type: 'textarea' as const, rows: 2 },
];

const UpdateForm: React.FC<UpdateFormProps> = ({ onOk, trigger, values }) => {
  const formRef = useRef<ProFormInstance>();
  const [messageApi, contextHolder] = message.useMessage();
  
  // 从现有数据中提取支持的语言
  const getActiveLanguages = () => {
    const languages = new Set(['en']); // 英语是必须的
    if (values.name) {
      Object.keys(values.name).forEach(lang => languages.add(lang));
    }
    if (values.description) {
      Object.keys(values.description).forEach(lang => languages.add(lang));
    }
    return Array.from(languages);
  };

  const [activeLanguages, setActiveLanguages] = useState<string[]>(getActiveLanguages());
  const [selectedImageId, setSelectedImageId] = useState<string>(values?.imageId || '');
  const [selectedImageUrl, setSelectedImageUrl] = useState<string>(values?.tattooUrl || '');

  // 合并多语言字段的工具函数
  const mergeLanguageFields = (fieldPrefix: string, formValues: any) => {
    const result: Record<string, string> = {};

    // 首先从原始数据中复制所有现有的语言值
    if (values && values[fieldPrefix as keyof CategoryItem] && typeof values[fieldPrefix as keyof CategoryItem] === 'object') {
      const fieldData = values[fieldPrefix as keyof CategoryItem] as Record<string, string>;
      Object.keys(fieldData).forEach(lang => {
        if (fieldData[lang] !== undefined) {
          result[lang] = fieldData[lang];
        }
      });
    }

    // 然后用表单中的值覆盖（只覆盖activeLanguages中的语言）
    activeLanguages.forEach(lang => {
      const fieldValue = formValues[`${fieldPrefix}_${lang}`];
      if (fieldValue !== undefined) {
        result[lang] = fieldValue;
      }
    });

    return result;
  };

  const handleSubmit = async (formValues: any) => {
    try {
      const params = {
        id: values.id,
        name: mergeLanguageFields('name', formValues),
        description: mergeLanguageFields('description', formValues),
        slug: formValues.slug,
        hotness: formValues.hotness || 0,
        imageId: selectedImageId || null,
        seoTitle: mergeLanguageFields('seoTitle', formValues),
        seoDesc: mergeLanguageFields('seoDesc', formValues),
      };

      await updateCategory(params.id, params);
      messageApi.success('更新分类成功');
      onOk?.();
      return true;
    } catch (error) {
      messageApi.error('更新分类失败');
      return false;
    }
  };

  // 准备初始值
  const getInitialValues = () => {
    const initialValues: Record<string, any> = {
      slug: values.slug,
      hotness: values.hotness,
    };

    // 为每种语言设置初始值
    activeLanguages.forEach(lang => {
      if (values.name?.[lang]) {
        initialValues[`name_${lang}`] = values.name[lang];
      }
      if (values.description?.[lang]) {
        initialValues[`description_${lang}`] = values.description[lang];
      }
      if (values.seoTitle?.[lang]) {
        initialValues[`seoTitle_${lang}`] = values.seoTitle[lang];
      }
      if (values.seoDesc?.[lang]) {
        initialValues[`seoDesc_${lang}`] = values.seoDesc[lang];
      }
    });

    return initialValues;
  };

  return (
    <ModalForm
      title="编辑分类"
      trigger={trigger}
      formRef={formRef}
      autoFocusFirstInput={false}
      modalProps={{
        destroyOnHidden: true,
      }}
      submitTimeout={2000}
      onFinish={handleSubmit}
      width={700}
      initialValues={getInitialValues()}
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

export default UpdateForm;
