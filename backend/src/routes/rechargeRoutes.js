const express = require('express');
const { createModels } = require('../models');
const BaseService = require('../services/BaseService');
const { createBaseRoutes, validateUUID } = require('./baseRoutes');

const router = express.Router();

// 充值服务类
class RechargeService extends BaseService {
    constructor(rechargeModel) {
        super(rechargeModel);
    }

    // 根据用户ID获取充值记录
    async getUserRecharges(userId, query = {}) {
        try {
            const pagination = this.normalizePaginationParams(query);
            const sort = this.normalizeSortParams(query);
            const filters = this.normalizeFilters(query);

            const options = { ...pagination, ...sort, filters };
            return await this.model.findByUserId(userId, options);
        } catch (error) {
            throw new Error(`Get user recharges failed: ${error.message}`);
        }
    }

    // 根据订单ID获取充值记录
    async getByOrderId(orderId) {
        try {
            if (!orderId) {
                throw new Error('Order ID is required');
            }

            return await this.model.findByOrderId(orderId);
        } catch (error) {
            throw new Error(`Get recharge by order ID failed: ${error.message}`);
        }
    }

    // 获取用户充值统计
    async getUserStats(userId) {
        try {
            if (!userId) {
                throw new Error('User ID is required');
            }

            return await this.model.getUserRechargeStats(userId);
        } catch (error) {
            throw new Error(`Get user recharge stats failed: ${error.message}`);
        }
    }

    // 按状态获取充值记录
    async getByStatus(status, query = {}) {
        try {
            const pagination = this.normalizePaginationParams(query);
            const sort = this.normalizeSortParams(query);
            const filters = this.normalizeFilters(query);

            const options = { ...pagination, ...sort, filters };
            return await this.model.findByStatus(status, options);
        } catch (error) {
            throw new Error(`Get recharges by status failed: ${error.message}`);
        }
    }

    // 重写getAll方法，包含用户信息
    async getAll(query = {}) {
        try {
            const pagination = this.normalizePaginationParams(query);
            const sort = this.normalizeSortParams(query);
            const filters = this.normalizeFilters(query);

            // 构建包含用户信息的查询
            let baseQuery = `
                SELECT
                    r.*,
                    u.username as userName,
                    u.email as userEmail
                FROM ${this.model.tableName} r
                LEFT JOIN users u ON r.userId = u.id
            `;

            const conditions = [];
            const values = [];

            // 构建过滤条件
            if (Object.keys(filters).length > 0) {
                Object.entries(filters).forEach(([key, value]) => {
                    if (value !== undefined && value !== null && value !== '') {
                        if (key === 'userName') {
                            // 对用户名进行模糊搜索
                            conditions.push(`u.username LIKE ?`);
                            values.push(`%${value}%`);
                        } else if (key === 'userEmail') {
                            // 对用户邮箱进行模糊搜索
                            conditions.push(`u.email LIKE ?`);
                            values.push(`%${value}%`);
                        } else if (key === 'orderId') {
                            // 对订单号进行模糊搜索
                            conditions.push(`r.orderId LIKE ?`);
                            values.push(`%${value}%`);
                        } else if (key === 'method' && value.startsWith('!')) {
                            // 排除特定支付方式
                            const excludeMethod = value.substring(1);
                            conditions.push(`r.method != ?`);
                            values.push(excludeMethod);
                        } else {
                            // 其他字段精确匹配
                            conditions.push(`r.${key} = ?`);
                            values.push(value);
                        }
                    }
                });
            }

            // 组装WHERE子句
            if (conditions.length > 0) {
                baseQuery += ` WHERE ${conditions.join(' AND ')}`;
            }

            // 添加排序
            if (sort.sortBy) {
                let sortBy = Array.isArray(sort.sortBy) ? sort.sortBy[0] : sort.sortBy;
                let sortOrder = sort.sortOrder;
                if (Array.isArray(sortOrder)) {
                    sortOrder = sortOrder[0];
                }
                const order = sortOrder && String(sortOrder).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
                baseQuery += ` ORDER BY r.${sortBy} ${order}`;
            } else {
                // 默认按创建时间降序排序
                baseQuery += ` ORDER BY r.createdAt DESC`;
            }

            // 获取总数（用于分页）
            let totalCount = 0;
            if (pagination.currentPage && pagination.pageSize) {
                let countQuery = baseQuery.replace(
                    /SELECT[\s\S]*?FROM/,
                    'SELECT COUNT(*) as total FROM'
                );
                // 移除ORDER BY子句
                countQuery = countQuery.replace(/ORDER BY.*$/, '');

                const [countResult] = await this.model.db.execute(countQuery, values);
                totalCount = countResult[0].total;

                // 添加分页
                const offset = (pagination.currentPage - 1) * pagination.pageSize;
                baseQuery += ` LIMIT ${pagination.pageSize} OFFSET ${offset}`;
            }

            // 执行查询
            const [rows] = await this.model.db.execute(baseQuery, values);

            if (pagination.currentPage && pagination.pageSize) {
                return {
                    data: rows,
                    pagination: {
                        currentPage: parseInt(pagination.currentPage),
                        pageSize: parseInt(pagination.pageSize),
                        total: totalCount,
                        totalPages: Math.ceil(totalCount / pagination.pageSize)
                    }
                };
            } else {
                return { data: rows };
            }
        } catch (error) {
            throw new Error(`Get all recharges with user info failed: ${error.message}`);
        }
    }
}

