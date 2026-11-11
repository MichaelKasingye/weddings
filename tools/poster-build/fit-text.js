// Render the page, measure the ink of every wording element, and nudge its
// --fs / --sx / --x / --y / --lh until it lands on the reference ink box.
const { chromium } = require('playwright');
const sharp = require('sharp');
const fs = require('fs');
const HTML = require('path').resolve(__dirname, '../../index.html');
const URL = process.env.POSTER_URL || 'http://localhost:8765/index.html';
const T = { // selector: [x0, x1, y0, y1, lines, pitch]   (ink boxes measured on reference.png)
  '[data-bind="couple.groom"]': [231, 851, 600, 664, 1],
  '.and': [500, 592, 669, 712, 1],
  '[data-bind="couple.bride"]': [265, 830, 720, 800, 1],
  '.invite': [201, 875, 806, 836, 1],
  '.intro': [812, 1013, 303, 384, 3, 29.5],
  '#dateText': [868, 1003, 880, 958, 3, 29],
  '#timeText': [869, 1021, 998, 1047, 2, 29],
  '#locationLink': [846, 1040, 1087, 1164, 3, 26.5],
  '.guest-heading': [247, 818, 1213, 1231, 1],
  '.guest-sub': [403, 670, 1240, 1268, 1],
  '.guest-label': [251, 334, 1298, 1317, 1],
  '.tagline': [235, 836, 1373, 1410, 1],
};
const ITER = +process.argv[2] || 4;
(async () => {
  const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  const p = await b.newPage({ viewport: { width: 1065, height: 1477 }, reducedMotion: 'reduce' });
  await p.addInitScript(() => { localStorage.setItem('mm-wedding:fireworks', '0'); localStorage.setItem('mm-wedding:confetti', '0'); });
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  await p.addStyleTag({ content: `.welcome,.dock,.toast,.poster-bg,.art,.couple,canvas,.twinkles,.rule,.guest-dots{display:none!important}
    .page{padding:0!important} .poster{border-radius:0!important;box-shadow:none!important;background:#000!important}
    .tx{color:#fff!important;-webkit-text-fill-color:#fff!important;-webkit-text-stroke-color:#fff!important;background:none!important;filter:none!important;text-shadow:none!important;animation:none!important;opacity:1!important}
    .tx.fit-hide{visibility:hidden!important}` });
  await p.waitForTimeout(500);
  const measure = async (sel) => {
    await p.evaluate((sel) => document.querySelectorAll('.tx').forEach((e) => e.classList.toggle('fit-hide', !e.matches(sel))), sel);
    const buf = await p.locator('#poster').screenshot();
    const { data, info } = await sharp(buf).greyscale().raw().toBuffer({ resolveWithObject: true });
    let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) if (data[y * info.width + x] > 110) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return [x0, x1 + 1, y0, y1 + 1];
  };
  const getVars = (sel) => p.evaluate((sel) => { const e = document.querySelector(sel); const g = (k, d) => parseFloat(e.style.getPropertyValue(k)) || d; return { x: g('--x'), y: g('--y'), fs: g('--fs'), sx: g('--sx', 1), lh: g('--lh', 1.15), c: e.classList.contains('c') }; }, sel);
  const setVars = (sel, v) => p.evaluate(([sel, v]) => { const e = document.querySelector(sel); for (const [k, val] of Object.entries(v)) if (k !== 'c') e.style.setProperty('--' + k, String(+val.toFixed(k === 'sx' || k === 'lh' ? 4 : 2))); }, [sel, v]);
  const out = {};
  for (const [sel, [tx0, tx1, ty0, ty1, n, pitch]] of Object.entries(T)) {
    let v = await getVars(sel), m;
    for (let it = 0; it < ITER; it++) {
      if (pitch) v.lh = pitch / v.fs;
      await setVars(sel, v);
      m = await measure(sel);
      const [ix0, ix1, iy0, iy1] = m;
      const fixed = n > 1 ? (n - 1) * pitch : 0;
      const kH = (ty1 - ty0 - fixed) / (iy1 - iy0 - fixed), kW = (tx1 - tx0) / (ix1 - ix0);
      // move first (measured at current size), then rescale
      if (v.c) v.x += (tx0 + tx1) / 2 - (ix0 + ix1) / 2; else v.x += tx0 - ix0;
      v.y += ty0 - iy0;
      v.fs *= kH; v.sx *= kW / kH;
    }
    if (pitch) v.lh = pitch / v.fs;
    await setVars(sel, v);
    m = await measure(sel);
    out[sel] = { v, m, target: [tx0, tx1, ty0, ty1] };
    console.log(sel.padEnd(28), 'ink', m.join(','), ' target', [tx0, tx1, ty0, ty1].join(','), ' →', `x ${v.x.toFixed(1)} y ${v.y.toFixed(1)} fs ${v.fs.toFixed(2)} sx ${v.sx.toFixed(3)}${pitch ? ' lh ' + v.lh.toFixed(3) : ''}`);
  }
  // write back into index.html
  let html = fs.readFileSync(HTML, 'utf8');
  await p.evaluate(() => document.querySelectorAll('.fit-hide').forEach((e) => e.classList.remove('fit-hide')));
  const sels = await p.evaluate((sels) => sels.map((s) => document.querySelector(s).outerHTML.match(/^<[^>]+>/)[0]), Object.keys(T));
  // replace style attr by locating each element's unique opening tag in the source (by its other attributes)
  Object.keys(T).forEach((sel, i) => {
    const v = out[sel].v; const r = (k, d) => +(+v[k]).toFixed(d);
    const style = `--x:${r('x', 1)};--y:${r('y', 1)};--fs:${r('fs', 2)};--sx:${r('sx', 3)}` + (T[sel][5] ? `;--lh:${r('lh', 3)}` : '');
    const tagStart = sels[i].replace(/ style="[^"]*"/, '').replace(/ class="[^"]*"/, '');
    // find source tag that contains a distinctive attribute of this element
    const key = (sels[i].match(/(id|data-bind)="[^"]*"/) || sels[i].match(/class="[^"]*"/))[0];
    const re = new RegExp('(<[a-z0-9]+ [^>]*' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^>]*?)style="[^"]*"|(<[a-z0-9]+ [^>]*?)style="[^"]*"([^>]*' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')');
    const before = html;
    html = html.replace(re, (all, a, b2, c) => a !== undefined ? `${a}style="${style}"` : `${b2}style="${style}"${c}`);
    if (html === before && !before.includes('style="' + style + '"')) console.log('!! could not write', sel);
  });
  fs.writeFileSync(HTML, html);
  await b.close();
})();
