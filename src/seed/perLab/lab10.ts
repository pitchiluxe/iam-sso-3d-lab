/**
 * seed/perLab/lab10.ts — Capstone.
 * Fresh baseline + onboarding/mover/termination tickets + an SSO fault + a
 * suspicious signin. The lab runs the full lifecycle end-to-end.
 */
import { mkAppId, type UserId } from '@/domain';
import type { MockDirectory } from '@/services';
import type { MockIdP } from '@/services';
import type { MockAppServer } from '@/services';
import type { MockTicketQueue } from '@/services';
import type { MockAccessReviews } from '@/services';
import { applyBaseline } from '../baseline';

export function applyLab10Seed(
  dir: MockDirectory,
  idp: MockIdP,
  apps: MockAppServer,
  tickets: MockTicketQueue,
  reviews: MockAccessReviews,
): void {
  const base = applyBaseline(dir, idp, apps);
  const cara = base.userIds['cara.patel']!;
  const ivy = base.userIds['ivy.park']!;

  // s4 asks the learner to integrate these from scratch — baseline ships
  // them already configured, which (before app-config-fixed was scoped to
  // its own event) let the step pass untouched. Same fix as lab04's seed.
  const finance = apps.getApp(mkAppId('app-finance'))!;
  finance.status = 'misconfigured';
  finance.entityId = '';
  finance.redirectUri = '';
  finance.configDiffFromBaseline = {
    entityId: { expected: 'urn:finance.northwind.example', actual: '' },
    redirectUri: { expected: 'https://finance.northwind.example/callback', actual: '' },
  };
  const helpdesk = apps.getApp(mkAppId('app-helpdesk-portal'))!;
  helpdesk.status = 'misconfigured';
  helpdesk.redirectUri = '';
  helpdesk.configDiffFromBaseline = {
    redirectUri: { expected: 'https://helpdesk.northwind.example/callback', actual: '' },
  };

  // 5 onboarding tickets
  const newHires = ['nina.king', 'oscar.lin', 'paul.weber', 'quinn.davis', 'rita.frost'];
  for (const u of newHires) {
    const user = dir.createUser(
      {
        username: u,
        displayName: u.replace('.', ' '),
        email: `${u}@northwind.example`,
        department: 'Finance',
        title: 'New Hire',
        mfa: 'none',
      },
      'system' as UserId,
    );
    tickets.create({
      kind: 'onboarding',
      requesterId: cara,
      subject: `Onboard ${user.displayName}`,
      body: 'Provision the account and add them to grp-finance-payroll so they can process payroll.',
      priority: 'normal',
      relatedUserIds: [user.id],
      payload: {
        proposedGroupIds: [base.groupIds['grp-finance-payroll']!],
        proposedRoleIds: [base.roleIds['grp-finance-payroll']!],
        startDate: Date.now(),
      },
    });
  }

  // 2 movers
  tickets.create({
    kind: 'transfer',
    requesterId: ivy,
    subject: 'Move Jane Doe to Engineering',
    body: 'Jane is moving teams. Remove her from grp-finance-analysts. Add her to grp-engineering-dev.',
    priority: 'normal',
    relatedUserIds: [base.userIds['jane.doe']!],
    payload: {
      userId: base.userIds['jane.doe']!,
      fromDepartment: 'Finance',
      toDepartment: 'Engineering',
    },
  });
  tickets.create({
    kind: 'transfer',
    requesterId: ivy,
    subject: 'Move Alex Morgan to HR',
    body: 'Alex is moving to HR. Remove him from grp-finance-payroll. Add him to grp-hr-readers.',
    priority: 'normal',
    relatedUserIds: [base.userIds['alex.morgan']!],
    payload: {
      userId: base.userIds['alex.morgan']!,
      fromDepartment: 'Finance',
      toDepartment: 'HR',
    },
  });

  // 1 termination
  tickets.create({
    kind: 'termination',
    requesterId: cara,
    subject: 'Terminate Bob Sato',
    body: 'Voluntary resignation, effective immediately. Disable the account, revoke all active sessions, and remove him from all groups.',
    priority: 'urgent',
    relatedUserIds: [base.userIds['bob.sato']!],
    payload: { userId: base.userIds['bob.sato']!, reason: 'resignation', immediate: true },
  });

  // s6's Q3 access review — nothing previously opened a campaign for lab10 at
  // all, so 'review-decisions-recorded' (which requires at least one review
  // with zero pending items) could never be satisfied. Every (userId, groupId)
  // pair here is unique — recordDecision() matches by that key, so a repeated
  // pair collapses to one slot and the duplicate can never be independently
  // decided (the bug lab06's seed had).
  const review = reviews.openCampaign({
    campaign: 'Q3-2026',
    openedAt: Date.now(),
    dueAt: Date.now() + 14 * 24 * 60 * 60 * 1000,
  });
  reviews.seedDecisions(review.id, [
    { userId: ivy, groupId: base.groupIds['grp-iam-admins']!, decision: 'approve' },
    { userId: cara, groupId: base.groupIds['grp-hr-readers']!, decision: 'approve' },
    {
      userId: base.userIds['nina.king']!,
      groupId: base.groupIds['grp-finance-payroll']!,
      decision: 'approve',
    },
    {
      userId: base.userIds['alex.morgan']!,
      groupId: base.groupIds['grp-finance-payroll']!,
      decision: 'revoke',
    },
  ]);
}
