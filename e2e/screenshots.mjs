import { chromium } from 'playwright';

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
const out = '/tmp/shots';

p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE ERROR:', m.text()); });
p.on('pageerror', e => console.log('PAGE ERROR:', e.message));

await p.goto('http://localhost:3100/login', { waitUntil: 'networkidle' });
await p.screenshot({ path: `${out}/01-login.png` });
console.log('login rendered');

await p.fill('#email', 'owner@rosastaqueria.com');
await p.fill('#password', 'CorrectHorseBattery1');
await Promise.all([
  p.waitForURL('**/dashboard', { timeout: 20000 }),
  p.click('button[type=submit]'),
]);
await p.waitForLoadState('networkidle');
await p.screenshot({ path: `${out}/02-home.png`, fullPage: true });
console.log('LOGIN OK →', p.url());

for (const [name, path] of [
  ['03-reviews', '/dashboard/reviews'],
  ['04-reviews-unreplied', '/dashboard/reviews?filter=unreplied'],
  ['05-business', '/dashboard/business'],
  ['06-analytics', '/dashboard/analytics'],
  ['07-inbox', '/dashboard/inbox'],
]) {
  await p.goto(`http://localhost:3100${path}`, { waitUntil: 'networkidle' });
  await p.screenshot({ path: `${out}/${name}.png`, fullPage: true });
  console.log(name, 'ok');
}

// Mobile viewport — the responsive web app has to work on a phone browser.
const m = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
const mp = await m.newPage();
await mp.goto('http://localhost:3100/login', { waitUntil: 'networkidle' });
await mp.fill('#email', 'owner@rosastaqueria.com');
await mp.fill('#password', 'CorrectHorseBattery1');
await Promise.all([mp.waitForURL('**/dashboard'), mp.click('button[type=submit]')]);
await mp.waitForLoadState('networkidle');
await mp.screenshot({ path: `${out}/08-mobile-home.png`, fullPage: true });
await mp.goto('http://localhost:3100/dashboard/reviews', { waitUntil: 'networkidle' });
await mp.screenshot({ path: `${out}/09-mobile-reviews.png`, fullPage: true });
console.log('mobile ok');

await b.close();
