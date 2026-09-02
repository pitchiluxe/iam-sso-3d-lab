/**
 * e2e/ticket-console.spec.ts — Ticket Console smoke test.
 */
import { test, expect } from '@playwright/test';

test('Ticket Console overlay opens and shows tickets tab', async ({ page }) => {
  await page.goto('/');
  await page.locator('.lab-card[data-id="lab02"]').click();
  await expect(page.locator('#hud-zone')).toContainText('IAM Operations');

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
});
