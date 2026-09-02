/**
 * seed/perLab/lab10.ts — Capstone.
 * Fresh baseline + onboarding/mover/termination tickets + an SSO fault + a
 * suspicious signin. The lab runs the full lifecycle end-to-end.
 */
import type { UserId } from '@/domain';
import type { MockDirectory } from '@/services';
import type { MockIdP } from '@/services';
import type { MockAppServer } from '@/services';
import type { MockTicketQueue } from '@/services';
import { applyBaseline } from '../baseline';

export function applyLab10Seed(
  dir: MockDirectory,
  idp: MockIdP,
  apps: MockAppServer,
  tickets: MockTicketQueue,
): void {
  const base = applyBaseline(dir, idp, apps);
  const cara = base.userIds['cara.patel']!;
  const ivy  = base.userIds['ivy.park']!;

  // 5 onboarding tickets
  const newHires = ['nina.king', 'oscar.lin', 'paul.weber', 'quinn.davis', 'rita.frost'];
  for (const u of newHires) {
    const user = dir.createUser({
      username:    u,
      displayName: u.replace('.', ' '),
      email:       `${u}@northwind.example`,
      department:  'Finance',
      title:       'New Hire',
      mfa:         'none',
    }, 'system' as UserId);
    tickets.create({
      kind: 'onboarding',
      requesterId: cara,
      subject: `Onboard ${user.displayName}`,
      body: 'Provision account and grant payroll access.',
      priority: 'normal',
      relatedUserIds: [user.id],
      payload: {
        proposedGroupIds: [base.groupIds['grp-finance-payroll']!],
        proposedRoleIds:  [base.roleIds['grp-finance-payroll']!],
        startDate: Date.now(),
      },
    });
  }

  // 2 movers
  tickets.create({
    kind: 'transfer',
    requesterId: ivy,
    subject: 'Move Jane Doe to Engineering',
    body: 'Jane is moving teams. Remove Finance access, add Engineering.',
    priority: 'normal',
    relatedUserIds: [base.userIds['jane.doe']!],
    payload: { userId: base.userIds['jane.doe']!, fromDepartment: 'Finance', toDepartment: 'Engineering' },
  });
  tickets.create({
    kind: 'transfer',
    requesterId: ivy,
    subject: 'Move Alex Morgan to HR',
    body: 'Alex is moving to HR. Update groups accordingly.',
    priority: 'normal',
    relatedUserIds: [base.userIds['alex.morgan']!],
    payload: { userId: base.userIds['alex.morgan']!, fromDepartment: 'Finance', toDepartment: 'HR' },
  });

  // 1 termination
  tickets.create({
    kind: 'termination',
    requesterId: cara,
    subject: 'Terminate Bob Sato',
    body: 'Voluntary resignation effective immediately.',
    priority: 'urgent',
    relatedUserIds: [base.userIds['bob.sato']!],
    payload: { userId: base.userIds['bob.sato']!, reason: 'resignation', immediate: true },
  });
}
