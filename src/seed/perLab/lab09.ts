/**
 * seed/perLab/lab09.ts — Privileged Access.
 * Baseline + Hank has standing domain admins membership.
 */
import type { MockDirectory } from '@/services';
import type { MockIdP } from '@/services';
import type { MockAppServer } from '@/services';
import { applyBaseline } from '../baseline';

export function applyLab09Seed(dir: MockDirectory, idp: MockIdP, apps: MockAppServer): void {
  applyBaseline(dir, idp, apps);
  // Hank is already in grp-domain-admins from baseline; that's the standing privilege.
}
