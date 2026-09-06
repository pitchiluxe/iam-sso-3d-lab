/**
 * tests/ticketAccuracy.test.ts
 *
 * A ticket the learner cannot action against the IAM Console teaches nothing.
 * Two ways that happens:
 *
 *   1. The ticket names an account that does not exist in the directory, so
 *      there is nothing to select in the console.
 *   2. The ticket's payload points at whoever *filed* it rather than whoever
 *      it is *about*, so resolving it would act on the wrong person.
 */
import { describe, it, expect } from 'vitest';
import {
  MockAuditLog,
  MockDirectory,
  MockIdP,
  MockAppServer,
  MockTicketQueue,
  MockAccessReviews,
  MockIncidents,
} from '@/services';
import { BATCH_TEMPLATES } from '@/labs/generated/templates';
import type { SeedContext } from '@/conductor/conductor';

function freshCtx(): SeedContext & { dir: MockDirectory; tickets: MockTicketQueue } {
  const audit = new MockAuditLog();
  const dir = new MockDirectory(audit);
  const idp = new MockIdP(audit, dir);
  const apps = new MockAppServer(dir, idp, audit);
  const tickets = new MockTicketQueue(audit);
  return {
    dir,
    idp,
    apps,
    tickets,
    audit,
    reviews: new MockAccessReviews(),
    incidents: new MockIncidents(),
  } as never;
}

/** Account-shaped tokens in ticket prose: `svc-backup`, `jane.doe`. Excludes
 *  email domains, group names and app hostnames, which are not accounts. */
function accountTokens(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(/\bsvc-[a-z0-9-]+\b/g)) found.add(m[0]);
  for (const m of text.matchAll(/\b[a-z]+\.[a-z]+\b/g)) {
    const t = m[0];
    if (t.endsWith('.example') || t.endsWith('.com') || t.endsWith('.net')) continue;
    if (t.startsWith('grp-') || t.startsWith('role-')) continue;
    found.add(t);
  }
  return [...found];
}

describe('generated batch tickets reference real directory accounts', () => {
  for (const template of BATCH_TEMPLATES) {
    it(`${template.id}: every account named in a ticket exists in the directory`, () => {
      const ctx = freshCtx();
      const ids = Array.from(
        { length: template.ticketCount },
        (_, i) => `${template.id}-${String(i + 1).padStart(3, '0')}`,
      );
      template.seed(ctx as never, ids as never);

      const known = new Set([
        ...ctx.dir.listUsers().map((u) => u.username.toLowerCase()),
        ...ctx.dir.listGroups().map((g) => g.name.toLowerCase()),
      ]);

      const dangling: string[] = [];
      for (const t of ctx.tickets.list()) {
        // An onboarding ticket names the account the learner is being asked to
        // CREATE, so it is correct for that account not to exist yet.
        if (t.kind === 'onboarding') continue;
        for (const token of accountTokens(`${t.subject} ${t.body}`)) {
          // Only account-shaped tokens that look like OUR namespace matter:
          // svc-* accounts and first.last usernames.
          const isSvc = token.startsWith('svc-');
          const isPersonHandle = /^[a-z]+\.[a-z]+$/.test(token);
          if (!isSvc && !isPersonHandle) continue;
          if (!known.has(token)) dangling.push(`${t.subject} → ${token}`);
        }
      }
      expect(dangling).toEqual([]);
    });

    it(`${template.id}: every ticket links to the account it is about`, () => {
      const ctx = freshCtx();
      const ids = Array.from(
        { length: template.ticketCount },
        (_, i) => `${template.id}-${String(i + 1).padStart(3, '0')}`,
      );
      template.seed(ctx as never, ids as never);

      const unlinked = ctx.tickets
        .list()
        .filter((t) => t.relatedUserIds.length === 0)
        .map((t) => t.subject);
      // Onboarding and bulk-provisioning tickets are about people who do not
      // exist yet — that is the point of the ticket — so they are exempt.
      const shouldLink = unlinked.filter(
        (s) => !/onboard|bulk hire|bulk provisioning|new users/i.test(s),
      );
      expect(shouldLink).toEqual([]);
    });
  }
});
