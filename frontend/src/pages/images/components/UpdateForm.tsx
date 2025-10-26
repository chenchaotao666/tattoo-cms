import type { ProFormInstance } from '@ant-design/pro-components';
import { ModalForm, ProFormText, ProFormDigit, ProFormSelect, ProFormTextArea, ProFormSwitch, ProForm } from '@ant-design/pro-components';
import { Button, message, Card, Progress, Image, notification, Row, Col, Collapse } from 'antd';
import { LinkOutlined } from '@ant-design/icons';
import React, { useRef, useState, useEffect } from 'react';
import { updateImage, addImage, generateTattooAsync, getGenerationStatus, completeGeneration, type GenerateTattooRequest } from '@/services/images';
import { uploadImageOnSubmit } from '@/services/upload';
import { queryCategories } from '@/services/categories';
import { queryStyles } from '@/services/styles';
import { queryTags } from '@/services/tags';
import { generateMinIOUrl } from '@/utils/config';
import MultiLanguageForm from '@/components/MultiLanguageForm';
import ImageUpload from '@/components/ImageUpload';
import type { ImageItem } from '../index';

type UpdateFormProps = {
  onOk?: () => void;
  trigger: React.ReactElement;
  values: ImageItem | null; // null 表示新增模式
};

// 图片表单字段配置
const IMAGE_FIELDS = [
  { key: 'name', label: '图片名称', type: 'text' as const, required: true },
  { key: 'description', label: '图片描述', type: 'textarea' as const, rows: 2 },
  { key: 'prompt', label: '生成提示词', type: 'textarea' as const, rows: 3 },
  { key: 'additionalInfo', label: '额外信息', type: 'textarea' as const, rows: 2 },
];

