#!/usr/bin/env node
// generate-icons.mjs — regenerates EVERY icon asset from tools/icon-source.mjs.
// Run:  npm run icons
// No external dependencies. Change THEME in icon-source.mjs and re-run.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { THEME, markSVG, splashSVG } from './icon-source.mjs';
import { renderMark, encodePNG, encodeICO } from './raster.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const iconsDir = path.join(root, 'src', 'icons');
const buildDir = path.join(root, 'build');
fs.mkdirSync(iconsDir, { recursive: true });
fs.mkdirSync(buildDir, { recursive: true });

const PNG_SIZES = [16, 32, 48, 64, 128, 192, 256, 512];
const ICO_SIZES = [16, 32, 48, 64, 128, 256];

const png = (size, opts) => encodePNG(renderMark(size, THEME, opts).toRGBA(), size);
const write = (p, buf) => {
  fs.writeFileSync(p, buf);
  console.log(`  ${path.relative(root, p).padEnd(38)} ${String(buf.length).padStart(7)} bytes`);
};

console.log('\nMathLeague icon generation');
console.log(`theme: ${THEME.sky} on ${THEME.black}\n`);

// ── standard PNGs ───────────────────────────────────────────
console.log('PNG icons');
for (const s of PNG_SIZES) {
  write(path.join(iconsDir, `icon-${s}.png`), png(s));
}

// ── maskable (safe-zone padded, full-bleed background) ──────
console.log('\nPWA maskable + Apple touch');
write(path.join(iconsDir, 'maskable-512.png'), png(512, { maskable: true }));
write(path.join(iconsDir, 'maskable-192.png'), png(192, { maskable: true }));
write(path.join(iconsDir, 'apple-touch-icon.png'), png(180));

// ── favicon.ico (multi-size) ────────────────────────────────
console.log('\nICO bundles');
const icoEntries = ICO_SIZES.map(size => ({ size, png: png(size) }));
const ico = encodeICO(icoEntries);
write(path.join(iconsDir, 'favicon.ico'), ico);
write(path.join(buildDir, 'icon.ico'), ico);          // Electron + NSIS installer
write(path.join(buildDir, 'icon.png'), png(512));     // electron-builder fallback

// ── SVGs (scalable, and the source of truth for the web) ────
console.log('\nVector + splash');
write(path.join(iconsDir, 'icon.svg'), Buffer.from(markSVG()));
write(path.join(iconsDir, 'icon-maskable.svg'), Buffer.from(markSVG({ maskable: true })));
write(path.join(iconsDir, 'mark-bare.svg'), Buffer.from(markSVG({ bare: true })));
write(path.join(iconsDir, 'splash.svg'), Buffer.from(splashSVG()));

// A couple of raster splashes for iOS startup images.
write(path.join(iconsDir, 'splash-1242x2688.png'), (() => {
  // Splash is drawn as a dark plate with the bare mark centred.
  const W = 1242, H = 2688;
  const markSize = 420;
  const cv = renderMark(markSize, THEME, { bare: true });
  const src = cv.toRGBA();
  const out = Buffer.alloc(W * H * 4);
  // fill near-black
  for (let i = 0; i < W * H; i++) {
    out[i * 4 + 0] = 0x05; out[i * 4 + 1] = 0x07;
    out[i * 4 + 2] = 0x0a; out[i * 4 + 3] = 255;
  }
  const ox = Math.round((W - markSize) / 2);
  const oy = Math.round(H * 0.40 - markSize / 2);
  for (let y = 0; y < markSize; y++) {
    for (let x = 0; x < markSize; x++) {
      const s = (y * markSize + x) * 4;
      const a = src[s + 3] / 255;
      if (a <= 0) continue;
      const d = ((oy + y) * W + (ox + x)) * 4;
      for (let c = 0; c < 3; c++) out[d + c] = Math.round(src[s + c] * a + out[d + c] * (1 - a));
    }
  }
  return encodePNG(out, W, H);
})());

console.log('\nDone. All icon assets regenerated.\n');
