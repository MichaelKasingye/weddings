// Builds the emerald design (reference-v5.png, 1065 x 1598) with the ORIGINAL couple:
//   1. wipes all wording from the reference (it is drawn as live text by index.html)
//   2. removes the reference's stand-in couple (couple-mask-v5.png) and fills behind them
//   3. cuts layers: poster.webp (background), front.webp (families panels, above the couple),
//      title.webp (gold title + rings, above the fireworks), couple.webp (original couple, faded at the bottom)
// usage: node build-v5.js [outDir]
const sharp = require('sharp');
const { lum, dilate, boxBlurF, pushPull } = require('./lib');
const W = 1065, H = 1598, OUT = process.argv[2] || __dirname + '/out5';
const ss = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const save = (img, file, q) => { const b = Buffer.alloc(W * H * 3); for (let i = 0; i < b.length; i++) b[i] = Math.max(0, Math.min(255, Math.round(img[i]))); const s = sharp(b, { raw: { width: W, height: H, channels: 3 } }); return (file.endsWith('.png') ? s.png() : s.webp({ quality: q || 90 })).toFile(file); };
(async () => {
  require('fs').mkdirSync(OUT, { recursive: true });
  const ref = Float32Array.from(await sharp(__dirname + '/reference-v5.png').removeAlpha().raw().toBuffer());
  const px = (i) => [ref[i * 3], ref[i * 3 + 1], ref[i * 3 + 2]];
  const gold = (i) => { const [r, g, b] = px(i); return r > 110 && r - b > 45 && g > 0.55 * r; };
  const cream = (i) => { const [r, g, b] = px(i); return lum(ref, i) > 150 && r - b < 90 && !(g > r + 10); };
  const dark = (i) => lum(ref, i) < 150 && !(px(i)[1] > px(i)[0] + 8);   // dark lettering, not the green background
  const light = (i) => lum(ref, i) > 125 && !(px(i)[1] > px(i)[0] + 12);   // cream or gold, not green
  // [x0, y0, x1, y1, test, dilate]
  const regions = [
    [788, 262, 1022, 400, cream, 6],                   // scripture
    [240, 400, 410, 437, light, 3], [648, 400, 808, 437, light, 3],      // "The Families of" tabs
    [140, 443, 515, 545, cream, 3], [578, 443, 880, 545, cream, 3],      // families text
    [318, 550, 740, 590, cream, 6, 'clip'],            // cordially invite… (never reaches the guest bar's border)
    [200, 603, 860, 642, dark, 2],                     // Mr./Mrs./Ms./Dr. ……
    [222, 655, 840, 702, cream, 6, 'clip'],            // to the Holy Matrimony…
    [222, 702, 900, 798, gold, 6],                     // groom's name
    [245, 834, 880, 946, gold, 7],                     // bride's name (incl. descenders)
    [160, 966, 232, 996, gold, 3], [160, 996, 345, 1060, cream, 3],      // Date
    [460, 966, 660, 996, gold, 3], [455, 996, 660, 1078, cream, 3], [418, 1076, 645, 1122, gold, 3], // Church
    [785, 966, 905, 998, gold, 3], [785, 998, 1012, 1084, cream, 3],     // Reception
    [292, 1136, 770, 1171, gold, 3, 'clip'],          // Color Theme (never reaches the badge's border)
    [255, 1186, 812, 1224, cream, 5, 'clip'],          // tagline (never reaches the theme badge's border)
    [462, 1232, 618, 1282, gold, 4], [400, 1280, 676, 1318, cream, 3], [474, 1318, 668, 1358, cream, 3], // RSVP
    [428, 1372, 655, 1420, dark, 3],                   // Strictly by Invitation
  ];
  const keepMedallion = (x, y) => (x - 548) ** 2 + (y - 816) ** 2 < 34 ** 2; // the "&" medallion stays
  const mask = new Uint8Array(W * H);
  for (const [x0, y0, x1, y1, test, d, clip] of regions) {
    const m = new Uint8Array(W * H);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (test(y * W + x) && !keepMedallion(x, y)) m[y * W + x] = 1;
    const md = dilate(m, d, W, H);
    const ya = clip ? y0 : Math.max(0, y0 - d), yb = clip ? y1 : Math.min(H, y1 + d);
    for (let y = ya; y < yb; y++) for (let x = Math.max(0, x0 - d); x < Math.min(W, x1 + d); x++) if (md[y * W + x] && !keepMedallion(x, y)) mask[y * W + x] = 1;
  }
  // lines just above/below the cream guest bar must not borrow its colour: block it as a source while filling
  const blocked = Uint8Array.from(mask);
  for (let y = 589; y < 654; y++) for (let x = 140; x < 926; x++) blocked[y * W + x] = 1;
  const fill = pushPull(ref, blocked, W, H);
  let clean = Float32Array.from(ref);
  for (let i = 0; i < W * H; i++) if (mask[i]) for (let k = 0; k < 3; k++) clean[i * 3 + k] = fill[i * 3 + k];
  { // …but the bar's own lettering ("Mr./Mrs./Ms./Dr. ……") is filled from the bar itself
    const barHole = new Uint8Array(W * H);
    for (let y = 589; y < 654; y++) for (let x = 140; x < 926; x++) barHole[y * W + x] = mask[y * W + x];
    const barFill = pushPull(ref, barHole, W, H);
    for (let i = 0; i < W * H; i++) if (barHole[i]) for (let k = 0; k < 3; k++) clean[i * 3 + k] = barFill[i * 3 + k];
  }
  for (let k = 0; k < 3; k++) { const ch = new Float32Array(W * H); for (let i = 0; i < W * H; i++) ch[i] = clean[i * 3 + k]; const bl = boxBlurF(ch, 2, W, H); for (let i = 0; i < W * H; i++) if (mask[i]) clean[i * 3 + k] = bl[i]; }
  { const vis = Float32Array.from(ref); for (let i = 0; i < W * H; i++) if (mask[i]) { vis[i * 3] = 255; vis[i * 3 + 1] = 0; vis[i * 3 + 2] = 255; } await save(vis, OUT + '/maskvis.png'); }
  await save(clean, OUT + '/clean.png');

  // ---- the families panels (front layer, above the couple) ----
  const PY0 = 392, PY1 = 562;
  const green = (i) => { const r = clean[i * 3], g = clean[i * 3 + 1], b = clean[i * 3 + 2]; return g > r + 14 && g >= b; };
  const goldC = (i) => { const r = clean[i * 3], g = clean[i * 3 + 1], b = clean[i * 3 + 2]; return r > 120 && r - b > 45 && g > 0.5 * r; };
  let pm = new Uint8Array(W * H);
  for (let y = PY0; y < PY1; y++) for (let x = 125; x < 935; x++) { const i = y * W + x; if (green(i)) pm[i] = 1; }
  const near = dilate(pm, 7, W, H);
  for (let y = PY0; y < PY1; y++) for (let x = 125; x < 935; x++) { const i = y * W + x; if (goldC(i) && near[i]) pm[i] = 1; if (goldC(i) && x > 512 && x < 562) pm[i] = 1; }
  { // fill holes per row (inside the panels)
    for (let y = PY0; y < PY1; y++) { let a = -1, b = -1; for (let x = 125; x < 935; x++) if (pm[y * W + x]) { if (a < 0) a = x; b = x; }
      if (a < 0) continue; let last = -1; for (let x = a; x <= b; x++) { if (pm[y * W + x]) { if (last >= 0 && x - last < 40) for (let k = last; k < x; k++) pm[y * W + k] = 1; last = x; } } }
  }
  let pa = new Float32Array(W * H); for (let i = 0; i < W * H; i++) pa[i] = pm[i]; pa = boxBlurF(pa, 1, W, H);

  // ---- remove the stand-in couple, fill behind them ----
  const cmA = await sharp(__dirname + '/couple-mask-v5.png').extractChannel(0).raw().toBuffer(); // 1065 x 560, one channel
  const cm = new Uint8Array(W * H);
  for (let y = 0; y < 560; y++) for (let x = 0; x < W; x++) if (cmA[y * W + x] > 90 && !(y > PY0 && pm[y * W + x]) && y < 545) cm[y * W + x] = 1;
  const hole = dilate(cm, 7, W, H);
  for (let y = 545; y < H; y++) for (let x = 0; x < W; x++) hole[y * W + x] = 0;
  // fill with real scenery: mirror the pixels just outside the hole on each row, blended by distance,
  // then a smooth colour correction so the seam with the surroundings disappears
  const filled = Float32Array.from(clean);
  for (let y = 0; y < 545; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; if (!hole[i]) continue;
    let L = x; while (L >= 0 && hole[y * W + L]) L--; let R = x; while (R < W && hole[y * W + R]) R++;
    const dl = x - L, dr = R - x;
    // ping-pong reflection so the source never runs off the side: left uses [0, L], right uses [R, W-1]
    const pp = (d, n) => { const m = d % (2 * n); return m < n ? m : 2 * n - 1 - m; };
    const xl = L >= 0 ? L - pp(dl - 1, L + 1) : -1, xr = R < W ? R + pp(dr - 1, W - R) : W;
    const titleArea = (X) => X > 690 && y < 300; // never copy the gold title
    const okL = L >= 0 && xl >= 0 && !hole[y * W + xl], okR = R < W && xr < W && !hole[y * W + xr] && !titleArea(xr);
    let wl = okL && okR ? dr / (dl + dr) : okL ? 1 : okR ? 0 : -1;
    for (let k = 0; k < 3; k++) {
      if (wl < 0) { filled[i * 3 + k] = clean[(y * W + (L >= 0 ? L : Math.min(W - 1, R))) * 3 + k]; continue; }
      filled[i * 3 + k] = (okL ? clean[(y * W + xl) * 3 + k] * wl : 0) + (okR ? clean[(y * W + xr) * 3 + k] * (1 - wl) : 0);
    }
  }
  // the sky band between and beside the heads: a block of real firework sky from the left of the poster
  for (let y = 0; y < 268; y++) for (let x = 420; x < 760; x++) {
    const i = y * W + x; if (!hole[i]) continue;
    const sx = x - 418; for (let k = 0; k < 3; k++) filled[i * 3 + k] = clean[(y * W + sx) * 3 + k];
  }
  { // colour-match the fill to its surroundings (smooth correction measured on a ring around the hole)
    const ring = dilate(hole, 3, W, H), known = new Float32Array(W * H * 3), unk = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) { if (ring[i] && !hole[i]) for (let k = 0; k < 3; k++) known[i * 3 + k] = clean[i * 3 + k] - filled[i * 3 + k]; else unk[i] = 1; }
    // filled == clean outside the hole, so measure the ring against the fill's own neighbours instead
    const est = pushPull(filled, ring, W, H);
    for (let i = 0; i < W * H; i++) if (ring[i] && !hole[i]) for (let k = 0; k < 3; k++) known[i * 3 + k] = clean[i * 3 + k] - est[i * 3 + k];
    const corr = pushPull(known, unk, W, H);
    for (let i = 0; i < W * H; i++) if (hole[i]) for (let k = 0; k < 3; k++) filled[i * 3 + k] = Math.max(0, Math.min(255, filled[i * 3 + k] + Math.max(-45, Math.min(45, corr[i * 3 + k]))));
  }
  { // soften the vertical seams a little (rows were filled independently)
    for (let k = 0; k < 3; k++) { const ch = new Float32Array(W * H); for (let i = 0; i < W * H; i++) ch[i] = filled[i * 3 + k]; const bl = boxBlurF(ch, 1, W, H); for (let i = 0; i < W * H; i++) if (hole[i]) filled[i * 3 + k] = bl[i]; }
  }
  let wh = new Float32Array(W * H); for (let i = 0; i < W * H; i++) wh[i] = hole[i]; wh = boxBlurF(wh, 3, W, H);
  const bg = new Float32Array(W * H * 3);
  for (let i = 0; i < W * H; i++) { const t = Math.min(1, wh[i] * 1.6); for (let k = 0; k < 3; k++) bg[i * 3 + k] = clean[i * 3 + k] * (1 - t) + filled[i * 3 + k] * t; }
  await save(bg, OUT + '/poster.webp', 90);
  await save(bg, OUT + '/background.png');

  async function layer(name, [x0, y0, x1, y1], al, src) {
    const w = x1 - x0, h = y1 - y0, B = Buffer.alloc(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y0 + y) * W + x0 + x, o = (y * w + x) * 4; for (let k = 0; k < 3; k++) B[o + k] = Math.round(Math.max(0, Math.min(255, src[i * 3 + k]))); B[o + 3] = Math.round(Math.max(0, Math.min(1, al[i])) * 255); }
    await sharp(B, { raw: { width: w, height: h, channels: 4 } }).webp({ quality: 92, alphaQuality: 100 }).toFile(OUT + '/' + name + '.webp');
    console.log(name, { x: x0, y: y0, w, h });
  }
  await layer('front', [120, PY0, 940, PY1], pa, clean);
  // gold title + rings
  const tBox = [722, 30, 1060, 262], tm = new Uint8Array(W * H);
  for (let y = tBox[1]; y < tBox[3]; y++) for (let x = tBox[0]; x < tBox[2]; x++) { const i = y * W + x, r = clean[i * 3], g = clean[i * 3 + 1], b = clean[i * 3 + 2]; if ((r > 100 && r - b > 45 && g > 0.5 * r) || lum(clean, i) > 190) tm[i] = 1; }
  let ta = new Float32Array(W * H); const tmd = dilate(tm, 3, W, H); for (let i = 0; i < W * H; i++) ta[i] = tmd[i]; ta = boxBlurF(ta, 1, W, H);
  await layer('title', tBox, ta, clean);

  // ---- the ORIGINAL couple, faded out behind the panels ----
  const CX = +(process.env.CX || 95), CY = +(process.env.CY || 0);
  const co = await sharp(__dirname + '/couple-original.webp').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const cw = co.info.width, ch = co.info.height, C = Buffer.from(co.data);
  { // the original cut-out includes a guest holding a drink at the lower left: replace her with the groom's suit
    const GX = 176, GY = 311, EDGE = 22, hole = new Uint8Array(cw * ch), img = new Float32Array(cw * ch * 3);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) { const i = y * cw + x; for (let k = 0; k < 3; k++) img[i * 3 + k] = C[i * 4 + k]; if ((x < GX && y >= GY) || C[i * 4 + 3] < 200) hole[i] = 1; }
    const f = pushPull(img, hole, cw, ch);
    for (let y = GY; y < ch; y++) for (let x = 0; x < GX; x++) { const i = y * cw + x, t = ss((x - EDGE) / 6) * (1 - ss((x - (GX - 10)) / 10));
      const a0 = C[i * 4 + 3] / 255, keepOld = x >= GX - 10 ? 1 - t : 0;
      for (let k = 0; k < 3; k++) C[i * 4 + k] = Math.round(f[i * 3 + k] * (1 - keepOld) + C[i * 4 + k] * keepOld);
      C[i * 4 + 3] = Math.round(255 * Math.max(ss((x - EDGE) / 4), x >= GX - 10 ? a0 : 0)); }
  }
  for (let y = 0; y < ch; y++) { const f = 1 - ss((CY + y - 470) / 75); for (let x = 0; x < cw; x++) C[(y * cw + x) * 4 + 3] = Math.round(C[(y * cw + x) * 4 + 3] * f); }
  { // trim a 2px halo (the old cut-out's edge carries specks of the previous background's lights)
    const A = new Float32Array(cw * ch); for (let i = 0; i < cw * ch; i++) A[i] = C[i * 4 + 3];
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) { let m = A[y * cw + x];
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < cw && Y < ch && dx * dx + dy * dy <= 4) m = Math.min(m, A[Y * cw + X]); }
      C[(y * cw + x) * 4 + 3] = Math.round(m); }
  }
  let last = ch; while (last > 1 && C.subarray((last - 1) * cw * 4, last * cw * 4).every((v, k) => k % 4 !== 3 || v === 0)) last--;
  await sharp(C, { raw: { width: cw, height: ch, channels: 4 } }).extract({ left: 0, top: 0, width: cw, height: last }).webp({ quality: 92, alphaQuality: 100 }).toFile(OUT + '/couple.webp');
  console.log('couple', { x: CX, y: CY, w: cw, h: last });
})();
