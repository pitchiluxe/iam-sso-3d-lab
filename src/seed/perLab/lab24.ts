/**
 * seed/perLab/lab24.ts — SaaS License Reclamation & Entitlement Governance.
 *
 * Two license groups, two different failure modes:
 *  - hank.oneill: properly disabled when he left, but nobody removed him
 *    from grp-vpn-users, so the VPN client license is still being billed.
 *  - cara.patel: still active, but hasn't touched the analytics tool in
 *    over 90 days — a dormant seat, not a departed one.
 * Group-based licensing means "still a member" is the only signal billing
 * sees; disabling the account and letting the seat go dormant are two
 * separate failures that both cost money.
 */
import type { MockDirectory } from '@/services';
import type { MockIdP } from '@/services';
import type { MockAppServer } from '@/services';
import { SYSTEM_ACTOR } from '@/domain';
import { applyBaseline } from '../baseline';

export function applyLab24Seed(dir: MockDirectory, idp: MockIdP, apps: MockAppServer): void {
  const base = applyBaseline(dir, idp, apps);

  const hank = base.userIds['hank.oneill']!;
  const vpnUsers = dir.getGroupByName('grp-vpn-users');
  if (vpnUsers) dir.addToGroup(hank, vpnUsers.id, SYSTEM_ACTOR);
  dir.disableUser(hank, SYSTEM_ACTOR, 'Left the company last month');

  const cara = base.userIds['cara.patel']!;
  const analyticsReaders = dir.getGroupByName('grp-analytics-readers');
  if (analyticsReaders) dir.addToGroup(cara, analyticsReaders.id, SYSTEM_ACTOR);
  const caraUser = dir.getUser(cara);
  if (caraUser) caraUser.lastSignInAt = Date.now() - 120 * 24 * 60 * 60 * 1000;
}
