const express = require('express');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const nunjucks = require('nunjucks');
const db = require('../db/knex');
const { manifestCache, TEMPLATES_DIR } = require('./templates');
const { buildDefaults, buildFontLinks, validateVar } = require('./previewHelpers');

const router = express.Router();

const STORAGE_DIR = path.resolve(__dirname, process.env.STORAGE_PATH || '../../storage');
const EXPORT_TEMPLATES_DIR = path.resolve(__dirname, '../export');

const exportNjkEnv = new nunjucks.Environment(
  new nunjucks.FileSystemLoader(EXPORT_TEMPLATES_DIR),
  { autoescape: true }
);

function parseJson(val, fallback) {
  try { return JSON.parse(val); } catch { return fallback; }
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'export';
}

// Resolve all var(--x) references in a CSS string to their static values
function resolveCssVars(css, vars) {
  return css.replace(/var\(--([a-z0-9-]+)\)/gi, (_, name) => vars[`--${name}`] || '');
}

// Rewrite /storage/variants/... paths to ./images/filename
function rewriteImagePaths(html) {
  return html.replace(/\/storage\/variants\/([^"'\s)]+)/g, './images/$1');
}

// Rewrite /templates/:id/... paths to relative ./ paths in exported HTML
function rewriteTemplatePaths(html) {
  return html
    .replace(/\/templates\/[^/]+\/style\.css/g, './css/style.css')
    .replace(/\/templates\/[^/]+\/script\.js/g, './js/script.js');
}

// POST /api/projects/:id/export
router.post('/projects/:id/export', async (req, res, next) => {
  try {
    const project = await db('projects').where({ id: req.params.id }).first();
    if (!project) return res.status(404).json({ error: 'Project not found', code: 'NOT_FOUND' });

    const templateId = project.template_id;
    if (!templateId) return res.status(400).json({ error: 'No template assigned', code: 'NO_TEMPLATE' });

    const manifest = manifestCache[templateId];
    if (!manifest) return res.status(404).json({ error: 'Template not found', code: 'TEMPLATE_NOT_FOUND' });

    const templateDir = path.join(TEMPLATES_DIR, templateId);

    // Load all project data
    const [pages, rawLayers] = await Promise.all([
      db('project_pages').where({ project_id: project.id }).orderBy('page_order'),
      db('project_layers')
        .leftJoin('image_variants', function () {
          this.on('image_variants.image_id', '=', 'project_layers.image_id')
              .andOn(db.raw("image_variants.variant_type = 'large'"));
        })
        .leftJoin('images', 'images.id', 'project_layers.image_id')
        .where('project_layers.project_id', project.id)
        .select(
          'project_layers.*',
          'image_variants.path as image_path',
          'images.title as image_title',
          'images.artist as image_artist',
          'images.date as image_date',
          'images.source as image_source',
          'images.source_url as image_source_url'
        ),
    ]);

    // Resolve CSS vars
    const defaults = buildDefaults(manifest);
    const saved = parseJson(project.customizations, {});
    const merged = { ...defaults, ...saved };
    for (const [layerKey, layerDef] of Object.entries(manifest.layers || {})) {
      const assignment = rawLayers.find((l) => l.layer_name === layerKey);
      if (assignment && assignment.image_path) {
        merged[layerDef.cssVar] = `url('${assignment.image_path}')`;
      }
    }
    const validated = {};
    for (const [cssVar, value] of Object.entries(merged)) {
      const result = validateVar(cssVar, value, manifest);
      validated[cssVar] = result !== null ? result : (defaults[cssVar] || '');
    }

    // Nunjucks render environment pointing at template dir (for export, paths are rewritten after)
    const siteNjkEnv = new nunjucks.Environment(
      new nunjucks.FileSystemLoader(TEMPLATES_DIR),
      { autoescape: false }
    );

    const cssVarsBlock = Object.entries(validated).map(([k, v]) => `  ${k}: ${v};`).join('\n');
    const fontLinks = buildFontLinks(manifest, validated);

    const projectSlug = slugify(project.name);
    const filename = `${projectSlug}.zip`;

    // Set up streaming zip
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Export-Filename', filename);

    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.on('error', (err) => { throw err; });
    archive.pipe(res);

    // Render each page
    for (const page of pages) {
      const pageContent = parseJson(page.content, {});
      const pageHtml = siteNjkEnv.render(path.join(templateId, manifest.files.html), {
        siteTitle: project.name,
        cssVars: cssVarsBlock,
        fontLinks,
        listenerScript: '',
        editScript: '',
        pageContent,
        editMode: false,
      });

      // Post-process: resolve var(--x), rewrite paths
      let finalHtml = resolveCssVars(pageHtml, validated);
      finalHtml = rewriteImagePaths(finalHtml);
      finalHtml = rewriteTemplatePaths(finalHtml);

      const pageSlug = page.page_name.replace(/\.[^.]+$/, '');
      archive.append(finalHtml, { name: `${projectSlug}/${pageSlug}.html` });
    }

    // Style.css with vars resolved
    const cssPath = path.join(templateDir, manifest.files.css);
    if (fs.existsSync(cssPath)) {
      const rawCss = fs.readFileSync(cssPath, 'utf8');
      const resolvedCss = resolveCssVars(rawCss, validated);
      archive.append(resolvedCss, { name: `${projectSlug}/css/style.css` });
    }

    // script.js unchanged
    const jsPath = path.join(templateDir, manifest.files.js);
    if (fs.existsSync(jsPath)) {
      archive.file(jsPath, { name: `${projectSlug}/js/script.js` });
    }

    // Images
    const imagePaths = new Set();
    for (const layer of rawLayers) {
      if (layer.image_path) {
        const absPath = path.join(STORAGE_DIR, layer.image_path.replace(/^\/storage\//, ''));
        const filename = path.basename(layer.image_path);
        if (fs.existsSync(absPath) && !imagePaths.has(filename)) {
          archive.file(absPath, { name: `${projectSlug}/images/${filename}` });
          imagePaths.add(filename);
        }
      }
    }

    // sources.html
    const museumLabels = { met: 'The Metropolitan Museum of Art', artic: 'Art Institute of Chicago', nypl: 'NYPL Digital Collections' };
    const imagesByMuseum = {};
    for (const layer of rawLayers) {
      if (!layer.image_source) continue;
      const museum = museumLabels[layer.image_source] || layer.image_source;
      (imagesByMuseum[museum] = imagesByMuseum[museum] || []).push({
        title: layer.image_title,
        artist: layer.image_artist,
        date: layer.image_date,
        source_url: layer.image_source_url,
      });
    }

    const sourcesHtml = exportNjkEnv.render('sources.njk', {
      projectName: project.name,
      templateName: manifest.name,
      imagesByMuseum,
      headingFont: validated['--heading-font'] || 'Georgia, serif',
      bodyFont: validated['--body-font'] || 'system-ui, sans-serif',
      primaryColor: validated['--primary-color'] || '#2c3e50',
      accentColor: validated['--accent-color'] || '#8b6f47',
      pageBg: validated['--page-bg'] || '#f5f0e8',
      textColor: validated['--text-color'] || '#1a1a1a',
    });
    archive.append(sourcesHtml, { name: `${projectSlug}/sources.html` });

    await archive.finalize();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
