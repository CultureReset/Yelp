import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();

await p.goto('http://localhost:3100/login');
await p.fill('#email', 'front@rosastaqueria.com');
await p.fill('#password', 'CorrectHorseBattery1');
await Promise.all([p.waitForURL('**/dashboard'), p.click('button[type=submit]')]);
await p.waitForLoadState('domcontentloaded');

const nav = (await p.locator('aside nav a').allInnerTexts())
  .map(s => s.trim().split('\n')[0]);
console.log('RESPONDER NAV:', nav.join(', '));

const res = await p.goto('http://localhost:3100/dashboard/billing');
await p.waitForLoadState('domcontentloaded');
console.log('DIRECT /billing ->', res.status(), '| url:', new URL(p.url()).pathname);
console.log('PAGE SAYS:', (await p.locator('h1').first().innerText().catch(() => '(none)')));
await p.screenshot({ path: '/tmp/shots/13-responder-no-access.png' });

// Owner should still see everything.
const p2 = await (await b.newContext()).newPage();
await p2.goto('http://localhost:3100/login');
await p2.fill('#email', 'owner@rosastaqueria.com');
await p2.fill('#password', 'CorrectHorseBattery1');
await Promise.all([p2.waitForURL('**/dashboard'), p2.click('button[type=submit]')]);
await p2.waitForLoadState('domcontentloaded');
const nav2 = (await p2.locator('aside nav a').allInnerTexts()).map(s => s.trim().split('\n')[0]);
console.log('OWNER NAV:', nav2.join(', '));
await p2.goto('http://localhost:3100/dashboard/business', { waitUntil: 'domcontentloaded' });
await p2.screenshot({ path: '/tmp/shots/12-pending-edit.png', fullPage: true });
await b.close();
