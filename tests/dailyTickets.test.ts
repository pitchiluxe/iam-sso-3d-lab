/**
 * tests/dailyTickets.test.ts — the AI-generated daily tickets, end to end.
 *
 * For every daily-ticket template, exactly as the app runs it:
 *   1. the lab is built and seeded through the registered seed;
 *   2. its ticket is in the Ticket Queue, filed against the right account;
 *   3. the ticket refuses to close before any work is done;
 *   4. each graded step is done the way Active Directory Users and Computers
 *      does it — including its refusals: adding somebody to a group they are
 *      already in, unlocking an account that is not locked, enabling one that
 *      is not disabled — and the step's validator sees it;
 *   5. the ticket then closes.
 * Plus: every stage of the identity lifecycle is covered, and the AI's
 * narrative can only name what the lab actually grades.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { MockAuditLog } from '@/services/mockAuditLog';
import { MockDirectory } from '@/services/mockDirectory';
import { MockIdP } from '@/services/mockIdP';
import { MockAppServer } from '@/services/mockAppServer';
import { MockTicketQueue } from '@/services/mockTicketQueue';
import { MockAccessReviews } from '@/services/mockAccessReviews';
import { MockIncidents } from '@/services/mockIncidents';
import { createEventBus } from '@/util/events';
import { getSeed, type SeedContext } from '@/conductor/seedRegistry';
import { reviewTicket } from '@/conductor/ticketReview';
import {
  IAM_LIFECYCLE_STAGES,
  LAB_TEMPLATES,
  dailyTicketOf,
  type LabTemplate,
} from '@/labs/generated/templates';
import { NAME_POOL } from '@/labs/generated/namePool';
import {
  fallbackFlavor,
  firstSentences,
  flavorPrompt,
  generateFlavor,
  groundedNarrative,
} from '@/services/labFlavorGenerator';
import { mkTicketId, type AuditEvent, type Lab, type UserId } from '@/domain';

const ME = 'player' as UserId;

function world(lab: Lab): SeedContext {
  const audit = new MockAuditLog(createEventBus());
  const dir = new MockDirectory(audit);
  const idp = new MockIdP(audit, dir);
  const apps = new MockAppServer(dir, idp, audit);
  return {
    audit,
    dir,
    idp,
    apps,
    tickets: new MockTicketQueue(audit),
    reviews: new MockAccessReviews(audit),
    incidents: new MockIncidents(),
    _currentLab: lab,
  } as unknown as SeedContext;
}

const build = (t: LabTemplate): Lab => t.buildLab(fallbackFlavor({ ...t }), []);

/** Step kinds done through the UI's evidence capture or automation, proven elsewhere. */
const PROVEN_ELSEWHERE = new Set(['evidence-collected', 'users-provisioned', 'mfa-policy-enforced']);

/**
 * Do one step the way the ADUC view and its snap-ins do it. Returns why it
 * could not be done, or null. Mirrors the refusals in
 * ui/directory/directoryAdapter.ts and services/mockDirectory.ts.
 */
