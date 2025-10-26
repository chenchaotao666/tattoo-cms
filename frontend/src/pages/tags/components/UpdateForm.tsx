import type { ProFormInstance } from '@ant-design/pro-components';
import { ModalForm } from '@ant-design/pro-components';
import { message } from 'antd';
import React, { useRef, useState } from 'react';
import { updateTag } from '@/services/tags';
import MultiLanguageForm from '@/components/MultiLanguageForm';
import type { TagItem } from '../index';

type UpdateFormProps = {
  onOk?: () => void;
  trigger: React.ReactElement;
  values: TagItem;
};

// 标签表单字段配置
const TAG_FIELDS = [
  { key: 'name', label: '标签名称', type: 'text' as const, required: true },
  { key: 'description', label: '描述', type: 'textarea' as const, rows: 3 },
];

const UpdateForm: React.FC<UpdateFormProps> = ({ onOk, trigger, values }) => {
  const formRef = useRef<ProFormInstance>();
  const [messageApi, contextHolder] = message.useMessage();
  
  // 从现有数据中提取支持的语言
  const getActiveLanguages = () => {
    const languages = new Set(['en', 'zh']); // 英语和中文是必须的
    if (values.name) {
      Object.keys(values.name).forEach(lang => languages.add(lang));
    }
    if (values.description) {
      Object.keys(values.description).forEach(lang => languages.add(lang));
    }
    return Array.from(languages);
  };

  const [activeLanguages, setActiveLanguages] = useState<string[]>(getActiveLanguages());

  // 合并多语言字段的工具函数
  const mergeLanguageFields = (fieldPrefix: string, formValues: any) => {
    const result: Record<string, string> = {};

    // 首先从原始数据中复制所有现有的语言值
    if (values && values[fieldPrefix as keyof TagItem] && typeof values[fieldPrefix as keyof TagItem] === 'object') {
      const fieldData = values[fieldPrefix as keyof TagItem] as Record<string, string>;
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
      };

      await updateTag(params.id, params);
      messageApi.success('更新标签成功');
      onOk?.();
      return true;
    } catch (error) {
      messageApi.error('更新标签失败');
      return false;
    }
  };

  // 准备初始值
  const getInitialValues = () => {
    const initialValues: Record<string, any> = {};

    // 为每种语言设置初始值
    activeLanguages.forEach(lang => {
      if (values.name?.[lang]) {
        initialValues[`name_${lang}`] = values.name[lang];
      }
      if (values.description?.[lang]) {
        initialValues[`description_${lang}`] = values.description[lang];
      }
    });

    return initialValues;
  };

  return (
    <ModalForm
      title="编辑标签"
      trigger={trigger}
      formRef={formRef}
      autoFocusFirstInput={false}
      modalProps={{
        destroyOnHidden: true,
      }}
      submitTimeout={2000}
      onFinish={handleSubmit}
      width={600}
      initialValues={getInitialValues()}
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

export default UpdateForm;
