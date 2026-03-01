import { chromium } from 'playwright';

const BASE = 'https://elias.centrohogarsanchez.es';
const DIR = '/root/eliasortega/test-results/screenshots/chat-v2';

(async () => {
  const browser = await chromium.launch({ headless: true });

  // ═══════════════════════════════════════════
  //  DESKTOP 1400x900
  // ═══════════════════════════════════════════
  console.log('=== DESKTOP 1400x900 ===');
  const dCtx = await browser.newContext({ viewport: { width: 1400, height: 900 }, ignoreHTTPSErrors: true });
  const dp = await dCtx.newPage();

  dp.on('console', msg => { if (msg.type() === 'error') console.log('CONSOLE ERROR:', msg.text()); });
  dp.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  await dp.goto(BASE + '/chat', { waitUntil: 'networkidle' });
  await dp.waitForTimeout(3000);
  console.log('URL:', dp.url());
  console.log('Title:', await dp.title());

  // D1: Welcome card (initial state with suggestions)
  await dp.screenshot({ path: `${DIR}/d01-welcome-card.png`, fullPage: false });
  console.log('D01 - Welcome card with quick suggestions');

  // D2: Full page initial
  await dp.screenshot({ path: `${DIR}/d02-full-initial.png`, fullPage: true });
  console.log('D02 - Full page initial');

  // D3: Check new elements
  const suggestions = await dp.locator('[data-testid^="button-suggestion"]').count();
  console.log(`D03 - Quick suggestion buttons: ${suggestions}`);

  const scrollBottom = await dp.locator('[data-testid="button-scroll-bottom"]').count();
  console.log(`D04 - Scroll FAB present: ${scrollBottom > 0}`);

  const chatMessages = await dp.locator('[data-testid="chat-messages"]').count();
  console.log(`D05 - Chat messages area with role="log": ${chatMessages > 0}`);

  // Check ARIA
  const ariaRole = await dp.locator('[role="log"]').count();
  console.log(`D06 - ARIA role="log" present: ${ariaRole > 0}`);

  // Check disclaimer
  const disclaimer = await dp.locator('text=asistente de IA').count();
  console.log(`D07 - AI disclaimer present: ${disclaimer > 0}`);

  // Check contact info (desktop panel)
  const phone = await dp.locator('text=953').count();
  console.log(`D08 - Phone number visible: ${phone > 0}`);

  const mapLink = await dp.locator('text=Google Maps').count();
  console.log(`D09 - Google Maps link: ${mapLink > 0}`);

  const webLink = await dp.locator('text=Ir a la web').count();
  console.log(`D10 - Back to web link: ${webLink > 0}`);

  // D11: Click a quick suggestion
  const firstSuggestion = dp.locator('[data-testid^="button-suggestion"]').first();
  if (await firstSuggestion.count() > 0) {
    await firstSuggestion.click();
    await dp.waitForTimeout(8000);
    await dp.screenshot({ path: `${DIR}/d11-after-suggestion.png`, fullPage: false });
    console.log('D11 - After clicking quick suggestion');

    // Check new conversation button appeared
    const newConvBtn = await dp.locator('[data-testid="button-new-conversation-desktop"]').count();
    console.log(`D12 - New conversation button visible: ${newConvBtn > 0}`);

    // Check progress stepper
    await dp.screenshot({ path: `${DIR}/d13-conversation-full.png`, fullPage: true });
    console.log('D13 - Conversation full page');

    // Check read confirmations (checkmarks on user messages)
    const checkmarks = await dp.locator('svg.lucide-check-check').count();
    console.log(`D14 - Delivered checkmarks: ${checkmarks}`);

    // Check copy/feedback buttons - hover over assistant message
    const assistantMsg = dp.locator('[data-testid^="message-assistant"]').last();
    if (await assistantMsg.count() > 0) {
      await assistantMsg.hover();
      await dp.waitForTimeout(300);
      await dp.screenshot({ path: `${DIR}/d15-message-actions.png`, fullPage: false });
      console.log('D15 - Message actions (copy, feedback) on hover');
    }

    // D16: Stop button test - type and send
    const textarea = dp.locator('[data-testid="input-message"]');
    if (await textarea.count() > 0) {
      await textarea.fill('¿Qué horarios tiene el almacén?');
      await dp.waitForTimeout(300);

      // Check character counter (only shows at 80%+)
      await textarea.fill('a'.repeat(850));
      await dp.waitForTimeout(300);
      await dp.screenshot({ path: `${DIR}/d16-char-counter.png`, fullPage: false });
      console.log('D16 - Character counter visible');

      await textarea.fill('¿Qué horarios tiene el almacén?');
      const sendBtn = dp.locator('[data-testid="button-send"]');
      await sendBtn.click();
      await dp.waitForTimeout(500);

      // Check stop button
      const stopBtn = dp.locator('[data-testid="button-stop-streaming"]');
      const stopCount = await stopBtn.count();
      console.log(`D17 - Stop button during streaming: ${stopCount > 0}`);
      if (stopCount > 0) {
        await dp.screenshot({ path: `${DIR}/d17-stop-button.png`, fullPage: false });
      }
      await dp.waitForTimeout(8000);
    }
  }

  // D18: Dark mode
  const themeToggle = dp.locator('[data-testid="button-theme-toggle"]').last();
  try {
    await themeToggle.click({ timeout: 3000 });
    await dp.waitForTimeout(500);
    await dp.screenshot({ path: `${DIR}/d18-dark-mode.png`, fullPage: false });
    console.log('D18 - Dark mode');
    await dp.screenshot({ path: `${DIR}/d19-dark-full.png`, fullPage: true });
    console.log('D19 - Dark mode full');
  } catch {
    console.log('D18 - Could not toggle dark mode');
  }

  await dCtx.close();

  // ═══════════════════════════════════════════
  //  MOBILE 375x812
  // ═══════════════════════════════════════════
  console.log('\n=== MOBILE 375x812 ===');
  const mCtx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, ignoreHTTPSErrors: true });
  const mp = await mCtx.newPage();
  await mp.goto(BASE + '/chat', { waitUntil: 'networkidle' });
  await mp.waitForTimeout(3000);

  // M1: Unified header (single header now, no double)
  await mp.screenshot({ path: `${DIR}/m01-unified-header.png`, fullPage: false });
  console.log('M01 - Mobile unified header + welcome card');

  // Check unified header has all elements
  const mLogo = await mp.locator('[data-testid="img-logo"]').count();
  const mNewConv = await mp.locator('[data-testid="button-new-conversation"]').count();
  const mSound = await mp.locator('[data-testid="button-sound-toggle"]').count();
  console.log(`M02 - Unified header: logo=${mLogo > 0}, sound=${mSound > 0}`);

  // M3: Full page
  await mp.screenshot({ path: `${DIR}/m03-mobile-full.png`, fullPage: true });
  console.log('M03 - Mobile full page');

  // M4: Send message via suggestion
  const mSuggestion = mp.locator('[data-testid^="button-suggestion"]').first();
  if (await mSuggestion.count() > 0) {
    await mSuggestion.click();
    await mp.waitForTimeout(8000);
    await mp.screenshot({ path: `${DIR}/m04-mobile-conversation.png`, fullPage: false });
    console.log('M04 - Mobile conversation');

    // Check new conversation button appears
    const mNewBtn = await mp.locator('[data-testid="button-new-conversation"]').count();
    console.log(`M05 - New conversation button: ${mNewBtn > 0}`);
  }

  await mCtx.close();

  // ═══════════════════════════════════════════
  //  TABLET 768x1024
  // ═══════════════════════════════════════════
  console.log('\n=== TABLET 768x1024 ===');
  const tCtx = await browser.newContext({ viewport: { width: 768, height: 1024 }, ignoreHTTPSErrors: true });
  const tp = await tCtx.newPage();
  await tp.goto(BASE + '/chat', { waitUntil: 'networkidle' });
  await tp.waitForTimeout(3000);

  // T1: Tablet with info strip
  await tp.screenshot({ path: `${DIR}/t01-tablet-info-strip.png`, fullPage: false });
  console.log('T01 - Tablet with info strip');

  await tp.screenshot({ path: `${DIR}/t02-tablet-full.png`, fullPage: true });
  console.log('T02 - Tablet full');

  await tCtx.close();

  // ═══════════════════════════════════════════
  //  LANDSCAPE 812x375
  // ═══════════════════════════════════════════
  console.log('\n=== LANDSCAPE 812x375 ===');
  const lCtx = await browser.newContext({ viewport: { width: 812, height: 375 }, isMobile: true, ignoreHTTPSErrors: true });
  const lp = await lCtx.newPage();
  await lp.goto(BASE + '/chat', { waitUntil: 'networkidle' });
  await lp.waitForTimeout(3000);

  // L1: Landscape compact (video bar hidden)
  await lp.screenshot({ path: `${DIR}/l01-landscape-compact.png`, fullPage: false });
  console.log('L01 - Landscape compact header');

  await lCtx.close();

  // ═══════════════════════════════════════════
  //  SMALL MOBILE 320x568
  // ═══════════════════════════════════════════
  console.log('\n=== SMALL 320x568 ===');
  const sCtx = await browser.newContext({ viewport: { width: 320, height: 568 }, isMobile: true, ignoreHTTPSErrors: true });
  const sp = await sCtx.newPage();
  await sp.goto(BASE + '/chat', { waitUntil: 'networkidle' });
  await sp.waitForTimeout(3000);

  await sp.screenshot({ path: `${DIR}/s01-small-mobile.png`, fullPage: false });
  console.log('S01 - Small mobile');

  await sp.screenshot({ path: `${DIR}/s02-small-full.png`, fullPage: true });
  console.log('S02 - Small mobile full');

  await sCtx.close();

  // ═══════════════════════════════════════════
  //  WIDE 1920x1080
  // ═══════════════════════════════════════════
  console.log('\n=== WIDE 1920x1080 ===');
  const wCtx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, ignoreHTTPSErrors: true });
  const wp = await wCtx.newPage();
  await wp.goto(BASE + '/chat', { waitUntil: 'networkidle' });
  await wp.waitForTimeout(3000);

  await wp.screenshot({ path: `${DIR}/w01-wide-desktop.png`, fullPage: false });
  console.log('W01 - Wide desktop');

  await wCtx.close();

  await browser.close();
  console.log('\n✅ All chat v2 screenshots done!');
})();
