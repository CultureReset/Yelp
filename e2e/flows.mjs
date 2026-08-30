import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await (await b.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
p.on('pageerror', e => console.log('PAGE ERROR:', e.message));

await p.goto('http://localhost:3100/login');
await p.fill('#email', 'owner@rosastaqueria.com');
await p.fill('#password', 'CorrectHorseBattery1');
await Promise.all([p.waitForURL('**/dashboard'), p.click('button[type=submit]')]);

// 1. Reply to a review, verify it persists.
await p.goto('http://localhost:3100/dashboard/reviews?filter=unreplied', { waitUntil: 'networkidle' });
await p.locator('article').first().getByRole('button', { name: 'Reply publicly' }).click();
const text = `Thanks so much for this, sharing it with the kitchen. Ref ${Date.now()}`;
await p.locator('article').first().locator('textarea').fill(text);
await p.locator('article').first().getByRole('button', { name: 'Publish reply' }).click();
await p.waitForTimeout(2500);
await p.goto('http://localhost:3100/dashboard/reviews?filter=replied', { waitUntil: 'networkidle' });
console.log('REPLY PERSISTED:', (await p.getByText(text.slice(0, 40)).count()) > 0 ? 'YES' : 'NO');
await p.screenshot({ path: '/tmp/shots/10-reply-published.png' });

// 2. Descriptive edit -> should auto-publish.
await p.goto('http://localhost:3100/dashboard/business', { waitUntil: 'networkidle' });
const basics = p.locator('section').filter({ hasText: 'Basics' }).first();
await basics.getByRole('button', { name: 'Edit' }).click();
await basics.locator('#specialties').fill('Al pastor carved to order, birria de res, and a six-option salsa bar made fresh daily.');
await basics.getByRole('button', { name: 'Save changes' }).click();
await p.waitForTimeout(2500);
console.log('DESCRIPTIVE EDIT:', (await p.getByText('Saved and live on your public page.').count()) > 0 ? 'AUTO-PUBLISHED ok' : 'did NOT auto-publish');
await p.screenshot({ path: '/tmp/shots/11-edit-autopublish.png' });

// 3. Identity edit (phone) -> must queue, NOT publish.
await p.goto('http://localhost:3100/dashboard/business', { waitUntil: 'networkidle' });
const contact = p.locator('section').filter({ hasText: 'Contact & links' }).first();
await contact.getByRole('button', { name: 'Edit' }).click();
await contact.locator('#phone').fill('(512) 555-0199');
await contact.getByRole('button', { name: 'Save changes' }).click();
await p.waitForTimeout(2500);
console.log('IDENTITY EDIT:', (await p.getByText('Submitted for review').count()) > 0 ? 'QUEUED FOR MODERATION ok' : 'NOT QUEUED - BUG');
await p.goto('http://localhost:3100/dashboard/business', { waitUntil: 'networkidle' });
await p.screenshot({ path: '/tmp/shots/12-pending-edit.png' });
await b.close();
