/**
 * e2e/ticket-console.spec.ts — Ticket Console smoke test.
 */
import { test, expect } from '@playwright/test';

test('Ticket Console overlay opens and shows tickets tab', async ({ page }) => {
  // Tell the app we're in a test environment so it skips auto-triggering the
  // tutorial overlay (which would block clicks on .lab-card elements).
  await page.addInitScript(() => {
    (window as unknown as { __playwright__?: boolean }).__playwright__ = true;
  });
  await page.goto('/');
  // Dismiss the auto-triggered tutorial if it appeared (blocks lab card clicks).
  if (await page.locator('#tutorial-overlay').isVisible()) {
    await page.locator('#tut-skip').click();
    await page.locator('#tutorial-overlay').waitFor({ state: 'detached' });
  }
  // Dismiss the start screen by starting a lab through it.
  await page.locator('.lab-card[data-id="lab02"]').click();
  // Wait for the fade-out + start to actually complete.
  await expect.poll(async () =>
    page.evaluate(() => !!(window as unknown as { __lab?: { conductor?: { tickets?: unknown } } }).__lab?.conductor?.tickets),
    { timeout: 5000 },
  ).toBe(true);
  // Make sure the start screen is gone before opening the console.
  await expect(page.locator('#start-screen')).toHaveCount(0);

  await page.evaluate(() => {
    const w = window as unknown as {
      __lab: {
        engine: {
          onConsoleActivate: (cfg: { id: string; title: string; prompt: string }) => void;
        };
      };
    };
    w.__lab.engine.onConsoleActivate({ id: 'ticket-console', title: 'Ticket Queue', prompt: 'Open Ticket Queue' });
  });

  await expect(page.locator('#console-overlay')).toBeVisible();
  await expect(page.locator('#console-overlay-title')).toContainText('Ticket');
  await page.locator('#console-overlay-close').click();
  await expect(page.locator('#console-overlay')).not.toBeVisible();

  // Stop the render loop so the browser can tear down without GPU timeout.
  await page.evaluate(() => (window as unknown as { __lab?: { stopRenderLoop?: () => void } }).__lab?.stopRenderLoop?.());
});
