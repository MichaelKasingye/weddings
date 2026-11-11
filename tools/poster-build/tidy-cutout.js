// Clean the matte: drop the faint ghost of the guest behind, make the couple solid, fade sides + bottom.
const sharp = require('sharp');
// usage: node tidy-cutout.js [fadeStartY fadeEndY]   (reads cut.png, writes couple-new.png; y in photo pixels)
(async () => {
  const { data, info } = await sharp('cut.png').raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, N = W * H;
  const a = new Float32Array(N); for (let i = 0; i < N; i++) a[i] = data[i * 4 + 3] / 255;
  // background = everything reachable from the top / upper sides through low alpha
  const bgReach = new Uint8Array(N), q = [];
  const push = (i) => { if (!bgReach[i] && a[i] < 0.5) { bgReach[i] = 1; q.push(i); } };
  for (let x = 0; x < W; x++) push(x);
  for (let y = 0; y < 300; y++) { push(y * W); push(y * W + W - 1); }
  while (q.length) { const i = q.pop(), x = i % W, y = (i / W) | 0; if (x > 0) push(i - 1); if (x < W - 1) push(i + 1); if (y > 0) push(i - W); if (y < H - 1) push(i + W); }
  const ss = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  let out = new Float32Array(N);
  for (let i = 0; i < N; i++) out[i] = bgReach[i] ? ss((a[i] - 0.38) / 0.3) : Math.max(a[i], ss((a[i] - 0.15) / 0.3), 1 - (1 - a[i]) * 0); // enclosed = solid
  for (let i = 0; i < N; i++) if (!bgReach[i]) out[i] = 1;
  // soften the hard step created at the reach boundary (1px blur, edge pixels only)
  const sm = Float32Array.from(out);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; let s = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += out[i + dy * W + dx]; sm[i] = s / 9; }
  out = sm;
  // fades: bottom (hides the flowers), left/right (photo was cut at the frame edge)
  const BOT0 = +process.argv[2] || 420, BOT1 = +process.argv[3] || 520, SIDE = 46;
  const hcut = BOT1 + 2, B = Buffer.alloc(W * hcut * 4);
  for (let y = 0; y < hcut; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, o = i * 4;
    let f = 1 - ss((y - BOT0) / (BOT1 - BOT0));
    const sideOn = ss((y - 270) / 70); // only where the shoulders meet the frame edge
    const leftOn = ss((y - 150) / 70); // his ear and shoulder meet the photo's left edge higher up
    f *= (1 - leftOn + leftOn * ss(x / 34)) * (1 - sideOn + sideOn * ss((W - 1 - x) / SIDE));
    B[o] = data[i * 4]; B[o + 1] = data[i * 4 + 1]; B[o + 2] = data[i * 4 + 2]; B[o + 3] = Math.round(out[i] * f * 255);
  }
  await sharp(B, { raw: { width: W, height: hcut, channels: 4 } }).png().toFile('couple-new.png');
  await sharp({ create: { width: W, height: hcut, channels: 3, background: '#1d2a5c' } }).composite([{ input: 'couple-new.png' }]).png().toFile('couple-new-preview.png');
  console.log('couple-new.png', W, hcut);
})();
