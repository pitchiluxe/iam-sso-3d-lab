/**
 * tests/scenarioEvidence.test.ts
 *
 * A ticket that describes evidence the simulation never produced sends the
 * learner looking for something that does not exist. Reported case: a ticket
 * asked for an account to be dealt with "after several failed sign-in
 * attempts", and the audit log held no failures at all.
 *
 * These assert the world matches what the tickets claim about it:
 *   - a ticket describing failed sign-ins must have signin.failure events
 *   - a ticket describing a locked account must have that account locked
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
import type { Ticket } from '@/domain';

function seedTemplate(template: (typeof BATCH_TEMPLATES)[number]) {
  const audit = new MockAuditLog();
  const dir = new MockDirectory(audit);
  const idp = new MockIdP(audit, dir);
  const apps = new MockAppServer(dir, idp, audit);
  const tickets = new MockTicketQueue(audit);
  const ctx = {
    dir,
    idp,
    apps,
    tickets,
    audit,
    reviews: new MockAccessReviews(),
    incidents: new MockIncidents(),
  };
  const ids = Array.from(
    { length: template.ticketCount },
    (_, i) => `${template.id}-${String(i + 1).padStart(3, '0')}`,
  );
  template.seed(ctx as never, ids as never);
  return { dir, audit, tickets };
}

const text = (t: Ticket): string => `${t.subject} ${t.body}`;

/** Ticket prose that promises failed sign-in attempts in the log. */
const DESCRIBES_FAILURES = /failed (login|logon|sign-?in|attempt)|brute[- ]force|credential stuffing/i;

/** Ticket prose that says the account is currently locked out. */
const DESCRIBES_LOCKOUT = /\block(ed|out)\b/i;

describe('scenario evidence matches the ticket', () => {
  for (const template of BATCH_TEMPLATES) {
    it(`${template.id}: tickets citing failed sign-ins have them in the audit log`, () => {
      const { audit, tickets } = seedTemplate(template);
      const failures = audit.byAction('signin.failure');

      const unsupported = tickets
        .list()
        .filter((t) => DESCRIBES_FAILURES.test(text(t)))
        .filter((t) => {
          // At least one failure must reference the account the ticket is about.
          const subjectIds = t.relatedUserIds;
          if (subjectIds.length === 0) return failures.length === 0;
          return !failures.some(
            (e) => subjectIds.includes(e.targetId as never) || subjectIds.includes(e.actorId),
          );
        })
        .map((t) => t.subject);

      expect(unsupported).toEqual([]);
    });

    it(`${template.id}: tickets citing a lockout have the account locked`, () => {
      const { dir, tickets } = seedTemplate(template);

      const wrong = tickets
        .list()
        .filter((t) => DESCRIBES_LOCKOUT.test(text(t)) && t.relatedUserIds.length > 0)
        .filter((t) => {
          const u = dir.getUser(t.relatedUserIds[0]!);
          // 'locked' specifically — a disabled account is a different state
          // with a different remedy, and Unlock-ADAccount refuses it.
          return u?.status !== 'locked';
        })
        .map((t) => t.subject);

      expect(wrong).toEqual([]);
    });
  }
});
