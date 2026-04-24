const express = require('express');
const db = require('../db/knex');

const router = express.Router();

function parseJson(val, fallback) {
  try { return JSON.parse(val); } catch { return fallback; }
}

// GET /api/projects/:id/pages
router.get('/projects/:id/pages', async (req, res, next) => {
  try {
    const pages = await db('project_pages')
      .where({ project_id: req.params.id })
      .orderBy('page_order');
    res.json(pages.map((p) => ({ ...p, content: parseJson(p.content, {}) })));
  } catch (err) {
    next(err);
  }
});

// POST /api/projects/:id/pages
router.post('/projects/:id/pages', async (req, res, next) => {
  try {
    const { pageName } = req.body;
    if (!pageName || !pageName.trim()) {
      return res.status(400).json({ error: 'pageName is required', code: 'MISSING_NAME' });
    }
    const maxOrder = await db('project_pages')
      .where({ project_id: req.params.id })
      .max('page_order as m')
      .first();
    const nextOrder = (maxOrder?.m ?? -1) + 1;
    const [id] = await db('project_pages').insert({
      project_id: req.params.id,
      page_name: pageName.trim(),
      page_order: nextOrder,
    });
    const page = await db('project_pages').where({ id }).first();
    res.status(201).json({ ...page, content: parseJson(page.content, {}) });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/projects/:id/pages/order  — must come before /:pageId route
router.patch('/projects/:id/pages/order', async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) {
      return res.status(400).json({ error: 'ids must be an array', code: 'INVALID_IDS' });
    }
    await db.transaction(async (trx) => {
      for (let i = 0; i < ids.length; i++) {
        await trx('project_pages')
          .where({ id: ids[i], project_id: req.params.id })
          .update({ page_order: i });
      }
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/projects/:id/pages/:pageId
router.patch('/projects/:id/pages/:pageId', async (req, res, next) => {
  try {
    const { pageName, content } = req.body;
    const updates = {};
    if (pageName != null) updates.page_name = pageName.trim();
    if (content != null) updates.content = JSON.stringify(content);

    const count = await db('project_pages')
      .where({ id: req.params.pageId, project_id: req.params.id })
      .update(updates);
    if (!count) return res.status(404).json({ error: 'Page not found', code: 'NOT_FOUND' });

    const page = await db('project_pages').where({ id: req.params.pageId }).first();
    res.json({ ...page, content: parseJson(page.content, {}) });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/projects/:id/pages/:pageId
router.delete('/projects/:id/pages/:pageId', async (req, res, next) => {
  try {
    const deleted = await db('project_pages')
      .where({ id: req.params.pageId, project_id: req.params.id })
      .delete();
    if (!deleted) return res.status(404).json({ error: 'Page not found', code: 'NOT_FOUND' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
