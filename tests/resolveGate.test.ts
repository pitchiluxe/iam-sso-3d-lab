/**
 * tests/resolveGate.test.ts — Resolve is a claim the reviewer checks.
 *
 * Three separate paths could close a ticket: the card button, "Resolve all",
 * and the R shortcut. Each carried its own copy of the same six lines, so a
 * check added to one was walked around by the other two — which is how the
 * console arrived at a state where pressing Resolve on an untouched queue
 * cleared the board and raised the counter.
 *
 * Two things are asserted. First that the reviewer actually refuses work that
 * did not happen, and passes it once it has. Second, at the source level, that
 * queue.resolve() is reached from exactly one place — because the gate is only
 * a gate while that stays true, and nothing else in the type system says so.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { reviewTicket } from '@/conductor/ticketReview';
import { MockDirectory } from '@/services/mockDirectory';
import { MockAuditLog } from '@/services/mockAuditLog';
import type { Ticket, TicketId, UserId } from '@/domain';

const SYSTEM = 'system' as UserId;

function fixture() {
  const audit = new MockAuditLog();
  const dir = new MockDirectory(audit);
  return { audit, dir };
}

function ticket(over: Partial<Ticket>): Ticket {
  return {
    id: 't-test' as TicketId,
    kind: 'onboarding',
    priority: 'p2',
    status: 'open',
    subject: 'Test ticket',
    body: 'Body',
    createdAt: Date.now() - 1000,
    comments: [],
    ...over,
  } as Ticket;
}

describe('the reviewer decides whether a ticket really closed', () => {
  it('refuses a ticket whose subject does not exist', () => {
    const { dir, audit } = fixture();
    const review = reviewTicket(ticket({ subject: 'Onboard nobody at all' }), { dir, audit }, SYSTEM);
    expect(review.passed).toBe(false);
    expect(review.checks[0]?.label).toBe('Subject identified');
  });

  it('refuses an onboarding where the account exists but has no access', () => {
    const { dir, audit } = fixture();
    const u = dir.createUser({
      username: 'test.person',
      displayName: 'Test Person',
      email: 'test.person@northwind.example',
      department: 'Finance',
      title: 'Analyst',
      mfa: 'none',
    });
    const review = reviewTicket(
      ticket({ kind: 'onboarding', relatedUserIds: [u.id] }),
      { dir, audit },
      SYSTEM,
    );
    expect(review.passed).toBe(false);
    expect(review.checks.find((c) => c.label === 'Access granted')?.passed).toBe(false);
  });

  it('passes the same ticket once the account is in a group', () => {
    const { dir, audit } = fixture();
    const u = dir.createUser({
      username: 'test.person',
      displayName: 'Test Person',
      email: 'test.person@northwind.example',
      department: 'Finance',
      title: 'Analyst',
      mfa: 'none',
    });
    const g = dir.createGroup('grp-test-access', 'A group to be a member of', SYSTEM);
    dir.addToGroup(u.id, g.id, SYSTEM);
    const review = reviewTicket(
      ticket({ kind: 'onboarding', relatedUserIds: [u.id] }),
      { dir, audit },
      SYSTEM,
    );
    expect(review.passed, review.summary).toBe(true);
  });

  it('will not accept a termination that only disabled the account', () => {
    const { dir, audit } = fixture();
    const u = dir.createUser({
      username: 'leaving.person',
      displayName: 'Leaving Person',
      email: 'leaving.person@northwind.example',
      department: 'Finance',
      title: 'Analyst',
      mfa: 'none',
    });
    const g = dir.createGroup('grp-test-access', 'Access they still hold', SYSTEM);
    dir.addToGroup(u.id, g.id, SYSTEM);
    // Disabled, but still a member — the half of a termination people skip.
    dir.disableUser(u.id, SYSTEM);
    const review = reviewTicket(
      ticket({ kind: 'termination', relatedUserIds: [u.id] }),
      { dir, audit },
      SYSTEM,
    );
    expect(review.passed).toBe(false);
    expect(review.checks.find((c) => c.label === 'Access removed')?.passed).toBe(false);
  });

  it('records every check in the audit log, not only the verdict', () => {
    const { dir, audit } = fixture();
    const before = audit.events.length;
    reviewTicket(ticket({}), { dir, audit }, SYSTEM);
    const written = audit.events.slice(before);
    expect(written.length).toBeGreaterThan(0);
    for (const e of written) {
      expect(['ticket.review.passed', 'ticket.review.failed']).toContain(e.action);
    }
  });
});

describe('the gate has no way round it', () => {
  /** Code with comments removed — a comment that mentions the call is not one. */
  function sourceOf(rel: string): string {
    const text = readFileSync(resolvePath(__dirname, '..', rel), 'utf-8');
    return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  }

  it('calls queue.resolve() from exactly one place in the ticket console', () => {
    const code = sourceOf('src/ui/consoles/ticketConsole.ts');
    const calls = code.match(/queue\.resolve\(/g) ?? [];
    expect(
      calls.length,
      'every resolve path must go through attemptResolve(), or the review is optional',
    ).toBe(1);
  });

  it('runs the review before that call', () => {
    const code = sourceOf('src/ui/consoles/ticketConsole.ts');
    const gate = code.indexOf('reviewTicket(');
    const call = code.indexOf('queue.resolve(');
    expect(gate).toBeGreaterThan(-1);
    expect(gate).toBeLessThan(call);
  });
});
