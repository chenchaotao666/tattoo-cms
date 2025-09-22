const express = require('express');
const { createModels } = require('../models');
const IdeaService = require('../services/IdeaService');
const { createBaseRoutes } = require('./baseRoutes');

const router = express.Router();

// 创建创意路由 - 提供基础CRUD功能和扩展功能
function createIdeaRoutes(app) {
    const db = app.locals.db;
    const models = createModels(db);
    const ideaService = new IdeaService(models.Idea);

    // 使用基础CRUD路由
    const baseRoutes = createBaseRoutes(ideaService, 'Idea');
    router.use('/', baseRoutes);

    // 批量创建创意
    router.post('/batch', async (req, res) => {
        try {
            const { ideas } = req.body;
            if (!Array.isArray(ideas)) {
                return res.status(400).json(ideaService.formatResponse(false, null, 'Ideas array is required'));
            }

            const { v4: uuidv4 } = require('uuid');
            const now = new Date();

            const processedData = ideas.map(idea => ({
                id: idea.id || uuidv4(),
                title: idea.title,
                prompt: idea.prompt,
                createdAt: now,
                updatedAt: now
            }));

            const fields = ['id', 'title', 'prompt', 'createdAt', 'updatedAt'];
            const placeholders = processedData.map(() => `(${fields.map(() => '?').join(',')})`).join(',');
            const values = processedData.flatMap(idea => fields.map(field => 
                typeof idea[field] === 'object' ? JSON.stringify(idea[field]) : idea[field]
            ));

            const query = `INSERT INTO ideas (${fields.join(',')}) VALUES ${placeholders}`;
            const [result] = await models.Idea.db.execute(query, values);

            const response = {
                success: true,
                message: `${result.affectedRows} ideas created successfully`,
                insertedCount: result.affectedRows,
                insertedIds: processedData.map(idea => idea.id)
            };

            res.status(201).json(ideaService.formatResponse(true, response, 'Ideas created successfully'));
        } catch (error) {
            console.error('Batch create ideas error:', error);
            res.status(500).json(ideaService.formatResponse(false, null, error.message));
        }
    });

    // 随机获取创意
    router.get('/random', async (req, res) => {
        try {
            const { limit = 5 } = req.query;
            const query = `SELECT * FROM ideas ORDER BY RAND() LIMIT ?`;
            const [rows] = await models.Idea.db.execute(query, [parseInt(limit)]);
            res.json(ideaService.formatResponse(true, rows, 'Random ideas retrieved successfully'));
        } catch (error) {
            console.error('Get random ideas error:', error);
            res.status(500).json(ideaService.formatResponse(false, null, error.message));
        }
    });

    return router;
}

// 导出路由工厂函数
module.exports = (app) => {
    return createIdeaRoutes(app);
};