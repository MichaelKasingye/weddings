// Builds the poster layers from reference.png (the couple is part of the artwork):
//   background.jpg (wording removed), couple.webp / title.webp / wedding.webp (layers in front of the fireworks).
// couple-mask-source.png = remove-background.mjs run on reference.png cropped at x 100, y 0, 800 x 780.
const sharp = require('sharp');
const { W, H, lum, dilate, boxBlurF, pushPull } = require('./lib');
const OUT = process.argv[2] || __dirname + '/out';  // review, then copy into assets/ (see README)
const save = (img, file, q) => { const b = Buffer.alloc(W * H * 3); for (let i = 0; i < b.length; i++) b[i] = Math.max(0, Math.min(255, Math.round(img[i]))); const s = sharp(b, { raw: { width: W, height: H, channels: 3 } }); return (file.endsWith('.jpg') ? s.jpeg({ quality: q || 90, mozjpeg: true }) : s.png()).toFile(file); };
(async () => {
  require('fs').mkdirSync(OUT, { recursive: true });
  const ref = Float32Array.from(await sharp(__dirname + '/reference.png').removeAlpha().raw().toBuffer());
  const gold = (i) => { const r = ref[i * 3], g = ref[i * 3 + 1], b = ref[i * 3 + 2]; return r > 70 && r - b > 35 && g > 0.5 * r; };
  const white = (i) => { const r = ref[i * 3], g = ref[i * 3 + 1], b = ref[i * 3 + 2]; return lum(ref, i) > 110 && Math.max(r, g, b) - Math.min(r, g, b) < 110; };
  const dark = (i) => lum(ref, i) < 222;
  const regions = [ // [x0, y0, x1, y1, test, dilate, clipY1]
    [230, 597, 858, 674, gold, 7], [494, 666, 601, 722, gold, 5], [255, 718, 842, 808, gold, 8],
    [195, 804, 884, 848, white, 5], [806, 296, 1020, 394, white, 5],
    [862, 876, 1012, 968, white, 6], [862, 994, 1032, 1054, white, 6], [842, 1082, 1048, 1170, white, 6],
    [242, 1206, 826, 1235, dark, 2], [396, 1235, 676, 1271, dark, 2], [244, 1290, 822, 1325, dark, 2],
    [226, 1364, 842, 1417, gold, 7, 1417],
  ];
  const mask = new Uint8Array(W * H);
  for (const [x0, y0, x1, y1, test, d, cy] of regions) {
    const m = new Uint8Array(W * H);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (test(y * W + x)) m[y * W + x] = 1;
    const md = dilate(m, d);
    for (let y = Math.max(0, y0 - d); y < Math.min(cy || H, y1 + d); y++) for (let x = Math.max(0, x0 - d); x < Math.min(W, x1 + d); x++) if (md[y * W + x]) mask[y * W + x] = 1;
  }
  const clean = pushPull(ref, mask);
  for (let k = 0; k < 3; k++) { const ch = new Float32Array(W * H); for (let i = 0; i < W * H; i++) ch[i] = clean[i * 3 + k]; const bl = boxBlurF(ch, 2); for (let i = 0; i < W * H; i++) if (mask[i]) clean[i * 3 + k] = bl[i]; }
  await save(clean, OUT + '/clean.png');
  await save(clean, OUT + '/background.jpg', 90);
  const vis = Float32Array.from(ref); for (let i = 0; i < W * H; i++) if (mask[i]) { vis[i * 3] = 255; vis[i * 3 + 1] = 0; vis[i * 3 + 2] = 255; }
  await save(vis, OUT + '/maskvis.png');

  async function layer(name, [x0, y0, x1, y1], alphaAt) {
    const w = x1 - x0, h = y1 - y0, B = Buffer.alloc(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y0 + y) * W + x0 + x, o = (y * w + x) * 4; for (let k = 0; k < 3; k++) B[o + k] = Math.round(Math.max(0, Math.min(255, clean[i * 3 + k]))); B[o + 3] = Math.round(Math.max(0, Math.min(1, alphaAt(i, x0 + x, y0 + y))) * 255); }
    await sharp(B, { raw: { width: w, height: h, channels: 4 } }).webp({ quality: 92, alphaQuality: 100 }).toFile(OUT + '/' + name + '.webp');
    console.log(name, { x: x0, y: y0, w, h });
  }
  // gold artwork in front of the fireworks
  const goldMask = (box) => { const m = new Uint8Array(W * H); const [x0, y0, x1, y1] = box; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = y * W + x, r = clean[i * 3], g = clean[i * 3 + 1], b = clean[i * 3 + 2]; if ((r > 90 && r - b > 40 && g > 0.5 * r) || lum(clean, i) > 175) m[i] = 1; } let a = new Float32Array(W * H); const md = dilate(m, 3); for (let i = 0; i < W * H; i++) a[i] = md[i]; return boxBlurF(a, 1); };
  const tBox = [722, 28, 1052, 292], wBox = [262, 842, 770, 1125];
  const ta = goldMask(tBox); await layer('title', tBox, (i) => ta[i]);
  const wa = goldMask(wBox); await layer('wedding', wBox, (i) => wa[i]);
  // the couple (mask from the background-removal model, crop offset 100,0), fading out under the names
  const cm = await sharp(__dirname + '/couple-mask-source.png').extractChannel(3).raw().toBuffer();
  let ca = new Float32Array(W * H);
  for (let y = 0; y < 780; y++) for (let x = 0; x < 800; x++) ca[y * W + x + 100] = cm[y * 800 + x] / 255;
  const cmb = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) cmb[i] = ca[i] > 0.5 ? 1 : 0;
  const cd = dilate(cmb, 2); let cf = new Float32Array(W * H); for (let i = 0; i < W * H; i++) cf[i] = Math.max(ca[i], cd[i]); cf = boxBlurF(cf, 1);
  const vf = (y) => (y <= 640 ? 1 : y >= 720 ? 0 : 1 - (y - 640) / 80);
  let bx0 = W, bx1 = 0, by0 = H, by1 = 0; for (let y = 0; y < 720; y++) for (let x = 0; x < W; x++) if (cf[y * W + x] * vf(y) > 0.01) { bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y); }
  await layer('couple', [bx0, by0, bx1 + 1, by1 + 1], (i, x, y) => cf[i] * vf(y));
})();
