/**
 * conductor/ticketReview.ts — checking that a resolved ticket was resolved.
 *
 * Marking a ticket resolved is a claim. Before this existed the claim was
 * simply believed: a learner could press Resolve on every ticket in the queue
 * without touching the directory, watch the counter go up, and finish with a
 * clean board and an untouched estate. A lab that accepts that teaches the one
 * habit this whole product exists to remove.
 *
 * So the checks run first and decide. Each is a real property of the
 * directory, the audit log or the application server — the same evidence an
 * auditor would ask for — and a refusal names what is still outstanding rather
 * than only saying no. The point is for the learner to go and finish the work.
 *
 * The checks are deterministic and stay that way. A language model can write
 * the prose afterwards; it never decides pass or fail, because a reviewer that
 * approves work which did not happen is worse than no reviewer, and a learner
 * told they did it right when they did not has been actively taught the wrong
 * lesson.
 */
import type { AuditEvent, Ticket, UserId } from '@/domain';
import type { MockDirectory } from '@/services/mockDirectory';
import type { MockAuditLog } from '@/services/mockAuditLog';
import type { MockIdP } from '@/services/mockIdP';
import type { MockAppServer } from '@/services/mockAppServer';

/**
 * Who has already used a given audit event as proof.
 *
 * Structural on purpose: MockTicketQueue satisfies it without importing
 * anything from the conductor, and a caller with no ledger (a test, the
 * evidence pack) simply omits it and every event stays available.
 */
export interface EvidenceLedger {
  /** The ticket that already counted this event, if any. */
  claimedBy(eventId: string): string | undefined;
  /** Record that these events were what closed this ticket. */
  claimEvidence(eventIds: string[], ticketId: string): void;
}

export interface ReviewDeps {
  dir: MockDirectory;
  audit: MockAuditLog;
  idp?: MockIdP;
  apps?: MockAppServer;
  /** Omit to let every ticket count every event. */
  ledger?: EvidenceLedger;
}

/** One thing that was checked, and what was found. */
export interface ReviewCheck {
  label: string;
  passed: boolean;
  /** What was observed — the evidence, not the expectation. */
  detail: string;
}

export interface TicketReview {
  ticketId: string;
  passed: boolean;
  checks: ReviewCheck[];
  summary: string;
  at: number;
  /**
   * The audit events the checks counted. Claimed on a pass, so a second
   * ticket about the same person cannot be closed by the same piece of work.
   */
  usedEventIds: string[];
}

const pass = (label: string, detail: string): ReviewCheck => ({ label, passed: true, detail });
const fail = (label: string, detail: string): ReviewCheck => ({ label, passed: false, detail });

/**
 * The account named in the ticket's payload, where the kind carries one.
 *
 * onboarding is the exception and carries no userId at all — it proposes
 * groups for somebody who does not exist yet — so it falls through to the
 * text, which is the only place the person is named.
 */
function payloadSubject(ticket: Ticket): UserId | undefined {
  const p = ticket.payload as { userId?: UserId; affectedUserId?: UserId } | undefined;
  return p?.userId ?? p?.affectedUserId;
}

/**
 * The accounts a ticket is about.
 *
 * Three sources, in order of how directly they say it: relatedUserIds, then
 * the payload's subject, then the names in the text.
 *
 * The last of those is not a nicety. A ticket reads "Onboard Alex Morgan" —
 * a display name, because that is how a person filing a ticket writes it,
 * and for an onboarding there is no account to point at yet. Matching only
 * logons meant such a ticket named nobody the reviewer could find, so it was
 * refused with "this ticket names no account" no matter how correctly the
 * learner had done the work. Two of the labs shipped exactly that ticket.
 *
 * The subject line wins over the body: the body mentions managers,
 * requesters and colleagues, and reviewing the wrong person's account is
 * worse than reviewing none.
 */
function subjectsOf(ticket: Ticket, dir: MockDirectory) {
  const byId = (ticket.relatedUserIds ?? [])
    .map((id) => dir.getUser(id))
    .filter((u): u is NonNullable<typeof u> => Boolean(u));
  if (byId.length > 0) return byId;

  const fromPayload = payloadSubject(ticket);
  if (fromPayload) {
    const u = dir.getUser(fromPayload);
    if (u) return [u];
  }

  const users = dir.listUsers();
  const named = (haystack: string) => {
    const hay = haystack.toLowerCase();
    return users.filter(
      (u) => hay.includes(u.username.toLowerCase()) || hay.includes(u.displayName.toLowerCase()),
    );
  };
  const inSubject = named(ticket.subject);
  return inSubject.length > 0 ? inSubject : named(ticket.body);
}

/**
 * The events this ticket is allowed to count: after it was raised, and not
 * already spent closing a different ticket.
 */
