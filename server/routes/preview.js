const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../db/knex');
const { manifestCache, TEMPLATES_DIR } = require('./templates');

const router = express.Router();

function parseJson(val, fallback) {
  try { return JSON.parse(val); } catch { return fallback; }
}

function buildCssVars(customizations, layers, manifest) {
  const vars = {};

  // Defaults from theme.json
  if (manifest) {
    for (const [, color] of Object.entries(manifest.colors || {})) {
      vars[color.cssVar] = color.default;
    }
    const typo = manifest.typography || {};
    if (typo.fontPair && typo.fontPair.options && typo.fontPair.options.length) {
      const first = typo.fontPair.options[0];
      const { heading, body } = typo.fontPair.cssVars;
      vars[heading] = `'${first.heading}', serif`;
      vars[body] = `'${first.body}', sans-serif`;
    }
    for (const [, size] of Object.entries(typo.sizes || {})) {
      vars[size.cssVar] = size.default;
    }
    for (const [, comp] of Object.entries(manifest.components || {})) {
      for (const [, setting] of Object.entries(comp.settings || {})) {
        vars[setting.cssVar] = setting.default + (setting.unit || '');
      }
    }
  }

  // Project customizations override defaults
  for (const [k, v] of Object.entries(customizations || {})) {
    vars[k] = v;
  }

  // Layer image assignments override everything
  if (manifest && layers) {
    for (const [layerKey, layerDef] of Object.entries(manifest.layers || {})) {
      const assignment = layers.find((l) => l.layer_name === layerKey);
      if (assignment && assignment.image_path) {
        vars[layerDef.cssVar] = `url('${assignment.image_path}')`;
      } else {
        vars[layerDef.cssVar] = vars[layerDef.cssVar] || 'none';
      }
    }
  }

  return vars;
}

// GET /preview/:projectId
router.get('/preview/:projectId', async (req, res, next) => {
  try {
    const project = await db('projects').where({ id: req.params.projectId }).first();
    if (!project) return res.status(404).send('<p>Project not found</p>');

    const templateId = project.template_id;
    if (!templateId) {
      return res.status(400).send('<html><body style="font-family:sans-serif;padding:40px;color:#666"><p>No template selected for this project.</p></body></html>');
    }

    const manifest = manifestCache[templateId];
    if (!manifest) return res.status(404).send('<p>Template not found</p>');

    const templateDir = path.join(TEMPLATES_DIR, templateId);
    const htmlPath = path.join(templateDir, manifest.files.html);
    if (!fs.existsSync(htmlPath)) return res.status(404).send('<p>Template HTML not found</p>');

    let html = fs.readFileSync(htmlPath, 'utf8');

    // Load project layers with image variant paths
    const rawLayers = await db('project_layers')
      .leftJoin('image_variants', function () {
        this.on('image_variants.image_id', '=', 'project_layers.image_id')
            .andOn(db.raw("image_variants.variant_type = 'large'"));
      })
      .where('project_layers.project_id', project.id)
      .select('project_layers.*', 'image_variants.path as image_path');

    const customizations = parseJson(project.customizations, {});
    const cssVars = buildCssVars(customizations, rawLayers, manifest);

    // Build :root CSS block
    const cssBlock = Object.entries(cssVars)
      .map(([k, v]) => `  ${k}: ${v};`)
      .join('\n');

    const injectStyle = `<style>:root {\n${cssBlock}\n}</style>`;

    // postMessage listener that allows the parent Fresco app to push CSS var updates
    const listenerScript = `<script>
(function() {
  function applyVars(vars) {
    var root = document.documentElement;
    for (var k in vars) { if (vars.hasOwnProperty(k)) root.style.setProperty(k, vars[k]); }
  }
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'UPDATE_CSS_VARS') applyVars(e.data.vars || {});
  });
})();
</script>`;

    // Rewrite relative asset paths (css, js) to absolute template-dir URLs
    html = html
      .replace(/(<link[^>]+href=["'])(?!https?:\/\/|\/)(style\.css)/gi, `$1/templates/${templateId}/$2`)
      .replace(/(<script[^>]+src=["'])(?!https?:\/\/|\/)(script\.js)/gi, `$1/templates/${templateId}/$2`);

    // Inject style + listener into <head>
    html = html.replace('</head>', `${injectStyle}\n${listenerScript}\n</head>`);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.send(html);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
