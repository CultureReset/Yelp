import { chromium, devices } from 'playwright';
import { execSync } from 'node:child_process';

const BASE = 'http://localhost:3100';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const c = await b.newContext({ ...devices['Pixel 7'], viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 });
const p = await c.newPage();
const errors = [];
p.on('pageerror', e => errors.push(e.message));
p.on('response', r => { if (r.status() >= 500) errors.push(`${r.url()} -> ${r.status()}`); });

await p.goto(`${BASE}/login`);
await p.fill('#email', 'owner@rosastaqueria.com');
await p.fill('#password', 'CorrectHorseBattery1');
await Promise.all([p.waitForURL('**/dashboard'), p.click('button[type=submit]')]);

// 1. Search
await p.goto(`${BASE}/claim`, { waitUntil: 'domcontentloaded' });
await p.fill('#q', 'La Fonda');
await p.click('button[type=submit]');
await p.waitForTimeout(900);
await p.screenshot({ path: '/tmp/android/claim-1-search.png', fullPage: true });
console.log('SEARCH results:', await p.locator('a[href^="/claim/"]').count());

// 2. Listing page
await p.locator('a[href^="/claim/"]').first().click();
await p.waitForTimeout(900);
await p.screenshot({ path: '/tmp/android/claim-2-listing.png', fullPage: true });

// 3. Start the claim
await p.getByRole('button', { name: 'Yes, this is my business' }).click();
await p.waitForTimeout(1400);
await p.screenshot({ path: '/tmp/android/claim-3-methods.png', fullPage: true });

// Which methods are offered, and which are blocked?
const labels = await p.locator('label').allInnerTexts();
const domainBlocked = labels.some(l => l.includes('lafondaverde.com') && l.includes('not at'));
console.log('METHODS shown:', await p.locator('input[name=method]').count());
console.log('DOMAIN method correctly blocked (owner email is not @lafondaverde.com):', domainBlocked ? 'yes' : 'NO');

// The security property that matters: the target is the LISTING's phone,
// not anything the claimant supplied.
const methodText = await p.locator('label').filter({ hasText: 'Call the business phone' }).innerText();
console.log('Verification targets the listed number:', methodText.includes('(512) 555-0177') ? 'yes' : 'NO — BUG');

// 4. Send a phone-call code
await p.locator('input[value="phone_call"]').check();
await p.getByRole('button', { name: 'Send verification' }).click();
await p.waitForTimeout(1600);
await p.screenshot({ path: '/tmp/android/claim-4-code.png', fullPage: true });

// 5. A wrong code must be rejected and must decrement the attempts.
await p.fill('#code', '000000');
await p.getByRole('button', { name: 'Verify' }).click();
await p.waitForTimeout(1400);
const wrongMsg = await p.locator('body').innerText();
console.log('WRONG code rejected:', /not correct/.test(wrongMsg) ? 'yes' : 'NO — BUG');

// 6. The real code, read from the server log the way the delivery worker would.
const log = execSync("strings /tmp/next-3100.log | grep -oE '\\[claim\\].*: [0-9]{6}$' | tail -1").toString();
const code = (log.match(/(\d{6})\s*$/) || [])[1];
console.log('Issued code:', code);
await p.fill('#code', code);
await p.getByRole('button', { name: 'Verify' }).click();
await p.waitForTimeout(2200);
await p.screenshot({ path: '/tmp/android/claim-5-done.png', fullPage: true });
const done = await p.locator('body').innerText();
console.log('CLAIM COMPLETED:', /is yours/.test(done) ? 'yes' : 'NO — BUG');

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'No page errors, no 5xx.');
await b.close();
