const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const { Client } = require('minio');
const FileUtils = require('../utils/fileUtils');

class ImageGenerateService {
    constructor(imageModel = null, userModel = null) {
        // 强制Node.js使用node-fetch替代内置fetch
        if (!global.fetch) {
            global.fetch = require('node-fetch');
        }
        
        // 设置Node.js网络相关环境变量
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // 临时禁用TLS验证进行测试
        
        // 设置DNS解析
        require('dns').setDefaultResultOrder('ipv4first');
        // Store the image model and user model for database operations
        this.imageModel = imageModel;
        this.userModel = userModel;
        
        // Initialize with default parameters for SDXL Fresh Ink model
        this.defaultParams = {
            width: 1024,  // 恢复到1024分辨率
            height: 1024, // 恢复到1024分辨率
            num_outputs: 1,
            scheduler: "K_EULER",
            guidance_scale: 7.5,
            num_inference_steps: 50, // 恢复推理步数
            negative_prompt: "ugly, broken, distorted, blurry, low quality, bad anatomy",
            lora_scale: 0.6,
            refine: "expert_ensemble_refiner",
            high_noise_frac: 0.9,
            apply_watermark: false
        };
        
        // 使用完整的模型版本ID
        this.modelVersion = "fofr/sdxl-fresh-ink:8515c238222fa529763ec99b4ba1fa9d32ab5d6ebc82b4281de99e4dbdcec943";
        
        // 初始化MinIO客户端
        this.initializeMinIOClient();
    }

    // 初始化MinIO客户端
    initializeMinIOClient() {
        try {
            // 从环境变量读取MinIO配置
            const endpoint = process.env.MINIO_ENDPOINT || 'http://localhost:9001';
            const accessKey = process.env.MINIO_ACCESS_KEY_ID || 'minioadmin';
            const secretKey = process.env.MINIO_SECRET_ACCESS_KEY || 'minioadmin123';
            const bucketName = process.env.MINIO_BUCKET_NAME || 'tattoo';
            const useSSL = process.env.MINIO_USE_SSL === 'true';
            
            // 解析endpoint获取host和port
            const url = new URL(endpoint);
            const host = url.hostname;
            const port = parseInt(url.port) || (url.protocol === 'https:' ? 443 : 80);
            
            // 创建MinIO客户端
            this.minioClient = new Client({
                endPoint: host,
                port: port,
                useSSL: useSSL,
                accessKey: accessKey,
                secretKey: secretKey,
                region: process.env.MINIO_REGION || 'us-east-1'
            });
            
            this.minioBucketName = bucketName;
            console.log(`MinIO客户端初始化成功: ${endpoint}/${bucketName}`);
        } catch (error) {
            console.error('MinIO客户端初始化失败:', error.message);
            this.minioClient = null;
        }
    }

    // 异步生成纹身图像（启动任务，立即返回）
    async generateTattooAsync(params) {
        try {
            // 验证必需参数
            if (!params.prompt) {
                throw new Error('Prompt is required');
            }

            // 检查 Replicate API Token
            if (!process.env.REPLICATE_API_TOKEN) {
                throw new Error('REPLICATE_API_TOKEN environment variable is required');
            }

            // 合并参数
            const input = {
                ...this.defaultParams,
                ...params,
                // 确保 prompt 包含 TOK 关键词以激活模型特性
                prompt: await this.enhancePrompt(params.prompt, params.style, params.isColor, params.styleNote)
            };

            // 验证参数范围
            this.validateParams(input);

            // 启动异步生成任务
            const result = await this.startAsyncGeneration(input);
            
            return this.formatResponse(true, result, 'Generation task started successfully');
        } catch (error) {
            throw new Error(`Start generation task failed: ${error.message}`);
        }
    }

    // 检测文本是否主要包含非英文字符
    isNonEnglish(text) {
        // 检测中文字符
        const chineseRegex = /[\u4e00-\u9fff]/g;
        const chineseChars = (text.match(chineseRegex) || []).length;
        
        // 检测日文字符（平假名、片假名、汉字）
        const japaneseRegex = /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]/g;
        const japaneseChars = (text.match(japaneseRegex) || []).length;
        
