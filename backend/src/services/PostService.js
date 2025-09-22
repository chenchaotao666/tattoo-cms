const BaseService = require('./BaseService');

class PostService extends BaseService {
    constructor(model, uploadService = null) {
        super(model);
        this.uploadService = uploadService;
    }

    // 搜索文章（支持多语言）
    async search(keyword, options = {}) {
        try {
            const { currentPage = 1, pageSize = 20, status } = options;

            let baseQuery = `
                SELECT * FROM ${this.model.tableName}
                WHERE 1=1
            `;

            const conditions = [];
            const params = [];

            // 添加状态过滤
            if (status) {
                conditions.push('status = ?');
                params.push(status);
            }

            // 添加关键词搜索
            if (keyword) {
                conditions.push(`(title->'$.en' LIKE ?
                                OR title->'$.zh' LIKE ?
                                OR excerpt->'$.en' LIKE ?
                                OR excerpt->'$.zh' LIKE ?)`);
                const searchPattern = `%${keyword}%`;
                params.push(searchPattern, searchPattern, searchPattern, searchPattern);
            }

            if (conditions.length > 0) {
                baseQuery += ' AND ' + conditions.join(' AND ');
            }

            baseQuery += ' ORDER BY updatedAt DESC';

            // 获取总数
            const countQuery = baseQuery.replace('SELECT * FROM', 'SELECT COUNT(*) as total FROM');
            const [countResult] = await this.model.db.execute(countQuery, params);
            const total = countResult[0].total;

            // 分页查询
            const paginatedQuery = this.model.buildPaginationQuery(baseQuery, currentPage, pageSize);
            const [rows] = await this.model.db.execute(paginatedQuery, params);

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
            throw new Error(`Search posts failed: ${error.message}`);
        }
    }

    // 根据slug获取文章
    async getBySlug(slug) {
        try {
            const post = await this.model.findBySlug(slug);
            if (!post) {
                throw new Error('Post not found');
            }
            return post;
        } catch (error) {
            throw new Error(`Get post by slug failed: ${error.message}`);
        }
    }

    // 获取已发布的文章
    async getPublishedPosts(options = {}) {
        try {
            return await this.model.findPublished(options);
        } catch (error) {
            throw new Error(`Get published posts failed: ${error.message}`);
        }
    }

    // 创建文章时的特殊处理
    async create(data) {
        try {
            // 验证必填字段
            if (!data.title || (!data.title.en && !data.title.zh)) {
                throw new Error('Title is required');
            }

            // 设置默认值
            if (!data.status) {
                data.status = 'draft';
            }

            if (!data.author) {
                data.author = 'Anonymous';
            }

            // 如果发布，设置发布时间
            if (data.status === 'published' && !data.publishedAt) {
                data.publishedAt = new Date();
            }

            return await this.model.create(data);
        } catch (error) {
            throw new Error(`Create post failed: ${error.message}`);
        }
    }

