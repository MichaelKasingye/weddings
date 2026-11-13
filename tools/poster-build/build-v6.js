// Builds the poster from the clean emerald background (assets/art/Emerald Gold Wedding Invitation.png, no couple,
// no wording) and the couple cut-out (assets/couple/new_couple_background removed.png). No inpainting needed.
// Writes: poster.webp (background), front.webp (families panels, in front of the couple),
//         title.webp (gold title + rings, in front of the fireworks), couple.webp (faded out behind the panels)
// usage: node build-v6.js [outDir]   -> copy poster/front/title to assets/art/, couple to assets/couple/couple-layer.webp
const sharp = require('sharp');
const path = require('path');
const { lum, dilate, boxBlurF } = require('./lib');
const W = 1065, H = 1598, ROOT = path.resolve(__dirname, '../..'), OUT = process.argv[2] || __dirname + '/out6';
const ss = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
(async () => {
  require('fs').mkdirSync(OUT, { recursive: true });
  const bgSharp = sharp(ROOT + '/assets/art/Emerald Gold Wedding Invitation.png').removeAlpha().resize(W, H, { kernel: 'lanczos3' });
  const bg = Float32Array.from(await bgSharp.clone().raw().toBuffer());
  await bgSharp.clone().webp({ quality: 90 }).toFile(OUT + '/poster.webp');

  async function layer(name, [x0, y0, x1, y1], al) {
    const w = x1 - x0, h = y1 - y0, B = Buffer.alloc(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y0 + y) * W + x0 + x, o = (y * w + x) * 4; for (let k = 0; k < 3; k++) B[o + k] = Math.round(bg[i * 3 + k]); B[o + 3] = Math.round(Math.max(0, Math.min(1, al[i])) * 255); }
    await sharp(B, { raw: { width: w, height: h, channels: 4 } }).webp({ quality: 92, alphaQuality: 100 }).toFile(OUT + '/' + name + '.webp');
    console.log(name, { x: x0, y: y0, w, h });
  }
  // families panels: green panel fill + its gold frame (rows filled across small gaps)
  const PY0 = 392, PY1 = 562;
  const green = (i) => { const r = bg[i * 3], g = bg[i * 3 + 1], b = bg[i * 3 + 2]; return g > r + 14 && g >= b; };
  const gold = (i) => { const r = bg[i * 3], g = bg[i * 3 + 1], b = bg[i * 3 + 2]; return r > 120 && r - b > 45 && g > 0.5 * r; };
  const pm = new Uint8Array(W * H);
  for (let y = PY0; y < PY1; y++) for (let x = 125; x < 935; x++) if (green(y * W + x)) pm[y * W + x] = 1;
  const near = dilate(pm, 7, W, H);
  for (let y = PY0; y < PY1; y++) for (let x = 125; x < 935; x++) { const i = y * W + x; if (gold(i) && (near[i] || (x > 512 && x < 562))) pm[i] = 1; }
  for (let y = PY0; y < PY1; y++) { let last = -1; for (let x = 125; x < 935; x++) if (pm[y * W + x]) { if (last >= 0 && x - last < 40) for (let k = last; k < x; k++) pm[y * W + k] = 1; last = x; } }
  // trim each column to where the green panel (or its tab) really starts, so no crowd pixels come along
  for (let x = 125; x < 935; x++) {
    let top = PY1;
    for (let y = PY0; y < PY1 - 8; y++) if (green(y * W + x) && green((y + 4) * W + x) && green((y + 8) * W + x)) { top = y; break; }
    for (let y = PY0; y < Math.max(PY0, top - 4); y++) pm[y * W + x] = 0;
  }
  let pa = new Float32Array(W * H); for (let i = 0; i < W * H; i++) pa[i] = pm[i]; pa = boxBlurF(pa, 1, W, H);
  // The clean background draws these panels poorly (no top border, unframed tabs), so the front layer uses the
  // crisp panels cut from the earlier render of the same design (panels-v5.webp, wording removed; same position).
  require('fs').copyFileSync(__dirname + '/panels-v5.webp', OUT + '/front.webp');
  console.log('front (from panels-v5.webp)', { x: 120, y: PY0, w: 820, h: 170 });
  void pa; void layer;
  // gold title + rings
  const tBox = [722, 30, 1060, 262], tm = new Uint8Array(W * H);
  for (let y = tBox[1]; y < tBox[3]; y++) for (let x = tBox[0]; x < tBox[2]; x++) { const i = y * W + x, r = bg[i * 3], g = bg[i * 3 + 1], b = bg[i * 3 + 2]; if ((r > 100 && r - b > 45 && g > 0.5 * r) || lum(bg, i) > 190) tm[i] = 1; }
  let ta = new Float32Array(W * H); const tmd = dilate(tm, 3, W, H); for (let i = 0; i < W * H; i++) ta[i] = tmd[i]; ta = boxBlurF(ta, 1, W, H);
  await layer('title', tBox, ta);
  // the couple: placed at x 95, y 0, 807 wide; fades out behind the panels (poster y 470 → 545)
  const CW = 807, src = sharp(ROOT + '/assets/couple/new_couple_background removed.png').ensureAlpha().resize(CW);
  const { data, info } = await src.raw().toBuffer({ resolveWithObject: true });
  const C = Buffer.from(data), ch = info.height;
  for (let y = 0; y < ch; y++) { const f = 1 - ss((y - 470) / 75); for (let x = 0; x < CW; x++) C[(y * CW + x) * 4 + 3] = Math.round(C[(y * CW + x) * 4 + 3] * f); }
  await sharp(C, { raw: { width: CW, height: ch, channels: 4 } }).webp({ quality: 92, alphaQuality: 100 }).toFile(OUT + '/couple.webp');
  console.log('couple', { x: 95, y: 0, w: CW, h: ch });
})();
