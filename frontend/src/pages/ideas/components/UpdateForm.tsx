import type { ProFormInstance } from '@ant-design/pro-components';
import { ModalForm } from '@ant-design/pro-components';
import { message } from 'antd';
import React, { useRef, useState } from 'react';
import { updateIdea } from '@/services/ideas';
import MultiLanguageForm from '@/components/MultiLanguageForm';
import type { IdeaItem } from '../index';

type UpdateFormProps = {
  onOk?: () => void;
  trigger: React.ReactElement;
  values: IdeaItem;
};

// 创意表单字段配置
const IDEA_FIELDS = [
  { key: 'title', label: '创意名称', type: 'text' as const, required: true },
  { key: 'prompt', label: '提示词', type: 'textarea' as const, rows: 4, required: true },
];

const UpdateForm: React.FC<UpdateFormProps> = ({ onOk, trigger, values }) => {
  const formRef = useRef<ProFormInstance>();
  const [messageApi, contextHolder] = message.useMessage();
  
  // 从现有数据中提取支持的语言
  const getActiveLanguages = () => {
    const languages = new Set(['en', 'zh']); // 英语和中文是必须的
    if (values.title) {
      Object.keys(values.title).forEach(lang => languages.add(lang));
    }
    if (values.prompt) {
      Object.keys(values.prompt).forEach(lang => languages.add(lang));
    }
    return Array.from(languages);
  };

  const [activeLanguages, setActiveLanguages] = useState<string[]>(getActiveLanguages());

  // 合并多语言字段的工具函数
  const mergeLanguageFields = (fieldPrefix: string, formValues: any) => {
    const result: Record<string, string> = {};
    activeLanguages.forEach(lang => {
      const fieldValue = formValues[`${fieldPrefix}_${lang}`];
      if (fieldValue) {
        result[lang] = fieldValue;
      }
    });
    return result;
  };

  const handleSubmit = async (formValues: any) => {
    try {
      const params = {
        id: values.id,
        title: mergeLanguageFields('title', formValues),
        prompt: mergeLanguageFields('prompt', formValues),
      };

      await updateIdea(params.id, params);
      messageApi.success('更新创意成功');
      onOk?.();
      return true;
    } catch (error) {
      messageApi.error('更新创意失败');
      return false;
    }
  };

  // 准备初始值
  const getInitialValues = () => {
    const initialValues: Record<string, any> = {};

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
      title="编辑创意"
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
        fields={IDEA_FIELDS}
        activeLanguages={activeLanguages}
        onLanguagesChange={setActiveLanguages}
        formRef={formRef}
      />
    </ModalForm>
  );
};

export default UpdateForm;