function evidenceFor(ticket: Ticket, deps: ReviewDeps) {
  return deps.audit.events.filter((e) => {
    if (e.at < ticket.createdAt) return false;
    const owner = deps.ledger?.claimedBy(e.id);
    return owner === undefined || owner === ticket.id;
  });
}

/** Access granted or removed for this account since the ticket was raised. */
function accessChangedSince(events: AuditEvent[], userId: UserId) {
  const kinds = new Set(['group.add', 'group.remove', 'role.grant', 'role.revoke']);
  return events.filter((e) => kinds.has(e.action) && e.subjectId === userId);
}

/**
 * Work an operator did, as opposed to what the incident did.
 *
 * A sign-in failure is the symptom being reported, not a response to it, so
 * counting any event at all let a queue of incident tickets close themselves
 * on the strength of the attack they described.
 */
const REMEDIATION = new Set([
  'user.disabled',
  'user.unlocked',
  'user.updated',
  'group.add',
  'group.remove',
  'role.grant',
  'role.revoke',
  'password.reset',
  'account.unlock',
  'user.moved',
  'mfa.reset',
  'session.revoked',
  'policy.updated',
  'app.config.changed',
]);

function runChecks(
  ticket: Ticket,
  deps: ReviewDeps,
  countedEventIds: string[] = [],
): ReviewCheck[] {
  const { dir } = deps;
  const subjects = subjectsOf(ticket, dir);
  const checks: ReviewCheck[] = [];
  // Everything below reads this list rather than the whole audit log.
  const evidence = evidenceFor(ticket, deps);
  /**
   * What a check leaned on, and no more.
   *
   * Claiming every matching event starved the rest of the queue: Cara Patel
   * has four tickets that each need a password reset, four resets were done,
   * and the first ticket reviewed claimed all four. A check needs one piece
   * of evidence to pass, so it spends one.
   */
  const used = (events: AuditEvent[]) => (events[0] ? [events[0].id as string] : []);
  const counted: string[] = [];

  if (subjects.length === 0) {
    return [
      fail(
        'Subject identified',
        'This ticket names no account that exists in the directory. If the task was to ' +
          'create somebody, create them; if you did the work on somebody else, the ticket ' +
          'did not record who.',
      ),
    ];
  }

  for (const user of subjects) {
    const groups = dir.listGroups().filter((g) => g.memberIds.includes(user.id));

    switch (ticket.kind) {
      case 'onboarding': {
        checks.push(
          user.status === 'active'
            ? pass('Account is usable', `${user.username} exists and is enabled.`)
            : fail('Account is usable', `${user.username} exists but is ${user.status}.`),
        );
        // Being in a group is not enough on its own: some queues raise an
        // onboarding ticket for somebody the seed already placed, and the
        // ticket then closed itself. The grant has to be this ticket's.
        const grants = accessChangedSince(evidence, user.id).filter(
          (e) => e.action === 'group.add' || e.action === 'role.grant',
        );
        const granted = grants.length > 0;
        counted.push(...used(grants));
        checks.push(
          groups.length > 0 && granted
            ? pass('Access granted', `Member of ${groups.map((g) => g.name).join(', ')}.`)
            : groups.length === 0
              ? fail(
                  'Access granted',
                  `${user.username} is in no groups. An account with no access is not an ` +
                    'onboarded person.',
                )
              : fail(
                  'Access granted',
                  `${user.username} is in ${groups.map((g) => g.name).join(', ')}, but none of ` +
                    'it was granted since this ticket was raised. Check the ticket names the ' +
                    'right person, and grant what it actually asks for.',
                ),
        );
        break;
      }

      case 'transfer':
      case 'mover': {
        const additions = evidence.filter(
          (e) => e.action === 'group.add' && e.subjectId === user.id,
        );
        const removals = evidence.filter(
          (e) => e.action === 'group.remove' && e.subjectId === user.id,
        );
        const added = additions.length > 0;
        const removed = removals.length > 0;
        counted.push(...used(additions), ...used(removals));
        checks.push(
          added
            ? pass(
                'New access granted',
                `Now in ${groups.map((g) => g.name).join(', ') || 'no groups'}.`,
              )
            : fail('New access granted', 'No group was added for this account.'),
        );
        checks.push(
          removed
            ? pass('Old access removed', 'A group removal is recorded for this account.')
            : fail(
                'Old access removed',
                'Nothing was removed. This is the half of a transfer people skip, and it is ' +
                  'how privilege accumulates.',
              ),
        );
        break;
      }

      case 'leaver':
      case 'termination': {
        checks.push(
          user.status === 'disabled'
            ? pass('Account disabled', `${user.username} is disabled.`)
            : fail('Account disabled', `${user.username} is still ${user.status}.`),
        );
        checks.push(
          groups.length === 0
            ? pass('Access removed', 'The account is in no groups.')
            : fail(
                'Access removed',
                `Still a member of ${groups.map((g) => g.name).join(', ')}. Disabling an ` +
                  'account does not remove what it can reach if it is re-enabled.',
              ),
        );
        break;
      }

      case 'password-reset': {
        const resets = evidence.filter(
          (e) =>
            (e.action === 'password.reset' ||
              e.action === 'account.unlock' ||
              e.action === 'user.unlocked') &&
            (e.targetId === user.id || e.subjectId === user.id),
        );
        const reset = resets.length > 0;
        counted.push(...used(resets));
        checks.push(
          reset
            ? pass('Credential seen to', 'A reset or unlock is recorded for this account.')
            : fail(
                'Credential seen to',
                'No reset or unlock appears in the audit log since this ticket was raised.',
              ),
        );
        checks.push(
          user.status !== 'locked'
            ? pass('Account is not locked', `${user.username} is ${user.status}.`)
            : fail(
                'Account is not locked',
                'The account is still locked out. A password reset does not clear a lockout.',
              ),
        );
        break;
      }

      case 'mfa-issue': {
        const clearances = evidence.filter(
          (e) => e.action === 'mfa.reset' && e.targetId === user.id,
        );
        const cleared = clearances.length > 0;
        counted.push(...used(clearances));
        checks.push(
          cleared
            ? pass('Registration cleared', 'An MFA reset is recorded for this account.')
            : fail('Registration cleared', 'No MFA reset appears since this ticket was raised.'),
        );
        checks.push(
          user.mfa !== 'none'
            ? pass('A second factor is in place', `${user.username} is enrolled for ${user.mfa}.`)
            : fail(
                'A second factor is in place',
                'Clearing the old registration and stopping there leaves the account weaker ' +
                  'than before the ticket.',
              ),
        );
        break;
      }

      case 'access-request': {
        // An access request is answered by a change, not by a state. Half the
        // seeded requests are about people who are already in several groups,
        // so "is a member of something" was true before the ticket existed
        // and the ticket closed itself.
        //
        // Removals count as well as grants: "remove Finn from grp-legacy-hr"
        // is filed as an access request too, and refusing it for not adding
        // anything would be refusing the work that was asked for.
        const changes = accessChangedSince(evidence, user.id);
        counted.push(...used(changes));
        checks.push(
          changes.length > 0
            ? pass(
                'Access was changed',
                `${changes.length} membership change${changes.length > 1 ? 's' : ''} recorded ` +
                  `for ${user.username}. Now in ${groups.map((g) => g.name).join(', ') || 'no groups'}.`,
              )
            : fail(
                'Access was changed',
                `Nothing was granted to or removed from ${user.username} since this ticket was ` +
                  'raised. Whatever they already had is what they had yesterday.',
              ),
        );
        break;
      }

      case 'incident': {
        const responses = evidence.filter(
          (e) => REMEDIATION.has(e.action) && (e.targetId === user.id || e.subjectId === user.id),
        );
        counted.push(...used(responses));
        checks.push(
          responses.length > 0
            ? pass(
                'The account was acted on',
                `${[...new Set(responses.map((e) => e.action))].join(', ')} recorded for ` +
                  `${user.username}.`,
              )
            : fail(
                'The account was acted on',
                'Nothing was done to this account since the ticket was raised. Failed sign-ins ' +
                  'are what was reported, not what was done about it.',
              ),
        );
        break;
      }
    }
  }

  countedEventIds.length = 0;
  countedEventIds.push(...counted);
  return checks;
}

