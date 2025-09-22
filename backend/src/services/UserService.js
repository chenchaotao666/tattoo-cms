const BaseService = require('./BaseService');

class UserService extends BaseService {
    constructor(userModel) {
        super(userModel);
    }

    // 处理用户数据字段映射
    processUserData(userData) {
        if (!userData) return null;
        
        // 字段映射：数据库字段 -> 前端期望字段
        const processed = { ...userData };
        
        // 处理ID字段映射
        if (processed.id !== undefined) {
            processed.userId = processed.id;
        }
        
        // 处理头像字段映射
        if (processed.avatarUrl !== undefined) {
            processed.avatar = processed.avatarUrl;
            delete processed.avatarUrl;
        }
        
        // 移除敏感字段
        delete processed.passwordHash;
        delete processed.refreshToken;
        delete processed.resetPasswordToken;
        
        return processed;
    }

    // 反向处理用户数据字段映射（用于存储）
    reverseProcessUserData(userData) {
        if (!userData) return null;
        
        const processed = { ...userData };
        
        // 字段映射：前端字段 -> 数据库字段
        if (processed.userId !== undefined && processed.id === undefined) {
            processed.id = processed.userId;
            delete processed.userId;
        }
        
        if (processed.avatar !== undefined) {
            processed.avatarUrl = processed.avatar;
            delete processed.avatar;
        }
        
        return processed;
    }

    // 重写基础方法以应用数据处理
    async getById(id) {
        try {
            const user = await super.getById(id);
            return this.processUserData(user);
        } catch (error) {
            throw new Error(`Get user by ID failed: ${error.message}`);
        }
    }

    async getAll(query = {}) {
        try {
            const result = await super.getAll(query);
            if (result.data) {
                result.data = result.data.map(user => this.processUserData(user));
            }
            return result;
        } catch (error) {
            throw new Error(`Get all users failed: ${error.message}`);
        }
    }

    // 根据邮箱查找用户
    async getUserByEmail(email) {
        try {
            if (!email) {
                throw new Error('Email is required');
            }

            const user = await this.model.findByEmail(email);
            return this.processUserData(user);
        } catch (error) {
            throw new Error(`Get user by email failed: ${error.message}`);
        }
    }

    // 根据refresh token查找用户
    async getUserByRefreshToken(refreshToken) {
        try {
            if (!refreshToken) {
                throw new Error('Refresh token is required');
            }

            const user = await this.model.findByRefreshToken(refreshToken);
            return this.processUserData(user);
        } catch (error) {
            throw new Error(`Get user by refresh token failed: ${error.message}`);
        }
    }

    // 更新用户积分
    async updateUserCredits(userId, creditsChange) {
        try {
            if (!userId) {
                throw new Error('User ID is required');
            }

            if (typeof creditsChange !== 'number') {
                throw new Error('Credits change must be a number');
            }

            const user = await this.model.updateCredits(userId, creditsChange);
            return this.processUserData(user);
        } catch (error) {
            throw new Error(`Update user credits failed: ${error.message}`);
        }
    }

    // 更新用户余额
    async updateUserBalance(userId, balanceChange) {
        try {
            if (!userId) {
                throw new Error('User ID is required');
            }

            if (typeof balanceChange !== 'number') {
                throw new Error('Balance change must be a number');
            }

            const user = await this.model.updateBalance(userId, balanceChange);
            return this.processUserData(user);
        } catch (error) {
            throw new Error(`Update user balance failed: ${error.message}`);
        }
    }

    // 获取用户统计信息
    async getUserStats(userId) {
        try {
            if (!userId) {
                throw new Error('User ID is required');
            }

            return await this.model.getUserStats(userId);
        } catch (error) {
            throw new Error(`Get user stats failed: ${error.message}`);
        }
    }

    // 获取即将到期的会员
    async getExpiringMemberships(days = 7) {
        try {
            return await this.model.findExpiringMemberships(days);
        } catch (error) {
            throw new Error(`Get expiring memberships failed: ${error.message}`);
        }
    }

    // 创建用户（带验证）
    async createUser(userData) {
        try {
            const requiredFields = ['username', 'email'];
            // 如果有password字段，也作为必填项
            if (userData.password) {
                requiredFields.push('password');
            }
            
            const validationErrors = this.validateData(userData, requiredFields);

            if (validationErrors.length > 0) {
                throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
            }

            // 检查邮箱是否已存在
            const existingUserByEmail = await this.model.findByEmail(userData.email);
            if (existingUserByEmail) {
                throw new Error('Email already exists');
            }

            // 检查用户名是否已存在
            const existingUserByUsername = await this.model.findByUsername(userData.username);
            if (existingUserByUsername) {
                throw new Error('Username already exists');
            }

            // 处理字段映射和密码
            let processedUserData = this.reverseProcessUserData(userData);
            
            if (userData.password) {
                // 密码哈希处理
                const bcrypt = require('bcrypt');
                const saltRounds = 10;
                processedUserData.passwordHash = await bcrypt.hash(userData.password, saltRounds);
                delete processedUserData.password; // 移除原始密码字段
            }

            // 生成UUID
            const { v4: uuidv4 } = require('uuid');
            
            // 设置默认值
            const defaultUserData = {
                id: uuidv4(),
                credits: 0,
                balance: 0.00,
                role: 'normal',
                level: 'free',
                ...processedUserData
            };

            const createdUser = await this.model.create(defaultUserData);
            return this.processUserData(createdUser);
        } catch (error) {
            throw new Error(`Create user failed: ${error.message}`);
        }
    }

    // 更新用户（带验证）
    async updateUser(userId, userData) {
        try {
            // 如果要更新邮箱，检查是否已存在
            if (userData.email) {
                const existingUser = await this.model.findByEmail(userData.email);
                if (existingUser && existingUser.id !== userId) {
                    throw new Error('Email already exists');
                }
            }

            // 如果要更新用户名，检查是否已存在
            if (userData.username) {
                const existingUser = await this.model.findByUsername(userData.username);
                if (existingUser && existingUser.id !== userId) {
                    throw new Error('Username already exists');
                }
            }

            // 处理字段映射和密码更新
            let processedUserData = this.reverseProcessUserData(userData);
            
            if (userData.password) {
                const bcrypt = require('bcrypt');
                const saltRounds = 10;
                processedUserData.passwordHash = await bcrypt.hash(userData.password, saltRounds);
                delete processedUserData.password; // 移除原始密码字段
            }

            const updatedUser = await this.model.updateById(userId, processedUserData);
            return this.processUserData(updatedUser);
        } catch (error) {
            throw new Error(`Update user failed: ${error.message}`);
        }
    }

    // 用户登录
    async loginUser(email, password) {
        try {
            if (!email || !password) {
                throw new Error('Email and password are required');
            }

            // 使用模型的 verifyPassword 方法进行验证
            const user = await this.model.verifyPassword(email, password);
            
            if (!user) {
                throw new Error('Invalid email or password');
            }

            // 处理用户数据并返回
            return this.processUserData(user);
        } catch (error) {
            throw new Error(`Login failed: ${error.message}`);
        }
    }

    // 获取用户个人资料（用于已登录用户）
    async getUserProfile(userId) {
        try {
            if (!userId) {
                throw new Error('User ID is required');
            }

            const user = await this.model.findById(userId);
            
            if (!user) {
                throw new Error('User not found');
            }

            // 返回处理后的用户数据（不包含敏感信息）
            return this.processUserData(user);
        } catch (error) {
            throw new Error(`Get user profile failed: ${error.message}`);
        }
    }
}

module.exports = UserService;