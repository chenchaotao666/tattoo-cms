import type { ProFormInstance } from '@ant-design/pro-components';
import { ModalForm, ProFormText, ProFormSelect } from '@ant-design/pro-components';
import { Button, message } from 'antd';
import React, { useRef, useState, useEffect } from 'react';
import { updatePost } from '@/services/posts';
import RichTextLanguageForm from '@/components/MultiLanguageForm/RichTextLanguageForm';
import ImageUpload from '@/components/ImageUpload';
import { uploadImageOnSubmit } from '@/services/upload';

export type PostItem = {
  id: string;
  title: { en: string; zh: string };
  excerpt: { en: string; zh: string };
  content: { en: string; zh: string };
  slug: string;
  author: string;
  status: 'draft' | 'published';
  featuredImageUrl?: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
};

type UpdateFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentRow?: PostItem;
  reload?: () => void;
};

// 博客文章表单字段配置
const POST_FIELDS = [
  { key: 'title', label: '标题', type: 'text' as const, required: true },
  { key: 'excerpt', label: '摘要', type: 'textarea' as const, rows: 3 },
  { key: 'content', label: '内容', type: 'richtext' as const, height: 400 },
];

const UpdateForm: React.FC<UpdateFormProps> = ({ open, onOpenChange, currentRow, reload }) => {
  const formRef = useRef<ProFormInstance>();
  const [messageApi, contextHolder] = message.useMessage();
  const [activeLanguages, setActiveLanguages] = useState<string[]>(['en', 'zh']);
  const [featuredImage, setFeaturedImage] = useState<File | string>();


  // 合并多语言字段的工具函数
  const mergeLanguageFields = (fieldPrefix: string, values: any) => {
    const result: Record<string, string> = {};

    // 先获取原有数据
    if (currentRow && currentRow[fieldPrefix]) {
      let originalData = currentRow[fieldPrefix];

      // 如果是字符串，尝试解析为 JSON
      if (typeof originalData === 'string') {
        try {
          originalData = JSON.parse(originalData);
        } catch (e) {
          originalData = {};
        }
      }

      // 复制原有数据
      if (originalData && typeof originalData === 'object') {
        Object.assign(result, originalData);
      }
    }

    // 然后用表单数据覆盖
    activeLanguages.forEach(lang => {
      const fieldValue = values[`${fieldPrefix}_${lang}`];
      // 包含所有激活语言的字段，即使值为空字符串也要保留
      if (fieldValue !== undefined && fieldValue !== null) {
        result[lang] = fieldValue;
      }
    });

    return result;
  };

  // 分解多语言字段的工具函数
  const expandLanguageFields = (data: any) => {
    const result: Record<string, any> = {};

    // 处理基础字段
    result.author = data.author;
    result.slug = data.slug;
    result.status = data.status;
    result.featuredImageUrl = data.featuredImageUrl;

    // 处理多语言字段
    POST_FIELDS.forEach(field => {
      let fieldData = data[field.key];

      // 如果是字符串，尝试解析为 JSON
      if (typeof fieldData === 'string') {
        try {
          fieldData = JSON.parse(fieldData);
        } catch (e) {
          console.warn(`无法解析字段 ${field.key}:`, fieldData);
          fieldData = {};
        }
      }

      if (fieldData && typeof fieldData === 'object') {
        Object.keys(fieldData).forEach(lang => {
          result[`${field.key}_${lang}`] = fieldData[lang];
        });
      }
    });

    return result;
  };

  // 当表单打开时，设置初始值
  useEffect(() => {
    if (open && currentRow) {
      const expandedData = expandLanguageFields(currentRow);

      // 设置图片初始值
      setFeaturedImage(currentRow.featuredImageUrl || undefined);

      // 设置激活的语言
      const languages = new Set<string>();
      POST_FIELDS.forEach(field => {
        let fieldData = currentRow[field.key];

        // 如果是字符串，尝试解析为 JSON
        if (typeof fieldData === 'string') {
          try {
            fieldData = JSON.parse(fieldData);
          } catch (e) {
            fieldData = {};
          }
        }

        if (fieldData && typeof fieldData === 'object') {
          Object.keys(fieldData).forEach(lang => {
            // 只要字段存在就激活该语言，即使值为空
            if (fieldData.hasOwnProperty(lang)) {
              languages.add(lang);
            }
          });
        }
      });

      if (languages.size > 0) {
        setActiveLanguages(Array.from(languages));
      }

      // 延迟设置表单值，确保 formRef 已准备好
      setTimeout(() => {
        if (formRef.current) {
          formRef.current.setFieldsValue(expandedData);
        }
      }, 100);
    } else if (!open) {
      // 当对话框关闭时，清空图片状态
      setFeaturedImage(undefined);
    }
  }, [open, currentRow]);

  const handleSubmit = async (values: any) => {
    if (!currentRow?.id) return false;

    try {
      let featuredImageUrl = currentRow.featuredImageUrl || '';

      console.log('=== 前端提交调试信息 ===');
      console.log('当前图片状态:', {
        featuredImage,
        featuredImageType: typeof featuredImage,
        currentRowFeaturedImageUrl: currentRow.featuredImageUrl,
        isFile: featuredImage instanceof File,
        isString: typeof featuredImage === 'string',
        isUndefined: featuredImage === undefined
      });

      // 如果有上传的新图片文件，先上传图片
      if (featuredImage instanceof File) {
        console.log('场景：上传新图片文件');
        try {
          const titleEn = mergeLanguageFields('title', values)?.en || '';
          featuredImageUrl = await uploadImageOnSubmit(
            featuredImage,
            values.slug,
            titleEn,
            'post'
          );
          console.log('新图片上传成功，URL:', featuredImageUrl);
          messageApi.success('图片上传成功');
        } catch (uploadError: any) {
          messageApi.error(`图片上传失败: ${uploadError.message}`);
          return false;
        }
      } else if (typeof featuredImage === 'string') {
        console.log('场景：使用现有图片字符串');
        featuredImageUrl = featuredImage;
      } else if (featuredImage === undefined) {
        console.log('场景：用户删除了图片');
        // 如果用户删除了图片，则清空
        featuredImageUrl = '';
      }

      console.log('最终featuredImageUrl:', featuredImageUrl);

      const params = {
        title: mergeLanguageFields('title', values),
        excerpt: mergeLanguageFields('excerpt', values),
        content: mergeLanguageFields('content', values),
        author: values.author,
        slug: values.slug,
        status: values.status,
        featuredImageUrl,
      };

      console.log('提交给后端的参数:', params);
      console.log('=== 前端提交调试结束 ===');

      await updatePost(currentRow.id, params);
      messageApi.success('更新博客文章成功');
      onOpenChange(false);
      reload?.();
      return true;
    } catch (error) {
      messageApi.error('更新博客文章失败');
      return false;
    }
  };

  const initialValues = currentRow ? expandLanguageFields(currentRow) : {};

  return (
    <ModalForm
      title="编辑博客文章"
      open={open}
      onOpenChange={onOpenChange}
      formRef={formRef}
      autoFocusFirstInput={false}
      initialValues={initialValues}
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
          options={[
            { label: '草稿', value: 'draft' },
            { label: '已发布', value: 'published' },
          ]}
        />
      </div>
    </ModalForm>
  );
};

export default UpdateForm;