        // 检测韩文字符
        const koreanRegex = /[\uac00-\ud7af]/g;
        const koreanChars = (text.match(koreanRegex) || []).length;
        
        // 检测阿拉伯文字符
        const arabicRegex = /[\u0600-\u06ff]/g;
        const arabicChars = (text.match(arabicRegex) || []).length;
        
        // 检测俄文字符
        const russianRegex = /[\u0400-\u04ff]/g;
        const russianChars = (text.match(russianRegex) || []).length;
        
        // 检测法文/德文等特殊字符
        const europeanRegex = /[àáâäçèéêëìíîïñòóôöùúûüýÿæœßÀÁÂÄÇÈÉÊËÌÍÎÏÑÒÓÔÖÙÚÛÜÝŸÆŒ]/g;
        const europeanChars = (text.match(europeanRegex) || []).length;
        
        const totalChars = text.replace(/\s/g, '').length;
        const nonEnglishChars = chineseChars + japaneseChars + koreanChars + arabicChars + russianChars + europeanChars;
        
        return nonEnglishChars > totalChars * 0.2; // 如果非英文字符超过20%，认为需要翻译
    }

    // 使用DeepSeek翻译非英文prompt
    async translatePrompt(prompt) {
        try {
            // 检查是否配置了DeepSeek API Key
            if (!process.env.DEEPSEEK_API_KEY) {
                console.warn('DeepSeek API Key not configured, using original prompt');
                return prompt;
            }

            // 使用axios替代fetch
            const axios = require('axios');
            const response = await axios.post('https://api.deepseek.com/chat/completions', {
                model: 'deepseek-chat',
                messages: [{
                    role: 'user',
                    content: `Translate this tattoo design description to English. Keep it simple, clear, and suitable for AI image generation. Only return the English translation without any explanations:

"${prompt}"`
                }],
                max_tokens: 150,
                temperature: 0.1,
                stream: false
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
                },
                timeout: 30000
            });

            if (response.status !== 200) {
                throw new Error(`DeepSeek API error: ${response.status}`);
            }

            const data = response.data;
            const translatedPrompt = data.choices[0]?.message?.content?.trim();
            
            if (translatedPrompt) {
                console.log(`Translated prompt: ${prompt} -> ${translatedPrompt}`);
                return translatedPrompt;
            }
            
            return prompt; // 翻译失败时返回原prompt
        } catch (error) {
            console.warn('Translation failed:', error.message);
            return prompt; // 翻译失败时返回原prompt
        }
    }

    // 增强提示词，生成专业的纹身设计提示词
    async enhancePrompt(prompt, style, isColor, styleNote) {
        // 如果是非英文prompt，先翻译成英文
        let processedPrompt = prompt;
        if (this.isNonEnglish(prompt)) {
            processedPrompt = await this.translatePrompt(prompt);
        }
        // 处理空的 style 参数
        const hasStyle = style && style.trim() !== '';
        const styleText = hasStyle ? `${style} style` : 'professional tattoo';
        const artStyleText = hasStyle ? `- Art style: ${style}` : '- Art style: Professional tattoo design';
        
        // 处理空的 styleNote 参数
        const hasStyleNote = styleNote && styleNote.trim() !== '';
        const styleNotesSection = hasStyleNote ? `\nAdditional style notes:\n${styleNote}` : '';
        
        // 优化颜色描述和指令
        let colorInstructions;
        if (isColor) {
            colorInstructions = `- IMPORTANT: Full color tattoo with BRIGHT, VIBRANT, SATURATED colors
- Rich color palette with strong saturation and contrast
- Colorful design with multiple distinct colors
- Vivid and eye-catching color scheme
- NEVER use black and grey only - must include bright colors`;
        } else {
            colorInstructions = `- IMPORTANT: Black and grey monochrome tattoo ONLY
- Use only black ink with grey shading and highlights
- NO color whatsoever - pure black and grey design
- Focus on detailed shading, gradients, and contrast
- Traditional black and grey tattoo style`;
        }
        
        const enhancedPrompt = `Create a ${styleText} tattoo design based on: "${processedPrompt}"

Style specifications:
${artStyleText}
${colorInstructions}
- Format: Clean tattoo design suitable for transfer to skin
- Composition: Well-balanced and proportioned for tattoo application

Technical requirements:
- High contrast and clear line definition
- Appropriate level of detail for tattoo medium
- Consider how the design will age over time
- Ensure all elements are tattoo-appropriate
${isColor ? '- Emphasize the vibrant colors throughout the entire design' : '- Focus on rich black and grey tonal variations'}

The design should be professional quality, original, and ready for use as a tattoo reference. Focus on creating bold, clean artwork that will translate well from digital design to actual skin application.${styleNotesSection}`;

        return enhancedPrompt;
    }

    // 验证参数
    validateParams(params) {
        const errors = [];

        // 验证尺寸
        if (params.width && (params.width < 256 || params.width > 2048)) {
            errors.push('Width must be between 256 and 2048');
        }
        if (params.height && (params.height < 256 || params.height > 2048)) {
            errors.push('Height must be between 256 and 2048');
        }

        // 验证输出数量
        if (params.num_outputs && (params.num_outputs < 1 || params.num_outputs > 4)) {
            errors.push('Number of outputs must be between 1 and 4');
        }

        // 验证引导尺度
        if (params.guidance_scale && (params.guidance_scale < 1 || params.guidance_scale > 20)) {
            errors.push('Guidance scale must be between 1 and 20');
        }

        // 验证推理步数
        if (params.num_inference_steps && (params.num_inference_steps < 1 || params.num_inference_steps > 100)) {
            errors.push('Number of inference steps must be between 1 and 100');
        }

        // 验证LoRA缩放
        if (params.lora_scale && (params.lora_scale < 0 || params.lora_scale > 1)) {
            errors.push('LoRA scale must be between 0 and 1');
        }

        // 验证高噪声比例
        if (params.high_noise_frac && (params.high_noise_frac < 0 || params.high_noise_frac > 1)) {
            errors.push('High noise fraction must be between 0 and 1');
        }

        if (errors.length > 0) {
            throw new Error(`Parameter validation failed: ${errors.join(', ')}`);
        }
    }

    // 启动异步生成任务
    async startAsyncGeneration(input) {
        try {
            // 详细检查环境变量
            if (!process.env.REPLICATE_API_TOKEN) {
                throw new Error('REPLICATE_API_TOKEN environment variable is not set');
            }

            if (!process.env.REPLICATE_API_TOKEN.startsWith('r8_')) {
                throw new Error('REPLICATE_API_TOKEN appears to be invalid (should start with r8_)');
            }

            // 检查是否安装了replicate包
            let Replicate;
            try {
                Replicate = require('replicate');
            } catch (error) {
                throw new Error('Replicate package not found. Please install: npm install replicate');
            }

            console.log('Creating Replicate client...');
            
            // 配置Replicate客户端，添加fetch选项解决网络问题
            const replicateConfig = {
                auth: process.env.REPLICATE_API_TOKEN,
                // 添加自定义fetch配置
                fetch: (url, options = {}) => {
                    // 使用node-fetch替代内置fetch
                    const fetch = require('node-fetch');
                    
                    // 添加超时和重试逻辑
                    const timeout = 30000; // 30秒超时
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), timeout);
                    
                    return fetch(url, {
                        ...options,
                        signal: controller.signal,
                        headers: {
                            'User-Agent': 'tattoo-generator/1.0',
                            ...options.headers
                        }
                    }).finally(() => {
                        clearTimeout(timeoutId);
                    });
                }
            };
            
            const replicate = new Replicate(replicateConfig);

            console.log('Model version:', this.modelVersion);
            console.log('Input parameters:', JSON.stringify(input, null, 2));

            // 创建预测任务（异步）
            console.log('Creating prediction...');
            const prediction = await replicate.predictions.create({
                version: this.modelVersion.split(':')[1], // 只需要版本ID部分
                input: input
            });

            console.log('Prediction created successfully:', prediction.id);

            return {
                id: prediction.id,
                status: prediction.status,
                input: prediction.input,
                output: prediction.output,
                error: prediction.error,
                logs: prediction.logs,
                created_at: prediction.created_at,
                started_at: prediction.started_at,
                completed_at: prediction.completed_at,
                urls: prediction.urls
            };
        } catch (error) {
            console.error('Replicate API error details:', {
                message: error.message,
                code: error.code,
                status: error.status,
                response: error.response?.data || error.response,
                stack: error.stack
            });

            if (error.message.includes('Replicate package not found')) {
                throw error;
            }

            // 提供更具体的错误信息
            if (error.message.includes('fetch failed')) {
                throw new Error(`Network connection failed. Please check: 1) Internet connectivity 2) Replicate API status 3) Firewall settings. Original error: ${error.message}`);
            }

            if (error.message.includes('Unauthorized') || error.message.includes('401')) {
                throw new Error(`Replicate API authentication failed. Please check your REPLICATE_API_TOKEN. Original error: ${error.message}`);
            }

            if (error.message.includes('Not Found') || error.message.includes('404')) {
                throw new Error(`Model not found. Please check the model version: ${this.modelVersion}. Original error: ${error.message}`);
            }

            throw new Error(`Replicate API call failed: ${error.message}`);
        }
    }

    // 获取生成任务状态
    async getGenerationStatus(predictionId) {
        try {
            if (!predictionId) {
                throw new Error('Prediction ID is required');
            }

            if (!process.env.REPLICATE_API_TOKEN) {
                throw new Error('REPLICATE_API_TOKEN environment variable is required');
            }

            let Replicate;
            try {
                Replicate = require('replicate');
            } catch (error) {
                throw new Error('Replicate package not found. Please install: npm install replicate');
            }

            const replicate = new Replicate({
                auth: process.env.REPLICATE_API_TOKEN,
            });

            const prediction = await replicate.predictions.get(predictionId);
            
            // 格式化状态响应
            const statusInfo = {
                id: prediction.id,
                status: prediction.status,
                input: prediction.input,
                output: prediction.output,
                error: prediction.error,
                logs: prediction.logs,
                created_at: prediction.created_at,
                started_at: prediction.started_at,
                completed_at: prediction.completed_at,
                progress: this.calculateProgress(prediction.status, prediction.logs),
                urls: prediction.urls
            };
            
            return this.formatResponse(true, statusInfo, 'Status retrieved successfully');
        } catch (error) {
            throw new Error(`Get generation status failed: ${error.message}`);
        }
    }

    // 计算生成进度
    calculateProgress(status, logs = '') {
        switch (status) {
            case 'starting':
                return { percentage: 5, message: 'Initializing...' };
            case 'processing':
                // 尝试从日志中解析进度
                const logMatch = logs.match(/(\d+)%/);
                if (logMatch) {
                    const percentage = Math.min(95, Math.max(10, parseInt(logMatch[1])));
                    return { percentage, message: 'Generating image...' };
                }
                return { percentage: 50, message: 'Processing...' };
            case 'succeeded':
                return { percentage: 100, message: 'Completed successfully' };
            case 'failed':
                return { percentage: 0, message: 'Generation failed' };
            case 'canceled':
                return { percentage: 0, message: 'Generation canceled' };
            default:
                return { percentage: 0, message: 'Unknown status' };
        }
    }

    // 完成异步生成任务的后处理（只返回生成信息，不下载保存）
    async completeGeneration(predictionId, originalParams = {}) {
        try {
            // 获取生成状态
            const statusResponse = await this.getGenerationStatus(predictionId);
            const prediction = statusResponse.data;

            if (prediction.status !== 'succeeded') {
                throw new Error(`Generation not completed. Status: ${prediction.status}`);
            }

            if (!prediction.output || !Array.isArray(prediction.output)) {
                throw new Error('No output images found');
            }

            // 生成批次ID（如果没有提供）
            const batchId = originalParams.batchId || this.generateId();
            
            // 只返回生成信息，不执行下载和保存操作
            const generationResult = {
                predictionId: prediction.id,
                batchId: batchId,
                imageUrls: prediction.output, // 直接返回Replicate的图片URL
                status: prediction.status,
                input: prediction.input,
                created_at: prediction.created_at,
                completed_at: prediction.completed_at,
                originalParams: originalParams
            };

            return this.formatResponse(true, generationResult, 'Generation completed successfully');
        } catch (error) {
            throw new Error(`Complete generation failed: ${error.message}`);
        }
    }

    // 生成唯一ID
    generateId() {
        return uuidv4();
    }

    // 标准化响应格式
    formatResponse(success, data = null, message = '', errors = []) {
        return {
            status: success ? 'success' : 'error',
            message,
            data,
            ...(errors.length > 0 && { errors })
        };
    }

    // 带重试机制的下载方法
    async downloadWithRetry(url, maxRetries = 3, delay = 2000) {
        const axios = require('axios');

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`Downloading image, attempt ${attempt}/${maxRetries}: ${url}`);

                const response = await axios({
                    method: 'GET',
                    url: url,
                    responseType: 'arraybuffer',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'Accept': 'image/*,*/*;q=0.8',
                        'Accept-Encoding': 'gzip, deflate, br',
                        'Connection': 'keep-alive',
                        'Cache-Control': 'no-cache'
                    },
                    timeout: 60000, // 60秒超时
                    maxRedirects: 10,
                    maxContentLength: 50 * 1024 * 1024, // 最大50MB
                    maxBodyLength: 50 * 1024 * 1024,
                    validateStatus: function (status) {
                        return status >= 200 && status < 300;
                    }
                });

                // 转换为类似fetch的响应格式
                return {
                    ok: response.status >= 200 && response.status < 300,
                    status: response.status,
                    statusText: response.statusText,
                    buffer: () => Promise.resolve(Buffer.from(response.data))
                };
            } catch (error) {
                console.error(`Download attempt ${attempt} failed:`, error.message);

                if (attempt === maxRetries) {
                    throw error; // 最后一次尝试失败，抛出错误
                }

                // 等待一段时间后重试
                console.log(`Waiting ${delay}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 1.5; // 指数退避，增加等待时间
            }
        }
    }

    // 下载并保存图片到MinIO
    async downloadAndSaveImages(imageUrls, generationId, batchId, slug = null, nameEn = null) {
        if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
            throw new Error('No image URLs provided');
        }

        const generatedDir = process.env.GENERATED_IMAGES_DIR || 'generated';

        if (!this.minioClient) {
            throw new Error('MinIO client not initialized');
        }

        const savedImages = [];

        // 确保存储桶存在
        try {
            const bucketExists = await this.minioClient.bucketExists(this.minioBucketName);
            if (!bucketExists) {
                await this.minioClient.makeBucket(this.minioBucketName, 'us-east-1');
                console.log(`创建MinIO存储桶: ${this.minioBucketName}`);
            }
        } catch (error) {
            throw new Error(`MinIO存储桶检查失败: ${error.message}`);
        }

        for (let i = 0; i < imageUrls.length; i++) {
            const imageUrl = imageUrls[i];

            // 从URL提取原始文件名或使用默认名称
            const originalName = FileUtils.extractFilenameFromUrl(imageUrl);

            // 使用共用的文件名生成方法
            let filename = `${generatedDir}/${FileUtils.generateFilename(
                originalName,
                slug, // 传递slug
                nameEn, // 传递nameEn
                'generated'
            )}`;

            try {
                // 下载图片，使用重试机制
                const response = await this.downloadWithRetry(imageUrl, 3);

                if (!response.ok) {
                    throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
                }

                // 获取图片数据
                let imageBuffer = await response.buffer();
                let imageSize = imageBuffer.length;

                // 优化PNG图片以减小文件大小
                try {
                    const sharp = require('sharp');

                    // PNG优化：使用更高的压缩等级和优化选项
                    const compressedBuffer = await sharp(imageBuffer)
                        .png({
                            compressionLevel: 9,    // 最高PNG压缩等级 (0-9)
                            adaptiveFiltering: true, // 自适应过滤
                            palette: true,          // 如果可能，使用调色板
                            quality: 95,            // PNG质量95%
                            effort: 10              // 最大努力优化 (1-10)
                        })
                        .toBuffer();

                    // 如果压缩后文件更小，则使用压缩版本
                    if (compressedBuffer.length < imageBuffer.length) {
                        const originalSize = imageBuffer.length;
                        imageBuffer = compressedBuffer;
                        imageSize = compressedBuffer.length;

                        const compressionRatio = ((originalSize - imageSize) / originalSize * 100).toFixed(1);
                        console.log(`PNG optimized: ${imageSize} bytes (original: ${originalSize} bytes, ${compressionRatio}% reduction)`);
                    } else {
                        console.log(`PNG optimization didn't reduce size, keeping original`);
                    }
                } catch (compressionError) {
                    console.warn('PNG optimization failed, using original:', compressionError.message);
                    // 优化失败时继续使用原图
                }

                // 上传到MinIO
                await this.minioClient.putObject(
                    this.minioBucketName,
                    filename,
                    imageBuffer,
                    imageSize,
                    {
                        'Content-Type': FileUtils.getContentType(filename),
                        'X-Amz-Meta-Generation-Id': generationId,
                        'X-Amz-Meta-Batch-Id': batchId,
                        'X-Amz-Meta-Original-Url': imageUrl,
                        'Upload-Date': new Date().toISOString()
                    }
                );

                // 构建后端服务访问URL（通过/images路由访问MinIO图片）
                const minioPath = `images/${filename}`;
                
                savedImages.push({
                    filename: filename,
                    minioPath: minioPath,
                    originalUrl: imageUrl,
                    size: imageSize,
                    batchId: batchId,
                    storage: 'minio'
                });

                console.log(`Image uploaded to MinIO: ${filename}`);
            } catch (error) {
                console.error(`Failed to save image ${i} to MinIO:`, error.message);
                // 继续处理其他图片，不中断整个流程
                savedImages.push({
                    error: error.message,
                    originalUrl: imageUrl
                });
            }
        }

        return savedImages;
    }

    // 保存生成结果到数据库
    async saveToDatabase(generationResult, savedImages, originalParams) {
        if (!this.imageModel) {
            throw new Error('Image model not provided - cannot save to database');
        }

        const savedRecords = [];

        for (let i = 0; i < savedImages.length; i++) {
            const savedImage = savedImages[i];
            
            // 跳过下载失败的图片
            if (savedImage.error) {
                continue;
            }

            try {
                // 构建数据库记录数据
                const imageData = {
                    id: this.generateId(),
                    name: null,
                    slug: `${generatedDir}-tattoo-${generationResult.id}-${i}`,
                    tattooUrl: savedImage.minioPath || savedImage.relativePath, // 使用MinIO路径或相对路径
                    scourceUrl: savedImage.originalUrl, // 原始Replicate URL
                    title: null,
                    description: null,
                    type: 'text2image', // 生成类型
                    styleId: originalParams.styleId || null, // 如果有样式ID
                    isColor: originalParams.isColor !== undefined ? originalParams.isColor : false,
                    isPublic: originalParams.isPublic !== undefined ? originalParams.isPublic : false, // 使用传入的参数或默认不公开
                    isOnline: false, // 默认不上线
                    hotness: 0,
                    prompt: JSON.stringify({
                        en: originalParams.prompt,
                        zh: originalParams.prompt
                    }),
                    userId: originalParams.userId || null, // 如果有用户ID
                    categoryId: originalParams.categoryId || null, // 如果有分类ID
                    batchId: originalParams.batchId,
                    additionalInfo: null
                };

                // 保存到数据库
                const savedRecord = await this.imageModel.create(imageData);
                savedRecords.push(savedRecord);

                console.log(`Image saved to database: ${savedRecord.id}`);
            } catch (error) {
                console.error(`Failed to save image ${i} to database:`, error.message);
                savedRecords.push({
                    error: error.message,
                    localImage: savedImage
                });
            }
        }

        return savedRecords;
    }
}

module.exports = ImageGenerateService;