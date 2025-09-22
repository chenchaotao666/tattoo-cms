import { PlusOutlined } from '@ant-design/icons';
import type { ProFormInstance } from '@ant-design/pro-components';
import { ModalForm, ProFormText, ProFormSelect } from '@ant-design/pro-components';
import { Button, message } from 'antd';
import React, { useRef, useState } from 'react';
import { addPost } from '@/services/posts';
import RichTextLanguageForm from '@/components/MultiLanguageForm/RichTextLanguageForm';
import ImageUpload from '@/components/ImageUpload';
import { uploadImageOnSubmit } from '@/services/upload';

type CreateFormProps = {
  reload?: () => void;
};

// 博客文章表单字段配置
const POST_FIELDS = [
  { key: 'title', label: '标题', type: 'text' as const, required: true },
  { key: 'excerpt', label: '摘要', type: 'textarea' as const, rows: 3 },
  { key: 'content', label: '内容', type: 'richtext' as const, height: 400 },
];

const CreateForm: React.FC<CreateFormProps> = ({ reload }) => {
  const formRef = useRef<ProFormInstance>();
  const [messageApi, contextHolder] = message.useMessage();
  const [activeLanguages, setActiveLanguages] = useState<string[]>(['en', 'zh']);
  const [featuredImage, setFeaturedImage] = useState<File | string>();

  // 合并多语言字段的工具函数
  const mergeLanguageFields = (fieldPrefix: string, values: any) => {
    const result: Record<string, string> = {};
    activeLanguages.forEach(lang => {
      const fieldValue = values[`${fieldPrefix}_${lang}`];
      // 包含所有激活语言的字段，即使值为空字符串也要保留
      if (fieldValue !== undefined && fieldValue !== null) {
        result[lang] = fieldValue;
      }
    });
    return result;
  };

  const handleSubmit = async (values: any) => {
    try {
      let featuredImageUrl = '';

      // 如果有上传的图片文件，先上传图片
      if (featuredImage instanceof File) {
        try {
          const titleEn = mergeLanguageFields('title', values)?.en || '';
          featuredImageUrl = await uploadImageOnSubmit(
            featuredImage,
            values.slug,
            titleEn,
            'post'
          );
          messageApi.success('图片上传成功');
        } catch (uploadError: any) {
          messageApi.error(`图片上传失败: ${uploadError.message}`);
          return false;
        }
      } else if (typeof featuredImage === 'string') {
        featuredImageUrl = featuredImage;
      }

      const params = {
        title: mergeLanguageFields('title', values),
        excerpt: mergeLanguageFields('excerpt', values),
        content: mergeLanguageFields('content', values),
        author: values.author,
        slug: values.slug,
        status: values.status || 'draft',
        featuredImageUrl,
      };

      await addPost(params);
      messageApi.success('新增博客文章成功');
      formRef.current?.resetFields();
      setActiveLanguages(['en', 'zh']);
      setFeaturedImage(undefined);
      reload?.();
      return true;
    } catch (error) {
      messageApi.error('新增博客文章失败');
      return false;
    }
  };

  return (
    <ModalForm
      title="新增博客文章"
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
          setFeaturedImage(undefined);
        },
      }}
      submitTimeout={2000}
      onFinish={handleSubmit}
      width={1000}
    >
      {contextHolder}

      {/* 多语言表单 */}
      <RichTextLanguageForm
        fields={POST_FIELDS}
        activeLanguages={activeLanguages}
        onLanguagesChange={setActiveLanguages}
        formRef={formRef}
        onFieldChange={(fieldKey: string, lang: string, value: string) => {
          // 当英文标题发生变化时，自动生成slug
          if (fieldKey === 'title' && lang === 'en' && value) {
            const slug = value.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
            formRef.current?.setFieldValue('slug', slug);
          }
        }}
      />

      {/* 特色图片 */}
      <div style={{ marginTop: 24, padding: '16px', backgroundColor: '#fafafa', borderRadius: 8 }}>
        <h4 style={{ marginBottom: 16, fontSize: 16, fontWeight: 500 }}>特色图片</h4>
        <ImageUpload
          value={featuredImage}
          onChange={setFeaturedImage}
          slug={formRef.current?.getFieldValue('slug')}
          nameEn={formRef.current?.getFieldValue('title_en')}
          placeholder="点击上传文章封面图片"
          showPreview={true}
        />
      </div>

      {/* 基础信息 */}
      <div style={{ marginTop: 24, padding: '16px', backgroundColor: '#fafafa', borderRadius: 8 }}>
        <h4 style={{ marginBottom: 16, fontSize: 16, fontWeight: 500 }}>基础信息</h4>
        <ProFormText
          name="author"
          label="作者"
          placeholder="请输入作者名称"
          rules={[{ required: true, message: '请输入作者名称' }]}
        />
        <ProFormText
          name="slug"
          label="Slug"
          placeholder="将根据英文标题自动生成"
          disabled
          tooltip="URL友好的标识符，将根据英文标题自动生成"
        />
        <ProFormSelect
          name="status"
          label="状态"
          placeholder="请选择文章状态"
          initialValue="draft"
          options={[
            { label: '草稿', value: 'draft' },
            { label: '已发布', value: 'published' },
          ]}
        />
      </div>
    </ModalForm>
  );
};

export default CreateForm;