const UpdateForm: React.FC<UpdateFormProps> = ({ onOk, trigger, values }) => {
  const formRef = useRef<ProFormInstance>(null);
  const [messageApi, contextHolder] = message.useMessage();
  
  // 从现有数据中提取支持的语言，新增模式时使用默认语言
  const getActiveLanguages = () => {
    const languages = new Set(['en', 'zh']); // 英语和中文是必须的

    // 如果是新增模式（values 为 null），返回默认语言
    if (!values) {
      return Array.from(languages);
    }

    // 编辑模式：从现有数据中提取语言
    [values.name, values.description, values.prompt, values.additionalInfo].forEach(field => {
      if (field && typeof field === 'object') {
        Object.keys(field).forEach(lang => languages.add(lang));
      }
    });
    return Array.from(languages);
  };

  const [activeLanguages, setActiveLanguages] = useState<string[]>(getActiveLanguages());

  // 选项数据
  const [categories, setCategories] = useState<any[]>([]);
  const [styles, setStyles] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);

  // AI生成相关状态
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStatus, setGenerationStatus] = useState('');
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [selectedGeneratedImage, setSelectedGeneratedImage] = useState<string>('');

  // 加载分类、样式和标签数据
  useEffect(() => {
    loadCategories();
    loadStyles();
    loadTags();
  }, []);

  // 重置所有状态的函数
  const resetAllStates = () => {
    setIsGenerating(false);
    setGenerationProgress(0);
    setGenerationStatus('');

    // 如果是新增模式，清空所有图片状态
    if (!values) {
      setGeneratedImages([]);
      setSelectedGeneratedImage('');
      setActiveLanguages(['en', 'zh']);
      return;
    }

    // 编辑模式：根据图片类型设置图片状态
    const imageType = values.type || 'manual';
    if (imageType === 'text2image' || imageType === 'image2image') {
      // 如果是AI生成的图片且有现有图片，保持显示状态
      if (values.tattooUrl) {
        setGeneratedImages([values.tattooUrl]);
        setSelectedGeneratedImage(values.tattooUrl);
      } else {
        setGeneratedImages([]);
        setSelectedGeneratedImage('');
      }
    } else {
      setGeneratedImages([]);
      setSelectedGeneratedImage('');
    }
  };


  // 初始化时根据图片类型设置状态
  useEffect(() => {
    console.log('UpdateForm values changed:', values);
    if (values) {
      console.log('Initializing form values, tattooUrl:', values.tattooUrl);

      // 根据图片类型设置AI生成图片状态
      if (values.type === 'text2image' || values.type === 'image2image') {
        // 如果是AI生成的图片，将其添加到生成图片列表中
        if (values.tattooUrl) {
          setGeneratedImages([values.tattooUrl]);
          setSelectedGeneratedImage(values.tattooUrl);
          // 同时设置表单字段值
          setTimeout(() => {
            formRef.current?.setFieldValue('aiGeneratedImageUrl', values.tattooUrl);
            // 确保刷新表单显示
            formRef.current?.validateFields();
          }, 100);
        }
      }

    }
  }, [values]);

  const loadCategories = async () => {
    try {
      const result = await queryCategories({ current: 1, pageSize: 1000 });
      if (result.success) {
        setCategories(result.data.map((item: any) => ({
          label: `${item.name?.en || 'Unnamed'} / ${item.name?.zh || '未命名'}`,
          value: item.id,
        })));
      }
    } catch (error) {
      console.error('Load categories error:', error);
    }
  };

  const loadStyles = async () => {
    try {
      const result = await queryStyles({ current: 1, pageSize: 1000 });
      if (result.success) {
        setStyles(result.data.map((item: any) => ({
          label: `${item.title?.en || 'Unnamed'} / ${item.title?.zh || '未命名'}`,
          value: item.id,
          title: item.title,
          description: item.description,
          prompt: item.prompt,
          originalData: item,
        })));
      }
    } catch (error) {
      console.error('Load styles error:', error);
    }
  };

  const loadTags = async () => {
    try {
      const result = await queryTags({ current: 1, pageSize: 1000 });
      if (result.success) {
        setTags(result.data.map((item: any) => ({
          label: `${item.name?.en || 'Unnamed'} / ${item.name?.zh || '未命名'}`,
          value: item.id,
        })));
      }
    } catch (error) {
      console.error('Load tags error:', error);
    }
  };

  // 合并多语言字段的工具函数
  const mergeLanguageFields = (fieldPrefix: string, formValues: any) => {
    const result: Record<string, string> = {};

    // 首先从原始数据中复制所有现有的语言值
    if (values && values[fieldPrefix as keyof ImageItem] && typeof values[fieldPrefix as keyof ImageItem] === 'object') {
      const fieldData = values[fieldPrefix as keyof ImageItem] as Record<string, string>;
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

  // 简化的验证函数
  const validateRequiredFields = (formValues: any): string[] => {
    const errors: string[] = [];
    const isEditing = !!values?.id;

    console.log('=== SIMPLIFIED VALIDATION ===');
    console.log('formValues:', formValues);
    console.log('isEditing:', isEditing);

    // 1. 检查是否有图片
    const hasNewUpload = !!(formValues.tattooUrl && formValues.tattooUrl instanceof File);
    const hasAIGenerated = !!(formValues.aiGeneratedImageUrl || selectedGeneratedImage);
    const hasExistingImage = !!(values?.tattooUrl && isEditing);

    console.log('Image check:');
    console.log('- hasNewUpload:', hasNewUpload);
    console.log('- hasAIGenerated:', hasAIGenerated);
    console.log('- hasExistingImage:', hasExistingImage);

    // 新增模式：必须有图片
    // 编辑模式：如果没有新图片，必须有原图片
    if (!isEditing) {
      // 新增模式：必须有上传或AI生成的图片
      if (!hasNewUpload && !hasAIGenerated) {
        errors.push('⚠️ 请上传图片或使用AI生成图片');
      }
    } else {
      // 编辑模式：如果没有新图片且原图片被删除，则报错
      if (!hasNewUpload && !hasAIGenerated && !hasExistingImage) {
        errors.push('⚠️ 请上传新图片或使用AI生成图片');
      }
    }

    // 2. 简化的名称检查：只要求中文或英文名称中至少有一个
    const hasName = formValues.name_en?.trim() || formValues.name_zh?.trim();
    if (!hasName && !isEditing) {
      // 新增时要求至少有一个名称
      errors.push('⚠️ 请填写图片名称（中文或英文）');
    }

    console.log('Final validation errors:', errors);
    console.log('=== END SIMPLIFIED VALIDATION ===');

    return errors;
  };

  const handleSubmit = async (formValues: any) => {
    try {
      console.log('handleSubmit called with values:', formValues);

      // 验证必填字段
      const validationErrors = validateRequiredFields(formValues);
      if (validationErrors.length > 0) {
        console.log('Validation errors:', validationErrors);
        // 使用notification显示验证错误
        notification.error({
          message: '表单验证失败',
          description: (
            <div>
              {validationErrors.map((error, index) => (
                <div key={index} style={{ marginBottom: index < validationErrors.length - 1 ? '8px' : '0' }}>
                  {error}
                </div>
              ))}
            </div>
          ),
          duration: 5,
          placement: 'top',
        });
        return false;
      }

      let tattooUrl = formValues.tattooUrl;
      let imageType = 'manual'; // 默认为手动上传

      // 自动确定图片类型和图片来源
      const hasAIGenerated = !!(formValues.aiGeneratedImageUrl || selectedGeneratedImage);
      const hasManualUpload = !!(formValues.tattooUrl && formValues.tattooUrl instanceof File);
      const isEditingAIImage = values?.type === 'text2image' || values?.type === 'image2image';

      // 图片选择优先级逻辑
      if (isEditingAIImage && hasAIGenerated) {
        // 编辑AI图片时，如果有AI生成的图片，优先使用AI生成的
        imageType = 'text2image';
        console.log('Editing AI image with AI generated content, keeping AI priority');
      } else if (hasAIGenerated && !isEditingAIImage) {
        // 非AI图片但有新的AI生成，使用AI生成
        imageType = 'text2image';
        console.log('New AI generated image detected, setting type to text2image');
      } else if (hasManualUpload && !hasAIGenerated) {
        // 只有手动上传且没有AI生成
        imageType = 'manual';
        console.log('Manual upload only, setting type to manual');
      } else if (hasManualUpload && isEditingAIImage && !hasAIGenerated) {
        // 编辑AI图片但只有手动上传（AI图片被清空），改为手动类型
        imageType = 'manual';
        console.log('Editing AI image but only manual upload, changing to manual type');
      } else {
        // 保持原有类型
        imageType = values?.type || 'manual';
        console.log('No new image operations, keeping existing type:', imageType);
      }


      // 根据图片类型和优先级选择图片
      if (imageType === 'text2image' && (formValues.aiGeneratedImageUrl || selectedGeneratedImage)) {
        // AI生成类型，优先使用AI生成的图片
        console.log('Using AI generated image for text2image type...');
        tattooUrl = selectedGeneratedImage || formValues.aiGeneratedImageUrl;
        console.log('Selected AI image URL:', tattooUrl);
      } else if (formValues.tattooUrl && formValues.tattooUrl instanceof File) {
        // 手动上传的图片
        messageApi.loading('正在上传图片...', 0);

        try {
          const nameEn = mergeLanguageFields('name', formValues).en;
          tattooUrl = await uploadImageOnSubmit(
            formValues.tattooUrl,
            formValues.slug,
            nameEn
          );
          messageApi.destroy();
          messageApi.success('图片上传成功');
        } catch (uploadError: any) {
          messageApi.destroy();
          messageApi.error(`图片上传失败: ${uploadError.message}`);
          return false;
        }
      } else if (formValues.aiGeneratedImageUrl || selectedGeneratedImage) {
        // 备选：使用AI生成的图片
        console.log('Using AI generated image as fallback...');
        tattooUrl = selectedGeneratedImage || formValues.aiGeneratedImageUrl;
        console.log('Selected AI image URL:', tattooUrl);
      } else if (values?.tattooUrl) {
        // 最后备选：使用现有图片（编辑时没有新上传或AI生成）
        console.log('No new image, using existing image...');
        tattooUrl = values.tattooUrl;
        console.log('Using existing image URL:', tattooUrl);
      }

      // 合并多语言字段
      const nameFields = mergeLanguageFields('name', formValues);
      const descriptionFields = mergeLanguageFields('description', formValues);
      const promptFields = mergeLanguageFields('prompt', formValues);
      const additionalInfoFields = mergeLanguageFields('additionalInfo', formValues);

      console.log('=== MULTILINGUAL FIELDS DEBUG ===');
      console.log('Original name:', values?.name);
      console.log('Merged name:', nameFields);
      console.log('Original description:', values?.description);
      console.log('Merged description:', descriptionFields);
      console.log('=== END MULTILINGUAL DEBUG ===');

      const params = {
        ...(values && { id: values.id }),
        name: nameFields as { en: string; zh: string },
        description: descriptionFields as { en: string; zh: string },
        prompt: promptFields as { en: string; zh: string },
        slug: formValues.slug,
        tattooUrl: tattooUrl,
        tagIds: formValues.tagIds || [],
        type: imageType,
        styleId: formValues.styleId !== undefined ? formValues.styleId : values?.styleId,
        categoryId: formValues.categoryId !== undefined ? formValues.categoryId : values?.categoryId,
        isColor: formValues.isColor !== undefined ? Boolean(formValues.isColor) : Boolean(values?.isColor ?? true),
        isPublic: formValues.isPublic !== undefined ? Boolean(formValues.isPublic) : Boolean(values?.isPublic ?? true),
        isOnline: formValues.isOnline !== undefined ? Boolean(formValues.isOnline) : Boolean(values?.isOnline ?? true),
        hotness: formValues.hotness !== undefined ? formValues.hotness : (values?.hotness || 0),
        additionalInfo: additionalInfoFields,
      };

      console.log('=== FORM VALUES DEBUG ===');
      console.log('formValues.isColor:', formValues.isColor, 'values.isColor:', values?.isColor);
      console.log('formValues.isPublic:', formValues.isPublic, 'values.isPublic:', values?.isPublic);
      console.log('formValues.isOnline:', formValues.isOnline, 'values.isOnline:', values?.isOnline);
      console.log('formValues.hotness:', formValues.hotness, 'values.hotness:', values?.hotness);
      console.log('formValues.styleId:', formValues.styleId, 'values.styleId:', values?.styleId);
      console.log('formValues.categoryId:', formValues.categoryId, 'values.categoryId:', values?.categoryId);
      console.log('formValues.tagIds:', formValues.tagIds, 'values.tags:', values?.tags);
      console.log('=== END FORM VALUES DEBUG ===');

      console.log('Final params to send:', params);
      console.log('Boolean fields in final params:');
      console.log('- isColor:', params.isColor, typeof params.isColor);
      console.log('- isPublic:', params.isPublic, typeof params.isPublic);
      console.log('- isOnline:', params.isOnline, typeof params.isOnline);
      console.log('Tags in final params:');
      console.log('- tagIds:', params.tagIds, Array.isArray(params.tagIds) ? `Array of ${params.tagIds.length} items` : typeof params.tagIds);
      console.log('=== END IMAGE PROCESSING DEBUG ===');

      // 根据模式调用不同的API
      if (values) {
        // 编辑模式
        await updateImage(params.id!, params);
        messageApi.success('更新图片成功');
      } else {
        // 新增模式
        delete params.id; // 删除id字段
        await addImage(params);
        messageApi.success('新增图片成功');
        formRef.current?.resetFields();
        resetAllStates();
      }

      onOk?.();
      return true;
    } catch (error) {
      messageApi.error(values ? '更新图片失败' : '新增图片失败');
      return false;
    }
  };

  // AI生成图片
  const handleAIGenerate = async () => {
    try {
      const formValues = formRef.current?.getFieldsValue();
      const englishPrompt = formValues?.prompt_en;

      if (!englishPrompt?.trim()) {
        messageApi.error('请先在基本信息中填写英文生成提示词');
        return;
      }

      setIsGenerating(true);
      setGenerationProgress(5);
      setGenerationStatus('正在启动生成任务...');

      // 获取选中的style信息
      const selectedStyle = styles.find(style => style.value === formValues.styleId);
      const styleName = selectedStyle?.title?.en || selectedStyle?.label || '';
      const styleDescription = selectedStyle?.prompt?.en || '';

      const generateRequest: GenerateTattooRequest = {
        prompt: englishPrompt,
        width: formValues.aiWidth || 1024,
        height: formValues.aiHeight || 1024,
        num_outputs: formValues.aiNumOutputs || 1,
        scheduler: formValues.aiScheduler || "K_EULER",
        guidance_scale: formValues.aiGuidanceScale || 7.5,
        num_inference_steps: formValues.aiInferenceSteps || 50,
        lora_scale: formValues.aiLoraScale || 0.6,
        refine: formValues.aiRefine || "expert_ensemble_refiner",
        high_noise_frac: formValues.aiHighNoiseFrac || 0.9,
        apply_watermark: formValues.aiApplyWatermark || false,
        isColor: Boolean(formValues.isColor),
        isPublic: Boolean(formValues.isPublic),
        negative_prompt: formValues.aiNegativePrompt,
        styleId: formValues.styleId,
        style: styleName,
        styleNote: styleDescription,
        categoryId: formValues.categoryId,
      };

      const response = await generateTattooAsync(generateRequest);

      if (response.status === 'success') {
        setGenerationStatus('生成任务已启动，正在处理...');

        // 开始轮询状态
        pollGenerationStatus(response.data.id);
      } else {
        throw new Error(response.message || '启动生成任务失败');
      }
    } catch (error: any) {
      messageApi.error(`AI生成失败: ${error.message}`);
      setIsGenerating(false);
      setGenerationProgress(0);
      setGenerationStatus('');
    }
  };

  // 轮询生成状态
  const pollGenerationStatus = async (id: string) => {
    const maxAttempts = 120;
    let attempts = 0;

    const poll = async () => {
      try {
        attempts++;
        const statusResponse = await getGenerationStatus(id);

        if (statusResponse.status === 'success') {
          const { status, progress, output } = statusResponse.data;

          setGenerationProgress(progress.percentage);
          setGenerationStatus(progress.message);

          if (status === 'succeeded' && output) {
            // 生成完成，完成任务
            await handleCompleteGeneration(id);
          } else if (status === 'failed') {
            throw new Error('图片生成失败');
          } else if (status === 'canceled') {
            throw new Error('图片生成被取消');
          } else if (attempts < maxAttempts) {
            // 继续轮询
            setTimeout(poll, 2000);
          } else {
            throw new Error('生成超时');
          }
        } else {
          throw new Error(statusResponse.message || '获取状态失败');
        }
      } catch (error: any) {
        messageApi.error(`获取生成状态失败: ${error.message}`);
        setIsGenerating(false);
        setGenerationProgress(0);
        setGenerationStatus('');
      }
    };

    poll();
  };

  // 完成生成任务
  const handleCompleteGeneration = async (id: string) => {
    try {
      const formValues = formRef.current?.getFieldsValue();

      const completeResponse = await completeGeneration({
        predictionId: id,
        categoryId: formValues.categoryId,
        styleId: formValues.styleId,
        prompt: formValues.aiPrompt,
      });

      if (completeResponse.status === 'success') {
        const newImageUrls = completeResponse.data.imageUrls || [];

        // 追加新生成的图片到现有列表
        setGeneratedImages(prevImages => [...prevImages, ...newImageUrls]);

        if (newImageUrls.length > 0) {
          // 默认选择新生成的第一张图片
          setSelectedGeneratedImage(newImageUrls[0]);
        }

        setGenerationProgress(100);
        setGenerationStatus('生成完成！');
        messageApi.success(`新增生成 ${newImageUrls.length} 张图片`);

        setTimeout(() => {
          setIsGenerating(false);
          setGenerationProgress(0);
          setGenerationStatus('');
        }, 2000);
      } else {
        throw new Error(completeResponse.message || '完成生成任务失败');
      }
    } catch (error: any) {
      messageApi.error(`完成生成失败: ${error.message}`);
      setIsGenerating(false);
      setGenerationProgress(0);
      setGenerationStatus('');
    }
  };

  // 选择生成的图片
  const handleSelectGeneratedImage = (imageUrl: string) => {
    setSelectedGeneratedImage(imageUrl);
    formRef.current?.setFieldValue('aiGeneratedImageUrl', imageUrl);
    messageApi.success('AI生成图片已选择');
  };

  // 准备初始值
  const getInitialValues = () => {
    const initialValues: Record<string, any> = {
      slug: values?.slug || '',
      tagIds: values?.tags ? values.tags.map((tag: any) => tag.id) : [],
      type: values?.type || 'manual', // 保持现有类型，提交时会自动重新检测
      styleId: values?.styleId || undefined,
      categoryId: values?.categoryId || undefined,
      isColor: values ? Boolean(values.isColor) : true, // 新增模式默认为true
      isPublic: values ? Boolean(values.isPublic) : true, // 新增模式默认为true
      isOnline: values ? Boolean(values.isOnline) : true, // 新增模式默认为true
      hotness: values?.hotness || 0,
      // 设置图片字段（根据类型分别设置不同字段）
      tattooUrl: (values?.type === 'manual') ? (values.tattooUrl || '') : '',  // 只有手动上传的图片才设置tattooUrl
      aiGeneratedImageUrl: (values?.type === 'text2image' || values?.type === 'image2image') ? (values.tattooUrl || '') : '',  // AI生成的图片
      // AI生成参数的默认值
      aiNegativePrompt: "ugly, broken, distorted, blurry, low quality, bad anatomy",
      aiWidth: 1024,
      aiHeight: 1024,
      aiNumOutputs: 1,
      aiScheduler: "K_EULER",
      aiGuidanceScale: 7.5,
      aiInferenceSteps: 50,
      aiLoraScale: 0.6,
      aiHighNoiseFrac: 0.9,
      aiRefine: "expert_ensemble_refiner",
      // additionalInfo 现在作为多语言字段处理，不需要在这里设置
    };

    // 为每种语言设置初始值
    activeLanguages.forEach(lang => {
      // 即使原始值为null或undefined，也要设置字段，避免表单验证失败
      initialValues[`name_${lang}`] = values?.name?.[lang as keyof typeof values.name] || '';
      initialValues[`description_${lang}`] = values?.description?.[lang as keyof typeof values.description] || '';
      initialValues[`prompt_${lang}`] = values?.prompt?.[lang as keyof typeof values.prompt] || '';
      initialValues[`additionalInfo_${lang}`] = values?.additionalInfo?.[lang as keyof typeof values.additionalInfo] || '';
    });

    console.log('getInitialValues result:', initialValues);
    return initialValues;
  };

  return (
    <ModalForm
      title={values ? "编辑图片" : "新增图片"}
      trigger={trigger}
      formRef={formRef}
      autoFocusFirstInput={false}
      modalProps={{
        destroyOnHidden: true,
        onCancel: () => {
          formRef.current?.resetFields();
          resetAllStates();
        },
        width: 1400,
      }}
      onOpenChange={(open) => {
        if (open) {
          // 每次打开表单时重置AI相关状态
          resetAllStates();
        }
      }}
      submitTimeout={2000}
      validateTrigger={false}
      validateMessages={{}}
      onFinish={handleSubmit}
      onFinishFailed={(errorInfo) => {
        console.log('Form submission failed:', errorInfo);
        // 即使表单验证失败，也要调用我们的自定义验证
        const formValues = formRef.current?.getFieldsValue();
        handleSubmit(formValues);
      }}
      initialValues={getInitialValues()}
    >
      {contextHolder}

      {/* 隐藏字段 */}
      <ProForm.Item name="type" style={{ display: 'none' }}>
        <input type="hidden" />
      </ProForm.Item>
      <ProForm.Item name="aiGeneratedImageUrl" style={{ display: 'none' }}>
        <input type="hidden" />
      </ProForm.Item>

      {/* 第一行：基本信息 + 分类状态信息 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Card title="基本信息" size="small" style={{ height: '100%' }}>
            <MultiLanguageForm
              fields={IMAGE_FIELDS}
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

            {/* Slug显示在名称下方 */}
            <div style={{ marginTop: 12 }}>
              <ProFormText
                name="slug"
                label="Slug"
                placeholder="将根据英文名称自动生成"
                disabled
                tooltip="URL友好的标识符，将根据英文图片名称自动生成"
              />
            </div>
          </Card>
        </Col>
        <Col span={12}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
            <Card title="分类设置" size="small">
              <ProFormSelect
                name="styleId"
                label="样式"
                options={styles}
                placeholder="请选择样式"
              />
              <ProFormSelect
                name="categoryId"
                label="分类"
                options={categories}
                placeholder="请选择分类"
              />
              <ProFormSelect
                name="tagIds"
                label="标签"
                mode="multiple"
                options={tags}
                placeholder="请选择标签（多选）"
                allowClear
              />
            </Card>
            <Card title="状态设置" size="small">
              <Row gutter={16}>
                <Col span={12}>
                  <ProFormSwitch name="isColor" label="彩色图片" initialValue={true} />
                  <ProFormSwitch name="isPublic" label="公开显示" initialValue={true} />
                </Col>
                <Col span={12}>
                  <ProFormSwitch name="isOnline" label="上线状态" initialValue={true} />
                  <ProFormDigit
                    name="hotness"
                    label="热度值"
                    min={0}
                    max={1000}
                    initialValue={0}
                    placeholder="请输入热度值（0-1000）"
                  />
                </Col>
              </Row>
            </Card>
          </div>
        </Col>
      </Row>

      {/* 图片操作区域 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card title="图片上传" size="small" style={{ height: '100%' }}>
            <ProForm.Item name="tattooUrl" label="图片文件">
              <ImageUpload
                placeholder="点击上传图片"
                slug={values?.slug || ""}
                nameEn={values?.name?.en || ""}
              />
            </ProForm.Item>
          </Card>
        </Col>
        <Col span={16}>
          <Card title="AI生成（优先级高于手动上传）" size="small" style={{ height: '100%' }}>

        <Collapse
          size="small"
          items={[
            {
              key: 'ai-params',
              label: 'AI生成参数',
              children: (
                <>
                  <Row gutter={16} style={{ marginBottom: 16 }}>
                    <Col span={24}>
                      <ProFormTextArea
                        name="aiNegativePrompt"
                        label="反向提示词"
                        initialValue="ugly, broken, distorted, blurry, low quality, bad anatomy"
                        placeholder="描述您不希望出现在图片中的元素"
                        fieldProps={{ rows: 2 }}
                      />
                    </Col>
                  </Row>

                  <Row gutter={16} style={{ marginBottom: 16 }}>
                    <Col span={8}>
                      <ProFormDigit
                        name="aiWidth"
                        label="宽度"
                        initialValue={1024}
                        min={256}
                        max={2048}
                        fieldProps={{ step: 64 }}
                      />
                    </Col>
                    <Col span={8}>
                      <ProFormDigit
                        name="aiHeight"
                        label="高度"
                        initialValue={1024}
                        min={256}
                        max={2048}
                        fieldProps={{ step: 64 }}
                      />
                    </Col>
                    <Col span={8}>
                      <ProFormDigit
                        name="aiNumOutputs"
                        label="生成数量"
                        initialValue={1}
                        min={1}
                        max={4}
                      />
                    </Col>
                  </Row>

                  <Row gutter={16} style={{ marginBottom: 16 }}>
                    <Col span={8}>
                      <ProFormSelect
                        name="aiScheduler"
                        label="调度器"
                        initialValue="K_EULER"
                        options={[
                          { label: 'K_EULER', value: 'K_EULER' },
                          { label: 'K_EULER_ANCESTRAL', value: 'K_EULER_ANCESTRAL' },
                          { label: 'DDIM', value: 'DDIM' },
                          { label: 'DPMSolverMultistep', value: 'DPMSolverMultistep' },
                        ]}
                      />
                    </Col>
                    <Col span={8}>
                      <ProFormDigit
                        name="aiGuidanceScale"
                        label="引导强度"
                        initialValue={7.5}
                        min={1}
                        max={20}
                        fieldProps={{ step: 0.5 }}
                      />
                    </Col>
                    <Col span={8}>
                      <ProFormDigit
                        name="aiInferenceSteps"
                        label="推理步数"
                        initialValue={50}
                        min={1}
                        max={100}
                      />
                    </Col>
                  </Row>

                  <Row gutter={16} style={{ marginBottom: 16 }}>
                    <Col span={8}>
                      <ProFormDigit
                        name="aiLoraScale"
                        label="LoRA强度"
                        initialValue={0.6}
                        min={0}
                        max={1}
                        fieldProps={{ step: 0.1 }}
                      />
                    </Col>
                    <Col span={8}>
                      <ProFormDigit
                        name="aiHighNoiseFrac"
                        label="高噪声比例"
                        initialValue={0.9}
                        min={0}
                        max={1}
                        fieldProps={{ step: 0.1 }}
                      />
                    </Col>
                    <Col span={8}>
                      <ProFormSelect
                        name="aiRefine"
                        label="精化方式"
                        initialValue="expert_ensemble_refiner"
                        options={[
                          { label: '专家集成', value: 'expert_ensemble_refiner' },
                          { label: '基础精化', value: 'base_image_refiner' },
                        ]}
                      />
                    </Col>
                  </Row>

                  {/* API参数参考链接 */}
                  <div style={{ textAlign: 'center', padding: '8px 0' }}>
                    <Button
                      type="link"
                      icon={<LinkOutlined />}
                      onClick={() => window.open('https://replicate.com/fofr/sdxl-fresh-ink', '_blank')}
                      style={{ fontSize: 14 }}
                    >
                      打开API参数参考文档
                    </Button>
                    <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                      查看详细的AI模型参数说明和示例
                    </div>
                  </div>
                </>
              ),
            },
          ]}
        />

        {/* AI生成操作 */}
        <div style={{ marginTop: 16 }}>
          <Button
            type="primary"
            onClick={handleAIGenerate}
            loading={isGenerating}
            disabled={isGenerating}
            style={{ marginRight: 8 }}
          >
            {isGenerating ? '生成中...' : 'AI生成图片'}
          </Button>

          {!isGenerating && generatedImages.length > 0 && (
            <Button
              onClick={() => {
                setGeneratedImages([]);
                setSelectedGeneratedImage('');
                formRef.current?.setFieldValue('aiGeneratedImageUrl', '');
                messageApi.success('已清空所有生成的图片');
              }}
              style={{ marginRight: 8 }}
            >
              清空图片
            </Button>
          )}

          {isGenerating && (
            <Button
              onClick={() => {
                setIsGenerating(false);
                setGenerationProgress(0);
                setGenerationStatus('');
              }}
            >
              取消生成
            </Button>
          )}
        </div>

        {/* 生成进度 */}
        {isGenerating && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 500, marginBottom: 8 }}>生成进度</div>
            <Progress percent={generationProgress} status="active" />
            <div style={{ marginTop: 8, color: '#666' }}>{generationStatus}</div>
          </div>
        )}

        {/* 生成结果 */}
        {generatedImages.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
              fontWeight: 500
            }}>
              <span>生成结果 ({generatedImages.length} 张图片)</span>
              <span style={{ fontSize: 12, fontWeight: 'normal', color: '#666' }}>
                {selectedGeneratedImage ? '已选择 1 张' : '请选择一张图片'}
              </span>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 16,
              maxHeight: '400px',
              overflowY: 'auto',
              padding: '4px'
            }}>
              {generatedImages.map((imageUrl, index) => (
                <div
                  key={`${imageUrl}-${index}`}
                  style={{
                    border: selectedGeneratedImage === imageUrl ? '3px solid #1890ff' : '2px solid #d9d9d9',
                    borderRadius: 12,
                    padding: 8,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    backgroundColor: selectedGeneratedImage === imageUrl ? '#f0f9ff' : '#fff',
                    boxShadow: selectedGeneratedImage === imageUrl ? '0 2px 8px rgba(24, 144, 255, 0.2)' : '0 2px 4px rgba(0,0,0,0.1)',
                    transform: selectedGeneratedImage === imageUrl ? 'scale(1.02)' : 'scale(1)',
                  }}
                  onClick={() => handleSelectGeneratedImage(imageUrl)}
                >
                  <Image
                    src={generateMinIOUrl(imageUrl)}
                    alt={`AI生成图片 ${index + 1}`}
                    style={{ width: '100%', borderRadius: 8 }}
                    preview={{ mask: '预览大图' }}
                    onError={(e) => {
                      console.error('AI generated image load error:', imageUrl, 'processed URL:', generateMinIOUrl(imageUrl), e);
                    }}
                    onLoad={() => {
                      console.log('AI generated image loaded successfully:', imageUrl, 'processed URL:', generateMinIOUrl(imageUrl));
                    }}
                  />
                  <div style={{
                    textAlign: 'center',
                    marginTop: 8,
                    fontSize: 12,
                    fontWeight: selectedGeneratedImage === imageUrl ? 'bold' : 'normal'
                  }}>
                    <div style={{ color: '#666', marginBottom: 2 }}>
                      图片 #{index + 1}
                    </div>
                    {selectedGeneratedImage === imageUrl ? (
                      <div style={{
                        color: '#1890ff',
                        backgroundColor: '#e6f7ff',
                        padding: '2px 8px',
                        borderRadius: 12,
                        display: 'inline-block'
                      }}>
                        ✓ 已选择
                      </div>
                    ) : (
                      <div style={{ color: '#999' }}>
                        点击选择
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
          </Card>
        </Col>
      </Row>


    </ModalForm>
  );
};

export default UpdateForm;