class BaseService {
    constructor(model) {
        this.model = model;
    }

    // 标准化分页参数
    normalizePaginationParams(query) {
        const params = {};
        
        if (query.currentPage !== undefined) {
            params.currentPage = Math.max(1, parseInt(query.currentPage));
        }
        
        if (query.pageSize !== undefined) {
            params.pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize)));
        }
        
        return params;
    }

    // 标准化排序参数
    normalizeSortParams(query) {
        const { sortBy, sortOrder } = query;
        
        if (!sortBy) return {};

        // 支持多字段排序: sortBy=field1,field2&sortOrder=DESC,ASC
        const sortFields = Array.isArray(sortBy) ? sortBy : String(sortBy).split(',');
        const sortOrders = Array.isArray(sortOrder) ? sortOrder : String(sortOrder || 'ASC').split(',');

        return {
            sortBy: sortFields,
            sortOrder: sortOrders
        };
    }

    // 标准化过滤参数
    normalizeFilters(query) {
        const filters = {};
        
        // 排除分页和排序参数
        const excludeParams = ['currentPage', 'pageSize', 'sortBy', 'sortOrder'];
        
        Object.entries(query).forEach(([key, value]) => {
            if (!excludeParams.includes(key) && value !== undefined && value !== '') {
                filters[key] = value;
            }
        });

        return filters;
    }

    // 获取所有记录
    async getAll(query = {}) {
        try {
            const pagination = this.normalizePaginationParams(query);
            const sort = this.normalizeSortParams(query);
            const filters = this.normalizeFilters(query);

            const options = {
                ...pagination,
                ...sort,
                filters
            };

            return await this.model.findAll(options);
        } catch (error) {
            throw new Error(`Get all records failed: ${error.message}`);
        }
    }

    // 根据ID获取记录
    async getById(id) {
        try {
            if (!id) {
                throw new Error('ID is required');
            }

            const record = await this.model.findById(id);
            if (!record) {
                throw new Error('Record not found');
            }

            return record;
        } catch (error) {
            throw new Error(`Get record by ID failed: ${error.message}`);
        }
    }

    // 创建记录
    async create(data) {
        try {
            if (!data || typeof data !== 'object') {
                throw new Error('Valid data is required');
            }

            return await this.model.create(data);
        } catch (error) {
            throw new Error(`Create record failed: ${error.message}`);
        }
    }

    // 更新记录
    async update(id, data) {
        try {
            if (!id) {
                throw new Error('ID is required');
            }

            if (!data || typeof data !== 'object') {
                throw new Error('Valid data is required');
            }

            return await this.model.updateById(id, data);
        } catch (error) {
            throw new Error(`Update record failed: ${error.message}`);
        }
    }

    // 删除记录
    async delete(id) {
        try {
            if (!id) {
                throw new Error('ID is required');
            }

            return await this.model.deleteById(id);
        } catch (error) {
            throw new Error(`Delete record failed: ${error.message}`);
        }
    }

    // 批量删除
    async batchDelete(ids) {
        try {
            if (!Array.isArray(ids) || ids.length === 0) {
                throw new Error('IDs array is required');
            }

            return await this.model.deleteByIds(ids);
        } catch (error) {
            throw new Error(`Batch delete failed: ${error.message}`);
        }
    }

    // 统计记录数
    async count(query = {}) {
        try {
            const filters = this.normalizeFilters(query);
            return await this.model.count(filters);
        } catch (error) {
            throw new Error(`Count records failed: ${error.message}`);
        }
    }

    // 搜索记录
    async search(keyword, query = {}) {
        try {
            if (!keyword) {
                return await this.getAll(query);
            }

            const pagination = this.normalizePaginationParams(query);
            const sort = this.normalizeSortParams(query);
            
            const options = {
                ...pagination,
                ...sort,
                ...query
            };

            return await this.model.search(keyword, options);
        } catch (error) {
            throw new Error(`Search records failed: ${error.message}`);
        }
    }

    // 验证数据格式
    validateData(data, requiredFields = []) {
        const errors = [];

        // 检查必填字段
        requiredFields.forEach(field => {
            if (!data[field]) {
                errors.push(`${field} is required`);
            }
        });

        // 检查JSON字段格式
        ['title', 'description', 'name', 'prompt', 'content', 'excerpt', 'seoTitle', 'seoDesc', 'metaTitle', 'metaDesc'].forEach(field => {
            if (data[field] && typeof data[field] !== 'object') {
                try {
                    JSON.parse(data[field]);
                } catch (e) {
                    errors.push(`${field} must be valid JSON object`);
                }
            }
        });

        return errors;
    }

    // 提取指定语言的内容
    extractLangContent(post, lang) {
        const langFields = ['title', 'excerpt', 'content', 'metaTitle', 'metaDesc'];
        const processedPost = { ...post };

        langFields.forEach(field => {
            if (post[field] && typeof post[field] === 'object') {
                // 如果是JSON对象，提取指定语言的内容
                processedPost[field] = post[field][lang] || post[field]['en'] || '';
            } else if (typeof post[field] === 'string') {
                try {
                    // 尝试解析JSON字符串
                    const parsed = JSON.parse(post[field]);
                    processedPost[field] = parsed[lang] || parsed['en'] || '';
                } catch (e) {
                    // 如果不是JSON，保持原值
                    processedPost[field] = post[field];
                }
            }
        });

        return processedPost;
    }

    // 标准API响应格式
    formatResponse(success, data = null, message = '', errors = []) {
        return {
            status: success ? 'success' : 'error',
            message,
            data,
            ...(errors.length > 0 && { errors }),
            ...(success === false && { errorCode: errors.length > 0 ? '9002' : '9001' })
        };
    }

    // 分页响应格式
    formatPaginatedResponse(result, message = 'Data retrieved successfully') {
        if (result.pagination) {
            return {
                status: 'success',
                message,
                data: {
                    data: result.data,
                    pagination: result.pagination
                }
            };
        }

        return {
            status: 'success',
            message,
            data: result.data
        };
    }
}

module.exports = BaseService;