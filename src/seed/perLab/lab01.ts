/**
 * seed/perLab/lab01.ts — Lab 01 starts from an empty world (no baseline).
 * The learner creates the directory, users, and groups.
 *
 * After the conductor verifies all 5 steps, the baseline is applied so
 * later labs have something to mutate.
 */
import type { UserId } from '@/domain';
import type { MockDirectory } from '@/services';
import type { MockIdP } from '@/services';
import type { MockAppServer } from '@/services';

export function applyLab01Seed(
  dir: MockDirectory,
  idp: MockIdP,
  _apps: MockAppServer,
): void {
  // Lab 01 starts with an empty directory: no users, no groups, no apps.
  // The conductor will guide the learner to call dir.createGroup, dir.createUser, etc.
  // For the thin slice, we still pre-create a stub IdP admin so the learner
  // can sign in at the end. The actual baseline is set after Lab 01 completes.
  const _admin = dir.createUser({
    username:    'admin',
    displayName: 'IAM Admin',
    email:       'admin@northwind.example',
    department:  'IT',
    title:       'IAM Administrator',
    mfa:         'totp',
  }, 'system' as UserId);
  void _admin;
  idp.seedPasswords({ admin: 'admin123' });
}
