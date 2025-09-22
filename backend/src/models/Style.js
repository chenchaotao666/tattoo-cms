const BaseModel = require('./BaseModel');

class Style extends BaseModel {
    constructor(db) {
        super(db, 'styles');
    }

    // 搜索样式（支持多语言）
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
            throw new Error(`Search styles failed: ${error.message}`);
        }
    }

    // 获取样式使用统计
    async getUsageStats(styleId) {
        try {
            const query = `
                SELECT 
                    s.*,
                    COUNT(i.id) as imageCount,
                    COUNT(CASE WHEN i.isOnline = 1 THEN 1 END) as onlineImageCount,
                    AVG(i.hotness) as avgHotness
                FROM ${this.tableName} s
                LEFT JOIN images i ON s.id = i.styleId
                WHERE s.id = ?
                GROUP BY s.id
            `;
            const [rows] = await this.db.execute(query, [styleId]);
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            throw new Error(`Get style usage stats failed: ${error.message}`);
        }
    }

    // 获取最受欢迎的样式
    async findPopularStyles(limit = 10) {
        try {
            const query = `
                SELECT 
                    s.*,
                    COUNT(i.id) as imageCount,
                    AVG(i.hotness) as avgHotness
                FROM ${this.tableName} s
                LEFT JOIN images i ON s.id = i.styleId AND i.isOnline = 1
                GROUP BY s.id
                HAVING imageCount > 0
                ORDER BY imageCount DESC, avgHotness DESC
                LIMIT ?
            `;
            const [rows] = await this.db.execute(query, [limit]);
            return rows;
        } catch (error) {
            throw new Error(`Find popular styles failed: ${error.message}`);
        }
    }

    // 检查样式名称是否已存在（多语言）
    async checkTitleExists(title, excludeId = null) {
        try {
            let query = `
                SELECT COUNT(*) as count FROM ${this.tableName} 
                WHERE JSON_CONTAINS(title, ?)
            `;
            const params = [JSON.stringify(title)];

            if (excludeId) {
                query += ` AND id != ?`;
                params.push(excludeId);
            }

            const [rows] = await this.db.execute(query, params);
            return rows[0].count > 0;
        } catch (error) {
            throw new Error(`Check style title exists failed: ${error.message}`);
        }
    }

    // 批量创建样式
    async createBatch(stylesData) {
        try {
            if (!Array.isArray(stylesData) || stylesData.length === 0) {
                throw new Error('Styles data array is required');
            }

            const { v4: uuidv4 } = require('uuid');
            const now = new Date();

            const processedData = stylesData.map(style => ({
                id: style.id || uuidv4(),
                title: style.title,
                prompt: style.prompt,
                createdAt: now,
                updatedAt: now
            }));

            const fields = ['id', 'title', 'prompt', 'createdAt', 'updatedAt'];
            const placeholders = processedData.map(() => `(${fields.map(() => '?').join(',')})`).join(',');
            const values = processedData.flatMap(style => fields.map(field => 
                typeof style[field] === 'object' ? JSON.stringify(style[field]) : style[field]
            ));

            const query = `INSERT INTO ${this.tableName} (${fields.join(',')}) VALUES ${placeholders}`;
            const [result] = await this.db.execute(query, values);

            return {
                success: true,
                message: `${result.affectedRows} styles created successfully`,
                insertedCount: result.affectedRows,
                insertedIds: processedData.map(style => style.id)
            };
        } catch (error) {
            throw new Error(`Batch create styles failed: ${error.message}`);
        }
    }
}

module.exports = Style;