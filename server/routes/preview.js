const express = require('express');
const path = require('path');
const nunjucks = require('nunjucks');
const db = require('../db/knex');
const { manifestCache, TEMPLATES_DIR } = require('./templates');

const router = express.Router();

// ── Nunjucks environment ───────────────────────────────────────────────────────
// No autoescape — we're generating HTML, not rendering user content into HTML.
// Template authors control the structure; we only inject validated values.
const nunjucksEnv = new nunjucks.Environment(
  new nunjucks.FileSystemLoader(TEMPLATES_DIR),
  { autoescape: false }
);

// ── CSS variable validation ────────────────────────────────────────────────────

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const RGB_RE = /^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(\s*,\s*[\d.]+)?\s*\)$/;
const SIZE_RE = /^\d+(\.\d+)?(px|em|rem|vh|vw|%)$/;
const URL_RE = /^url\(['"]?\/storage\/[^'")\s]+['"]?\)$|^none$/;

function validateVar(cssVar, value, manifest) {
  if (!value) return null;

  // Determine type from manifest
  const allColors = Object.values(manifest.colors || {});
  const colorDef = allColors.find((c) => c.cssVar === cssVar);
  if (colorDef) {
    return HEX_RE.test(value) || RGB_RE.test(value) ? value : null;
  }

  const typo = manifest.typography || {};
  const allSizes = Object.values(typo.sizes || {});
  const sizeDef = allSizes.find((s) => s.cssVar === cssVar);
  if (sizeDef) {
    return SIZE_RE.test(value) ? value : null;
  }

  // Font family vars — must contain one of the font names from an option
  if (typo.fontPair) {
    const { heading, body } = typo.fontPair.cssVars;
    if (cssVar === heading || cssVar === body) {
      const allFontNames = typo.fontPair.options.flatMap((o) => [o.heading, o.body]);
      const valid = allFontNames.some((name) => value.includes(name));
      return valid ? value : null;
    }
  }

  // Image layer vars — must be url('/storage/...') or none
  const allLayers = Object.values(manifest.layers || {});
  const layerDef = allLayers.find((l) => l.cssVar === cssVar);
  if (layerDef) {
    return URL_RE.test(value) ? value : 'none';
  }

  // Component settings — allow sizes or bare numbers
  const allComponents = Object.values(manifest.components || {});
  for (const comp of allComponents) {
    const settings = Object.values(comp.settings || {});
    const settingDef = settings.find((s) => s.cssVar === cssVar);
    if (settingDef) {
      // bare integer with optional unit suffix
      const numRe = /^\d+(\.\d+)?(px|em|rem|%)?$/;
      return numRe.test(value) ? value : null;
    }
  }

  // Unknown var — pass through (template may define its own vars)
  return value;
}

// ── Default CSS vars from theme.json ──────────────────────────────────────────

function buildDefaults(manifest) {
  const vars = {};

  for (const color of Object.values(manifest.colors || {})) {
    vars[color.cssVar] = color.default;
  }

  const typo = manifest.typography || {};
  if (typo.fontPair && typo.fontPair.options.length) {
    const first = typo.fontPair.options[0];
    vars[typo.fontPair.cssVars.heading] = `'${first.heading}', serif`;
    vars[typo.fontPair.cssVars.body] = `'${first.body}', sans-serif`;
  }
  for (const size of Object.values(typo.sizes || {})) {
    vars[size.cssVar] = size.default;
  }

  for (const comp of Object.values(manifest.components || {})) {
    for (const setting of Object.values(comp.settings || {})) {
      vars[setting.cssVar] = setting.default + (setting.unit || '');
    }
  }

  for (const layer of Object.values(manifest.layers || {})) {
    vars[layer.cssVar] = 'none';
  }

  return vars;
}

// ── Font link tag generation ───────────────────────────────────────────────────

function buildFontLinks(manifest, customizations) {
  const typo = manifest.typography;
  if (!typo || !typo.fontPair) return null;

  const { heading: headingVar, body: bodyVar } = typo.fontPair.cssVars;
  const headingVal = customizations[headingVar] || '';
  const bodyVal = customizations[bodyVar] || '';

  // Find which font pair option is active
  const activePair = typo.fontPair.options.find(
    (o) => headingVal.includes(o.heading) && bodyVal.includes(o.body)
  ) || typo.fontPair.options[0];

  if (!activePair) return null;

  const fonts = manifest.fonts || {};
  const families = [];

  for (const fontName of [activePair.heading, activePair.body]) {
    const fontDef = fonts[fontName];
    if (fontDef && fontDef.googleFamily) {
      families.push(fontDef.googleFamily);
    }
  }

  if (!families.length) return null;

  return `https://fonts.googleapis.com/css2?${families.map((f) => `family=${f}`).join('&')}&display=swap`;
}

// ── Preview handler ────────────────────────────────────────────────────────────

function parseJson(val, fallback) {
  try { return JSON.parse(val); } catch { return fallback; }
}

router.get('/preview/:projectId', async (req, res, next) => {
  try {
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

    // Merge: defaults → project customizations → layer image assignments
    const defaults = buildDefaults(manifest);
    const saved = parseJson(project.customizations, {});
    const merged = { ...defaults, ...saved };

    // Apply layer image paths
    for (const [layerKey, layerDef] of Object.entries(manifest.layers || {})) {
      const assignment = rawLayers.find((l) => l.layer_name === layerKey);
      if (assignment && assignment.image_path) {
        merged[layerDef.cssVar] = `url('${assignment.image_path}')`;
      }
    }

    // Validate all values; fall back to defaults for invalid ones
    const validated = {};
    for (const [cssVar, value] of Object.entries(merged)) {
      const result = validateVar(cssVar, value, manifest);
      validated[cssVar] = result !== null ? result : (defaults[cssVar] || '');
    }

    // Build the :root CSS vars block (one per line, indented)
    const cssVars = Object.entries(validated)
      .map(([k, v]) => `  ${k}: ${v};`)
      .join('\n');

    // Build Google Fonts link URL for active font pair only
    const fontLinks = buildFontLinks(manifest, validated);

    // postMessage listener script (injected as raw HTML via | safe in template)
    const listenerScript = `<script>
(function() {
  function applyVars(vars) {
    var root = document.documentElement;
    for (var k in vars) {
      if (Object.prototype.hasOwnProperty.call(vars, k)) {
        root.style.setProperty(k, vars[k]);
      }
    }
  }
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'UPDATE_CSS_VARS') applyVars(e.data.vars || {});
  });
})();
</script>`;

    // Render via Nunjucks
    const templateFile = path.join(templateId, manifest.files.html);
    const html = nunjucksEnv.render(templateFile, {
      siteTitle: project.name,
      cssVars,
      fontLinks,
      listenerScript,
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.send(html);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
