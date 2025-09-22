const BaseModel = require('./BaseModel');

class Post extends BaseModel {
    constructor(db) {
        super(db, 'posts');
    }

    // 根据slug查找文章
    async findBySlug(slug) {
        try {
            const query = `SELECT * FROM ${this.tableName} WHERE slug = ?`;
            const [rows] = await this.db.execute(query, [slug]);
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            throw new Error(`Find ${this.tableName} by slug failed: ${error.message}`);
        }
    }

    // 获取已发布的文章
    async findPublished(options = {}) {
        try {
            const { currentPage = 1, pageSize = 20, sortBy = 'publishedAt', sortOrder = 'DESC' } = options;

            let query = `SELECT * FROM ${this.tableName} WHERE status = 'published'`;

            // 添加排序
            if (sortBy) {
                query += ` ORDER BY ${sortBy} ${sortOrder}`;
            }

            // 添加分页
            if (currentPage && pageSize) {
                const offset = (currentPage - 1) * pageSize;
                query += ` LIMIT ${pageSize} OFFSET ${offset}`;
            }

            const [rows] = await this.db.execute(query);

            // 获取总数
            const [countResult] = await this.db.execute(
                `SELECT COUNT(*) as total FROM ${this.tableName} WHERE status = 'published'`
            );
            const total = countResult[0].total;

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
            throw new Error(`Find published ${this.tableName} failed: ${error.message}`);
        }
    }

    // 检查slug是否唯一
    async isSlugUnique(slug, excludeId = null) {
        try {
            let query = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE slug = ?`;
            let params = [slug];

            if (excludeId) {
                query += ` AND id != ?`;
                params.push(excludeId);
            }

            const [rows] = await this.db.execute(query, params);
            return rows[0].count === 0;
        } catch (error) {
            throw new Error(`Check slug uniqueness failed: ${error.message}`);
        }
    }

    // 生成唯一的slug
    async generateUniqueSlug(baseSlug, excludeId = null) {
        let slug = baseSlug;
        let counter = 1;

        while (!(await this.isSlugUnique(slug, excludeId))) {
            slug = `${baseSlug}-${counter}`;
            counter++;
        }

        return slug;
    }

    // 创建文章时自动处理slug
    async create(data) {
        try {
            // 如果提供了slug，检查唯一性；否则从标题生成
            if (data.slug) {
                data.slug = await this.generateUniqueSlug(data.slug);
            } else if (data.title && data.title.en) {
                // 从英文标题生成slug
                const baseSlug = data.title.en
                    .toLowerCase()
                    .replace(/[^a-z0-9\s-]/g, '')
                    .replace(/\s+/g, '-')
                    .trim();
                data.slug = await this.generateUniqueSlug(baseSlug);
            }

            return await super.create(data);
        } catch (error) {
            throw new Error(`Create post failed: ${error.message}`);
        }
    }

    // 更新文章时处理slug
    async updateById(id, data) {
        try {
            if (data.slug) {
                data.slug = await this.generateUniqueSlug(data.slug, id);
            }

            return await super.updateById(id, data);
        } catch (error) {
            throw new Error(`Update post failed: ${error.message}`);
        }
    }
}

module.exports = Post;