    // 更新文章时的特殊处理
    async update(id, data) {
        try {
            // 先获取现有文章信息
            const existingPost = await this.model.findById(id);
            if (!existingPost) {
                throw new Error('Post not found');
            }

            // 如果状态改为已发布且没有发布时间，设置发布时间
            if (data.status === 'published') {
                if (!existingPost.publishedAt) {
                    data.publishedAt = new Date();
                }
            }

            // 处理封面图片更换
            if (data.hasOwnProperty('featuredImageUrl')) {
                const oldImageUrl = existingPost.featuredImageUrl;
                const newImageUrl = data.featuredImageUrl;

                console.log('=== 图片更新调试信息 ===');
                console.log('原始数据:', { oldImageUrl, newImageUrl });
                console.log('数据类型:', {
                    oldType: typeof oldImageUrl,
                    newType: typeof newImageUrl,
                    oldValue: JSON.stringify(oldImageUrl),
                    newValue: JSON.stringify(newImageUrl)
                });

                // 检查是否需要删除旧图片
                const shouldDeleteOldImage = this.shouldDeleteOldImage(oldImageUrl, newImageUrl);
                console.log('是否需要删除旧图片:', shouldDeleteOldImage);

                if (shouldDeleteOldImage && this.uploadService) {
                    console.log('条件满足，准备删除旧图片');
                    const oldObjectName = this.extractObjectNameFromUrl(oldImageUrl);
                    console.log('提取的objectName:', oldObjectName);

                    if (oldObjectName) {
                        try {
                            console.log('开始删除图片:', oldObjectName);
                            const deleteResult = await this.uploadService.deleteImage(oldObjectName);
                            console.log('删除结果:', deleteResult);

                            if (deleteResult.success) {
                                console.log(`Successfully deleted old image: ${oldObjectName}`);
                            } else {
                                console.warn(`Failed to delete old image ${oldObjectName}: ${deleteResult.message}`);
                            }
                        } catch (error) {
                            console.warn(`Error deleting old image ${oldObjectName}:`, error.message);
                            // 继续更新文章，即使旧图片删除失败
                        }
                    } else {
                        console.log('无法提取objectName，跳过删除');
                    }
                } else {
                    console.log('条件不满足，不删除图片');
                }
                console.log('=== 图片更新调试结束 ===');
            }

            return await this.model.updateById(id, data);
        } catch (error) {
            throw new Error(`Update post failed: ${error.message}`);
        }
    }

    // 发布文章
    async publish(id) {
        try {
            return await this.update(id, {
                status: 'published',
                publishedAt: new Date()
            });
        } catch (error) {
            throw new Error(`Publish post failed: ${error.message}`);
        }
    }

    // 取消发布文章
    async unpublish(id) {
        try {
            return await this.update(id, {
                status: 'draft'
            });
        } catch (error) {
            throw new Error(`Unpublish post failed: ${error.message}`);
        }
    }

    // 获取文章统计
    async getStats() {
        try {
            const query = `
                SELECT
                    COUNT(*) as total,
                    COUNT(CASE WHEN status = 'published' THEN 1 END) as published,
                    COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft,
                    COUNT(CASE WHEN DATE(createdAt) = CURDATE() THEN 1 END) as today
                FROM ${this.model.tableName}
            `;
            const [rows] = await this.model.db.execute(query);
            return rows[0];
        } catch (error) {
            throw new Error(`Get post stats failed: ${error.message}`);
        }
    }

    // 批量操作：发布
    async batchPublish(ids) {
        try {
            if (!Array.isArray(ids) || ids.length === 0) {
                throw new Error('IDs array is required');
            }

            const placeholders = ids.map(() => '?').join(',');
            const query = `
                UPDATE ${this.model.tableName}
                SET status = 'published',
                    publishedAt = COALESCE(publishedAt, NOW()),
                    updatedAt = NOW()
                WHERE id IN (${placeholders})
            `;
            const [result] = await this.model.db.execute(query, ids);

            return {
                success: true,
                message: `${result.affectedRows} posts published successfully`,
                affectedCount: result.affectedRows
            };
        } catch (error) {
            throw new Error(`Batch publish failed: ${error.message}`);
        }
    }

    // 批量操作：取消发布
    async batchUnpublish(ids) {
        try {
            if (!Array.isArray(ids) || ids.length === 0) {
                throw new Error('IDs array is required');
            }

            const placeholders = ids.map(() => '?').join(',');
            const query = `
                UPDATE ${this.model.tableName}
                SET status = 'draft',
                    updatedAt = NOW()
                WHERE id IN (${placeholders})
            `;
            const [result] = await this.model.db.execute(query, ids);

            return {
                success: true,
                message: `${result.affectedRows} posts unpublished successfully`,
                affectedCount: result.affectedRows
            };
        } catch (error) {
            throw new Error(`Batch unpublish failed: ${error.message}`);
        }
    }

