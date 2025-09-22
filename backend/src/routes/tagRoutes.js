const express = require('express');
const { createModels } = require('../models');
const TagService = require('../services/TagService');
const { createBaseRoutes, validateUUID } = require('./baseRoutes');

const router = express.Router();

// 扩展标签服务类，添加特殊方法
class ExtendedTagService extends TagService {
    constructor(tagModel) {
        super(tagModel);
    }

    // 获取标签使用统计
    async getUsageStats(tagId) {
        try {
            if (!tagId) {
                throw new Error('Tag ID is required');
            }

            return await this.model.getUsageStats(tagId);
        } catch (error) {
            throw new Error(`Get tag usage stats failed: ${error.message}`);
        }
    }

    // 获取热门标签
    async getPopularTags(limit = 20) {
        try {
            return await this.model.findPopularTags(limit);
        } catch (error) {
            throw new Error(`Get popular tags failed: ${error.message}`);
        }
    }
}

// 创建标签路由
function createTagRoutes(app) {
    const db = app.locals.db;
    const models = createModels(db);
    const tagService = new ExtendedTagService(models.Tag);

    // 使用基础CRUD路由
    const baseRoutes = createBaseRoutes(tagService, 'Tag');
    router.use('/', baseRoutes);

    // GET /api/tags/popular - 获取热门标签
    router.get('/popular', async (req, res) => {
        try {
            const { limit } = req.query;
            const tags = await tagService.getPopularTags(parseInt(limit) || 20);
            res.json(tagService.formatResponse(true, tags, 'Popular tags retrieved successfully'));
        } catch (error) {
            console.error('Get popular tags error:', error);
            res.status(500).json(tagService.formatResponse(false, null, error.message));
        }
    });

    // GET /api/tags/:id/stats - 获取标签使用统计
    router.get('/:id/stats', validateUUID, async (req, res) => {
        try {
            const { id } = req.params;
            const stats = await tagService.getUsageStats(id);
            
            if (!stats) {
                return res.status(404).json(tagService.formatResponse(false, null, 'Tag not found'));
            }
            
            res.json(tagService.formatResponse(true, stats, 'Tag stats retrieved successfully'));
        } catch (error) {
            console.error('Get tag stats error:', error);
            res.status(500).json(tagService.formatResponse(false, null, error.message));
        }
    });

    return router;
}

// 导出路由工厂函数
module.exports = (app) => {
    return createTagRoutes(app);
};