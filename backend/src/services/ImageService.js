const BaseService = require('./BaseService');

class ImageService extends BaseService {
    constructor(imageModel, minioClient = null) {
        super(imageModel);
        this.minioClient = minioClient;
        this.minioBucketName = process.env.MINIO_BUCKET_NAME || 'tattoo';
    }

    // 重写getAll方法，包含tags信息
    async getAll(query = {}) {
        try {
            const pagination = this.normalizePaginationParams(query);
            const sort = this.normalizeSortParams(query);
            // 预处理查询参数，解析JSON字符串格式的复杂查询条件
            const preprocessedQuery = this.preprocessQueryParams(query);
            const filters = this.normalizeFilters(preprocessedQuery);

            // 构建基础查询，包含JOIN tags信息
            let baseQuery = `
                SELECT DISTINCT i.*,
                       c.name as categoryName,
                       c.slug as categorySlug,
                       s.title as styleTitle,
                       u.username as authorName
                FROM images i
                LEFT JOIN categories c ON i.categoryId = c.id
                LEFT JOIN styles s ON i.styleId = s.id
                LEFT JOIN users u ON i.userId = u.id
            `;

            const conditions = [];
            const values = [];

            // 默认只查询userId为null的图片（CMS创建的图片）
            conditions.push('i.userId IS NULL');

            // 构建过滤条件
            if (Object.keys(filters).length > 0) {
                const { where, values: filterValues } = this.buildFilterQuery(filters);
                if (where) {
                    conditions.push(where.replace('WHERE ', ''));
                    values.push(...filterValues);
                }
            }

            // 组装WHERE子句
            if (conditions.length > 0) {
                baseQuery += ` WHERE ${conditions.join(' AND ')}`;
            }

            // 添加排序
            if (sort.sortBy) {
                baseQuery += ` ${this.buildSortQuery(sort.sortBy, sort.sortOrder)}`;
            } else {
                // 默认按修改时间降序排序
                baseQuery += ` ORDER BY i.updatedAt DESC`;
            }

            // 获取总数（用于分页）
            let totalCount = 0;
            if (pagination.currentPage && pagination.pageSize) {
                let countQuery = baseQuery.replace(
                    /SELECT DISTINCT.*?FROM/s, 
                    'SELECT COUNT(DISTINCT i.id) as total FROM'
                ).replace(/ORDER BY.*$/s, '');
                
                const [countResult] = await this.model.db.execute(countQuery, values);
                totalCount = countResult[0].total;
            }

            // 添加分页
            const paginatedQuery = this.buildPaginationQuery(baseQuery, pagination.currentPage, pagination.pageSize);
            const [rows] = await this.model.db.execute(paginatedQuery, values);

            // 为每个图片获取tags信息
            const imagesWithTags = await Promise.all(rows.map(async (image) => {
                const tags = await this.model.getImageTags(image.id);
                return {
                    ...image,
                    tags: tags || []
                };
            }));

            // 构建返回结果
            const result = {
                data: imagesWithTags
            };

            // 添加分页信息（如果有分页参数）
            if (pagination.currentPage && pagination.pageSize) {
                result.pagination = {
                    currentPage: pagination.currentPage,
                    pageSize: pagination.pageSize,
                    total: totalCount,
                    totalPages: Math.ceil(totalCount / pagination.pageSize)
                };
            }

            return result;
        } catch (error) {
            throw new Error(`Get all images with tags failed: ${error.message}`);
        }
    }

