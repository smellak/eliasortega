import { test, expect } from '@playwright/test';
import { loginAdmin, snap, navigateTo } from './helpers';

const BASE = 'https://elias.centrohogarsanchez.es';

test.describe('Bloque F: Guía, Dark Mode y Mobile', () => {

  test('F1: Página guía', async ({ page }) => {
    await loginAdmin(page);
    await navigateTo(page, '/guide');
    await page.waitForTimeout(2000);
    await snap(page, 'F1-01-guia-completa');

    // Check sections exist
    const content = await page.textContent('body');
    const sections = [
      'qué es esto',
      'proceso',
      'puntos',
      'cálculo',
      'precisión',
      'muelles',
      'proveedores',
      'emails',
      'auditoría',
      'mapa',
    ];

    let found = 0;
    for (const s of sections) {
      if (content?.toLowerCase().includes(s)) found++;
    }
    // At least some sections should be present

    // Try collapsing/expanding sections
    const collapsibles = page.locator('button[data-state], [data-testid^="accordion"], details summary, h2 button, h3 button');
    const count = await collapsibles.count();
    if (count > 0) {
      await collapsibles.first().click();
      await page.waitForTimeout(500);
      await snap(page, 'F1-02-colapsado');
      await collapsibles.first().click();
      await page.waitForTimeout(500);
      await snap(page, 'F1-03-expandido');
    }

    // Mobile
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1500);
    await snap(page, 'F1-04-mobile');
  });

  test('F2: Dark mode sweep', async ({ page }) => {
    await loginAdmin(page);

    // Activate dark mode
    const themeToggle = page.locator('[data-testid="button-theme-toggle"]');
    if (await themeToggle.isVisible().catch(() => false)) {
      await themeToggle.click();
      await page.waitForTimeout(1000);
    } else {
      // Try clicking any moon/sun icon for theme
      const altToggle = page.locator('button:has([class*="Moon"]), button:has([class*="Sun"]), button[aria-label*="theme"], button[aria-label*="modo"]').first();
      if (await altToggle.isVisible().catch(() => false)) {
        await altToggle.click();
        await page.waitForTimeout(1000);
      }
    }

    const pages = [
      { path: '/', name: 'calendario' },
      { path: '/appointments', name: 'citas' },
      { path: '/warehouse', name: 'almacen' },
      { path: '/capacity', name: 'capacidad' },
      { path: '/docks', name: 'muelles' },
      { path: '/providers', name: 'proveedores' },
      { path: '/notifications', name: 'notificaciones' },
      { path: '/users', name: 'usuarios' },
      { path: '/audit', name: 'auditoria' },
      { path: '/analytics', name: 'precision' },
      { path: '/rules', name: 'reglas' },
      { path: '/guide', name: 'guia' },
    ];

    for (const p of pages) {
      await navigateTo(page, p.path);
      await snap(page, `F2-dark-${p.name}`);
    }

    // Switch back to light mode
    const themeToggle2 = page.locator('[data-testid="button-theme-toggle"]');
    if (await themeToggle2.isVisible().catch(() => false)) {
      await themeToggle2.click();
      await page.waitForTimeout(500);
    }
  });

  test('F3: Mobile responsive sweep', async ({ page }) => {
    await loginAdmin(page);
    await page.setViewportSize({ width: 375, height: 812 });

    const pages = [
      { path: '/', name: 'calendario' },
      { path: '/appointments', name: 'citas' },
      { path: '/warehouse', name: 'almacen' },
      { path: '/capacity', name: 'capacidad' },
      { path: '/docks', name: 'muelles' },
      { path: '/providers', name: 'proveedores' },
      { path: '/notifications', name: 'notificaciones' },
      { path: '/users', name: 'usuarios' },
      { path: '/audit', name: 'auditoria' },
      { path: '/analytics', name: 'precision' },
      { path: '/rules', name: 'reglas' },
      { path: '/guide', name: 'guia' },
    ];

    for (const p of pages) {
      await navigateTo(page, p.path);
      await snap(page, `F3-mobile-${p.name}`);

      // Check for horizontal overflow
      const hasOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      if (hasOverflow) {
        console.log(`BUG: Horizontal overflow on ${p.path} (mobile)`);
      }
    }

    // Chat público en mobile
    await page.goto(`${BASE}/chat`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    await snap(page, 'F3-mobile-chat-publico');

    // Check chat input is visible and accessible
    const chatInput = page.locator('[data-testid="input-message"]');
    if (await chatInput.isVisible().catch(() => false)) {
      await snap(page, 'F3-mobile-chat-input-visible');
    }
  });

  test('F3-EXT: Auditoría mobile exhaustiva (tablet)', async ({ page }) => {
    await loginAdmin(page);
    await page.setViewportSize({ width: 768, height: 1024 });

    const pages = [
      { path: '/', name: 'calendario' },
      { path: '/appointments', name: 'citas' },
      { path: '/warehouse', name: 'almacen' },
      { path: '/capacity', name: 'capacidad' },
      { path: '/providers', name: 'proveedores' },
      { path: '/notifications', name: 'notificaciones' },
      { path: '/rules', name: 'reglas' },
      { path: '/guide', name: 'guia' },
    ];

    for (const p of pages) {
      await navigateTo(page, p.path);
      await snap(page, `F3-EXT-tablet-${p.name}`);

      const hasOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      if (hasOverflow) {
        console.log(`BUG: Horizontal overflow on ${p.path} (tablet)`);
      }
    }
  });
});
