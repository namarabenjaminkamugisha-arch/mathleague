// raster.mjs — tiny dependency-free 2D rasteriser + PNG/ICO encoder.
//
// Everything is drawn from signed distance fields, so the mark is crisply
// anti-aliased at every size from 16px to 512px without any image library.

import zlib from 'node:zlib';

// ── colour helpers ──────────────────────────────────────────
export function hex(h) {
  h = h.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const clamp01 = t => (t < 0 ? 0 : t > 1 ? 1 : t);

// ── canvas ──────────────────────────────────────────────────
export class Canvas {
  constructor(size) {
    this.size = size;
    this.px = new Float64Array(size * size * 4); // rgba, 0..255, premult-free
  }
  /** Blend a colour in with coverage 0..1. */
  blend(x, y, rgb, a) {
    if (a <= 0) return;
    const i = (y * this.size + x) * 4;
    const p = this.px;
    const dst = p[i + 3] / 255;
    const src = a;
    const out = src + dst * (1 - src);
    if (out <= 0) return;
    for (let c = 0; c < 3; c++) {
      p[i + c] = (rgb[c] * src + p[i + c] * dst * (1 - src)) / out;
    }
    p[i + 3] = out * 255;
  }
  toRGBA() {
    const out = Buffer.alloc(this.size * this.size * 4);
    for (let i = 0; i < this.px.length; i++) {
      out[i] = Math.max(0, Math.min(255, Math.round(this.px[i])));
    }
    return out;
  }
}

// ── signed distance functions, in 512-space ─────────────────
const sdRoundRect = (px, py, cx, cy, hw, hh, r) => {
  const qx = Math.abs(px - cx) - (hw - r);
  const qy = Math.abs(py - cy) - (hh - r);
  const ax = Math.max(qx, 0), ay = Math.max(qy, 0);
  return Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - r;
};

const sdCircle = (px, py, cx, cy, r) => Math.hypot(px - cx, py - cy) - r;

const sdSegment = (px, py, ax, ay, bx, by, r) => {
  const vx = bx - ax, vy = by - ay;
  const wx = px - ax, wy = py - ay;
  const len2 = vx * vx + vy * vy || 1;
  const t = clamp01((wx * vx + wy * vy) / len2);
  return Math.hypot(wx - vx * t, wy - vy * t) - r;
};

/** Distance to a polyline with round caps and joins. */
const sdPolyline = (px, py, pts, r) => {
  let d = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    d = Math.min(d, sdSegment(px, py, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], r));
  }
  return d;
};

/**
 * Render the MathLeague mark.
 * @param {number} size    output pixel size
 * @param {object} theme   {sky, skyDeep, skyPale, black}
 * @param {object} opts    {maskable, bare}
 */
export function renderMark(size, theme, { maskable = false, bare = false } = {}) {
  const cv = new Canvas(size);
  const S = 512 / size;            // one output pixel in 512-space
  const AA = Math.max(0.7, S * 0.62); // anti-alias width scales with zoom-out

  // Below ~32px the accent marks turn to mush, so drop them and fatten the M.
  const simple = size <= 32;
  const strokeW = (simple ? 66 : 54) / 2;
  const markScale = maskable ? 0.72 : 1;

  const sky = hex(theme.sky), skyDeep = hex(theme.skyDeep), skyPale = hex(theme.skyPale);
  const plateTop = hex('#111a24'), plateBot = hex(theme.black);

  const pts = [[150, 352], [150, 190], [256, 300], [362, 190], [362, 352]];

  // coverage from a distance: 1 inside, 0 outside, smooth across AA
  const cov = d => clamp01(0.5 - d / AA);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // sample at pixel centre, in 512-space
      const ux = (x + 0.5) * S;
      const uy = (y + 0.5) * S;

      // ── background plate ──
      if (!bare) {
        if (maskable) {
          cv.blend(x, y, plateBot, 1);
        } else {
          const d = sdRoundRect(ux, uy, 256, 256, 240, 240, 112);
          const c = cov(d);
          if (c > 0) {
            const t = clamp01(uy / 512);
            cv.blend(x, y, mix(plateTop, plateBot, t), c);
          }
          // subtle sky rim, brighter top-left
          const rim = cov(Math.abs(d + 1.5) - 1.5);
          if (rim > 0) {
            const t = clamp01((ux + uy) / 1024);
            cv.blend(x, y, sky, rim * 0.5 * (1 - t));
          }
        }
      }

      // transform into mark space for the scaled group
      const mx = (ux - 256) / markScale + 256;
      const my = (uy - 256) / markScale + 256;

      // ── soft glow behind the mark ──
      if (!bare && !simple) {
        const gx = (mx - 256) / 170, gy = (my - 300) / 120;
        const gd = Math.hypot(gx, gy);
        if (gd < 1) cv.blend(x, y, sky, (1 - gd) * 0.16);
      }

      // ── the M ──
      const dM = sdPolyline(mx, my, pts, strokeW);
      const cM = cov(dM);
      if (cM > 0) {
        const t = clamp01(((mx - 150) + (my - 190)) / 420);
        const col = t < 0.55
          ? mix(skyPale, sky, t / 0.55)
          : mix(sky, skyDeep, (t - 0.55) / 0.45);
        cv.blend(x, y, col, cM);
      }

      // ── accents ──
      if (!simple) {
        const cDot = cov(sdCircle(mx, my, 256, 150, 19));
        if (cDot > 0) cv.blend(x, y, skyPale, cDot);
        const cBar = cov(sdRoundRect(mx, my, 256, 400.5, 60, 8.5, 8.5));
        if (cBar > 0) cv.blend(x, y, skyPale, cBar * 0.95);
      }
    }
  }
  return cv;
}

// ── PNG encoding ────────────────────────────────────────────
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = (crc ^ buf[i]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/**
 * Encode raw RGBA into a PNG buffer.
 * @param {Buffer} rgba  width*height*4 bytes
 * @param {number} width
 * @param {number} [height]  defaults to width (square)
 */
export function encodePNG(rgba, width, height = width) {
  // add the per-scanline filter byte (0 = none)
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // colour type: RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Build a .ico containing PNG-compressed entries. */
export function encodeICO(entries) {
  // entries: [{size, png}]
  const count = entries.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);      // reserved
  header.writeUInt16LE(1, 2);      // type 1 = icon
  header.writeUInt16LE(count, 4);

  const dir = Buffer.alloc(16 * count);
  let offset = 6 + 16 * count;
  const blobs = [];

  entries.forEach((e, i) => {
    const b = i * 16;
    dir[b + 0] = e.size >= 256 ? 0 : e.size;   // 0 means 256
    dir[b + 1] = e.size >= 256 ? 0 : e.size;
    dir[b + 2] = 0;                            // palette
    dir[b + 3] = 0;                            // reserved
    dir.writeUInt16LE(1, b + 4);               // colour planes
    dir.writeUInt16LE(32, b + 6);              // bits per pixel
    dir.writeUInt32BE(0, b + 8);
    dir.writeUInt32LE(e.png.length, b + 8);
    dir.writeUInt32LE(offset, b + 12);
    offset += e.png.length;
    blobs.push(e.png);
  });

  return Buffer.concat([header, dir, ...blobs]);
}
