const FileUtils = require('../utils/fileUtils');

class UploadService {
    constructor(minioClient) {
        this.minioClient = minioClient;
        this.bucketName = process.env.MINIO_BUCKET_NAME || 'tattoo';
        this.cmsPath = 'cms'; // CMS上传的图片路径
    }

    // 生成文件名
    generateFilename(originalName, slug, nameEn, prefix) {
        return FileUtils.generateFilename(originalName, slug, nameEn, prefix);
    }

    // 上传图片到MinIO
    async uploadImage(fileBuffer, originalName, metadata = {}) {
        try {
            if (!this.minioClient) {
                throw new Error('MinIO client not initialized');
            }

            // 确保bucket存在
            const bucketExists = await this.minioClient.bucketExists(this.bucketName);
            if (!bucketExists) {
                throw new Error(`Bucket ${this.bucketName} does not exist`);
            }

            // 确定前缀，默认为upload
            const prefix = metadata.prefix || 'upload';

            // 生成文件名
            const filename = this.generateFilename(
                originalName,
                metadata.slug,
                metadata.nameEn,
                prefix
            );

            // 完整的MinIO路径
            const objectName = `${this.cmsPath}/${filename}`;

            // 设置文件元数据 - 简化元数据以避免签名问题
            const metaData = {
                'Content-Type': this.getContentType(originalName)
            };

            // 上传文件
            const uploadInfo = await this.minioClient.putObject(
                this.bucketName,
                objectName,
                fileBuffer,
                fileBuffer.length,
                metaData
            );

            // 生成访问URL（用于前端预览）
            const fullUrl = this.generateFileUrl(objectName);
            // 生成相对路径（用于保存到数据库）
            const relativePath = `images/${objectName}`;

            return {
                success: true,
                data: {
                    filename,
                    objectName,
                    url: relativePath, // 数据库保存的相对路径
                    fullUrl: fullUrl, // 前端预览用的完整URL
                    bucket: this.bucketName,
                    size: fileBuffer.length,
                    uploadInfo
                },
                message: 'File uploaded successfully'
            };

        } catch (error) {
            console.error('Upload error:', error);
            return {
                success: false,
                data: null,
                message: `Upload failed: ${error.message}`
            };
        }
    }

    // 获取文件MIME类型
    getContentType(filename) {
        return FileUtils.getContentType(filename);
    }

    // 生成文件访问URL
    generateFileUrl(objectName) {
        const endpoint = process.env.MINIO_ENDPOINT || 'http://localhost:9000';
        return `${endpoint}/${this.bucketName}/${objectName}`;
    }

    // 删除文件
    async deleteImage(objectName) {
        try {
            if (!this.minioClient) {
                throw new Error('MinIO client not initialized');
            }

            await this.minioClient.removeObject(this.bucketName, objectName);
            
            return {
                success: true,
                message: 'File deleted successfully'
            };
        } catch (error) {
            console.error('Delete error:', error);
            return {
                success: false,
                message: `Delete failed: ${error.message}`
            };
        }
    }

    // 验证文件类型
    validateFileType(filename) {
        return FileUtils.validateFileType(filename);
    }

    // 验证文件大小 (默认最大10MB)
    validateFileSize(fileSize, maxSize = 10 * 1024 * 1024) {
        return FileUtils.validateFileSize(fileSize, maxSize);
    }
}

module.exports = UploadService;