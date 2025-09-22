const express = require('express');

// 创建基础路由处理器
function createBaseRoutes(service, entityName) {
    const router = express.Router();

    // GET /api/{entity} - 获取所有记录（支持分页、排序、筛选）
    router.get('/', async (req, res) => {
        try {
            const result = await service.getAll(req.query);
            res.json(service.formatPaginatedResponse(result, `${entityName} retrieved successfully`));
        } catch (error) {
            console.error(`Get all ${entityName} error:`, error);
            res.status(500).json(service.formatResponse(false, null, error.message));
        }
    });

    // GET /api/{entity}/search - 搜索记录
    router.get('/search', async (req, res) => {
        try {
            const { keyword } = req.query;
            if (!keyword) {
                return res.status(400).json(service.formatResponse(false, null, 'Search keyword is required'));
            }

            const result = await service.search(keyword, req.query);
            res.json(service.formatPaginatedResponse(result, `${entityName} search completed`));
        } catch (error) {
            console.error(`Search ${entityName} error:`, error);
            res.status(500).json(service.formatResponse(false, null, error.message));
        }
    });

    // GET /api/{entity}/count - 获取记录数量
    router.get('/count', async (req, res) => {
        try {
            const count = await service.count(req.query);
            res.json(service.formatResponse(true, { count }, `${entityName} count retrieved successfully`));
        } catch (error) {
            console.error(`Count ${entityName} error:`, error);
            res.status(500).json(service.formatResponse(false, null, error.message));
        }
    });

    // GET /api/{entity}/:id - 根据ID获取单个记录
    router.get('/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const record = await service.getById(id);
            res.json(service.formatResponse(true, record, `${entityName} retrieved successfully`));
        } catch (error) {
            console.error(`Get ${entityName} by ID error:`, error);
            const statusCode = error.message.includes('not found') ? 404 : 500;
            res.status(statusCode).json(service.formatResponse(false, null, error.message));
        }
    });

    // POST /api/{entity} - 创建新记录
    router.post('/', async (req, res) => {
        try {
            const record = await service.create(req.body);
            res.status(201).json(service.formatResponse(true, record, `${entityName} created successfully`));
        } catch (error) {
            console.error(`Create ${entityName} error:`, error);
            const statusCode = error.message.includes('already exists') || error.message.includes('Validation failed') ? 400 : 500;
            res.status(statusCode).json(service.formatResponse(false, null, error.message));
        }
    });

    // PUT /api/{entity}/:id - 更新记录
    router.put('/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const record = await service.update(id, req.body);
            res.json(service.formatResponse(true, record, `${entityName} updated successfully`));
        } catch (error) {
            console.error(`Update ${entityName} error:`, error);
            const statusCode = error.message.includes('not found') ? 404 : 
                              error.message.includes('already exists') || error.message.includes('Validation failed') ? 400 : 500;
            res.status(statusCode).json(service.formatResponse(false, null, error.message));
        }
    });

    // DELETE /api/{entity}/:id - 删除记录
    router.delete('/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const result = await service.delete(id);
            res.json(service.formatResponse(true, result, `${entityName} deleted successfully`));
        } catch (error) {
            console.error(`Delete ${entityName} error:`, error);
            const statusCode = error.message.includes('not found') ? 404 : 500;
            res.status(statusCode).json(service.formatResponse(false, null, error.message));
        }
    });

    // DELETE /api/{entity}/batch - 批量删除记录
    router.delete('/batch', async (req, res) => {
        try {
            const { ids } = req.body;
            if (!Array.isArray(ids) || ids.length === 0) {
                return res.status(400).json(service.formatResponse(false, null, 'IDs array is required'));
            }

            const result = await service.batchDelete(ids);
            res.json(service.formatResponse(true, result, `${entityName} batch deleted successfully`));
        } catch (error) {
            console.error(`Batch delete ${entityName} error:`, error);
            res.status(500).json(service.formatResponse(false, null, error.message));
        }
    });

    return router;
}

// 错误处理中间件
const errorHandler = (error, req, res, next) => {
    console.error('API Error:', error);

    // 数据库错误处理
    if (error.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({
            success: false,
            message: 'Duplicate entry error',
            error: 'Record already exists'
        });
    }

    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
        return res.status(400).json({
            success: false,
            message: 'Foreign key constraint error',
            error: 'Referenced record does not exist'
        });
    }

    // 默认错误响应
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
};

// 验证中间件
const validateBody = (requiredFields = []) => {
    return (req, res, next) => {
        const missingFields = requiredFields.filter(field => !req.body[field]);
        
        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: missingFields.map(field => `${field} is required`)
            });
        }
        
        next();
    };
};

// 验证ID中间件（支持UUID和自定义格式）
const validateUUID = (req, res, next) => {
    const { id } = req.params;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const customIdRegex = /^[a-zA-Z0-9_]+$/;

    if (!uuidRegex.test(id) && !customIdRegex.test(id)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid ID format',
            error: 'ID must be a valid UUID or alphanumeric string with underscores'
        });
    }

    next();
};

module.exports = {
    createBaseRoutes,
    errorHandler,
    validateBody,
    validateUUID // Note: Now validates both UUID and custom ID formats
};