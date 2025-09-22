const express = require('express');
const { createModels } = require('../models');
const BaseService = require('../services/BaseService');
const { createBaseRoutes, validateBody, validateUUID } = require('./baseRoutes');

const router = express.Router();

// 分类服务类
class CategoryService extends BaseService {
    constructor(categoryModel) {
        super(categoryModel);
    }

    // 重写 getAll 方法，包含图片信息和name字段搜索
    async getAll(query = {}) {
        try {
            const pagination = this.normalizePaginationParams(query);
            const sort = this.normalizeSortParams(query);
            const filters = this.normalizeFilters(query);

            // 默认按 hotness 降序排序
            const sortBy = sort.sortBy || 'hotness';
            const sortOrder = sort.sortOrder || 'DESC';

            const options = { ...pagination, sortBy, sortOrder, filters };

            // 使用包含图片信息和搜索功能的查询
            return await this.getCategoriesWithImageInfo(options);
        } catch (error) {
            throw new Error(`Get all categories failed: ${error.message}`);
        }
    }

    // 获取分类及其关联的图片信息
    async getCategoriesWithImageInfo(options = {}) {
        try {
            const { currentPage, pageSize, sortBy = 'hotness', sortOrder = 'DESC', filters = {} } = options;

            // 构建包含图片信息的查询
            let baseQuery = `
                SELECT
                    c.*,
                    i.tattooUrl,
                    i.scourceUrl as sourceUrl,
                    COUNT(DISTINCT ci.id) as imageCount,
                    COUNT(DISTINCT CASE WHEN ci.isOnline = 1 THEN ci.id END) as onlineImageCount
                FROM categories c
                LEFT JOIN images i ON c.imageId = i.id
                LEFT JOIN images ci ON c.id = ci.categoryId
            `;

            const conditions = [];
            const values = [];

            // 处理过滤条件，特殊处理name字段
            if (Object.keys(filters).length > 0) {
                Object.entries(filters).forEach(([key, value]) => {
                    if (value !== undefined && value !== null && value !== '') {
                        if (key === 'name') {
                            // 对name字段进行特殊处理，搜索英文内容
                            conditions.push(`c.name->'$.en' LIKE ?`);
                            values.push(`%${value}%`);
                        }
                        // 其他字段可以在这里添加处理逻辑
                    }
                });
            }

            // 组装WHERE子句
            if (conditions.length > 0) {
                baseQuery += ` WHERE ${conditions.join(' AND ')}`;
            }

            baseQuery += ` GROUP BY c.id, i.id`;

            // 添加排序 - 使用c.前缀确保排序字段来自categories表
            if (sortBy && sortOrder) {
                const sortField = sortBy === 'hotness' ? 'c.hotness' : `c.${sortBy}`;
                baseQuery += ` ORDER BY ${sortField} ${sortOrder}`;
            }

            // 获取总数（需要包含过滤条件）
            let countQuery = `SELECT COUNT(*) as total FROM categories c`;
            if (conditions.length > 0) {
                countQuery += ` WHERE ${conditions.join(' AND ')}`;
            }
            const [countResult] = await this.model.db.execute(countQuery, values);
            const total = countResult[0].total;

            // 添加分页
            if (currentPage && pageSize) {
                const offset = (currentPage - 1) * pageSize;
                baseQuery += ` LIMIT ${pageSize} OFFSET ${offset}`;
            }

            const [rows] = await this.model.db.execute(baseQuery, values);

            const result = {
                data: rows
            };

            // 总是返回分页信息，如果没有提供分页参数则使用默认值
            if (currentPage && pageSize) {
                result.pagination = {
                    currentPage: parseInt(currentPage),
                    pageSize: parseInt(pageSize),
                    total,
                    totalPages: Math.ceil(total / pageSize)
                };
            } else {
                // 没有分页参数时，返回基本的分页信息
                result.pagination = {
                    currentPage: 1,
                    pageSize: total, // 显示所有数据
                    total,
                    totalPages: 1
                };
            }

            return result;
        } catch (error) {
            throw new Error(`Get categories with image info failed: ${error.message}`);
        }
    }

    // 根据slug获取分类
    async getBySlug(slug) {
        try {
            if (!slug) {
                throw new Error('Slug is required');
            }

            const category = await this.model.findBySlug(slug);
            if (!category) {
                throw new Error('Category not found');
            }

            return category;
        } catch (error) {
            throw new Error(`Get category by slug failed: ${error.message}`);
        }
    }

    // 获取热门分类
    async getHotCategories(limit = 10) {
        try {
            return await this.model.findHotCategories(limit);
        } catch (error) {
            throw new Error(`Get hot categories failed: ${error.message}`);
        }
    }

