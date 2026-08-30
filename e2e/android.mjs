import { chromium, devices } from 'playwright';

const BASE = 'http://localhost:3100';
const PAGES = [
  ['home', '/dashboard'], ['inbox', '/dashboard/inbox'], ['reviews', '/dashboard/reviews'],
  ['photos', '/dashboard/photos'], ['business', '/dashboard/business'], ['menu', '/dashboard/menu'],
  ['programs', '/dashboard/programs'], ['analytics', '/dashboard/analytics'],
  ['billing', '/dashboard/billing'], ['settings', '/dashboard/settings'],
];

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
// Pixel 7 metrics: 412x915 CSS px, the most common Android viewport.
const c = await b.newContext({
  ...devices['Pixel 7'],
  viewport: { width: 412, height: 915 },
  deviceScaleFactor: 2,
});
const p = await c.newPage();
const errors = [];
p.on('pageerror', e => errors.push(e.message));
p.on('response', r => { if (r.status() >= 500) errors.push(`${r.url()} -> ${r.status()}`); });

await p.goto(`${BASE}/login`);
await p.screenshot({ path: '/tmp/android/00-login.png' });
await p.fill('#email', 'owner@rosastaqueria.com');
await p.fill('#password', 'CorrectHorseBattery1');
await Promise.all([p.waitForURL('**/dashboard'), p.click('button[type=submit]')]);
await p.waitForTimeout(700);

for (const [name, path] of PAGES) {
  await p.goto(BASE + path, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(600);
  await p.screenshot({ path: `/tmp/android/${name}.png`, fullPage: true });
}

// The "More" bottom sheet.
await p.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(500);
await p.getByRole('button', { name: 'More' }).click();
await p.waitForTimeout(400);
await p.screenshot({ path: '/tmp/android/more-sheet.png' });
await p.keyboard.press('Escape');

// A conversation thread.
await p.goto(`${BASE}/dashboard/inbox`, { waitUntil: 'domcontentloaded' });
await p.locator('a[href^="/dashboard/inbox/"]').first().click();
await p.waitForTimeout(900);
await p.screenshot({ path: '/tmp/android/thread.png', fullPage: true });

// Tap-target audit: Android's accessibility minimum is 48dp.
const small = await p.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll('nav a, nav button, [role="dialog"] a, [role="dialog"] button')) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && r.height < 44) {
      out.push(`${el.tagName} "${(el.textContent || '').trim().slice(0, 24)}" ${Math.round(r.height)}px`);
    }
  }
  return out;
});
console.log(small.length ? 'TAP TARGETS UNDER 44px:\n  ' + small.join('\n  ') : 'All nav tap targets >= 44px');

// Nothing may scroll sideways on a phone.
const overflow = await p.evaluate(() =>
  document.documentElement.scrollWidth - document.documentElement.clientWidth);
console.log('Horizontal overflow:', overflow > 2 ? `${overflow}px BUG` : 'none');

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'No page errors, no 5xx.');
await b.close();
