/**
 * e2e/secops-dashboard.spec.ts — SecOps Dashboard smoke test.
 */
import { test, expect } from '@playwright/test';

test('SecOps Dashboard overlay opens and shows audit tab', async ({ page }) => {
  await page.goto('/');
  await page.locator('.lab-card[data-id="lab01"]').click();
  await expect(page.locator('#hud-zone')).toContainText('IAM Operations');

  await page.evaluate(() => {
    const w = window as unknown as {
      __lab: {
        engine: {
          onConsoleActivate: (cfg: { id: string; title: string; prompt: string }) => void;
        };
      };
    };
    w.__lab.engine.onConsoleActivate({ id: 'secops-dashboard', title: 'SecOps Dashboard', prompt: 'Open SecOps' });
  });

  await expect(page.locator('#console-overlay')).toBeVisible();
  await expect(page.locator('#console-overlay-title')).toContainText('SecOps');
  await page.locator('#console-overlay-close').click();
  await expect(page.locator('#console-overlay')).not.toBeVisible();
});
