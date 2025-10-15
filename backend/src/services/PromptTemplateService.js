const BaseService = require('./BaseService');

class PromptTemplateService extends BaseService {
    constructor(promptTemplateModel) {
        super(promptTemplateModel, 'PromptTemplate');
        this.promptTemplateModel = promptTemplateModel;
    }

    // 创建模板时的额外验证
    async create(data) {
        // 验证必需字段
        this.validateTemplateData(data);

        // 如果设置为默认模板，检查是否已有默认模板
        if (data.isDefault) {
            const existing = await this.promptTemplateModel.getDefault();
            if (existing) {
                console.log('Setting new default template, removing default from existing template');
            }
        }

        return await super.create(data);
    }

    // 更新模板
    async update(id, data) {
        // 验证模板数据（如果有的话）
        if (data.hasOwnProperty('prompt') || data.hasOwnProperty('name')) {
            this.validateTemplateData(data, true);
        }

        return await super.update(id, data);
    }

    // 设置默认模板
    async setDefault(id) {
        try {
            const result = await this.promptTemplateModel.setAsDefault(id);
            if (!result) {
                throw new Error('Template not found or failed to set as default');
            }
            return this.formatResponse(true, { id }, 'Template set as default successfully');
        } catch (error) {
            throw new Error(`Set default template failed: ${error.message}`);
        }
    }

    // 获取默认模板
    async getDefault() {
        try {
            const template = await this.promptTemplateModel.getDefault();
            return this.formatResponse(true, template, template ? 'Default template found' : 'No default template found');
        } catch (error) {
            throw new Error(`Get default template failed: ${error.message}`);
        }
    }


    // 测试模板生成提示词
    async testTemplate(templateId, params, imageGenerateService = null) {
        try {
            const { prompt, style, isColor, styleNote } = params;

            if (!prompt || prompt.trim() === '') {
                throw new Error('Prompt is required for testing');
            }

            const enhancedPrompt = await this.promptTemplateModel.generatePrompt(templateId, {
                prompt,
                style: style || '',
                isColor: isColor || false,
                styleNote: styleNote || ''
            }, imageGenerateService); // 传递imageGenerateService以支持翻译

            return this.formatResponse(true, { enhancedPrompt }, 'Template test completed successfully');
        } catch (error) {
            throw new Error(`Test template failed: ${error.message}`);
        }
    }

    // 验证模板数据
    validateTemplateData(data, isUpdate = false) {
        const requiredFields = ['prompt'];

        if (!isUpdate) {
            requiredFields.push('name');
        }

        const missingFields = requiredFields.filter(field => {
            if (isUpdate) {
                return data.hasOwnProperty(field) && (!data[field] || data[field].toString().trim() === '');
            }
            return !data[field] || data[field].toString().trim() === '';
        });

        if (missingFields.length > 0) {
            throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
        }

        // 验证模板名称长度
        if (data.name && data.name.length > 255) {
            throw new Error('Template name cannot exceed 255 characters');
        }

        // 验证模板内容长度
        if (data.prompt && data.prompt.length > 65535) {
            throw new Error('Prompt template content is too long (max 65535 characters)');
        }
    }

    // 初始化默认模板
    async initializeDefaultTemplate() {
        try {
            await this.promptTemplateModel.createTable();
            await this.promptTemplateModel.initializeDefaultTemplate();
            console.log('PromptTemplateService: Default template initialized');
        } catch (error) {
            console.error('PromptTemplateService: Failed to initialize default template:', error.message);
            throw error;
        }
    }

}

module.exports = PromptTemplateService;