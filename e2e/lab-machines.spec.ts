/**
 * e2e/lab-machines.spec.ts — DC01, CLIENT01, the AD Enterprise Lab Series and
 * the IAM Portfolio inside the main VM.
 *
 * Opens the windows through the window.__lab dev hook (pointer lock is not
 * available headlessly). Ollama is not running in CI: the instructor falls back
 * to its offline answers, so connection errors to it are expected and ignored.
 */
import { test, expect, type Page } from '@playwright/test';

type Lab = {
  __lab: {
    conductor: unknown;
    showWorkstation: () => void;
    desktop: { openWindow: (id: string, c: unknown) => void };
    stopRenderLoop?: () => void;
  };
};

async function enterVm(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as unknown as { __playwright__?: boolean }).__playwright__ = true;
  });
  await page.goto('/');
  await page.locator('.lab-card[data-id="lab01"]').click();
  await expect
    .poll(async () => page.evaluate(() => !!(window as unknown as Partial<Lab>).__lab?.conductor), { timeout: 5000 })
    .toBe(true);
  await page.evaluate(() => (window as unknown as Lab).__lab.showWorkstation());
}

const open = (page: Page, id: string): Promise<void> =>
  page.evaluate((x) => {
    const w = window as unknown as Lab;
    w.__lab.desktop.openWindow(x, w.__lab.conductor);
  }, id);

test('DC01 opens like a Remote Desktop session and signs in to Server Manager', async ({ page }) => {
  await enterVm(page);
  await open(page, 'dc01');
  await expect(page.getByText('Remote Desktop', { exact: false }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Connect' }).click();
  await page.locator('input[type="password"]').fill('TechnoBiz!Lab2026');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('WELCOME TO SERVER MANAGER')).toBeVisible();
  await page.evaluate(() => (window as unknown as Partial<Lab>).__lab?.stopRenderLoop?.());
});

test('the AD Enterprise Lab grades the in-app machines', async ({ page }) => {
  await enterVm(page);
  await open(page, 'ad-lab');
  await expect(page.locator('.adl-title')).toHaveText('AD Enterprise Lab Series');
  await expect(page.locator('.adl-card')).toHaveCount(2);
  const check = page.getByRole('button', { name: 'CHECK MY WORK' });
  // Never disabled: the validation engine does not wait for the instructor.
  await check.click();
  await expect(page.locator('.adl-check').first()).toBeVisible({ timeout: 15000 });
  await page.evaluate(() => (window as unknown as Partial<Lab>).__lab?.stopRenderLoop?.());
});

test('the IAM Portfolio sets a project up on DC01 and checks it', async ({ page }) => {
  await enterVm(page);
  page.on('dialog', (d) => void d.accept());
  await open(page, 'iam-portfolio');
  await page.locator('.pf-item', { hasText: 'Stale' }).click();
  await page.getByRole('button', { name: '1. Prepare DC01' }).click();
  await page.getByRole('button', { name: '2. Set up this project in DC01' }).click();
  await expect(page.locator('.pf-msg.sys', { hasText: 'Stale-account scenario ready' })).toBeVisible();
  await page.getByRole('button', { name: '3. Check my work on DC01' }).click();
  await expect(page.locator('.pf-vm-res')).toHaveCount(7);
  await page.evaluate(() => (window as unknown as Partial<Lab>).__lab?.stopRenderLoop?.());
});
