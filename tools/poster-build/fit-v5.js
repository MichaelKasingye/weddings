// Fits every line of wording to the lettering of reference-v5.png: renders the page, measures each element's
// ink box, and nudges --x/--y/--fs/--sx (and --lh for multi-line blocks) until it lands on the reference.
// Where our wording differs, the reference's wording is put in temporarily for the fit (REF below).
// usage: (static server on :8765)  node fit-v5.js [iterations]
const { chromium } = require('playwright');
const sharp = require('sharp');
const fs = require('fs');
const HTML = require('path').resolve(__dirname, '../../index.html');
const URL = process.env.POSTER_URL || 'http://localhost:8765/index.html';
const T = { // selector: [x0, x1, y0, y1, lines, pitch, refText?]
  '[data-bind="intro"]': [790, 1013, 271, 391, 4, 33],
  '#tabGroom': [253, 400, 405, 428, 1], '#tabBride': [657, 802, 406, 429, 1],
  '[data-bind="families.groom"]': [150, 508, 442, 523, 3, 28, 'Mr. & Mrs. Simbwa Moses\nand Mrs. Nabukalu Kayonga Magaret\nof Kitoma, Masaka, Buddu.'],
  '[data-bind="families.bride"]': [589, 866, 444, 526, 3, 28, 'Mr. & Mrs. Mawande Ronald\nand Mrs. Nakatte Sanyu\nof Kingo, Lwengo, Buddu.'],
  '[data-bind="inviteLine"]': [318, 732, 553, 588, 1],
  '[data-bind="matrimonyLine"]': [237, 824, 662, 691, 1],
  '[data-bind="couple.groom"]': [222, 897, 702, 798, 1, 0, 'Mr. Mark Mukasa'],
  '[data-bind="couple.bride"]': [246, 857, 840, 930, 1, 0, 'Mary Busingye'],
  '#labDate': [167, 221, 969, 989, 1],
  '#dateText': [168, 334, 999, 1054, 2, 31, 'Saturday,\n1st January 2027'],
  '[data-bind="church.label"]': [466, 619, 969, 988, 1],
  '#churchName': [466, 632, 998, 1019, 1, 0, 'St. Paul’s Church,'],
  '#churchTime': [466, 615, 1052, 1070, 1, 0, 'Time: 10:00 AM'],
  '[data-bind="church.note"]': [429, 633, 1077, 1118, 2, 21, '(Guests are requested\nto be seated by 9:30 AM)'],
  '[data-bind="reception.label"]': [790, 895, 973, 998, 1],
  '#receptionText': [789, 1012, 1002, 1084, 3, 29.5, 'HTML:Thereafter, guests will\nproceed to <a class="det-link det-venue">Kigo Gardens</a>\nstarting at 2:00 PM.'],
  '[data-bind="colorTheme"]': [298, 761, 1140, 1169, 1],
  '[data-bind="tagline"]': [264, 799, 1191, 1222, 1],
  '[data-bind="rsvp.title"]': [473, 608, 1237, 1274, 1],
  '[data-bind="rsvp.name"]': [412, 665, 1282, 1315, 1],
  '#rsvpPhone': [483, 658, 1326, 1352, 1],
  '[data-bind="footerRibbon"]': [428, 655, 1372, 1420, 1],
};
const ITER = +process.argv[2] || 5;
(async () => {
  const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  const p = await b.newPage({ viewport: { width: 1065, height: 1598 }, reducedMotion: 'reduce' });
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  await p.addStyleTag({ content: `.welcome,.dock,.toast,.poster-bg,.art,.couple,canvas,.twinkles,.guest-bar{display:none!important}
    .page{padding:0!important} .poster{border-radius:0!important;box-shadow:none!important;background:#000!important}
    .tx,.tx *{color:#fff!important;-webkit-text-fill-color:#fff!important;-webkit-text-stroke-color:#fff!important;background:none!important;filter:none!important;text-shadow:none!important;animation:none!important;opacity:1!important;border:0!important}
    .gold::after{display:none!important} .tx.fit-hide{visibility:hidden!important}` });
  await p.evaluate((T) => { for (const [sel, t] of Object.entries(T)) { const ref = t[6]; if (!ref) continue; const e = document.querySelector(sel);
    if (ref.startsWith('HTML:')) e.innerHTML = ref.slice(5); else { const a = e.querySelector('a'); if (a) a.textContent = ref; else e.textContent = ref; } } }, T);
  await p.waitForTimeout(400);
  const measure = async (sel) => {
    await p.evaluate((sel) => document.querySelectorAll('.tx').forEach((e) => e.classList.toggle('fit-hide', !e.matches(sel))), sel);
    const { data, info } = await sharp(await p.locator('#poster').screenshot()).greyscale().raw().toBuffer({ resolveWithObject: true });
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
      await setVars(sel, v); m = await measure(sel);
      const [ix0, ix1, iy0, iy1] = m, fixed = n > 1 ? (n - 1) * pitch : 0;
      const kH = (ty1 - ty0 - fixed) / (iy1 - iy0 - fixed), kW = (tx1 - tx0) / (ix1 - ix0);
      if (v.c) v.x += (tx0 + tx1) / 2 - (ix0 + ix1) / 2; else v.x += tx0 - ix0;
      v.y += ty0 - iy0; v.fs *= kH; v.sx = Math.max(0.8, Math.min(1.2, v.sx * kW / kH));
    }
    if (pitch) v.lh = pitch / v.fs;
    await setVars(sel, v); m = await measure(sel);
    out[sel] = v;
    console.log(sel.padEnd(30), 'ink', m.join(','), ' target', [tx0, tx1, ty0, ty1].join(','), ' →', `fs ${v.fs.toFixed(1)} sx ${v.sx.toFixed(3)}`);
  }
  let html = fs.readFileSync(HTML, 'utf8');
  for (const sel of Object.keys(T)) {
    const v = out[sel], r = (k, d) => +(+v[k]).toFixed(d);
    const style = `--x:${r('x', 1)};--y:${r('y', 1)};--fs:${r('fs', 2)};--sx:${r('sx', 3)}` + (T[sel][5] ? `;--lh:${r('lh', 3)}` : '');
    const m = sel.match(/^#(.+)$/) ? ['id', sel.slice(1)] : ['data-bind', sel.match(/data-bind="([^"]+)"/)[1]];
    const re = new RegExp('(<[a-z0-9]+ [^>]*?)style="[^"]*"([^>]*' + m[0] + '="' + m[1].replace(/\./g, '\\.') + '")|(<[a-z0-9]+ [^>]*' + m[0] + '="' + m[1].replace(/\./g, '\\.') + '"[^>]*?)style="[^"]*"');
    const before = html;
    html = html.replace(re, (all, a, b2, c) => (a !== undefined ? `${a}style="${style}"${b2}` : `${c}style="${style}"`));
    if (html === before) console.log('!! could not write', sel);
  }
  fs.writeFileSync(HTML, html);
  await b.close();
})();
