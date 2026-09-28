/**
 * tests/seedMemberships.test.ts — every lab starts with memberships that
 * both sides agree on.
 *
 * The multi-ticket queues applied the baseline twice; the second pass
 * re-created every group empty while each user kept the group in its own
 * list. The queue then asked the learner to remove svc-deploy from
 * grp-domain-admins while grp-domain-admins listed nobody. Seeds are run here
 * exactly as the conductor runs them — through the registry — because the
 * templates' own seed() on its own never showed the problem.
 */
import { describe, it, expect } from 'vitest';
import { MockAuditLog } from '@/services/mockAuditLog';
import { MockDirectory } from '@/services/mockDirectory';
import { MockIdP } from '@/services/mockIdP';
import { MockAppServer } from '@/services/mockAppServer';
import { MockTicketQueue } from '@/services/mockTicketQueue';
import { MockAccessReviews } from '@/services/mockAccessReviews';
import { MockIncidents } from '@/services/mockIncidents';
import { MockOAuthGrants } from '@/services/mockOAuthGrants';
import { MockCloudRoles } from '@/services/mockCloudRoles';
import { createEventBus } from '@/util/events';
import { getSeed, type SeedContext } from '@/conductor/seedRegistry';
import { BATCH_TEMPLATES, LAB_TEMPLATES } from '@/labs/generated/templates';
import type { Lab } from '@/domain';

function seeded(key: string, lab?: Lab): MockDirectory {
  const audit = new MockAuditLog(createEventBus());
  const dir = new MockDirectory(audit);
  const idp = new MockIdP(audit, dir);
  const ctx = {
    audit,
    dir,
    idp,
    apps: new MockAppServer(dir, idp, audit),
    tickets: new MockTicketQueue(audit),
    reviews: new MockAccessReviews(audit),
    incidents: new MockIncidents(),
    oauthGrants: new MockOAuthGrants(audit),
    cloudRoles: new MockCloudRoles(audit),
    ...(lab ? { _currentLab: lab } : {}),
  } as unknown as SeedContext;
  getSeed(key)(ctx);
  return dir;
}

function oneSided(dir: MockDirectory): string[] {
  const out: string[] = [];
  for (const u of dir.listUsers()) {
    for (const gid of u.groupIds) {
      const g = dir.getGroup(gid);
      if (g && !g.memberIds.includes(u.id)) out.push(`${u.username} thinks it is in ${g.name}`);
    }
  }
  for (const g of dir.listGroups()) {
    for (const uid of g.memberIds) {
      const u = dir.getUser(uid);
      if (u && !u.groupIds.includes(g.id)) out.push(`${g.name} lists ${u.username}`);
    }
  }
  return out;
}

describe('memberships are two-sided when a lab starts', () => {
  const keys = [
    ...Array.from({ length: 17 }, (_, i) => `lab${String(i + 1).padStart(2, '0')}`),
    ...LAB_TEMPLATES.map((t) => t.id),
  ];
  for (const key of keys) {
    it(key, () => {
      const dir = seeded(key);
      expect(oneSided(dir)).toEqual([]);
      // The baseline's own memberships are there, on both sides.
      const hank = dir.getUserByUsername('hank.oneill');
      if (hank)
        expect(dir.getGroupByName('grp-domain-admins')!.memberIds.length).toBeGreaterThan(0);
    });
  }
  for (const bt of BATCH_TEMPLATES) {
    it(bt.id, () => {
      const lab = bt.buildLab(
        { narrative: 'n', coachingQuestion: 'q' },
        Array.from({ length: bt.ticketCount }, (_, i) => `t${i}`),
      );
      const dir = seeded(bt.id, lab);
      expect(oneSided(dir)).toEqual([]);
      expect(dir.getGroupByName('grp-domain-admins')!.memberIds.length).toBeGreaterThan(0);
    });
  }
});
