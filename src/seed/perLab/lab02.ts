/**
 * seed/perLab/lab02.ts — Joiner / Mover / Leaver.
 * Start from baseline; the lab adds three tickets: onboarding Alex,
 * transferring Jane, and terminating Bob.
 */
import type { MockDirectory } from '@/services';
import type { MockIdP } from '@/services';
import type { MockAppServer } from '@/services';
import type { MockTicketQueue } from '@/services';
import { applyBaseline } from '../baseline';

export function applyLab02Seed(
  dir: MockDirectory,
  idp: MockIdP,
  apps: MockAppServer,
  tickets: MockTicketQueue,
): void {
  const base = applyBaseline(dir, idp, apps);
  // Find the user IDs we need
  const cara = base.userIds['cara.patel']!;
  const ivy = base.userIds['ivy.park']!;
  const jane = base.userIds['jane.doe']!;
  const bob = base.userIds['bob.sato']!;

  // Onboarding ticket for Alex.
  //
  // relatedUserIds is empty and stays empty: Alex does not exist yet, which
  // is the whole point of an onboarding. The reviewer therefore has to find
  // him by name, so the body states the logon to create rather than leaving
  // the learner to guess a convention — the earlier wording named him only
  // as "Alex Morgan", and a review that cannot identify the subject refuses
  // the ticket however well the work was done.
  tickets.create({
    kind: 'onboarding',
    requesterId: cara,
    subject: 'Onboard Alex Morgan (new Finance hire)',
    body: 'Please provision account alex.morgan (Alex Morgan), add to grp-finance-payroll, and grant Finance Portal access. Start date 2026-09-01.',
    priority: 'normal',
    relatedUserIds: [],
    payload: {
      proposedGroupIds: [base.groupIds['grp-finance-payroll']!],
      proposedRoleIds: [base.roleIds['grp-finance-payroll']!],
      startDate: Date.now(),
    },
  });

  // Transfer ticket for Jane (Finance → Engineering)
  tickets.create({
    kind: 'transfer',
    requesterId: ivy,
    subject: 'Transfer Jane Doe: Finance → Engineering',
    body: 'Jane is moving to the Engineering team. Remove her from grp-finance-analysts. Add her to grp-engineering-dev.',
    priority: 'normal',
    relatedUserIds: [jane],
    payload: { userId: jane, fromDepartment: 'Finance', toDepartment: 'Engineering' },
  });

  // Termination ticket for Bob
  tickets.create({
    kind: 'termination',
    requesterId: cara,
    subject: 'Terminate Bob Sato',
    body: 'Bob is leaving the company effective 2026-09-15. Disable account, revoke sessions, remove from all groups.',
    priority: 'high',
    relatedUserIds: [bob],
    payload: { userId: bob, reason: 'voluntary resignation', immediate: false },
  });
}
