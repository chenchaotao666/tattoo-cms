const express = require('express');
const router = express.Router();

// 简单的翻译服务类
class TranslationService {
    constructor() {
        // 这里可以配置不同的翻译服务提供商
        this.provider = process.env.TRANSLATION_PROVIDER || 'deepseek';
    }

    async translateWithDeepSeek(text, fromLanguage, toLanguage, context) {
        try {
            // 检测是否为HTML富文本内容
            const isHtml = /<[^>]+>/.test(text);

            let prompt;
            if (isHtml) {
                prompt = `Please translate the following ${fromLanguage} HTML content to ${toLanguage}. This is in the context of a ${context || 'general'} application.

IMPORTANT RULES:
1. Preserve ALL HTML tags and structure exactly as they are
2. Only translate the text content between HTML tags
3. Do not add any explanations or notes
4. Do not translate HTML attributes or tag names
5. Maintain all formatting, spacing, and structure

Content to translate:
${text}`;
            } else {
                prompt = `Please translate the following ${fromLanguage} text to ${toLanguage}. This is in the context of a ${context || 'general'} application. Please provide only the translation without any additional explanation or notes:\n\n${text}`;
            }

            const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
                },
                body: JSON.stringify({
                    model: 'deepseek-chat',
                    messages: [
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: 0.3,
                    max_tokens: 1000
                })
            });

            if (!response.ok) {
                throw new Error(`DeepSeek API error: ${response.status}`);
            }

