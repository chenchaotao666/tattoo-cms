const BaseModel = require('./BaseModel');

class Image extends BaseModel {
    constructor(db) {
        super(db, 'images');
    }

    // 根据slug查找图片
    async findBySlug(slug) {
        try {
            const query = `
                SELECT i.*, 
                       c.name as categoryName, 
                       c.slug as categorySlug,
                       s.title as styleTitle,
                       u.username as authorName
                FROM ${this.tableName} i
                LEFT JOIN categories c ON i.categoryId = c.id
                LEFT JOIN styles s ON i.styleId = s.id
                LEFT JOIN users u ON i.userId = u.id
                WHERE i.slug = ?
            `;
            const [rows] = await this.db.execute(query, [slug]);
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            throw new Error(`Find image by slug failed: ${error.message}`);
        }
    }

    // 获取用户的图片
    async findByUserId(userId, options = {}) {
        try {
            const filters = { ...options.filters, userId };
            return await this.findAll({ ...options, filters });
        } catch (error) {
            throw new Error(`Find images by user failed: ${error.message}`);
        }
    }

    // 获取分类的图片
    async findByCategoryId(categoryId, options = {}) {
        try {
            const filters = { ...options.filters, categoryId };
            return await this.findAll({ ...options, filters });
        } catch (error) {
            throw new Error(`Find images by category failed: ${error.message}`);
        }
    }

    // 获取样式的图片
    async findByStyleId(styleId, options = {}) {
        try {
            const filters = { ...options.filters, styleId };
            return await this.findAll({ ...options, filters });
        } catch (error) {
            throw new Error(`Find images by style failed: ${error.message}`);
        }
    }

    // 获取公开且上线的图片
    async findPublicImages(options = {}) {
        try {
            const filters = { ...options.filters, isPublic: 1, isOnline: 1 };
            return await this.findAll({ ...options, filters });
        } catch (error) {
            throw new Error(`Find public images failed: ${error.message}`);
        }
    }

    // 获取热门图片
    async findHotImages(limit = 20, options = {}) {
        try {
            const { categoryId, styleId, isColor } = options;
            
            let query = `
                SELECT i.*, 
                       c.name as categoryName, 
                       c.slug as categorySlug,
                       s.title as styleTitle,
                       u.username as authorName
                FROM ${this.tableName} i
                LEFT JOIN categories c ON i.categoryId = c.id
                LEFT JOIN styles s ON i.styleId = s.id
                LEFT JOIN users u ON i.userId = u.id
                WHERE i.isPublic = 1 AND i.isOnline = 1
            `;
            
            const params = [];
            
            if (categoryId) {
                query += ` AND i.categoryId = ?`;
                params.push(categoryId);
            }
            
            if (styleId) {
                query += ` AND i.styleId = ?`;
                params.push(styleId);
            }
            
            if (isColor !== undefined) {
                query += ` AND i.isColor = ?`;
                params.push(isColor);
            }
            
            query += ` ORDER BY i.hotness DESC, i.createdAt DESC LIMIT ?`;
            params.push(limit);

            const [rows] = await this.db.execute(query, params);
            return rows;
        } catch (error) {
            throw new Error(`Find hot images failed: ${error.message}`);
        }
    }

    // 搜索图片（支持多语言）
    async search(keyword, options = {}) {
        try {
            const { currentPage, pageSize, categoryId, styleId, isColor, type } = options;

            let baseQuery = `
                SELECT i.*, 
                       c.name as categoryName, 
                       c.slug as categorySlug,
                       s.title as styleTitle,
                       u.username as authorName
                FROM ${this.tableName} i
                LEFT JOIN categories c ON i.categoryId = c.id
                LEFT JOIN styles s ON i.styleId = s.id
                LEFT JOIN users u ON i.userId = u.id
                WHERE i.isPublic = 1 AND i.isOnline = 1
                AND (i.title->'$.en' LIKE ? 
                     OR i.title->'$.zh' LIKE ?
                     OR i.description->'$.en' LIKE ?
                     OR i.description->'$.zh' LIKE ?)
            `;

            const searchPattern = `%${keyword}%`;
            const params = [searchPattern, searchPattern, searchPattern, searchPattern];

            // 添加额外筛选条件
            if (categoryId) {
                baseQuery += ` AND i.categoryId = ?`;
                params.push(categoryId);
            }
            
            if (styleId) {
                baseQuery += ` AND i.styleId = ?`;
                params.push(styleId);
            }
            
            if (isColor !== undefined) {
                baseQuery += ` AND i.isColor = ?`;
                params.push(isColor);
            }
            
            if (type) {
                baseQuery += ` AND i.type = ?`;
                params.push(type);
            }

            baseQuery += ` ORDER BY i.hotness DESC, i.createdAt DESC`;

            // 获取总数
            let countQuery = baseQuery.replace(
                /SELECT.*?FROM/s, 
                'SELECT COUNT(*) as total FROM'
            ).replace(/ORDER BY.*$/s, '');
            
            const [countResult] = await this.db.execute(countQuery, params);
            const total = countResult[0].total;

            // 分页查询
            const query = this.buildPaginationQuery(baseQuery, currentPage, pageSize);
            const [rows] = await this.db.execute(query, params);

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
            throw new Error(`Search images failed: ${error.message}`);
        }
    }

