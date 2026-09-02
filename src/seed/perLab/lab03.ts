/**
 * seed/perLab/lab03.ts — RBAC & Least Privilege.
 * Baseline + Finance access request ticket + Bob has standing domain admin.
 */
import type { MockDirectory } from '@/services';
import type { MockIdP } from '@/services';
import type { MockAppServer } from '@/services';
import type { MockTicketQueue } from '@/services';
import { applyBaseline } from '../baseline';
import { SYSTEM_ACTOR, type UserId } from '@/domain';

export function applyLab03Seed(
  dir: MockDirectory,
  idp: MockIdP,
  apps: MockAppServer,
  tickets: MockTicketQueue,
): void {
  const base = applyBaseline(dir, idp, apps);
  const greta = base.userIds['greta.olsen']!;
  const jane  = base.userIds['jane.doe']!;
  const bob   = base.userIds['bob.sato']!;

  // Finance requests payroll access for Jane
  tickets.create({
    kind: 'access-request',
    requesterId: greta,
    subject: 'Request payroll access for Jane Doe',
    body: 'Jane needs to view and post payroll entries. Please grant via group, not direct permission.',
    priority: 'normal',
    relatedUserIds: [jane],
    payload: { userId: jane, requestedRoleIds: [base.roleIds['role-finance-payroll-writer'] ?? base.roleIds['grp-finance-payroll']!], justification: 'New financial analyst joining payroll operations' },
  });

  // Fault: Bob has standing domain admin role
  const adminRole = dir.createRole('role-domain-admin', 'Domain admin', ['*:*'], undefined, SYSTEM_ACTOR);
  dir.grantRoleDirect(bob, adminRole.id, SYSTEM_ACTOR);
}
