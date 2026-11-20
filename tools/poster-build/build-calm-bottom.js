// Replaces the two scene pictures at the bottom of the poster with calm emerald (the green of the
// invitation area), keeping the gold ribbons, RSVP frame, plants and corner leaves. Writes poster.webp.
// usage: node build-calm-bottom.js [outDir]   (reads assets/art/poster.webp)
const sharp = require('sharp');
const path = require('path');
const { boxBlurF } = require('./lib');
const W = 1065, H = 1598, ROOT = path.resolve(__dirname, '../..'), OUT = process.argv[2] || __dirname + '/out-calm';
const ss = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
(async () => {
  require('fs').mkdirSync(OUT, { recursive: true });
  const bg = Float32Array.from(await sharp(ROOT + '/public/assets/art/poster.webp').removeAlpha().raw().toBuffer());
  // the area to calm: below the ribbons (y > ~1200), outside the RSVP frame and the central plants
  const a = new Float32Array(W * H);
  // keep-outs: the RSVP frame (its outline: notched corners, so the bottom row is narrower than the middle)
  // and the central plant cluster (soft-edged, so it melts into the green)
  const inRsvp = (x, y) => {
    if (y < 1221 || y > 1392) return false;
    const half = y < 1233 ? 146 : y > 1378 ? 146 : 186;   // notched top and bottom corners
    return Math.abs(x - 537) < half;
  };
  const plantT = (x, y) => { const dx = (x - 545) / 175, dy = (y - 1570) / 160; return 1 - ss((Math.hypot(dx, dy) - 0.72) / 0.28); };
  for (let y = 1150; y < H; y++) for (let x = 0; x < W; x++) {
    const top = ss((y - 1192) / 55);
    a[y * W + x] = top * (1 - plantT(x, y));
  }
  const soft = boxBlurF(a, 7, W, H);
  // Inside the RSVP area everything goes green: the frame is redrawn cleanly afterwards (see below);
  // only the gold phone icon (painted into the artwork, left of the number) is kept.
  const isGold = (i) => { const r = bg[i * 3], g = bg[i * 3 + 1], b = bg[i * 3 + 2]; return r > 110 && r - b > 40 && g > 0.5 * r && r > g; };
  // emerald taken from the invitation area, with a gentle radial glow towards the centre and a darker base
  for (let y = 1150; y < H; y++) for (let x = 0; x < W; x++) {
    const t = soft[y * W + x]; if (t <= 0.002) continue;
    const d = Math.hypot((x - 532) / 560, (y - 1300) / 300);
    const g = Math.max(0, 1 - d), i = y * W + x;
    const col = [8 + 10 * g, 56 + 28 * g, 30 + 16 * g];
    for (let k = 0; k < 3; k++) bg[i * 3 + k] = bg[i * 3 + k] * (1 - t) + col[k] * t;
  }
  const b = Buffer.alloc(W * H * 3); for (let i = 0; i < b.length; i++) b[i] = Math.max(0, Math.min(255, Math.round(bg[i])));
  // Clean gold frame, the same stepped-bracket shape as the design (measured outline), with a soft glow
  const F = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF1B8"/><stop offset=".35" stop-color="#F3C85A"/><stop offset=".7" stop-color="#C9962E"/><stop offset="1" stop-color="#F7DA7A"/></linearGradient>
      <filter id="glow" x="-10%" y="-20%" width="120%" height="140%"><feGaussianBlur stdDeviation="5"/></filter>
    </defs>
    <!-- the badge: a filled emerald panel with notched corners (the design's "Color Theme" style), thick gold border -->
    <path id="fr" d="M372 1224 H702 Q710 1224 712 1232 L722 1242 Q730 1246 730 1256 V1350 Q730 1360 722 1364 L712 1374 Q710 1382 702 1382 H372 Q364 1382 362 1374 L352 1364 Q344 1360 344 1350 V1256 Q344 1246 352 1242 L362 1232 Q364 1224 372 1224 Z" fill="none"/>
    <use href="#fr" stroke="#F6D27A" stroke-opacity=".55" stroke-width="18" filter="url(#glow)"/>
    <use href="#fr" fill="#0B4A2A" stroke="none"/>
    <path d="M352 1240 H722 V1366 H352 Z" fill="#0C5431" opacity=".85"/>
    <use href="#fr" stroke="#5A3A08" stroke-width="7"/>
    <use href="#fr" stroke="url(#g)" stroke-width="4.5"/>
    <use href="#fr" stroke="#FFF6D0" stroke-opacity=".55" stroke-width="1"/>
    <path d="M372 1231 H702 M372 1375 H702" stroke="#F3C85A" stroke-opacity=".45" stroke-width="1.2"/>
    <g transform="translate(424 1318) scale(1.55)" fill="none" stroke="#5A3A08" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></g>
    <g transform="translate(424 1318) scale(1.55)" fill="url(#g)" stroke="#F7DA7A" stroke-width=".8" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></g>
  </svg>`;
  await sharp(b, { raw: { width: W, height: H, channels: 3 } }).composite([{ input: Buffer.from(F) }]).webp({ quality: 90 }).toFile(OUT + '/poster.webp');
  await sharp(OUT + '/poster.webp').extract({ left: 0, top: 1120, width: W, height: 478 }).png().toFile(OUT + '/bottom.png');
  console.log('written', OUT + '/poster.webp');
})();