            const data = await response.json();
            return data.choices?.[0]?.message?.content?.trim() || text;
        } catch (error) {
            console.error('DeepSeek translation error:', error);
            throw error;
        }
    }

    async translate(text, fromLanguage, toLanguage, context) {
        if (!text || !text.trim()) {
            return '';
        }

        if (fromLanguage === toLanguage) {
            return text;
        }

        try {
            switch (this.provider) {
                case 'deepseek':
                    return await this.translateWithDeepSeek(text, fromLanguage, toLanguage, context);
                default:
                    throw new Error(`Unsupported translation provider: ${this.provider}`);
            }
        } catch (error) {
            console.error('Translation failed:', error);
            throw new Error('Translation service temporarily unavailable');
        }
    }

    async translateBatch(texts, fromLanguage, toLanguage, context, options = {}) {
        if (!texts || texts.length === 0) {
            return [];
        }

        const {
            maxTextsPerBatch = 20,
            maxCharsPerBatch = 3000,
            delayBetweenBatches = 1000
        } = options;

        // 智能分批：根据文本长度和数量动态分组
        const batches = this.createSmartBatches(texts, maxTextsPerBatch, maxCharsPerBatch);
        const results = [];

        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];

            try {
                console.log(`Processing batch ${i + 1}/${batches.length} with ${batch.length} texts`);

                const batchResults = await this.processBatch(batch, fromLanguage, toLanguage, context);
                results.push(...batchResults);

                // 添加延迟以避免API频率限制
                if (i < batches.length - 1) {
                    await this.delay(delayBetweenBatches);
                }
            } catch (error) {
                console.error(`Batch ${i + 1} failed, falling back to individual translation:`, error);

                // 单个处理失败的批次
                for (const text of batch) {
                    try {
                        const translated = await this.translate(text, fromLanguage, toLanguage, context);
                        results.push(translated);
                        await this.delay(500); // 单个翻译间的短暂延迟
                    } catch (err) {
                        console.error('Individual translation failed:', err);
                        results.push(text); // 保留原文
                    }
                }
            }
        }

        return results;
    }

    // 创建智能分批
    createSmartBatches(texts, maxTextsPerBatch, maxCharsPerBatch) {
        const batches = [];
        let currentBatch = [];
        let currentBatchChars = 0;

        for (const text of texts) {
            const textLength = text.length;

            // 如果单个文本就超过限制，单独处理
            if (textLength > maxCharsPerBatch) {
                if (currentBatch.length > 0) {
                    batches.push([...currentBatch]);
                    currentBatch = [];
                    currentBatchChars = 0;
                }
                batches.push([text]);
                continue;
            }

            // 检查是否需要创建新批次
            if (currentBatch.length >= maxTextsPerBatch ||
                currentBatchChars + textLength > maxCharsPerBatch) {

                if (currentBatch.length > 0) {
                    batches.push([...currentBatch]);
                    currentBatch = [];
                    currentBatchChars = 0;
                }
            }

            currentBatch.push(text);
            currentBatchChars += textLength;
        }

        if (currentBatch.length > 0) {
            batches.push(currentBatch);
        }

        return batches;
    }

    // 处理单个批次
    async processBatch(texts, fromLanguage, toLanguage, context) {
        const combinedText = texts.map((text, index) => `${index + 1}. ${text}`).join('\n\n');
        const hasHtml = texts.some(text => /<[^>]+>/.test(text));

        let prompt;
        if (hasHtml) {
            prompt = `Please translate the following numbered ${fromLanguage} texts to ${toLanguage}. This is in the context of a ${context || 'general'} application.

IMPORTANT RULES:
1. Maintain the same numbering format (1., 2., 3., etc.)
2. For HTML content: preserve ALL HTML tags and structure exactly as they are
3. Only translate the text content between HTML tags
4. Do not translate HTML attributes or tag names
5. Do not add any explanations or notes
6. Maintain all formatting, spacing, and structure

Content to translate:
${combinedText}`;
        } else {
            prompt = `Please translate the following numbered ${fromLanguage} texts to ${toLanguage}. This is in the context of a ${context || 'general'} application. Please maintain the same numbering format and provide only the translations:\n\n${combinedText}`;
        }

        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.3,
                max_tokens: Math.min(4000, combinedText.length * 2) // 动态调整token限制
            })
        });

        if (!response.ok) {
            throw new Error(`DeepSeek API error: ${response.status}`);
        }

        const data = await response.json();
        const translatedContent = data.choices?.[0]?.message?.content?.trim();

        if (!translatedContent) {
            throw new Error('Empty translation response');
        }

        // 解析编号格式的翻译结果
        const translatedTexts = this.parseNumberedResponse(translatedContent, texts.length);

        // 确保返回的数量与输入一致
        if (translatedTexts.length !== texts.length) {
            throw new Error(`Translation count mismatch: expected ${texts.length}, got ${translatedTexts.length}`);
        }

        return translatedTexts;
    }

    // 解析编号格式的响应
    parseNumberedResponse(translatedContent, expectedCount) {
        const translatedTexts = [];
        const lines = translatedContent.split('\n');
        let currentTranslation = '';

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.match(/^\d+\./)) {
                if (currentTranslation) {
                    translatedTexts.push(currentTranslation.trim());
                }
                currentTranslation = line.replace(/^\d+\.\s*/, '');
            } else if (line) {
                currentTranslation += (currentTranslation ? ' ' : '') + line;
            }
        }

        if (currentTranslation) {
            translatedTexts.push(currentTranslation.trim());
        }

        return translatedTexts;
    }

    // 延迟工具函数
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 新增：富文本翻译方法
    async translateRichText(richTextContent, fromLanguage, toLanguage, context) {
        if (!richTextContent || !richTextContent.trim()) {
            return richTextContent;
        }

        try {
            // 解析富文本，提取需要翻译的文本段落
            const textSegments = this.extractTextSegments(richTextContent);

            if (textSegments.length === 0) {
                return richTextContent;
            }

            console.log(`Extracted ${textSegments.length} text segments for translation`);

            // 使用优化的批量翻译
            const translatedSegments = await this.translateBatch(
                textSegments.map(seg => seg.text),
                fromLanguage,
                toLanguage,
                context,
                {
                    maxTextsPerBatch: 3,        // 富文本内容较长，减少每批数量
                    maxCharsPerBatch: 2000,     // 降低字符限制
                    delayBetweenBatches: 1500   // 增加批次间延迟
                }
            );

            // 重建富文本内容
            return this.reconstructRichText(richTextContent, textSegments, translatedSegments);

        } catch (error) {
            console.error('Rich text translation failed:', error);
            return richTextContent; // 失败时返回原文
        }
    }

    // 从富文本中提取需要翻译的文本段落
    extractTextSegments(richTextContent) {
        const segments = [];

        // 正则表达式匹配HTML标签之间的文本内容
        const textRegex = />([^<]+)</g;
        let match;

        while ((match = textRegex.exec(richTextContent)) !== null) {
            const text = match[1].trim();
            if (text && text.length > 3) { // 过滤掉太短的文本
                segments.push({
                    text: text,
                    start: match.index + 1,
                    end: match.index + match[0].length - 1,
                    original: match[0]
                });
            }
        }

        return segments;
    }

    // 重建富文本内容
    reconstructRichText(originalContent, textSegments, translatedSegments) {
        let result = originalContent;
        let offset = 0;

        for (let i = 0; i < textSegments.length && i < translatedSegments.length; i++) {
            const segment = textSegments[i];
            const translatedText = translatedSegments[i];

            const originalText = segment.text;
            const start = segment.start + offset;
            const end = segment.end + offset;

            // 替换原文本为翻译后的文本
            result = result.substring(0, start) + translatedText + result.substring(end);

            // 更新偏移量
            offset += translatedText.length - originalText.length;
        }

        return result;
    }
}

