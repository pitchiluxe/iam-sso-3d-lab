/**
 * e2e/remote-desktop.spec.ts — Remote Desktop (RDP) app E2E test.
 *
 * Verifies the admin-only "Remote Desktop" icon added to the VM desktop:
 * connect dialog -> sign-in (disabled account rejected, wrong password
 * rejected) -> success reaches a role-scoped session desktop -> a
 * temp-password account is forced through a password change before it can
 * sign in. Seeds three throwaway accounts directly through the directory so
 * the test doesn't depend on lab01's specific seed data.
 */
import { test, expect } from '@playwright/test';

type LabWindow = Window & {
  __lab?: {
    conductor?: {
      currentLab?: unknown;
      dir: {
        listUsers(): Array<{ id: string; username: string }>;
        createUser(input: Record<string, unknown>, actor: string): { id: string; username: string };
        disableUser(id: string, actor: string): void;
      };
      idp: {
        seedPasswords(map: Record<string, string>): void;
        resetPassword(
          id: string,
          password: string,
          opts: { forceChangeAtNextLogin: boolean },
          actor: string,
        ): void;
      };
    };
    desktop?: { openWindow(id: string, conductor: unknown): void };
    showWorkstation?: () => void;
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
  await page.waitForTimeout(1200);
}

async function dismissTutorialIfPresent(page: import('@playwright/test').Page): Promise<void> {
  if (await page.locator('#tutorial-overlay').isVisible()) {
    await page.locator('#tut-skip').click();
    await page.locator('#tutorial-overlay').waitFor({ state: 'detached' });
  }
}

test('Remote Desktop: rejects disabled/wrong-password sign-ins, forces a temp-password change, opens a role-scoped session', async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.addInitScript(() => {
    (window as unknown as { __playwright__?: boolean }).__playwright__ = true;
  });
  await page.goto('/');
  await dismissTutorialIfPresent(page);
  // lab02 (not lab01) because lab01's first step is "build the directory from
  // scratch" — no users or apps exist yet. lab02 starts from the seeded
  // baseline (Finance/HR/Help Desk/VPN Portal already registered), which this
  // test needs for the department -> app tile mapping.
  await page.locator('.lab-card[data-id="lab02"]').click();
  await waitForLabStart(page);

  const names = await page.evaluate(() => {
    const c = (window as unknown as LabWindow).__lab!.conductor!;
    const actor = 'e2e-test-actor';

    const finance = c.dir.createUser(
      {
        username: 'rdp.finance.tester',
        displayName: 'RDP Finance Tester',
        email: 'rdp.finance.tester@northwind.example',
        department: 'Finance',
        title: 'Analyst',
      },
      actor,
    );
    c.idp.seedPasswords({ [finance.username]: 'E2ePass1!' });

    const disabled = c.dir.createUser(
      {
        username: 'rdp.disabled.tester',
        displayName: 'RDP Disabled Tester',
        email: 'rdp.disabled.tester@northwind.example',
        department: 'IT',
        title: 'Analyst',
      },
      actor,
    );
    c.idp.seedPasswords({ [disabled.username]: 'E2ePass1!' });
    c.dir.disableUser(disabled.id, actor);

    const temp = c.dir.createUser(
      {
        username: 'rdp.temp.tester',
        displayName: 'RDP Temp Tester',
        email: 'rdp.temp.tester@northwind.example',
        department: 'HR',
        title: 'Coordinator',
      },
      actor,
    );
    c.idp.resetPassword(temp.id, 'TempPass1!', { forceChangeAtNextLogin: true }, actor);

    return { finance: finance.username, disabled: disabled.username, temp: temp.username };
  });

  await page.evaluate(() => (window as unknown as LabWindow).__lab!.showWorkstation!());
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const w = window as unknown as LabWindow;
    w.__lab!.desktop!.openWindow('remote-desktop', w.__lab!.conductor);
  });

  const win = page.locator('.apex-window', {
    has: page.locator('.apex-window-titlebar:has-text("Remote Desktop")'),
  });
  await expect(win).toBeVisible();

  // Screen 1: connect dialog shows the fixed target and a Connect button.
  await expect(win.locator('input[readonly]')).toHaveValue(/10\.20\.40\.15/);
  await win.locator('button:has-text("Connect")').click();

  // Disabled account -> rejected with the real reason, not a silent failure.
  await win.locator('select').selectOption(names.disabled);
  await win.locator('input[type="password"]').fill('E2ePass1!');
  await win.locator('button:has-text("Sign in")').click();
  await expect(win.locator('text=disabled by an administrator')).toBeVisible();

  // Wrong password on a valid, active account -> also rejected.
  await win.locator('select').selectOption(names.finance);
  await win.locator('input[type="password"]').fill('wrong-password');
  await win.locator('button:has-text("Sign in")').click();
  await expect(win.locator('text=username or password is incorrect')).toBeVisible();

  // Correct credentials -> role-scoped session desktop (Finance dept sees
  // the Finance Portal tile, plus the always-present Account tile).
  await win.locator('input[type="password"]').fill('E2ePass1!');
  await win.locator('button:has-text("Sign in")').click();
  await expect(win.locator(`text=${names.finance}@ONBOARD-WKS01`)).toBeVisible();
  await expect(win.locator('button:has-text("Finance Portal")')).toBeVisible();
  await expect(win.locator('button:has-text("Account")')).toBeVisible();

  await win.locator('button:has-text("Account")').click();
  await expect(win.getByText('Finance', { exact: true })).toBeVisible();

  // Disconnect, then a temp-password account is forced to change it before
  // it can reach the session desktop.
  await win.locator('button:has-text("Disconnect")').click();
  await win.locator('button:has-text("Connect")').click();
  await win.locator('select').selectOption(names.temp);
  await win.locator('input[type="password"]').fill('TempPass1!');
  await win.locator('button:has-text("Sign in")').click();
  await expect(win.locator('text=password has expired')).toBeVisible();

  const newPwInputs = win.locator('input[type="password"]');
  await newPwInputs.nth(0).fill('NewPass1!');
  await newPwInputs.nth(1).fill('NewPass1!');
  await win.locator('button:has-text("Change password")').click();
  await expect(win.locator(`text=${names.temp}@ONBOARD-WKS01`)).toBeVisible();

  expect(consoleErrors.filter((e) => !e.includes('favicon'))).toHaveLength(0);
  await page.evaluate(() => (window as unknown as LabWindow).__lab?.stopRenderLoop?.());
});
