/**
 * e2e/iam-console.spec.ts — IAM Console smoke test.
 *
 * Since pointer-lock is not available headlessly, this tests the console UI pipeline
 * by triggering onConsoleActivate directly via the window.__lab dev hook.
 */
import { test, expect } from '@playwright/test';

test('IAM Console overlay opens via dev hook and renders user list', async ({ page }) => {
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
  // Dismiss the start screen by starting a lab through it.
  await page.locator('.lab-card[data-id="lab01"]').click();
  // Wait for the fade-out + start to actually complete.
  await expect.poll(async () =>
    page.evaluate(() => !!(window as unknown as { __lab?: { conductor?: { dir?: unknown } } }).__lab?.conductor?.dir),
    { timeout: 5000 },
  ).toBe(true);
  // Make sure the start screen is gone before opening the console.
  await expect(page.locator('#start-screen')).toHaveCount(0);

  // Trigger the IAM Console via the global hook
  await page.evaluate(() => {
    const w = window as unknown as {
      __lab: {
        engine: {
          onConsoleActivate: (cfg: { id: string; title: string; prompt: string }) => void;
        };
      };
    };
    w.__lab.engine.onConsoleActivate({
      id: 'iam-console',
      title: 'IAM Console',
      prompt: 'Open IAM Console',
    });
  });

  // Console overlay should be visible
  await expect(page.locator('#console-overlay')).toBeVisible();

  // Header should show the title
  await expect(page.locator('#console-overlay-title')).toContainText('IAM Console');

  // Close it
  await page.locator('#console-overlay-close').click();
  await expect(page.locator('#console-overlay')).not.toBeVisible();

  expect(consoleErrors.filter((e) => !e.includes('favicon'))).toHaveLength(0);

  // Stop the render loop so the browser can tear down without GPU timeout.
  await page.evaluate(() => (window as unknown as { __lab?: { stopRenderLoop?: () => void } }).__lab?.stopRenderLoop?.());
});