// 创建翻译路由
function createTranslateRoutes() {
    const translationService = new TranslationService();

    // POST /api/translate - 单个文本翻译
    router.post('/', async (req, res) => {
        try {
            const { text, fromLanguage, toLanguage, context } = req.body;
            
            if (!text || !fromLanguage || !toLanguage) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Missing required fields: text, fromLanguage, toLanguage'
                });
            }

            const translatedText = await translationService.translate(text, fromLanguage, toLanguage, context);
            
            res.json({
                status: 'success',
                message: 'Translation completed successfully',
                data: {
                    originalText: text,
                    translatedText,
                    fromLanguage,
                    toLanguage
                }
            });
        } catch (error) {
            console.error('Translation API error:', error);
            res.status(500).json({
                status: 'error',
                message: error.message || 'Translation failed'
            });
        }
    });

    // POST /api/translate/batch - 批量文本翻译
    router.post('/batch', async (req, res) => {
        try {
            const { texts, fromLanguage, toLanguage, context, options } = req.body;

            if (!texts || !Array.isArray(texts) || !fromLanguage || !toLanguage) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Missing required fields: texts (array), fromLanguage, toLanguage'
                });
            }

            const translatedTexts = await translationService.translateBatch(texts, fromLanguage, toLanguage, context, options);

            res.json({
                status: 'success',
                message: 'Batch translation completed successfully',
                data: {
                    originalTexts: texts,
                    translatedTexts,
                    fromLanguage,
                    toLanguage
                }
            });
        } catch (error) {
            console.error('Batch translation API error:', error);
            res.status(500).json({
                status: 'error',
                message: error.message || 'Batch translation failed'
            });
        }
    });

    // POST /api/translate/rich-text - 富文本翻译
    router.post('/rich-text', async (req, res) => {
        try {
            const { richTextContent, fromLanguage, toLanguage, context } = req.body;

            if (!richTextContent || !fromLanguage || !toLanguage) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Missing required fields: richTextContent, fromLanguage, toLanguage'
                });
            }

            const translatedRichText = await translationService.translateRichText(richTextContent, fromLanguage, toLanguage, context);

            res.json({
                status: 'success',
                message: 'Rich text translation completed successfully',
                data: {
                    originalRichText: richTextContent,
                    translatedRichText,
                    fromLanguage,
                    toLanguage
                }
            });
        } catch (error) {
            console.error('Rich text translation API error:', error);
            res.status(500).json({
                status: 'error',
                message: error.message || 'Rich text translation failed'
            });
        }
    });

    return router;
}

// 导出路由工厂函数
module.exports = createTranslateRoutes;
