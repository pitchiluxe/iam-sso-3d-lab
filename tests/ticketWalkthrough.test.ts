/**
 * tests/ticketWalkthrough.test.ts — work every ticket, both ways round.
 *
 * A ticket has to fail two ways to be worth anything: it must refuse to close
 * while the work is outstanding, and it must close once the work is done.
 * Only the pair is meaningful. A review that always refuses makes the labs
 * uncompletable; one that always passes is the thing the learner was going to
 * do anyway — press Resolve on a queue nobody touched.
 *
 * So every seeded and generated ticket in the product is run through both. The
 * playbook below is deliberately literal-minded: it reads the ticket, does
 * what the kind calls for, and knows nothing about how any particular ticket
 * was written. A ticket only a purpose-built script can satisfy is a ticket a
 * learner cannot satisfy.
 *
 * Four defects surfaced here and were fixed rather than accommodated:
 * memberships written on one side only, a ticket that named its subject in
 * prose the reviewer could not read, incident evidence timestamped after the
 * ticket it explained, and two checks that read end state where they should
 * have read work.
 */
import { describe, it, expect } from 'vitest';
import { MockAuditLog } from '@/services/mockAuditLog';
import { MockDirectory } from '@/services/mockDirectory';
import { MockIdP } from '@/services/mockIdP';
import { MockAppServer } from '@/services/mockAppServer';
import { MockTicketQueue } from '@/services/mockTicketQueue';
import { MockAccessReviews } from '@/services/mockAccessReviews';
import { MockIncidents } from '@/services/mockIncidents';
import { createEventBus } from '@/util/events';
import { LAB_TEMPLATES, BATCH_TEMPLATES } from '@/labs/generated/templates';
import { applyLab02Seed } from '@/seed/perLab/lab02';
import { applyLab03Seed } from '@/seed/perLab/lab03';
import { applyLab10Seed } from '@/seed/perLab/lab10';
import { reviewTicket } from '@/conductor/ticketReview';
import type { Ticket, UserId, GroupId } from '@/domain';

const ME = 'player' as UserId;

function world() {
  const bus = createEventBus();
  const audit = new MockAuditLog(bus);
  const dir = new MockDirectory(audit);
  const idp = new MockIdP(audit, dir);
  const apps = new MockAppServer(dir, idp, audit);
  const tickets = new MockTicketQueue(audit);
  const reviews = new MockAccessReviews();
  const incidents = new MockIncidents();
  return { bus, audit, dir, idp, apps, tickets, reviews, incidents };
}

/** Do what the ticket asks, using only what the ticket and directory say. */
function workTicket(t: Ticket, w: ReturnType<typeof world>): string {
  const { dir, idp } = w;
  const notes: string[] = [];
  const anyGroup = (): GroupId | undefined => dir.listGroups()[0]?.id;

  const subjects = t.relatedUserIds
    .map((id) => dir.getUser(id))
    .filter((u): u is NonNullable<typeof u> => Boolean(u));
  const payloadId = (t.payload as { userId?: UserId; affectedUserId?: UserId }).userId
    ?? (t.payload as { affectedUserId?: UserId }).affectedUserId;
  if (subjects.length === 0 && payloadId) {
    const u = dir.getUser(payloadId);
    if (u) subjects.push(u);
  }

  if (t.kind === 'onboarding') {
    // Read the logon out of the ticket text, the way a learner would.
    const logon = /\b([a-z]+\.[a-z]+)\b/.exec(`${t.subject} ${t.body}`)?.[1];
    let u = subjects[0];
    if (!u && logon) u = dir.getUserByUsername(logon);
    if (!u && logon) {
      const display = logon.split('.').map((p) => p[0]!.toUpperCase() + p.slice(1)).join(' ');
      u = dir.createUser({
        username: logon, displayName: display, email: `${logon}@northwind.example`,
        department: 'Finance', title: 'New Hire', mfa: 'none',
      }, ME);
      notes.push(`created ${logon}`);
    }
    if (!u) return 'NO SUBJECT AND NO LOGON IN TEXT';
    const proposed = (t.payload as { proposedGroupIds?: GroupId[] }).proposedGroupIds ?? [];
    const gid = proposed[0] ?? dir.getGroupByName('grp-finance-payroll')?.id ?? anyGroup();
    if (gid) { dir.addToGroup(u.id, gid, ME); notes.push('added to group'); }
    return notes.join('; ');
  }

  for (const u of subjects) {
    switch (t.kind) {
      case 'transfer':
      case 'mover': {
        for (const g of dir.listGroups().filter((g) => g.memberIds.includes(u.id))) {
          dir.removeFromGroup(u.id, g.id, ME);
        }
        const to = (t.payload as { toDepartment?: string }).toDepartment;
        const target =
          dir.listGroups().find((g) => to && g.name.toLowerCase().includes(to.toLowerCase().slice(0, 4)))
          ?? dir.listGroups().find((g) => !g.memberIds.includes(u.id));
        if (target) dir.addToGroup(u.id, target.id, ME);
        if (to) dir.moveUser(u.id, to, ME);
        notes.push('moved groups');
        break;
      }
      case 'termination':
      case 'leaver': {
        dir.disableUser(u.id, ME);
        idp.revokeAllSessions(u.id, ME);
        for (const g of dir.listGroups().filter((g) => g.memberIds.includes(u.id))) {
          dir.removeFromGroup(u.id, g.id, ME);
        }
        notes.push('disabled + stripped');
        break;
      }
      case 'password-reset': {
        idp.resetPassword(u.id, 'Temp!2345', { forceChangeAtNextLogin: true }, ME);
        if (dir.getUser(u.id)?.status === 'locked') dir.unlockUser(u.id, ME);
        notes.push('reset + unlocked');
        break;
      }
      case 'mfa-issue': {
        idp.resetMfa(u.id, ME);
        idp.enrollMfa(u.id, 'totp', ME);
        notes.push('mfa re-enrolled');
        break;
      }
      case 'access-request': {
        const gid = anyGroup();
        if (gid) dir.addToGroup(u.id, gid, ME);
        notes.push('granted a group');
        break;
      }
      case 'incident': {
        idp.revokeAllSessions(u.id, ME);
        dir.disableUser(u.id, ME);
        notes.push('contained');
        break;
      }
      default:
        notes.push('no playbook for this kind');
    }
  }
  return subjects.length === 0 ? 'NO SUBJECT' : notes.join('; ');
}

