/**
 * tests/autoUpdate.test.ts — installed copies hear about new releases.
 *
 * electron-updater reads latest.yml from the GitHub release named in
 * package.json's publish block; Windows only shows the desktop notification
 * when the app's AppUserModelID equals the installer's appId. Each of these
 * fails silently in production, so they are checked here.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  build: { appId: string; publish: { provider: string; owner: string; repo: string }[] };
  dependencies: Record<string, string>;
};
const main = readFileSync(new URL('../electron/main.cjs', import.meta.url), 'utf8');

describe('auto-update', () => {
  it('publishes to, and so updates from, the GitHub repository', () => {
    expect(pkg.build.publish[0]).toMatchObject({
      provider: 'github',
      owner: 'pitchiluxe',
      repo: 'iam-sso-3d-lab',
    });
    expect(pkg.dependencies['electron-updater']).toBeTruthy();
  });

  it('notifies under the installer’s own app id', () => {
    expect(main).toContain(`app.setAppUserModelId('${pkg.build.appId}')`);
    expect(main).toMatch(/new Notification\(/);
  });

  it('checks at start-up and again while the app stays open', () => {
    expect(main).toMatch(/setTimeout\(\(\) => \{\s*autoUpdater\.checkForUpdates/);
    expect(main).toMatch(/setInterval\([\s\S]*?checkForUpdates[\s\S]*?UPDATE_CHECK_INTERVAL_MS\)/);
  });
});
