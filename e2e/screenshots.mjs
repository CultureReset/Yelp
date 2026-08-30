import { chromium } from 'playwright';

const BASE = 'http://localhost:3100';
const PAGES = [
  ['home', '/dashboard'],
  ['inbox', '/dashboard/inbox'],
  ['reviews', '/dashboard/reviews'],
  ['photos', '/dashboard/photos'],
  ['business', '/dashboard/business'],
  ['menu', '/dashboard/menu'],
  ['programs', '/dashboard/programs'],
  ['analytics', '/dashboard/analytics'],
  ['billing', '/dashboard/billing'],
  ['settings', '/dashboard/settings'],
];

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const errors = [];

async function run(label, viewport, isMobile) {
  const c = await b.newContext({ viewport, isMobile, deviceScaleFactor: 1 });
  const p = await c.newPage();
  p.on('pageerror', e => errors.push(`${label}: ${e.message}`));
  p.on('response', r => { if (r.status() >= 500) errors.push(`${label} ${r.url()} -> ${r.status()}`); });

  await p.goto(`${BASE}/login`);
  await p.fill('#email', 'owner@rosastaqueria.com');
  await p.fill('#password', 'CorrectHorseBattery1');
  await Promise.all([p.waitForURL('**/dashboard'), p.click('button[type=submit]')]);

  for (const [name, path] of PAGES) {
    await p.goto(BASE + path, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(600);
    await p.screenshot({ path: `/tmp/shots/${label}-${name}.png`, fullPage: true });
  }

  // Deepest route: one conversation thread.
  await p.goto(`${BASE}/dashboard/inbox`, { waitUntil: 'domcontentloaded' });
  const first = p.locator('a[href^="/dashboard/inbox/"]').first();
  if (await first.count()) {
    await first.click();
    await p.waitForTimeout(900);
    await p.screenshot({ path: `/tmp/shots/${label}-thread.png`, fullPage: true });
  }
  await c.close();
  console.log(label, 'captured', PAGES.length + 1, 'screens');
}

await run('d', { width: 1280, height: 900 }, false);
await run('m', { width: 390, height: 844 }, true);

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'No page errors, no 5xx responses.');
await b.close();
