const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config();

const app = express();

// 中间件配置
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 静态文件服务 - 提供生成的图片访问
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 数据库连接池
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'tattoo_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    timezone: '+00:00',
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
});

// 将数据库连接池挂载到app上，供其他模块使用
app.locals.db = pool;

// API路由工厂函数
const createUserRoutes = require('./routes/userRoutes');
const createCategoryRoutes = require('./routes/categoryRoutes');
const createImageRoutes = require('./routes/imageRoutes');
const createStyleRoutes = require('./routes/styleRoutes');
const createIdeaRoutes = require('./routes/ideaRoutes');
const createTagRoutes = require('./routes/tagRoutes');
const createPostRoutes = require('./routes/postRoutes');
const createRechargeRoutes = require('./routes/rechargeRoutes');
const createReportRoutes = require('./routes/reportRoutes');
const createTranslateRoutes = require('./routes/translateRoutes');
const createUploadRoutes = require('./routes/uploadRoutes');
const createUserImageRoutes = require('./routes/userImageRoutes');
const createPromptTemplateRoutes = require('./routes/promptTemplateRoutes');

// 注册路由
app.use('/api/users', createUserRoutes(app));
app.use('/api/categories', createCategoryRoutes(app));
app.use('/api/images', createImageRoutes(app));
app.use('/api/styles', createStyleRoutes(app));
app.use('/api/ideas', createIdeaRoutes(app));
app.use('/api/tags', createTagRoutes(app));
app.use('/api/posts', createPostRoutes(app));
app.use('/api/recharges', createRechargeRoutes(app));
app.use('/api/reports', createReportRoutes(app));
app.use('/api/translate', createTranslateRoutes());
app.use('/api/upload', createUploadRoutes(app));
app.use('/api/user-images', createUserImageRoutes(app));
app.use('/api/prompt-templates', createPromptTemplateRoutes(app));

// 测试路由
app.get('/test-route', (req, res) => {
    console.log('Test route hit!');
    res.json({ message: 'Backend is working' });
});

// MinIO图片访问路由
app.get('/images/*', async (req, res) => {
    try {
        console.log('MinIO route hit, path:', req.path);
        
        const { Client } = require('minio');
        
        // MinIO配置
        const endpoint = process.env.MINIO_ENDPOINT || 'http://localhost:9000';
        const accessKey = process.env.MINIO_ACCESS_KEY_ID || 'minioadmin';
        const secretKey = process.env.MINIO_SECRET_ACCESS_KEY || 'minioadmin123';
        const bucketName = process.env.MINIO_BUCKET_NAME || 'tattoo';
        const useSSL = process.env.MINIO_USE_SSL === 'true';
        
        // 解析endpoint
        const url = new URL(endpoint);
        const host = url.hostname;
        const port = parseInt(url.port) || (url.protocol === 'https:' ? 443 : 80);
        
        // 创建MinIO客户端
        const minioClient = new Client({
            endPoint: host,
            port: port,
            useSSL: useSSL,
            accessKey: accessKey,
            secretKey: secretKey,
            region: process.env.MINIO_REGION || 'us-east-1'
        });
        
        // 获取完整的文件路径（移除/images/前缀）
        const filename = req.path.replace('/images/', '');
        console.log('Requesting MinIO file:', filename);
        
        // 从MinIO获取文件流
        const stream = await minioClient.getObject(bucketName, filename);
        
        // 根据文件扩展名设置正确的Content-Type
        const ext = filename.split('.').pop()?.toLowerCase();
        const contentTypeMap = {
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'gif': 'image/gif',
            'webp': 'image/webp'
        };
        
        // 设置响应头
        res.setHeader('Content-Type', contentTypeMap[ext] || 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        
        // 将文件流传输到响应
        stream.pipe(res);
        
    } catch (error) {
        console.error('获取MinIO图片失败:', error.message);
        res.status(404).json({
            success: false,
            message: 'Image not found'
        });
    }
});

// 健康检查端点
app.get('/health', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        await connection.execute('SELECT 1');
        connection.release();
        res.json({ status: 'healthy', database: 'connected' });
    } catch (error) {
        res.status(500).json({ status: 'unhealthy', error: error.message });
    }
});

// 错误处理中间件
app.use((error, req, res, next) => {
    console.error(error.stack);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
});

// 404处理
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
});

module.exports = app;