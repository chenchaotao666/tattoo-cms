import type { ProFormInstance } from '@ant-design/pro-components';
import { ModalForm, ProFormText, ProFormDigit, ProForm } from '@ant-design/pro-components';
import { message } from 'antd';
import React, { useRef, useState, useEffect } from 'react';
import { updateStyle } from '@/services/styles';
import { uploadImageOnSubmit } from '@/services/upload';
import MultiLanguageForm from '@/components/MultiLanguageForm';
import ImageUpload from '@/components/ImageUpload';
import type { StyleItem } from '../index';

type UpdateFormProps = {
  onOk?: () => void;
  trigger: React.ReactElement;
  values: StyleItem;
};

// 样式表单字段配置
const STYLE_FIELDS = [
  { key: 'title', label: '样式名称', type: 'text' as const, required: true },
  { key: 'prompt', label: '提示词', type: 'textarea' as const, rows: 4, required: true },
];

const UpdateForm: React.FC<UpdateFormProps> = ({ onOk, trigger, values }) => {
  const formRef = useRef<ProFormInstance>();
  const [messageApi, contextHolder] = message.useMessage();
  const [imageFile, setImageFile] = useState<File | string | undefined>();

  // 从现有数据中提取支持的语言
  const getActiveLanguages = () => {
    const languages = new Set(['en']); // 英语是必须的
    if (values.title) {
      Object.keys(values.title).forEach(lang => languages.add(lang));
    }
    if (values.prompt) {
      Object.keys(values.prompt).forEach(lang => languages.add(lang));
    }
    return Array.from(languages);
  };

  const [activeLanguages, setActiveLanguages] = useState<string[]>(getActiveLanguages());

  // 初始化图片状态
  useEffect(() => {
    setImageFile(values.imageUrl || undefined);
  }, [values.imageUrl]);

  // 合并多语言字段的工具函数
  const mergeLanguageFields = (fieldPrefix: string, formValues: any) => {
    const result: Record<string, string> = {};

    // 首先从原始数据中复制所有现有的语言值
    if (values && values[fieldPrefix as keyof StyleItem] && typeof values[fieldPrefix as keyof StyleItem] === 'object') {
      const fieldData = values[fieldPrefix as keyof StyleItem] as Record<string, string>;
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
      let imageUrl = values.imageUrl || '';

      console.log('=== 样式前端提交调试信息 ===');
      console.log('当前图片状态:', {
        imageFile,
        imageFileType: typeof imageFile,
        currentImageUrl: values.imageUrl,
        isFile: imageFile instanceof File,
        isString: typeof imageFile === 'string',
        isUndefined: imageFile === undefined
      });

      // 如果有上传的新图片文件，先上传图片
      if (imageFile instanceof File) {
        console.log('场景：上传新图片文件');
        messageApi.loading('正在上传图片...', 0);

        try {
          const nameEn = mergeLanguageFields('title', formValues).en;
          imageUrl = await uploadImageOnSubmit(
            imageFile,
            undefined, // 样式没有slug字段
            nameEn,
            'style' // 使用style前缀
          );
          console.log('新图片上传成功，URL:', imageUrl);
          messageApi.destroy();
          messageApi.success('图片上传成功');
        } catch (uploadError: any) {
          messageApi.destroy();
          messageApi.error(`图片上传失败: ${uploadError.message}`);
          return false;
        }
      } else if (typeof imageFile === 'string') {
        console.log('场景：使用现有图片字符串');
        imageUrl = imageFile;
      } else if (imageFile === undefined) {
        console.log('场景：用户删除了图片');
        // 如果用户删除了图片，则清空
        imageUrl = '';
      }

      console.log('最终imageUrl:', imageUrl);

      const params = {
        id: values.id,
        title: mergeLanguageFields('title', formValues),
        prompt: mergeLanguageFields('prompt', formValues),
        imageUrl,
        sortOrder: formValues.sortOrder || 0,
      };

      console.log('提交给后端的参数:', params);
      console.log('=== 样式前端提交调试结束 ===');

      await updateStyle(params.id, params);
      messageApi.success('更新样式成功');
      onOk?.();
      return true;
    } catch (error) {
      messageApi.error('更新样式失败');
      return false;
    }
  };

  // 准备初始值
  const getInitialValues = () => {
    const initialValues: Record<string, any> = {
      sortOrder: values.sortOrder || 0,
    };

    // 为每种语言设置初始值
    activeLanguages.forEach(lang => {
      if (values.title?.[lang]) {
        initialValues[`title_${lang}`] = values.title[lang];
      }
      if (values.prompt?.[lang]) {
        initialValues[`prompt_${lang}`] = values.prompt[lang];
      }
    });

    return initialValues;
  };

  return (
    <ModalForm
      title="编辑样式"
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
        fields={STYLE_FIELDS}
        activeLanguages={activeLanguages}
        onLanguagesChange={setActiveLanguages}
        formRef={formRef}
      />

      {/* 基础信息 */}
      <div style={{ marginTop: 24 }}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 14, fontWeight: 500, marginBottom: 8, display: 'block' }}>示例图片</label>
          <ImageUpload
            value={imageFile}
            onChange={setImageFile}
            placeholder="点击上传示例图片"
            nameEn={values.title?.en || ''}
            showPreview={true}
          />
        </div>
        <ProFormDigit
          name="sortOrder"
          label="排序"
          min={0}
          max={9999}
          placeholder="数字越小排序越靠前"
        />
      </div>
    </ModalForm>
  );
};

export default UpdateForm;