import { PlusOutlined } from '@ant-design/icons';
import type { ProFormInstance } from '@ant-design/pro-components';
import { ModalForm, ProFormText, ProFormDigit, ProForm } from '@ant-design/pro-components';
import { Button, message } from 'antd';
import React, { useRef, useState } from 'react';
import { addStyle } from '@/services/styles';
import { uploadImageOnSubmit } from '@/services/upload';
import MultiLanguageForm from '@/components/MultiLanguageForm';
import ImageUpload from '@/components/ImageUpload';

type CreateFormProps = {
  reload?: () => void;
};

// 样式表单字段配置
const STYLE_FIELDS = [
  { key: 'title', label: '样式名称', type: 'text' as const, required: true },
  { key: 'prompt', label: '提示词', type: 'textarea' as const, rows: 4, required: true },
];

const CreateForm: React.FC<CreateFormProps> = ({ reload }) => {
  const formRef = useRef<ProFormInstance>();
  const [messageApi, contextHolder] = message.useMessage();
  const [activeLanguages, setActiveLanguages] = useState<string[]>(['en', 'zh']);

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
      let imageUrl = '';

      // 处理图片上传
      if (values.imageUrl && values.imageUrl instanceof File) {
        messageApi.loading('正在上传图片...', 0);

        try {
          const nameEn = mergeLanguageFields('title', values).en;
          imageUrl = await uploadImageOnSubmit(
            values.imageUrl,
            undefined, // 样式没有slug字段
            nameEn,
            'style' // 使用style前缀
          );
          messageApi.destroy();
          messageApi.success('图片上传成功');
        } catch (uploadError: any) {
          messageApi.destroy();
          messageApi.error(`图片上传失败: ${uploadError.message}`);
          return false;
        }
      }

      const params = {
        title: mergeLanguageFields('title', values),
        prompt: mergeLanguageFields('prompt', values),
        imageUrl: imageUrl,
        sortOrder: values.sortOrder || 0,
      };

      await addStyle(params);
      messageApi.success('新增样式成功');
      formRef.current?.resetFields();
      reload?.();
      return true;
    } catch (error) {
      messageApi.error('新增样式失败');
      return false;
    }
  };

  return (
    <ModalForm
      title="新增样式"
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
        },
      }}
      submitTimeout={2000}
      onFinish={handleSubmit}
      width={700}
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
        <ProForm.Item name="imageUrl" label="示例图片">
          <ImageUpload
            placeholder="点击上传示例图片"
            nameEn=""
          />
        </ProForm.Item>
        <ProFormDigit
          name="sortOrder"
          label="排序"
          min={0}
          max={9999}
          initialValue={0}
          placeholder="数字越小排序越靠前"
        />
      </div>
    </ModalForm>
  );
};

export default CreateForm;