import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Switch,
  Button,
  Space,
  Typography,
  Alert,
  Divider,
  Card,
  Row,
  Col,
  Tooltip,
  message,
  Select,
  Image,
  Progress
} from 'antd';
import {
  SaveOutlined,
  EyeOutlined,
  InfoCircleOutlined,
  CopyOutlined,
  PictureOutlined
} from '@ant-design/icons';
import { useRequest } from '@umijs/max';
import { testPromptTemplate } from '@/services/prompt-templates';
import type { PromptTemplate } from '@/services/prompt-templates';
import { queryStyles } from '@/services/styles';
import type { StyleItem } from '@/pages/styles';
import { generateTattooByPrompt, getGenerationStatus } from '@/services/images';

const { TextArea } = Input;
const { Text, Title } = Typography;

interface TemplateEditorProps {
  visible: boolean;
  onCancel: () => void;
  onSave: (template: Partial<PromptTemplate>) => Promise<void>;
  initialValues?: PromptTemplate | null;
  isEdit?: boolean;
}

// 默认纹身模板数据 - 基于原始 enhancePrompt 逻辑
const defaultTemplate: Partial<PromptTemplate> = {
  name: '',
  // 完全基于原始 enhancePrompt 逻辑的模板
  prompt: `Create a {{styleText}} tattoo design based on: "{{prompt}}"

Style specifications:
{{#if hasStyle}}
- Art style: {{style}}
{{else}}
- Art style: Professional tattoo design
{{/if}}
{{#if isColor}}
- IMPORTANT: Full color tattoo with BRIGHT, VIBRANT, SATURATED colors
- Rich color palette with strong saturation and contrast
- Colorful design with multiple distinct colors
- Vivid and eye-catching color scheme
- NEVER use black and grey only - must include bright colors
{{else}}
- IMPORTANT: Black and grey monochrome tattoo ONLY
- Use only black ink with grey shading and highlights
- NO color whatsoever - pure black and grey design
- Focus on detailed shading, gradients, and contrast
- Traditional black and grey tattoo style
{{/if}}
- Format: Clean tattoo design suitable for transfer to skin
- Composition: Well-balanced and proportioned for tattoo application

Technical requirements:
- High contrast and clear line definition
- Appropriate level of detail for tattoo medium
- Consider how the design will age over time
- Ensure all elements are tattoo-appropriate
{{#if isColor}}
- Emphasize the vibrant colors throughout the entire design
{{else}}
- Focus on rich black and grey tonal variations
{{/if}}

The design should be professional quality, original, and ready for use as a tattoo reference. Focus on creating bold, clean artwork that will translate well from digital design to actual skin application.
{{#if hasStyle}}
Additional style notes: {{styleNote}}
{{/if}}`
};

