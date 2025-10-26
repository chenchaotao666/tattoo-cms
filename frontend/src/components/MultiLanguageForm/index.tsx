import { GlobalOutlined, LoadingOutlined } from '@ant-design/icons';
import { ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { Button, message, Tabs, Select, Space, Tooltip, Progress, Modal } from 'antd';
import React, { useState } from 'react';
import { translateText } from '@/services/translation';

// 支持的语言列表
export const SUPPORTED_LANGUAGES = [
  { value: 'en', label: 'English', flag: '🇺🇸' },
  { value: 'zh', label: '中文', flag: '🇨🇳' },
  { value: 'tw', label: '繁體中文', flag: '🇹🇼' },
  { value: 'ja', label: '日本語', flag: '🇯🇵' },
  { value: 'ko', label: '한국어', flag: '🇰🇷' },
  { value: 'es', label: 'Español', flag: '🇪🇸' },
  { value: 'fr', label: 'Français', flag: '🇫🇷' },
  { value: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { value: 'it', label: 'Italiano', flag: '🇮🇹' },
  { value: 'pt', label: 'Português', flag: '🇵🇹' },
  { value: 'ru', label: 'Русский', flag: '🇷🇺' },
];

interface FieldConfig {
  key: string;
  label: string;
  type: 'text' | 'textarea';
  required?: boolean;
  rows?: number;
}

interface MultiLanguageFormProps {
  fields: FieldConfig[];
  activeLanguages: string[];
  onLanguagesChange: (languages: string[]) => void;
  formRef?: any;
  onTranslate?: () => void;
  isTranslating?: boolean;
  onFieldChange?: (fieldKey: string, lang: string, value: string) => void;
}

const MultiLanguageForm: React.FC<MultiLanguageFormProps> = ({
  fields,
  activeLanguages,
  onLanguagesChange,
  formRef,
  onTranslate,
  isTranslating = false,
  onFieldChange
}) => {
  const [currentTab, setCurrentTab] = useState<string>('en');
  const [messageApi] = message.useMessage();
  const [translationProgress, setTranslationProgress] = useState({
    visible: false,
    current: 0,
    total: 0,
    currentLanguage: '',
    currentField: '',
  });

  // 内部翻译处理
  const handleInternalTranslate = async () => {
    if (!formRef?.current) return;
    
    const currentValues = formRef.current.getFieldsValue();
    const baseFields: Record<string, string> = {};
    
    // 获取英文字段值
    fields.forEach(field => {
      baseFields[field.key] = currentValues[`${field.key}_en`];
    });

    // 检查英文内容是否存在
    const hasEnglishContent = Object.values(baseFields).some(value => value && value.trim());
    if (!hasEnglishContent) {
      messageApi.warning('请先填写英文内容');
      return;
    }

    const targetLanguages = activeLanguages.filter(lang => lang !== 'en');
    const fieldsToTranslate = fields.filter(field => baseFields[field.key]);
    const totalTasks = targetLanguages.length * fieldsToTranslate.length;

    // 显示进度条
    setTranslationProgress({
      visible: true,
      current: 0,
      total: totalTasks,
      currentLanguage: '',
      currentField: '',
    });

    try {
      const newValues: Record<string, any> = {};
      let currentTask = 0;

      // 按语言逐个翻译，显示进度
      for (const lang of targetLanguages) {
        const langInfo = SUPPORTED_LANGUAGES.find(l => l.value === lang);
        
        for (const field of fieldsToTranslate) {
          setTranslationProgress(prev => ({
            ...prev,
            current: currentTask,
            currentLanguage: langInfo?.label || lang,
            currentField: field.label,
          }));

          try {
            const translatedText = await translateText(baseFields[field.key], 'en', lang);
            if (translatedText) {
              newValues[`${field.key}_${lang}`] = translatedText;
            }
          } catch (error) {
            console.error(`Translation failed for ${field.key} to ${lang}:`, error);
          }

          currentTask++;
          setTranslationProgress(prev => ({
            ...prev,
            current: currentTask,
          }));

          // 添加小延迟让用户看到进度变化
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // 设置翻译结果到表单
      formRef.current.setFieldsValue(newValues);
      
      // 关闭进度条
      setTranslationProgress(prev => ({ ...prev, visible: false }));
      messageApi.success('翻译完成');
    } catch (error) {
      setTranslationProgress(prev => ({ ...prev, visible: false }));
      messageApi.error('翻译失败，请重试');
      console.error('Translation error:', error);
    }
  };

  // 生成字段组件
  const renderField = (field: FieldConfig, lang: string) => {
    const langInfo = SUPPORTED_LANGUAGES.find(l => l.value === lang);
    const fieldName = `${field.key}_${lang}`;
    const isRequired = field.required && lang === 'en';
    
    const commonProps = {
      name: fieldName,
      label: `${langInfo?.flag} ${field.label}`,
      placeholder: `请输入${langInfo?.label}${field.label}`,
      rules: isRequired ? [{ required: true, message: `请输入英文${field.label}` }] : undefined,
      onChange: (e: any) => {
        const value = e.target ? e.target.value : e;
        onFieldChange?.(field.key, lang, value);
      },
    };

    if (field.type === 'textarea') {
      return (
        <ProFormTextArea
          key={fieldName}
          {...commonProps}
          rows={field.rows || 3}
        />
      );
    }

    return (
      <ProFormText
        key={fieldName}
        {...commonProps}
      />
    );
  };

  // 单个语言翻译功能
  const handleSingleLanguageTranslate = async (targetLang: string) => {
    if (!formRef?.current || targetLang === 'en') return;

    const currentValues = formRef.current.getFieldsValue();
    const baseFields: Record<string, string> = {};

    // 获取英文字段值
    fields.forEach(field => {
      baseFields[field.key] = currentValues[`${field.key}_en`];
    });

    // 检查英文内容是否存在
    const hasEnglishContent = Object.values(baseFields).some(value => value && value.trim());
    if (!hasEnglishContent) {
      messageApi.warning('请先填写英文内容');
      return;
    }

    const fieldsToTranslate = fields.filter(field => baseFields[field.key]);
    const totalTasks = fieldsToTranslate.length;

    // 显示进度条
    setTranslationProgress({
      visible: true,
      current: 0,
      total: totalTasks,
      currentLanguage: SUPPORTED_LANGUAGES.find(l => l.value === targetLang)?.label || targetLang,
      currentField: '',
    });

    try {
      const newValues: Record<string, any> = {};
      let currentTask = 0;

      for (const field of fieldsToTranslate) {
        setTranslationProgress(prev => ({
          ...prev,
          current: currentTask,
          currentField: field.label,
        }));

        try {
          const translatedText = await translateText(baseFields[field.key], 'en', targetLang);
          if (translatedText) {
            newValues[`${field.key}_${targetLang}`] = translatedText;
          }
        } catch (error) {
          console.error(`Translation failed for ${field.key} to ${targetLang}:`, error);
        }

        currentTask++;
        setTranslationProgress(prev => ({
          ...prev,
          current: currentTask,
        }));

        // 添加小延迟让用户看到进度变化
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // 设置翻译结果到表单
      formRef.current.setFieldsValue(newValues);

      // 关闭进度条
      setTranslationProgress(prev => ({ ...prev, visible: false }));
      messageApi.success(`${SUPPORTED_LANGUAGES.find(l => l.value === targetLang)?.label}翻译完成`);
    } catch (error) {
      setTranslationProgress(prev => ({ ...prev, visible: false }));
      messageApi.error('翻译失败，请重试');
      console.error('Translation error:', error);
    }
  };

  // 生成Tabs的内容
  const generateTabContent = (lang: string) => {
    const isEnglish = lang === 'en';
    const langInfo = SUPPORTED_LANGUAGES.find(l => l.value === lang);

    return (
      <div style={{ padding: '0 16px' }}>
        {/* 非英文标签页显示自动翻译按钮 */}
        {!isEnglish && (
          <div style={{
            marginBottom: 16,
            padding: '8px 12px',
            backgroundColor: '#f6ffed',
            border: '1px solid #b7eb8f',
            borderRadius: 6,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{ fontSize: 14, color: '#52c41a' }}>
              🌐 基于英文内容自动翻译到{langInfo?.label}
            </span>
            <Button
              type="primary"
              size="small"
              icon={translationProgress.visible ? <LoadingOutlined /> : <GlobalOutlined />}
              onClick={() => handleSingleLanguageTranslate(lang)}
              loading={translationProgress.visible}
            >
              自动翻译
            </Button>
          </div>
        )}
        {fields.map(field => renderField(field, lang))}
      </div>
    );
  };

  return (
    <>
      <div style={{ border: '1px solid #d9d9d9', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ 
          padding: '12px 16px', 
          backgroundColor: '#fafafa', 
          borderBottom: '1px solid #d9d9d9',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{ fontWeight: 500 }}>多语言内容</span>
          <Space>
            <Select
              mode="multiple"
              placeholder="选择语言"
              value={activeLanguages}
              onChange={onLanguagesChange}
              style={{ minWidth: 200 }}
              options={SUPPORTED_LANGUAGES.map(lang => ({
                value: lang.value,
                label: `${lang.flag} ${lang.label}`,
              }))}
            />
            <Tooltip title="基于英文内容自动翻译到其他语言">
              <Button
                icon={isTranslating || translationProgress.visible ? <LoadingOutlined /> : <GlobalOutlined />}
                onClick={onTranslate || handleInternalTranslate}
                loading={isTranslating || translationProgress.visible}
                disabled={activeLanguages.length <= 1}
              >
                自动翻译
              </Button>
            </Tooltip>
          </Space>
        </div>
        
        <Tabs
          activeKey={currentTab}
          onChange={setCurrentTab}
          items={activeLanguages.map(lang => {
            const langInfo = SUPPORTED_LANGUAGES.find(l => l.value === lang);
            return {
              key: lang,
              label: (
                <span>
                  {langInfo?.flag} {langInfo?.label}
                  {lang === 'en' && <span style={{ color: '#1890ff', fontSize: 12 }}> (基础)</span>}
                </span>
              ),
              children: generateTabContent(lang),
              forceRender: true, // 强制渲染所有tab内容，确保表单字段被初始化
            };
          })}
          style={{ minHeight: 300 }}
        />
      </div>

      {/* 翻译进度弹窗 */}
      <Modal
        title="正在翻译..."
        open={translationProgress.visible}
        footer={null}
        closable={false}
        centered
        width={500}
      >
        <div style={{ padding: '20px 0' }}>
          <Progress
            percent={Math.round((translationProgress.current / translationProgress.total) * 100)}
            status="active"
            strokeColor={{
              '0%': '#108ee9',
              '100%': '#87d068',
            }}
          />
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 16, marginBottom: 8 }}>
              正在翻译 {translationProgress.currentField} 到 {translationProgress.currentLanguage}
            </div>
            <div style={{ color: '#666', fontSize: 14 }}>
              进度: {translationProgress.current} / {translationProgress.total}
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default MultiLanguageForm;
