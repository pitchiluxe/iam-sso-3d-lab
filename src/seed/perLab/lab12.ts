/**
 * seed/perLab/lab12.ts — Hybrid Identity (Cloud Sync).
 * Baseline + on-prem AD users that need to be synced.
 * Fault (sync-soft-match-conflict) is applied at step s6 by the conductor.
 */
import type { MockDirectory } from '@/services';
import type { MockIdP } from '@/services';
import type { MockAppServer } from '@/services';
import type { MockTicketQueue } from '@/services';
import { applyBaseline } from '../baseline';

export function applyLab12Seed(
  dir: MockDirectory,
  idp: MockIdP,
  apps: MockAppServer,
  _tickets: MockTicketQueue,
): void {
  applyBaseline(dir, idp, apps);
  // All baseline users exist in the simulated on-prem AD.
  // The sync agent is not yet installed — learner installs it at step s2.
  // Fault (sync-soft-match-conflict) applied by conductor at s6.
}
