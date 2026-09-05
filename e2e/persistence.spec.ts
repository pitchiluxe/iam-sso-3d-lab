/**
 * e2e/persistence.spec.ts — localStorage progress persistence.
 *
 * Verifies:
 *  - After starting a lab, localStorage has the persisted-state envelope
 *  - The envelope version is v3 (the current schema — v3 added generatedLabs)
 *  - After reload, the same lab remains current in the HUD
 */
import { test, expect } from '@playwright/test';

test('progress persists across page reload via localStorage', async ({ page, context }) => {
  // Clear storage before the test
  await context.clearCookies();
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  // Dismiss the auto-triggered tutorial if it appeared (blocks lab card clicks).
  if (await page.locator('#tutorial-overlay').isVisible()) {
    await page.locator('#tut-skip').click();
    await page.locator('#tutorial-overlay').waitFor({ state: 'detached' });
  }
  await page.locator('.lab-card[data-id="lab03"]').click();

  // Wait for HUD to reflect Lab 3 (click handler has 300ms fade-out).
  await expect(page.locator('#hud-lab')).toContainText(/3:/, { timeout: 5000 });
  // Wait until the conductor's current lab is actually set.
  await expect.poll(async () =>
    page.evaluate(() => !!(window as unknown as { __lab?: { conductor?: { currentLab?: unknown } } }).__lab?.conductor?.currentLab),
    { timeout: 5000 },
  ).toBe(true);
  // Start screen must be gone after the lab starts.
  await expect(page.locator('#start-screen')).toHaveCount(0);

  // Verify the persisted-state envelope exists at the current key.
  // Schema history (see src/util/persistence.ts):
  //   v2 — progress + resume + evidence under iam-lab-state-v2
  //   v3 — adds generatedLabs (AI-generated daily-ticket labs + dedup ledger)
  const stored = await page.evaluate(() => localStorage.getItem('iam-lab-state-v2'));
  expect(stored).not.toBeNull();
  const parsed = JSON.parse(stored!);
  expect(parsed.version).toBe(3);

  // Reload the page
  await page.reload();

  // The start screen should NOT be showing because a lab is in progress
  await expect(page.locator('#hud-lab')).toContainText(/3:/);

  // Stop the render loop so the browser can tear down without GPU timeout.
  await page.evaluate(() => (window as unknown as { __lab?: { stopRenderLoop?: () => void } }).__lab?.stopRenderLoop?.());
});
