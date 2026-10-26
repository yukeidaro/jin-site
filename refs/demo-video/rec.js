const { chromium } = require('playwright');
(async () => {
  const lang = process.argv[2] || 'en';
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1600, height: 900 }, recordVideo: { dir: 'out/raw-' + lang, size: { width: 1600, height: 900 } } });
  const p = await ctx.newPage();
  const t0 = Date.now();
  await p.goto('file://' + __dirname + '/scene.html?lang=' + lang);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(800);
  const start = (Date.now() - t0) / 1000;
  await p.evaluate(() => play());
  await p.waitForFunction(() => window.finished, null, { timeout: 30000 });
  await p.waitForTimeout(300);
  await ctx.close(); await b.close();
  console.log(start);
})();
