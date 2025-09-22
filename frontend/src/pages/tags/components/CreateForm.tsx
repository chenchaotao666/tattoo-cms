import { PlusOutlined } from '@ant-design/icons';
import type { ProFormInstance } from '@ant-design/pro-components';
import { ModalForm } from '@ant-design/pro-components';
import { Button, message } from 'antd';
import React, { useRef, useState } from 'react';
import { addTag } from '@/services/tags';
import MultiLanguageForm from '@/components/MultiLanguageForm';

type CreateFormProps = {
  reload?: () => void;
};

// 标签表单字段配置
const TAG_FIELDS = [
  { key: 'name', label: '标签名称', type: 'text' as const, required: true },
  { key: 'description', label: '描述', type: 'textarea' as const, rows: 3 },
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
        name: mergeLanguageFields('name', values),
        description: mergeLanguageFields('description', values),
      };

      await addTag(params);
      messageApi.success('新增标签成功');
      formRef.current?.resetFields();
      reload?.();
      return true;
    } catch (error) {
      messageApi.error('新增标签失败');
      return false;
    }
  };

  return (
    <ModalForm
      title="新增标签"
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
      width={600}
    >
      {contextHolder}
      
      {/* 多语言表单 */}
      <MultiLanguageForm
        fields={TAG_FIELDS}
        activeLanguages={activeLanguages}
        onLanguagesChange={setActiveLanguages}
        formRef={formRef}
      />
    </ModalForm>
  );
};

export default CreateForm;
