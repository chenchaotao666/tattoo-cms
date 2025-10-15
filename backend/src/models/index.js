const User = require('./User');
const Category = require('./Category');
const Image = require('./Image');
const Style = require('./Style');
const Post = require('./Post');
const BaseModel = require('./BaseModel');
const PromptTemplate = require('./PromptTemplate');

// 简单模型类（使用BaseModel的基础功能）
class Idea extends BaseModel {
    constructor(db) {
        super(db, 'ideas');
    }

    // 搜索创意（支持多语言）
    async search(keyword, options = {}) {
        try {
            const { currentPage, pageSize } = options;

            const baseQuery = `
                SELECT * FROM ${this.tableName} 
                WHERE title->'$.en' LIKE ? 
                   OR title->'$.zh' LIKE ?
                   OR prompt->'$.en' LIKE ?
                   OR prompt->'$.zh' LIKE ?
                ORDER BY createdAt DESC
            `;

            const searchPattern = `%${keyword}%`;
            const searchParams = [searchPattern, searchPattern, searchPattern, searchPattern];

            // 获取总数
            const countQuery = `
                SELECT COUNT(*) as total FROM ${this.tableName} 
                WHERE title->'$.en' LIKE ? 
                   OR title->'$.zh' LIKE ?
                   OR prompt->'$.en' LIKE ?
                   OR prompt->'$.zh' LIKE ?
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
            throw new Error(`Search ideas failed: ${error.message}`);
        }
    }
}

class Tag extends BaseModel {
    constructor(db) {
        super(db, 'tags');
    }

    // 获取标签使用统计
    async getUsageStats(tagId) {
        try {
            const query = `
                SELECT 
                    t.*,
                    COUNT(it.imageId) as imageCount,
                    COUNT(CASE WHEN i.isOnline = 1 THEN 1 END) as onlineImageCount
                FROM ${this.tableName} t
                LEFT JOIN image_tags it ON t.id = it.tagId
                LEFT JOIN images i ON it.imageId = i.id
                WHERE t.id = ?
                GROUP BY t.id
            `;
            const [rows] = await this.db.execute(query, [tagId]);
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            throw new Error(`Get tag usage stats failed: ${error.message}`);
        }
    }

    // 获取热门标签
    async findPopularTags(limit = 20) {
        try {
            const query = `
                SELECT 
                    t.*,
                    COUNT(it.imageId) as imageCount
                FROM ${this.tableName} t
                LEFT JOIN image_tags it ON t.id = it.tagId
                LEFT JOIN images i ON it.imageId = i.id AND i.isOnline = 1
                GROUP BY t.id
                HAVING imageCount > 0
                ORDER BY imageCount DESC
                LIMIT ?
            `;
            const [rows] = await this.db.execute(query, [limit]);
            return rows;
        } catch (error) {
            throw new Error(`Find popular tags failed: ${error.message}`);
        }
    }

    // 搜索标签（支持多语言）
    async search(keyword, options = {}) {
        try {
            const { currentPage, pageSize } = options;

            const baseQuery = `
                SELECT * FROM ${this.tableName} 
                WHERE name->'$.en' LIKE ? 
                   OR name->'$.zh' LIKE ?
                ORDER BY name->'$.en' ASC
            `;

            const searchPattern = `%${keyword}%`;
            const searchParams = [searchPattern, searchPattern];

            // 获取总数
            const countQuery = `
                SELECT COUNT(*) as total FROM ${this.tableName} 
                WHERE name->'$.en' LIKE ? 
                   OR name->'$.zh' LIKE ?
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
            throw new Error(`Search tags failed: ${error.message}`);
        }
    }
}


class Recharge extends BaseModel {
    constructor(db) {
        super(db, 'recharges');
    }

    // 根据用户ID查找充值记录
    async findByUserId(userId, options = {}) {
        try {
            const filters = { ...options.filters, userId };
            return await this.findAll({ ...options, filters });
        } catch (error) {
            throw new Error(`Find recharges by user failed: ${error.message}`);
        }
    }

    // 根据订单ID查找充值记录
    async findByOrderId(orderId) {
        try {
            const query = `SELECT * FROM ${this.tableName} WHERE orderId = ?`;
            const [rows] = await this.db.execute(query, [orderId]);
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            throw new Error(`Find recharge by order ID failed: ${error.message}`);
        }
    }

    // 获取用户充值统计
    async getUserRechargeStats(userId) {
        try {
            const query = `
                SELECT 
                    COUNT(*) as totalRecharges,
                    SUM(amount) as totalAmount,
                    SUM(creditsAdded) as totalCredits,
                    AVG(amount) as avgAmount,
                    MAX(createdAt) as lastRechargeDate
                FROM ${this.tableName} 
                WHERE userId = ? AND status = 'success'
            `;
            const [rows] = await this.db.execute(query, [userId]);
            return rows[0];
        } catch (error) {
            throw new Error(`Get user recharge stats failed: ${error.message}`);
        }
    }

    // 按状态查找充值记录
    async findByStatus(status, options = {}) {
        try {
            const filters = { ...options.filters, status };
            return await this.findAll({ ...options, filters });
        } catch (error) {
            throw new Error(`Find recharges by status failed: ${error.message}`);
        }
    }
}

class ImageReport extends BaseModel {
    constructor(db) {
        super(db, 'image_reports');
    }

    // 根据图片ID查找举报
    async findByImageId(imageId, options = {}) {
        try {
            const filters = { ...options.filters, imageId };
            return await this.findAll({ ...options, filters });
        } catch (error) {
            throw new Error(`Find reports by image failed: ${error.message}`);
        }
    }

    // 根据用户ID查找举报
    async findByUserId(userId, options = {}) {
        try {
            const filters = { ...options.filters, userId };
            return await this.findAll({ ...options, filters });
        } catch (error) {
            throw new Error(`Find reports by user failed: ${error.message}`);
        }
    }

    // 根据举报类型查找
    async findByType(reportType, options = {}) {
        try {
            const filters = { ...options.filters, report_type: reportType };
            return await this.findAll({ ...options, filters });
        } catch (error) {
            throw new Error(`Find reports by type failed: ${error.message}`);
        }
    }

    // 获取举报统计
    async getReportStats() {
        try {
            const query = `
                SELECT 
                    report_type,
                    COUNT(*) as count
                FROM ${this.tableName}
                GROUP BY report_type
                ORDER BY count DESC
            `;
            const [rows] = await this.db.execute(query);
            return rows;
        } catch (error) {
            throw new Error(`Get report stats failed: ${error.message}`);
        }
    }
}

// 模型工厂函数
function createModels(db) {
    return {
        User: new User(db),
        Category: new Category(db),
        Image: new Image(db),
        Style: new Style(db),
        Idea: new Idea(db),
        Tag: new Tag(db),
        Post: new Post(db),
        Recharge: new Recharge(db),
        ImageReport: new ImageReport(db),
        PromptTemplate: new PromptTemplate(db)
    };
}

module.exports = {
    createModels,
    User,
    Category,
    Image,
    Style,
    Idea,
    Tag,
    Post,
    Recharge,
    ImageReport,
    PromptTemplate,
    BaseModel
};