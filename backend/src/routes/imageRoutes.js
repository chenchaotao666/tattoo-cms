const express = require('express');
const { createModels } = require('../models');
const BaseService = require('../services/BaseService');
const ImageService = require('../services/ImageService');
const ImageGenerateService = require('../services/ImageGenerateService');
const { createBaseRoutes, validateBody, validateUUID } = require('./baseRoutes');
const { optionalAuth, authenticateToken } = require('../middleware/auth');

const router = express.Router();


// 创建图片路由
function createImageRoutes(app) {
    const db = app.locals.db;
    const models = createModels(db);
    const imageGenerateService = new ImageGenerateService(models.Image, models.User);

    // 使用ImageGenerateService的MinIO客户端初始化ImageService
    const imageService = new ImageService(models.Image, imageGenerateService.minioClient);

    // 先定义具体的路由，再定义通用路由，避免路径冲突

    // GET /api/images/generated - 获取当前用户生成的图片
    router.get('/generated', authenticateToken, async (req, res) => {
        try {
            const userId = req.userId; // 从认证中间件获取用户ID
            const result = await imageService.getUserGeneratedImages(userId, req.query);
            res.json(result);
        } catch (error) {
            console.error('Get user generated images error:', error);
            res.status(500).json(imageService.formatResponse(false, null, error.message));
        }
    });

    // POST /api/images/generate-tattoo/async - 异步生成纹身图片（立即返回任务ID）
    router.post('/generate-tattoo/async', optionalAuth, validateBody(['prompt']), async (req, res) => {
        try {
            const {
                prompt,
                width = 1024,
                height = 1024,
                num_outputs = 1,
                scheduler = "K_EULER",
                guidance_scale = 7.5,
                num_inference_steps = 50,
                lora_scale = 0.6,
                refine = "expert_ensemble_refiner",
                high_noise_frac = 0.9,
                apply_watermark = false,
                styleId = null,
                style = '',
                styleNote = '',
                isColor = true,
                isPublic = false,
                negative_prompt = '',
                seed,
                categoryId = null,
            } = req.body;

            // 构建参数对象
            const params = {
                prompt,
                width: parseInt(width),
                height: parseInt(height),
                num_outputs: parseInt(num_outputs),
                scheduler,
                guidance_scale: parseFloat(guidance_scale),
                num_inference_steps: parseInt(num_inference_steps),
                lora_scale: parseFloat(lora_scale),
                refine,
                high_noise_frac: parseFloat(high_noise_frac),
                apply_watermark: Boolean(apply_watermark),
                styleId: styleId,
                style: style,
                styleNote: styleNote,
                isColor: Boolean(isColor),
                isPublic: Boolean(isPublic),
                negative_prompt: negative_prompt,
                // 添加用户信息和其他元数据
                userId: req.userId || null,
                categoryId: categoryId,
            };

            // 如果提供了种子，添加到参数中
            if (seed !== undefined) {
                params.seed = parseInt(seed);
            }

            // 启动异步生成任务
            const result = await imageGenerateService.generateTattooAsync(params);
            res.json(result);
        } catch (error) {
            console.error('Generate tattoo async error:', error);
            res.status(500).json(imageGenerateService.formatResponse(false, null, error.message));
        }
    });

    // POST /api/images/generate-tattoo/complete - 完成异步生成任务
    router.post('/generate-tattoo/complete', optionalAuth, validateBody(['predictionId']), async (req, res) => {
        try {
            const { predictionId, originalParams = {} } = req.body;
            
            // 合并参数
            const params = {
                userId: req.userId || null,
                categoryId: originalParams.categoryId || req.body.categoryId || null,
                styleId: originalParams.styleId || req.body.styleId || null,
                prompt: originalParams.prompt || req.body.prompt || 'Generated tattoo',
                ...originalParams
            };

            const result = await imageGenerateService.completeGeneration(predictionId, params);
            res.json(result);
        } catch (error) {
            console.error('Complete generation error:', error);
            res.status(500).json(imageGenerateService.formatResponse(false, null, error.message));
        }
    });

    // GET /api/images/generate-tattoo/status/:predictionId - 获取生成状态
    router.get('/generate-tattoo/status/:predictionId', async (req, res) => {
        try {
            const { predictionId } = req.params;
            const result = await imageGenerateService.getGenerationStatus(predictionId);
            res.json(result);
        } catch (error) {
            console.error('Get generation status error:', error);
            res.status(500).json(imageGenerateService.formatResponse(false, null, error.message));
        }
    });

    // POST /api/images/generate-prompt - 使用完整prompt生成纹身图片（不保存到MinIO）
    router.post('/generate-prompt', optionalAuth, validateBody(['prompt']), async (req, res) => {
        try {
            const {
                prompt,
                width = 1024,
                height = 1024,
                num_outputs = 1,
                scheduler = "K_EULER",
                guidance_scale = 7.5,
                num_inference_steps = 50,
                lora_scale = 0.6,
                refine = "expert_ensemble_refiner",
                high_noise_frac = 0.9,
                apply_watermark = false,
                negative_prompt = '',
                seed,
            } = req.body;

            // 构建参数对象 - 不进行prompt增强处理
            const params = {
                prompt,
                width: parseInt(width),
                height: parseInt(height),
                num_outputs: parseInt(num_outputs),
                scheduler,
                guidance_scale: parseFloat(guidance_scale),
                num_inference_steps: parseInt(num_inference_steps),
                lora_scale: parseFloat(lora_scale),
                refine,
                high_noise_frac: parseFloat(high_noise_frac),
                apply_watermark: Boolean(apply_watermark),
                negative_prompt: negative_prompt,
                skipEnhancement: true, // 跳过prompt增强处理
            };

            // 如果提供了种子，添加到参数中
            if (seed !== undefined) {
                params.seed = parseInt(seed);
            }

            // 启动异步生成任务
            const result = await imageGenerateService.generateTattooAsync(params);
            res.json(result);
        } catch (error) {
            console.error('Generate prompt tattoo error:', error);
            res.status(500).json(imageGenerateService.formatResponse(false, null, error.message));
        }
    });


    // 获取图片统计信息
    router.get('/stats', async (req, res) => {
        try {
            const stats = await imageService.getImageStats();
            res.json(imageService.formatResponse(true, stats, 'Image stats retrieved successfully'));
        } catch (error) {
            console.error('Get image stats error:', error);
            res.status(500).json(imageService.formatResponse(false, null, error.message));
        }
    });

    // 根据slug获取图片
    router.get('/slug/:slug', async (req, res) => {
        try {
            const { slug } = req.params;
            const image = await models.Image.findBySlug(slug);
            if (!image) {
                return res.status(404).json(imageService.formatResponse(false, null, 'Image not found'));
            }
            res.json(imageService.formatResponse(true, image, 'Image retrieved successfully'));
        } catch (error) {
            console.error('Get image by slug error:', error);
            res.status(500).json(imageService.formatResponse(false, null, error.message));
        }
    });

    // 批量更新图片状态
    router.patch('/batch-status', validateBody(['ids', 'status']), async (req, res) => {
        try {
            const { ids, status } = req.body;
            if (!Array.isArray(ids) || ids.length === 0) {
                return res.status(400).json(imageService.formatResponse(false, null, 'IDs array is required'));
            }

            const allowedFields = ['isPublic', 'isOnline', 'isColor'];
            const updateData = {};
            Object.keys(status).forEach(key => {
                if (allowedFields.includes(key)) {
                    updateData[key] = Boolean(status[key]);
                }
            });

            if (Object.keys(updateData).length === 0) {
                return res.status(400).json(imageService.formatResponse(false, null, 'No valid status fields provided'));
            }

            const result = await imageService.batchUpdateStatus(ids, updateData);
            res.json(imageService.formatResponse(true, result, 'Images status updated successfully'));
        } catch (error) {
            console.error('Batch update status error:', error);
            res.status(500).json(imageService.formatResponse(false, null, error.message));
        }
    });

    // 最后添加基础CRUD路由，避免与具体路由冲突
    const baseRoutes = createBaseRoutes(imageService, 'Image');
    router.use('/', baseRoutes);

    return router;
}

// 导出路由工厂函数
module.exports = (app) => {
    return createImageRoutes(app);
};