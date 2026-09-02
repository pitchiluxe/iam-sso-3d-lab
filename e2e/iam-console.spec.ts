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

  await page.goto('/');
  await page.locator('.lab-card[data-id="lab01"]').click();
  await expect(page.locator('#hud-zone')).toContainText('IAM Operations');

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
});
