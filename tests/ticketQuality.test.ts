/**
 * tests/ticketQuality.test.ts — a ticket has to be answerable from the ticket.
 *
 * The walkthrough test proves every ticket can be resolved. It proves it by
 * doing what the ticket's *kind* implies, which is how it missed the defect
 * this file exists for: a ticket whose kind and body disagree. "Ransomware
 * infection: Cara Patel's workstation" was filed as a password-reset and its
 * body said to disable the account and revoke the sessions. A learner who
 * does exactly what it says gets refused, and nothing in the ticket tells
 * them the review wanted a password reset instead. That is not a lab, it is a
 * guessing game.
 *
 * Two properties, both mechanical:
 *
 *   1. Everything the ticket names exists. A body that says "grant her
 *      grp-analytics-readers" when no such group is in the directory leaves
 *      the learner hunting for something that was never there. Names allowed
 *      to be missing are the ones the ticket asks to bring into existence.
 *
 *   2. The work the body asks for is work the review counts. Each kind's
 *      checks look for particular audit actions; the body's instructions
 *      imply particular audit actions; the two have to meet. This is a
 *      keyword reading of English prose and therefore blunt, but a blunt
 *      instrument is the right answer to "the ticket asked me to do the wrong
 *      thing".
 */
import { describe, it, expect } from 'vitest';
import { MockAuditLog } from '@/services/mockAuditLog';
import { MockDirectory } from '@/services/mockDirectory';
import { MockIdP } from '@/services/mockIdP';
import { MockAppServer } from '@/services/mockAppServer';
import { MockTicketQueue } from '@/services/mockTicketQueue';
import { createEventBus } from '@/util/events';
import { CAPABILITIES } from '@/services/capabilities';
import { LAB_TEMPLATES, BATCH_TEMPLATES } from '@/labs/generated/templates';
import { applyLab02Seed } from '@/seed/perLab/lab02';
import { applyLab03Seed } from '@/seed/perLab/lab03';
import { applyLab10Seed } from '@/seed/perLab/lab10';
import { reviewTicket } from '@/conductor/ticketReview';
import type { Ticket, TicketKind, UserId } from '@/domain';

const ME = 'player' as UserId;

function world() {
  const bus = createEventBus();
  const audit = new MockAuditLog(bus);
  const dir = new MockDirectory(audit);
  const idp = new MockIdP(audit, dir);
  const apps = new MockAppServer(dir, idp, audit);
  const tickets = new MockTicketQueue(audit);
  return { audit, dir, idp, apps, tickets };
}

type W = ReturnType<typeof world>;

/** Every ticket in the product, with the world it was raised in. */
function allTickets(): Array<{ label: string; ticket: Ticket; w: W }> {
  const out: Array<{ label: string; ticket: Ticket; w: W }> = [];
  const collect = (label: string, seed: (w: W) => void) => {
    const w = world();
    seed(w);
    for (const ticket of w.tickets.list()) out.push({ label, ticket, w });
  };

  collect('lab02', (w) => applyLab02Seed(w.dir, w.idp, w.apps, w.tickets));
  collect('lab03', (w) => applyLab03Seed(w.dir, w.idp, w.apps, w.tickets));
  collect('lab10', (w) => applyLab10Seed(w.dir, w.idp, w.apps, w.tickets));
  for (const tpl of LAB_TEMPLATES) {
    if (tpl.seed) collect(`gen:${tpl.id}`, (w) => tpl.seed!(w as never));
  }
  for (const tpl of BATCH_TEMPLATES) {
    const ids = Array.from({ length: tpl.ticketCount }, (_, i) => `${tpl.id}-t${i}`);
    collect(`batch:${tpl.id}`, (w) => tpl.seed(w as never, ids));
  }
  return out;
}

// ---------------------------------------------------------------------------
// 1. Everything the ticket names exists
// ---------------------------------------------------------------------------

/** Wording that puts a name in the future: it is missing on purpose. */
const ASKS_TO_CREATE = /\b(create|provision|creating|set up|new group|onboard|bring on)\b/i;

/**
 * The same question asked of one name rather than the whole ticket.
 *
 * Per ticket was too coarse: "Create a time-limited account … add to
 * grp-engineering-qa" excused the group as well as the account, and the group
 * did not exist — so the one instruction the ticket turned on could not be
 * carried out and nothing flagged it.
 */
const asksToCreate = (body: string, name: string) =>
  new RegExp(`\\b(create|creating|provision|set up)\\b[^.]{0,60}${name}`, 'i').test(body);

