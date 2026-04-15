/* Counterpane — template runtime */

// ── Particle system ───────────────────────────────────────────────────────────

const canvas = document.getElementById('particle-canvas');
const ctx = canvas ? canvas.getContext('2d') : null;

let particles = [];
let particleImg = null;
let animFrameId = null;

function getCSSVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function resize() {
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function makeParticle(imgW, imgH) {
  const scale = (0.04 + Math.random() * 0.06);
  const w = imgW * scale;
  const h = imgH * scale;
  return {
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    w,
    h,
    opacity: 0.12 + Math.random() * 0.22,
    rotation: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.002,
    driftX: (Math.random() - 0.5) * 0.25,
    driftY: -0.15 - Math.random() * 0.25,
  };
}

function spawnParticles(img) {
  const rawCount = parseInt(getCSSVar('--particle-count') || '18', 10);
  const count = isNaN(rawCount) ? 18 : Math.max(0, Math.min(rawCount, 120));
  particles = Array.from({ length: count }, () => makeParticle(img.naturalWidth || 64, img.naturalHeight || 64));
}

function drawParticles() {
  if (!ctx || !particleImg) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = p.opacity;
    ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
    ctx.rotate(p.rotation);
    ctx.drawImage(particleImg, -p.w / 2, -p.h / 2, p.w, p.h);
    ctx.restore();

    p.rotation += p.rotSpeed;
    p.x += p.driftX;
    p.y += p.driftY;

    // Wrap around edges
    if (p.y + p.h < 0) { p.y = window.innerHeight + p.h; p.x = Math.random() * window.innerWidth; }
    if (p.x + p.w < 0) p.x = window.innerWidth + p.w;
    if (p.x - p.w > window.innerWidth) p.x = -p.w;
  }
  animFrameId = requestAnimationFrame(drawParticles);
}

function startParticles(imageUrl) {
  if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
  if (!imageUrl || imageUrl === 'none') {
    ctx && ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    particleImg = img;
    spawnParticles(img);
    drawParticles();
  };
  img.src = imageUrl;
}

function resolveParticleUrl() {
  const raw = getCSSVar('--particle-image');
  // raw is e.g. "url('/storage/variants/42_large.jpg')" or "none"
  const match = raw.match(/url\(['"]?([^'")\s]+)['"]?\)/);
  return match ? match[1] : null;
}

function initParticles() {
  resize();
  const url = resolveParticleUrl();
  if (url) startParticles(url);
}

window.addEventListener('resize', () => {
  resize();
  if (particleImg) { ctx && ctx.clearRect(0, 0, canvas.width, canvas.height); }
});

// ── postMessage listener (Fresco live preview) ────────────────────────────────

function applyVars(vars) {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }

  // Re-evaluate particle image if it changed
  if ('--particle-image' in vars) {
    const raw = vars['--particle-image'];
    const match = raw && raw.match(/url\(['"]?([^'")\s]+)['"]?\)/);
    const url = match ? match[1] : null;
    startParticles(url);
  }

  // Update particle count if changed
  if ('--particle-count' in vars && particleImg) {
    spawnParticles(particleImg);
  }

  // Update bg-image on hero-bg div
  if ('--bg-image' in vars) {
    const heroBg = document.querySelector('.hero-bg');
    if (heroBg) heroBg.style.backgroundImage = vars['--bg-image'];
  }
}

window.addEventListener('message', ({ data }) => {
  if (!data || data.type !== 'UPDATE_CSS_VARS') return;
  applyVars(data.vars || {});
});

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', initParticles);
