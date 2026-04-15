const express = require('express');
const db = require('../db/knex');

const router = express.Router();

function parseJson(val, fallback) {
  try { return JSON.parse(val); } catch { return fallback; }
}

// GET /api/projects
router.get('/projects', async (req, res, next) => {
  try {
    const userId = 1;
    const projects = await db('projects').where({ user_id: userId }).orderBy('created_at', 'asc');
    res.json(projects.map((p) => ({ ...p, customizations: parseJson(p.customizations, {}) })));
  } catch (err) {
    next(err);
  }
});

// POST /api/projects
router.post('/projects', async (req, res, next) => {
  try {
    const { name, templateId } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'name is required', code: 'MISSING_NAME' });
    }
    const userId = 1;
    const [id] = await db('projects').insert({
      user_id: userId,
      name: name.trim(),
      template_id: templateId || null,
    });

    // Create default pages if a template was specified and the manifest has defaultPages
    if (templateId) {
      try {
        const { manifestCache } = require('./templates');
        const manifest = manifestCache[templateId];
        if (manifest && manifest.pages && Array.isArray(manifest.pages.defaultPages)) {
          const pages = manifest.pages.defaultPages.map((pageName, idx) => ({
            project_id: id,
            page_name: pageName,
            page_order: idx,
          }));
          await db('project_pages').insert(pages);
        }
      } catch (e) {
        // Non-fatal — template may not be loaded yet
        console.warn('Could not create default pages:', e.message);
      }
    }

    const project = await db('projects').where({ id }).first();
    res.status(201).json({ ...project, customizations: parseJson(project.customizations, {}) });
  } catch (err) {
    next(err);
  }
});

// GET /api/projects/:id
router.get('/projects/:id', async (req, res, next) => {
  try {
    const project = await db('projects').where({ id: req.params.id, user_id: 1 }).first();
    if (!project) return res.status(404).json({ error: 'Project not found', code: 'NOT_FOUND' });

    const [layers, pages] = await Promise.all([
      db('project_layers').where({ project_id: project.id }),
      db('project_pages').where({ project_id: project.id }).orderBy('page_order'),
    ]);

    res.json({
      ...project,
      customizations: parseJson(project.customizations, {}),
      layers: layers.map((l) => ({ ...l, settings: parseJson(l.settings, {}) })),
      pages,
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/projects/:id
router.patch('/projects/:id', async (req, res, next) => {
  try {
    const { name, templateId, customizations } = req.body;
    const updates = { updated_at: db.fn.now() };
    if (name != null) updates.name = name.trim();
    if (templateId !== undefined) updates.template_id = templateId;
    if (customizations != null) updates.customizations = JSON.stringify(customizations);

    const count = await db('projects').where({ id: req.params.id, user_id: 1 }).update(updates);
    if (!count) return res.status(404).json({ error: 'Project not found', code: 'NOT_FOUND' });

    const project = await db('projects').where({ id: req.params.id }).first();
    res.json({ ...project, customizations: parseJson(project.customizations, {}) });
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

// GET /api/projects/:id/layers
router.get('/projects/:id/layers', async (req, res, next) => {
  try {
    const layers = await db('project_layers').where({ project_id: req.params.id });
    res.json(layers.map((l) => ({ ...l, settings: parseJson(l.settings, {}) })));
  } catch (err) {
    next(err);
  }
});

// POST /api/projects/:id/layers — upsert a layer assignment
router.post('/projects/:id/layers', async (req, res, next) => {
  try {
    const projectId = parseInt(req.params.id, 10);
    const { layerName, imageId, blendMode, settings } = req.body;
    if (!layerName) {
      return res.status(400).json({ error: 'layerName is required', code: 'MISSING_LAYER_NAME' });
    }

    const existing = await db('project_layers').where({ project_id: projectId, layer_name: layerName }).first();

    if (imageId == null) {
      // Clear the layer
      if (existing) await db('project_layers').where({ id: existing.id }).delete();
      return res.json({ ok: true, cleared: true });
    }

    const row = {
      project_id: projectId,
      layer_name: layerName,
      image_id: imageId,
      blend_mode: blendMode || null,
      settings: JSON.stringify(settings || {}),
    };

    if (existing) {
      await db('project_layers').where({ id: existing.id }).update(row);
    } else {
      await db('project_layers').insert(row);
    }

    const layer = await db('project_layers').where({ project_id: projectId, layer_name: layerName }).first();
    res.json({ ...layer, settings: parseJson(layer.settings, {}) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
