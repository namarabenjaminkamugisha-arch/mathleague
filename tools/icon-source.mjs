// icon-source.mjs — THE single source of truth for the MathLeague mark.
//
// The mark: a bold "M" formed as a rising chart/chevron pair, crossed by a
// division-style pair of dots and a bar — reading as both a monogram and a
// mathematical operator. On a near-black rounded square in sky blue.
//
// Change THEME here and re-run `npm run icons` to regenerate every asset.

export const THEME = {
  sky: '#38bdf8',
  skyDeep: '#0ea5e9',
  skyPale: '#7dd3fc',
  black: '#05070a',
  panel: '#0b1016',
};

/**
 * The mark, drawn on a 512x512 canvas.
 * @param {object} o
 * @param {boolean} o.maskable  pad the mark into the safe zone (PWA maskable)
 * @param {boolean} o.bare      no background plate (for splash over dark bg)
 * @param {boolean} o.simple    drop fine detail, for tiny sizes
 */
export function markSVG({ maskable = false, bare = false, simple = false } = {}) {
  // Maskable icons must keep content inside a centred circle of 80% diameter.
  const scale = maskable ? 0.72 : 1;
  const cx = 256, cy = 256;

  const bg = bare
    ? ''
    : maskable
      ? `<rect width="512" height="512" fill="${THEME.black}"/>`
      : `<rect x="16" y="16" width="480" height="480" rx="112" fill="url(#plate)"/>
         <rect x="16" y="16" width="480" height="480" rx="112" fill="none"
               stroke="url(#rim)" stroke-width="3" stroke-opacity="0.55"/>`;

  // The M: two strokes rising like a bar chart / chevron.
  // Drawn as a single polyline with round joins — bold, confident, legible at 16px.
  const strokeW = simple ? 66 : 54;
  const m = `
    <polyline points="150,352 150,190 256,300 362,190 362,352"
              fill="none" stroke="url(#stroke)" stroke-width="${strokeW}"
              stroke-linecap="round" stroke-linejoin="round"/>`;

  // The operator accent: a division bar with dots, tucked under the M.
  // Omitted at tiny sizes so the M stays crisp.
  const accent = simple ? '' : `
    <circle cx="256" cy="150" r="19" fill="${THEME.skyPale}"/>
    <rect x="196" y="392" width="120" height="17" rx="8.5" fill="${THEME.skyPale}" fill-opacity="0.95"/>`;

  const glow = bare || simple ? '' : `
    <ellipse cx="256" cy="300" rx="170" ry="120" fill="url(#glow)" opacity="0.35"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="plate" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#111a24"/>
      <stop offset="100%" stop-color="${THEME.black}"/>
    </linearGradient>
    <linearGradient id="stroke" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${THEME.skyPale}"/>
      <stop offset="55%" stop-color="${THEME.sky}"/>
      <stop offset="100%" stop-color="${THEME.skyDeep}"/>
    </linearGradient>
    <linearGradient id="rim" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${THEME.sky}"/>
      <stop offset="100%" stop-color="${THEME.sky}" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="glow">
      <stop offset="0%" stop-color="${THEME.sky}"/>
      <stop offset="100%" stop-color="${THEME.sky}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  ${bg}
  <g transform="translate(${cx} ${cy}) scale(${scale}) translate(${-cx} ${-cy})">
    ${glow}
    ${m}
    ${accent}
  </g>
</svg>`;
}

/** Splash / launch screen, 1242x2688 style ratio kept flexible. */
export function splashSVG(w = 1242, h = 2688) {
  const cx = w / 2, cy = h / 2 - h * 0.06;
  const s = Math.min(w, h) * 0.00055;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <defs>
    <radialGradient id="bgGlow" cx="50%" cy="42%" r="55%">
      <stop offset="0%" stop-color="#0d2233"/>
      <stop offset="100%" stop-color="${THEME.black}"/>
    </radialGradient>
    <linearGradient id="stroke" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${THEME.skyPale}"/>
      <stop offset="55%" stop-color="${THEME.sky}"/>
      <stop offset="100%" stop-color="${THEME.skyDeep}"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bgGlow)"/>
  <g transform="translate(${cx} ${cy}) scale(${s}) translate(-256 -256)">
    <polyline points="150,352 150,190 256,300 362,190 362,352"
              fill="none" stroke="url(#stroke)" stroke-width="54"
              stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="256" cy="150" r="19" fill="${THEME.skyPale}"/>
    <rect x="196" y="392" width="120" height="17" rx="8.5" fill="${THEME.skyPale}"/>
  </g>
  <text x="${cx}" y="${cy + Math.min(w, h) * 0.30}" text-anchor="middle"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, sans-serif"
        font-size="${Math.min(w, h) * 0.072}" font-weight="700"
        fill="#ffffff" letter-spacing="-1">MathLeague</text>
  <text x="${cx}" y="${cy + Math.min(w, h) * 0.30 + Math.min(w, h) * 0.055}" text-anchor="middle"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, sans-serif"
        font-size="${Math.min(w, h) * 0.030}" font-weight="500"
        fill="${THEME.sky}" letter-spacing="3">TRAIN. STREAK. CLIMB.</text>
</svg>`;
}
