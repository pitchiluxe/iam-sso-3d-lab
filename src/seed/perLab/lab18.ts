/**
 * seed/perLab/lab18.ts — Non-Human Identity & Service Account Governance.
 * Baseline already creates svc-backup, svc-monitor, and svc-idp-sync as
 * regular User records (department 'IT', title 'Service Account'). The
 * lab's two defects — svc-backup's standing domain-admin and svc-monitor's
 * anomalous sign-in — are injected by the conductor at s1 via the existing
 * 'excessive-permissions' and 'suspicious-signin' faults, the same
 * mechanism lab02 and lab09 use. svc-idp-sync needs no seed delta: an
 * unrotated credential is baseline state, not a fault.
 *
 * svc-monitor is also signed in here so s5's session-revoked validator has
 * a live session to revoke — the anomalous sign-in left a session open,
 * same as lab02 seeds a live session for Bob before his termination step.
 */
import type { MockDirectory } from '@/services';
import type { MockIdP } from '@/services';
import type { MockAppServer } from '@/services';
import { applyBaseline } from '../baseline';

export function applyLab18Seed(dir: MockDirectory, idp: MockIdP, apps: MockAppServer): void {
  applyBaseline(dir, idp, apps);
  idp.seedPasswords({ 'svc-monitor': 'svc-monitor-Sync!1' });
  idp.signIn('svc-monitor', 'svc-monitor-Sync!1');
}
