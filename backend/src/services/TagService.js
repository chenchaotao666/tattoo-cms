const BaseService = require('./BaseService');

class TagService extends BaseService {
    constructor(model) {
        super(model);
    }

    // 重写getAll方法，支持对name.en字段的模糊搜索
    async getAll(query = {}) {
        try {
            const pagination = this.normalizePaginationParams(query);
            const sort = this.normalizeSortParams(query);
            const filters = this.normalizeFilters(query);

            // 构建基础查询，包含使用统计信息
            let baseQuery = `
                SELECT t.*,
                       COUNT(it.imageId) as imageCount,
                       COUNT(CASE WHEN i.isOnline = 1 THEN 1 END) as onlineImageCount
                FROM ${this.model.tableName} t
                LEFT JOIN image_tags it ON t.id = it.tagId
                LEFT JOIN images i ON it.imageId = i.id
            `;

            const conditions = [];
            const values = [];

            // 构建过滤条件，只处理name字段
            if (Object.keys(filters).length > 0) {
                Object.entries(filters).forEach(([key, value]) => {
                    if (value !== undefined && value !== null && value !== '') {
                        if (key === 'name') {
                            // 对name字段进行特殊处理，搜索英文内容
                            conditions.push(`t.name->'$.en' LIKE ?`);
                            values.push(`%${value}%`);
                        }
                        // 其他字段忽略，因为我们只支持name字段搜索
                    }
                });
            }

            // 组装WHERE子句
            if (conditions.length > 0) {
                baseQuery += ` WHERE ${conditions.join(' AND ')}`;
            }

            // 添加GROUP BY
            baseQuery += ` GROUP BY t.id`;

            // 添加排序
            if (sort.sortBy) {
                baseQuery += ` ${this.buildSortQuery(sort.sortBy, sort.sortOrder)}`;
            } else {
                // 默认按英文名称排序
                baseQuery += ` ORDER BY t.name->'$.en' ASC`;
            }

            // 获取总数（用于分页）
            let totalCount = 0;
            if (pagination.currentPage && pagination.pageSize) {
                let countQuery = `
                    SELECT COUNT(DISTINCT t.id) as total
                    FROM ${this.model.tableName} t
                    LEFT JOIN image_tags it ON t.id = it.tagId
                    LEFT JOIN images i ON it.imageId = i.id
                `;

                if (conditions.length > 0) {
                    countQuery += ` WHERE ${conditions.join(' AND ')}`;
                }

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
            throw new Error(`Get all tags failed: ${error.message}`);
        }
    }

    // 构建排序查询
    buildSortQuery(sortBy, sortOrder = 'ASC') {
        const allowedSortFields = ['createdAt', 'updatedAt', 'name'];
        if (!allowedSortFields.includes(sortBy)) {
            return '';
        }

        const order = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

        // 对name字段进行特殊处理
        if (sortBy === 'name') {
            return `ORDER BY t.name->'$.en' ${order}`;
        }

        return `ORDER BY t.${sortBy} ${order}`;
    }
}

module.exports = TagService;