const TemplateEditor: React.FC<TemplateEditorProps> = ({
  visible,
  onCancel,
  onSave,
  initialValues,
  isEdit = false
}) => {
  const [form] = Form.useForm();
  const [previewPrompt, setPreviewPrompt] = useState<string>('');
  const [styles, setStyles] = useState<StyleItem[]>([]);
  const [testValues, setTestValues] = useState({
    prompt: 'A flying bird',
    style: '',
    isColor: true,
  });

  // AI生成相关状态
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStatus, setGenerationStatus] = useState('');
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [selectedGeneratedImage, setSelectedGeneratedImage] = useState<string>('');

  // 获取纹身风格数据
  const { run: fetchStyles } = useRequest(queryStyles, {
    manual: true,
    onSuccess: (response) => {
      setStyles(response);
    },
    onError: (error) => {
      console.error('获取风格数据失败:', error);
    }
  });

  // 测试模板
  const { run: runTest, loading: testing } = useRequest(testPromptTemplate, {
    manual: true,
    onSuccess: (response: any) => {
      if (response.status === 'success' && response.data?.enhancedPrompt) {
        setPreviewPrompt(response.data.enhancedPrompt);
      }
    },
    onError: (error) => {
      message.error(`测试失败: ${error.message}`);
    }
  });

  // 模板解析引擎（与后端保持一致）
  const parseTemplate = (templateContent: string, variables: any) => {
    let result = templateContent;

    // 处理条件语句 {{#if condition}} ... {{else}} ... {{/if}}
    result = result.replace(/{{#if\s+(\w+)}}\s*([\s\S]*?)\s*(?:{{else}}\s*([\s\S]*?)\s*)?{{\/if}}/g, (match, condition, ifContent, elseContent = '') => {
      const value = variables[condition];
      const isTrue = value && value !== '' && value !== 'false' && value !== '0';
      return isTrue ? ifContent.trim() : elseContent.trim();
    });

    // 处理循环语句 {{#each array}} ... {{/each}}
    result = result.replace(/{{#each\s+(\w+)}}\s*([\s\S]*?)\s*{{\/each}}/g, (match, arrayName, content) => {
      const array = variables[arrayName];
      if (!Array.isArray(array)) return '';
      return array.map((item: any) => {
        let itemContent = content;
        if (typeof item === 'object') {
          Object.keys(item).forEach(key => {
            itemContent = itemContent.replace(new RegExp(`{{${key}}}`, 'g'), item[key] || '');
          });
        } else {
          itemContent = itemContent.replace(/{{this}}/g, item);
        }
        return itemContent;
      }).join('\n');
    });

    // 处理简单变量替换 {{variable}}
    result = result.replace(/{{(\w+)}}/g, (match, varName) => {
      return variables[varName] || '';
    });

    // 处理旧的变量语法兼容 {variable}
    result = result.replace(/{(\w+)}/g, (match, varName) => {
      return variables[varName] || '';
    });

    return result.trim();
  };

  // 生成完整提示词的通用函数
  const generateFullPrompt = () => {
    const templateData = form.getFieldsValue();
    const { prompt, style, isColor } = testValues;

    // 从选中的样式中获取 styleNote
    const selectedStyle = styles.find(s => (s.title?.en || s.title?.zh) === style);
    const styleNote = selectedStyle?.prompt?.en || '';

    // 构建模板变量对象（与后端保持一致）
    const hasStyle = style && style.trim() !== '';

    const templateVariables = {
      // 基础变量
      prompt: prompt,
      style: style || '',
      styleNote: styleNote || '',
      isColor: isColor,
      isMonochrome: !isColor,

      // 派生变量（完全按照原始 enhancePrompt 逻辑）
      hasStyle: hasStyle,
      styleText: hasStyle ? `${style} style` : 'professional tattoo',
      styleNotesSection: hasStyle ? `\nAdditional style notes:\n${styleNote}` : ''
    };

    // 使用模板解析引擎
    return parseTemplate(templateData.prompt || '', templateVariables);
  };

  // 预览模板效果
  const handlePreview = async () => {
    try {
      const preview = generateFullPrompt();
      setPreviewPrompt(preview);
    } catch (error) {
      message.error('预览失败');
      console.error(error);
    }
  };


  // 保存模板
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      await onSave(values);
      message.success(isEdit ? '模板更新成功' : '模板创建成功');
      onCancel();
    } catch (error) {
      // 表单验证失败或保存失败
    }
  };

  // 复制到剪贴板
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      message.success('已复制到剪贴板');
    } catch (error) {
      message.error('复制失败');
    }
  };

  // 轮询生成状态
  const pollGenerationStatus = (predictionId: string) => {
    const intervalId = setInterval(async () => {
      try {
        const response = await getGenerationStatus(predictionId);
        if (response.status === 'success') {
          const data = response.data;

          if (data.status === 'succeeded') {
            setGenerationProgress(100);
            setGenerationStatus('生成完成');
            setIsGenerating(false);

            if (data.output && Array.isArray(data.output)) {
              setGeneratedImages(data.output);
              message.success(`成功生成 ${data.output.length} 张图片`);
            }
            clearInterval(intervalId);
          } else if (data.status === 'failed') {
            setGenerationStatus('生成失败');
            setIsGenerating(false);
            message.error('图片生成失败，请重试');
            clearInterval(intervalId);
          } else if (data.status === 'processing') {
            const progress = Math.min(generationProgress + 10, 90);
            setGenerationProgress(progress);
            setGenerationStatus('正在生成图片...');
          }
        }
      } catch (error) {
        console.error('Poll generation status error:', error);
        setGenerationStatus('获取生成状态失败');
        setIsGenerating(false);
        clearInterval(intervalId);
        message.error('获取生成状态失败');
      }
    }, 2000);

    // 30秒后强制停止轮询
    setTimeout(() => {
      clearInterval(intervalId);
      if (isGenerating) {
        setIsGenerating(false);
        setGenerationStatus('生成超时，请重试');
        message.error('生成超时，请重试');
      }
    }, 30000);
  };

  // AI生成图片
  const handleAIGenerate = async () => {
    try {
      const templateData = form.getFieldsValue();
      const { prompt } = testValues;

      // 验证必需参数
      if (!templateData.prompt?.trim()) {
        message.error('请先填写模板内容');
        return;
      }

      if (!prompt?.trim()) {
        message.error('请填写纹身描述');
        return;
      }

      // 使用共用函数生成完整提示词
      const fullPrompt = generateFullPrompt();

      if (!fullPrompt?.trim()) {
        message.error('生成的提示词为空，请检查模板内容');
        return;
      }

      setIsGenerating(true);
      setGenerationProgress(0);
      setGenerationStatus('正在启动生成任务...');
      setGeneratedImages([]);
      setSelectedGeneratedImage('');

      const generateRequest = {
        prompt: fullPrompt,
        width: 1024,
        height: 1024,
        num_outputs: 1,
        scheduler: "K_EULER",
        guidance_scale: 7.5,
        num_inference_steps: 50,
        lora_scale: 0.6,
        refine: "expert_ensemble_refiner",
        high_noise_frac: 0.9,
        apply_watermark: false,
        negative_prompt: '',
      };

      const response = await generateTattooByPrompt(generateRequest);

      if (response.status === 'success') {
        setGenerationStatus('生成任务已启动，正在处理...');
        setGenerationProgress(10);
        // 开始轮询状态
        pollGenerationStatus(response.data.id);
      } else {
        throw new Error(response.message || '启动生成任务失败');
      }
    } catch (error: any) {
      setIsGenerating(false);
      setGenerationProgress(0);
      setGenerationStatus('');
      message.error(`生成失败: ${error.message}`);
      console.error('AI generate error:', error);
    }
  };

  useEffect(() => {
    if (visible) {
      if (initialValues) {
        form.setFieldsValue(initialValues);
      } else {
        form.setFieldsValue(defaultTemplate);
      }
      setPreviewPrompt('');
      // 获取风格数据
      fetchStyles({});
    }
  }, [visible, initialValues, form, fetchStyles]);

  return (
    <Modal
      title={
        <Space>
          {isEdit ? '编辑提示词模板' : '创建提示词模板'}
          <Tooltip title="提示词模板用于定义纹身生成的提示词结构和内容">
            <InfoCircleOutlined />
          </Tooltip>
        </Space>
      }
      open={visible}
      onCancel={onCancel}
      width={1600}
      style={{ top: 20 }}
      footer={
        <Space>
          <Button onClick={onCancel}>取消</Button>
          <Button type="primary" onClick={handleSave}>
            <SaveOutlined />
            {isEdit ? '保存更改' : '创建模板'}
          </Button>
        </Space>
      }
      destroyOnClose
    >
      <Row gutter={24}>
        {/* 左侧编辑器 */}
        <Col span={12}>
          <Form
            form={form}
            layout="vertical"
            initialValues={defaultTemplate}
          >
            <Card title="基本信息" size="small" style={{ marginBottom: 16 }}>
              <Form.Item
                name="name"
                label="模板名称"
                rules={[{ required: true, message: '请输入模板名称' }]}
              >
                <Input placeholder="输入模板名称，如：日式纹身模板" />
              </Form.Item>
            </Card>

            <Card title="模板内容" size="small">
              <Alert
                message="智能模板语法说明"
                description={
                  <div>
                    <p><strong>基础变量（使用双花括号）：</strong></p>
                    <ul style={{ marginBottom: 12 }}>
                      <li><Text code>{'{{prompt}}'}</Text> - 纹身描述</li>
                      <li><Text code>{'{{hasStyle}}'}</Text> - 是否有样式 (true/false)</li>
                      <li><Text code>{'{{style}}'}</Text> - 选择的样式的英文名称</li>
                      <li><Text code>{'{{styleNote}}'}</Text> - 样式的英文提示词</li>
                      <li><Text code>{'{{isColor}}'}</Text> - 是否彩色 (true/false)</li>
                    </ul>
                    <p><strong>条件语句：</strong></p>
                    <div style={{ marginBottom: 12, fontFamily: 'monospace', fontSize: 12, backgroundColor: '#f5f5f5', padding: 8, borderRadius: 4 }}>
                      {'{{#if hasStyle}}'}<br/>
                      &nbsp;&nbsp;有风格时显示的内容<br/>
                      {'{{else}}'}<br/>
                      &nbsp;&nbsp;没有风格时显示的内容<br/>
                      {'{{/if}}'}
                    </div>
                  </div>
                }
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />

              <Form.Item
                name="prompt"
                label={
                  <Space>
                    提示模板内容
                    <Tooltip title="请编写完整的模板内容，包含所有需要的部分和变量">
                      <InfoCircleOutlined />
                    </Tooltip>
                  </Space>
                }
                rules={[{ required: true, message: '请输入模板内容' }]}
              >
                <TextArea
                  rows={20}
                  placeholder="请输入模板内容，可以包含所有变量和固定文本..."
                  style={{ fontFamily: 'monospace' }}
                />
              </Form.Item>
            </Card>
          </Form>
        </Col>

        {/* 右侧预览 */}
        <Col span={12}>
          <Card title="测试参数" size="small" style={{ marginBottom: 16 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text strong>纹身描述（需要是英文）：</Text>
                <TextArea
                  value={testValues.prompt}
                  onChange={(e) => setTestValues(prev => ({ ...prev, prompt: e.target.value }))}
                  placeholder="输入纹身描述"
                  rows={3}
                />
              </div>
              <div>
                <Text strong>样式：</Text>
                <Select
                  value={testValues.style}
                  onChange={(value) => setTestValues(prev => ({ ...prev, style: value }))}
                  placeholder="选择样式"
                  style={{ width: '100%' }}
                  showSearch
                  optionFilterProp="children"
                  allowClear
                >
                  {styles.map((style) => (
                    <Select.Option key={style.id} value={style.title?.en || style.title?.zh || ''}>
                      {style.title?.zh || style.title?.en || '未命名'}
                    </Select.Option>
                  ))}
                </Select>
              </div>
              <div>
                <Text strong>彩色图片：</Text>
                <Switch
                  checked={testValues.isColor}
                  onChange={(checked) => setTestValues(prev => ({ ...prev, isColor: checked }))}
                />
              </div>
            </Space>
          </Card>

          <Card
            title="完整提示词"
            size="small"
            extra={
              <Button
                type="primary"
                icon={<EyeOutlined />}
                onClick={handlePreview}
                loading={testing}
              >
                预览完整提示词
              </Button>
            }
          >
            {previewPrompt ? (
              <div>
                <Space style={{ marginBottom: 8 }}>
                  <Text strong>生成的提示词：</Text>
                  <Button
                    type="link"
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={() => copyToClipboard(previewPrompt)}
                  >
                    复制
                  </Button>
                </Space>
                <div
                  style={{
                    whiteSpace: 'pre-wrap',
                    fontSize: 12,
                    maxHeight: 400,
                    overflow: 'auto',
                    padding: 12,
                    backgroundColor: '#fafafa',
                    border: '1px solid #d9d9d9',
                    borderRadius: 4,
                    fontFamily: 'monospace'
                  }}
                >
                  {previewPrompt}
                </div>
              </div>
            ) : (
              <div style={{
                textAlign: 'center',
                color: '#999',
                padding: '60px 20px',
                border: '1px dashed #d9d9d9',
                borderRadius: 4
              }}>
                <EyeOutlined style={{ fontSize: 24, marginBottom: 8 }} />
                <div>设置测试参数后点击"预览效果"查看结果</div>
              </div>
            )}
          </Card>

          {/* AI生成操作 */}
          <Card title="AI生成图片" size="small" style={{ marginTop: 16 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button
                type="primary"
                onClick={handleAIGenerate}
                loading={isGenerating}
                disabled={isGenerating}
                block
                icon={<PictureOutlined />}
              >
                {isGenerating ? '生成中...' : 'AI生成图片'}
              </Button>

              {!isGenerating && generatedImages.length > 0 && (
                <Button
                  onClick={() => {
                    setGeneratedImages([]);
                    setSelectedGeneratedImage('');
                    message.success('已清空所有生成的图片');
                  }}
                  block
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
                  block
                >
                  取消生成
                </Button>
              )}

              {/* 生成进度 */}
              {isGenerating && (
                <div style={{ marginTop: 16 }}>
                  <Progress percent={generationProgress} />
                  <div style={{ marginTop: 8, color: '#666' }}>{generationStatus}</div>
                </div>
              )}
            </Space>
          </Card>

          {/* 生成结果 */}
          {generatedImages.length > 0 && (
            <Card title="生成结果" size="small" style={{ marginTop: 16 }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 12,
                fontWeight: 500
              }}>
                <span>AI生成图片 ({generatedImages.length} 张)</span>
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
                    }}
                    onClick={() => {
                      setSelectedGeneratedImage(imageUrl === selectedGeneratedImage ? '' : imageUrl);
                    }}
                  >
                    <Image
                      src={imageUrl}
                      alt={`Generated ${index + 1}`}
                      style={{
                        width: '100%',
                        height: 180,
                        objectFit: 'cover',
                        borderRadius: 8,
                      }}
                      preview={{
                        mask: '预览'
                      }}
                    />
                    <div style={{
                      textAlign: 'center',
                      marginTop: 8,
                      fontSize: 12,
                      color: selectedGeneratedImage === imageUrl ? '#1890ff' : '#666',
                      fontWeight: selectedGeneratedImage === imageUrl ? 'bold' : 'normal'
                    }}>
                      图片 {index + 1}
                      {selectedGeneratedImage === imageUrl && ' ✓'}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </Col>
      </Row>
    </Modal>
  );
};

export default TemplateEditor;