// Step 2 (run after build-artwork.js): from the wording-free poster (out/clean.png), lift out the date box, "Wedding"+rings, guest card and ornament
// so the lower half can be re-laid out (family panel + date band), and cut them as movable layers.
const sharp = require('sharp');
const { W, H, lum, dilate, boxBlurF, pushPull } = require('./lib');
const OUT = process.argv[2] || __dirname + '/out';
const ss = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const save = (img, file, q) => { const b = Buffer.alloc(W * H * 3); for (let i = 0; i < b.length; i++) b[i] = Math.max(0, Math.min(255, Math.round(img[i]))); const s = sharp(b, { raw: { width: W, height: H, channels: 3 } }); return (file.endsWith('.jpg') ? s.jpeg({ quality: q || 90, mozjpeg: true }) : s.png()).toFile(file); };
(async () => {
  require('fs').mkdirSync(OUT, { recursive: true });
  const clean = Float32Array.from(await sharp((process.argv[3] || __dirname + '/out') + '/clean.png').removeAlpha().raw().toBuffer());
  async function layer(name, [x0, y0, x1, y1], al) {
    const w = x1 - x0, h = y1 - y0, B = Buffer.alloc(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y0 + y) * W + x0 + x, o = (y * w + x) * 4; for (let k = 0; k < 3; k++) B[o + k] = Math.round(Math.max(0, Math.min(255, clean[i * 3 + k]))); B[o + 3] = Math.round(Math.max(0, Math.min(1, al[i])) * 255); }
    await sharp(B, { raw: { width: w, height: h, channels: 4 } }).webp({ quality: 92, alphaQuality: 100 }).toFile(OUT + '/' + name + '.webp');
    console.log(name, { x: x0, y: y0, w, h });
  }
  // gold lettering + warm highlights only (a white shirt or a white light is NOT taken)
  const goldAlpha = ([x0, y0, x1, y1], d = 3, bright = 175) => { const m = new Uint8Array(W * H); for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = y * W + x, r = clean[i * 3], g = clean[i * 3 + 1], b = clean[i * 3 + 2]; if ((r > 90 && r - b > 40 && g > 0.5 * r) || (lum(clean, i) > bright && r - b > 22)) m[i] = 1; } const md = dilate(m, d); let a = new Float32Array(W * H); for (let i = 0; i < W * H; i++) a[i] = md[i]; return { m: md, a: boxBlurF(a, 1) }; };

  // 1) "Wedding" + rings (+ the sparkle under the rings)
  const wBox = [262, 842, 756, 1196];
  const wg = goldAlpha(wBox, 2);
  { // keep only the lettering: big connected gold shapes, plus anything in the rings/sparkle zone
    const [x0, y0, x1, y1] = wBox, lab = new Int32Array(W * H).fill(-1), keep = new Uint8Array(W * H);
    let id = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const s0 = y * W + x; if (!wg.m[s0] || lab[s0] >= 0) continue;
      const st = [s0], px = []; lab[s0] = id;
      while (st.length) { const i = st.pop(); px.push(i); const cx = i % W, cy = (i / W) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy; if (nx < x0 || nx >= x1 || ny < y0 || ny >= y1) continue; const j = ny * W + nx; if (wg.m[j] && lab[j] < 0) { lab[j] = id; st.push(j); } } }
      let inRings = 0; for (const i of px) { const cx = i % W, cy = (i / W) | 0; if (cx > 430 && cx < 650 && cy > 1000) inRings++; }
      if (px.length > 2500) for (const i of px) keep[i] = 1; // the script and the rings; no stray lights or sparkles
      id++;
    }
    for (let i = 0; i < W * H; i++) if (!keep[i]) wg.m[i] = 0;
    // below the script, only the two rings (an oval around them)
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = y * W + x; if (y > 1008 && ((x - 550) / 80) ** 2 + ((y - 1060) / 54) ** 2 > 1) keep[i] = 0; }
    let a2 = new Float32Array(W * H); for (let i = 0; i < W * H; i++) a2[i] = keep[i] ? 1 : 0; a2 = boxBlurF(a2, 1);
    for (let i = 0; i < W * H; i++) wg.a[i] = Math.min(wg.a[i], a2[i] * 1.5);
  }
  await layer('wedding', wBox, wg.a);
  // 2) ornament (rules + heart) under the tagline
  const oBox = [226, 1410, 845, 1458];
  const og = goldAlpha(oBox, 3, 200);
  await layer('ornament', oBox, og.a);
  // 3) guest card: everything inside its gold frame (flood the dark surroundings from the box edge)
  const cBox = [190, 1184, 882, 1358];
  { const [x0, y0, x1, y1] = cBox, w = x1 - x0, h = y1 - y0, out = new Uint8Array(w * h), q = [];
    const dark = (x, y) => lum(clean, (y0 + y) * W + x0 + x) < 150;
    const push = (x, y) => { const k = y * w + x; if (!out[k] && dark(x, y)) { out[k] = 1; q.push(k); } };
    for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); } for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
    while (q.length) { const k = q.pop(), x = k % w, y = (k / w) | 0; if (x > 0) push(x - 1, y); if (x < w - 1) push(x + 1, y); if (y > 0) push(x, y - 1); if (y < h - 1) push(x, y + 1); }
    let a = new Float32Array(W * H); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) a[(y0 + y) * W + x0 + x] = out[y * w + x] ? 0 : 1;
    // keep the soft golden glow just outside the frame
    a = boxBlurF(a, 2); for (let i = 0; i < W * H; i++) a[i] = Math.min(1, a[i] * 1.4);
    await layer('card', cBox, a); }

  // ---- background: take those out, and rebuild the scenery where the date box was ----
  const hole = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) if (og.m[i]) hole[i] = 1;
  { // "Wedding": take the letters AND their dark drop-shadow, but keep non-gold bright things (shirt, bulbs)
    const [x0, y0, x1, y1] = wBox, core = new Uint8Array(W * H);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = y * W + x; if (wg.m[i]) core[i] = 1; }
    const wide = dilate(core, 9);
    for (let y = y0 - 9; y < y1 + 9; y++) for (let x = x0 - 9; x < x1 + 9; x++) {
      const i = y * W + x; if (!wide[i]) continue;
      const r = clean[i * 3], g = clean[i * 3 + 1], b = clean[i * 3 + 2], keep = !core[i] && lum(clean, i) > 120 && r - b < 30;
      if (!keep) hole[i] = 1;
    }
  }
  for (let y = 1180; y < 1362; y++) for (let x = 184; x < 888; x++) hole[y * W + x] = 1; // card
  const box = [742, 840, 1065, 1188];
  for (let y = box[1]; y < box[3]; y++) for (let x = box[0]; x < box[2]; x++) hole[y * W + x] = 1;
  const base0 = pushPull(clean, hole);
  let filled = Float32Array.from(base0);
  // date box: lake rows 724–848 (clear of the names and gold rules), ping-ponged downwards,
  // columns left of x 880 borrowed from 880–1000 so no couple/rule pixels are copied
  const boxHole = new Uint8Array(W * H);
  for (let y = box[1]; y < box[3]; y++) for (let x = box[0]; x < box[2]; x++) {
    const i = y * W + x; boxHole[i] = 1;
    const d = y - box[1], per = 124 * 2, m = d % per, sy = 848 - (m < 124 ? m : per - 1 - m);
    const sx = x < 880 ? 880 + ((880 - x) % 120) : x;
    for (let k = 0; k < 3; k++) filled[i * 3 + k] = clean[(sy * W + sx) * 3 + k];
  }
  // fade into the sky on the left over 70px, and darken gently with depth
  for (let y = box[1]; y < box[3]; y++) for (let x = box[0]; x < box[2]; x++) {
    const i = y * W + x, t = ss((x - box[0]) / 70) * ss((box[3] - y) / 45), dk = 1 - 0.35 * ss((y - 900) / 200);
    for (let k = 0; k < 3; k++) filled[i * 3 + k] = (filled[i * 3 + k] * dk) * t + base0[i * 3 + k] * (1 - t);
  }
  // soften the box seam
  let wb = new Float32Array(W * H); for (let i = 0; i < W * H; i++) wb[i] = boxHole[i]; wb = boxBlurF(wb, 3);
  const bg = new Float32Array(W * H * 3);
  const base = base0;
  for (let i = 0; i < W * H; i++) { const t = boxHole[i] ? 1 : Math.min(1, wb[i] * 2); for (let k = 0; k < 3; k++) bg[i * 3 + k] = base[i * 3 + k] * (1 - t) + filled[i * 3 + k] * t; }
  await save(bg, OUT + '/background.jpg', 90);
  await save(bg, OUT + '/background.png');
})();
