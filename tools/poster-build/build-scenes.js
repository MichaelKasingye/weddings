// The two swappable scene pictures at the bottom of the poster (left: night party, right: dancers).
// Writes into assets/art/:
//   scene-left-mask.png / scene-right-mask.png   soft-edged shape of each slot (alpha)
//   scene-left-base.webp / scene-right-base.webp blurred copy of the poster under the slot (hides the old picture at the edges)
//   scene-left.jpg / scene-right.jpg             the design's own pictures, as defaults (only with --defaults)
// usage: node build-scenes.js [--defaults]
const sharp = require('sharp');
const path = require('path');
const W = 1065, H = 1598, ROOT = path.resolve(__dirname, '../..'), ART = ROOT + '/assets/art/';
const SLOTS = { // box [x, y, w, h] on the poster grid + the slot's outline (poster coordinates)
  left: { box: [0, 1180, 410, 400], poly: [[-30, 1222], [120, 1200], [330, 1240], [352, 1300], [352, 1385], [392, 1445], [378, 1520], [300, 1572], [110, 1572], [-30, 1540]] },
  right: { box: [680, 1190, 385, 390], poly: [[737, 1292], [820, 1255], [960, 1222], [1095, 1205], [1095, 1545], [950, 1572], [762, 1572], [704, 1500], [694, 1432], [727, 1372]] },
};
(async () => {
  const bg = sharp(ART + 'Emerald Gold Wedding Invitation.png').removeAlpha().resize(W, H, { kernel: 'lanczos3' });
  for (const [name, { box: [x, y, w, h], poly }] of Object.entries(SLOTS)) {
    const pts = poly.map(([px, py]) => `${px - x},${py - y}`).join(' ');
    const shape = (grow, blur) => sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><polygon points="${pts}" fill="#fff" stroke="#fff" stroke-width="${grow}" stroke-linejoin="round"/></svg>`)).ensureAlpha().blur(blur).extractChannel(3).raw().toBuffer();
    const toAlpha = async (a, rgb) => { const B = Buffer.alloc(w * h * 4); for (let i = 0; i < w * h; i++) { B[i * 4] = rgb ? rgb[i * 3] : 255; B[i * 4 + 1] = rgb ? rgb[i * 3 + 1] : 255; B[i * 4 + 2] = rgb ? rgb[i * 3 + 2] : 255; B[i * 4 + 3] = a[i]; } return sharp(B, { raw: { width: w, height: h, channels: 4 } }); };
    await (await toAlpha(await shape(0, 16))).png().toFile(`${ART}scene-${name}-mask.png`);
    const crop = bg.clone().extract({ left: x, top: y, width: w, height: h });
    const blurred = await crop.clone().blur(14).raw().toBuffer();
    await (await toAlpha(await shape(6, 16), blurred)).webp({ quality: 80, alphaQuality: 90 }).toFile(`${ART}scene-${name}-base.webp`);
    if (process.argv.includes('--defaults')) await crop.clone().jpeg({ quality: 88, mozjpeg: true }).toFile(`${ART}scene-${name}.jpg`);
    console.log(name, { x, y, w, h });
  }
})();
