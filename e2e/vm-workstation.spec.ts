/**
 * e2e/vm-workstation.spec.ts — Workstation → VM Desktop E2E test.
 *
 * Pressing E near a desk monitor in the 3D scene opens the VM desktop.
 * The VM auto-shows IAM Console + Objectives windows.
 * The 3D consoles (IAM, Ticket, SecOps) are NOT accessible from the 3D scene
 * directly — only through the VM.
 *
 * IAM Ops (lab01's starting zone) has two interactable monitors, flanking
 * the room at x=-4.5 and x=+4.5, both at z=-3.45 — not a single workstation
 * in the back of the room. Getting the "Open VM" prompt requires being both
 * close to (<2.2m) and facing (~within a 55° cone of) one of them.
 */
import { test, expect } from '@playwright/test';

type LabWindow = Window & {
  __lab?: {
    conductor?: { currentLab?: unknown };
    engine?: {
      player: {
        teleport: (pos: { x: number; y: number; z: number }, lookAt: { x: number; y: number; z: number }) => void;
        setKey: (k: string, d: boolean) => void;
      };
    };
    stopRenderLoop?: () => void;
  };
};

async function waitForLabStart(page: import('@playwright/test').Page): Promise<void> {
  await expect
    .poll(
      async () =>
        page.evaluate(() => !!(window as unknown as LabWindow).__lab?.conductor?.currentLab),
      { timeout: 5000 },
    )
    .toBe(true);
  // Let the zone finish building and the camera tween settle.
  await page.waitForTimeout(1200);
}

/** Dismiss the auto-triggered first-visit tutorial if it appears. The tutorial
 *  overlay covers the whole page and intercepts all clicks, so every test that
 *  interacts with the start screen has to clear it before clicking a lab card. */
async function dismissTutorialIfPresent(page: import('@playwright/test').Page): Promise<void> {
  if (await page.locator('#tutorial-overlay').isVisible()) {
    await page.locator('#tut-skip').click();
    await page.locator('#tutorial-overlay').waitFor({ state: 'detached' });
  }
}

test('pressing E near a desk monitor opens VM desktop with IAM Console + Objectives', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.goto('/');
  await dismissTutorialIfPresent(page);
  await page.locator('.lab-card[data-id="lab01"]').click();
  await waitForLabStart(page);

  // Stand by the chair in front of the left desk monitor, facing it.
  await page.evaluate(() => {
    const player = (window as unknown as LabWindow).__lab?.engine?.player;
    player?.teleport({ x: -4.5, y: 1.7, z: -1.6 }, { x: -4.5, y: 0.9, z: -3.45 });
  });

  // Wait a tick for proximity detection
  await page.waitForTimeout(200);

  // Press E — this MUST open the VM desktop (not any 3D-scene console)
  await page.keyboard.press('e');
  await page.waitForTimeout(500);

  // Desktop overlay must be visible
  expect(await page.locator('#desktop-overlay').isVisible()).toBe(true);

  // IAM Console + Objectives windows auto-open inside the VM
  await expect(page.locator('.apex-window-titlebar:has-text("IAM Console")')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('.apex-window-titlebar:has-text("Objectives")')).toBeVisible({ timeout: 5000 });

  // No console errors (excluding favicon)
  expect(consoleErrors.filter((e) => !e.includes('favicon'))).toHaveLength(0);

  await page.evaluate(() => (window as unknown as LabWindow).__lab?.stopRenderLoop?.());
});

test('walking forward and right eventually reaches the right desk monitor and E opens VM', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.goto('/');
  await dismissTutorialIfPresent(page);
  await page.locator('.lab-card[data-id="lab01"]').click();
  await waitForLabStart(page);

  // Walk forward then strafe right, in two sequential phases — spawn is
  // (0, 1.7, 8) facing -z, the right monitor's chair is near (4.5, 1.7, -1.6).
  // Holding both keys at once won't reach it: combined movement normalizes
  // to equal displacement per axis, but this path needs ~9.6m forward and
  // only ~4.5m right, so simultaneous W+D overshoots x long before z arrives.
  // At WALK_SPEED (3 m/s): 3.2s forward covers the z distance, then 1.5s
  // right covers the x distance (with a little margin on each).
  await page.evaluate(() => {
    (window as unknown as LabWindow).__lab?.engine?.player.setKey('KeyW', true);
  });
  await page.waitForTimeout(3300);
  await page.evaluate(() => {
    const player = (window as unknown as LabWindow).__lab?.engine?.player;
    player?.setKey('KeyW', false);
    player?.setKey('KeyD', true);
  });
  await page.waitForTimeout(1600);
  await page.evaluate(() => {
    (window as unknown as LabWindow).__lab?.engine?.player.setKey('KeyD', false);
  });

  // Press E
  await page.keyboard.press('e');
  await page.waitForTimeout(500);

  // VM desktop must be open
  expect(await page.locator('#desktop-overlay').isVisible()).toBe(true);

  expect(consoleErrors.filter((e) => !e.includes('favicon'))).toHaveLength(0);

  await page.evaluate(() => (window as unknown as LabWindow).__lab?.stopRenderLoop?.());
});
