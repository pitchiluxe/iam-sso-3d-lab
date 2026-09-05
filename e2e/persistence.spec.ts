/**
 * e2e/persistence.spec.ts — localStorage progress persistence.
 *
 * Verifies:
 *  - After starting a lab, localStorage has the persisted-state envelope
 *  - The envelope version is v3 (the current schema — v3 added generatedLabs)
 *  - After reload, the start screen is shown again (the app's home page) AND
 *    the persisted envelope is still present in localStorage, so the learner
 *    can resume from the start screen rather than re-entering the workspace.
 */
import { test, expect } from '@playwright/test';

test('progress persists across page reload via localStorage', async ({ page, context }) => {
  // Clear storage before the test
  await context.clearCookies();
  // Tell the app we're in a test environment so it skips auto-triggering the
  // tutorial overlay (which would block clicks on .lab-card elements).
  await page.addInitScript(() => {
    (window as unknown as { __playwright__?: boolean }).__playwright__ = true;
  });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
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

  // Reload the page. The app's landing page is the start screen (not the 3D
  // workspace), so we expect the start screen to be visible again, and the
  // persisted envelope to still be present in localStorage.
  await page.reload();
  await expect(page.locator('#start-screen')).toBeVisible();
  const storedAfter = await page.evaluate(() => localStorage.getItem('iam-lab-state-v2'));
  expect(storedAfter).not.toBeNull();
  expect(JSON.parse(storedAfter!).version).toBe(3);

  // Stop the render loop so the browser can tear down without GPU timeout.
  await page.evaluate(() => (window as unknown as { __lab?: { stopRenderLoop?: () => void } }).__lab?.stopRenderLoop?.());
});