    // 判断是否需要删除旧图片
    shouldDeleteOldImage(oldImageUrl, newImageUrl) {
        console.log('=== shouldDeleteOldImage 判断逻辑 ===');

        // 如果没有旧图片，不需要删除
        if (!oldImageUrl || oldImageUrl.trim() === '') {
            console.log('没有旧图片，不需要删除');
            return false;
        }

        // 如果新图片URL为空（null、undefined、空字符串），说明用户删除了图片
        if (!newImageUrl || newImageUrl.trim() === '') {
            console.log('新图片为空，用户删除了图片，需要删除旧图片');
            return true;
        }

        // 如果新旧图片URL不同，说明用户更换了图片
        if (oldImageUrl.trim() !== newImageUrl.trim()) {
            console.log('新旧图片不同，用户更换了图片，需要删除旧图片');
            return true;
        }

        console.log('新旧图片相同，不需要删除');
        return false;
    }

    // 从图片URL中提取objectName
    extractObjectNameFromUrl(imageUrl) {
        console.log('=== extractObjectNameFromUrl 调试 ===');
        console.log('输入imageUrl:', imageUrl, '类型:', typeof imageUrl);

        if (!imageUrl) {
            console.log('imageUrl为空，返回null');
            return null;
        }

        // 处理相对路径格式: images/cms/filename
        if (imageUrl.startsWith('images/')) {
            const result = imageUrl.replace('images/', '');
            console.log('相对路径格式，提取结果:', result);
            return result;
        }

        // 处理完整URL格式
        if (imageUrl.includes('/')) {
            const parts = imageUrl.split('/');
            console.log('URL分割结果:', parts);
            // 寻找包含cms的部分
            const cmsIndex = parts.findIndex(part => part === 'cms');
            console.log('cms索引位置:', cmsIndex);
            if (cmsIndex !== -1 && cmsIndex < parts.length - 1) {
                const result = parts.slice(cmsIndex).join('/');
                console.log('完整URL格式，提取结果:', result);
                return result;
            }
        }

        console.log('无法提取objectName，返回null');
        return null;
    }

    // 删除单个文章（重写父类方法）
    async delete(id) {
        try {
            if (!id) {
                throw new Error('ID is required');
            }

            // 先获取文章信息，检查是否有图片需要删除
            const post = await this.model.findById(id);
            if (!post) {
                throw new Error('Post not found');
            }

            // 如果有图片且uploadService可用，先删除图片
            if (post.featuredImageUrl && this.uploadService) {
                const objectName = this.extractObjectNameFromUrl(post.featuredImageUrl);
                if (objectName) {
                    try {
                        const deleteResult = await this.uploadService.deleteImage(objectName);
                        if (!deleteResult.success) {
                            console.warn(`Failed to delete image ${objectName}: ${deleteResult.message}`);
                        }
                    } catch (error) {
                        console.warn(`Error deleting image ${objectName}:`, error.message);
                        // 继续删除文章，即使图片删除失败
                    }
                }
            }

            // 删除数据库记录
            return await this.model.deleteById(id);
        } catch (error) {
            throw new Error(`Delete post failed: ${error.message}`);
        }
    }

    // 批量删除文章（重写父类方法）
    async batchDelete(ids) {
        try {
            if (!Array.isArray(ids) || ids.length === 0) {
                throw new Error('IDs array is required');
            }

            // 如果有uploadService，先获取所有文章的图片信息并删除
            if (this.uploadService) {
                const placeholders = ids.map(() => '?').join(',');
                const query = `SELECT id, featuredImageUrl FROM ${this.model.tableName} WHERE id IN (${placeholders})`;
                const [posts] = await this.model.db.execute(query, ids);

                // 删除所有相关图片
                for (const post of posts) {
                    if (post.featuredImageUrl) {
                        const objectName = this.extractObjectNameFromUrl(post.featuredImageUrl);
                        if (objectName) {
                            try {
                                const deleteResult = await this.uploadService.deleteImage(objectName);
                                if (!deleteResult.success) {
                                    console.warn(`Failed to delete image ${objectName}: ${deleteResult.message}`);
                                }
                            } catch (error) {
                                console.warn(`Error deleting image ${objectName}:`, error.message);
                                // 继续处理下一个图片
                            }
                        }
                    }
                }
            }

            // 删除数据库记录
            return await this.model.deleteByIds(ids);
        } catch (error) {
            throw new Error(`Batch delete posts failed: ${error.message}`);
        }
    }
}

module.exports = PostService;