function doStep(w: SeedContext, lab: Lab, step: Lab['steps'][number]): string | null {
  const p = step.validator.params as Record<string, string>;
  const u = p.userId ? w.dir.getUserByUsername(p.userId) : undefined;
  const g = p.groupId ? w.dir.getGroupByName(p.groupId) : undefined;
  switch (step.validator.kind) {
    case 'user-created': {
      if (u) return `${p.userId} already exists`;
      const pool = NAME_POOL.find((n) => n.username === p.userId);
      w.dir.createUser(
        {
          username: p.userId!,
          displayName: pool?.displayName ?? p.userId!,
          email: `${p.userId}@northwind.example`,
          department: 'Engineering',
          title: 'New Hire',
          mfa: 'none',
        },
        ME,
      );
      return null;
    }
    case 'group-added':
      if (!u || !g) return `no ${!u ? p.userId : p.groupId}`;
      if (g.memberIds.includes(u.id)) return `${p.userId} is already a member of ${p.groupId}`;
      w.dir.addToGroup(u.id, g.id, ME);
      return null;
    case 'group-removed':
      if (!u || !g) return `no ${!u ? p.userId : p.groupId}`;
      if (!g.memberIds.includes(u.id)) return `${p.userId} is not in ${p.groupId}`;
      w.dir.removeFromGroup(u.id, g.id, ME);
      return null;
    case 'user-disabled':
      if (!u || u.status === 'disabled') return `${p.userId} missing or already disabled`;
      w.dir.disableUser(u.id, ME);
      return null;
    case 'user-enabled':
      if (!u || u.status !== 'disabled') return `${p.userId} missing or not disabled`;
      w.dir.enableUser(u.id, ME);
      return null;
    case 'account-unlocked':
      if (!u || u.status !== 'locked') return `${p.userId} missing or not locked`;
      w.dir.unlockUser(u.id, ME);
      return null;
    case 'user-deleted':
      if (!u) return `no ${p.userId}`;
      w.dir.deleteUser(u.id, ME);
      return null;
    case 'session-revoked':
      if (!u) return `no ${p.userId}`;
      return w.idp.revokeAllSessions(u.id, ME) > 0 ? null : `${p.userId} has no session to revoke`;
    case 'password-reset':
      if (!u) return `no ${p.userId}`;
      w.idp.resetPassword(u.id, 'Temp#Passw0rd!2026', { forceChangeAtNextLogin: true }, ME);
      return null;
    case 'mfa-reset':
      if (!u) return `no ${p.userId}`;
      w.idp.resetMfa(u.id, ME);
      return null;
    case 'mfa-challenge-completed':
      if (!u) return `no ${p.userId}`;
      w.idp.enrollMfa(u.id, 'totp', ME);
      return null;
    case 'role-revoked': {
      if (!u) return `no ${p.userId}`;
      const name = /role-[a-z-]+/.exec(step.brief)?.[0] ?? '';
      const r = w.dir.getRoleByName(name);
      if (!r) return `the brief names no existing role (${name || 'none'})`;
      w.dir.revokeRoleDirect(u.id, r.id, ME);
      return null;
    }
    case 'signin-succeeded':
      return u && w.idp.signIn(u.username, `${u.username}123`).ok ? null : `${p.userId} cannot sign in`;
    case 'ticket-resolved': {
      // The step is "resolve the ticket": do what the ticket asks, then it is
      // closed below, through the review.
      const t = w.tickets.get(mkTicketId(p.ticketId ?? ''));
      const who = t && w.dir.getUser(t.relatedUserIds[0]!);
      if (!t || !who) return `ticket ${p.ticketId} or its subject is missing`;
      if (t.kind !== 'password-reset') return `no playbook for a ${t.kind} ticket`;
      w.idp.resetPassword(who.id, 'Temp#Passw0rd!2026', { forceChangeAtNextLogin: true }, ME);
      return null;
    }
    default:
      return `no playbook for ${step.validator.kind} in ${lab.title}`;
  }
}

/** The validator's event, as conductor.eventMatchesValidator matches it. */
function matched(w: SeedContext, step: Lab['steps'][number], since: number): boolean {
  const p = step.validator.params as Record<string, string>;
  const uid = p.userId ? w.dir.getUserByUsername(p.userId)?.id : undefined;
  const gid = p.groupId ? w.dir.getGroupByName(p.groupId)?.id : undefined;
  const evs = w.audit.events.slice(since) as AuditEvent[];
  const on = (action: string, key: 'targetId' | 'subjectId', id: string | undefined) =>
    evs.some((e) => e.action === action && e[key] === id);
  switch (step.validator.kind) {
    case 'user-created': return on('user.created', 'targetId', uid);
    case 'user-disabled': return on('user.disabled', 'targetId', uid);
    case 'user-enabled': return on('user.unlocked', 'targetId', uid);
    case 'user-deleted': return evs.some((e) => e.action === 'user.deleted');
    case 'account-unlocked': return on('account.unlock', 'targetId', uid);
    case 'group-added': return evs.some((e) => e.action === 'group.add' && e.subjectId === uid && e.targetId === gid);
    case 'group-removed': return evs.some((e) => e.action === 'group.remove' && e.subjectId === uid && e.targetId === gid);
    case 'session-revoked': return on('session.revoked', 'subjectId', uid);
    case 'password-reset': return on('password.reset', 'targetId', uid);
    case 'mfa-reset': return on('mfa.reset', 'targetId', uid);
    case 'mfa-challenge-completed': return on('mfa.challenge', 'targetId', uid);
    case 'role-revoked': return on('role.revoke', 'subjectId', uid);
    case 'signin-succeeded': return on('signin.success', 'targetId', uid);
    default: return true;
  }
}

const SINGLE = LAB_TEMPLATES;

describe('the identity lifecycle', () => {
  it('every stage has at least one daily ticket', () => {
    const covered = new Set(SINGLE.map((t) => t.lifecycle));
    expect(IAM_LIFECYCLE_STAGES.filter((s) => !covered.has(s))).toEqual([]);
  });

  it('every daily ticket reaches the queue, or says why it does not', () => {
    for (const t of SINGLE) {
      const ticket = dailyTicketOf(build(t));
      const ownTicket = t.id === 'ticket-cant-login'; // files its own, in its seed
      expect(Boolean(ticket) || ownTicket || Boolean(t.noQueueTicket), t.id).toBe(true);
    }
  });
});