const GROUP_RE = /\bgrp-[a-z0-9-]+/g;
const ROLE_RE = /\brole-[a-z0-9-]+/g;
const LOGON_RE = /\b(?:svc-[a-z0-9-]+|[a-z]+\.[a-z]+(?:\.[a-z]+)?)\b/g;

describe('a ticket names only things the learner can find', () => {
  it('never sends the learner after a group that does not exist', () => {
    const missing: string[] = [];
    for (const { label, ticket, w } of allTickets()) {
      const text = `${ticket.subject} ${ticket.body}`;
      const known = new Set(w.dir.listGroups().map((g) => g.name));
      for (const name of text.match(GROUP_RE) ?? []) {
        if (known.has(name)) continue;
        if (asksToCreate(ticket.body, name)) continue; // the ticket asks for it
        missing.push(`${label} :: "${ticket.subject}" names ${name}, which is not in the directory`);
      }
    }
    expect(missing, missing.join('\n')).toEqual([]);
  });

  it('never sends the learner after a role that does not exist', () => {
    const missing: string[] = [];
    for (const { label, ticket, w } of allTickets()) {
      const text = `${ticket.subject} ${ticket.body}`;
      const known = new Set(w.dir.listRoles().map((r) => r.name));
      for (const name of text.match(ROLE_RE) ?? []) {
        if (known.has(name)) continue;
        if (asksToCreate(ticket.body, name)) continue;
        missing.push(`${label} :: "${ticket.subject}" names ${name}, which is not in the directory`);
      }
    }
    expect(missing, missing.join('\n')).toEqual([]);
  });

  it('never names an account that does not exist and is not being created', () => {
    const missing: string[] = [];
    for (const { label, ticket, w } of allTickets()) {
      const text = `${ticket.subject} ${ticket.body}`;
      const known = new Set(w.dir.listUsers().map((u) => u.username));
      for (const name of text.match(LOGON_RE) ?? []) {
        if (known.has(name)) continue;
        // Email addresses and file names read like logons; so does the domain.
        if (text.includes(`${name}@`) && known.has(name.split('@')[0]!)) continue;
        if (/\.(example|com|xlsx|example\.com)$/.test(name)) continue;
        if (name.includes('northwind')) continue;
        if (ASKS_TO_CREATE.test(ticket.body)) continue;
        missing.push(`${label} :: "${ticket.subject}" names ${name}, which is not an account`);
      }
    }
    expect(missing, missing.join('\n')).toEqual([]);
  });

  it('is filed against the account it is written about', () => {
    // "Cross-training access for Hank O'Neill" was filed against alex.morgan,
    // who is terminated two tickets earlier in the same queue. Resolving it
    // granted a departed account fresh access, and the termination that had
    // been done correctly then failed its own review. The prose and the
    // relatedUserIds have to agree.
    const misfiled: string[] = [];
    for (const { label, ticket, w } of allTickets()) {
      const text = `${ticket.subject} ${ticket.body}`.toLowerCase();
      for (const id of ticket.relatedUserIds) {
        const u = w.dir.getUser(id);
        if (!u) continue;
        const named =
          text.includes(u.username.toLowerCase()) || text.includes(u.displayName.toLowerCase());
        if (!named) {
          misfiled.push(
            `${label} :: "${ticket.subject}" is filed against ${u.username}, who the ticket ` +
              'never mentions',
          );
        }
      }
    }
    expect(misfiled, misfiled.join('\n')).toEqual([]);
  });

  it('says so when the account it is about is locked out', () => {
    // A password reset does not clear a lockout, and the review knows it. Two
    // tickets locked the account in their scene-setting and then asked only
    // for a reset, so following them exactly still left the account locked
    // and the ticket open with nothing on screen about a lockout.
    const silent: string[] = [];
    for (const { label, ticket, w } of allTickets()) {
      // Only password-reset tickets are judged on the lockout, and only they
      // can be blocked by one. Another ticket's scene-setting may leave an
      // account locked without that being this ticket's business.
      if (ticket.kind !== 'password-reset') continue;
      const locked = ticket.relatedUserIds
        .map((id) => w.dir.getUser(id))
        .some((u) => u?.status === 'locked');
      if (!locked) continue;
      if (!/unlock/i.test(ticket.body)) {
        silent.push(`${label} :: "${ticket.subject}" — the account is locked, the body never says`);
      }
    }
    expect(silent, silent.join('\n')).toEqual([]);
  });

  it('names a subject the review can identify', () => {
    const anonymous: string[] = [];
    for (const { label, ticket, w } of allTickets()) {
      const r = reviewTicket(ticket, { dir: w.dir, audit: w.audit, idp: w.idp, apps: w.apps }, ME);
      const noSubject = r.checks.some((c) => c.label === 'Subject identified' && !c.passed);
      if (!noSubject) continue;

      // An onboarding is the one ticket that legitimately has no subject
      // account when it is raised: creating it is the work. It still has to
      // state the logon to create, or the learner is guessing at a naming
      // convention and the review will not recognise whoever they invent.
      const statesALogon = /\b[a-z]+\.[a-z]+\b/.test(ticket.body);
      if (ticket.kind === 'onboarding' && ASKS_TO_CREATE.test(ticket.body) && statesALogon) {
        continue;
      }
      anonymous.push(`${label} :: [${ticket.kind}] "${ticket.subject}"`);
    }
    expect(anonymous, `these tickets are about nobody:\n${anonymous.join('\n')}`).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 2. The body asks for the work the review counts
// ---------------------------------------------------------------------------

/** Audit actions the review will accept as answering each kind. */
const ACCEPTED: Record<TicketKind, string[][]> = {
  onboarding: [['user.created', 'group.add', 'role.grant']],
  transfer: [['group.add'], ['group.remove']],
  mover: [['group.add'], ['group.remove']],
  leaver: [['user.disabled'], ['group.remove']],
  termination: [['user.disabled'], ['group.remove']],
  'password-reset': [['password.reset', 'account.unlock', 'user.unlocked']],
  'mfa-issue': [['mfa.reset']],
  'access-request': [['group.add', 'group.remove', 'role.grant', 'role.revoke']],
  incident: [
    [
      'user.disabled',
      'session.revoked',
      'password.reset',
      'mfa.reset',
      'group.remove',
      'role.revoke',
      'policy.updated',
      'app.config.changed',
      'account.unlock',
    ],
  ],
};

/** What the prose tells the learner to go and do. */
function actionsAskedFor(body: string): Set<string> {
  const b = body.toLowerCase();
  const found = new Set<string>();
  const say = (re: RegExp, action: string) => {
    if (re.test(b)) found.add(action);
  };
  say(/reset (the |her |his |their )?password|rotate the password|password reset|reset it|force password reset|setting a compliant password|reset her password|reset his password/, 'password.reset');
  say(/unlock/, 'account.unlock');
  say(/reset (her |his |their |the )?(totp |vpn |push )?(mfa|enrollment)|re-?enrol|mfa reset|disable push mfa/, 'mfa.reset');
  say(/disable (the |her |his |their )?account|disable account|disable her|disable his/, 'user.disabled');
  say(/revoke .{0,30}sessions?\b|revoke .{0,20}tokens\b/, 'session.revoked');
  say(/remove .{0,45}\b(groups?|grp-|membership)/, 'group.remove');
  say(/add .{0,45}\b(to grp-|grp-|as members?|membership)|grant .{0,45}membership/, 'group.add');
  say(/grant (her|him|them)? ?the role|grant .{0,20}role-/, 'role.grant');
  say(/remove the unauthorized role|revoke .{0,20}role|remove .{0,20}role-/, 'role.revoke');
  say(/create (an |his |her |their )?account|provision|create accounts|create the group/, 'user.created');
  say(/block the ip|enable account lockout policy|conditional access|check the certificate|saml|nameid|claim configuration/, 'policy.updated');
  return found;
}

describe('the body asks for the work the review counts', () => {
  it('never instructs the learner to do something the check ignores', () => {
    const mismatched: string[] = [];
    for (const { label, ticket } of allTickets()) {
      const asked = actionsAskedFor(ticket.body);
      if (asked.size === 0) {
        mismatched.push(`${label} :: "${ticket.subject}" — the body asks for nothing concrete`);
        continue;
      }
      for (const required of ACCEPTED[ticket.kind]) {
        if (required.some((a) => asked.has(a))) continue;
        mismatched.push(
          `${label} :: [${ticket.kind}] "${ticket.subject}" — the review wants one of ` +
            `${required.join('/')}, the body asks for ${[...asked].join(', ')}`,
        );
      }
    }
    expect(mismatched, `kind and body disagree:\n${mismatched.join('\n')}`).toEqual([]);
  });

  it('has an operator action in the registry for every ticket kind', () => {
    // A kind nothing can resolve is a kind the console offers no way to close.
    const resolvable = new Set(CAPABILITIES.flatMap((c) => c.resolvesTicketKinds));
    const kinds = new Set(allTickets().map((t) => t.ticket.kind));
    for (const kind of kinds) {
      expect(resolvable.has(kind), `no capability resolves '${kind}'`).toBe(true);
    }
  });
});
