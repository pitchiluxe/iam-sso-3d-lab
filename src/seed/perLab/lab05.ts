/**
 * seed/perLab/lab05.ts — MFA & Conditional Access.
 * Baseline + remove MFA from Erin; inject mfa-prompt-loop fault.
 */
import type { MockDirectory } from '@/services';
import type { MockIdP } from '@/services';
import type { MockAppServer } from '@/services';
import type { MockTicketQueue } from '@/services';
import { applyBaseline } from '../baseline';

export function applyLab05Seed(
  dir: MockDirectory,
  idp: MockIdP,
  apps: MockAppServer,
  _tickets: MockTicketQueue,
): void {
  const base = applyBaseline(dir, idp, apps);
  const erin = dir.getUser(base.userIds['erin.cho']!);
  if (erin) erin.mfa = 'none';
  // Fault (mfa-prompt-loop) is applied by the conductor at step 4.
}