/** The written verdict. Plain, and derived from the checks. */
function summarise(checks: ReviewCheck[]): string {
  const failed = checks.filter((c) => !c.passed);
  if (failed.length === 0) {
    return 'Every check passed. The work the ticket asked for is visible in the directory.';
  }
  return [
    `${failed.length} of ${checks.length} checks did not pass.`,
    ...failed.map((c) => `· ${c.label}: ${c.detail}`),
  ].join('\n');
}

/**
 * Review a ticket, and write every check to the audit log.
 *
 * Each check individually, not just the verdict: a reviewer that says "failed"
 * without saying what it looked at is asking to be taken on trust, which is
 * the opposite of what this teaches.
 */
export function reviewTicket(ticket: Ticket, deps: ReviewDeps, actor: UserId): TicketReview {
  const usedEventIds: string[] = [];
  const checks = runChecks(ticket, deps, usedEventIds);
  const passed = checks.every((c) => c.passed);

  for (const check of checks) {
    deps.audit.record({
      actorId: actor,
      action: check.passed ? 'ticket.review.passed' : 'ticket.review.failed',
      targetId: ticket.id,
      note: `${check.label} — ${check.detail}`,
    });
  }

  return {
    ticketId: ticket.id,
    passed,
    checks,
    summary: summarise(checks),
    at: Date.now(),
    usedEventIds,
  };
}
