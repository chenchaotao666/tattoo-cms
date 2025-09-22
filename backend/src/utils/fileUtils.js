const { v4: uuidv4 } = require('uuid');
const path = require('path');

/**
 * 文件相关工具函数
 */
class FileUtils {
    /**
     * 生成文件名
     * @param {string} originalName - 原始文件名
     * @param {string} slug - URL友好的标识符wo
     * @param {string} nameEn - 英文名称
     * @param {string} prefix - 文件名前缀（可选）
     * @returns {string} 生成的文件名
     */
    static generateFilename(originalName, slug = null, nameEn = null, prefix = null) {
        const ext = path.extname(originalName) || '.png'; // 默认png扩展名
        const uuid = uuidv4().substring(0, 8); // 使用短UUID

        let baseName;
        if (slug) {
            baseName = slug;
        } else if (nameEn) {
            // 将nameEn转换为slug格式：小写，空格和特殊字符替换为-
            baseName = nameEn
                .toLowerCase()
                .replace(/[^\w\s-]/g, '') // 移除特殊字符
                .replace(/\s+/g, '-') // 空格替换为-
                .replace(/-+/g, '-') // 多个-替换为单个-
                .replace(/^-|-$/g, ''); // 移除开头和结尾的-
        } else {
            baseName = 'image';
        }

        // 如果有前缀，添加到文件名前
        const finalBaseName = prefix ? `${prefix}-${baseName}` : baseName;

        return `${finalBaseName}-${uuid}${ext}`;
    }

    /**
     * 获取文件MIME类型
     * @param {string} filename - 文件名
     * @returns {string} MIME类型
     */
    static getContentType(filename) {
        const ext = path.extname(filename).toLowerCase();
        const mimeTypes = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.svg': 'image/svg+xml',
            '.bmp': 'image/bmp',
            '.tiff': 'image/tiff',
            '.ico': 'image/x-icon'
        };
        return mimeTypes[ext] || 'application/octet-stream';
    }

    /**
     * 验证文件类型
     * @param {string} filename - 文件名
     * @returns {boolean} 是否为允许的文件类型
     */
    static validateFileType(filename) {
        const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff'];
        const ext = path.extname(filename).toLowerCase();
        return allowedExtensions.includes(ext);
    }

    /**
     * 验证文件大小
     * @param {number} fileSize - 文件大小（字节）
     * @param {number} maxSize - 最大大小（字节，默认10MB）
     * @returns {boolean} 是否在允许的大小范围内
     */
    static validateFileSize(fileSize, maxSize = 10 * 1024 * 1024) {
        return fileSize <= maxSize;
    }

    /**
     * 从URL提取原始文件名
     * @param {string} url - URL
     * @returns {string} 文件名
     */
    static extractFilenameFromUrl(url) {
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname;
            return path.basename(pathname) || 'image.png';
        } catch (error) {
            return 'image.png';
        }
    }
}

module.exports = FileUtils;