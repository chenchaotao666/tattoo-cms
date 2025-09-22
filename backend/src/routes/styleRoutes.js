const express = require('express');
const { createModels } = require('../models');
const StyleService = require('../services/StyleService');
const UploadService = require('../services/UploadService');
const { createBaseRoutes } = require('./baseRoutes');

const router = express.Router();

// 创建样式路由 - 提供基础CRUD功能和扩展功能
function createStyleRoutes(app) {
    const db = app.locals.db;
    const models = createModels(db);

    // 创建MinIO客户端和UploadService
    let uploadService = null;
    try {
        const { Client } = require('minio');

        const endpoint = process.env.MINIO_ENDPOINT || 'http://localhost:9000';
        const accessKey = process.env.MINIO_ACCESS_KEY_ID || 'minioadmin';
        const secretKey = process.env.MINIO_SECRET_ACCESS_KEY || 'minioadmin123';
        const useSSL = process.env.MINIO_USE_SSL === 'true';

        // 解析endpoint
        const url = new URL(endpoint);
        const host = url.hostname;
        const port = parseInt(url.port) || (url.protocol === 'https:' ? 443 : 80);

        const minioClient = new Client({
            endPoint: host,
            port: port,
            useSSL: useSSL,
            accessKey: accessKey,
            secretKey: secretKey,
            region: process.env.MINIO_REGION || 'us-east-1'
        });

        uploadService = new UploadService(minioClient);
    } catch (error) {
        console.warn('Failed to initialize UploadService for StyleService:', error.message);
    }

    const styleService = new StyleService(models.Style, uploadService);

    // 使用基础CRUD路由提供完整的增删改查功能
    const baseRoutes = createBaseRoutes(styleService, 'Style');
    router.use('/', baseRoutes);

    // 获取热门样式
    router.get('/popular', async (req, res) => {
        try {
            const { limit = 10 } = req.query;
            const popularStyles = await models.Style.findPopularStyles(parseInt(limit));
            res.json(styleService.formatResponse(true, popularStyles, 'Popular styles retrieved successfully'));
        } catch (error) {
            console.error('Get popular styles error:', error);
            res.status(500).json(styleService.formatResponse(false, null, error.message));
        }
    });

    // 获取样式使用统计
    router.get('/:id/stats', async (req, res) => {
        try {
            const { id } = req.params;
            const stats = await models.Style.getUsageStats(id);
            if (!stats) {
                return res.status(404).json(styleService.formatResponse(false, null, 'Style not found'));
            }
            res.json(styleService.formatResponse(true, stats, 'Style stats retrieved successfully'));
        } catch (error) {
            console.error('Get style stats error:', error);
            res.status(500).json(styleService.formatResponse(false, null, error.message));
        }
    });

    // 批量创建样式
    router.post('/batch', async (req, res) => {
        try {
            const { styles } = req.body;
            if (!Array.isArray(styles)) {
                return res.status(400).json(styleService.formatResponse(false, null, 'Styles array is required'));
            }
            const result = await models.Style.createBatch(styles);
            res.status(201).json(styleService.formatResponse(true, result, 'Styles created successfully'));
        } catch (error) {
            console.error('Batch create styles error:', error);
            res.status(500).json(styleService.formatResponse(false, null, error.message));
        }
    });

    return router;
}

// 导出路由工厂函数
module.exports = (app) => {
    return createStyleRoutes(app);
};