// Small image toolkit on Float32 RGB buffers (W x H x 3) and Uint8 masks (W x H).
const W = 1065, H = 1477;
function lum(img, i) { return 0.299 * img[i * 3] + 0.587 * img[i * 3 + 1] + 0.114 * img[i * 3 + 2]; }
function dilate(m, r, w = W, h = H) { // square-ish (separable) max filter
  const t = new Uint8Array(m.length), o = new Uint8Array(m.length);
  for (let y = 0; y < h; y++) { let last = -1e9; for (let x = 0; x < w; x++) { if (m[y * w + x]) last = x; t[y * w + x] = x - last <= r ? 1 : 0; } last = 1e9; for (let x = w - 1; x >= 0; x--) { if (m[y * w + x]) last = x; if (last - x <= r) t[y * w + x] = 1; } }
  for (let x = 0; x < w; x++) { let last = -1e9; for (let y = 0; y < h; y++) { if (t[y * w + x]) last = y; o[y * w + x] = y - last <= r ? 1 : 0; } last = 1e9; for (let y = h - 1; y >= 0; y--) { if (t[y * w + x]) last = y; if (last - y <= r) o[y * w + x] = 1; } }
  return o;
}
function dilateRound(m, r) { // disk dilation (for silhouettes)
  const o = new Uint8Array(m.length), offs = [];
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r) offs.push([dx, dy]);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!m[y * W + x]) continue;
    // only edge pixels need to stamp
    if (x > 0 && x < W - 1 && y > 0 && y < H - 1 && m[y * W + x - 1] && m[y * W + x + 1] && m[(y - 1) * W + x] && m[(y + 1) * W + x]) { o[y * W + x] = 1; continue; }
    for (const [dx, dy] of offs) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < W && Y < H) o[Y * W + X] = 1; }
  }
  return o;
}
function boxBlurF(a, r, w = W, h = H) { // float single-channel box blur, 3 passes ~ gaussian
  let src = Float32Array.from(a);
  for (let pass = 0; pass < 3; pass++) {
    const t = new Float32Array(src.length), o = new Float32Array(src.length);
    for (let y = 0; y < h; y++) { let s = 0, n = 0; for (let x = -r; x < w + r; x++) { if (x + r < w && x + r >= 0) { s += src[y * w + x + r]; n++; } if (x - r - 1 >= 0 && x - r - 1 < w) { s -= src[y * w + x - r - 1]; n--; } if (x >= 0 && x < w) t[y * w + x] = s / n; } }
    for (let x = 0; x < w; x++) { let s = 0, n = 0; for (let y = -r; y < h + r; y++) { if (y + r < h && y + r >= 0) { s += t[(y + r) * w + x]; n++; } if (y - r - 1 >= 0 && y - r - 1 < h) { s -= t[(y - r - 1) * w + x]; n--; } if (y >= 0 && y < h) o[y * w + x] = s / n; } }
    src = o;
  }
  return src;
}
// Push-pull hole filling: hole[i]=1 pixels are rebuilt from their nearest surroundings.
function pushPull(img, hole, w = W, h = H) {
  const levels = [];
  let val = new Float32Array(w * h * 3), wt = new Float32Array(w * h), lw = w, lh = h;
  for (let i = 0; i < w * h; i++) if (!hole[i]) { wt[i] = 1; for (let k = 0; k < 3; k++) val[i * 3 + k] = img[i * 3 + k]; }
  levels.push({ val, wt, w: lw, h: lh });
  while (lw > 1 || lh > 1) {
    const nw = Math.ceil(lw / 2), nh = Math.ceil(lh / 2), nv = new Float32Array(nw * nh * 3), ns = new Float32Array(nw * nh);
    for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) { const i = y * lw + x, j = (y >> 1) * nw + (x >> 1); ns[j] += wt[i]; for (let k = 0; k < 3; k++) nv[j * 3 + k] += wt[i] * val[i * 3 + k]; }
    const nt = new Float32Array(nw * nh);
    for (let j = 0; j < nw * nh; j++) { if (ns[j] > 0) for (let k = 0; k < 3; k++) nv[j * 3 + k] /= ns[j]; nt[j] = Math.min(1, ns[j]); }
    val = nv; wt = nt; lw = nw; lh = nh; levels.push({ val, wt, w: lw, h: lh });
  }
  let up = levels[levels.length - 1].val;
  for (let l = levels.length - 2; l >= 0; l--) {
    const L = levels[l], U = levels[l + 1], out = new Float32Array(L.w * L.h * 3);
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
      const i = y * L.w + x;
      const fx = Math.min(Math.max((x + 0.5) / 2 - 0.5, 0), U.w - 1), fy = Math.min(Math.max((y + 0.5) / 2 - 0.5, 0), U.h - 1);
      const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(x0 + 1, U.w - 1), y1 = Math.min(y0 + 1, U.h - 1), ax = fx - x0, ay = fy - y0;
      for (let k = 0; k < 3; k++) {
        const u = (up[(y0 * U.w + x0) * 3 + k] * (1 - ax) + up[(y0 * U.w + x1) * 3 + k] * ax) * (1 - ay) + (up[(y1 * U.w + x0) * 3 + k] * (1 - ax) + up[(y1 * U.w + x1) * 3 + k] * ax) * ay;
        out[i * 3 + k] = L.wt[i] * L.val[i * 3 + k] + (1 - L.wt[i]) * u;
      }
    }
    up = out;
  }
  const res = Float32Array.from(img);
  for (let i = 0; i < w * h; i++) if (hole[i]) for (let k = 0; k < 3; k++) res[i * 3 + k] = up[i * 3 + k];
  return res;
}
module.exports = { W, H, lum, dilate, dilateRound, boxBlurF, pushPull };
