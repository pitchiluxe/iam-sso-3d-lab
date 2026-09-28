/**
 * tests/queueStoryMatchesWorld.test.ts — a queue ticket's story is true
 * when the queue starts.
 *
 * Working the 20-ticket queue by hand found five tickets whose world did not
 * back their text: remove svc-deploy from grp-domain-admins (not a member),
 * remove Sam Nguyen from two groups (in none), revoke sessions (none open),
 * a terminated account that was still active, OAuth tokens that did not
 * exist. A learner following such a ticket gets "is not a member" or
 * "Revoked 0 sessions" and cannot tell whether they or the ticket is wrong.
 *
 * Each ticket body is read the way a learner reads it, and every claim is
 * checked against the estate its registered seed built.
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
import { BATCH_TEMPLATES } from '@/labs/generated/templates';

function start(bt: (typeof BATCH_TEMPLATES)[number]) {
  const audit = new MockAuditLog(createEventBus());
  const dir = new MockDirectory(audit);
  const idp = new MockIdP(audit, dir);
  const oauthGrants = new MockOAuthGrants(audit);
  const tickets = new MockTicketQueue(audit);
  const ids = Array.from({ length: bt.ticketCount }, (_, i) => `${bt.id}-${i}`);
  const lab = bt.buildLab({ narrative: 'n', coachingQuestion: 'q' }, ids);
  getSeed(bt.id)({
    audit,
    dir,
    idp,
    apps: new MockAppServer(dir, idp, audit),
    tickets,
    reviews: new MockAccessReviews(audit),
    incidents: new MockIncidents(),
    oauthGrants,
    cloudRoles: new MockCloudRoles(audit),
    _currentLab: lab,
  } as unknown as SeedContext);
  return { dir, idp, oauthGrants, tickets };
}

describe('every queue ticket tells the truth about the estate', () => {
  for (const bt of BATCH_TEMPLATES) {
    it(bt.id, () => {
      const w = start(bt);
      const lies: string[] = [];
      for (const t of w.tickets.list()) {
        const text = t.body;
        const who = t.relatedUserIds.map((id) => w.dir.getUser(id)).filter((u) => !!u);
        const label = `"${t.subject}"`;

        // "Remove X from grp-a, grp-b" / "remove that membership (grp-a)" —
        // every group it names for removal must hold the subject.
        const removal = /\bremove\b([^.]*)/gi;
        for (const m of text.matchAll(removal)) {
          const clause = m[1] ?? '';
          if (/\badd\b/i.test(clause)) continue;
          for (const g of clause.match(/grp-[a-z0-9-]+/g) ?? []) {
            const group = w.dir.getGroupByName(g);
            for (const u of who) {
              if (group && !group.memberIds.includes(u.id))
                lies.push(`${label}: says remove ${u.username} from ${g}, who is not a member`);
            }
          }
        }

        // "Add X to grp" — must not already be a member (ADUC refuses).
        for (const m of text.matchAll(/\badd (?:her|him|them|[a-z.]+) to (grp-[a-z0-9-]+)/gi)) {
          const group = w.dir.getGroupByName(m[1]!);
          for (const u of who) {
            if (group?.memberIds.includes(u.id))
              lies.push(`${label}: says add ${u.username} to ${m[1]}, already a member`);
          }
        }

        // "Revoke ... sessions" — there must be one to revoke.
        if (/revoke (?:all |the |her |his |its )*(?:active )?sessions?/i.test(text)) {
          for (const u of who) {
            if (w.idp.listSessions(u.id).length === 0)
              lies.push(`${label}: says revoke ${u.username}'s sessions, and there are none`);
          }
        }

        // "OAuth tokens belonging to X" — the grants must exist.
        if (/oauth tokens/i.test(text)) {
          for (const u of who) {
            if (
              !w.oauthGrants.list().some((g) => g.grantedByUserId === u.id && g.status === 'active')
            )
              lies.push(`${label}: talks about ${u.username}'s OAuth tokens, and there are none`);
          }
        }

        // "the account is locked out" / "terminated" — the state must match.
        if (/account is locked out|is locked out/i.test(text)) {
          for (const u of who)
            if (u.status !== 'locked')
              lies.push(`${label}: says ${u.username} is locked out; it is ${u.status}`);
        }
        if (/was terminated/i.test(text)) {
          for (const u of who)
            if (u.status !== 'disabled')
              lies.push(`${label}: says ${u.username} was terminated; it is ${u.status}`);
        }
      }
      expect(lies).toEqual([]);
    });
  }
});
