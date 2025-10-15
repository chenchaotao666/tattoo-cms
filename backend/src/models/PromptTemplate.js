const BaseModel = require('./BaseModel');

class PromptTemplate extends BaseModel {
    constructor(db) {
        super(db, 'prompt_templates');
        this.db = db;
    }

    // 创建表（如果不存在）
    async createTable() {
        try {
            // 先检查表是否存在
            const [tables] = await this.db.execute(`SHOW TABLES LIKE '${this.tableName}'`);

            if (tables.length > 0) {
                // 表存在，检查字符集
                const [columns] = await this.db.execute(`SHOW FULL COLUMNS FROM \`${this.tableName}\``);
                const nameColumn = columns.find(col => col.Field === 'name');

                // 如果字符集不正确，先删除表
                if (nameColumn && !nameColumn.Collation.includes('utf8mb4')) {
                    console.log('Dropping existing table with incorrect charset...');
                    await this.db.execute(`DROP TABLE \`${this.tableName}\``);
                }
            }

            const createTableSQL = `
                CREATE TABLE IF NOT EXISTS \`${this.tableName}\` (
                    \`id\` VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci PRIMARY KEY,
                    \`name\` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
                    \`prompt\` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
                    \`isDefault\` BOOLEAN DEFAULT FALSE,
                    \`createdAt\` DATETIME DEFAULT CURRENT_TIMESTAMP,
                    \`updatedAt\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX \`idx_prompt_templates_is_default\` (\`isDefault\`),
                    INDEX \`idx_prompt_templates_name\` (\`name\`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `;

            await this.db.execute(createTableSQL);
            console.log('Table created successfully with UTF8MB4 charset');
        } catch (error) {
            console.error('Error creating table:', error);
            throw error;
        }
    }

