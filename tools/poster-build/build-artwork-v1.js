// Builds: clean poster (reference with editable wording removed), couple layer, couple-free background.
const sharp = require('sharp');
const { W, H, lum, dilate, dilateRound, boxBlurF, pushPull } = require('./lib');
const path = require('path');
const P = path.resolve(__dirname, '../..') + '/';
const OUT = process.argv[2] || __dirname + '/out';  // review, then copy into assets/ (see README)
const save = (img, file, ch = 3, q) => {
  const b = Buffer.alloc(W * H * ch); for (let i = 0; i < b.length; i++) b[i] = Math.max(0, Math.min(255, Math.round(img[i])));
  let s = sharp(b, { raw: { width: W, height: H, channels: ch } });
  return (file.endsWith('.jpg') ? s.jpeg({ quality: q || 90, mozjpeg: true }) : s.png()).toFile(file);
};
(async () => {
  require('fs').mkdirSync(OUT, { recursive: true });
  const ref = Float32Array.from(await sharp(__dirname + '/reference-v1.png').removeAlpha().raw().toBuffer());

  // ---------- 1. Text masks ----------
  const mask = new Uint8Array(W * H);
  const gold = (i) => { const r = ref[i * 3], g = ref[i * 3 + 1], b = ref[i * 3 + 2]; return r > 70 && r - b > 35 && g > 0.5 * r; };
  const white = (i) => { const r = ref[i * 3], g = ref[i * 3 + 1], b = ref[i * 3 + 2]; return lum(ref, i) > 110 && Math.max(r, g, b) - Math.min(r, g, b) < 110; };
  const dark = (i) => lum(ref, i) < 222;
  const all = () => true; // fill the whole box (smooth backgrounds)
  const regions = [
    // [x0, y0, x1, y1, test, dilate]   ('all' boxes: dilate = margin around the box)
    [245, 594, 866, 670, gold, 12],  // Mr. Mark Mukasa
    [325, 668, 800, 722, gold, 8],   // and + rules
    [270, 718, 840, 809, gold, 12],  // Mary Busingye
    [214, 806, 892, 846, white, 6],  // together with their families...
    [782, 278, 1004, 380, all, 8],   // intro
    [866, 884, 1032, 980, white, 6],   // date
    [866, 1000, 1042, 1070, white, 6], // time
    [840, 1090, 1058, 1186, white, 6], // venue
    [254, 1206, 810, 1236, dark, 2],  // guest heading
    [404, 1236, 662, 1272, dark, 2],  // Kindly be our guest
    [248, 1290, 814, 1327, dark, 2],  // Names: .......
    [240, 1378, 830, 1432, gold, 9], // tagline
  ];
  for (const [x0, y0, x1, y1, test, d] of regions) {
    const m = new Uint8Array(W * H);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (test(y * W + x)) m[y * W + x] = 1;
    const md = dilate(m, d);
    const cx0 = test === gold && y0 > 590 && y0 < 720 ? 247 : 0, cx1 = test === gold && y0 > 590 && y0 < 720 ? 858 : W;
    for (let y = Math.max(0, y0 - d); y < Math.min(H, y1 + d); y++) for (let x = Math.max(cx0, x0 - d); x < Math.min(cx1, x1 + d); x++) if (md[y * W + x]) mask[y * W + x] = 1;
  }
  let clean = pushPull(ref, mask);
  // soften the filled areas a touch so they never look blocky
  for (let k = 0; k < 3; k++) {
    const ch = new Float32Array(W * H); for (let i = 0; i < W * H; i++) ch[i] = clean[i * 3 + k];
    const bl = boxBlurF(ch, 2);
    for (let i = 0; i < W * H; i++) if (mask[i]) clean[i * 3 + k] = bl[i];
  }
  await save(clean, OUT + '/clean.png');
  const vis = Float32Array.from(ref); for (let i = 0; i < W * H; i++) if (mask[i]) { vis[i * 3] = 255; vis[i * 3 + 1] = 0; vis[i * 3 + 2] = 255; }
  await save(vis, OUT + '/maskvis.png');

  // ---------- 2. Couple silhouette (cutout aligned to the reference couple) ----------
  const S = 0.71, CX = 216, CY = 86, cw = Math.round(760 * S), chh = Math.round(1203 * S);
  const a = await sharp(P + 'assets/couple/mark-and-mary-cutout.webp').resize(cw, chh).ensureAlpha().extractChannel(3).raw().toBuffer();
  const sil = new Uint8Array(W * H);
  for (let j = 0; j < chh; j++) for (let i = 0; i < cw; i++) if (a[j * cw + i] > 100 && CY + j < H && CX + i < W) sil[(CY + j) * W + CX + i] = 1;
  const HALO = 9, FILL = 6;
  const silHalo = dilateRound(sil, HALO), silFill = dilateRound(sil, FILL);
  const vfade = (y, y0, y1) => (y <= y0 ? 1 : y >= y1 ? 0 : 1 - (y - y0) / (y1 - y0));
  // couple layer alpha: feathered halo, fading out under the names
  let alpha = new Float32Array(W * H); for (let i = 0; i < W * H; i++) alpha[i] = silHalo[i];
  alpha = boxBlurF(alpha, 1);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; alpha[i] = Math.min(1, alpha[i] * 1.0) * vfade(y, 700, 760); }
  // couple-free background: fill the couple area, blended back to the reference lower down
  // generous, so no trace of the old couple's outline is left; 'closing' also takes in the gap between their heads
  const closeR = 45, grown = dilateRound(sil, closeR), inv = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) inv[i] = grown[i] ? 0 : 1;
  const shrunk = dilateRound(inv, closeR - 11), silBg = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) silBg[i] = shrunk[i] ? 0 : 1;
  const fillHole = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) fillHole[i] = silBg[i] && (i / W | 0) < 770 ? 1 : 0;
  // Rebuild the scenery there (so any couple photo, whatever its shape, sits on real scenery):
  //   sky   = per-row colour of the clear sky at the right edge (x 1040–1064)
  //   lake  = the lit lake / tree line from x 760–899, mirrored across
  //   lower = darkens to navy towards the names
  const ss = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  const sky = new Float32Array(H * 3);
  for (let y = 0; y < H; y++) for (let k = 0; k < 3; k++) {
    const v = []; for (let x = 1040; x < 1065; x++) v.push(clean[(y * W + x) * 3 + k]); v.sort((p, q) => p - q); sky[y * 3 + k] = v[v.length >> 1];
  }
  const skyS = new Float32Array(H * 3);
  for (let y = 0; y < H; y++) for (let k = 0; k < 3; k++) { let s = 0, n = 0; for (let d = -4; d <= 4; d++) { const yy = y + d; if (yy >= 0 && yy < H) { s += sky[yy * 3 + k]; n++; } } skyS[y * 3 + k] = s / n; }
  const NAVY = [12, 20, 48];
  const filled = new Float32Array(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, s = (((x - 760) % 210) + 210) % 210, sx = 760 + (s < 105 ? s : 209 - s);
    const t = ss((y - 365) / 30), dark = 0.92 * ss((y - 470) / 150);
    for (let k = 0; k < 3; k++) {
      const v = skyS[y * 3 + k] * (1 - t) + clean[(y * W + sx) * 3 + k] * t;
      filled[i * 3 + k] = v * (1 - dark) + NAVY[k] * dark;
    }
  }
  // seamless: add a smooth correction so the rebuilt scenery meets the real scenery exactly at its edge
  const resid = new Float32Array(W * H * 3); for (let i = 0; i < W * H * 3; i++) resid[i] = clean[i] - filled[i];
  // the original art has a dark halo hugging the old couple; in the sky, lift that band to the new sky
  // (per pixel 'lighten', so firework sparks inside the band survive)
  const halo = dilateRound(sil, 40); let wb = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) wb[i] = halo[i] && !fillHole[i] && (i / W | 0) < 400 ? 1 : 0;
  wb = boxBlurF(wb, 8);
  // take the colour match only from calm sky/water, not from firework sparks or lights
  const residHole = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) residHole[i] = fillHole[i] || wb[i] > 0 || lum(clean, i) > 105 ? 1 : 0;
  const residF = pushPull(resid, residHole);
  // (only for the lake/water part; the sky stays a clean gradient and is feathered into its surroundings instead)
  for (let i = 0; i < W * H; i++) if (fillHole[i] || wb[i] > 0) { const r = 0.85 + 0.15 * ss(((i / W | 0) - 380) / 50); for (let k = 0; k < 3; k++) { const d = Math.max(-50, Math.min(50, residF[i * 3 + k])); filled[i * 3 + k] = Math.max(0, Math.min(255, filled[i * 3 + k] + r * d)); } }
  // a firework in the open sky: the big gold burst (top left), mirrored and a little smaller, added like light
  { const [sx0, sy0, sw, sh, cx, cy, sc, k0] = [0, 0, 200, 175, 430, 190, 0.85, 0.8];
    for (let y = 0; y < sh * sc; y++) for (let x = 0; x < sw * sc; x++) {
      const tx = Math.round(cx - (sw * sc) / 2 + x), ty = Math.round(cy - (sh * sc) / 2 + y); if (tx < 0 || ty < 0 || tx >= W || ty >= H) continue;
      const ux = sx0 + Math.min(sw - 1, Math.round((sw * sc - 1 - x) / sc)), uy = sy0 + Math.min(sh - 1, Math.round(y / sc));
      const j = uy * W + ux, ti = ty * W + tx, L = lum(clean, j), m = k0 * ss((L - 70) / 120) * (1 - ss((Math.hypot(x - sw * sc / 2, y - sh * sc / 2) - 60) / 25));
      for (let k = 0; k < 3; k++) { const a = filled[ti * 3 + k], b = clean[j * 3 + k]; filled[ti * 3 + k] = a + (255 - a) * (b / 255) * m; }
    } }
  let wf = new Float32Array(W * H); for (let i = 0; i < W * H; i++) wf[i] = fillHole[i];
  wf = boxBlurF(wf, 12);
  const bg = new Float32Array(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, w = Math.min(1, fillHole[i] ? 1 : wf[i] * 2) * vfade(y, 730, 768), hb = fillHole[i] ? 0 : Math.min(1, wb[i] * 1.6) * vfade(y, 360, 400);
    for (let k = 0; k < 3; k++) {
      const c = clean[i * 3 + k] * (1 - hb) + Math.max(clean[i * 3 + k], filled[i * 3 + k]) * hb;
      bg[i * 3 + k] = c * (1 - w) + filled[i * 3 + k] * w;
    }
  }
  // sanity: wherever the background differs from the clean poster the couple layer must be opaque
  let worst = 0; for (let i = 0; i < W * H; i++) if (fillHole[i] && (i / W | 0) < 698) worst = Math.max(worst, 1 - alpha[i]);
  console.log('max uncovered fill alpha gap', worst.toFixed(3));

  // couple layer: clean pixels + alpha, cropped to its bounding box
  let bx0 = W, by0 = H, bx1 = 0, by1 = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (alpha[y * W + x] > 0.002) { bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y); }
  const lw = bx1 - bx0 + 1, lh = by1 - by0 + 1, L = Buffer.alloc(lw * lh * 4);
  for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) {
    const i = (by0 + y) * W + bx0 + x, o = (y * lw + x) * 4;
    for (let k = 0; k < 3; k++) L[o + k] = Math.round(Math.max(0, Math.min(255, clean[i * 3 + k])));
    L[o + 3] = Math.round(alpha[i] * 255);
  }
  await sharp(L, { raw: { width: lw, height: lh, channels: 4 } }).png().toFile(OUT + '/couple.png');
  await sharp(L, { raw: { width: lw, height: lh, channels: 4 } }).webp({ quality: 92, alphaQuality: 100 }).toFile(OUT + '/couple.webp');

  // ---------- 3. Artwork overlays that sit above the fireworks (gold lettering, hearts, rings) ----------
  async function overlay(name, [x0, y0, x1, y1], d = 3) {
    const m = new Uint8Array(W * H);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = y * W + x, r = clean[i * 3], g = clean[i * 3 + 1], b = clean[i * 3 + 2]; if ((r > 90 && r - b > 40 && g > 0.5 * r) || lum(clean, i) > 175) m[i] = 1; }
    let al = new Float32Array(W * H); const md = dilate(m, d); for (let i = 0; i < W * H; i++) al[i] = md[i];
    al = boxBlurF(al, 1);
    const w = x1 - x0, h = y1 - y0, B = Buffer.alloc(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y0 + y) * W + x0 + x, o = (y * w + x) * 4; for (let k = 0; k < 3; k++) B[o + k] = Math.round(Math.max(0, Math.min(255, clean[i * 3 + k]))); B[o + 3] = Math.round(Math.min(1, al[i]) * 255); }
    await sharp(B, { raw: { width: w, height: h, channels: 4 } }).webp({ quality: 92, alphaQuality: 100 }).toFile(OUT + '/' + name + '.webp');
    console.log('overlay', name, { x: x0, y: y0, w, h });
  }
  await overlay('title', [712, 14, 1052, 214]);
  { // the hearts animate, so take them out of the background and give the overlay the same footprint
    const [hx0, hy0, hx1, hy1] = [846, 210, 932, 278];
    const m = new Uint8Array(W * H);
    for (let y = hy0 + 2; y < hy1 - 2; y++) for (let x = hx0 + 2; x < hx1 - 2; x++) { const i = y * W + x, r = clean[i * 3], g = clean[i * 3 + 1], b = clean[i * 3 + 2]; if ((r > 70 && r - b > 30 && g > 0.45 * r) || lum(clean, i) > 140) m[i] = 1; }
    const md = dilate(m, 2);
    const f = pushPull(bg, md); for (let i = 0; i < W * H * 3; i++) bg[i] = f[i];
    let al = new Float32Array(W * H); const ma = dilate(md, 1); for (let i = 0; i < W * H; i++) al[i] = ma[i]; al = boxBlurF(al, 1);
    const w = hx1 - hx0, h = hy1 - hy0, B = Buffer.alloc(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (hy0 + y) * W + hx0 + x, o = (y * w + x) * 4; for (let k = 0; k < 3; k++) B[o + k] = Math.round(Math.max(0, Math.min(255, clean[i * 3 + k]))); B[o + 3] = Math.round(Math.min(1, md[i] ? 1 : al[i]) * 255); }
    await sharp(B, { raw: { width: w, height: h, channels: 4 } }).webp({ quality: 92, alphaQuality: 100 }).toFile(OUT + '/hearts.webp');
  }
  await save(bg, OUT + '/background.jpg', 3, 90);
  await overlay('wedding', [268, 842, 762, 1110]);
  console.log('couple layer box', { x: bx0, y: by0, w: lw, h: lh });
})();
