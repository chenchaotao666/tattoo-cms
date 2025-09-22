const express = require('express');
const { createModels } = require('../models');
const ImageService = require('../services/ImageService');

const router = express.Router();

// 创建用户图片路由
function createUserImageRoutes(app) {
    const db = app.locals.db;
    const models = createModels(db);
    const imageService = new ImageService(models.Image);

    // GET /api/user-images - 获取所有用户图片（有userId的图片）
    router.get('/', async (req, res) => {
        try {
            const result = await imageService.getAllUserImages(req.query);
            res.json(imageService.formatPaginatedResponse(result, 'User images retrieved successfully'));
        } catch (error) {
            console.error('Get user images error:', error);
            res.status(500).json(imageService.formatResponse(false, null, error.message));
        }
    });

    // GET /api/user-images/:id - 获取用户图片详情（包含同批次所有图片）
    router.get('/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const result = await imageService.getById(id);
            res.json(imageService.formatResponse(true, result, 'User image details retrieved successfully'));
        } catch (error) {
            console.error('Get user image details error:', error);
            const statusCode = error.message.includes('not found') ? 404 : 500;
            res.status(statusCode).json(imageService.formatResponse(false, null, error.message));
        }
    });

    return router;
}

// 导出路由工厂函数
module.exports = (app) => {
    return createUserImageRoutes(app);
};