    // 确保只有一个默认模板
    async setAsDefault(id) {
        const connection = await this.db.getConnection();
        try {
            await connection.beginTransaction();

            // 先将所有模板设为非默认
            await connection.execute(`UPDATE ${this.tableName} SET isDefault = FALSE`);

            // 再将指定模板设为默认
            const [result] = await connection.execute(
                `UPDATE ${this.tableName} SET isDefault = TRUE WHERE id = ?`,
                [id]
            );

            await connection.commit();
            return result.affectedRows > 0;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    // 获取默认模板
    async getDefault() {
        const [rows] = await this.db.execute(
            `SELECT * FROM ${this.tableName} WHERE isDefault = TRUE LIMIT 1`
        );

        if (rows.length > 0) {
            return rows[0];
        }

        return null;
    }


    // 解析模板语法引擎
    parseTemplate(templateContent, variables) {
        let result = templateContent;

        // 处理条件语句 {{#if condition}} ... {{else}} ... {{/if}}
        result = result.replace(/{{#if\s+(\w+)}}\s*([\s\S]*?)\s*(?:{{else}}\s*([\s\S]*?)\s*)?{{\/if}}/g, (match, condition, ifContent, elseContent = '') => {
            const value = variables[condition];
            const isTrue = value && value !== '' && value !== 'false' && value !== '0';
            return isTrue ? ifContent.trim() : elseContent.trim();
        });

        // 处理循环语句 {{#each array}} ... {{/each}}
        result = result.replace(/{{#each\s+(\w+)}}\s*([\s\S]*?)\s*{{\/each}}/g, (match, arrayName, content) => {
            const array = variables[arrayName];
            if (!Array.isArray(array)) return '';
            return array.map(item => {
                let itemContent = content;
                if (typeof item === 'object') {
                    Object.keys(item).forEach(key => {
                        itemContent = itemContent.replace(new RegExp(`{{${key}}}`, 'g'), item[key] || '');
                    });
                } else {
                    itemContent = itemContent.replace(/{{this}}/g, item);
                }
                return itemContent;
            }).join('\n');
        });

        // 处理简单变量替换 {{variable}}
        result = result.replace(/{{(\w+)}}/g, (match, varName) => {
            return variables[varName] || '';
        });

        // 处理旧的变量语法兼容 {variable}
        result = result.replace(/{(\w+)}/g, (match, varName) => {
            return variables[varName] || '';
        });

        return result.trim();
    }

    // 根据模板生成提示词（支持模板语法）
    async generatePrompt(templateId, params, imageGenerateService = null) {
        const template = await this.findById(templateId);
        if (!template) {
            throw new Error('Template not found');
        }

        const { prompt, style, isColor, styleNote } = params;

        // 处理非英文prompt翻译（如果提供了ImageGenerateService）
        let processedPrompt = prompt;
        if (imageGenerateService && imageGenerateService.isNonEnglish && imageGenerateService.translatePrompt) {
            if (imageGenerateService.isNonEnglish(prompt)) {
                try {
                    processedPrompt = await imageGenerateService.translatePrompt(prompt);
                } catch (error) {
                    console.warn('Translation failed, using original prompt:', error.message);
                    processedPrompt = prompt;
                }
            }
        }

        // 构建模板变量对象
        const hasStyle = style && style.trim() !== '';
        const hasStyleNote = styleNote && styleNote.trim() !== '';

        const templateVariables = {
            // 基础变量
            prompt: prompt,
            processedPrompt: processedPrompt,
            style: style || '',
            styleNote: styleNote || '',
            isColor: isColor,
            isMonochrome: !isColor,

            // 派生变量（完全按照原始 enhancePrompt 逻辑）
            hasStyle: hasStyle,
            hasStyleNote: hasStyleNote,
            styleText: hasStyle ? `${style} style` : 'professional tattoo',
            artStyleText: hasStyle ? `- Art style: ${style}` : '- Art style: Professional tattoo design',
            styleNotesSection: hasStyleNote ? `\nAdditional style notes:\n${styleNote}` : ''
        };

        // 使用模板解析引擎
        const enhancedPrompt = this.parseTemplate(template.prompt || '', templateVariables);

        return enhancedPrompt;
    }

    // 重写创建方法
    async create(data) {
        // 如果设置为默认模板，先取消其他默认模板
        if (data.isDefault) {
            await this.db.execute(`UPDATE ${this.tableName} SET isDefault = FALSE`);
        }

        return await super.create(data);
    }

    // 重写更新方法
    async update(id, data) {
        // 如果设置为默认模板，先取消其他默认模板
        if (data.isDefault) {
            await this.db.execute(`UPDATE ${this.tableName} SET isDefault = FALSE WHERE id != ?`, [id]);
        }

        return await super.update(id, data);
    }

    // 初始化默认模板
    async initializeDefaultTemplate() {
        const existingDefault = await this.getDefault();
        if (!existingDefault) {
            // 创建默认模板，完全基于原始 enhancePrompt 逻辑
            const defaultTemplate = {
                name: '默认纹身模板',
                prompt: `Create a {{styleText}} tattoo design based on: "{{processedPrompt}}"

Style specifications:
{{artStyleText}}
{{#if isColor}}
- IMPORTANT: Full color tattoo with BRIGHT, VIBRANT, SATURATED colors
- Rich color palette with strong saturation and contrast
- Colorful design with multiple distinct colors
- Vivid and eye-catching color scheme
- NEVER use black and grey only - must include bright colors
{{else}}
- IMPORTANT: Black and grey monochrome tattoo ONLY
- Use only black ink with grey shading and highlights
- NO color whatsoever - pure black and grey design
- Focus on detailed shading, gradients, and contrast
- Traditional black and grey tattoo style
{{/if}}
- Format: Clean tattoo design suitable for transfer to skin
- Composition: Well-balanced and proportioned for tattoo application

Technical requirements:
- High contrast and clear line definition
- Appropriate level of detail for tattoo medium
- Consider how the design will age over time
- Ensure all elements are tattoo-appropriate
{{#if isColor}}
- Emphasize the vibrant colors throughout the entire design
{{else}}
- Focus on rich black and grey tonal variations
{{/if}}

The design should be professional quality, original, and ready for use as a tattoo reference. Focus on creating bold, clean artwork that will translate well from digital design to actual skin application.{{#if hasStyleNote}}
Additional style notes:
{{styleNote}}{{/if}}`,
                isDefault: true
            };

            await this.create(defaultTemplate);
            console.log('Default prompt template created successfully');
        }
    }
}

module.exports = PromptTemplate;