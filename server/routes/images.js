const express = require('express');
const db = require('../db/knex');
const { runPipeline } = require('../images/pipeline');

const router = express.Router();

function parseJson(val, fallback) {
  try { return JSON.parse(val); } catch { return fallback; }
}

// GET /api/images?tag=...&userId=...
router.get('/images', async (req, res, next) => {
  try {
    const userId = parseInt(req.query.userId || '1', 10);
    const tag = req.query.tag;

    let query = db('images').where('images.user_id', userId).orderBy('images.created_at', 'desc');

    if (tag) {
      query = query
        .join('image_tags', 'image_tags.image_id', 'images.id')
        .where('image_tags.tag', tag)
        .distinct('images.*');
    }

    const images = await query;

    const ids = images.map((img) => img.id);
    const [variants, tags] = await Promise.all([
      ids.length ? db('image_variants').whereIn('image_id', ids) : [],
      ids.length ? db('image_tags').whereIn('image_id', ids) : [],
    ]);

    const variantsByImage = {};
    for (const v of variants) {
      (variantsByImage[v.image_id] = variantsByImage[v.image_id] || []).push(v);
    }
    const tagsByImage = {};
    for (const t of tags) {
      (tagsByImage[t.image_id] = tagsByImage[t.image_id] || []).push(t.tag);
    }

    res.json(
      images.map((img) => ({
        ...img,
        palette: parseJson(img.palette, []),
        metadata: parseJson(img.metadata, {}),
        variants: variantsByImage[img.id] || [],
        tags: tagsByImage[img.id] || [],
      }))
    );
  } catch (err) {
    next(err);
  }
});

// GET /api/images/:id
router.get('/images/:id', async (req, res, next) => {
  try {
    const image = await db('images').where({ id: req.params.id }).first();
    if (!image) return res.status(404).json({ error: 'Image not found', code: 'NOT_FOUND' });

    const [variants, tags] = await Promise.all([
      db('image_variants').where({ image_id: image.id }),
      db('image_tags').where({ image_id: image.id }).pluck('tag'),
    ]);

    res.json({
      ...image,
      palette: parseJson(image.palette, []),
      metadata: parseJson(image.metadata, {}),
      variants,
      tags,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/images — save a new image and kick off the pipeline.
// Optional body fields: projectId, tags[], templateTypes[], blendModes[]
router.post('/images', async (req, res, next) => {
  try {
    const {
      sourceId, source, title, artist, date, imageUrl, sourceUrl, metadata,
      projectId, tags: rawTags, templateTypes, blendModes,
    } = req.body;

    if (!sourceId || !source || !imageUrl) {
      return res.status(400).json({ error: 'sourceId, source, and imageUrl are required', code: 'MISSING_FIELDS' });
    }

    const userId = 1; // Phase 1: hardcoded default user

    let imageId;
    let isNew = false;

    const existing = await db('images').where({ source, source_id: sourceId, user_id: userId }).first();
    if (existing) {
      imageId = existing.id;
    } else {
      const [id] = await db('images').insert({
        user_id: userId,
        source,
        source_id: sourceId,
        title: title || null,
        artist: artist || null,
        date: date || null,
        source_url: sourceUrl || null,
        metadata: JSON.stringify(metadata || {}),
        status: 'pending',
      });
      imageId = id;
      isNew = true;
      setImmediate(() => runPipeline(imageId, imageUrl));
    }

    // Merge tags (add new, keep existing)
    if (Array.isArray(rawTags) && rawTags.length) {
      const newTags = [...new Set(rawTags.map((t) => String(t).trim().toLowerCase()).filter(Boolean))];
      const existingTags = await db('image_tags').where({ image_id: imageId }).pluck('tag');
      const toInsert = newTags.filter((t) => !existingTags.includes(t));
      if (toInsert.length) {
        await db('image_tags').insert(toInsert.map((tag) => ({ image_id: imageId, tag })));
      }
    }

    // Associate with project
    if (projectId) {
      await db('project_images')
        .insert({
          project_id: projectId,
          image_id: imageId,
          template_types: JSON.stringify(Array.isArray(templateTypes) ? templateTypes : []),
          blend_modes: JSON.stringify(Array.isArray(blendModes) ? blendModes : []),
        })
        .onConflict(['project_id', 'image_id'])
        .merge(['template_types', 'blend_modes']);
    }

    const image = await db('images').where({ id: imageId }).first();
    const [variants, tags] = await Promise.all([
      db('image_variants').where({ image_id: imageId }),
      db('image_tags').where({ image_id: imageId }).pluck('tag'),
    ]);

    res.status(isNew ? 201 : 200).json({
      ...image,
      palette: parseJson(image.palette, []),
      metadata: parseJson(image.metadata, {}),
      variants,
      tags,
      alreadySaved: !isNew,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/images/:id/tags — replace tag list
router.post('/images/:id/tags', async (req, res, next) => {
  try {
    const imageId = parseInt(req.params.id, 10);
    const image = await db('images').where({ id: imageId }).first();
    if (!image) return res.status(404).json({ error: 'Image not found', code: 'NOT_FOUND' });

    const raw = req.body.tags;
    if (!Array.isArray(raw)) {
      return res.status(400).json({ error: 'tags must be an array', code: 'INVALID_TAGS' });
    }

    const tags = [...new Set(raw.map((t) => String(t).trim().toLowerCase()).filter(Boolean))];

    await db('image_tags').where({ image_id: imageId }).delete();
    if (tags.length) {
      await db('image_tags').insert(tags.map((tag) => ({ image_id: imageId, tag })));
    }

    res.json({ tags });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
