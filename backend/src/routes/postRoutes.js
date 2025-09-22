const express = require('express');
const { createModels } = require('../models');
const BaseService = require('../services/BaseService');
const PostService = require('../services/PostService');
const UploadService = require('../services/UploadService');
const { createBaseRoutes, validateUUID, validateBody } = require('./baseRoutes');

const router = express.Router();

// 创建文章路由
function createPostRoutes(app) {
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
        console.warn('Failed to initialize UploadService for PostService:', error.message);
    }

    const postService = new PostService(models.Post, uploadService);

    // 获取博客统计信息
    router.get('/stats', async (req, res) => {
        try {
            const stats = await postService.getStats();
            res.json(postService.formatResponse(true, stats, 'Post stats retrieved successfully'));
        } catch (error) {
            console.error('Get post stats error:', error);
            res.status(500).json(postService.formatResponse(false, null, error.message));
        }
    });

    // 根据slug获取博客文章
    router.get('/slug/:slug', async (req, res) => {
        try {
            const { slug } = req.params;
            const post = await postService.getBySlug(slug);
            res.json(postService.formatResponse(true, post, 'Post retrieved successfully'));
        } catch (error) {
            console.error('Get post by slug error:', error);
            const statusCode = error.message.includes('not found') ? 404 : 500;
            res.status(statusCode).json(postService.formatResponse(false, null, error.message));
        }
    });

    // 获取已发布的博客文章
    router.get('/published', async (req, res) => {
        try {
            const result = await postService.getPublishedPosts(req.query);
            res.json(postService.formatPaginatedResponse(result, 'Published posts retrieved successfully'));
        } catch (error) {
            console.error('Get published posts error:', error);
            res.status(500).json(postService.formatResponse(false, null, error.message));
        }
    });

    // 发布博客文章
    router.patch('/:id/publish', validateUUID, async (req, res) => {
        try {
            const { id } = req.params;
            const post = await postService.publish(id);
            res.json(postService.formatResponse(true, post, 'Post published successfully'));
        } catch (error) {
            console.error('Publish post error:', error);
            const statusCode = error.message.includes('not found') ? 404 : 500;
            res.status(statusCode).json(postService.formatResponse(false, null, error.message));
        }
    });

    // 取消发布博客文章
    router.patch('/:id/unpublish', validateUUID, async (req, res) => {
        try {
            const { id } = req.params;
            const post = await postService.unpublish(id);
            res.json(postService.formatResponse(true, post, 'Post unpublished successfully'));
        } catch (error) {
            console.error('Unpublish post error:', error);
            const statusCode = error.message.includes('not found') ? 404 : 500;
            res.status(statusCode).json(postService.formatResponse(false, null, error.message));
        }
    });

    // 批量发布博客文章
    router.patch('/batch/publish', validateBody(['ids']), async (req, res) => {
        try {
            const { ids } = req.body;
            if (!Array.isArray(ids) || ids.length === 0) {
                return res.status(400).json(postService.formatResponse(false, null, 'IDs array is required'));
            }

            const result = await postService.batchPublish(ids);
            res.json(postService.formatResponse(true, result, 'Posts published successfully'));
        } catch (error) {
            console.error('Batch publish posts error:', error);
            res.status(500).json(postService.formatResponse(false, null, error.message));
        }
    });

    // 批量取消发布博客文章
    router.patch('/batch/unpublish', validateBody(['ids']), async (req, res) => {
        try {
            const { ids } = req.body;
            if (!Array.isArray(ids) || ids.length === 0) {
                return res.status(400).json(postService.formatResponse(false, null, 'IDs array is required'));
            }

            const result = await postService.batchUnpublish(ids);
            res.json(postService.formatResponse(true, result, 'Posts unpublished successfully'));
        } catch (error) {
            console.error('Batch unpublish posts error:', error);
            res.status(500).json(postService.formatResponse(false, null, error.message));
        }
    });

    // 最后添加基础CRUD路由，避免与具体路由冲突
    const baseRoutes = createBaseRoutes(postService, 'Post');
    router.use('/', baseRoutes);

    return router;
}

// 导出路由工厂函数
module.exports = (app) => {
    return createPostRoutes(app);
};