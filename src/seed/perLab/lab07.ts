/**
 * seed/perLab/lab07.ts — SSO Break/Fix.
 * Baseline + open an incident; conductor injects a randomized fault at step 1.
 */
import type { MockDirectory } from '@/services';
import type { MockIdP } from '@/services';
import type { MockAppServer } from '@/services';
import type { MockIncidents } from '@/services';
import { applyBaseline } from '../baseline';
import { SYSTEM_ACTOR, type UserId } from '@/domain';

export function applyLab07Seed(
  dir: MockDirectory,
  idp: MockIdP,
  apps: MockAppServer,
  incidents: MockIncidents,
): void {
  applyBaseline(dir, idp, apps);
  incidents.open({
    title: 'Finance Portal authentication failure',
    severity: 'high',
    affectedUserIds: [],
    affectedAppIds: [apps.getAppByName('Finance Portal')!.id],
    summary: 'Multiple users report "authentication error" when accessing the Finance Portal starting at 09:05.',
    indicators: ['app-finance-sso-failure'],
  });
}
