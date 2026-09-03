#!/usr/bin/env node
/**
 * build-icons.cjs
 * Generates app icons for the IAM & SSO 3D Lab desktop app.
 *
 * Design: Teal shield with inset padlock + "IAM" monogram.
 *         Dark background (#0e1116) + teal accent (#4ec9b0) + white (#e6e6e6).
 *
 * Outputs:
 *   build/icon.svg          – source vector (no background)
 *   build/icon-16.png       – 16×16
 *   build/icon-32.png       – 32×32
 *   build/icon-48.png       – 48×48
 *   build/icon-64.png       – 64×64
 *   build/icon-128.png      – 128×128
 *   build/icon-256.png      – 256×256
 *   build/icon-512.png      – 512×512
 *   build/icon.ico          – multi-resolution Windows icon
 *   public/favicon.svg      – project favicon (updated)
 */

const fs   = require('fs');
const path = require('path');
const sharp = require('sharp');
const pngToIcoMod = require('png-to-ico');
const pngToIco = pngToIcoMod.default || pngToIcoMod.imagesToIco || pngToIcoMod;

const ROOT = path.dirname(__filename);
const OUT  = path.join(ROOT, 'build');
const PUB  = path.join(ROOT, 'public');

if (!fs.existsSync(OUT))  fs.mkdirSync(OUT,  { recursive: true });

// ─── Color palette ───────────────────────────────────────────────────────────
const C = {
  bg:      '#0e1116',   // dark navy — app background
  teal:    '#4ec9b0',    // accent — shield / padlock ring
  tealDim: '#2a7a6a',    // darker teal — shield border
  white:   '#e6e6e6',    // off-white — padlock body, text
  keyGold: '#d7ba7d',    // warm gold — key element
};

// ─── Shield path (points, centred at 0,0 in a 100×100 viewBox) ───────────────
// A classic flat-top shield with a slight curve at the bottom.
const SHIELD = [
  'M -46,-46 L 46,-46 L 46,-10 Q 46,42 0,60 Q -46,42 -46,-10 Z'
].join('');

// Padlock body (rounded rect centred at 0,+18 in a 100×100 viewBox)
const LOCK_BODY = 'M -16,6 L 16,6 Q 20,6 20,10 L 20,34 Q 20,38 16,38 L -16,38 Q -20,38 -20,34 L -20,10 Q -20,6 -16,6 Z';

// Padlock shackle (arc from -12,-10 to 12,-10, rising to y=-26)
const LOCK_SHACKLE = 'M -12,6 L -12,-14 Q -12,-26 0,-26 Q 12,-26 12,-14 L 12,6';

// ─── Compose one size ────────────────────────────────────────────────────────
async function renderSize(size) {
  // Full scene SVG with a dark rounded-rect background so transparency is
  // handled consistently even on Windows taskbar.
  const scene = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <defs>
    <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%"   stop-color="${C.teal}"    stop-opacity="0.85"/>
      <stop offset="100%" stop-color="${C.tealDim}" stop-opacity="0.9"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="${Math.max(1, size / 32)}" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- Dark background plate -->
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.18)}" fill="${C.bg}"/>

  <!-- Shield body -->
  <g transform="translate(${size/2},${size/2}) scale(${size/100})">
    <path d="${SHIELD}" fill="url(#shieldGrad)" stroke="${C.teal}" stroke-width="3"/>
    <!-- Shield inner highlight line -->
    <path d="${SHIELD}" fill="none" stroke="${C.white}" stroke-width="1" stroke-opacity="0.15"/>

    <!-- Padlock shackle -->
    <path d="${LOCK_SHACKLE}" fill="none" stroke="${C.white}" stroke-width="5" stroke-linecap="round"/>
    <!-- Padlock body -->
    <path d="${LOCK_BODY}" fill="${C.white}"/>
    <!-- Padlock keyhole -->
    <circle cx="0" cy="18" r="${4}"   fill="${C.bg}"/>
    <rect   x="${-2.5}" y="18" width="5" height="8" rx="1.5" fill="${C.bg}"/>

    <!-- Small "IAM" monogram below the lock -->
    <text x="0" y="48"
          text-anchor="middle"
          font-family="system-ui, 'Segoe UI', Arial, sans-serif"
          font-size="13"
          font-weight="700"
          letter-spacing="1"
          fill="${C.white}"
          fill-opacity="0.9">IAM</text>
  </g>
</svg>`;

  const buf = Buffer.from(scene);
  const png = await sharp(buf)
    .resize(size, size, { fit: 'contain', background: { r: 14, g: 17, b: 22, alpha: 1 } })
    .png()
    .toBuffer();
  return png;
}

// ─── Build the PNG set ───────────────────────────────────────────────────────
const SIZES = [16, 32, 48, 64, 128, 256, 512];
const pngs   = {};

async function main() {
  for (const s of SIZES) {
    const buf  = await renderSize(s);
    const file = path.join(OUT, `icon-${s}.png`);
    fs.writeFileSync(file, buf);
    pngs[s] = file;
    console.log(`  ✓ icon-${s}.png`);
  }

  // ─── Copy source SVG ─────────────────────────────────────────────────────
  const svgSource = await renderSize(512);
  fs.writeFileSync(path.join(OUT, 'icon.svg'), svgSource);
  fs.writeFileSync(path.join(PUB,  'favicon.svg'), svgSource);
  console.log('  ✓ icon.svg (build/)');
  console.log('  ✓ favicon.svg (public/)');

  // ─── Build .ico from 48, 64, 128, 256 PNGs ───────────────────────────────
  const icoInputs = [48, 64, 128, 256].map(s => pngs[s]);
  const icoBuf    = await pngToIco(icoInputs);
  fs.writeFileSync(path.join(OUT, 'icon.ico'), icoBuf);
  console.log('  ✓ icon.ico  (multi-resolution: 48 / 64 / 128 / 256)');

  console.log('\nIcon build complete → app/build/');
}

main().catch((err) => {
  console.error('Icon build failed:', err);
  process.exit(1);
});
