/*
 * Smoke test: opens the game in a headless browser, creates a world and checks the main systems work.
 *   npm install && npx playwright install chromium
 *   npm test                      (set CHROME_PATH to use an installed Chrome instead)
 * Screenshots are saved in test-output/.
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'test-output');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {
    // the multiplayer library comes from a CDN; being offline is fine for these tests
    if (m.type() === 'error' && !/peerjs|ERR_|Failed to load resource/i.test(m.text())) errors.push(m.text());
  });

  await page.goto('file://' + path.join(ROOT, 'index.html'));
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    go('play');
    worldForm();
    document.querySelector('#wsd').value = '12345';
    document.querySelector('#wgm').value = 'survival';
    document.querySelector('#wgo').click();
  });
  await page.waitForTimeout(6000);
  await page.screenshot({ path: path.join(OUT, 'world.png') });

  const r = await page.evaluate(async () => {
    const wait = ms => new Promise(res => setTimeout(res, ms));
    const out = {};
    let meshes = 0;
    W.chunks.forEach(c => c.m && meshes++);
    out.chunks = W.chunks.size;
    out.meshes = meshes;
    const x0 = P.x, z0 = P.z;
    locked = true;
    keys[S.keys.fwd] = 1;
    await wait(800);
    delete keys[S.keys.fwd];
    out.walked = Math.hypot(P.x - x0, P.z - z0);
    const hp = P.hp;
    hurtPlayer(3);
    out.damage = hp - P.hp;
    const log = [];
    for (const c of ['give diamond 3', 'summon pig 2', 'time set noon', 'structure house', 'locate house'])
      runCmd(c, m => log.push(m), m => log.push('ERR ' + m));
    out.commandErrors = log.filter(m => m.startsWith('ERR'));
    out.diamonds = countOf(103);
    const x = Math.floor(P.x), y = Math.floor(P.y) + 5, z = Math.floor(P.z);
    edit(x, y, z, 3);
    out.placed = gb(x, y, z) === 3;
    edit(x + 3, y, z, 5);
    await wait(1500);
    out.waterFlows = WT(gb(x + 3, y - 1, z));
    openInv(); out.inventory = invOn(); closeInv();
    openMap(); await wait(100); out.map = mapOn(); closeMap();
    VIEW = 1; await wait(300); out.thirdPerson = ME.g.visible && ME.g.parent === scene; VIEW = 0;
    save();
    out.saved = wl().length > 0;
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  await page.screenshot({ path: path.join(OUT, 'after.png') });
  await browser.close();

  const failed = [];
  if (r.chunks < 20 || r.meshes < 10) failed.push('world did not load');
  if (r.walked < 0.5) failed.push('player did not move');
  if (r.damage !== 3) failed.push('damage not applied');
  if (r.commandErrors.length) failed.push('commands: ' + r.commandErrors.join('; '));
  if (r.diamonds !== 3) failed.push('/give failed');
  if (!r.placed) failed.push('block edit failed');
  if (!r.waterFlows) failed.push('water did not flow');
  if (!r.inventory || !r.map) failed.push('screens did not open');
  if (!r.thirdPerson) failed.push('player model missing in third person');
  if (!r.saved) failed.push('world not saved');
  if (errors.length) failed.push('page errors: ' + errors.join(' | '));
  if (failed.length) {
    console.error('FAILED:\n  ' + failed.join('\n  '));
    process.exit(1);
  }
  console.log('All checks passed.');
})();
