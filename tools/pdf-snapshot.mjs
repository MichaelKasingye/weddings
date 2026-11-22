#!/usr/bin/env node
/**
 * Takes the picture of the poster that every guest's PDF is built on: src/og/poster-pdf.jpg.
 *
 * It opens a real invitation in Chrome, waits until everything has loaded, hides the parts that differ
 * per guest or can change in Settings (the guest's name and seats, the RSVP names and numbers), and
 * photographs the poster. The PDF route draws those parts back in for each guest (src/lib/invite-pdf.tsx).
 *
 * Run it again whenever the poster's artwork or wording changes:
 *
 *   npm run dev                                   (in another terminal)
 *   npm run pdf-snapshot -- http://localhost:3000/i/<any-guest-link>
 *
 * Needs Playwright (npx playwright install chromium) or Chrome: set CHROME=/usr/bin/google-chrome.
 * The visit isn't counted as a view: the "viewed" request is blocked.
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'src/og/poster-pdf.jpg');
const SCALE = 1.5; // 1598 × 2397 pixels: sharp on phones, about 1 MB

function loadPlaywright() {
  for (const name of ['playwright', 'playwright-core']) {
    try { return require(name); } catch { /* try the next one */ }
  }
  console.error('Playwright is not installed. Run: npx playwright install chromium (or npm i -D playwright)');
  process.exit(1);
}

const url = process.argv[2];
if (!url || !/\/i\/[^/]+$/.test(url)) {
  console.error('Usage: npm run pdf-snapshot -- http://localhost:3000/i/<any-guest-link>');
  process.exit(1);
}

const { chromium } = loadPlaywright();
const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
try {
  const page = await browser.newPage({ viewport: { width: 1065, height: 1598 }, deviceScaleFactor: SCALE, reducedMotion: 'reduce' });
  await page.route('**/api/open', (r) => r.abort()); // don't count this as the guest viewing their invite
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({
    content: `
      .welcome, .toast, .music-btn, .pdf-btn, .confetti-canvas, .poster-fireworks, .poster-video { display: none !important; }
      .poster { border-radius: 0 !important; box-shadow: none !important; }
      .page { padding: 0 !important; }
      /* drawn per guest by the PDF route */
      .guest-name, .guest-count, .rsvp-bar > * { visibility: hidden !important; }
    `,
  });
  await page.waitForTimeout(2500); // entrance animations finish
  const box = await page.locator('#poster').boundingBox();
  if (!box || Math.round(box.width) !== 1065) throw new Error(`The poster is ${box?.width} px wide, expected 1065.`);
  await page.locator('#poster').screenshot({ path: OUT, type: 'jpeg', quality: 85 });
  console.log(`Saved ${OUT}`);
} finally {
  await browser.close();
}
