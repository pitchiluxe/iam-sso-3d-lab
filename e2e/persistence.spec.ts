/**
 * e2e/persistence.spec.ts — localStorage progress persistence.
 *
 * Verifies:
 *  - After starting a lab, localStorage has the v2 envelope key
 *  - After reload, the same lab remains current in the HUD
 */
import { test, expect } from '@playwright/test';

test('progress persists across page reload via localStorage', async ({ page, context }) => {
  // Clear storage before the test
  await context.clearCookies();
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('.lab-card[data-id="lab03"]').click();

  // Wait for HUD to reflect Lab 3
  await expect(page.locator('#hud-lab')).toContainText(/3:/);

  // Verify the v2 envelope key exists
  const stored = await page.evaluate(() => localStorage.getItem('iam-lab-state-v2'));
  expect(stored).not.toBeNull();
  const parsed = JSON.parse(stored!);
  expect(parsed.version).toBe(2);

  // Reload the page
  await page.reload();

  // The start screen should NOT be showing because a lab is in progress
  await expect(page.locator('#hud-lab')).toContainText(/3:/);
});