// 创建充值路由
function createRechargeRoutes(app) {
    const db = app.locals.db;
    const models = createModels(db);
    const rechargeService = new RechargeService(models.Recharge);

    // 使用基础CRUD路由
    const baseRoutes = createBaseRoutes(rechargeService, 'Recharge');
    router.use('/', baseRoutes);

    // GET /api/recharges/user/:userId - 获取用户的充值记录
    router.get('/user/:userId', validateUUID, async (req, res) => {
        try {
            const { userId } = req.params;
            const result = await rechargeService.getUserRecharges(userId, req.query);
            res.json(rechargeService.formatPaginatedResponse(result, 'User recharges retrieved successfully'));
        } catch (error) {
            console.error('Get user recharges error:', error);
            res.status(500).json(rechargeService.formatResponse(false, null, error.message));
        }
    });

    // GET /api/recharges/user/:userId/stats - 获取用户充值统计
    router.get('/user/:userId/stats', validateUUID, async (req, res) => {
        try {
            const { userId } = req.params;
            const stats = await rechargeService.getUserStats(userId);
            res.json(rechargeService.formatResponse(true, stats, 'User recharge stats retrieved successfully'));
        } catch (error) {
            console.error('Get user recharge stats error:', error);
            res.status(500).json(rechargeService.formatResponse(false, null, error.message));
        }
    });

    // GET /api/recharges/order/:orderId - 根据订单ID获取充值记录
    router.get('/order/:orderId', async (req, res) => {
        try {
            const { orderId } = req.params;
            const recharge = await rechargeService.getByOrderId(orderId);
            
            if (!recharge) {
                return res.status(404).json(rechargeService.formatResponse(false, null, 'Recharge not found'));
            }
            
            res.json(rechargeService.formatResponse(true, recharge, 'Recharge retrieved successfully'));
        } catch (error) {
            console.error('Get recharge by order ID error:', error);
            res.status(500).json(rechargeService.formatResponse(false, null, error.message));
        }
    });

    // GET /api/recharges/status/:status - 按状态获取充值记录
    router.get('/status/:status', async (req, res) => {
        try {
            const { status } = req.params;
            const result = await rechargeService.getByStatus(status, req.query);
            res.json(rechargeService.formatPaginatedResponse(result, `Recharges with status ${status} retrieved successfully`));
        } catch (error) {
            console.error('Get recharges by status error:', error);
            res.status(500).json(rechargeService.formatResponse(false, null, error.message));
        }
    });

    return router;
}

// 导出路由工厂函数
module.exports = (app) => {
    return createRechargeRoutes(app);
};