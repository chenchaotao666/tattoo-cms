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

    async translateBatch(texts, fromLanguage, toLanguage, context) {
        if (!texts || texts.length === 0) {
            return [];
        }

        // 为了避免API调用过于频繁，可以将多个文本合并成一个请求
        try {
            const combinedText = texts.map((text, index) => `${index + 1}. ${text}`).join('\n\n');

            // 检测是否包含HTML内容
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
                    max_tokens: 2000
                })
            });

            if (!response.ok) {
                throw new Error(`DeepSeek API error: ${response.status}`);
            }

            const data = await response.json();
            const translatedContent = data.choices?.[0]?.message?.content?.trim();
            
            if (!translatedContent) {
                return texts; // 如果翻译失败，返回原文
            }

            // 解析编号格式的翻译结果
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
                    currentTranslation += ' ' + line;
                }
            }
            
            if (currentTranslation) {
                translatedTexts.push(currentTranslation.trim());
            }

            // 确保返回的数量与输入一致
            return translatedTexts.length === texts.length ? translatedTexts : texts;
        } catch (error) {
            console.error('Batch translation failed:', error);
            // 如果批量翻译失败，回退到单个翻译
            const results = [];
            for (const text of texts) {
                try {
                    const translated = await this.translate(text, fromLanguage, toLanguage, context);
                    results.push(translated);
                } catch (err) {
                    results.push(text); // 如果单个翻译也失败，保留原文
                }
            }
            return results;
        }
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
            const { texts, fromLanguage, toLanguage, context } = req.body;
            
            if (!texts || !Array.isArray(texts) || !fromLanguage || !toLanguage) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Missing required fields: texts (array), fromLanguage, toLanguage'
                });
            }

            const translatedTexts = await translationService.translateBatch(texts, fromLanguage, toLanguage, context);
            
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

    return router;
}

// 导出路由工厂函数
module.exports = createTranslateRoutes;
