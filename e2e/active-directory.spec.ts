/**
 * e2e/active-directory.spec.ts — Active Directory Users and Computers smoke test
 * (it replaced the IAM Console; tickets are worked here).
 *
 * Since pointer-lock is not available headlessly, this tests the console UI pipeline
 * by triggering onConsoleActivate directly via the window.__lab dev hook.
 */
import { test, expect } from '@playwright/test';

test('Active Directory overlay opens via dev hook and renders the directory', async ({ page }) => {
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
  await expect
    .poll(
      async () =>
        page.evaluate(
          () =>
            !!(window as unknown as { __lab?: { conductor?: { dir?: unknown } } }).__lab?.conductor
              ?.dir,
        ),
      { timeout: 5000 },
    )
    .toBe(true);
  // Make sure the start screen is gone before opening the console.
  await expect(page.locator('#start-screen')).toHaveCount(0);

  // Open Active Directory via the global hook
  await page.evaluate(() => {
    const w = window as unknown as {
      __lab: {
        engine: {
          onConsoleActivate: (cfg: { id: string; title: string; prompt: string }) => void;
        };
      };
    };
    w.__lab.engine.onConsoleActivate({
      id: 'active-directory',
      title: 'Active Directory Users and Computers',
      prompt: 'Open Active Directory',
    });
  });

  // Console overlay should be visible
  await expect(page.locator('#console-overlay')).toBeVisible();

  // Header should show the title
  await expect(page.locator('#console-overlay-title')).toContainText(
    'Active Directory Users and Computers',
  );
  // The console tree (root, domain, Users container) and the object count.
  // Lab 01 builds the directory from scratch, so no particular account is assumed.
  const tree = page.locator('#console-overlay .aduc-tree');
  await expect(tree).toContainText('Active Directory Users and Computers');
  await expect(tree).toContainText('northwind.example');
  await expect(tree).toContainText('Users');
  await expect(page.locator('#console-overlay')).toContainText('object(s)');

  // Close it
  await page.locator('#console-overlay-close').click();
  await expect(page.locator('#console-overlay')).not.toBeVisible();

  expect(consoleErrors.filter((e) => !e.includes('favicon'))).toHaveLength(0);

  // Stop the render loop so the browser can tear down without GPU timeout.
  await page.evaluate(() =>
    (window as unknown as { __lab?: { stopRenderLoop?: () => void } }).__lab?.stopRenderLoop?.(),
  );
});