    // 获取图片的标签
    async getImageTags(imageId) {
        try {
            const query = `
                SELECT t.* 
                FROM tags t
                INNER JOIN image_tags it ON t.id = it.tagId
                WHERE it.imageId = ?
                ORDER BY t.name->'$.en'
            `;
            const [rows] = await this.db.execute(query, [imageId]);
            return rows;
        } catch (error) {
            throw new Error(`Get image tags failed: ${error.message}`);
        }
    }

    // 为图片添加标签
    async addTags(imageId, tagIds) {
        try {
            if (!Array.isArray(tagIds) || tagIds.length === 0) {
                return { success: true, message: 'No tags to add' };
            }

            // 先删除现有标签关联
            await this.db.query('DELETE FROM image_tags WHERE imageId = ?', [imageId]);

            // 批量插入新的标签关联
            const values = tagIds.map(tagId => [imageId, tagId]);
            const placeholders = values.map(() => '(?, ?)').join(',');
            const flatValues = values.flat();

            const query = `INSERT INTO image_tags (imageId, tagId) VALUES ${placeholders}`;
            await this.db.execute(query, flatValues);

            return { success: true, message: 'Tags updated successfully' };
        } catch (error) {
            throw new Error(`Add image tags failed: ${error.message}`);
        }
    }

    // 重写删除方法，确保删除图片时也删除相关的标签关联
    async deleteById(id) {
        try {
            // 开始事务以确保数据一致性
            await this.db.query('START TRANSACTION');

            try {
                // 1. 先删除 image_tags 表中的关联记录
                await this.db.query('DELETE FROM image_tags WHERE imageId = ?', [id]);

                // 2. 删除图片记录
                const query = `DELETE FROM ${this.tableName} WHERE id = ?`;
                const [result] = await this.db.query(query, [id]);

                if (result.affectedRows === 0) {
                    throw new Error(`${this.tableName} with ID ${id} not found`);
                }

                // 提交事务
                await this.db.query('COMMIT');

                return { success: true, message: `${this.tableName} and related tags deleted successfully` };
            } catch (error) {
                // 回滚事务
                await this.db.query('ROLLBACK');
                throw error;
            }
        } catch (error) {
            throw new Error(`Delete ${this.tableName} failed: ${error.message}`);
        }
    }

    // 重写批量删除方法，确保删除图片时也删除相关的标签关联
    async deleteByIds(ids) {
        try {
            if (!Array.isArray(ids) || ids.length === 0) {
                throw new Error('IDs array is required');
            }

            // 开始事务以确保数据一致性
            await this.db.query('START TRANSACTION');

            try {
                // 1. 先删除 image_tags 表中的关联记录
                const tagPlaceholders = ids.map(() => '?').join(',');
                await this.db.query(`DELETE FROM image_tags WHERE imageId IN (${tagPlaceholders})`, ids);

                // 2. 批量删除图片记录
                const placeholders = ids.map(() => '?').join(',');
                const query = `DELETE FROM ${this.tableName} WHERE id IN (${placeholders})`;
                const [result] = await this.db.query(query, ids);

                // 提交事务
                await this.db.query('COMMIT');

                return {
                    success: true,
                    message: `${result.affectedRows} ${this.tableName} records and related tags deleted successfully`,
                    deletedCount: result.affectedRows
                };
            } catch (error) {
                // 回滚事务
                await this.db.query('ROLLBACK');
                throw error;
            }
        } catch (error) {
            throw new Error(`Batch delete ${this.tableName} failed: ${error.message}`);
        }
    }
}

module.exports = Image;