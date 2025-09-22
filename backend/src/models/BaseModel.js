const { v4: uuidv4 } = require('uuid');

class BaseModel {
    constructor(db, tableName) {
        this.db = db;
        this.tableName = tableName;
    }

    // 分页查询构建器
    buildPaginationQuery(baseQuery, currentPage, pageSize) {
        if (currentPage && pageSize) {
            const offset = (currentPage - 1) * pageSize;
            return `${baseQuery} LIMIT ${pageSize} OFFSET ${offset}`;
        }
        return baseQuery;
    }

    // 排序构建器
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
                const sanitizedField = sanitizeField(field);
                if (!sanitizedField) return null;
                const fieldOrder = Array.isArray(sortOrder) ? (sortOrder[index] || 'ASC') : order;
                // 确保 fieldOrder 是字符串
                const fieldOrderStr = typeof fieldOrder === 'string' ? fieldOrder : String(fieldOrder);
                const validOrder = validOrders.includes(fieldOrderStr.toUpperCase()) ? fieldOrderStr.toUpperCase() : 'ASC';
                return `${sanitizedField} ${validOrder}`;
            }).filter(Boolean);
            
            return sortFields.length > 0 ? `ORDER BY ${sortFields.join(', ')}` : '';
        }
        
        const sanitizedField = sanitizeField(sortBy);
        return sanitizedField ? `ORDER BY ${sanitizedField} ${order}` : '';
    }

    // 过滤条件构建器
    buildFilterQuery(filters = {}) {
        const conditions = [];
        const values = [];

        // 安全的操作符白名单
        const validOperators = ['=', '>', '<', '>=', '<=', '!=', '<>', 'LIKE', 'NOT LIKE'];

        // 验证字段名，只允许字母、数字、下划线和点
        const sanitizeField = (field) => {
            if (typeof field !== 'string') return null;
            const cleanField = field.replace(/[^a-zA-Z0-9_.]/g, '');
            return cleanField === field ? field : null;
        };

        Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                // 特殊处理时间范围查询
                if (key === 'createdAtRange') {
                    if (value.start) {
                        conditions.push(`createdAt >= ?`);
                        values.push(value.start);
                    }
                    if (value.end) {
                        conditions.push(`createdAt <= ?`);
                        values.push(value.end);
                    }
                    return;
                }

                const sanitizedKey = sanitizeField(key);
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
                        conditions.push(`${sanitizedKey} ${operator} ?`);
                        values.push(value.value);
                    }
                } else if (typeof value === 'string' && value.includes('*')) {
                    // 模糊查询
                    conditions.push(`${sanitizedKey} LIKE ?`);
                    values.push(value.replace(/\*/g, '%'));
                } else if (typeof value === 'string') {
                    // 对于title字段，同时搜索JSON中的en和zh字段
                    if (sanitizedKey === 'title') {
                        conditions.push(`(JSON_UNQUOTE(JSON_EXTRACT(${sanitizedKey}, '$.en')) LIKE ? OR JSON_UNQUOTE(JSON_EXTRACT(${sanitizedKey}, '$.zh')) LIKE ?)`);
                        values.push(`%${value}%`, `%${value}%`);
                    } else {
                        // 普通字符串字段使用模糊匹配
                        conditions.push(`${sanitizedKey} LIKE ?`);
                        values.push(`%${value}%`);
                    }
                } else {
                    // 精确匹配
                    conditions.push(`${sanitizedKey} = ?`);
                    values.push(value);
                }
            }
        });

        return {
            where: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
            values
        };
    }

    // 创建记录
    async create(data) {
        try {
            if (!data.id) {
                data.id = uuidv4();
            }

            const fields = Object.keys(data);
            const placeholders = fields.map(() => '?').join(',');
            const values = fields.map(field => data[field]);

            const query = `INSERT INTO ${this.tableName} (${fields.join(',')}) VALUES (${placeholders})`;
            const [result] = await this.db.execute(query, values);

            // 返回插入结果和记录数据
            const record = await this.findById(data.id);
            return {
                ...record,
                insertId: data.id, // 使用UUID作为insertId
                affectedRows: result.affectedRows
            };
        } catch (error) {
            throw new Error(`Create ${this.tableName} failed: ${error.message}`);
        }
    }

    // 根据ID查找
    async findById(id) {
        try {
            const query = `SELECT * FROM ${this.tableName} WHERE id = ?`;
            const [rows] = await this.db.execute(query, [id]);
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            throw new Error(`Find ${this.tableName} by ID failed: ${error.message}`);
        }
    }

    // 查找所有记录（支持分页、排序、过滤）
    async findAll(options = {}) {
        try {
            const { currentPage, pageSize, sortBy, sortOrder, filters = {} } = options;

            // 构建过滤条件
            const { where, values } = this.buildFilterQuery(filters);

            // 构建基础查询
            let baseQuery = `SELECT * FROM ${this.tableName} ${where}`;

            // 添加排序
            if (sortBy) {
                baseQuery += ` ${this.buildSortQuery(sortBy, sortOrder)}`;
            }

            // 添加分页
            const query = this.buildPaginationQuery(baseQuery, currentPage, pageSize);
            const [rows] = await this.db.execute(query, values);

            // 获取总数
            const countQuery = `SELECT COUNT(*) as total FROM ${this.tableName} ${where}`;
            const [countResult] = await this.db.execute(countQuery, values);
            const total = countResult[0].total;

            const result = {
                data: rows
            };

            // 总是返回分页信息，如果没有提供分页参数则使用默认值
            if (currentPage && pageSize) {
                result.pagination = {
                    currentPage: parseInt(currentPage),
                    pageSize: parseInt(pageSize),
                    total,
                    totalPages: Math.ceil(total / pageSize)
                };
            } else {
                // 没有分页参数时，返回基本的分页信息
                result.pagination = {
                    currentPage: 1,
                    pageSize: total, // 显示所有数据
                    total,
                    totalPages: 1
                };
            }

            return result;
        } catch (error) {
            throw new Error(`Find all ${this.tableName} failed: ${error.message}`);
        }
    }

    // 更新记录
    async updateById(id, data) {
        try {
            // 移除不应更新的字段
            const updateData = { ...data };
            delete updateData.id;
            delete updateData.createdAt;
            
            // 设置更新时间
            updateData.updatedAt = new Date();

            const fields = Object.keys(updateData);
            if (fields.length === 0) {
                return await this.findById(id);
            }

            const setClause = fields.map(field => `${field} = ?`).join(',');
            const values = fields.map(field => updateData[field]);
            values.push(id);

            const query = `UPDATE ${this.tableName} SET ${setClause} WHERE id = ?`;
            const [result] = await this.db.execute(query, values);

            if (result.affectedRows === 0) {
                throw new Error(`${this.tableName} with ID ${id} not found`);
            }

            return await this.findById(id);
        } catch (error) {
            throw new Error(`Update ${this.tableName} failed: ${error.message}`);
        }
    }

    // 删除记录
    async deleteById(id) {
        try {
            const query = `DELETE FROM ${this.tableName} WHERE id = ?`;
            const [result] = await this.db.query(query, [id]);

            if (result.affectedRows === 0) {
                throw new Error(`${this.tableName} with ID ${id} not found`);
            }

            return { success: true, message: `${this.tableName} deleted successfully` };
        } catch (error) {
            throw new Error(`Delete ${this.tableName} failed: ${error.message}`);
        }
    }

    // 批量删除
    async deleteByIds(ids) {
        try {
            if (!Array.isArray(ids) || ids.length === 0) {
                throw new Error('IDs array is required');
            }

            const placeholders = ids.map(() => '?').join(',');
            const query = `DELETE FROM ${this.tableName} WHERE id IN (${placeholders})`;
            const [result] = await this.db.query(query, ids);

            return { 
                success: true, 
                message: `${result.affectedRows} ${this.tableName} records deleted successfully`,
                deletedCount: result.affectedRows
            };
        } catch (error) {
            throw new Error(`Batch delete ${this.tableName} failed: ${error.message}`);
        }
    }

    // 统计查询
    async count(filters = {}) {
        try {
            const { where, values } = this.buildFilterQuery(filters);
            const query = `SELECT COUNT(*) as total FROM ${this.tableName} ${where}`;
            const [rows] = await this.db.execute(query, values);
            return rows[0].total;
        } catch (error) {
            throw new Error(`Count ${this.tableName} failed: ${error.message}`);
        }
    }
}

module.exports = BaseModel;