/**
 * e2e/basic.spec.ts — boot smoke test.
 *
 * Verifies:
 *  - The Vite app loads without console errors
 *  - The start screen appears with 10 lab cards
 *  - Clicking a lab card starts the lab and the HUD updates
 */
import { test, expect } from '@playwright/test';

test('app boots, start screen renders 10 lab cards, starting a lab updates the HUD', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.goto('/');

  // The HUD pills are always present in index.html
  await expect(page.locator('#hud')).toBeVisible();

  // Start screen shows 10 lab cards
  const cards = page.locator('.lab-card');
  await expect(cards).toHaveCount(10);

  // Start Lab 01
  await page.locator('.lab-card[data-id="lab01"]').click();

  // HUD should reflect the new lab
  await expect(page.locator('#hud-lab')).toContainText(/1:/);
  // Zone pill should show IAM Operations
  await expect(page.locator('#hud-zone')).toContainText('IAM Operations');
  // Score pill should be visible
  await expect(page.locator('#hud-score')).toBeVisible();

  // No console errors during boot
  expect(consoleErrors.filter((e) => !e.includes('favicon'))).toHaveLength(0);
});