interface Finding {
  /** Passed before anybody did anything — the queue closes itself. */
  vacuous: string[];
  /** Could not be passed by doing what it says — the lab is uncompletable. */
  unreachable: string[];
  worked: number;
}

const findings: Finding = { vacuous: [], unreachable: [], worked: 0 };

function run(label: string, seed: (w: ReturnType<typeof world>) => void) {
  const w = world();
  seed(w);
  const deps = () => ({ dir: w.dir, audit: w.audit, idp: w.idp, apps: w.apps });
  const open = w.tickets.list().filter((t) => t.status !== 'resolved');

  // Every ticket judged on the untouched world first, in its own pass, so
  // that work done for one ticket is never credited to the next.
  for (const t of open) {
    if (reviewTicket(t, deps(), ME).passed) {
      findings.vacuous.push(`${label} :: [${t.kind}] ${t.subject}`);
    }
  }

  for (const t of open) {
    workTicket(t, w);
    const r = reviewTicket(w.tickets.get(t.id)!, deps(), ME);
    findings.worked += 1;
    if (!r.passed) {
      const why = r.checks
        .filter((c) => !c.passed)
        .map((c) => `${c.label}: ${c.detail}`)
        .join(' | ');
      findings.unreachable.push(`${label} :: [${t.kind}] ${t.subject} — ${why}`);
    }
  }
}

describe('every ticket in the product can be worked, and none closes itself', () => {
  it('walks the seeded labs, the generated labs and the batch queues', () => {
    run('lab02', (w) => applyLab02Seed(w.dir, w.idp, w.apps, w.tickets));
    run('lab03', (w) => applyLab03Seed(w.dir, w.idp, w.apps, w.tickets));
    run('lab10', (w) => applyLab10Seed(w.dir, w.idp, w.apps, w.tickets));

    for (const tpl of LAB_TEMPLATES) {
      if (!tpl.seed) continue;
      run(`gen:${tpl.id}`, (w) => tpl.seed!(w as never));
    }
    for (const tpl of BATCH_TEMPLATES) {
      const ids = Array.from({ length: tpl.ticketCount }, (_, i) => `${tpl.id}-t${i}`);
      run(`batch:${tpl.id}`, (w) => tpl.seed(w as never, ids));
    }

    // A guard against the harness quietly walking nothing.
    expect(findings.worked).toBeGreaterThan(50);

    const list = (rows: string[]) => rows.map((r) => `  ${r}`).join('\n');

    expect(
      findings.unreachable,
      `these tickets cannot be resolved by doing what they say:\n${list(findings.unreachable)}`,
    ).toEqual([]);

    expect(
      findings.vacuous,
      `these tickets resolve without anybody touching them:\n${list(findings.vacuous)}`,
    ).toEqual([]);
  });
});
