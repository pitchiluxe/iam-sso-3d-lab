/**
 * e2e/vm-workstation.spec.ts — Workstation → VM Desktop E2E test.
 *
 * Pressing E near any workstation in the 3D scene opens the VM desktop.
 * The VM auto-shows AI Supervisor + Objectives windows.
 * The 3D consoles (IAM, Ticket, SecOps) are NOT accessible from the 3D scene.
 */
import { test, expect } from '@playwright/test';

test('pressing E near workstation opens VM desktop with AI Supervisor + Objectives', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.goto('/');
  await page.locator('.lab-card[data-id="lab01"]').click();

  // Wait for lab to start
  await expect.poll(async () =>
    page.evaluate(() => !!(window as unknown as { __lab?: { conductor?: { currentLab?: unknown } } }).__lab?.conductor?.currentLab),
    { timeout: 5000 },
  ).toBe(true);

  // Wait for the lab scene to settle
  await page.waitForTimeout(1200);

  // Teleport close to the workstation and immediately trigger proximity check
  const moved = await page.evaluate(() => {
    const lab = (window as unknown as { __lab?: { testTeleportToWorkstation?: (x: number, y: number, z: number) => void } }).__lab;
    const fn = lab?.testTeleportToWorkstation;
    if (typeof fn !== 'function') return false;
    fn(0, 1.7, -5); // 2m in front of workstation at z=-7
    return true;
  });
  expect(moved).toBe(true);

  // Wait a tick for proximity detection
  await page.waitForTimeout(200);

  // Press E — this MUST open the VM desktop (not any console)
  await page.keyboard.press('e');
  await page.waitForTimeout(500);

  // Desktop overlay must be visible
  expect(await page.locator('#desktop-overlay').isVisible()).toBe(true);

  // AI Supervisor + Objectives windows auto-open inside the VM
  await expect(page.locator('.apex-window-titlebar:has-text("AI Supervisor")')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('.apex-window-titlebar:has-text("Objectives")')).toBeVisible({ timeout: 5000 });

  // No console errors (excluding favicon)
  expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);

  await page.evaluate(() => (window as unknown as { __lab?: { stopRenderLoop?: () => void } }).__lab?.stopRenderLoop?.());
});

test('walking forward eventually reaches workstation range and E opens VM', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.goto('/');
  await page.locator('.lab-card[data-id="lab01"]').click();
  await expect.poll(async () =>
    page.evaluate(() => !!(window as unknown as { __lab?: { conductor?: { currentLab?: unknown } } }).__lab?.conductor?.currentLab),
    { timeout: 5000 },
  ).toBe(true);
  await page.waitForTimeout(1200);

  // Walk forward (W) using programmatic key injection
  await page.evaluate(() => {
    const lab = (window as unknown as { __lab?: { engine?: { player: { setKey: (k: string, d: boolean) => void } } } }).__lab;
    lab?.engine?.player.setKey('KeyW', true);
  });

  // Wait long enough to reach the workstation (spawn at z=8, workstation at z=-7 → 15m → 5s at 3m/s)
  await page.waitForTimeout(5000);

  await page.evaluate(() => {
    const lab = (window as unknown as { __lab?: { engine?: { player: { setKey: (k: string, d: boolean) => void } } } }).__lab;
    lab?.engine?.player.setKey('KeyW', false);
  });

  // Press E
  await page.keyboard.press('e');
  await page.waitForTimeout(500);

  // VM desktop must be open
  expect(await page.locator('#desktop-overlay').isVisible()).toBe(true);

  await page.evaluate(() => (window as unknown as { __lab?: { stopRenderLoop?: () => void } }).__lab?.stopRenderLoop?.());
});
