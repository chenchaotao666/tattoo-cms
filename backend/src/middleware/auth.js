const jwt = require('jsonwebtoken');

// JWT密钥 - 在生产环境中应该从环境变量获取
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// 生成JWT token
function generateTokens(user) {
    const payload = {
        userId: user.id,
        email: user.email,
        username: user.username
    };

    const accessToken = jwt.sign(payload, JWT_SECRET, { 
        expiresIn: JWT_EXPIRES_IN 
    });

    // 生成刷新token（有效期更长）
    const refreshToken = jwt.sign(payload, JWT_SECRET, { 
        expiresIn: '30d' 
    });

    return { accessToken, refreshToken };
}

// 验证JWT token的中间件
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({
            status: 'error',
            message: 'Access token is required',
            data: null,
            errorCode: '9001'
        });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({
                status: 'error',
                message: 'Invalid or expired token',
                data: null,
                errorCode: '9001'
            });
        }

        req.userId = user.userId;
        req.user = user;
        next();
    });
}

// 可选的认证中间件（token无效时不会返回错误，只是不设置用户信息）
function optionalAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return next();
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (!err) {
            req.userId = user.userId;
            req.user = user;
        }
        next();
    });
}

module.exports = {
    generateTokens,
    authenticateToken,
    optionalAuth,
    JWT_SECRET
};