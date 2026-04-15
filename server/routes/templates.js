const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const TEMPLATES_DIR = path.resolve(__dirname, '../../templates');

// Cache loaded manifests at startup
const manifestCache = {};

function loadManifests() {
  if (!fs.existsSync(TEMPLATES_DIR)) return;
  for (const entry of fs.readdirSync(TEMPLATES_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(TEMPLATES_DIR, entry.name, 'theme.json');
    if (!fs.existsSync(manifestPath)) continue;
    try {
      manifestCache[entry.name] = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch (err) {
      console.warn(`Failed to load template manifest: ${entry.name}`, err.message);
    }
  }
}

loadManifests();

// GET /api/templates
router.get('/templates', (_req, res) => {
  res.json(Object.values(manifestCache));
});

// GET /api/templates/:id
router.get('/templates/:id', (req, res) => {
  const manifest = manifestCache[req.params.id];
  if (!manifest) return res.status(404).json({ error: 'Template not found', code: 'NOT_FOUND' });
  res.json(manifest);
});

module.exports = { router, manifestCache, TEMPLATES_DIR };
