const BaseModel = require('./BaseModel');

class Category extends BaseModel {
    constructor(db) {
        super(db, 'categories');
    }

    // 根据slug查找分类
    async findBySlug(slug) {
        try {
            const query = `SELECT * FROM ${this.tableName} WHERE slug = ?`;
            const [rows] = await this.db.execute(query, [slug]);
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            throw new Error(`Find category by slug failed: ${error.message}`);
        }
    }

    // 获取热门分类
    async findHotCategories(limit = 10) {
        try {
            const query = `
                SELECT * FROM ${this.tableName} 
                ORDER BY hotness DESC 
                LIMIT ?
            `;
            const [rows] = await this.db.execute(query, [limit]);
            return rows;
        } catch (error) {
            throw new Error(`Find hot categories failed: ${error.message}`);
        }
    }

    // 获取分类及其图片统计
    async findWithImageCount(options = {}) {
        try {
            const { currentPage, pageSize, sortBy = 'hotness', sortOrder = 'DESC' } = options;

            // 构建查询
            let baseQuery = `
                SELECT 
                    c.*,
                    COUNT(i.id) as imageCount,
                    COUNT(CASE WHEN i.isOnline = 1 THEN 1 END) as onlineImageCount
                FROM ${this.tableName} c
                LEFT JOIN images i ON c.id = i.categoryId
                GROUP BY c.id
            `;

            // 添加排序
            if (sortBy) {
                baseQuery += ` ${this.buildSortQuery(sortBy, sortOrder)}`;
            }

            // 获取总数
            const countQuery = `SELECT COUNT(*) as total FROM ${this.tableName}`;
            const [countResult] = await this.db.execute(countQuery);
            const total = countResult[0].total;

            // 添加分页
            const query = this.buildPaginationQuery(baseQuery, currentPage, pageSize);
            const [rows] = await this.db.execute(query);

            return {
                data: rows,
                pagination: {
                    currentPage: parseInt(currentPage),
                    pageSize: parseInt(pageSize),
                    total,
                    totalPages: Math.ceil(total / pageSize)
                }
            };
        } catch (error) {
            throw new Error(`Find categories with image count failed: ${error.message}`);
        }
    }

    // 更新分类热度
    async updateHotness(categoryId, hotnessChange) {
        try {
            const query = `
                UPDATE ${this.tableName} 
                SET hotness = GREATEST(0, LEAST(1000, hotness + ?)), 
                    updatedAt = NOW() 
                WHERE id = ?
            `;
            const [result] = await this.db.execute(query, [hotnessChange, categoryId]);
            
            if (result.affectedRows === 0) {
                throw new Error(`Category with ID ${categoryId} not found`);
            }

            return await this.findById(categoryId);
        } catch (error) {
            throw new Error(`Update category hotness failed: ${error.message}`);
        }
    }

    // 获取分类的SEO信息
    async getSEOInfo(slug) {
        try {
            const query = `
                SELECT id, name, description, seoTitle, seoDesc, slug, imageId
                FROM ${this.tableName} 
                WHERE slug = ?
            `;
            const [rows] = await this.db.execute(query, [slug]);
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            throw new Error(`Get category SEO info failed: ${error.message}`);
        }
    }

    // 获取分类树（如果有层级关系的话，预留接口）
    async findCategoryTree() {
        try {
            const query = `
                SELECT * FROM ${this.tableName} 
                ORDER BY hotness DESC, name->'$.en' ASC
            `;
            const [rows] = await this.db.execute(query);
            return rows;
        } catch (error) {
            throw new Error(`Find category tree failed: ${error.message}`);
        }
    }

    // 搜索分类（支持多语言）
    async search(keyword, options = {}) {
        try {
            const { currentPage, pageSize } = options;

            const baseQuery = `
                SELECT * FROM ${this.tableName} 
                WHERE name->'$.en' LIKE ? 
                   OR name->'$.zh' LIKE ?
                   OR description->'$.en' LIKE ?
                   OR description->'$.zh' LIKE ?
                ORDER BY hotness DESC
            `;

            const searchPattern = `%${keyword}%`;
            const searchParams = [searchPattern, searchPattern, searchPattern, searchPattern];

            // 获取总数
            const countQuery = `
                SELECT COUNT(*) as total FROM ${this.tableName} 
                WHERE name->'$.en' LIKE ? 
                   OR name->'$.zh' LIKE ?
                   OR description->'$.en' LIKE ?
                   OR description->'$.zh' LIKE ?
            `;
            const [countResult] = await this.db.execute(countQuery, searchParams);
            const total = countResult[0].total;

            // 分页查询
            const query = this.buildPaginationQuery(baseQuery, currentPage, pageSize);
            const [rows] = await this.db.execute(query, searchParams);

            return {
                data: rows,
                pagination: {
                    currentPage: parseInt(currentPage),
                    pageSize: parseInt(pageSize),
                    total,
                    totalPages: Math.ceil(total / pageSize)
                }
            };
        } catch (error) {
            throw new Error(`Search categories failed: ${error.message}`);
        }
    }
}

module.exports = Category;