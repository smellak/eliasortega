import { chromium } from 'playwright';
const BASE = 'https://elias.centrohogarsanchez.es';
const DIR = '/root/eliasortega/test-results/screenshots/chat-v4-visual-audit';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const issues = [];

  // ═══════════════════════════════════════════
  //  1. DESKTOP 1400x900 — Light mode full audit
  // ═══════════════════════════════════════════
  console.log('=== DESKTOP LIGHT 1400x900 ===');
  const dCtx = await browser.newContext({ viewport: { width: 1400, height: 900 }, ignoreHTTPSErrors: true });
  const dp = await dCtx.newPage();
  const errors = [];
  dp.on('pageerror', e => errors.push('PAGE: ' + e.message));
  dp.on('console', msg => { if (msg.type() === 'error') errors.push('CONSOLE: ' + msg.text()); });

  await dp.goto(BASE + '/chat', { waitUntil: 'networkidle' });
  await dp.waitForTimeout(3000);

  // A1: Full welcome state
  await dp.screenshot({ path: `${DIR}/a01-desktop-welcome.png`, fullPage: false });
  console.log('A01 - Desktop welcome');

  // A2: Left panel close-up
  await dp.screenshot({ path: `${DIR}/a02-left-panel.png`, clip: { x: 0, y: 0, width: 420, height: 900 } });
  console.log('A02 - Left panel close-up');

  // A3: Chat area close-up
  await dp.screenshot({ path: `${DIR}/a03-chat-area.png`, clip: { x: 420, y: 0, width: 980, height: 900 } });
  console.log('A03 - Chat area close-up');

  // Check visual elements
  const checks = {};

  // Logo visibility
  checks.logoDesktop = await dp.locator('[data-testid="img-logo-desktop"]').isVisible();
  console.log(`  Logo visible: ${checks.logoDesktop}`);

  // Video
  checks.videoDesktop = await dp.locator('[data-testid="video-tutorial"]').isVisible();
  console.log(`  Video visible: ${checks.videoDesktop}`);

  // "En línea" badge in left panel
  const badgeText = await dp.locator('.bg-white\\/15').first().textContent();
  console.log(`  Badge text: "${badgeText?.trim()}"`);

  // Info bullets count
  const bullets = await dp.locator('.bg-white\\/15.backdrop-blur-sm').count();
  console.log(`  Info bullet icons: ${bullets}`);

  // Contact info
  const emailLink = await dp.locator('a[href*="recepcion@"]').count();
  const phoneLink = await dp.locator('a[href^="tel:"]').count();
  const mapsLink = await dp.locator('a[href*="maps.google"]').count();
  const webLink = await dp.locator('a[href*="centrohogarsanchez.es"]').count();
  console.log(`  Email link: ${emailLink}, Phone link: ${phoneLink}, Maps: ${mapsLink}, Web: ${webLink}`);
  if (phoneLink > 0) issues.push('Phone link still present (should be removed)');
  if (emailLink === 0) issues.push('Email recepcion@ link missing');

  // Suggestion buttons
  const suggestions = await dp.locator('[data-testid^="button-suggestion"]').count();
  console.log(`  Suggestions: ${suggestions}`);

  // Welcome card background check
  const welcomeCardBg = await dp.evaluate(() => {
    const card = document.querySelector('.from-blue-50');
    return card ? getComputedStyle(card).backgroundImage : 'NOT FOUND';
  });
  console.log(`  Welcome card gradient: ${welcomeCardBg !== 'NOT FOUND' ? 'OK' : 'MISSING'}`);

  // Avatar glow
  const glowEl = await dp.locator('.blur-xl').count();
  console.log(`  Avatar glow effect: ${glowEl > 0}`);

  // Input area
  checks.inputVisible = await dp.locator('[data-testid="input-message"]').isVisible();
  checks.sendVisible = await dp.locator('[data-testid="button-send"]').isVisible();
  console.log(`  Input: ${checks.inputVisible}, Send: ${checks.sendVisible}`);

  // Sound toggle
  checks.soundToggle = await dp.locator('[data-testid="button-sound-toggle-desktop"]').isVisible();
  console.log(`  Sound toggle: ${checks.soundToggle}`);

  // Theme toggle
  checks.themeToggle = await dp.locator('[data-testid="button-theme-toggle"]').isVisible();
  console.log(`  Theme toggle: ${checks.themeToggle}`);

  // Disclaimer & privacy
  const disclaimerText = await dp.locator('text=Asistente de IA').count();
  const privacyLink = await dp.locator('a[href*="privacidad"]').count();
  console.log(`  AI disclaimer: ${disclaimerText > 0}, Privacy link: ${privacyLink > 0}`);

  // A4: Click first suggestion
  await dp.locator('[data-testid^="button-suggestion"]').first().click();
  await dp.waitForTimeout(10000);
  await dp.screenshot({ path: `${DIR}/a04-conversation.png`, fullPage: false });
  console.log('A04 - After suggestion click');

  // Check conversation elements
  const userMsgs = await dp.locator('[data-testid^="message-user"]').count();
  const assistantMsgs = await dp.locator('[data-testid^="message-assistant"]').count();
  console.log(`  User msgs: ${userMsgs}, Assistant msgs: ${assistantMsgs}`);

  // A5: Check stepper
  const stepper = await dp.locator('[data-testid="progress-stepper"]').isVisible();
  console.log(`  Progress stepper: ${stepper}`);
  if (stepper) {
    await dp.screenshot({ path: `${DIR}/a05-stepper.png`, clip: { x: 420, y: 55, width: 980, height: 50 } });
    console.log('A05 - Stepper close-up');
  }

  // A6: Check message bubble alignment & styling
  await dp.screenshot({ path: `${DIR}/a06-bubbles.png`, clip: { x: 420, y: 100, width: 980, height: 500 } });
  console.log('A06 - Bubbles close-up');

  // A7: Hover for actions
  const lastAssistant = dp.locator('[data-testid^="message-assistant"]').last();
  await lastAssistant.hover();
  await dp.waitForTimeout(500);
  await dp.screenshot({ path: `${DIR}/a07-hover-actions.png`, fullPage: false });
  console.log('A07 - Hover actions');

  const copyBtn = await dp.locator('[data-testid="button-copy-message"]').count();
  const feedbackUp = await dp.locator('[data-testid="button-feedback-up"]').count();
  const feedbackDown = await dp.locator('[data-testid="button-feedback-down"]').count();
  console.log(`  Copy: ${copyBtn}, FeedbackUp: ${feedbackUp}, FeedbackDown: ${feedbackDown}`);
  if (copyBtn === 0) issues.push('Copy button missing');
  if (feedbackUp === 0) issues.push('Feedback up button missing');

  // Checkmarks on user messages
  const checkmarks = await dp.locator('.lucide-check-check, [data-testid^="message-user"] .text-blue-500').count();
  console.log(`  Delivered checkmarks: ${checkmarks}`);

  // New conversation button
  const newConvBtn = await dp.locator('[data-testid="button-new-conversation-desktop"]').isVisible();
  console.log(`  New conversation button: ${newConvBtn}`);

  // A8: Send second message
  const textarea = dp.locator('[data-testid="input-message"]');
  await textarea.fill('¿Cuáles son los horarios de descarga?');
  const sendBtn = dp.locator('[data-testid="button-send"]');
  await sendBtn.click();
  await dp.waitForTimeout(500);

  // A9: Check stop button
  const stopBtn = await dp.locator('[data-testid="button-stop-streaming"]').count();
  console.log(`  Stop button during streaming: ${stopBtn > 0}`);
  if (stopBtn > 0) {
    await dp.screenshot({ path: `${DIR}/a09-stop-button.png`, fullPage: false });
    console.log('A09 - Stop button');
  }

  await dp.waitForTimeout(10000);
  await dp.screenshot({ path: `${DIR}/a10-multi-messages.png`, fullPage: false });
  console.log('A10 - Multiple messages');

  // A11: Character counter
  await textarea.fill('a'.repeat(850));
  await dp.waitForTimeout(300);
  await dp.screenshot({ path: `${DIR}/a11-char-counter.png`, clip: { x: 420, y: 780, width: 980, height: 120 } });
  console.log('A11 - Character counter');
  const charCounter = await dp.locator('text=850/1000').count();
  console.log(`  Char counter visible: ${charCounter > 0}`);

  // A12: Full page scrolled
  await dp.screenshot({ path: `${DIR}/a12-full-page.png`, fullPage: true });
  console.log('A12 - Full page');

  // ═══════════════════════════════════════════
  //  2. DESKTOP DARK MODE
  // ═══════════════════════════════════════════
  console.log('\n=== DESKTOP DARK ===');
  const themeToggle = dp.locator('[data-testid="button-theme-toggle"]');
  await themeToggle.click({ timeout: 3000 });
  await dp.waitForTimeout(500);
  await dp.screenshot({ path: `${DIR}/b01-dark-conversation.png`, fullPage: false });
  console.log('B01 - Dark conversation');
  await dp.screenshot({ path: `${DIR}/b02-dark-left-panel.png`, clip: { x: 0, y: 0, width: 420, height: 900 } });
  console.log('B02 - Dark left panel');
  await dp.screenshot({ path: `${DIR}/b03-dark-full.png`, fullPage: true });
  console.log('B03 - Dark full page');

  // Check dark mode consistency
  const darkBg = await dp.evaluate(() => {
    return getComputedStyle(document.querySelector('[data-testid="chat-messages"]')?.parentElement || document.body).backgroundColor;
  });
  console.log(`  Chat panel bg in dark: ${darkBg}`);

  await dCtx.close();

  // ═══════════════════════════════════════════
  //  3. MOBILE 375x812
  // ═══════════════════════════════════════════
  console.log('\n=== MOBILE 375x812 ===');
  const mCtx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, ignoreHTTPSErrors: true });
  const mp = await mCtx.newPage();
  await mp.goto(BASE + '/chat', { waitUntil: 'networkidle' });
  await mp.waitForTimeout(3000);

  // C1: Mobile header close-up
  await mp.screenshot({ path: `${DIR}/c01-mobile-header.png`, clip: { x: 0, y: 0, width: 375, height: 56 } });
  console.log('C01 - Mobile header');

  // C2: Full welcome
  await mp.screenshot({ path: `${DIR}/c02-mobile-welcome.png`, fullPage: false });
  console.log('C02 - Mobile welcome');

  // Check mobile elements
  const mLogo = await mp.locator('[data-testid="img-logo"]').isVisible();
  const mVideo = await mp.locator('[data-testid="video-tutorial-mobile"]').isVisible();
  const mBadge = await mp.locator('text=En línea').first().isVisible();
  const mSoundBtn = await mp.locator('[data-testid="button-sound-toggle"]').isVisible();
  const mThemeBtn = await mp.locator('[data-testid="button-theme-toggle-mobile"]').isVisible();
  console.log(`  Logo: ${mLogo}, Video: ${mVideo}, Badge: ${mBadge}, Sound: ${mSoundBtn}, Theme: ${mThemeBtn}`);

  // Check left panel is hidden on mobile
  const leftPanel = await mp.locator('[data-testid="img-logo-desktop"]').isVisible();
  console.log(`  Desktop left panel hidden: ${!leftPanel}`);
  if (leftPanel) issues.push('Desktop left panel visible on mobile');

  // C3: Full page
  await mp.screenshot({ path: `${DIR}/c03-mobile-full.png`, fullPage: true });
  console.log('C03 - Mobile full');

  // C4: Click suggestion
  await mp.locator('[data-testid^="button-suggestion"]').first().click();
  await mp.waitForTimeout(10000);
  await mp.screenshot({ path: `${DIR}/c04-mobile-conversation.png`, fullPage: false });
  console.log('C04 - Mobile conversation');

  // C5: New conversation button on mobile
  const mNewConv = await mp.locator('[data-testid="button-new-conversation"]').isVisible();
  console.log(`  Mobile new conversation: ${mNewConv}`);

  // C6: Mobile dark
  const mTheme = mp.locator('[data-testid="button-theme-toggle-mobile"]');
  await mTheme.click({ timeout: 3000 });
  await mp.waitForTimeout(500);
  await mp.screenshot({ path: `${DIR}/c06-mobile-dark.png`, fullPage: false });
  console.log('C06 - Mobile dark');
  await mp.screenshot({ path: `${DIR}/c07-mobile-dark-full.png`, fullPage: true });
  console.log('C07 - Mobile dark full');

  await mCtx.close();

  // ═══════════════════════════════════════════
  //  4. TABLET 768x1024
  // ═══════════════════════════════════════════
  console.log('\n=== TABLET 768x1024 ===');
  const tCtx = await browser.newContext({ viewport: { width: 768, height: 1024 }, ignoreHTTPSErrors: true });
  const tp = await tCtx.newPage();
  await tp.goto(BASE + '/chat', { waitUntil: 'networkidle' });
  await tp.waitForTimeout(3000);
  await tp.screenshot({ path: `${DIR}/d01-tablet.png`, fullPage: false });
  console.log('D01 - Tablet');
  await tp.screenshot({ path: `${DIR}/d02-tablet-full.png`, fullPage: true });
  console.log('D02 - Tablet full');

  // Check if tablet shows left panel or mobile layout
  const tLeftPanel = await tp.locator('[data-testid="img-logo-desktop"]').isVisible();
  const tMobileHeader = await tp.locator('[data-testid="header-mobile"]').isVisible();
  console.log(`  Tablet: left panel=${tLeftPanel}, mobile header=${tMobileHeader}`);

  await tCtx.close();

  // ═══════════════════════════════════════════
  //  5. WIDE 1920x1080
  // ═══════════════════════════════════════════
  console.log('\n=== WIDE 1920x1080 ===');
  const wCtx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, ignoreHTTPSErrors: true });
  const wp = await wCtx.newPage();
  await wp.goto(BASE + '/chat', { waitUntil: 'networkidle' });
  await wp.waitForTimeout(3000);
  await wp.screenshot({ path: `${DIR}/e01-wide.png`, fullPage: false });
  console.log('E01 - Wide');

  // Check proportions on wide screen
  const wLeftPanelWidth = await wp.evaluate(() => {
    const el = document.querySelector('[data-testid="img-logo-desktop"]')?.closest('.lg\\:flex');
    return el ? el.getBoundingClientRect().width : 0;
  });
  console.log(`  Wide: left panel width = ${wLeftPanelWidth}px`);

  await wCtx.close();

  // ═══════════════════════════════════════════
  //  6. LANDSCAPE 812x375
  // ═══════════════════════════════════════════
  console.log('\n=== LANDSCAPE 812x375 ===');
  const lCtx = await browser.newContext({ viewport: { width: 812, height: 375 }, isMobile: true, ignoreHTTPSErrors: true });
  const lp = await lCtx.newPage();
  await lp.goto(BASE + '/chat', { waitUntil: 'networkidle' });
  await lp.waitForTimeout(3000);
  await lp.screenshot({ path: `${DIR}/f01-landscape.png`, fullPage: false });
  console.log('F01 - Landscape');
  await lp.screenshot({ path: `${DIR}/f02-landscape-full.png`, fullPage: true });
  console.log('F02 - Landscape full');

  // Check if input is accessible in landscape
  const lInput = await lp.locator('[data-testid="input-message"]').isVisible();
  console.log(`  Landscape input visible: ${lInput}`);
  if (!lInput) issues.push('Input not visible in landscape mode');

  await lCtx.close();

  // ═══════════════════════════════════════════
  //  7. SMALL MOBILE 320x568
  // ═══════════════════════════════════════════
  console.log('\n=== SMALL 320x568 ===');
  const sCtx = await browser.newContext({ viewport: { width: 320, height: 568 }, isMobile: true, ignoreHTTPSErrors: true });
  const sp = await sCtx.newPage();
  await sp.goto(BASE + '/chat', { waitUntil: 'networkidle' });
  await sp.waitForTimeout(3000);
  await sp.screenshot({ path: `${DIR}/g01-small.png`, fullPage: false });
  console.log('G01 - Small mobile');
  await sp.screenshot({ path: `${DIR}/g02-small-full.png`, fullPage: true });
  console.log('G02 - Small full');

  // Check text overflow/truncation
  const sHeaderText = await sp.locator('[data-testid="header-mobile"] h1').textContent();
  console.log(`  Small header text: "${sHeaderText}"`);

  const sSuggestions = await sp.locator('[data-testid^="button-suggestion"]').count();
  console.log(`  Small suggestions visible: ${sSuggestions}`);

  await sCtx.close();

  // ═══════════════════════════════════════════
  //  SUMMARY
  // ═══════════════════════════════════════════
  console.log('\n═══════════════════════════════');
  console.log('  VISUAL AUDIT SUMMARY');
  console.log('═══════════════════════════════');
  console.log(`Console/page errors: ${errors.length}`);
  errors.forEach(e => console.log('  ERR:', e));
  console.log(`\nIssues found: ${issues.length}`);
  issues.forEach((issue, i) => console.log(`  ${i + 1}. ${issue}`));
  if (issues.length === 0) console.log('  No issues found!');
  console.log('\n✅ Visual audit complete');

  await browser.close();
})();
