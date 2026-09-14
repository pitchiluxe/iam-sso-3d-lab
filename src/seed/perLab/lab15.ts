/**
 * seed/perLab/lab15.ts — PKI & Certificate Lifecycle.
 * Baseline only — the expired-cert fault lives in lab15.ts's own `faults`
 * array (applied at s2), matching how every other break/fix-style lab
 * injects its fault rather than seeding it directly.
 */
import type { MockDirectory } from '@/services';
import type { MockIdP } from '@/services';
import type { MockAppServer } from '@/services';
import { applyBaseline } from '../baseline';

export function applyLab15Seed(dir: MockDirectory, idp: MockIdP, apps: MockAppServer): void {
  applyBaseline(dir, idp, apps);
}
