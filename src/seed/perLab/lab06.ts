/**
 * seed/perLab/lab06.ts — Access Reviews.
 * Baseline + open Q3 review campaign with 8 pending decisions.
 */
import type { MockDirectory } from '@/services';
import type { MockIdP } from '@/services';
import type { MockAppServer } from '@/services';
import type { MockAccessReviews } from '@/services';
import { applyBaseline } from '../baseline';

export function applyLab06Seed(
  dir: MockDirectory,
  idp: MockIdP,
  apps: MockAppServer,
  reviews: MockAccessReviews,
): void {
  const base = applyBaseline(dir, idp, apps);
  const ivy = base.userIds['ivy.park']!;
  const bob = base.userIds['bob.sato']!;
  const alex = base.userIds['alex.morgan']!;
  const cara = base.userIds['cara.patel']!;
  const jane = base.userIds['jane.doe']!;
  const dan = base.userIds['dan.rivera']!;

  const review = reviews.openCampaign({
    campaign: 'Q3-2026',
    openedAt: Date.now(),
    dueAt: Date.now() + 14 * 24 * 60 * 60 * 1000,
  });

  // 8 pending decisions, 6 approve + 2 revoke (Bob's dormant account, Bob's
  // stale engineering membership). recordDecision() matches an existing
  // entry by (userId, groupId, roleId) — a duplicate row here used to mean
  // one of the 8 pending items could never be independently decided, since
  // both copies resolved to the same array index and the second stayed
  // 'pending' forever, permanently blocking this step.
  reviews.seedDecisions(review.id, [
    { userId: alex, groupId: base.groupIds['grp-finance-payroll']!, decision: 'approve' },
    { userId: cara, groupId: base.groupIds['grp-hr-readers']!, decision: 'approve' },
    { userId: jane, groupId: base.groupIds['grp-finance-analysts']!, decision: 'approve' },
    { userId: dan, groupId: base.groupIds['grp-helpdesk-tier1']!, decision: 'approve' },
    { userId: ivy, groupId: base.groupIds['grp-helpdesk-tier1']!, decision: 'approve' },
    { userId: ivy, groupId: base.groupIds['grp-iam-admins']!, decision: 'approve' },
    { userId: bob, groupId: base.groupIds['grp-engineering-dev']!, decision: 'revoke' }, // dormant
    { userId: bob, groupId: base.groupIds['grp-finance-analysts']!, decision: 'revoke' }, // stale
  ]);
}
