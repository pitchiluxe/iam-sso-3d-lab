/**
 * seed/perLab/lab26.ts — Active Directory Attack-Path Review.
 * Plain baseline. The attack path this lab finds is not injected — it is
 * the directory's own default shape: dan.rivera's help-desk tier can reset
 * any user's password, including hank.oneill's, who holds standing
 * role-domain-admins. Nobody had to misconfigure anything for a one-hop
 * password reset to equal full domain compromise; that is the point.
 */
import type { MockDirectory } from '@/services';
import type { MockIdP } from '@/services';
import type { MockAppServer } from '@/services';
import { applyBaseline } from '../baseline';

export function applyLab26Seed(dir: MockDirectory, idp: MockIdP, apps: MockAppServer): void {
  applyBaseline(dir, idp, apps);
}
