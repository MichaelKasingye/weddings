const { chromium } = require('playwright');
(async () => {
  const out = process.argv[2] || 'shot.png';
  let browser;
  browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  const page = await browser.newPage({ viewport: { width: 1065, height: 1477 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  await page.addInitScript(() => { localStorage.setItem('mm-wedding:fireworks','0'); localStorage.setItem('mm-wedding:confetti','0'); });
  await page.goto((process.env.POSTER_URL || 'http://localhost:8765/index.html') + (process.argv[3] || ''), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: '.welcome,.dock,.toast{display:none!important} .poster{border-radius:0!important;box-shadow:none!important} .page{padding:0!important}' });
  await page.waitForTimeout(1600);
  await page.locator('#poster').screenshot({ path: out });
  await browser.close();
})();
