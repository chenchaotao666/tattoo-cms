const BaseService = require('./BaseService');

class StyleService extends BaseService {
    constructor(model, uploadService = null) {
        super(model);
        this.uploadService = uploadService;
    }

    // 重写getAll方法，支持对title.en字段的模糊搜索
    async getAll(query = {}) {
        try {
            const pagination = this.normalizePaginationParams(query);
            const sort = this.normalizeSortParams(query);
            const filters = this.normalizeFilters(query);

            // 构建基础查询
            let baseQuery = `
                SELECT * FROM ${this.model.tableName}
            `;

            const conditions = [];
            const values = [];

            // 构建过滤条件，特殊处理title字段
            if (Object.keys(filters).length > 0) {
                Object.entries(filters).forEach(([key, value]) => {
                    if (value !== undefined && value !== null && value !== '') {
                        if (key === 'title') {
                            // 对title字段进行特殊处理，搜索英文内容
                            conditions.push(`title->'$.en' LIKE ?`);
                            values.push(`%${value}%`);
                        } else {
                            // 其他字段使用默认处理
                            const { where, values: filterValues } = this.model.buildFilterQuery({ [key]: value });
                            if (where) {
                                conditions.push(where.replace('WHERE ', ''));
                                values.push(...filterValues);
                            }
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
                baseQuery += ` ${this.buildSortQuery(sort.sortBy, sort.sortOrder)}`;
            } else {
                // 默认按排序字段升序，然后按修改时间降序排序
                baseQuery += ` ORDER BY sortOrder ASC, updatedAt DESC`;
            }

            // 获取总数（用于分页）
            let totalCount = 0;
            if (pagination.currentPage && pagination.pageSize) {
                let countQuery = baseQuery.replace(
                    /SELECT \* FROM/,
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
            throw new Error(`Get all styles failed: ${error.message}`);
        }
    }

    // 构建排序查询
    buildSortQuery(sortBy, sortOrder = 'ASC') {
        const allowedSortFields = ['createdAt', 'updatedAt', 'title', 'sortOrder'];
        if (!allowedSortFields.includes(sortBy)) {
            return '';
        }

        const order = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

        // 对title字段进行特殊处理
        if (sortBy === 'title') {
            return `ORDER BY title->'$.en' ${order}`;
        }

        return `ORDER BY ${sortBy} ${order}`;
    }

    // 判断是否需要删除旧图片
    shouldDeleteOldImage(oldImageUrl, newImageUrl) {
        console.log('=== StyleService shouldDeleteOldImage 判断逻辑 ===');

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
        if (!imageUrl) return null;

        // 处理相对路径格式: images/cms/filename
        if (imageUrl.startsWith('images/')) {
            return imageUrl.replace('images/', '');
        }

        // 处理完整URL格式
        if (imageUrl.includes('/')) {
            const parts = imageUrl.split('/');
            // 寻找包含cms的部分
            const cmsIndex = parts.findIndex(part => part === 'cms');
            if (cmsIndex !== -1 && cmsIndex < parts.length - 1) {
                return parts.slice(cmsIndex).join('/');
            }
        }

        return null;
    }

    // 删除单个样式（重写父类方法）
    async delete(id) {
        try {
            if (!id) {
                throw new Error('ID is required');
            }

            // 先获取样式信息，检查是否有图片需要删除
            const style = await this.model.findById(id);
            if (!style) {
                throw new Error('Style not found');
            }

            // 如果有图片且uploadService可用，先删除图片
            if (style.imageUrl && this.uploadService) {
                const objectName = this.extractObjectNameFromUrl(style.imageUrl);
                if (objectName) {
                    try {
                        const deleteResult = await this.uploadService.deleteImage(objectName);
                        if (!deleteResult.success) {
                            console.warn(`Failed to delete image ${objectName}: ${deleteResult.message}`);
                        }
                    } catch (error) {
                        console.warn(`Error deleting image ${objectName}:`, error.message);
                        // 继续删除样式，即使图片删除失败
                    }
                }
            }

            // 删除数据库记录
            return await this.model.deleteById(id);
        } catch (error) {
            throw new Error(`Delete style failed: ${error.message}`);
        }
    }

    // 批量删除样式（重写父类方法）
    async batchDelete(ids) {
        try {
            if (!Array.isArray(ids) || ids.length === 0) {
                throw new Error('IDs array is required');
            }

            // 如果有uploadService，先获取所有样式的图片信息并删除
            if (this.uploadService) {
                const placeholders = ids.map(() => '?').join(',');
                const query = `SELECT id, imageUrl FROM ${this.model.tableName} WHERE id IN (${placeholders})`;
                const [styles] = await this.model.db.execute(query, ids);

                // 删除所有相关图片
                for (const style of styles) {
                    if (style.imageUrl) {
                        const objectName = this.extractObjectNameFromUrl(style.imageUrl);
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
            throw new Error(`Batch delete styles failed: ${error.message}`);
        }
    }

    // 更新样式时的特殊处理（添加图片更换逻辑）
    async update(id, data) {
        try {
            // 先获取现有样式信息
            const existingStyle = await this.model.findById(id);
            if (!existingStyle) {
                throw new Error('Style not found');
            }

            // 处理示例图片更换
            if (data.hasOwnProperty('imageUrl')) {
                const oldImageUrl = existingStyle.imageUrl;
                const newImageUrl = data.imageUrl;

                console.log('=== 样式图片更新调试信息 ===');
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
                            console.log('开始删除样式图片:', oldObjectName);
                            const deleteResult = await this.uploadService.deleteImage(oldObjectName);
                            console.log('删除结果:', deleteResult);

                            if (deleteResult.success) {
                                console.log(`Successfully deleted old style image: ${oldObjectName}`);
                            } else {
                                console.warn(`Failed to delete old style image ${oldObjectName}: ${deleteResult.message}`);
                            }
                        } catch (error) {
                            console.warn(`Error deleting old style image ${oldObjectName}:`, error.message);
                            // 继续更新样式，即使旧图片删除失败
                        }
                    } else {
                        console.log('无法提取objectName，跳过删除');
                    }
                } else {
                    console.log('条件不满足，不删除图片');
                }
                console.log('=== 样式图片更新调试结束 ===');
            }

            return await this.model.updateById(id, data);
        } catch (error) {
            throw new Error(`Update style failed: ${error.message}`);
        }
    }
}

module.exports = StyleService;