describe('each daily ticket, worked as the app works it', () => {
  for (const t of SINGLE) {
    it(t.id, () => {
      const lab = build(t);
      const w = world(lab);
      getSeed(t.id)(w);
      const filed = dailyTicketOf(lab);
      const ticket = filed
        ? w.tickets.get(mkTicketId(filed.id))
        : w.tickets.list().find((x) => x.status !== 'resolved');
      const deps = () => ({ dir: w.dir, audit: w.audit, idp: w.idp, apps: w.apps });

      if (filed) {
        expect(ticket, 'ticket in the queue').toBeTruthy();
        expect(ticket!.kind).toBe(filed.kind);
        if (filed.about) {
          const about = w.dir.getUserByUsername(filed.about)!;
          expect(ticket!.relatedUserIds, 'filed against the account it is about').toContain(about.id);
        }
        // What it asks for is what the lab grades.
        for (const s of lab.steps) expect(ticket!.body).toContain(s.brief.replace(lab.brief, '').trim().slice(0, 40));
      }
      if (ticket) expect(reviewTicket(ticket, deps(), ME).passed, 'closes before any work').toBe(false);

      for (const s of lab.steps) {
        if (PROVEN_ELSEWHERE.has(s.validator.kind)) continue;
        const before = w.audit.events.length;
        const why = doStep(w, lab, s);
        expect(why, `${s.id} "${s.title}" could not be done`).toBeNull();
        expect(matched(w, s, before), `${s.id} "${s.title}" was done but its validator did not see it`).toBe(true);
      }

      if (ticket) {
        const r = reviewTicket(w.tickets.get(ticket.id)!, deps(), ME);
        expect(r.passed, `ticket still refuses to close:\n${r.summary}`).toBe(true);
      }
    });
  }
});

describe('the AI narrative names only what the lab grades', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete (globalThis as { window?: unknown }).window;
  });

  it('refuses an invented group, account or address and accepts the real ones', () => {
    const facts = ['Add Alex Morgan to grp-vpn-users for the VPN Portal.', 'alex.morgan'];
    expect(groundedNarrative('Alex needs grp-vpn-users approved by her manager.', facts)).toBe(true);
    expect(groundedNarrative('Please add Alex to grp-remote-workers.', facts)).toBe(false);
    expect(groundedNarrative('Also give role-jira-admin.', facts)).toBe(false);
    expect(groundedNarrative('Signed in as alex.morgan@northwind.example from home.', facts)).toBe(true);
    expect(groundedNarrative('Seen from 203.0.113.9.', facts)).toBe(false);
    // An app the ticket is not about is extra work nobody grades.
    expect(groundedNarrative('She also needs the Admin Console.', facts)).toBe(false);
    expect(groundedNarrative('She needs the VPN Portal from home.', facts)).toBe(true);
  });

  it('keeps a narrative to three sentences', () => {
    expect(firstSentences('One. Two! Three? Four. Five.')).toBe('One. Two! Three?');
    expect(firstSentences('No full stop at the end')).toBe('No full stop at the end');
  });

  it('tells the model the organisation, the requester, the stage and the exact work', () => {
    const t = SINGLE.find((x) => x.id === 'app-access-request')!;
    const lab = build(t);
    const prompt = flavorPrompt({
      ...t,
      ...(t.requester ? { requester: t.requester } : {}),
      facts: lab.steps.map((s) => s.brief),
    });
    expect(prompt).toContain('grp-vpn-users');
    expect(prompt).toContain('access-request');
    expect(prompt).toContain('Greta Olsen');
  });

  it('replaces a reply that invents a group with a narrative written from the facts', async () => {
    (globalThis as { window?: unknown }).window = { env: {} };
    const reply = (narrative: string) =>
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          message: { content: JSON.stringify({ narrative, coachingQuestion: 'Who approved it?' }) },
        }),
      }));
    const req = {
      ticketTypeLabel: 'Application Access Request',
      targetDisplayName: 'Alex Morgan',
      targetTitle: 'Payroll Analyst',
      targetDept: 'Finance',
      facts: ['Add Alex Morgan to grp-vpn-users.'],
    };
    vi.stubGlobal('fetch', reply('Alex Morgan needs grp-finance-admins for quarter close, urgently.'));
    const invented = await generateFlavor(req);
    expect(invented.narrative).not.toContain('grp-finance-admins');
    expect(invented.coachingQuestion).toBe('Who approved it?');

    vi.stubGlobal('fetch', reply('Alex Morgan works from home during quarter close and needs grp-vpn-users.'));
    expect((await generateFlavor(req)).narrative).toContain('grp-vpn-users');
  });
});
