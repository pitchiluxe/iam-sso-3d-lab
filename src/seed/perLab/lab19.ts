/**
 * seed/perLab/lab19.ts — SCIM Provisioning at Scale.
 *
 * Two people beyond baseline:
 *  - sam.oduya: a former contractor from eighteen months ago, still on file,
 *    dormant. This quarter's HR feed happens to onboard a different, unrelated
 *    person with the same name — the soft-match conflict s2 has to resolve
 *    without touching the old record.
 *  - priya.fernandes: HR marked her terminated six weeks ago, but the SCIM
 *    deprovisioning feed silently dropped the event, so she is still active
 *    with live group membership and a live session (mirrors the pattern
 *    lab02 uses for Bob: a session actually exists to revoke in s5).
 */
import type { MockDirectory } from '@/services';
import type { MockIdP } from '@/services';
import type { MockAppServer } from '@/services';
import { SYSTEM_ACTOR } from '@/domain';
import { applyBaseline } from '../baseline';

export function applyLab19Seed(dir: MockDirectory, idp: MockIdP, apps: MockAppServer): void {
  applyBaseline(dir, idp, apps);

  dir.ensureUser(
    {
      username: 'sam.oduya',
      displayName: 'Sam Oduya',
      email: 'sam.oduya@northwind.example',
      department: 'Engineering',
      title: 'Former Contractor',
      mfa: 'none',
    },
    SYSTEM_ACTOR,
  );
  const stale = dir.getUserByUsername('sam.oduya');
  if (stale) stale.lastSignInAt = Date.now() - 540 * 24 * 60 * 60 * 1000;

  const engDev = dir.getGroupByName('grp-engineering-dev');
  dir.ensureUser(
    {
      username: 'priya.fernandes',
      displayName: 'Priya Fernandes',
      email: 'priya.fernandes@northwind.example',
      department: 'Engineering',
      title: 'Software Engineer',
      mfa: 'none',
      groupIds: engDev ? [engDev.id] : [],
    },
    SYSTEM_ACTOR,
  );
  // Matches the ${username}123 convention every seeded credential uses, so
  // "Verify Authentication" in the IAM Console works for her like anyone else.
  idp.seedPasswords({ 'priya.fernandes': 'priya.fernandes123' });
  idp.signIn('priya.fernandes', 'priya.fernandes123');
}
