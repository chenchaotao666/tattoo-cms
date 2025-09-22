const BaseService = require('./BaseService');

class IdeaService extends BaseService {
    constructor(model) {
        super(model);
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
                // 默认按修改时间降序排序
                baseQuery += ` ORDER BY updatedAt DESC`;
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
            throw new Error(`Get all ideas failed: ${error.message}`);
        }
    }

    // 构建排序查询
    buildSortQuery(sortBy, sortOrder = 'ASC') {
        const allowedSortFields = ['createdAt', 'updatedAt', 'title'];
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
}

module.exports = IdeaService;