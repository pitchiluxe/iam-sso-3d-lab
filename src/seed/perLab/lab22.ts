/**
 * seed/perLab/lab22.ts — Zero Trust: Device Compliance for Privileged Access.
 * Plain baseline. Erin Cho already holds role-iam-admins through
 * grp-iam-admins membership, with mfa: 'none' until lab05 enrolls her — so a
 * sign-in in this lab resolves in one step, cleanly isolating the device-
 * compliance check this lab is actually about.
 */
import type { MockDirectory } from '@/services';
import type { MockIdP } from '@/services';
import type { MockAppServer } from '@/services';
import { applyBaseline } from '../baseline';

export function applyLab22Seed(dir: MockDirectory, idp: MockIdP, apps: MockAppServer): void {
  applyBaseline(dir, idp, apps);
}
