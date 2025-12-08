const express = require('express');
const { createModels } = require('../models');
const UserService = require('../services/UserService');
const { validateBody, validateUUID } = require('./baseRoutes');
const { generateTokens, authenticateToken } = require('../middleware/auth');

const router = express.Router();

// 创建用户服务实例
function createUserRoutes(app) {
    const db = app.locals.db;
    const models = createModels(db);
    const userService = new UserService(models.User);

    // 特定路由（必须在参数化路由之前定义）

    // POST /api/users/login - 用户登录
    router.post('/login', validateBody(['email', 'password']), async (req, res) => {
        try {
            const { email, password } = req.body;
            const user = await userService.loginUser(email, password);
            
            // 生成JWT tokens
            const { accessToken, refreshToken } = generateTokens(user);
            
            const loginResponse = {
                user: user,
                accessToken: accessToken,
                refreshToken: refreshToken,
                expiresIn: '7d'
            };
            
            res.json(userService.formatResponse(true, loginResponse, 'Login successful'));
        } catch (error) {
            console.error('User login error:', error);
            const statusCode = error.message.includes('Invalid') ? 401 : 500;
            res.status(statusCode).json(userService.formatResponse(false, null, error.message));
        }
    });

    // GET /api/users/profile - 获取当前登录用户的个人资料
    router.get('/profile', authenticateToken, async (req, res) => {
        try {
            const userId = req.userId;
            const userProfile = await userService.getUserProfile(userId);
            res.json(userService.formatResponse(true, userProfile, 'User profile retrieved successfully'));
        } catch (error) {
            console.error('Get user profile error:', error);
            const statusCode = error.message.includes('not found') ? 404 : 500;
            res.status(statusCode).json(userService.formatResponse(false, null, error.message));
        }
    });

    // GET /api/users/email/:email - 根据邮箱查找用户
    router.get('/email/:email', async (req, res) => {
        try {
            const { email } = req.params;
            const user = await userService.getUserByEmail(email);
            
            if (!user) {
                return res.status(404).json(userService.formatResponse(false, null, 'User not found'));
            }
            
            res.json(userService.formatResponse(true, user, 'User retrieved successfully'));
        } catch (error) {
            console.error('Get user by email error:', error);
            res.status(500).json(userService.formatResponse(false, null, error.message));
        }
    });

    // GET /api/users/:id/stats - 获取用户统计信息
    router.get('/:id/stats', validateUUID, async (req, res) => {
        try {
            const { id } = req.params;
            const stats = await userService.getUserStats(id);

            if (!stats) {
                return res.status(404).json(userService.formatResponse(false, null, 'User not found'));
            }

            res.json(userService.formatResponse(true, stats, 'User stats retrieved successfully'));
        } catch (error) {
            console.error('Get user stats error:', error);
            res.status(500).json(userService.formatResponse(false, null, error.message));
        }
    });

    // GET /api/users/:id/recharges - 获取用户充值记录
    router.get('/:id/recharges', validateUUID, async (req, res) => {
        try {
            const { id } = req.params;
            const { currentPage = 1, pageSize = 10 } = req.query;

            // 使用充值模型查询
            const models = createModels(app.locals.db);

            const result = await models.Recharge.findByUserId(id, {
                currentPage: parseInt(currentPage),
                pageSize: parseInt(pageSize)
            });

            res.json(userService.formatPaginatedResponse(result, 'User recharges retrieved successfully'));
        } catch (error) {
            console.error('Get user recharges error:', error);
            res.status(500).json(userService.formatResponse(false, null, error.message));
        }
    });

    // POST /api/users/:id/credits - 更新用户积分
    router.post('/:id/credits', validateUUID, validateBody(['creditsChange']), async (req, res) => {
        try {
            const { id } = req.params;
            const { creditsChange } = req.body;
            
            const user = await userService.updateUserCredits(id, creditsChange);
            res.json(userService.formatResponse(true, user, 'User credits updated successfully'));
        } catch (error) {
            console.error('Update user credits error:', error);
            const statusCode = error.message.includes('not found') ? 404 : 500;
            res.status(statusCode).json(userService.formatResponse(false, null, error.message));
        }
    });

    // POST /api/users/:id/balance - 更新用户余额
    router.post('/:id/balance', validateUUID, validateBody(['balanceChange']), async (req, res) => {
        try {
            const { id } = req.params;
            const { balanceChange } = req.body;
            
            const user = await userService.updateUserBalance(id, balanceChange);
            res.json(userService.formatResponse(true, user, 'User balance updated successfully'));
        } catch (error) {
            console.error('Update user balance error:', error);
            const statusCode = error.message.includes('not found') ? 404 : 500;
            res.status(statusCode).json(userService.formatResponse(false, null, error.message));
        }
    });

    // GET /api/users/memberships/expiring - 获取即将到期的会员
    router.get('/memberships/expiring', async (req, res) => {
        try {
            const { days } = req.query;
            const users = await userService.getExpiringMemberships(parseInt(days) || 7);

            res.json(userService.formatResponse(true, users, 'Expiring memberships retrieved successfully'));
        } catch (error) {
            console.error('Get expiring memberships error:', error);
            res.status(500).json(userService.formatResponse(false, null, error.message));
        }
    });

    // PATCH /api/users/batch/role - 批量更新用户角色
    router.patch('/batch/role', validateBody(['userIds', 'role']), async (req, res) => {
        try {
            const { userIds, role } = req.body;

            if (!Array.isArray(userIds) || userIds.length === 0) {
                return res.status(400).json(userService.formatResponse(false, null, 'User IDs array is required'));
            }

            if (!['admin', 'normal'].includes(role)) {
                return res.status(400).json(userService.formatResponse(false, null, 'Invalid role'));
            }

            const result = await userService.batchUpdateRole(userIds, role);
            res.json(userService.formatResponse(true, result, `Successfully updated ${result.affectedRows} users role to ${role}`));
        } catch (error) {
            console.error('Batch update user role error:', error);
            res.status(500).json(userService.formatResponse(false, null, error.message));
        }
    });

    // PATCH /api/users/batch/level - 批量更新用户等级
    router.patch('/batch/level', validateBody(['userIds', 'level']), async (req, res) => {
        try {
            const { userIds, level } = req.body;

            if (!Array.isArray(userIds) || userIds.length === 0) {
                return res.status(400).json(userService.formatResponse(false, null, 'User IDs array is required'));
            }

            if (!['free', 'lite', 'pro'].includes(level)) {
                return res.status(400).json(userService.formatResponse(false, null, 'Invalid level'));
            }

            const result = await userService.batchUpdateLevel(userIds, level);
            res.json(userService.formatResponse(true, result, `Successfully updated ${result.affectedRows} users level to ${level}`));
        } catch (error) {
            console.error('Batch update user level error:', error);
            res.status(500).json(userService.formatResponse(false, null, error.message));
        }
    });

    // PATCH /api/users/:id/reset-password - 重置用户密码（管理员功能）
    router.patch('/:id/reset-password', validateUUID, validateBody(['newPassword']), async (req, res) => {
        try {
            const { id } = req.params;
            const { newPassword } = req.body;

            if (!newPassword || newPassword.length < 6) {
                return res.status(400).json(userService.formatResponse(false, null, 'New password must be at least 6 characters long'));
            }

            const user = await userService.updateUser(id, { password: newPassword });
            res.json(userService.formatResponse(true, user, 'Password reset successfully'));
        } catch (error) {
            console.error('Reset user password error:', error);
            const statusCode = error.message.includes('not found') ? 404 : 500;
            res.status(statusCode).json(userService.formatResponse(false, null, error.message));
        }
    });

    // 基础CRUD路由（放在最后，避免路由冲突）

    // GET /api/users - 获取所有用户
    router.get('/', async (req, res) => {
        try {
            const result = await userService.getAll(req.query);
            res.json(userService.formatPaginatedResponse(result, 'Users retrieved successfully'));
        } catch (error) {
            console.error('Get all users error:', error);
            res.status(500).json(userService.formatResponse(false, null, error.message));
        }
    });

    // POST /api/users - 创建用户（自定义实现）
    router.post('/', validateBody(['username', 'email']), async (req, res) => {
        try {
            const user = await userService.createUser(req.body);
            res.status(201).json(userService.formatResponse(true, user, 'User created successfully'));
        } catch (error) {
            console.error('Create user error:', error);
            const statusCode = error.message.includes('already exists') || error.message.includes('Validation failed') ? 400 : 500;
            res.status(statusCode).json(userService.formatResponse(false, null, error.message));
        }
    });

    // GET /api/users/:id - 根据ID获取用户  
    router.get('/:id', validateUUID, async (req, res) => {
        try {
            const { id } = req.params;
            const user = await userService.getById(id);
            res.json(userService.formatResponse(true, user, 'User retrieved successfully'));
        } catch (error) {
            console.error('Get user by ID error:', error);
            const statusCode = error.message.includes('not found') ? 404 : 500;
            res.status(statusCode).json(userService.formatResponse(false, null, error.message));
        }
    });

    // PUT /api/users/:id - 更新用户（自定义实现）
    router.put('/:id', validateUUID, async (req, res) => {
        try {
            const { id } = req.params;
            const user = await userService.updateUser(id, req.body);
            res.json(userService.formatResponse(true, user, 'User updated successfully'));
        } catch (error) {
            console.error('Update user error:', error);
            const statusCode = error.message.includes('not found') ? 404 : 
                              error.message.includes('already exists') || error.message.includes('Validation failed') ? 400 : 500;
            res.status(statusCode).json(userService.formatResponse(false, null, error.message));
        }
    });

    // DELETE /api/users/:id - 删除用户
    router.delete('/:id', validateUUID, async (req, res) => {
        try {
            const { id } = req.params;
            const success = await userService.delete(id);
            res.json(userService.formatResponse(true, success, 'User deleted successfully'));
        } catch (error) {
            console.error('Delete user error:', error);
            const statusCode = error.message.includes('not found') ? 404 : 500;
            res.status(statusCode).json(userService.formatResponse(false, null, error.message));
        }
    });

    return router;
}

// 导出路由工厂函数
module.exports = (app) => {
    return createUserRoutes(app);
};