// Shared helpers for preview rendering and export pipeline.

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const RGB_RE = /^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(\s*,\s*[\d.]+)?\s*\)$/;
const SIZE_RE = /^\d+(\.\d+)?(px|em|rem|vh|vw|%)$/;
const URL_RE = /^url\(['"]?\/storage\/[^'")\s]+['"]?\)$|^none$/;

function validateVar(cssVar, value, manifest) {
  if (!value) return null;

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

  if (typo.fontPair) {
    const { heading, body } = typo.fontPair.cssVars;
    if (cssVar === heading || cssVar === body) {
      const allFontNames = typo.fontPair.options.flatMap((o) => [o.heading, o.body]);
      const valid = allFontNames.some((name) => value.includes(name));
      return valid ? value : null;
    }
  }

  const allLayers = Object.values(manifest.layers || {});
  const layerDef = allLayers.find((l) => l.cssVar === cssVar);
  if (layerDef) {
    return URL_RE.test(value) ? value : 'none';
  }

  const allComponents = Object.values(manifest.components || {});
  for (const comp of allComponents) {
    const settings = Object.values(comp.settings || {});
    const settingDef = settings.find((s) => s.cssVar === cssVar);
    if (settingDef) {
      const numRe = /^\d+(\.\d+)?(px|em|rem|%)?$/;
      return numRe.test(value) ? value : null;
    }
  }

  return value;
}

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

function buildFontLinks(manifest, customizations) {
  const typo = manifest.typography;
  if (!typo || !typo.fontPair) return null;

  const { heading: headingVar, body: bodyVar } = typo.fontPair.cssVars;
  const headingVal = customizations[headingVar] || '';
  const bodyVal = customizations[bodyVar] || '';

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

module.exports = { validateVar, buildDefaults, buildFontLinks };
