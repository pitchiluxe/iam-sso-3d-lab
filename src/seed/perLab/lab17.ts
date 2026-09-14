/**
 * seed/perLab/lab17.ts — Cloud IAM: Cross-Account Role & Least Privilege.
 * Baseline + a production cloud role set up months ago with wildcard
 * permissions and a trust policy that names nearly every employee in the
 * company, instead of the two-person data team it was actually meant for.
 */
import type { MockDirectory } from '@/services';
import type { MockIdP } from '@/services';
import type { MockAppServer } from '@/services';
import type { MockCloudRoles } from '@/services';
import { applyBaseline } from '../baseline';

export function applyLab17Seed(
  dir: MockDirectory,
  idp: MockIdP,
  apps: MockAppServer,
  cloudRoles: MockCloudRoles,
): void {
  const base = applyBaseline(dir, idp, apps);

  const everyone = [
    'cara.patel',
    'ivy.park',
    'jane.doe',
    'bob.sato',
    'alex.morgan',
    'dan.rivera',
    'erin.cho',
    'greta.olsen',
    'hank.oneill',
  ]
    .map((u) => base.userIds[u])
    .filter((id): id is NonNullable<typeof id> => Boolean(id));

  cloudRoles.seedRole({
    name: 'prod-data-readonly',
    accountId: '111122223333',
    // Wildcard everything — set up once, never scoped down since.
    permissions: ['s3:*', 'ec2:*', 'iam:PassRole'],
    // Meant for the two-person data team (Ivy, Dan) but the trust policy
    // was never narrowed from "whoever existed when this was created."
    trustedUserIds: everyone,
  });
}
