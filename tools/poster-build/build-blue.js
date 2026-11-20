// Blue design (reference-blue.png), built from the shared assets:
//   assets/art/lake-background.png (scenery), assets/art/bouquet.png, assets/couple/couple-walking.png
// Gold decoration, panels and bars are cut from the reference with their wording removed (the wording is live text).
// Writes to outDir: poster.webp (background + decor), front.webp (families panels, above the couple),
//   title.webp (gold title + rings, above the fireworks), couple.webp, bouquet.webp
// usage: node build-blue.js [outDir]
const sharp = require('sharp');
const path = require('path');
const { lum, dilate, boxBlurF, pushPull } = require('./lib');
const W = 1065, H = 1598, ROOT = path.resolve(__dirname, '../..'), OUT = process.argv[2] || __dirname + '/out-blue';
const ss = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const load = async (f) => Float32Array.from(await sharp(f).removeAlpha().resize(W, H, { kernel: 'lanczos3' }).raw().toBuffer());
(async () => {
  require('fs').mkdirSync(OUT, { recursive: true });
  const ref = await load(__dirname + '/reference-blue.png');
  const lake = await load(ROOT + '/assets/art/lake-background.png');
  const L = (img, i) => lum(img, i);
  const goldA = (img, i) => { const r = img[i * 3], g = img[i * 3 + 1], b = img[i * 3 + 2]; return ss((r - b - 35) / 55) * ss((r - 95) / 70) * (g > 0.45 * r ? 1 : 0); };
  const isNavy = (img, i) => { const r = img[i * 3], g = img[i * 3 + 1], b = img[i * 3 + 2]; return b > r + 25 && b > 55; };

  // ---- 1. background: the lake, toned like the design (darker navy behind the wording, lake at the sides) ----
  const bg = Float32Array.from(lake);
  {
    // darken by brightness only (keeps the lake blue): ratio of the design's blurred brightness to the lake's
    const lumMap = (img) => { const c = new Float32Array(W * H); for (let i = 0; i < W * H; i++) c[i] = lum(img, i); return boxBlurF(c, 45, W, H); };
    const rb = lumMap(ref), lb = lumMap(lake);
    for (let y = 0; y < H; y++) { const t = ss((y - 560) / 110); if (t <= 0) continue;
      for (let x = 0; x < W; x++) { const i = y * W + x, ratio = Math.max(0.28, Math.min(1.05, (rb[i] + 4) / (lb[i] + 4))), f = 1 - t + t * ratio;
        for (let k = 0; k < 3; k++) bg[i * 3 + k] = lake[i * 3 + k] * f; } }
  }

  // a deep navy 'stage' behind the wording (as in the design), keeping the lake visible at the sides
  {
    const NAVY = [8, 18, 52];
    const band = (v, a0, a1, b0, b1) => ss((v - a0) / (a1 - a0)) * (1 - ss((v - b0) / (b1 - b0)));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const stage = 0.62 * band(x, 70, 200, 865, 995) * band(y, 600, 660, 1350, 1400);
      const details = 0.72 * band(x, 0, 60, 1005, 1065) * band(y, 1035, 1070, 1235, 1275);
      const title = 0.5 * (1 - ss((Math.hypot((x - 893) / 200, (y - 235) / 230) - 0.55) / 0.45));
      const a = Math.max(stage, details, title); if (a <= 0) continue;
      const i = y * W + x; for (let k = 0; k < 3; k++) bg[i * 3 + k] = bg[i * 3 + k] * (1 - a) + NAVY[k] * a;
    }
  }

  // ---- helpers to cut pieces of the reference ----
  const rect = (x0, y0, x1, y1, f) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) f(y * W + x, x, y); };
  const wipe = (img, regionMask) => { const f = pushPull(img, regionMask, W, H); for (let i = 0; i < W * H; i++) if (regionMask[i]) for (let k = 0; k < 3; k++) img[i * 3 + k] = f[i * 3 + k]; };
  const clean = Float32Array.from(ref);   // the reference with wording removed (pieces are taken from here)
  // opaque pieces: mask = navy/cream/gold pixels in the box, rows filled across text gaps
  const solidMask = (x0, y0, x1, y1, keep, gap) => { const m = new Uint8Array(W * H); rect(x0, y0, x1, y1, (i) => { if (keep(i)) m[i] = 1; });
    for (let y = y0; y < y1; y++) { let last = -1; for (let x = x0; x < x1; x++) if (m[y * W + x]) { if (last >= 0 && x - last < gap) for (let k = last; k < x; k++) m[y * W + k] = 1; last = x; } } return m; };

  // keep only what lies between a piece's top and bottom gold border, column by column (drops the design's water around it)
  const trimToBorders = (m, x0, y0, x1, y1) => { for (let x = x0; x < x1; x++) {
      let top = -1, bot = -1;
      for (let y = y0; y < y1; y++) if (goldA(ref, y * W + x) > 0.45) { top = y; break; }
      for (let y = y1 - 1; y >= y0; y--) if (goldA(ref, y * W + x) > 0.45) { bot = y; break; }
      for (let y = y0; y < y1; y++) if (top < 0 || y < top - 1 || y > bot + 1) m[y * W + x] = 0; } };
  // families panels (front layer)
  const pm = solidMask(125, 460, 942, 622, (i) => isNavy(ref, i) || goldA(ref, i) > 0.3, 70);
  trimToBorders(pm, 125, 460, 942, 622);
  { const h = new Uint8Array(W * H);
    for (const [x0, y0, x1, y1] of [[142, 498, 516, 606], [550, 498, 925, 606], [222, 469, 440, 497], [628, 469, 846, 497]]) rect(x0, y0, x1, y1, (i) => { if (L(ref, i) > 110 && !isNavy(ref, i)) h[i] = 1; });
    wipe(clean, dilate(h, 3, W, H)); }
  // guest bar
  const gm = solidMask(168, 666, 912, 738, (i) => { const r = ref[i * 3], g = ref[i * 3 + 1], b = ref[i * 3 + 2]; return (L(ref, i) > 150 && r > b) || goldA(ref, i) > 0.3; }, 40);
  { const h = new Uint8Array(W * H); rect(212, 679, 872, 724, (i) => { if (L(ref, i) < 165) h[i] = 1; }); wipe(clean, dilate(h, 2, W, H)); }
  // RSVP bar: wipe everything inside the frame (text, phone icon, dividers); our own content is drawn on top
  const rm = solidMask(14, 1368, 1052, 1490, (i) => isNavy(ref, i) || goldA(ref, i) > 0.25, 90);
  trimToBorders(rm, 14, 1368, 1052, 1490);
  { const h = new Uint8Array(W * H); rect(48, 1393, 1018, 1450, (i) => { if (!isNavy(ref, i) || L(ref, i) > 95) h[i] = 1; }); wipe(clean, dilate(h, 2, W, H)); }

  // ---- 2. composite decor onto the background ----
  const over = (alphaAt, from) => { for (let i = 0; i < W * H; i++) { const a = alphaAt(i); if (a <= 0) continue; for (let k = 0; k < 3; k++) bg[i * 3 + k] = bg[i * 3 + k] * (1 - a) + from[i * 3 + k] * a; } };
  const soft = (m, r = 1) => { let a = new Float32Array(W * H); for (let i = 0; i < W * H; i++) a[i] = m[i]; return boxBlurF(a, r, W, H); };
  const ga = soft(gm), ra = soft(rm);
  over((i) => ga[i], clean);
  over((i) => ra[i], clean);
  // thin gold decoration (lines, ribbons, icons, dividers, medallion): soft gold mask, glints included
  const gold = new Float32Array(W * H);
  const goldBoxes = [
    [215, 888, 878, 906], [498, 866, 568, 926],             // the lines either side of the '&' medallion, and the medallion
    [0, 1016, W, 1062], [862, 960, W, 1016],                // curved line above the details + right ribbon
    [40, 1060, 150, 1158], [370, 1050, 455, 1150], [690, 1050, 800, 1150],   // icons
    [352, 1050, 378, 1232], [673, 1050, 699, 1232],         // dividers
    [0, 1235, 200, 1360], [865, 1235, W, 1360],             // side ribbons (the colour badge itself is left out)
  ];
  const skip = (x, y) => y < 1024 && y >= 1016 && x > 240 && x < 830;   // tails of the design's old names, just above the line
  for (const [x0, y0, x1, y1] of goldBoxes) rect(x0, y0, x1, y1, (i, x, y) => { if (!skip(x, y)) gold[i] = Math.max(gold[i], goldA(ref, i)); });
  { const near = dilate(Uint8Array.from(gold, (v) => (v > 0.4 ? 1 : 0)), 3, W, H);
    for (const [x0, y0, x1, y1] of goldBoxes) rect(x0, y0, x1, y1, (i, x, y) => { if (near[i] && !skip(x, y)) gold[i] = Math.max(gold[i], ss((L(ref, i) - 165) / 50)); }); }
  over((i) => gold[i], ref);

  const save = async (buf, file, q = 90) => sharp(buf, { raw: { width: W, height: H, channels: 3 } }).webp({ quality: q }).toFile(file);
  const b8 = Buffer.alloc(W * H * 3); for (let i = 0; i < b8.length; i++) b8[i] = Math.max(0, Math.min(255, Math.round(bg[i])));
  await save(b8, OUT + '/poster.webp');
  await sharp(b8, { raw: { width: W, height: H, channels: 3 } }).png().toFile(OUT + '/poster.png');

  // ---- 3. layers ----
  const layer = async (name, [x0, y0, x1, y1], alpha, src) => {
    const w = x1 - x0, h = y1 - y0, B = Buffer.alloc(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y0 + y) * W + x0 + x, o = (y * w + x) * 4; for (let k = 0; k < 3; k++) B[o + k] = Math.round(Math.max(0, Math.min(255, src[i * 3 + k]))); B[o + 3] = Math.round(Math.max(0, Math.min(1, alpha[i])) * 255); }
    await sharp(B, { raw: { width: w, height: h, channels: 4 } }).webp({ quality: 92, alphaQuality: 100 }).toFile(OUT + '/' + name + '.webp');
    console.log(name, { x: x0, y: y0, w, h });
  };
  await layer('front', [120, 455, 945, 625], soft(pm), clean);
  const ta = new Float32Array(W * H); rect(728, 40, 1060, 312, (i) => { ta[i] = goldA(ref, i); });
  { const near = dilate(Uint8Array.from(ta, (v) => (v > 0.4 ? 1 : 0)), 3, W, H); rect(728, 40, 1060, 312, (i) => { if (near[i]) ta[i] = Math.max(ta[i], ss((L(ref, i) - 165) / 50)); }); }
  await layer('title', [728, 40, 1060, 312], ta, ref);

  // couple: placed as in the design (scale .555 at 84,-14), fading out just above the families panels
  { const s = 0.555, CX = 84, CY = -14, src = sharp(ROOT + '/assets/couple/couple-walking.png').ensureAlpha(); const m = await src.metadata();
    const cw = Math.round(m.width * s), ch = Math.round(m.height * s);
    const { data } = await src.resize(cw, ch).raw().toBuffer({ resolveWithObject: true });
    const top = Math.max(0, -CY), hh = Math.min(ch - top, 500 - (CY + top)), C = Buffer.alloc(cw * hh * 4);
    for (let y = 0; y < hh; y++) { const py = CY + top + y, f = 1 - ss((py - 474) / 20);
      for (let x = 0; x < cw; x++) { const s0 = ((top + y) * cw + x) * 4, o = (y * cw + x) * 4; C[o] = data[s0]; C[o + 1] = data[s0 + 1]; C[o + 2] = data[s0 + 2]; C[o + 3] = Math.round(data[s0 + 3] * f); } }
    await sharp(C, { raw: { width: cw, height: hh, channels: 4 } }).webp({ quality: 92, alphaQuality: 100 }).toFile(OUT + '/couple.webp');
    console.log('couple', { x: CX, y: CY + top, w: cw, h: hh }); }
  // bouquet (resized, web-ready)
  { const s = +(process.env.BQ_S || 0.33), src = sharp(ROOT + '/assets/art/bouquet.png').ensureAlpha(); const m = await src.metadata();
    const info = await src.resize(Math.round(m.width * s)).webp({ quality: 90, alphaQuality: 100 }).toFile(OUT + '/bouquet.webp');
    console.log('bouquet', { w: info.width, h: info.height }); }
})();
