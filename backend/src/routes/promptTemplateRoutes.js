const express = require('express');
const { createModels } = require('../models');
const PromptTemplateService = require('../services/PromptTemplateService');
const ImageGenerateService = require('../services/ImageGenerateService');
const { createBaseRoutes } = require('./baseRoutes');

const router = express.Router();

// 创建提示词模板路由
function createPromptTemplateRoutes(app) {
    const db = app.locals.db;
    const models = createModels(db);

    const promptTemplateService = new PromptTemplateService(models.PromptTemplate);

    // 创建图像生成服务实例（用于翻译功能）
    const imageGenerateService = new ImageGenerateService(models.Image, models.User);

    // 初始化表和默认模板
    (async () => {
        try {
            await promptTemplateService.initializeDefaultTemplate();
        } catch (error) {
            console.error('Failed to initialize prompt templates:', error.message);
        }
    })();

    // 使用基础CRUD路由
    const baseRoutes = createBaseRoutes(promptTemplateService, 'PromptTemplate');
    router.use('/', baseRoutes);

    // 获取默认模板
    router.get('/default', async (req, res) => {
        try {
            const result = await promptTemplateService.getDefault();
            res.json(result);
        } catch (error) {
            console.error('Get default template error:', error);
            res.status(500).json(promptTemplateService.formatResponse(false, null, error.message));
        }
    });

    // 设置默认模板
    router.put('/:id/set-default', async (req, res) => {
        try {
            const { id } = req.params;
            const result = await promptTemplateService.setDefault(id);
            res.json(result);
        } catch (error) {
            console.error('Set default template error:', error);
            res.status(500).json(promptTemplateService.formatResponse(false, null, error.message));
        }
    });


    // 测试模板
    router.post('/test', async (req, res) => {
        try {
            const { templateId, prompt, style, isColor, styleNote } = req.body;

            if (!templateId) {
                return res.status(400).json(promptTemplateService.formatResponse(false, null, 'Template ID is required'));
            }

            if (!prompt || prompt.trim() === '') {
                return res.status(400).json(promptTemplateService.formatResponse(false, null, 'Prompt is required'));
            }

            const result = await promptTemplateService.testTemplate(templateId, {
                prompt,
                style: style || '',
                isColor: isColor || false,
                styleNote: styleNote || ''
            }, imageGenerateService); // 传递imageGenerateService以支持翻译

            res.json(result);
        } catch (error) {
            console.error('Test template error:', error);
            res.status(500).json(promptTemplateService.formatResponse(false, null, error.message));
        }
    });


    return router;
}

// 导出路由工厂函数
module.exports = (app) => {
    return createPromptTemplateRoutes(app);
};