    // 获取分类及图片统计
    async getCategoriesWithStats(query = {}) {
        try {
            const pagination = this.normalizePaginationParams(query);
            const sort = this.normalizeSortParams(query);
            
            const options = { ...pagination, ...sort };
            return await this.model.findWithImageCount(options);
        } catch (error) {
            throw new Error(`Get categories with stats failed: ${error.message}`);
        }
    }

    // 更新分类热度
    async updateHotness(categoryId, hotnessChange) {
        try {
            if (!categoryId) {
                throw new Error('Category ID is required');
            }

            if (typeof hotnessChange !== 'number') {
                throw new Error('Hotness change must be a number');
            }

            return await this.model.updateHotness(categoryId, hotnessChange);
        } catch (error) {
            throw new Error(`Update category hotness failed: ${error.message}`);
        }
    }

    // 获取SEO信息
    async getSEOInfo(slug) {
        try {
            if (!slug) {
                throw new Error('Slug is required');
            }

            return await this.model.getSEOInfo(slug);
        } catch (error) {
            throw new Error(`Get SEO info failed: ${error.message}`);
        }
    }

    // 获取分类树
    async getCategoryTree() {
        try {
            return await this.model.findCategoryTree();
        } catch (error) {
            throw new Error(`Get category tree failed: ${error.message}`);
        }
    }
}

// 创建分类路由
function createCategoryRoutes(app) {
    const db = app.locals.db;
    const models = createModels(db);
    const categoryService = new CategoryService(models.Category);

    // 使用基础CRUD路由
    const baseRoutes = createBaseRoutes(categoryService, 'Category');
    router.use('/', baseRoutes);

    // GET /api/categories/hot - 获取热门分类
    router.get('/hot', async (req, res) => {
        try {
            const { limit } = req.query;
            const categories = await categoryService.getHotCategories(parseInt(limit) || 10);
            res.json(categoryService.formatResponse(true, categories, 'Hot categories retrieved successfully'));
        } catch (error) {
            console.error('Get hot categories error:', error);
            res.status(500).json(categoryService.formatResponse(false, null, error.message));
        }
    });

    // GET /api/categories/with-stats - 获取分类及其统计
    router.get('/with-stats', async (req, res) => {
        try {
            const result = await categoryService.getCategoriesWithStats(req.query);
            res.json(categoryService.formatPaginatedResponse(result, 'Categories with stats retrieved successfully'));
        } catch (error) {
            console.error('Get categories with stats error:', error);
            res.status(500).json(categoryService.formatResponse(false, null, error.message));
        }
    });

    // GET /api/categories/tree - 获取分类树
    router.get('/tree', async (req, res) => {
        try {
            const categories = await categoryService.getCategoryTree();
            res.json(categoryService.formatResponse(true, categories, 'Category tree retrieved successfully'));
        } catch (error) {
            console.error('Get category tree error:', error);
            res.status(500).json(categoryService.formatResponse(false, null, error.message));
        }
    });

    // GET /api/categories/slug/:slug - 根据slug获取分类
    router.get('/slug/:slug', async (req, res) => {
        try {
            const { slug } = req.params;
            const category = await categoryService.getBySlug(slug);
            res.json(categoryService.formatResponse(true, category, 'Category retrieved successfully'));
        } catch (error) {
            console.error('Get category by slug error:', error);
            const statusCode = error.message.includes('not found') ? 404 : 500;
            res.status(statusCode).json(categoryService.formatResponse(false, null, error.message));
        }
    });

    // GET /api/categories/slug/:slug/seo - 获取分类SEO信息
    router.get('/slug/:slug/seo', async (req, res) => {
        try {
            const { slug } = req.params;
            const seoInfo = await categoryService.getSEOInfo(slug);
            
            if (!seoInfo) {
                return res.status(404).json(categoryService.formatResponse(false, null, 'Category not found'));
            }
            
            res.json(categoryService.formatResponse(true, seoInfo, 'SEO info retrieved successfully'));
        } catch (error) {
            console.error('Get category SEO info error:', error);
            res.status(500).json(categoryService.formatResponse(false, null, error.message));
        }
    });

    // POST /api/categories/:id/hotness - 更新分类热度
    router.post('/:id/hotness', validateUUID, validateBody(['hotnessChange']), async (req, res) => {
        try {
            const { id } = req.params;
            const { hotnessChange } = req.body;
            const category = await categoryService.updateHotness(id, hotnessChange);
            res.json(categoryService.formatResponse(true, category, 'Category hotness updated successfully'));
        } catch (error) {
            console.error('Update category hotness error:', error);
            const statusCode = error.message.includes('not found') ? 404 : 500;
            res.status(statusCode).json(categoryService.formatResponse(false, null, error.message));
        }
    });

    return router;
}

// 导出路由工厂函数
module.exports = (app) => {
    return createCategoryRoutes(app);
};