    // 获取所有用户图片（有userId的图片）
    async getAllUserImages(query = {}) {
        try {
            const pagination = this.normalizePaginationParams(query);
            const sort = this.normalizeSortParams(query);
            // 预处理查询参数，解析JSON字符串格式的复杂查询条件
            const preprocessedQuery = this.preprocessQueryParams(query);
            const filters = this.normalizeFilters(preprocessedQuery);

            // 构建基础查询，按batchId分组，选择每个批次的代表图片
            let baseQuery = `
                SELECT
                    ANY_VALUE(i.id) as id,
                    ANY_VALUE(i.name) as name,
                    ANY_VALUE(i.slug) as slug,
                    ANY_VALUE(i.tattooUrl) as tattooUrl,
                    ANY_VALUE(i.scourceUrl) as scourceUrl,
                    ANY_VALUE(i.title) as title,
                    ANY_VALUE(i.description) as description,
                    ANY_VALUE(i.type) as type,
                    ANY_VALUE(i.styleId) as styleId,
                    ANY_VALUE(i.isColor) as isColor,
                    ANY_VALUE(i.isPublic) as isPublic,
                    ANY_VALUE(i.isOnline) as isOnline,
                    ANY_VALUE(i.hotness) as hotness,
                    ANY_VALUE(i.prompt) as prompt,
                    i.batchId,
                    ANY_VALUE(i.userId) as userId,
                    ANY_VALUE(i.categoryId) as categoryId,
                    ANY_VALUE(i.additionalInfo) as additionalInfo,
                    ANY_VALUE(i.createdAt) as createdAt,
                    ANY_VALUE(i.updatedAt) as updatedAt,
                    ANY_VALUE(COALESCE(c.name->'$.en', c.name->'$.zh')) as categoryName,
                    ANY_VALUE(c.slug) as categorySlug,
                    ANY_VALUE(COALESCE(s.title->'$.en', s.title->'$.zh')) as styleTitle,
                    ANY_VALUE(u.username) as authorName,
                    ANY_VALUE(u.email) as authorEmail,
                    (SELECT COUNT(*) FROM images WHERE batchId = i.batchId AND userId IS NOT NULL) as batchCount,
                    (SELECT GROUP_CONCAT(DISTINCT tattooUrl ORDER BY createdAt SEPARATOR ',') FROM images WHERE batchId = i.batchId AND userId IS NOT NULL) as batchImageUrls
                FROM images i
                LEFT JOIN categories c ON i.categoryId = c.id
                LEFT JOIN styles s ON i.styleId = s.id
                LEFT JOIN users u ON i.userId = u.id
            `;

            const conditions = [];
            const values = [];

            // 默认只查询userId不为null的图片（用户创建的图片）
            conditions.push('i.userId IS NOT NULL');

            // 构建过滤条件
            if (Object.keys(filters).length > 0) {
                const { where, values: filterValues } = this.buildUserImageFilterQuery(filters);
                if (where) {
                    conditions.push(where.replace('WHERE ', ''));
                    values.push(...filterValues);
                }
            }

            // 组装WHERE子句
            if (conditions.length > 0) {
                baseQuery += ` WHERE ${conditions.join(' AND ')}`;
            }

            // 按batchId分组
            baseQuery += ` GROUP BY i.batchId`;

            // 添加排序
            if (sort.sortBy) {
                baseQuery += ` ${this.buildGroupBySortQuery(sort.sortBy, sort.sortOrder)}`;
            } else {
                // 默认按修改时间降序排序（使用MAX聚合函数）
                baseQuery += ` ORDER BY MAX(i.updatedAt) DESC`;
            }

            // 获取总数（用于分页）- 按批次统计
            let totalCount = 0;
            if (pagination.currentPage && pagination.pageSize) {
                let countQuery = `
                    SELECT COUNT(DISTINCT i.batchId) as total
                    FROM images i
                    LEFT JOIN categories c ON i.categoryId = c.id
                    LEFT JOIN styles s ON i.styleId = s.id
                    LEFT JOIN users u ON i.userId = u.id
                `;

                if (conditions.length > 0) {
                    countQuery += ` WHERE ${conditions.join(' AND ')}`;
                }

                const [countResult] = await this.model.db.execute(countQuery, values);
                totalCount = countResult[0].total;
            }

            // 添加分页
            const paginatedQuery = this.buildPaginationQuery(baseQuery, pagination.currentPage, pagination.pageSize);

            console.log('User images query:', paginatedQuery);
            console.log('Query values:', values);

            const [rows] = await this.model.db.execute(paginatedQuery, values);

            console.log('Sample row from user images query:', JSON.stringify(rows[0], null, 2));

            // 为每个图片获取tags信息并处理批次数据
            const imagesWithTags = await Promise.all(rows.map(async (image) => {
                const tags = await this.model.getImageTags(image.id);

                // 处理批次图片URL列表
                const batchImageUrls = image.batchImageUrls ? image.batchImageUrls.split(',') : [image.tattooUrl];

                return {
                    ...image,
                    tags,
                    batchCount: parseInt(image.batchCount) || 1,
                    batchImageUrls: batchImageUrls
                };
            }));

            const result = {
                data: imagesWithTags
            };

            if (pagination.currentPage && pagination.pageSize) {
                result.pagination = {
                    currentPage: parseInt(pagination.currentPage),
                    pageSize: parseInt(pagination.pageSize),
                    total: totalCount,
                    totalPages: Math.ceil(totalCount / pagination.pageSize)
                };
            }

            return result;
        } catch (error) {
            throw new Error(`Get all user images with tags failed: ${error.message}`);
        }
    }

    // 预处理查询参数，解析JSON字符串格式的复杂查询条件
    preprocessQueryParams(query = {}) {
        const processed = { ...query };

        // 遍历所有查询参数，尝试解析JSON字符串
        Object.entries(processed).forEach(([key, value]) => {
            if (typeof value === 'string') {
                // 检查是否是JSON字符串格式（以{开头，以}结尾）
                if (value.startsWith('{') && value.endsWith('}')) {
                    try {
                        processed[key] = JSON.parse(value);
                    } catch (error) {
                        // 如果解析失败，保持原值
                        console.warn(`Failed to parse JSON query parameter ${key}:`, value, error.message);
                    }
                }
            }
        });

        return processed;
    }

