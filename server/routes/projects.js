const express = require('express');
const db = require('../db/knex');

const router = express.Router();

// GET /api/projects
router.get('/projects', async (req, res, next) => {
  try {
    const userId = 1;
    const projects = await db('projects').where({ user_id: userId }).orderBy('created_at', 'asc');
    res.json(projects);
  } catch (err) {
    next(err);
  }
});

// POST /api/projects
router.post('/projects', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'name is required', code: 'MISSING_NAME' });
    }
    const userId = 1;
    const [id] = await db('projects').insert({ user_id: userId, name: name.trim() });
    const project = await db('projects').where({ id }).first();
    res.status(201).json(project);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/projects/:id
router.delete('/projects/:id', async (req, res, next) => {
  try {
    const deleted = await db('projects').where({ id: req.params.id, user_id: 1 }).delete();
    if (!deleted) return res.status(404).json({ error: 'Project not found', code: 'NOT_FOUND' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
