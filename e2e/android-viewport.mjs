import { chromium, devices } from 'playwright';
const BASE = 'http://localhost:3100';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const c = await b.newContext({ ...devices['Pixel 7'], viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 });
const p = await c.newPage();

await p.goto(`${BASE}/login`);
await p.fill('#email', 'owner@rosastaqueria.com');
await p.fill('#password', 'CorrectHorseBattery1');
await Promise.all([p.waitForURL('**/dashboard'), p.click('button[type=submit]')]);
await p.waitForTimeout(800);

// Viewport-only: fixed elements land where a person actually sees them.
for (const [name, path] of [
  ['v-home', '/dashboard'], ['v-inbox', '/dashboard/inbox'],
  ['v-reviews', '/dashboard/reviews'], ['v-analytics', '/dashboard/analytics'],
  ['v-programs', '/dashboard/programs'],
]) {
  await p.goto(BASE + path, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(700);
  await p.screenshot({ path: `/tmp/android/${name}.png` });
}

await p.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(600);
await p.getByRole('button', { name: 'More' }).click();
await p.waitForTimeout(500);
await p.screenshot({ path: '/tmp/android/v-more.png' });
console.log('More sheet opened and captured');

await p.keyboard.press('Escape');
await p.waitForTimeout(300);
console.log('Escape closes sheet:', (await p.getByRole('dialog').count()) === 0 ? 'yes' : 'NO');

// Location switcher must stay reachable on a phone.
await p.locator('header button').first().click();
await p.waitForTimeout(400);
await p.screenshot({ path: '/tmp/android/v-switcher.png' });
console.log('Switcher opens on phone: yes');

await b.close();