    // 专门用于用户图片查询的过滤条件构建器
    buildUserImageFilterQuery(filters = {}) {
        const conditions = [];
        const values = [];

        // 安全的操作符白名单
        const validOperators = ['=', '>', '<', '>=', '<=', '!=', '<>', 'LIKE', 'NOT LIKE', 'IS', 'IS NOT'];

        // 验证字段名，只允许字母、数字、下划线和点
        const sanitizeField = (field) => {
            if (typeof field !== 'string') return null;
            const cleanField = field.replace(/[^a-zA-Z0-9_.]/g, '');
            return cleanField === field ? field : null;
        };

        // 字段映射：前端字段名 -> 数据库字段名
        const fieldMapping = {
            'authorName': 'u.username',
            'authorEmail': 'u.email',
            'createdAtStart': 'i.createdAt',
            'createdAtEnd': 'i.createdAt'
        };

        Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                // 处理字段映射
                let fieldName = fieldMapping[key] || `i.${key}`;

                // 验证字段名
                const sanitizedKey = sanitizeField(fieldName);
                if (!sanitizedKey) return; // 跳过无效字段名

                if (Array.isArray(value)) {
                    // 数组条件 (IN)
                    const placeholders = value.map(() => '?').join(',');
                    conditions.push(`${sanitizedKey} IN (${placeholders})`);
                    values.push(...value);
                } else if (typeof value === 'object' && value.operator) {
                    // 自定义操作符 - 验证操作符安全性
                    const operatorStr = typeof value.operator === 'string' ? value.operator : String(value.operator);
                    const operator = operatorStr.toUpperCase();
                    if (validOperators.includes(operator)) {
                        // 特殊处理 IS NULL 和 IS NOT NULL
                        if (operator === 'IS' && value.value === null) {
                            conditions.push(`${sanitizedKey} IS NULL`);
                        } else if (operator === 'IS NOT' && value.value === null) {
                            conditions.push(`${sanitizedKey} IS NOT NULL`);
                        } else {
                            conditions.push(`${sanitizedKey} ${operator} ?`);
                            values.push(value.value);
                        }
                    }
                } else if (typeof value === 'string' && value.includes('*')) {
                    // 模糊查询
                    conditions.push(`${sanitizedKey} LIKE ?`);
                    values.push(value.replace(/\*/g, '%'));
                } else {
                    // 特殊处理时间范围查询
                    if (key === 'createdAtStart') {
                        conditions.push(`${sanitizedKey} >= ?`);
                        values.push(value);
                    } else if (key === 'createdAtEnd') {
                        conditions.push(`${sanitizedKey} <= ?`);
                        values.push(value);
                    } else if (key === 'authorName' || key === 'authorEmail') {
                        // 模糊匹配用户名和邮箱
                        conditions.push(`${sanitizedKey} LIKE ?`);
                        values.push(`%${value}%`);
                    } else {
                        // 精确匹配
                        conditions.push(`${sanitizedKey} = ?`);
                        values.push(value);
                    }
                }
            }
        });

        return {
            where: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
            values
        };
    }

    // 辅助方法：构建过滤条件
    buildFilterQuery(filters = {}) {
        const conditions = [];
        const values = [];

        // 安全的操作符白名单
        const validOperators = ['=', '>', '<', '>=', '<=', '!=', '<>', 'LIKE', 'NOT LIKE', 'IS', 'IS NOT'];

        // 验证字段名，只允许字母、数字、下划线和点
        const sanitizeField = (field) => {
            if (typeof field !== 'string') return null;
            const cleanField = field.replace(/[^a-zA-Z0-9_.]/g, '');
            return cleanField === field ? field : null;
        };

        // 多语言字段列表
        const multiLanguageFields = ['name', 'title', 'description', 'prompt'];

        Object.entries(filters).forEach(([key, value]) => {
            // 允许处理自定义操作符对象（包括IS NULL查询）
            const hasCustomOperator = typeof value === 'object' && value !== null && value.operator;
            if ((value !== undefined && value !== null && value !== '') || hasCustomOperator) {
                // 处理多语言字段的搜索
                if (multiLanguageFields.includes(key)) {
                    // 对于多语言字段，搜索英文内容（用户要求的模糊查询）
                    const searchPattern = typeof value === 'string' && value.includes('*')
                        ? value.replace(/\*/g, '%')
                        : `%${value}%`;
                    conditions.push(`i.${key}->'$.en' LIKE ?`);
                    values.push(searchPattern);
                    return;
                }

                // 处理slug字段的模糊搜索
                if (key === 'slug') {
                    const searchPattern = typeof value === 'string' && value.includes('*')
                        ? value.replace(/\*/g, '%')
                        : `%${value}%`;
                    conditions.push(`i.slug LIKE ?`);
                    values.push(searchPattern);
                    return;
                }

                // 为其他字段添加别名前缀
                const fieldName = key.includes('.') ? key : `i.${key}`;
                const sanitizedKey = sanitizeField(fieldName);
                if (!sanitizedKey) return; // 跳过无效字段名

                // 处理布尔字段的字符串转换
                const booleanFields = ['isColor', 'isPublic', 'isOnline'];
                const fieldBase = key.replace('i.', ''); // 移除前缀获取基础字段名
                let processedValue = value;

                if (booleanFields.includes(fieldBase)) {
                    // 转换字符串布尔值为数字
                    if (value === 'true' || value === true) {
                        processedValue = 1;
                    } else if (value === 'false' || value === false) {
                        processedValue = 0;
                    }
                }

                if (Array.isArray(value)) {
                    // 数组条件 (IN)
                    const placeholders = value.map(() => '?').join(',');
                    conditions.push(`${sanitizedKey} IN (${placeholders})`);
                    values.push(...value);
                } else if (typeof value === 'object' && value.operator) {
                    // 自定义操作符 - 验证操作符安全性
                    const operatorStr = typeof value.operator === 'string' ? value.operator : String(value.operator);
                    const operator = operatorStr.toUpperCase();
                    if (validOperators.includes(operator)) {
                        // 特殊处理 IS NULL 和 IS NOT NULL
                        if (operator === 'IS' && value.value === null) {
                            conditions.push(`${sanitizedKey} IS NULL`);
                        } else if (operator === 'IS NOT' && value.value === null) {
                            conditions.push(`${sanitizedKey} IS NOT NULL`);
                        } else {
                            conditions.push(`${sanitizedKey} ${operator} ?`);
                            values.push(value.value);
                        }
                    }
                } else if (typeof value === 'string' && value.includes('*')) {
                    // 模糊查询
                    conditions.push(`${sanitizedKey} LIKE ?`);
                    values.push(value.replace(/\*/g, '%'));
                } else {
                    // 精确匹配
                    conditions.push(`${sanitizedKey} = ?`);
                    values.push(processedValue);
                }
            }
        });

        return {
            where: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
            values
        };
    }

    // 辅助方法：构建分页查询
    buildPaginationQuery(baseQuery, currentPage, pageSize) {
        if (currentPage && pageSize) {
            const offset = (currentPage - 1) * pageSize;
            return `${baseQuery} LIMIT ${pageSize} OFFSET ${offset}`;
        }
        return baseQuery;
    }

    // 辅助方法：构建GROUP BY查询的排序（使用聚合函数）
    buildGroupBySortQuery(sortBy, sortOrder = 'ASC') {
        if (!sortBy) return '';
        const validOrders = ['ASC', 'DESC'];

        // 确保 sortOrder 是字符串
        const orderStr = typeof sortOrder === 'string' ? sortOrder : (Array.isArray(sortOrder) ? sortOrder[0] || 'ASC' : String(sortOrder));
        const order = validOrders.includes(orderStr.toUpperCase()) ? orderStr.toUpperCase() : 'ASC';

        // 验证字段名，只允许字母、数字、下划线和点
        const sanitizeField = (field) => {
            if (typeof field !== 'string') return null;
            const cleanField = field.replace(/[^a-zA-Z0-9_.]/g, '');
            return cleanField === field ? field : null;
        };

        // 支持多字段排序
        if (Array.isArray(sortBy)) {
            const sortFields = sortBy.map((field, index) => {
                const fieldName = field.includes('.') ? field : `i.${field}`;
                const sanitizedField = sanitizeField(fieldName);
                if (!sanitizedField) return null;
                const fieldOrder = Array.isArray(sortOrder) ? (sortOrder[index] || 'ASC') : order;
                const fieldOrderStr = typeof fieldOrder === 'string' ? fieldOrder : String(fieldOrder);
                const validOrder = validOrders.includes(fieldOrderStr.toUpperCase()) ? fieldOrderStr.toUpperCase() : 'ASC';
                // 对于GROUP BY查询，使用MAX聚合函数
                return `MAX(${sanitizedField}) ${validOrder}`;
            }).filter(Boolean);

            return sortFields.length > 0 ? `ORDER BY ${sortFields.join(', ')}` : '';
        }

        // 为字段添加别名前缀（如果没有的话）
        const fieldName = sortBy.includes('.') ? sortBy : `i.${sortBy}`;
        const sanitizedField = sanitizeField(fieldName);
        // 对于GROUP BY查询，使用MAX聚合函数
        return sanitizedField ? `ORDER BY MAX(${sanitizedField}) ${order}` : '';
    }

    // 辅助方法：构建排序查询
    buildSortQuery(sortBy, sortOrder = 'ASC') {
        if (!sortBy) return '';
        const validOrders = ['ASC', 'DESC'];
        
        // 确保 sortOrder 是字符串
        const orderStr = typeof sortOrder === 'string' ? sortOrder : (Array.isArray(sortOrder) ? sortOrder[0] || 'ASC' : String(sortOrder));
        const order = validOrders.includes(orderStr.toUpperCase()) ? orderStr.toUpperCase() : 'ASC';
        
        // 验证字段名，只允许字母、数字、下划线和点
        const sanitizeField = (field) => {
            if (typeof field !== 'string') return null;
            // 只允许字母、数字、下划线、点（用于表别名如 i.createdAt）
            const cleanField = field.replace(/[^a-zA-Z0-9_.]/g, '');
            return cleanField === field ? field : null;
        };
        
        // 支持多字段排序
        if (Array.isArray(sortBy)) {
            const sortFields = sortBy.map((field, index) => {
                // 为字段添加别名前缀（如果没有的话）
                const fieldName = field.includes('.') ? field : `i.${field}`;
                const sanitizedField = sanitizeField(fieldName);
                if (!sanitizedField) return null;
                const fieldOrder = Array.isArray(sortOrder) ? (sortOrder[index] || 'ASC') : order;
                // 确保 fieldOrder 是字符串
                const fieldOrderStr = typeof fieldOrder === 'string' ? fieldOrder : String(fieldOrder);
                const validOrder = validOrders.includes(fieldOrderStr.toUpperCase()) ? fieldOrderStr.toUpperCase() : 'ASC';
                return `${sanitizedField} ${validOrder}`;
            }).filter(Boolean);
            
            return sortFields.length > 0 ? `ORDER BY ${sortFields.join(', ')}` : '';
        }
        
        // 为字段添加别名前缀（如果没有的话）
        const fieldName = sortBy.includes('.') ? sortBy : `i.${sortBy}`;
        const sanitizedField = sanitizeField(fieldName);
        return sanitizedField ? `ORDER BY ${sanitizedField} ${order}` : '';
    }

    // 重写getById方法，返回同一batchId的所有图片
    async getById(id) {
        try {
            if (!id) {
                throw new Error('Image ID is required');
            }

            // 先获取主图片信息（包含关联信息）
            const query = `
                SELECT i.*,
                       COALESCE(c.name->'$.en', c.name->'$.zh') as categoryName,
                       c.slug as categorySlug,
                       COALESCE(s.title->'$.en', s.title->'$.zh') as styleTitle,
                       u.username as authorName,
                       u.email as authorEmail
                FROM images i
                LEFT JOIN categories c ON i.categoryId = c.id
                LEFT JOIN styles s ON i.styleId = s.id
                LEFT JOIN users u ON i.userId = u.id
                WHERE i.id = ?
            `;
            const [rows] = await this.model.db.execute(query, [id]);
            const mainImage = rows.length > 0 ? rows[0] : null;

            if (!mainImage) {
                throw new Error('Image not found');
            }

            // 如果没有batchId，只返回单张图片
            if (!mainImage.batchId) {
                const tags = await this.model.getImageTags(id);
                return {
                    ...mainImage,
                    tags: tags || [],
                    batchImages: [mainImage], // 包装成数组格式保持一致性
                    batchCount: 1
                };
            }

            // 获取同一批次的所有图片
            console.log(`Getting batch images for batchId: ${mainImage.batchId}`);
            const batchImagesResult = await this.getImagesByBatchId(mainImage.batchId);
            console.log('Batch images result:', JSON.stringify(batchImagesResult, null, 2));

            const batchImages = batchImagesResult.data || [];
            console.log(`Found ${batchImages.length} images in batch`);

            // 为每张图片获取tags信息
            const imagesWithTags = await Promise.all(batchImages.map(async (image) => {
                const tags = await this.model.getImageTags(image.id);
                return {
                    ...image,
                    tags: tags || []
                };
            }));

            console.log(`Images with tags: ${imagesWithTags.length} items`);

            // 找到当前请求的主图片作为代表
            const mainImageWithTags = imagesWithTags.find(img => img.id === id) || imagesWithTags[0];

            // 返回主图片信息 + 批次所有图片
            const result = {
                ...mainImageWithTags,
                // 确保批次图片列表在最顶层，方便前端访问
                batchImages: imagesWithTags, // 批次所有图片
                batchCount: imagesWithTags.length, // 批次图片数量
                // 额外提供图片URL列表，方便前端直接使用
                batchImageUrls: imagesWithTags.map(img => img.tattooUrl),
                // 标记这是一个批次详情
                isBatchDetail: true
            };

            console.log('Final getById result structure:');
            console.log('- Main image ID:', result.id);
            console.log('- Batch ID:', result.batchId);
            console.log('- Batch count:', result.batchCount);
            console.log('- Batch images count:', result.batchImages?.length);
            console.log('- Batch images IDs:', result.batchImages?.map(img => img.id));
            console.log('- Batch image URLs:', result.batchImageUrls);

            return result;
        } catch (error) {
            throw new Error(`Get image by ID failed: ${error.message}`);
        }
    }

    // 获取用户生成的图片
    async getUserGeneratedImages(userId, query = {}) {
        try {
            if (!userId) {
                throw new Error('User ID is required');
            }

            // 构造查询参数，添加用户ID和生成类型过滤条件
            const userGeneratedQuery = {
                ...query,
                type: 'text2image', // 只查询生成的图片
                userId: userId
            };

            // 复用getAll方法，确保返回的数据格式一致（包含关联信息）
            const result = await this.getAll(userGeneratedQuery);
            
            return this.formatResponse(true, result.data, 'User generated images retrieved successfully');
        } catch (error) {
            throw new Error(`Get user generated images failed: ${error.message}`);
        }
    }

    // 获取图片标签
    async getImageTags(imageId) {
        try {
            if (!imageId) {
                throw new Error('Image ID is required');
            }

            return await this.model.getImageTags(imageId);
        } catch (error) {
            throw new Error(`Get image tags failed: ${error.message}`);
        }
    }

    // 根据批次ID获取图片
    async getImagesByBatchId(batchId, query = {}) {
        try {
            if (!batchId) {
                throw new Error('Batch ID is required');
            }

            const pagination = this.normalizePaginationParams(query);
            const sort = this.normalizeSortParams(query);
            const filters = this.normalizeFilters(query);

            // 构建包含样式信息的查询
            let baseQuery = `
                SELECT i.*,
                       COALESCE(c.name->'$.en', c.name->'$.zh') as categoryName,
                       c.slug as categorySlug,
                       COALESCE(s.title->'$.en', s.title->'$.zh') as styleTitle,
                       u.username as authorName,
                       u.email as authorEmail
                FROM images i
                LEFT JOIN categories c ON i.categoryId = c.id
                LEFT JOIN styles s ON i.styleId = s.id
                LEFT JOIN users u ON i.userId = u.id
                WHERE i.batchId = ?
            `;

            const values = [batchId];

            // 构建额外的过滤条件
            if (Object.keys(filters).length > 0) {
                const { where, values: filterValues } = this.buildFilterQuery(filters);
                if (where) {
                    baseQuery += ` AND ${where.replace('WHERE ', '')}`;
                    values.push(...filterValues);
                }
            }

            // 添加排序
            if (sort.sortBy) {
                baseQuery += ` ${this.buildSortQuery(sort.sortBy, sort.sortOrder)}`;
            } else {
                baseQuery += ` ORDER BY i.createdAt ASC`;
            }

            // 获取总数
            let totalCount = 0;
            if (pagination.currentPage && pagination.pageSize) {
                let countQuery = `
                    SELECT COUNT(*) as total
                    FROM images i
                    LEFT JOIN categories c ON i.categoryId = c.id
                    LEFT JOIN styles s ON i.styleId = s.id
                    LEFT JOIN users u ON i.userId = u.id
                    WHERE i.batchId = ?
                `;

                let countValues = [batchId];

                if (Object.keys(filters).length > 0) {
                    const { where, values: filterValues } = this.buildFilterQuery(filters);
                    if (where) {
                        countQuery += ` AND ${where.replace('WHERE ', '')}`;
                        countValues.push(...filterValues);
                    }
                }

                const [countResult] = await this.model.db.execute(countQuery, countValues);
                totalCount = countResult[0].total;
            }

            // 添加分页
            const paginatedQuery = this.buildPaginationQuery(baseQuery, pagination.currentPage, pagination.pageSize);
            const [rows] = await this.model.db.execute(paginatedQuery, values);

            const result = {
                data: rows
            };

            if (pagination.currentPage && pagination.pageSize) {
                result.pagination = {
                    currentPage: pagination.currentPage,
                    pageSize: pagination.pageSize,
                    total: totalCount,
                    totalPages: Math.ceil(totalCount / pagination.pageSize)
                };
            }

            return result;
        } catch (error) {
            throw new Error(`Get images by batch ID failed: ${error.message}`);
        }
    }

    // 根据批次ID删除所有图片
    async deleteByBatchId(batchId, userId = null) {
        try {
            if (!batchId) {
                throw new Error('Batch ID is required');
            }

            // 首先获取要删除的图片列表（用于权限检查和文件清理）
            const imagesResult = await this.getImagesByBatchId(batchId);
            const images = imagesResult.data || [];

            if (images.length === 0) {
                return this.formatResponse(false, null, 'No images found for this batch ID');
            }

            // 如果提供了用户ID，检查权限（只能删除自己的图片）
            if (userId) {
                const unauthorizedImages = images.filter(img => img.userId !== userId);
                if (unauthorizedImages.length > 0) {
                    throw new Error('Unauthorized: You can only delete your own images');
                }
            }

            // 执行批次删除
            const deleteResult = await this.model.deleteByBatchId(batchId);
            
            // 删除本地文件（如果存在）
            await this.cleanupLocalFiles(images);

            return this.formatResponse(
                true, 
                {
                    deletedCount: deleteResult.affectedRows || deleteResult.deletedCount || images.length,
                    batchId: batchId,
                    deletedImages: images.map(img => ({ id: img.id, filename: img.name }))
                }, 
                `Successfully deleted ${images.length} images from batch ${batchId}`
            );
        } catch (error) {
            throw new Error(`Delete images by batch ID failed: ${error.message}`);
        }
    }

    // 重写create方法，处理tagIds
    async create(data) {
        try {
            const { tagIds, ...imageData } = data;

            // 检查是否是Replicate图片URL，如果是则下载保存到Minio
            if (imageData.tattooUrl && this.isReplicateUrl(imageData.tattooUrl)) {
                console.log('Detected Replicate URL, downloading and saving to Minio...');

                // 导入ImageGenerateService来使用downloadAndSaveImages方法
                const ImageGenerateService = require('./ImageGenerateService');
                const imageGenerateService = new ImageGenerateService();

                try {
                    // 生成ID用于下载保存
                    const generationId = imageGenerateService.generateId();
                    const batchId = imageGenerateService.generateId();

                    // 下载并保存到Minio
                    const savedImages = await imageGenerateService.downloadAndSaveImages(
                        [imageData.tattooUrl],
                        generationId,
                        batchId,
                        imageData.slug, // 传递slug
                        imageData.name?.en // 传递英文名称
                    );

                    if (savedImages.length > 0 && !savedImages[0].error) {
                        // 使用Minio路径替换原URL
                        imageData.tattooUrl = savedImages[0].minioPath;
                        console.log(`Replicate image saved to Minio: ${imageData.tattooUrl}`);
                    } else {
                        console.error('Failed to save Replicate image:', savedImages[0]?.error);
                        // 保存失败仍继续，使用原URL
                    }

                    // 将batchId添加到图片数据中
                    imageData.batchId = batchId;
                } catch (downloadError) {
                    console.error('Error downloading Replicate image:', downloadError.message);
                    // 下载失败仍继续，使用原URL
                }
            }

            // 如果没有batchId，为所有图片生成一个默认的batchId
            if (!imageData.batchId) {
                const ImageGenerateService = require('./ImageGenerateService');
                const imageGenerateService = new ImageGenerateService();
                imageData.batchId = imageGenerateService.generateId();
            }

            // 创建图片记录
            const result = await super.create(imageData);
            console.log('Create image result:', result);

            // 如果有tagIds，添加标签关联
            if (tagIds && Array.isArray(tagIds) && tagIds.length > 0) {
                console.log('Processing tagIds:', tagIds);
                console.log('result.insertId:', result.insertId);
                console.log('result.id:', result.id);
                const imageId = result.insertId || result.id;
                if (imageId) {
                    console.log('Adding tags to image:', imageId, tagIds);
                    await this.model.addTags(imageId, tagIds);
                    console.log('Tags added successfully');
                } else {
                    console.warn('No imageId found in result, cannot add tags');
                }
            } else {
                console.log('No tagIds to process:', { tagIds, hasArray: Array.isArray(tagIds), length: tagIds?.length });
            }

            return result;
        } catch (error) {
            throw new Error(`Create image failed: ${error.message}`);
        }
    }

    // 检查是否是Replicate URL
    isReplicateUrl(url) {
        return url && url.includes('replicate.delivery');
    }

    // 重写update方法，处理tagIds
    async update(id, data) {
        try {
            const { tagIds, ...imageData } = data;

            // 获取现有图片数据以比较tattooUrl
            const existingImage = await this.getById(id);
            if (!existingImage) {
                throw new Error('Image not found');
            }

            // 只有当tattooUrl与现有的不同时才处理
            if (imageData.tattooUrl && imageData.tattooUrl !== existingImage.tattooUrl) {
                // 检查是否是Replicate图片URL，如果是则下载保存到Minio
                if (this.isReplicateUrl(imageData.tattooUrl)) {
                    console.log('Detected Replicate URL in update, downloading and saving to Minio...');

                    // 导入ImageGenerateService来使用downloadAndSaveImages方法
                    const ImageGenerateService = require('./ImageGenerateService');
                    const imageGenerateService = new ImageGenerateService();

                    try {
                        // 生成ID用于下载保存
                        const generationId = imageGenerateService.generateId();
                        const batchId = imageGenerateService.generateId();

                        // 下载并保存到Minio
                        const savedImages = await imageGenerateService.downloadAndSaveImages(
                            [imageData.tattooUrl],
                            generationId,
                            batchId,
                            imageData.slug, // 传递slug
                            imageData.name?.en // 传递英文名称
                        );

                        if (savedImages.length > 0 && !savedImages[0].error) {
                            // 使用Minio路径替换原URL
                            imageData.tattooUrl = savedImages[0].minioPath;
                            console.log(`Replicate image saved to Minio: ${imageData.tattooUrl}`);
                        } else {
                            console.error('Failed to save Replicate image:', savedImages[0]?.error);
                            // 保存失败仍继续，使用原URL
                        }

                        // 将batchId添加到图片数据中
                        imageData.batchId = batchId;
                    } catch (downloadError) {
                        console.error('Error downloading Replicate image:', downloadError.message);
                        // 下载失败仍继续，使用原URL
                    }
                }
            } else if (imageData.tattooUrl === existingImage.tattooUrl) {
                // 如果tattooUrl相同，不需要更新，从数据中移除避免不必要的处理
                delete imageData.tattooUrl;
            }

            // 更新图片记录
            const result = await super.update(id, imageData);

            // 如果有tagIds参数，更新标签关联
            if (tagIds !== undefined) {
                if (Array.isArray(tagIds)) {
                    await this.model.addTags(id, tagIds);
                } else {
                    // 如果tagIds为null或其他值，清空所有标签
                    await this.model.addTags(id, []);
                }
            }

            return result;
        } catch (error) {
            throw new Error(`Update image failed: ${error.message}`);
        }
    }

    // 清理本地文件
    async cleanupLocalFiles(images) {
        const fs = require('fs');
        const path = require('path');
        
        for (const image of images) {
            try {
                // 尝试从 additionalInfo 中获取文件路径
                if (image.additionalInfo) {
                    let additionalInfo;
                    try {
                        additionalInfo = typeof image.additionalInfo === 'string' 
                            ? JSON.parse(image.additionalInfo) 
                            : image.additionalInfo;
                    } catch (e) {
                        console.warn(`Failed to parse additionalInfo for image ${image.id}`);
                        continue;
                    }

                    // 构建文件路径
                    const generatedDir = process.env.GENERATED_IMAGES_DIR || 'generated';
                    const uploadDir = path.join(__dirname, `../../uploads/${generatedDir}`);
                    
                    // 尝试多种可能的文件名格式
                    const possibleFilenames = [
                        `${image.batchId}_${additionalInfo.generationId}_0.png`,
                        `${additionalInfo.generationId}_0.png`,
                        path.basename(image.tattooUrl || '')
                    ].filter(Boolean);

                    for (const filename of possibleFilenames) {
                        const filepath = path.join(uploadDir, filename);
                        if (fs.existsSync(filepath)) {
                            fs.unlinkSync(filepath);
                            console.log(`Deleted local file: ${filename}`);
                            break; // 找到并删除了文件，跳出循环
                        }
                    }
                }
            } catch (error) {
                console.error(`Failed to delete local file for image ${image.id}:`, error.message);
                // 继续处理其他文件，不中断整个过程
            }
        }
    }

    // 从MinIO删除文件
    async deleteFromMinio(tattooUrl) {
        if (!this.minioClient || !tattooUrl) {
            return false;
        }

        try {
            // 检查是否是MinIO路径（images/开头）
            if (tattooUrl.startsWith('images/')) {
                // 提取ObjectName（去掉images/前缀）
                const objectName = tattooUrl.substring(7); // 去掉'images/'

                console.log(`Deleting from MinIO: ${objectName}`);
                await this.minioClient.removeObject(this.minioBucketName, objectName);
                console.log(`Successfully deleted from MinIO: ${objectName}`);
                return true;
            } else {
                console.log(`Skipping MinIO deletion for non-MinIO path: ${tattooUrl}`);
                return false;
            }
        } catch (error) {
            console.error(`Failed to delete from MinIO: ${tattooUrl}`, error.message);
            return false;
        }
    }

    // 重写delete方法，同时删除MinIO文件
    async delete(id) {
        try {
            if (!id) {
                throw new Error('ID is required');
            }

            // 先获取图片信息
            const image = await this.model.findById(id);
            if (!image) {
                throw new Error('Image not found');
            }

            // 删除MinIO文件（如果是MinIO存储的）
            if (image.tattooUrl) {
                await this.deleteFromMinio(image.tattooUrl);
            }

            // 删除数据库记录
            const result = await this.model.deleteById(id);

            console.log(`Successfully deleted image ${id} and its files`);
            return result;
        } catch (error) {
            throw new Error(`Delete image failed: ${error.message}`);
        }
    }

    // 重写批量删除方法
    async batchDelete(ids) {
        try {
            if (!Array.isArray(ids) || ids.length === 0) {
                throw new Error('IDs array is required');
            }

            // 先获取所有图片信息
            const images = await Promise.all(
                ids.map(id => this.model.findById(id).catch(() => null))
            );

            // 删除MinIO文件
            for (const image of images) {
                if (image && image.tattooUrl) {
                    await this.deleteFromMinio(image.tattooUrl);
                }
            }

            // 删除数据库记录
            const result = await this.model.deleteByIds(ids);

            console.log(`Successfully batch deleted ${ids.length} images and their files`);
            return result;
        } catch (error) {
            throw new Error(`Batch delete images failed: ${error.message}`);
        }
    }
}

module.exports = ImageService;