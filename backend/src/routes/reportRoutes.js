const express = require('express');
const { createModels } = require('../models');
const BaseService = require('../services/BaseService');
const { createBaseRoutes, validateUUID } = require('./baseRoutes');

const router = express.Router();

// 举报服务类
class ReportService extends BaseService {
    constructor(reportModel) {
        super(reportModel);
    }

    // 根据图片ID获取举报
    async getByImageId(imageId, query = {}) {
        try {
            const pagination = this.normalizePaginationParams(query);
            const sort = this.normalizeSortParams(query);
            const filters = this.normalizeFilters(query);

            const options = { ...pagination, ...sort, filters };
            return await this.model.findByImageId(imageId, options);
        } catch (error) {
            throw new Error(`Get reports by image failed: ${error.message}`);
        }
    }

    // 根据用户ID获取举报
    async getByUserId(userId, query = {}) {
        try {
            const pagination = this.normalizePaginationParams(query);
            const sort = this.normalizeSortParams(query);
            const filters = this.normalizeFilters(query);

            const options = { ...pagination, ...sort, filters };
            return await this.model.findByUserId(userId, options);
        } catch (error) {
            throw new Error(`Get reports by user failed: ${error.message}`);
        }
    }

    // 根据举报类型获取举报
    async getByType(reportType, query = {}) {
        try {
            const pagination = this.normalizePaginationParams(query);
            const sort = this.normalizeSortParams(query);
            const filters = this.normalizeFilters(query);

            const options = { ...pagination, ...sort, filters };
            return await this.model.findByType(reportType, options);
        } catch (error) {
            throw new Error(`Get reports by type failed: ${error.message}`);
        }
    }

    // 获取举报统计
    async getReportStats() {
        try {
            return await this.model.getReportStats();
        } catch (error) {
            throw new Error(`Get report stats failed: ${error.message}`);
        }
    }
}

// 创建举报路由
function createReportRoutes(app) {
    const db = app.locals.db;
    const models = createModels(db);
    const reportService = new ReportService(models.ImageReport);

    // 使用基础CRUD路由
    const baseRoutes = createBaseRoutes(reportService, 'Report');
    router.use('/', baseRoutes);

    // GET /api/reports/stats - 获取举报统计
    router.get('/stats', async (req, res) => {
        try {
            const stats = await reportService.getReportStats();
            res.json(reportService.formatResponse(true, stats, 'Report stats retrieved successfully'));
        } catch (error) {
            console.error('Get report stats error:', error);
            res.status(500).json(reportService.formatResponse(false, null, error.message));
        }
    });

    // GET /api/reports/image/:imageId - 获取图片的举报
    router.get('/image/:imageId', validateUUID, async (req, res) => {
        try {
            const { imageId } = req.params;
            const result = await reportService.getByImageId(imageId, req.query);
            res.json(reportService.formatPaginatedResponse(result, 'Image reports retrieved successfully'));
        } catch (error) {
            console.error('Get reports by image error:', error);
            res.status(500).json(reportService.formatResponse(false, null, error.message));
        }
    });

    // GET /api/reports/user/:userId - 获取用户的举报
    router.get('/user/:userId', validateUUID, async (req, res) => {
        try {
            const { userId } = req.params;
            const result = await reportService.getByUserId(userId, req.query);
            res.json(reportService.formatPaginatedResponse(result, 'User reports retrieved successfully'));
        } catch (error) {
            console.error('Get reports by user error:', error);
            res.status(500).json(reportService.formatResponse(false, null, error.message));
        }
    });

    // GET /api/reports/type/:type - 按类型获取举报
    router.get('/type/:type', async (req, res) => {
        try {
            const { type } = req.params;
            const result = await reportService.getByType(type, req.query);
            res.json(reportService.formatPaginatedResponse(result, `Reports of type ${type} retrieved successfully`));
        } catch (error) {
            console.error('Get reports by type error:', error);
            res.status(500).json(reportService.formatResponse(false, null, error.message));
        }
    });

    return router;
}

// 导出路由工厂函数
module.exports = (app) => {
    return createReportRoutes(app);
};