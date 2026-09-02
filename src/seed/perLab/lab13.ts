/**
 * seed/perLab/lab13.ts — Break-Glass Account.
 * Baseline + ensure the break-glass accounts are NOT pre-created (learner creates them).
 * Fault (idp-mfa-outage) is applied at step s7 by the conductor.
 */
import type { MockDirectory } from '@/services';
import type { MockIdP } from '@/services';
import type { MockAppServer } from '@/services';
import type { MockTicketQueue } from '@/services';
import { applyBaseline } from '../baseline';

export function applyLab13Seed(
  dir: MockDirectory,
  idp: MockIdP,
  apps: MockAppServer,
  _tickets: MockTicketQueue,
): void {
  applyBaseline(dir, idp, apps);
  // No break-glass accounts in the baseline — learner creates both at s2 and s3.
  // Fault (idp-mfa-outage) applied by conductor at s7.
}
