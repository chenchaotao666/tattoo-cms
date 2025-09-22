import { PlusOutlined } from '@ant-design/icons';
import type { ProFormInstance } from '@ant-design/pro-components';
import { ModalForm } from '@ant-design/pro-components';
import { Button, message } from 'antd';
import React, { useRef, useState } from 'react';
import { addIdea } from '@/services/ideas';
import MultiLanguageForm from '@/components/MultiLanguageForm';

type CreateFormProps = {
  reload?: () => void;
};

// 创意表单字段配置
const IDEA_FIELDS = [
  { key: 'title', label: '创意名称', type: 'text' as const, required: true },
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
      const params = {
        title: mergeLanguageFields('title', values),
        prompt: mergeLanguageFields('prompt', values),
      };

      await addIdea(params);
      messageApi.success('新增创意成功');
      formRef.current?.resetFields();
      reload?.();
      return true;
    } catch (error) {
      messageApi.error('新增创意失败');
      return false;
    }
  };

  return (
    <ModalForm
      title="新增创意"
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
        fields={IDEA_FIELDS}
        activeLanguages={activeLanguages}
        onLanguagesChange={setActiveLanguages}
        formRef={formRef}
      />
    </ModalForm>
  );
};

export default CreateForm;