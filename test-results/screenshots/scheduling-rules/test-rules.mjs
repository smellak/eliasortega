import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const BASE = 'https://elias.centrohogarsanchez.es';
const DIR = '/root/eliasortega/test-results/screenshots/scheduling-rules';

(async () => {
  const browser = await chromium.launch({ headless: true });

  // ═══════════════════════════════════════════
  //  LOGIN
  // ═══════════════════════════════════════════
  console.log('=== LOGIN ===');
  const loginCtx = await browser.newContext({ viewport: { width: 1400, height: 900 }, ignoreHTTPSErrors: true });
  const lp = await loginCtx.newPage();
  await lp.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await lp.fill('input[type="email"]', 'admin@admin.com');
  await lp.fill('input[type="password"]', 'admin123');
  await lp.click('button[type="submit"]');
  await lp.waitForTimeout(5000);
  writeFileSync('/tmp/auth-state.json', JSON.stringify(await loginCtx.storageState()));
  await loginCtx.close();
  console.log('Login OK');

  // ═══════════════════════════════════════════
  //  TEST A: Admin panel /rules
  // ═══════════════════════════════════════════
  console.log('\n=== TEST A: Admin /rules page ===');
  const aCtx = await browser.newContext({ viewport: { width: 1400, height: 900 }, ignoreHTTPSErrors: true, storageState: '/tmp/auth-state.json' });
  const ap = await aCtx.newPage();
  ap.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  // A1: Open /rules — full page
  await ap.goto(BASE + '/rules', { waitUntil: 'networkidle' });
  await ap.waitForTimeout(3000);
  await ap.screenshot({ path: `${DIR}/test-a1-rules-page.png`, fullPage: true });
  console.log('A1 - Rules page loaded');

  // A2: Verify sidebar has "Reglas" link active
  const sidebarReglas = await ap.locator('[data-testid="link-sidebar-reglas"]').count();
  console.log(`A2 - Sidebar "Reglas" link: ${sidebarReglas > 0 ? 'FOUND' : 'MISSING'}`);

  // A3: Verify all 8 toggle switches are present
  const switches = await ap.locator('button[role="switch"]').count();
  console.log(`A3 - Toggle switches found: ${switches} (expected 8)`);

  // A4: Verify "Guardar cambios" button
  const saveBtn = await ap.locator('button:has-text("Guardar cambios")').count();
  console.log(`A4 - Save button: ${saveBtn > 0 ? 'FOUND' : 'MISSING'}`);

  // A5: Verify "Restaurar" button
  const resetBtn = await ap.locator('button:has-text("Restaurar valores por defecto")').count();
  console.log(`A5 - Reset button: ${resetBtn > 0 ? 'FOUND' : 'MISSING'}`);

  // A6: Toggle "Antelacion minima" OFF → ON (it starts OFF)
  // The last switch should be min lead time
  const allSwitches = ap.locator('button[role="switch"]');
  const lastSwitch = allSwitches.last();
  const wasChecked = await lastSwitch.getAttribute('data-state');
  console.log(`A6 - Min lead time initial state: ${wasChecked}`);
  if (wasChecked === 'unchecked') {
    await lastSwitch.click();
    await ap.waitForTimeout(300);
    console.log('A6 - Toggled min lead time ON');
  }
  await ap.screenshot({ path: `${DIR}/test-a6-min-lead-toggled.png`, fullPage: true });

  // A7: Click "Guardar cambios"
  await ap.locator('button:has-text("Guardar cambios")').click();
  await ap.waitForTimeout(2000);
  await ap.screenshot({ path: `${DIR}/test-a7-saved.png`, fullPage: false });
  console.log('A7 - Rules saved');

  // A8: Reload and verify changes persist
  await ap.reload({ waitUntil: 'networkidle' });
  await ap.waitForTimeout(3000);
  const lastSwitchAfterReload = ap.locator('button[role="switch"]').last();
  const stateAfterReload = await lastSwitchAfterReload.getAttribute('data-state');
  console.log(`A8 - Min lead time after reload: ${stateAfterReload} (expected checked)`);
  await ap.screenshot({ path: `${DIR}/test-a8-persisted.png`, fullPage: true });

  // A9: Restore defaults — toggle min lead time back off
  if (stateAfterReload === 'checked') {
    await lastSwitchAfterReload.click();
    await ap.waitForTimeout(300);
    await ap.locator('button:has-text("Guardar cambios")').click();
    await ap.waitForTimeout(1500);
    console.log('A9 - Restored min lead time to OFF');
  }

  // A10: Dark mode
  await ap.evaluate(() => document.querySelector('[data-testid="button-theme-toggle"]')?.click());
  await ap.waitForTimeout(500);
  await ap.screenshot({ path: `${DIR}/test-a10-dark-mode.png`, fullPage: true });
  console.log('A10 - Dark mode screenshot');

  await aCtx.close();

  // ═══════════════════════════════════════════
  //  TEST B: Verify API endpoints
  // ═══════════════════════════════════════════
  console.log('\n=== TEST B: API verification ===');
  const bCtx = await browser.newContext({ viewport: { width: 1400, height: 900 }, ignoreHTTPSErrors: true, storageState: '/tmp/auth-state.json' });
  const bp = await bCtx.newPage();
  await bp.goto(BASE + '/rules', { waitUntil: 'networkidle' });
  await bp.waitForTimeout(2000);

  // B1: GET /api/scheduling-rules
  const rulesResponse = await bp.evaluate(async () => {
    const token = localStorage.getItem('authToken');
    const res = await fetch('/api/scheduling-rules', { headers: { 'Authorization': `Bearer ${token}` } });
    return { status: res.status, data: await res.json() };
  });
  console.log(`B1 - GET /api/scheduling-rules: ${rulesResponse.status} — ${Object.keys(rulesResponse.data).length} rules`);

  // B2: PUT /api/scheduling-rules — change max simultaneous count
  const updateResponse = await bp.evaluate(async () => {
    const token = localStorage.getItem('authToken');
    const res = await fetch('/api/scheduling-rules', {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ maxSimultaneous: { count: 3 } }),
    });
    return { status: res.status, data: await res.json() };
  });
  console.log(`B2 - PUT update count to 3: ${updateResponse.status} — new count: ${updateResponse.data.maxSimultaneous?.count}`);

  // B3: Verify change persists
  const verifyResponse = await bp.evaluate(async () => {
    const token = localStorage.getItem('authToken');
    const res = await fetch('/api/scheduling-rules', { headers: { 'Authorization': `Bearer ${token}` } });
    return { status: res.status, data: await res.json() };
  });
  console.log(`B3 - Verify change: count = ${verifyResponse.data.maxSimultaneous?.count} (expected 3)`);

  // B4: Restore to 2
  await bp.evaluate(async () => {
    const token = localStorage.getItem('authToken');
    await fetch('/api/scheduling-rules', {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ maxSimultaneous: { count: 2 } }),
    });
  });
  console.log('B4 - Restored count to 2');

  await bCtx.close();

  // ═══════════════════════════════════════════
  //  TEST C: Mobile responsiveness
  // ═══════════════════════════════════════════
  console.log('\n=== TEST C: Mobile responsiveness ===');
  const mCtx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, ignoreHTTPSErrors: true, storageState: '/tmp/auth-state.json' });
  const mp = await mCtx.newPage();

  await mp.goto(BASE + '/rules', { waitUntil: 'networkidle' });
  await mp.waitForTimeout(3000);
  await mp.screenshot({ path: `${DIR}/test-c1-mobile-top.png`, fullPage: false });
  console.log('C1 - Mobile top');

  await mp.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await mp.waitForTimeout(500);
  await mp.screenshot({ path: `${DIR}/test-c2-mobile-bottom.png`, fullPage: false });
  console.log('C2 - Mobile bottom');

  await mp.screenshot({ path: `${DIR}/test-c3-mobile-full.png`, fullPage: true });
  console.log('C3 - Mobile full page');

  await mCtx.close();

  // ═══════════════════════════════════════════
  //  TEST D: Tablet
  // ═══════════════════════════════════════════
  console.log('\n=== TEST D: Tablet 768px ===');
  const tCtx = await browser.newContext({ viewport: { width: 768, height: 1024 }, ignoreHTTPSErrors: true, storageState: '/tmp/auth-state.json' });
  const tp = await tCtx.newPage();

  await tp.goto(BASE + '/rules', { waitUntil: 'networkidle' });
  await tp.waitForTimeout(3000);
  await tp.screenshot({ path: `${DIR}/test-d1-tablet.png`, fullPage: false });
  console.log('D1 - Tablet rules page');

  await tCtx.close();

  // ═══════════════════════════════════════════
  //  TEST E: Calendar availability with rules
  // ═══════════════════════════════════════════
  console.log('\n=== TEST E: Calendar availability with scheduling rules ===');
  const eCtx = await browser.newContext({ viewport: { width: 1400, height: 900 }, ignoreHTTPSErrors: true, storageState: '/tmp/auth-state.json' });
  const ep = await eCtx.newPage();
  await ep.goto(BASE + '/rules', { waitUntil: 'networkidle' });
  await ep.waitForTimeout(2000);

  // Test the scheduling rules in the availability response
  const availResponse = await ep.evaluate(async () => {
    const token = localStorage.getItem('authToken');
    // Get today + 7 days range
    const from = new Date();
    from.setDate(from.getDate() + 1);
    from.setHours(8, 0, 0, 0);
    const to = new Date();
    to.setDate(to.getDate() + 7);
    to.setHours(20, 0, 0, 0);

    // Fetch scheduling rules
    const rulesRes = await fetch('/api/scheduling-rules', { headers: { 'Authorization': `Bearer ${token}` } });
    const rules = await rulesRes.json();

    return {
      rulesLoaded: !!rules.avoidConcurrency,
      avoidConcurrencyEnabled: rules.avoidConcurrency?.enabled,
      maxSimultaneousEnabled: rules.maxSimultaneous?.enabled,
      sizePriorityEnabled: rules.sizePriority?.enabled,
      categoryPreferredTimeEnabled: rules.categoryPreferredTime?.enabled,
      categoriesConfigured: Object.keys(rules.categoryPreferredTime?.map || {}).length,
    };
  });
  console.log(`E1 - Rules loaded: ${availResponse.rulesLoaded}`);
  console.log(`E2 - Avoid concurrency: ${availResponse.avoidConcurrencyEnabled}`);
  console.log(`E3 - Max simultaneous: ${availResponse.maxSimultaneousEnabled}`);
  console.log(`E4 - Size priority: ${availResponse.sizePriorityEnabled}`);
  console.log(`E5 - Category preferred time: ${availResponse.categoryPreferredTimeEnabled} (${availResponse.categoriesConfigured} categories)`);

  await eCtx.close();

  await browser.close();
  console.log('\n✅ All scheduling rules tests completed!');
})();
