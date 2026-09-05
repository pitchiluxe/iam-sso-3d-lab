/**
 * e2e/basic.spec.ts — boot smoke test.
 *
 * Verifies:
 *  - The Vite app loads without console errors
 *  - The start screen appears with all 13 lab cards
 *  - Clicking a lab card starts the lab and the HUD updates
 */
import { test, expect } from '@playwright/test';

test('app boots, start screen renders 13 lab cards, starting a lab updates the HUD', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  // Tell the app we're in a test environment so it skips auto-triggering the
  // tutorial overlay (which would block clicks on .lab-card elements).
  await page.addInitScript(() => {
    (window as unknown as { __playwright__?: boolean }).__playwright__ = true;
  });

  await page.goto('/');

  // The HUD pills are always present in index.html
  await expect(page.locator('#hud')).toBeVisible();

  // Start screen shows all 13 lab cards
  const cards = page.locator('.lab-card');
  await expect(cards).toHaveCount(13);

  // Start Lab 01
  await page.locator('.lab-card[data-id="lab01"]').click();

  // HUD should reflect the new lab
  await expect(page.locator('#hud-lab')).toContainText(/1:/, { timeout: 5000 });
  // Wait for the conductor to actually finish starting (the click handler
  // has a 300ms fade-out before it fires onStart).
  await expect.poll(async () =>
    page.evaluate(() => !!(window as unknown as { __lab?: { conductor?: { currentLab?: unknown } } }).__lab?.conductor?.currentLab),
    { timeout: 5000 },
  ).toBe(true);
  // Start screen must be gone after the lab starts.
  await expect(page.locator('#start-screen')).toHaveCount(0);
  // Zone pill should show IAM Operations
  await expect(page.locator('#hud-zone')).toContainText('IAM Operations');
  // Score pill should be visible
  await expect(page.locator('#hud-score')).toBeVisible();

  // No console errors during boot
  expect(consoleErrors.filter((e) => !e.includes('favicon'))).toHaveLength(0);

  // Stop the render loop so the browser can tear down without GPU timeout.
  await page.evaluate(() => (window as unknown as { __lab?: { stopRenderLoop?: () => void } }).__lab?.stopRenderLoop?.());
});
