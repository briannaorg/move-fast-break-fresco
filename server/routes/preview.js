const express = require('express');
const path = require('path');
const nunjucks = require('nunjucks');
const db = require('../db/knex');
const { manifestCache, TEMPLATES_DIR } = require('./templates');
const { validateVar, buildDefaults, buildFontLinks } = require('./previewHelpers');

const router = express.Router();

const nunjucksEnv = new nunjucks.Environment(
  new nunjucks.FileSystemLoader(TEMPLATES_DIR),
  { autoescape: false }
);

// ── Preview handler ────────────────────────────────────────────────────────────

function parseJson(val, fallback) {
  try { return JSON.parse(val); } catch { return fallback; }
}

router.get('/preview/:projectId', async (req, res, next) => {
  try {
    const editMode = req.query.mode === 'edit';
    const pageName = req.query.page || null;

    const project = await db('projects').where({ id: req.params.projectId }).first();
    if (!project) {
      return res.status(404).send('<p>Project not found</p>');
    }

    const templateId = project.template_id;
    if (!templateId) {
      return res.status(400).send(
        '<html><body style="font-family:sans-serif;padding:40px;color:#666"><p>No template selected for this project.</p></body></html>'
      );
    }

    const manifest = manifestCache[templateId];
    if (!manifest) {
      return res.status(404).send('<p>Template not found</p>');
    }

    // Load layer assignments with resolved image paths
    const rawLayers = await db('project_layers')
      .leftJoin('image_variants', function () {
        this.on('image_variants.image_id', '=', 'project_layers.image_id')
            .andOn(db.raw("image_variants.variant_type = 'large'"));
      })
      .where('project_layers.project_id', project.id)
      .select('project_layers.*', 'image_variants.path as image_path');

    // Load page content
    let pageContent = {};
    if (pageName || editMode) {
      const pageQuery = db('project_pages').where({ project_id: project.id });
      const page = pageName
        ? await pageQuery.where({ page_name: pageName }).first()
        : await pageQuery.orderBy('page_order').first();
      if (page) pageContent = parseJson(page.content, {});
    }

    // Merge: defaults → project customizations → layer image assignments
    const defaults = buildDefaults(manifest);
    const saved = parseJson(project.customizations, {});
    const merged = { ...defaults, ...saved };

    for (const [layerKey, layerDef] of Object.entries(manifest.layers || {})) {
      const assignment = rawLayers.find((l) => l.layer_name === layerKey);
      if (assignment && assignment.image_path) {
        merged[layerDef.cssVar] = `url('${assignment.image_path}')`;
      }
    }

    // Validate
    const validated = {};
    for (const [cssVar, value] of Object.entries(merged)) {
      const result = validateVar(cssVar, value, manifest);
      validated[cssVar] = result !== null ? result : (defaults[cssVar] || '');
    }

    const cssVars = Object.entries(validated)
      .map(([k, v]) => `  ${k}: ${v};`)
      .join('\n');

    const fontLinks = buildFontLinks(manifest, validated);

    // Base postMessage listener (always injected)
    const listenerScript = `<script>
(function() {
  function applyVars(vars) {
    var root = document.documentElement;
    for (var k in vars) {
      if (Object.prototype.hasOwnProperty.call(vars, k)) root.style.setProperty(k, vars[k]);
    }
  }
  window.addEventListener('message', function(e) {
    if (!e.data) return;
    if (e.data.type === 'UPDATE_CSS_VARS') applyVars(e.data.vars || {});
    if (e.data.type === 'EXEC_COMMAND' && e.data.command) {
      document.execCommand(e.data.command, false, e.data.value || null);
    }
  });
})();
</script>`;

    // Edit mode extras: contenteditable + change reporter + focus reporter
    const editScript = editMode ? `<script>
(function() {
  document.addEventListener('DOMContentLoaded', function() {
    var els = document.querySelectorAll('[data-editable]');
    els.forEach(function(el) {
      el.setAttribute('contenteditable', 'true');
      el.addEventListener('input', function() {
        window.parent.postMessage({ type: 'CONTENT_CHANGE', key: el.dataset.editable, value: el.innerHTML }, '*');
      });
      el.addEventListener('focus', function() {
        var rect = el.getBoundingClientRect();
        window.parent.postMessage({ type: 'FOCUS_EDITABLE', key: el.dataset.editable, rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height } }, '*');
      });
      el.addEventListener('blur', function() {
        window.parent.postMessage({ type: 'BLUR_EDITABLE', key: el.dataset.editable }, '*');
      });
    });
  });
})();
</script>
<style>
[data-editable]:focus { outline: 2px solid #4a90d9; outline-offset: 2px; cursor: text; }
[data-editable] { min-height: 1em; }
</style>` : '';

    const templateFile = path.join(templateId, manifest.files.html);
    const html = nunjucksEnv.render(templateFile, {
      siteTitle: project.name,
      cssVars,
      fontLinks,
      listenerScript,
      editScript,
      pageContent,
      editMode,
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.send(html);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
