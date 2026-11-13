// Step 3 (run after build-layout.js): prepares the background for the emerald information layout.
//   - removes the gold rules + diamonds beside the old "and" (the new layout has its own "&" medallion)
//   - turns the centre where the old rings/guest card were lifted out into a smooth dark stage
// usage: node build-emerald.js [outDir] [step2Dir]   -> outDir/poster.webp (copy to assets/art/poster.webp)
const sharp = require('sharp');
const { W, H, lum, dilate, boxBlurF, pushPull } = require('./lib');
const OUT = process.argv[2] || __dirname + '/out3';
const IN = (process.argv[3] || __dirname + '/out2') + '/background.png';
(async () => {
  require('fs').mkdirSync(OUT, { recursive: true });
  let img = Float32Array.from(await sharp(IN).removeAlpha().raw().toBuffer());
  // 1) gold rules + diamonds around y 700
  const m = new Uint8Array(W * H);
  for (let y = 688; y < 716; y++) for (let x = 236; x < 846; x++) { const i = y * W + x, r = img[i * 3], g = img[i * 3 + 1], b = img[i * 3 + 2]; if ((r > 80 && r - b > 30 && g > 0.45 * r) || lum(img, i) > 150) m[i] = 1; }
  img = pushPull(img, dilate(m, 3));
  // 2) dark stage: centre column (right of the dancing couple higher up, wider lower down)
  const ss = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  const ramp = (v, a0, a1, b0, b1) => ss((v - a0) / (a1 - a0)) * (1 - ss((v - b0) / (b1 - b0)));
  const a = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const upper = 0.8 * ramp(x, 380, 470, 700, 790) * ramp(y, 820, 880, 1060, 1120);           // where the old rings were
    const lower = 0.9 * ramp(x, 95, 205, 868, 978) * ramp(y, 1090, 1180, 1350, 1430);          // where the old guest card was (full strength at its old edges x 184 / 888)
    a[y * W + x] = Math.max(upper, lower);
  }
  const NAVY = [9, 13, 36];
  for (let i = 0; i < W * H; i++) { const t = a[i]; if (t <= 0) continue; for (let k = 0; k < 3; k++) img[i * 3 + k] = img[i * 3 + k] * (1 - t) + NAVY[k] * t; }
  const b = Buffer.alloc(W * H * 3); for (let i = 0; i < b.length; i++) b[i] = Math.max(0, Math.min(255, Math.round(img[i])));
  await sharp(b, { raw: { width: W, height: H, channels: 3 } }).png().toFile(OUT + '/background.png');
  await sharp(b, { raw: { width: W, height: H, channels: 3 } }).webp({ quality: 90 }).toFile(OUT + '/poster.webp');
  console.log('written', OUT + '/poster.webp');
})();
