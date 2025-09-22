const express = require('express');
const multer = require('multer');
const UploadService = require('../services/UploadService');

const router = express.Router();

// 配置multer为内存存储
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        // 验证文件类型
        const allowedTypes = /jpeg|jpg|png|gif|webp|svg|bmp|tiff/;
        const extname = allowedTypes.test(file.originalname.toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('只允许上传图片文件 (jpeg, jpg, png, gif, webp, svg, bmp, tiff)'));
        }
    }
});

// 创建上传路由
function createUploadRoutes(app) {
    const db = app.locals.db;
    
    // 初始化MinIO客户端（从ImageGenerateService中获取配置）
    const { Client } = require('minio');
    
    // 解析MinIO端点
    const minioEndpoint = process.env.MINIO_ENDPOINT || 'http://localhost:9000';
    const endpointUrl = new URL(minioEndpoint);
    
    const minioClient = new Client({
        endPoint: endpointUrl.hostname,
        port: parseInt(endpointUrl.port) || (endpointUrl.protocol === 'https:' ? 443 : 9000),
        useSSL: endpointUrl.protocol === 'https:' || process.env.MINIO_USE_SSL === 'true',
        accessKey: process.env.MINIO_ACCESS_KEY_ID || 'minioadmin',
        secretKey: process.env.MINIO_SECRET_ACCESS_KEY || 'minioadmin123',
        region: process.env.MINIO_REGION || 'us-east-1'
    });

    const uploadService = new UploadService(minioClient);

    // POST /api/upload/image - 上传单个图片
    router.post('/image', upload.single('image'), async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: '请选择要上传的图片文件'
                });
            }

            // 验证文件
            if (!uploadService.validateFileType(req.file.originalname)) {
                return res.status(400).json({
                    success: false,
                    message: '不支持的文件类型'
                });
            }

            if (!uploadService.validateFileSize(req.file.size)) {
                return res.status(400).json({
                    success: false,
                    message: '文件大小超过限制 (最大10MB)'
                });
            }

            // 从请求中获取元数据
            const metadata = {
                slug: req.body.slug,
                nameEn: req.body.nameEn,
                prefix: req.body.prefix // 支持自定义前缀
            };

            // 上传到MinIO
            const result = await uploadService.uploadImage(
                req.file.buffer,
                req.file.originalname,
                metadata
            );

            if (result.success) {
                res.json({
                    success: true,
                    data: {
                        url: result.data.url,
                        filename: result.data.filename,
                        size: result.data.size,
                        originalName: req.file.originalname
                    },
                    message: '图片上传成功'
                });
            } else {
                res.status(500).json(result);
            }

        } catch (error) {
            console.error('Upload route error:', error);
            res.status(500).json({
                success: false,
                message: `上传失败: ${error.message}`
            });
        }
    });

    // POST /api/upload/images - 上传多个图片
    router.post('/images', upload.array('images', 10), async (req, res) => {
        try {
            if (!req.files || req.files.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: '请选择要上传的图片文件'
                });
            }

            const results = [];
            const errors = [];

            for (let i = 0; i < req.files.length; i++) {
                const file = req.files[i];
                
                try {
                    // 验证每个文件
                    if (!uploadService.validateFileType(file.originalname)) {
                        errors.push(`${file.originalname}: 不支持的文件类型`);
                        continue;
                    }

                    if (!uploadService.validateFileSize(file.size)) {
                        errors.push(`${file.originalname}: 文件大小超过限制`);
                        continue;
                    }

                    // 从请求中获取元数据
                    const metadata = {
                        slug: req.body.slug ? `${req.body.slug}-${i + 1}` : undefined,
                        nameEn: req.body.nameEn ? `${req.body.nameEn}-${i + 1}` : undefined
                    };

                    // 上传到MinIO
                    const result = await uploadService.uploadImage(
                        file.buffer,
                        file.originalname,
                        metadata
                    );

                    if (result.success) {
                        results.push({
                            url: result.data.url,
                            filename: result.data.filename,
                            size: result.data.size,
                            originalName: file.originalname
                        });
                    } else {
                        errors.push(`${file.originalname}: ${result.message}`);
                    }

                } catch (error) {
                    errors.push(`${file.originalname}: ${error.message}`);
                }
            }

            res.json({
                success: results.length > 0,
                data: {
                    uploadedFiles: results,
                    totalUploaded: results.length,
                    totalFiles: req.files.length
                },
                message: `成功上传 ${results.length}/${req.files.length} 个文件`,
                ...(errors.length > 0 && { errors })
            });

        } catch (error) {
            console.error('Multiple upload route error:', error);
            res.status(500).json({
                success: false,
                message: `批量上传失败: ${error.message}`
            });
        }
    });

    // DELETE /api/upload/image - 删除图片
    router.delete('/image', async (req, res) => {
        try {
            const { objectName } = req.body;

            if (!objectName) {
                return res.status(400).json({
                    success: false,
                    message: '请提供要删除的文件路径'
                });
            }

            const result = await uploadService.deleteImage(objectName);
            res.json(result);

        } catch (error) {
            console.error('Delete route error:', error);
            res.status(500).json({
                success: false,
                message: `删除失败: ${error.message}`
            });
        }
    });

    return router;
}

// 导出路由工厂函数
module.exports = (app) => {
    return createUploadRoutes(app);
};