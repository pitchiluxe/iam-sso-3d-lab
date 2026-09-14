/**
 * seed/perLab/lab21.ts — B2B Guest Access & External Collaboration.
 *
 * One pre-existing guest: Layla Haddad, a Fabrikam Analytics contractor whose
 * 90-day access window ended four months ago. Nobody removed her — she is
 * still active with live group membership and a live session, discoverable
 * through the existing Get-ADUser Title column (no new domain field needed;
 * "expired" is backstory the learner verifies against her still-active
 * status, the same shape lab19 uses for Priya's missed termination).
 */
import type { MockDirectory } from '@/services';
import type { MockIdP } from '@/services';
import type { MockAppServer } from '@/services';
import { SYSTEM_ACTOR } from '@/domain';
import { PARTNER_COMPANY } from '@/config';
import { applyBaseline } from '../baseline';

export function applyLab21Seed(dir: MockDirectory, idp: MockIdP, apps: MockAppServer): void {
  applyBaseline(dir, idp, apps);

  const readers = dir.getGroupByName('grp-analytics-readers');
  dir.ensureUser(
    {
      username: 'layla.haddad',
      displayName: 'Layla Haddad',
      email: `layla.haddad@${PARTNER_COMPANY.domain}`,
      department: `External — ${PARTNER_COMPANY.name}`,
      title: 'Guest — sponsored by Greta Olsen, access expired 2026-05-01',
      mfa: 'none',
      groupIds: readers ? [readers.id] : [],
    },
    SYSTEM_ACTOR,
  );

  // Matches the ${username}123 convention every seeded credential uses, so
  // "Verify Authentication" in the IAM Console works for her like anyone else.
  idp.seedPasswords({ 'layla.haddad': 'layla.haddad123' });
  idp.signIn('layla.haddad', 'layla.haddad123');
}
