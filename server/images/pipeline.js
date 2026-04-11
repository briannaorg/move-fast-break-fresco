const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const quantize = require('quantize');
const db = require('../db/knex');

// Resolve relative to the server root (one level up from this file's directory),
// matching how server/index.js resolves the same env var.
const SERVER_ROOT = path.resolve(__dirname, '..');
const STORAGE_DIR = path.resolve(SERVER_ROOT, process.env.STORAGE_PATH || '../storage');

async function downloadBuffer(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Fresco/1.0 (museum image curation; https://github.com/fresco)' },
  });
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${url}`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function extractPalette(buffer, count = 6) {
  const { data, info } = await sharp(buffer)
    .resize(150, 150, { fit: 'inside' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = [];
  for (let i = 0; i < data.length; i += 3) {
    pixels.push([data[i], data[i + 1], data[i + 2]]);
  }

  const colorMap = quantize(pixels, count);
  if (!colorMap) return [];

  return colorMap.palette().map(([r, g, b]) => {
    const hex = (n) => n.toString(16).padStart(2, '0');
    return `#${hex(r)}${hex(g)}${hex(b)}`;
  });
}

async function generateVariants(buffer, imageId) {
  const variantsDir = path.join(STORAGE_DIR, 'variants');
  fs.mkdirSync(variantsDir, { recursive: true });

  const specs = [
    { type: 'thumbnail', width: 200 },
    { type: 'medium', width: 800 },
    { type: 'large', width: 1600 },
  ];

  const rows = [];
  for (const spec of specs) {
    const filename = `${imageId}_${spec.type}.jpg`;
    const filePath = path.join(variantsDir, filename);
    const { width, height } = await sharp(buffer)
      .resize(spec.width, null, { withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toFile(filePath);

    rows.push({
      image_id: imageId,
      variant_type: spec.type,
      path: `/storage/variants/${filename}`,
      width,
      height,
    });
  }

  return rows;
}

async function runPipeline(imageId, imageUrl) {
  try {
    await db('images').where({ id: imageId }).update({ status: 'processing' });

    const buffer = await downloadBuffer(imageUrl);

    // Save original
    const originalsDir = path.join(STORAGE_DIR, 'originals');
    fs.mkdirSync(originalsDir, { recursive: true });
    const originalFilename = `${imageId}.jpg`;
    const originalPath = `/storage/originals/${originalFilename}`;
    await sharp(buffer).jpeg({ quality: 90 }).toFile(path.join(originalsDir, originalFilename));

    const [variants, palette] = await Promise.all([
      generateVariants(buffer, imageId),
      extractPalette(buffer),
    ]);

    await db('image_variants').insert(variants);
    await db('images').where({ id: imageId }).update({
      original_path: originalPath,
      palette: JSON.stringify(palette),
      status: 'ready',
    });
  } catch (err) {
    console.error(`[pipeline] image ${imageId} failed:`, err.message);
    await db('images')
      .where({ id: imageId })
      .update({ status: 'error', error_message: err.message })
      .catch(() => {});
  }
}

module.exports = { runPipeline };
