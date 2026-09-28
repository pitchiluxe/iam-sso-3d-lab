/**
 * labs/generated/templates.ts — the 15 real-world daily IT-helpdesk lab
 * templates + 3 batch lab templates (10-20 tickets each).
 *
 * Every target is a real seeded user/group/service-account —
 * nothing here is invented at generation time except the flavor text
 * passed in by the caller (see services/labFlavorGenerator.ts).
 *
 * Batch lab templates (ticket-queue-10, ticket-queue-15, ticket-queue-20)
 * generate multiple tickets during seeding and create one step per ticket.
 * Objectives are auto-derived from the steps.
 */
import { mkLabId, mkTicketId, SYSTEM_ACTOR } from '@/domain';
import type { Lab, LabStep, LabObjective, TicketKind } from '@/domain';
// Imported from the registry, not the conductor: templates register at module
// scope, and going through conductor.ts closed an evaluation-order cycle.
import { registerLabSeed } from '@/conductor/seedRegistry';
import type { SeedContext } from '@/conductor/seedRegistry';
import { applyBaseline } from '@/seed/baseline';
import { pickUnusedName } from './namePool';

export interface GeneratedFlavor {
  narrative: string;
  coachingQuestion: string;
}

export type GeneratedZoneId = 'iam-ops' | 'sec-ops' | 'help-desk' | 'engineering';

/**
 * Where a ticket sits in the identity lifecycle. The generator is expected to
 * cover every stage — tests/dailyTickets.test.ts holds it to that — because a
 * help desk that only ever sees password resets teaches half the job.
 */
export type IamLifecycleStage =
  | 'joiner'
  | 'mover'
  | 'leaver'
  | 'access-request'
  | 'authentication'
  | 'privileged-access'
  | 'access-review'
  | 'incident'
  | 'service-account'
  | 'policy'
  | 'hygiene';

export const IAM_LIFECYCLE_STAGES: readonly IamLifecycleStage[] = [
  'joiner',
  'mover',
  'leaver',
  'access-request',
  'authentication',
  'privileged-access',
  'access-review',
  'incident',
  'service-account',
  'policy',
  'hygiene',
];

/**
 * The ticket a daily lab puts in the Ticket Queue. The lab's steps are what
 * score; the ticket is what the learner sees arrive, reads, works and closes —
 * and its review passes exactly when that work is done.
 */
export interface DailyTicket {
  kind: TicketKind;
  /** Username of whoever raised it. */
  requester: string;
  /** Username of the account it is about, when that account exists already. */
  about?: string;
  subject: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

/** A daily ticket as filed: id and body fixed when the lab was generated. */
export interface FiledTicket extends DailyTicket {
  id: string;
  body: string;
}

type LabWithTicket = Lab & { _dailyTicket?: FiledTicket };

/** The ticket a generated lab files in the queue, if it files one. */
export function dailyTicketOf(lab: Lab | undefined): FiledTicket | undefined {
  return (lab as LabWithTicket | undefined)?._dailyTicket;
}

export interface LabTemplate {
  id: string;
  zoneId: GeneratedZoneId;
  ticketTypeLabel: string;
  targetDisplayName: string;
  targetTitle: string;
  targetDept: string;
  lifecycle: IamLifecycleStage;
  /** Who raised it, as the narrative should name them, e.g. "Cara Patel (HR)". */
  requester?: string;
  /**
   * Why there is no Ticket Queue entry, for the few labs that are not a
   * service-desk ticket (a policy change, a bulk intake, a duplicate cleanup
   * whose subject is deleted by the work itself).
   */
  noQueueTicket?: string;
  buildLab(flavor: GeneratedFlavor, usedNames: string[]): Lab;
  /** Runs after applyBaseline() for this generated lab's own conductor
   * session — a small, deterministic extra setup step, if any. */
  seed?(ctx: SeedContext): void;
}

function step(
  id: string,
  title: string,
  brief: string,
  validator: LabStep['validator'],
  points: LabStep['points'] = { exec: 10 },
): LabStep {
  return {
    id,
    title,
    brief,
    validator,
    evidence: [],
    tutorPrompts: [],
    hintIds: [],
    points,
  };
}

/** Build objectives from a list of steps. Falls back to 'exec' if a step
 * has no points, and prepends an optional explicit objective list (used
 * by batch labs to add a "triage" objective on top of per-ticket ones). */
function buildObjectives(steps: LabStep[], extraObjectives: LabObjective[] = []): LabObjective[] {
  const stepObjectives: LabObjective[] = steps.map((s, i) => ({
    id: `o${extraObjectives.length + i + 1}`,
    description: s.title,
    points: Object.values(s.points ?? {}).reduce((a, b) => a + (b ?? 0), 0),
    category:
      (Object.keys(s.points ?? { exec: 0 })[0] as Lab['objectives'][number]['category']) ?? 'exec',
  }));
  return [...extraObjectives, ...stepObjectives];
}

/** The ticket body: the reporter's words, then exactly what is being asked for. */
function ticketBody(flavor: GeneratedFlavor, steps: LabStep[]): string {
  const asks = steps.map((s) => `• ${s.brief.replace(flavor.narrative, '').trim()}`);
  return [flavor.narrative, '', 'Requested:', ...asks].join('\n').trim();
}

function baseLab(
  template: Pick<LabTemplate, 'id' | 'zoneId' | 'targetDisplayName'>,
  flavor: GeneratedFlavor,
  steps: LabStep[],
  options: {
    title?: string;
    durationMinutes?: number;
    extraObjectives?: LabObjective[];
    ticket?: DailyTicket;
  } = {},
): Lab {
  const lab: LabWithTicket = {
    id: mkLabId(`${template.id}-${Math.random().toString(36).slice(2, 8)}`),
    number: 0,
    title: options.title ?? `Daily Ticket: ${template.targetDisplayName}`,
    brief: flavor.narrative,
    durationMinutes: options.durationMinutes ?? 15,
    zoneIds: [template.zoneId],
    startingZone: template.zoneId,
    startingSeed: template.id,
    objectives: buildObjectives(steps, options.extraObjectives),
    steps: steps.map((s, i) =>
      i === steps.length - 1 ? { ...s, tutorPrompts: [flavor.coachingQuestion] } : s,
    ),
    faults: [],
    debriefQuestions: [flavor.coachingQuestion],
  };
  if (options.ticket) {
    lab._dailyTicket = {
      ...options.ticket,
      id: `daily-${template.id}`,
      body: ticketBody(flavor, steps),
    };
  }
  return lab;
}

/** Everything a seed did happened before the ticket was raised: back-date it. */
function backdateSeed(ctx: SeedContext): void {
  const past = Date.now() - 60 * 60 * 1000;
  for (const e of ctx.audit.events) if (e.at > past) e.at = past;
}

/**
 * Put a daily lab's ticket in the queue, after its seed has set the scene.
 * The seed's own changes are back-dated first: the ticket's review counts
 * work done since it was raised, and a scene set in the same millisecond
 * would otherwise count as the learner's work.
 */
export function fileDailyTicket(ctx: SeedContext, ticket: FiledTicket | undefined): void {
  if (!ticket || ctx.tickets.get(mkTicketId(ticket.id))) return;
  backdateSeed(ctx);
  const requester =
    ctx.dir.getUserByUsername(ticket.requester) ?? ctx.dir.getUserByUsername('admin');
  const about = ticket.about ? ctx.dir.getUserByUsername(ticket.about) : undefined;
  if (!requester) return;
  ctx.tickets.create({
    id: mkTicketId(ticket.id),
    kind: ticket.kind,
    requesterId: requester.id,
    subject: ticket.subject,
    body: ticket.body,
    priority: ticket.priority ?? 'normal',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload: { ...(about ? { userId: about.id } : {}), method: 'helpdesk' } as any,
    relatedUserIds: about ? [about.id] : [],
  });
}

export const LAB_TEMPLATES: LabTemplate[] = [
  {
    id: 'account-lockout',
    zoneId: 'help-desk',
    ticketTypeLabel: 'Account Lockout',
    targetDisplayName: 'Jane Doe',
    targetTitle: 'Junior Financial Analyst',
    targetDept: 'Finance',
    lifecycle: 'authentication',
    requester: 'Jane Doe (by phone)',
    seed(ctx) {
      applyBaseline(ctx.dir, ctx.idp, ctx.apps);
      const user = ctx.dir.getUserByUsername('jane.doe');
      if (!user) return;
      // A lockout is status 'locked', not 'disabled'. This used to call
      // disableUser(), which left the ticket saying "locked out" while the
      // account was merely disabled — and Unlock-ADAccount refuses a disabled
      // account, so the obvious remedy did not work.
      user.status = 'locked';
      // The failed attempts the scenario is about, so the learner can actually
      // find them in the audit log rather than being told they happened.
      for (let i = 0; i < 5; i++) {
        ctx.audit.record({
          actorId: user.id,
          action: 'signin.failure',
          targetId: user.id,
          ip: '10.20.4.77',
        });
      }
    },
    buildLab(flavor) {
      return baseLab(
        this,
        flavor,
        [
          step(
            's1',
            'Unlock the locked-out account',
            `${flavor.narrative} Jane Doe (jane.doe) is locked out after 5 failed sign-ins from 10.20.4.77 — ` +
              `check the audit log, then unlock her account in Active Directory Users and Computers.`,
            { kind: 'account-unlocked', params: { userId: 'jane.doe' } },
            { exec: 15, troubleshoot: 5 },
          ),
        ],
        {
          ticket: {
            kind: 'password-reset',
            requester: 'jane.doe',
            about: 'jane.doe',
            subject: 'Locked out after failed sign-ins: Jane Doe (jane.doe)',
            priority: 'high',
          },
        },
      );
    },
  },
  {
    id: 'new-hire-onboarding',
    zoneId: 'help-desk',
    ticketTypeLabel: 'New Hire Onboarding',
    targetDisplayName: 'a new hire',
    targetTitle: 'New Employee',
    targetDept: 'Engineering',
    lifecycle: 'joiner',
    requester: 'Cara Patel (HR Business Partner)',
    buildLab(flavor, usedNames) {
      const name = pickUnusedName(usedNames);
      return baseLab(
        { ...this, targetDisplayName: name.displayName },
        flavor,
        [
          step(
            's1',
            'Create the new hire’s account',
            `${flavor.narrative} Create an account for ${name.displayName} (logon ${name.username}) in Active Directory Users and Computers.`,
            { kind: 'user-created', params: { userId: name.username } },
            { exec: 10 },
          ),
          step(
            's2',
            'Add them to their department group',
            `Add ${name.displayName} to grp-engineering-dev so they can access team resources.`,
            {
              kind: 'group-added',
              params: { userId: name.username, groupId: 'grp-engineering-dev' },
            },
            { exec: 10, 'least-privilege': 5 },
          ),
        ],
        {
          ticket: {
            kind: 'onboarding',
            requester: 'cara.patel',
            subject: `New starter Monday: ${name.displayName} (${name.username}), Engineering`,
          },
        },
      );
    },
  },
  {
    id: 'offboarding',
    zoneId: 'help-desk',
    ticketTypeLabel: 'Employee Offboarding',
    targetDisplayName: 'Dan Rivera',
    targetTitle: 'Help Desk Tier 1',
    targetDept: 'IT',
    lifecycle: 'leaver',
    requester: 'Cara Patel (HR Business Partner)',
    seed(ctx) {
      applyBaseline(ctx.dir, ctx.idp, ctx.apps);
      ctx.idp.signIn('dan.rivera', 'dan.rivera123');
    },
    buildLab(flavor) {
      return baseLab(
        this,
        flavor,
        [
          step(
            's1',
            'Disable the departing employee’s account',
            `${flavor.narrative} Disable Dan Rivera's account.`,
            { kind: 'user-disabled', params: { userId: 'dan.rivera' } },
            { exec: 10 },
          ),
          step(
            's2',
            'Revoke any active sessions',
            'Revoke Dan Rivera’s active sessions so the disabled account can’t still be used.',
            { kind: 'session-revoked', params: { userId: 'dan.rivera' } },
            { exec: 10, troubleshoot: 5 },
          ),
          step(
            's3',
            'Remove his access',
            'Remove Dan Rivera from grp-helpdesk-tier1, his only group — a disabled account that keeps its groups is one "Enable" away from full access.',
            {
              kind: 'group-removed',
              params: { userId: 'dan.rivera', groupId: 'grp-helpdesk-tier1' },
            },
            { exec: 10, 'least-privilege': 5 },
          ),
        ],
        {
          ticket: {
            kind: 'leaver',
            requester: 'cara.patel',
            about: 'dan.rivera',
            subject: 'Leaver effective today: Dan Rivera (dan.rivera), Help Desk',
            priority: 'high',
          },
        },
      );
    },
  },
  {
    id: 'promotion-role-change',
    zoneId: 'help-desk',
    ticketTypeLabel: 'Promotion / Role Change',
    targetDisplayName: 'Ivy Park',
    targetTitle: 'Help Desk Tier 1 → IAM Administrator',
    targetDept: 'IT',
    lifecycle: 'mover',
    requester: 'Erin Cho (IAM lead)',
    seed(ctx) {
      applyBaseline(ctx.dir, ctx.idp, ctx.apps);
      // Before the promotion she is Tier 1 only. The baseline also has her in
      // grp-iam-admins, which made "add her to grp-iam-admins" a request for
      // access she already had — Active Directory refuses that as "already a
      // member", so the step could not be done.
      const ivy = ctx.dir.getUserByUsername('ivy.park');
      const admins = ctx.dir.getGroupByName('grp-iam-admins');
      if (ivy && admins) ctx.dir.removeFromGroup(ivy.id, admins.id, SYSTEM_ACTOR);
    },
    buildLab(flavor) {
      return baseLab(
        this,
        flavor,
        [
          step(
            's1',
            'Remove the old team membership',
            `${flavor.narrative} Ivy Park moves from Help Desk Tier 1 to IAM Administrator — remove her from grp-helpdesk-tier1.`,
            {
              kind: 'group-removed',
              params: { userId: 'ivy.park', groupId: 'grp-helpdesk-tier1' },
            },
            { exec: 10, 'least-privilege': 5 },
          ),
          step(
            's2',
            'Add the new team membership',
            'Add Ivy Park to grp-iam-admins to match her new role.',
            { kind: 'group-added', params: { userId: 'ivy.park', groupId: 'grp-iam-admins' } },
            { exec: 10 },
          ),
        ],
        {
          ticket: {
            kind: 'mover',
            requester: 'erin.cho',
            about: 'ivy.park',
            subject: 'Promotion: Ivy Park (ivy.park) to IAM Administrator',
          },
        },
      );
    },
  },
  {
    id: 'mfa-device-lost',
    zoneId: 'iam-ops',
    ticketTypeLabel: 'Lost MFA Device',
    targetDisplayName: 'Finn Müller',
    targetTitle: 'Security Operations Analyst',
    targetDept: 'Security',
    lifecycle: 'authentication',
    requester: 'Finn Müller (from a colleague’s desk phone)',
    buildLab(flavor) {
      return baseLab(
        this,
        flavor,
        [
          step(
            's1',
            'Clear the lost device',
            `${flavor.narrative} Verify it is really Finn Müller (call back on the number HR holds), then reset his MFA so the lost phone stops working — Active Directory Users and Computers → Identity Services → Credentials & Recovery.`,
            { kind: 'mfa-reset', params: { userId: 'finn.muller' } },
            { exec: 10, troubleshoot: 5 },
          ),
          step(
            's2',
            'Enrol the new device',
            'Enrol Finn Müller’s new authenticator (TOTP) so the account is never left without a second factor.',
            { kind: 'mfa-challenge-completed', params: { userId: 'finn.muller' } },
            { exec: 10 },
          ),
        ],
        {
          ticket: {
            kind: 'mfa-issue',
            requester: 'finn.muller',
            about: 'finn.muller',
            subject: 'Lost phone — MFA device for Finn Müller (finn.muller)',
            priority: 'high',
          },
        },
      );
    },
  },
  {
    id: 'suspicious-signin',
    zoneId: 'sec-ops',
    ticketTypeLabel: 'Suspicious Sign-In',
    targetDisplayName: "Hank O'Neill",
    targetTitle: 'Server Administrator',
    targetDept: 'IT',
    lifecycle: 'incident',
    requester: 'Finn Müller (SecOps, impossible-travel alert)',
    seed(ctx) {
      applyBaseline(ctx.dir, ctx.idp, ctx.apps);
      const hank = ctx.dir.getUserByUsername('hank.oneill');
      // The alert's story: failures from an unfamiliar address, then a success.
      if (hank) {
        for (let i = 0; i < 3; i++) {
          ctx.audit.record({
            actorId: hank.id,
            action: 'signin.failure',
            targetId: hank.id,
            ip: '185.220.101.4',
          });
        }
      }
      ctx.idp.signIn('hank.oneill', 'hank.oneill123');
    },
    buildLab(flavor) {
      return baseLab(
        this,
        flavor,
        [
          step(
            's1',
            'Revoke the suspicious session',
            `${flavor.narrative} Revoke Hank O'Neill's active session in SecOps Dashboard.`,
            { kind: 'session-revoked', params: { userId: 'hank.oneill' } },
            { exec: 15, troubleshoot: 10 },
          ),
          step(
            's2',
            'Capture evidence for the incident record',
            'Capture a snapshot of the audit log for this investigation.',
            { kind: 'evidence-collected', params: { stepId: 's2' } },
            { evidence: 10, docs: 5 },
          ),
        ],
        {
          ticket: {
            kind: 'incident',
            requester: 'finn.muller',
            about: 'hank.oneill',
            subject: 'Impossible travel: hank.oneill signed in from 185.220.101.4',
            priority: 'urgent',
          },
        },
      );
    },
  },
  {
    id: 'app-access-request',
    zoneId: 'help-desk',
    ticketTypeLabel: 'Application Access Request',
    targetDisplayName: 'Alex Morgan',
    targetTitle: 'Payroll Analyst',
    targetDept: 'Finance',
    lifecycle: 'access-request',
    requester: 'Alex Morgan, approved by Greta Olsen (CFO)',
    buildLab(flavor) {
      // Alex is already in grp-finance-payroll (the Finance Portal). The
      // request used to be for that, which Active Directory refuses as
      // "already a member" — a ticket nobody could complete.
      return baseLab(
        this,
        flavor,
        [
          step(
            's1',
            'Grant VPN Portal access',
            `${flavor.narrative} Alex Morgan works remotely during quarter close and her manager Greta Olsen approved it — add her to grp-vpn-users for the VPN Portal, and nothing else.`,
            {
              kind: 'group-added',
              params: { userId: 'alex.morgan', groupId: 'grp-vpn-users' },
            },
            { exec: 10, 'least-privilege': 5 },
          ),
        ],
        {
          ticket: {
            kind: 'access-request',
            requester: 'alex.morgan',
            about: 'alex.morgan',
            subject: 'VPN Portal access for Alex Morgan (alex.morgan) — manager approved',
          },
        },
      );
    },
  },
  {
    id: 'ticket-cant-login',
    zoneId: 'help-desk',
    ticketTypeLabel: 'Ticket Queue: Can’t Log In',
    targetDisplayName: 'Cara Patel',
    targetTitle: 'HR Business Partner',
    targetDept: 'HR',
    lifecycle: 'authentication',
    requester: 'Cara Patel',
    seed(ctx) {
      const seedResult = applyBaseline(ctx.dir, ctx.idp, ctx.apps);
      const caraId = seedResult.userIds['cara.patel'];
      if (!caraId) return;
      ctx.tickets.create({
        id: mkTicketId('gen-ticket-cant-login'),
        kind: 'password-reset',
        requesterId: caraId,
        subject: 'Can’t log in to my account',
        body: 'Cara Patel (cara.patel) reports she cannot sign in after several attempts. Reset her password, and unlock the account if it is locked out.',
        priority: 'normal',
        // The subject, said out loud. Without it the review had to guess from
        // the prose, and "Cara Patel" is not the logon it was looking for.
        relatedUserIds: [caraId],
        payload: { userId: caraId, method: 'helpdesk' },
      });
    },
    buildLab(flavor) {
      return baseLab(this, flavor, [
        step(
          's1',
          'Resolve the ticket',
          `${flavor.narrative} Resolve Cara Patel's ticket in the Ticket Console once you’ve confirmed access is restored.`,
          { kind: 'ticket-resolved', params: { ticketId: 'gen-ticket-cant-login' } },
          { exec: 15, comms: 5 },
        ),
      ]);
    },
  },
  {
    id: 'stale-group-cleanup',
    zoneId: 'iam-ops',
    ticketTypeLabel: 'Access Review: Stale Group Membership',
    targetDisplayName: "Hank O'Neill",
    targetTitle: 'Server Administrator',
    targetDept: 'IT',
    lifecycle: 'access-review',
    requester: 'Erin Cho (IAM, quarterly access review)',
    buildLab(flavor) {
      return baseLab(
        this,
        flavor,
        [
          step(
            's1',
            'Remove the unneeded domain-admin membership',
            `${flavor.narrative} An access review found Hank O'Neill no longer needs grp-domain-admins — remove it (he keeps grp-server-admins).`,
            {
              kind: 'group-removed',
              params: { userId: 'hank.oneill', groupId: 'grp-domain-admins' },
            },
            { exec: 10, 'least-privilege': 10 },
          ),
        ],
        {
          ticket: {
            kind: 'access-request',
            requester: 'erin.cho',
            about: 'hank.oneill',
            subject: 'Access review finding: remove grp-domain-admins from hank.oneill',
          },
        },
      );
    },
  },
  {
    id: 'dept-mfa-enforcement',
    zoneId: 'iam-ops',
    ticketTypeLabel: 'Department MFA Enforcement',
    targetDisplayName: 'the Finance department',
    targetTitle: 'Department-wide request',
    targetDept: 'Finance',
    lifecycle: 'policy',
    requester: 'Greta Olsen (CFO), after a phishing attempt',
    noQueueTicket:
      'A tenant-wide policy change goes through change management, not the service-desk queue.',
    buildLab(flavor) {
      return baseLab(this, flavor, [
        step(
          's1',
          'Enable MFA enforcement',
          `${flavor.narrative} Enable MFA enforcement in Active Directory Users and Computers (Identity Services → Authentication Policy) after a phishing attempt targeted Finance.`,
          { kind: 'mfa-policy-enforced', params: {} },
          { exec: 10, 'least-privilege': 10 },
        ),
      ]);
    },
  },
  {
    id: 'contractor-setup',
    zoneId: 'engineering',
    ticketTypeLabel: 'Contractor Account Setup',
    targetDisplayName: 'a new contractor',
    targetTitle: 'Contractor',
    targetDept: 'Engineering',
    lifecycle: 'joiner',
    requester: 'Bob Sato (Engineering, project lead)',
    buildLab(flavor, usedNames) {
      const name = pickUnusedName(usedNames);
      return baseLab(
        { ...this, targetDisplayName: name.displayName },
        flavor,
        [
          step(
            's1',
            'Create the contractor’s account',
            `${flavor.narrative} Create a time-limited account for ${name.displayName} (logon ${name.username}).`,
            { kind: 'user-created', params: { userId: name.username } },
            { exec: 10 },
          ),
          step(
            's2',
            'Grant minimum required access',
            `Add ${name.displayName} to grp-engineering-dev only — nothing more.`,
            {
              kind: 'group-added',
              params: { userId: name.username, groupId: 'grp-engineering-dev' },
            },
            { exec: 10, 'least-privilege': 10 },
          ),
        ],
        {
          ticket: {
            kind: 'onboarding',
            requester: 'bob.sato',
            subject: `Contractor starting: ${name.displayName} (${name.username}), Engineering`,
          },
        },
      );
    },
  },
  {
    id: 'service-account-access',
    zoneId: 'engineering',
    ticketTypeLabel: 'Service Account Permission Request',
    targetDisplayName: 'svc-backup',
    targetTitle: 'Service Account',
    targetDept: 'IT',
    lifecycle: 'service-account',
    requester: "Hank O'Neill (owner of the backup job)",
    buildLab(flavor) {
      return baseLab(
        this,
        flavor,
        [
          step(
            's1',
            'Grant the requested access',
            `${flavor.narrative} Add svc-backup to grp-server-admins so the backup job can run.`,
            { kind: 'group-added', params: { userId: 'svc-backup', groupId: 'grp-server-admins' } },
            { exec: 10, 'least-privilege': 10 },
          ),
        ],
        {
          ticket: {
            kind: 'access-request',
            requester: 'hank.oneill',
            about: 'svc-backup',
            subject: 'Nightly backup failing: svc-backup needs grp-server-admins',
          },
        },
      );
    },
  },
  {
    id: 'failed-login-troubleshoot',
    zoneId: 'help-desk',
    ticketTypeLabel: 'Failed Login Troubleshooting',
    targetDisplayName: 'Greta Olsen',
    targetTitle: 'Chief Financial Officer',
    targetDept: 'Finance',
    lifecycle: 'authentication',
    requester: 'Greta Olsen (CFO)',
    noQueueTicket:
      'A verification follow-up on work already done: nothing in the directory changes, so there is no ticket for the queue to review.',
    buildLab(flavor) {
      return baseLab(this, flavor, [
        step(
          's1',
          'Verify sign-in works',
          `${flavor.narrative} Test Sign-In for Greta Olsen in Active Directory Users and Computers to confirm the issue is resolved.`,
          { kind: 'signin-succeeded', params: { userId: 'greta.olsen' } },
          { exec: 10, troubleshoot: 10 },
        ),
        step(
          's2',
          'Capture evidence of the successful sign-in',
          'Capture evidence confirming the fix for the ticket record.',
          { kind: 'evidence-collected', params: { stepId: 's2' } },
          { evidence: 10 },
        ),
      ]);
    },
  },
  {
    id: 'duplicate-account-cleanup',
    zoneId: 'iam-ops',
    ticketTypeLabel: 'Duplicate Account Cleanup',
    targetDisplayName: 'Jane Doe (duplicate)',
    targetTitle: 'Junior Financial Analyst',
    targetDept: 'Finance',
    lifecycle: 'hygiene',
    requester: 'Erin Cho (IAM, directory hygiene report)',
    noQueueTicket:
      'The account the ticket is about is deleted by the work itself, so it is tracked on the hygiene report rather than the queue.',
    seed(ctx) {
      applyBaseline(ctx.dir, ctx.idp, ctx.apps);
      ctx.dir.createUser(
        {
          username: 'jane.doe2',
          displayName: 'Jane Doe',
          email: 'jane.doe2@northwind.example',
          department: 'Finance',
          title: 'Junior Financial Analyst',
        },
        SYSTEM_ACTOR,
      );
    },
    buildLab(flavor) {
      return baseLab(this, flavor, [
        step(
          's1',
          'Delete the duplicate account',
          `${flavor.narrative} A duplicate "jane.doe2" account was created by mistake — delete it (keep the real jane.doe).`,
          { kind: 'user-deleted', params: { userId: 'jane.doe2' } },
          { exec: 10, troubleshoot: 5 },
        ),
      ]);
    },
  },
  {
    id: 'department-transfer',
    zoneId: 'help-desk',
    ticketTypeLabel: 'Department Transfer',
    targetDisplayName: 'Bob Sato',
    targetTitle: 'Software Developer',
    targetDept: 'Engineering',
    lifecycle: 'mover',
    requester: 'Ivy Park (Help Desk manager)',
    buildLab(flavor) {
      return baseLab(
        this,
        flavor,
        [
          step(
            's1',
            'Remove access from the old department',
            `${flavor.narrative} Bob Sato is transferring out of Engineering — remove grp-engineering-dev.`,
            {
              kind: 'group-removed',
              params: { userId: 'bob.sato', groupId: 'grp-engineering-dev' },
            },
            { exec: 10 },
          ),
          step(
            's2',
            'Grant access to the new department',
            'Add Bob Sato to grp-helpdesk-tier1 for his new IT Help Desk role.',
            { kind: 'group-added', params: { userId: 'bob.sato', groupId: 'grp-helpdesk-tier1' } },
            { exec: 10, 'least-privilege': 5 },
          ),
        ],
        {
          ticket: {
            kind: 'transfer',
            requester: 'ivy.park',
            about: 'bob.sato',
            subject: 'Transfer: Bob Sato (bob.sato) from Engineering to IT Help Desk',
          },
        },
      );
    },
  },
  // ── Lifecycle stages the queue was missing ──────────────────────────────────
  {
    id: 'rehire',
    zoneId: 'help-desk',
    ticketTypeLabel: 'Rehire: Returning Employee',
    targetDisplayName: 'Nora Quinn',
    targetTitle: 'Accounts Payable Specialist',
    targetDept: 'Finance',
    lifecycle: 'joiner',
    requester: 'Cara Patel (HR Business Partner)',
    seed(ctx) {
      applyBaseline(ctx.dir, ctx.idp, ctx.apps);
      // She left eight months ago: the account was disabled and stripped, as a
      // leaver should be, and HR is bringing her back.
      const nora = ctx.dir.ensureUser({
        username: 'nora.quinn',
        displayName: 'Nora Quinn',
        email: 'nora.quinn@northwind.example',
        department: 'Finance',
        title: 'Accounts Payable Specialist',
        mfa: 'none',
      });
      ctx.dir.disableUser(nora.id, SYSTEM_ACTOR, 'leaver');
    },
    buildLab(flavor) {
      return baseLab(
        this,
        flavor,
        [
          step(
            's1',
            'Re-enable the original account',
            `${flavor.narrative} Nora Quinn (nora.quinn) is rejoining Finance — re-enable her existing account instead of creating a second one.`,
            { kind: 'user-enabled', params: { userId: 'nora.quinn' } },
            { exec: 10 },
          ),
          step(
            's2',
            'Issue a fresh temporary password',
            'Reset nora.quinn’s password (must change at next sign-in): the one from her last employment must not work.',
            { kind: 'password-reset', params: { userId: 'nora.quinn' } },
            { exec: 10 },
          ),
          step(
            's3',
            'Grant her role’s access — and only that',
            'Add Nora Quinn to grp-finance-analysts. Do not restore what she had before she left; access is granted for the job she has now.',
            {
              kind: 'group-added',
              params: { userId: 'nora.quinn', groupId: 'grp-finance-analysts' },
            },
            { exec: 10, 'least-privilege': 10 },
          ),
        ],
        {
          ticket: {
            kind: 'onboarding',
            requester: 'cara.patel',
            about: 'nora.quinn',
            subject: 'Rehire starting Monday: Nora Quinn (nora.quinn), Finance',
          },
        },
      );
    },
  },
  {
    id: 'leave-of-absence',
    zoneId: 'help-desk',
    ticketTypeLabel: 'Leave of Absence',
    targetDisplayName: 'Cara Patel',
    targetTitle: 'HR Business Partner',
    targetDept: 'HR',
    lifecycle: 'mover',
    requester: 'Greta Olsen, on behalf of HR',
    seed(ctx) {
      applyBaseline(ctx.dir, ctx.idp, ctx.apps);
      const cara = ctx.dir.getUserByUsername('cara.patel');
      const vpn = ctx.dir.getGroupByName('grp-vpn-users');
      if (cara && vpn) ctx.dir.addToGroup(cara.id, vpn.id, SYSTEM_ACTOR);
      ctx.idp.signIn('cara.patel', 'cara.patel123');
    },
    buildLab(flavor) {
      return baseLab(
        this,
        flavor,
        [
          step(
            's1',
            'Suspend the account for the leave',
            `${flavor.narrative} Cara Patel (cara.patel) starts three months of leave today — disable her account (it is re-enabled when she returns, so keep her groups).`,
            { kind: 'user-disabled', params: { userId: 'cara.patel' } },
            { exec: 10 },
          ),
          step(
            's2',
            'End her active sessions',
            'Revoke Cara Patel’s active sessions so nothing stays signed in while she is away.',
            { kind: 'session-revoked', params: { userId: 'cara.patel' } },
            { exec: 10 },
          ),
          step(
            's3',
            'Remove remote access',
            'Remove Cara Patel from grp-vpn-users — remote access during leave is exactly what an attacker with her password would want.',
            { kind: 'group-removed', params: { userId: 'cara.patel', groupId: 'grp-vpn-users' } },
            { exec: 10, 'least-privilege': 5 },
          ),
        ],
        {
          ticket: {
            kind: 'access-request',
            requester: 'greta.olsen',
            about: 'cara.patel',
            subject: 'Leave of absence from today: suspend Cara Patel (cara.patel)',
          },
        },
      );
    },
  },
  {
    id: 'contractor-expiry',
    zoneId: 'engineering',
    ticketTypeLabel: 'Contractor End Date Reached',
    targetDisplayName: 'Omar Haddad',
    targetTitle: 'Contractor',
    targetDept: 'Engineering',
    lifecycle: 'leaver',
    requester: 'Bob Sato (Engineering, project lead)',
    seed(ctx) {
      applyBaseline(ctx.dir, ctx.idp, ctx.apps);
      const omar = ctx.dir.ensureUser({
        username: 'omar.haddad',
        displayName: 'Omar Haddad',
        email: 'omar.haddad@northwind.example',
        department: 'Engineering',
        title: 'Contractor',
        mfa: 'none',
      });
      const dev = ctx.dir.getGroupByName('grp-engineering-dev');
      if (dev) ctx.dir.addToGroup(omar.id, dev.id, SYSTEM_ACTOR);
    },
    buildLab(flavor) {
      return baseLab(
        this,
        flavor,
        [
          step(
            's1',
            'Disable the expired contractor',
            `${flavor.narrative} Omar Haddad’s (omar.haddad) contract ended yesterday and nobody told IT — disable the account.`,
            { kind: 'user-disabled', params: { userId: 'omar.haddad' } },
            { exec: 10 },
          ),
          step(
            's2',
            'Remove his access',
            'Remove Omar Haddad from grp-engineering-dev.',
            {
              kind: 'group-removed',
              params: { userId: 'omar.haddad', groupId: 'grp-engineering-dev' },
            },
            { exec: 10, 'least-privilege': 5 },
          ),
        ],
        {
          ticket: {
            kind: 'leaver',
            requester: 'bob.sato',
            about: 'omar.haddad',
            subject: 'Contract ended: remove Omar Haddad (omar.haddad)',
            priority: 'high',
          },
        },
      );
    },
  },
  {
    id: 'standing-admin-removal',
    zoneId: 'iam-ops',
    ticketTypeLabel: 'Privileged Access: Standing Admin Role',
    targetDisplayName: 'Erin Cho',
    targetTitle: 'IAM Engineer',
    targetDept: 'IT',
    lifecycle: 'privileged-access',
    requester: 'Finn Müller (Security, privileged-access review)',
    seed(ctx) {
      applyBaseline(ctx.dir, ctx.idp, ctx.apps);
      // Granted directly for a migration last year and never taken away.
      const erin = ctx.dir.getUserByUsername('erin.cho');
      const da = ctx.dir.getRoleByName('role-domain-admins');
      if (erin && da) ctx.dir.grantRoleDirect(erin.id, da.id, SYSTEM_ACTOR);
    },
    buildLab(flavor) {
      return baseLab(
        this,
        flavor,
        [
          step(
            's1',
            'Revoke the standing admin role',
            `${flavor.narrative} Erin Cho (erin.cho) holds role-domain-admins as a direct, permanent grant left over from a migration. Revoke it — Active Directory Users and Computers → Identity Services → Access & Sessions → Revoke Role (or Revoke-IamRole). She keeps grp-iam-admins for her daily work.`,
            { kind: 'role-revoked', params: { userId: 'erin.cho' } },
            { exec: 15, 'least-privilege': 10 },
          ),
        ],
        {
          ticket: {
            kind: 'access-request',
            requester: 'finn.muller',
            about: 'erin.cho',
            subject: 'PAM finding: standing role-domain-admins on erin.cho',
            priority: 'high',
          },
        },
      );
    },
  },
  {
    id: 'password-reset-request',
    zoneId: 'help-desk',
    ticketTypeLabel: 'Forgotten Password',
    targetDisplayName: 'Bob Sato',
    targetTitle: 'Software Developer',
    targetDept: 'Engineering',
    lifecycle: 'authentication',
    requester: 'Bob Sato (back from two weeks’ holiday)',
    buildLab(flavor) {
      return baseLab(
        this,
        flavor,
        [
          step(
            's1',
            'Verify, then reset',
            `${flavor.narrative} Confirm it is Bob Sato (bob.sato) — call him back on the number in the directory, never the one he called from — then reset his password with "must change at next sign-in".`,
            { kind: 'password-reset', params: { userId: 'bob.sato' } },
            { exec: 10, troubleshoot: 5 },
          ),
        ],
        {
          ticket: {
            kind: 'password-reset',
            requester: 'bob.sato',
            about: 'bob.sato',
            subject: 'Forgot my password after holiday — Bob Sato (bob.sato)',
          },
        },
      );
    },
  },
];

// ---------------------------------------------------------------------------
// Bulk-provisioning labs
// ---------------------------------------------------------------------------
// The point of these is that doing the work by hand is the wrong answer:
// twenty accounts through the console is twenty chances to fumble a field. The
// learner opens PowerShell ISE, edits the name list in a template, and runs it
// — firing the same service calls, audit events and validators the console
// would.
//
// Validation counts membership of a group the seed creates EMPTY, so the
// baseline's fourteen existing users cannot satisfy the step by accident.

/** Target group for the bulk intake labs. Seeded empty. */
export const BULK_INTAKE_GROUP = 'grp-q3-intake';

function bulkProvisionTemplate(count: number): LabTemplate {
  return {
    id: `bulk-provision-${count}`,
    zoneId: 'iam-ops',
    ticketTypeLabel: 'Bulk Provisioning',
    targetDisplayName: `${count} new starters`,
    targetTitle: 'New Employee',
    targetDept: 'Finance',
    lifecycle: 'joiner',
    requester: 'HR (Q3 intake list)',
    noQueueTicket:
      'A bulk intake arrives as one HR list and is worked as automation, not as individual queue tickets.',
    seed(ctx: SeedContext): void {
      applyBaseline(ctx.dir, ctx.idp, ctx.apps);
      if (!ctx.dir.getGroupByName(BULK_INTAKE_GROUP)) {
        ctx.dir.createGroup(BULK_INTAKE_GROUP, `Q3 intake (${count} starters)`, SYSTEM_ACTOR);
      }
    },
    buildLab(flavor: GeneratedFlavor): Lab {
      return baseLab(
        {
          id: `bulk-provision-${count}`,
          zoneId: 'iam-ops',
          targetDisplayName: `${count} new starters`,
        },
        flavor,
        [
          step(
            's1',
            `Provision ${count} accounts with PowerShell`,
            `${flavor.narrative} HR sent ${count} starters for the Q3 intake. Doing this ` +
              `by hand is ${count} chances to mistype a field — open PowerShell ISE, load ` +
              `"Bulk onboarding — new hires", put the ${count} usernames in the $names ` +
              `list, set the group to ${BULK_INTAKE_GROUP}, and run it. Then check the ` +
              `audit log shows one user.created per account.`,
            { kind: 'users-provisioned', params: { groupId: BULK_INTAKE_GROUP, count } },
            { exec: 20, troubleshoot: 5 },
          ),
        ],
        {
          title: `Bulk Provisioning: ${count} accounts`,
          durationMinutes: count >= 20 ? 25 : 15,
        },
      );
    },
  };
}

LAB_TEMPLATES.push(bulkProvisionTemplate(5), bulkProvisionTemplate(10), bulkProvisionTemplate(20));

// ---------------------------------------------------------------------------
// Batch lab templates — 10–20 tickets per lab
// Each batch template seeds N tickets during its seed() and creates one
// step per ticket. Objectives are auto-derived from steps (see buildObjectives).
// ---------------------------------------------------------------------------

export interface BatchTemplate {
  id: string;
  zoneId: GeneratedZoneId;
  /** Human label for the "Generate Batch" button in the UI. */
  label: string;
  /** How many tickets this batch generates. */
  ticketCount: number;
  buildLab(flavor: GeneratedFlavor, ticketIds: string[]): Lab;
  /** Runs after applyBaseline() for this batch lab's conductor session. */
  seed(ctx: SeedContext, ticketIds: string[]): void;
}

/** Shared step builder for ticket-resolution steps. */
function ticketStep(stepId: string, ticketId: string, subject: string, body?: string): LabStep {
  const detail = body ? ` ${body}` : '';
  return step(
    stepId,
    `Resolve ticket: ${subject}`,
    `Resolve the "${subject}" ticket in the Ticket Console. Verify access is restored and document the resolution.${detail}`,
    { kind: 'ticket-resolved', params: { ticketId } },
    { exec: 8, comms: 2 },
  );
}

/** Shared seed builder that creates N mixed-kind tickets on top of baseline.
 * Guarantees every entry in ticketConfigs becomes a real ticket in the queue,
 * even if the requested username isn't in the directory — falls back to the
 * canonical 'admin' user so the ticket count the learner sees in the Ticket
 * Console always equals the lab's declared ticketCount. */
function buildBatchSeed(
  ctx: SeedContext,
  ticketIds: string[],
  ticketConfigs: Array<{
    id: string;
    kind:
      | 'onboarding'
      | 'mover'
      | 'leaver'
      | 'transfer'
      | 'termination'
      | 'access-request'
      | 'password-reset'
      | 'mfa-issue'
      | 'incident';
    subject: string;
    body: string;
    /** Who FILED the ticket. */
    username: string;
    /**
     * Who the ticket is ABOUT, when that differs from the requester — a
     * helpdesk agent filing for a CFO, a manager offboarding a contractor.
     * The payload and relatedUserIds follow this, not the requester, so
     * resolving the ticket acts on the right person.
     */
    subjectUsername?: string;
    /**
     * Provision the subject if the directory does not already have them. Some
     * tickets ask the learner to act on an account the seed never created —
     * an offboard for a contractor who does not exist is unresolvable.
     */
    seedSubject?: { displayName: string; department: string; title: string };
    /**
     * Evidence the ticket's prose claims exists. A ticket that talks about
     * failed sign-ins or a locked account must be investigable: without this
     * the learner opens the audit log looking for attempts that were never
     * recorded, or tries to unlock an account that was never locked.
     */
    evidence?: {
      /** Emit this many signin.failure events for the subject. */
      failedSignIns?: number;
      /** Source address recorded on those events. */
      fromIp?: string;
      /** Follow the failures with a success — the credential-stuffing shape. */
      thenSuccess?: boolean;
      /** Put the subject's account into the 'locked' state. */
      lockAccount?: boolean;
      /**
       * Open a real session for the subject.
       *
       * A ticket that says "revoke the active sessions" needs there to be
       * one: revoking nothing records nothing, and the review then sees an
       * account nobody has touched however faithfully the learner followed
       * the instruction.
       */
      openSession?: boolean;
      /**
       * Put the subject in these groups first. For the access-review tickets,
       * whose whole subject is access the account should not have.
       */
      inGroups?: string[];
      /**
       * Disable the account first — for tickets about an account already
       * terminated (a session that outlived it). Done after openSession.
       */
      disableAccount?: boolean;
      /** Third-party OAuth grants the subject has consented to — for token-theft tickets. */
      oauthGrants?: { appName: string; publisher: string; clientId: string; scopes: string[] }[];
    };
    priority?: 'low' | 'normal' | 'high' | 'urgent';
  }>,
): void {
  applyBaseline(ctx.dir, ctx.idp, ctx.apps);
  const fallbackRequester =
    ctx.dir.getUserByUsername('admin')?.id ??
    ctx.dir.listUsers()[0]?.id ??
    // Last-resort: synthesize a stable id. The ticket still appears in the
    // queue; only the requesterId reference may not resolve to a real user
    // in the directory, which doesn't affect ticket-resolved validation.
    ('system' as never);
  for (let i = 0; i < ticketConfigs.length; i++) {
    const cfg = ticketConfigs[i]!;
    const requesterId = ctx.dir.getUserByUsername(cfg.username)?.id ?? fallbackRequester;

    // Who the ticket is about, and no fallback to the requester.
    //
    // subjectUsername ?? username read as a convenience and behaved as a
    // liability: a ticket that did not say who it was about was filed against
    // whoever reported it, so resolving a ransomware ticket disabled the
    // colleague who phoned it in, and a cross-training request granted the
    // access to somebody terminated two tickets earlier. A ticket with no
    // stated subject has none, and the review finds the person by the name in
    // the text instead.
    // Most tickets are reported by the person they are about, and falling
    // back to the requester is right for those — but only for those, and the
    // text is what decides. A ticket that never mentions the requester is not
    // about them.
    const mentionsRequester = `${cfg.subject} ${cfg.body}`
      .toLowerCase()
      .includes(cfg.username.toLowerCase());
    const subjectName = cfg.subjectUsername ?? (mentionsRequester ? cfg.username : undefined);
    let subject = subjectName ? ctx.dir.getUserByUsername(subjectName) : undefined;
    if (!subject && subjectName && cfg.seedSubject) {
      subject = ctx.dir.ensureUser({
        username: subjectName,
        displayName: cfg.seedSubject.displayName,
        email: `${subjectName}@northwind.example`,
        department: cfg.seedSubject.department,
        title: cfg.seedSubject.title,
        mfa: 'none',
      });
    }
    // No fallback to the requester. An onboarding ticket has no subject
    // account yet — that is the work — and naming the requester instead meant
    // the review checked the wrong person: it failed a joiner ticket because
    // the manager who filed it had been disabled by an incident ticket
    // elsewhere in the same queue. A payload with no userId is honest; the
    // review then finds the joiner by the name in the text once created.
    const subjectId = subject?.id;

    // Set the scene BEFORE raising the ticket.
    //
    // The failed sign-ins and the lockout are the story the ticket reports,
    // so they belong in the past when it is filed. Recording them afterwards
    // stamped them later than createdAt, and the review — which counts work
    // done since the ticket was raised — read the incident's own symptoms as
    // the learner's remediation. The ticket could then be resolved without
    // anybody touching it.
    if (cfg.evidence && subject) {
      const ev = cfg.evidence;
      // Back-dated, not merely ordered. Both the events and the ticket would
      // otherwise land in the same millisecond, and "since the ticket was
      // raised" is decided by >=. An hour ago is also how it reads on the
      // timeline: the attempts happened, then somebody filed a ticket.
      const SCENE_START = Date.now() - 60 * 60 * 1000;
      const failures = ev.failedSignIns ?? 0;
      for (let n = 0; n < failures; n++) {
        ctx.audit.record({
          actorId: subject.id,
          action: 'signin.failure',
          targetId: subject.id,
          at: SCENE_START + n * 1000,
          ...(ev.fromIp ? { ip: ev.fromIp } : {}),
        });
      }
      if (ev.thenSuccess) {
        ctx.audit.record({
          actorId: subject.id,
          action: 'signin.success',
          targetId: subject.id,
          at: SCENE_START + failures * 1000,
          ...(ev.fromIp ? { ip: ev.fromIp } : {}),
        });
      }
      if (ev.inGroups) {
        for (const name of ev.inGroups) {
          const g = ctx.dir.getGroupByName(name);
          if (!g) continue;
          ctx.dir.addToGroup(subject.id, g.id, SYSTEM_ACTOR);
          // Back-date the grant. It happened months ago, for a project that
          // finished — that is the whole story of an access-review ticket.
          // Left at now() it lands in the same millisecond as the ticket, and
          // the review reads the stale access as the learner's own work: the
          // ticket then closed itself the moment it was raised.
          const granted = ctx.audit.events[ctx.audit.events.length - 1];
          if (granted && granted.action === 'group.add') {
            granted.at = SCENE_START - 90 * 24 * 60 * 60 * 1000;
          }
        }
      }
      if (ev.openSession) {
        // Before the account is locked, if it is going to be: signIn refuses
        // a locked account, and then there would be no session to revoke.
        ctx.idp.seedPasswords({ [subject.username]: 'Passw0rd!' });
        ctx.idp.signIn(subject.username, 'Passw0rd!');
      }
      for (const g of ev.oauthGrants ?? []) {
        ctx.oauthGrants?.seedGrant({
          ...g,
          grantedByUserId: subject.id,
          grantedAt: SCENE_START - 14 * 24 * 60 * 60 * 1000,
        });
      }
      if (ev.disableAccount) {
        ctx.dir.disableUser(subject.id, SYSTEM_ACTOR, 'terminated');
        const d = ctx.audit.events[ctx.audit.events.length - 1];
        if (d && d.action === 'user.disabled') d.at = SCENE_START - 3 * 24 * 60 * 60 * 1000;
      }
      if (ev.lockAccount) {
        // 'locked', not 'disabled': they are different states with different
        // remedies, and Unlock-ADAccount refuses a disabled account.
        subject.status = 'locked';
      }
    }

    // Use a permissive payload — the real TicketKind type is large and
    // varies per kind. For ticket-resolution lab purposes, the validator
    // only matches by id, so a minimal payload is sufficient.
    ctx.tickets.create({
      id: ticketIds[i] as ReturnType<typeof mkTicketId>,
      kind: cfg.kind,
      requesterId,
      subject: cfg.subject,
      body: cfg.body,
      priority: cfg.priority ?? 'normal',
      // userId is the SUBJECT, not the requester — pointing it at whoever
      // filed the ticket meant resolving it would act on the wrong account.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      payload: { ...(subjectId ? { userId: subjectId } : {}), method: 'helpdesk' } as any,
      relatedUserIds: subject ? [subject.id] : [],
    });
  }
}

const BATCH_TICKET_IDS = (count: number, prefix: string): string[] =>
  Array.from({ length: count }, (_, i) => `${prefix}-${String(i + 1).padStart(3, '0')}`);

void BATCH_TICKET_IDS; // used by the seed registration loop below

export const BATCH_TEMPLATES: BatchTemplate[] = [
  // ── 10-ticket Help Desk queue ───────────────────────────────────────────
  {
    id: 'ticket-queue-10',
    zoneId: 'help-desk',
    label: 'Help Desk Queue (10 tickets)',
    ticketCount: 10,
    seed(ctx, ticketIds) {
      const configs = [
        {
          id: ticketIds[0]!,
          kind: 'onboarding' as const,
          subject: 'New hire onboarding: Devin Park',
          subjectUsername: 'devin.park',
          body: 'Please create an account for Devin Park (devin.park), a new developer starting Monday. Department Engineering, title Junior Developer. Add devin.park to grp-engineering-dev. It is a contractor account with a 90-day expiry.',
          username: 'alex.morgan',
          priority: 'high' as const,
        },
        {
          id: ticketIds[1]!,
          kind: 'password-reset' as const,
          subject: 'Password reset for Bob Sato',
          body: 'Bob Sato (bob.sato, bob.sato@northwind.example) cannot log in. He has forgotten his password. Please reset it and provide a temporary password via secure channel.',
          username: 'bob.sato',
          priority: 'normal' as const,
        },
        {
          id: ticketIds[2]!,
          kind: 'access-request' as const,
          subject: 'Finance Portal access for Cara Patel',
          body: 'Cara Patel (cara.patel, HR Business Partner) requires access to the Finance Portal application. Grant her membership in grp-finance-payroll so she can process payroll reports.',
          username: 'cara.patel',
          priority: 'normal' as const,
        },
        {
          id: ticketIds[3]!,
          kind: 'mfa-issue' as const,
          subject: 'MFA reset for Dan Rivera',
          body: 'Dan Rivera (dan.rivera) reports his TOTP authenticator app shows "invalid code" errors on every sign-in attempt. Please reset his MFA enrollment and instruct him to re-enroll.',
          username: 'dan.rivera',
          priority: 'high' as const,
        },
        {
          id: ticketIds[4]!,
          kind: 'onboarding' as const,
          subject: 'Contractor account for Maya Torres',
          subjectUsername: 'maya.torres',
          body: 'Maya Torres is a contractor starting next week as a QA Engineer. Create a time-limited account expiring in 60 days. Username: maya.torres. Email: maya.torres@northwind.example. Add to grp-engineering-qa only.',
          username: 'erin.cho',
          priority: 'normal' as const,
        },
        {
          id: ticketIds[5]!,
          kind: 'access-request' as const,
          subject: 'Remove Finn Müller from grp-legacy-hr',
          body: 'Finn Müller (finn.muller) no longer needs access to the legacy HR system. Please remove his account from grp-legacy-hr. His current role no longer requires this access.',
          username: 'finn.muller',
          priority: 'low' as const,
        },
        {
          id: ticketIds[6]!,
          kind: 'password-reset' as const,
          subject: 'Account locked out: Greta Olsen',
          body: "Greta Olsen's account (greta.olsen) is locked after too many failed sign-in attempts. Please reset her password and unlock her account. She is the CFO and needs access restored urgently.",
          username: 'greta.olsen',
          subjectUsername: 'greta.olsen',
          evidence: { failedSignIns: 5, fromIp: '10.20.4.88', lockAccount: true },
          priority: 'urgent' as const,
        },
        {
          id: ticketIds[7]!,
          kind: 'transfer' as const,
          subject: "Transfer: Hank O'Neill from Engineering to IT Support",
          body: "Hank O'Neill (hank.oneill) is moving from Server Administration to the Help Desk. Remove him from grp-server-admins and from grp-domain-admins. Add him to grp-helpdesk-tier1. He keeps no administrative access in the new role.",
          username: 'hank.oneill',
          priority: 'normal' as const,
        },
        {
          id: ticketIds[8]!,
          kind: 'access-request' as const,
          subject: 'Temporary Analytics Dashboard access for Ivy Park',
          body: 'Ivy Park (ivy.park, Help Desk Manager) needs 30-day read-only access to the Analytics Dashboard for a cross-department project. Grant her grp-analytics-readers membership, expiring in 30 days.',
          username: 'ivy.park',
          priority: 'normal' as const,
        },
        {
          id: ticketIds[9]!,
          kind: 'mfa-issue' as const,
          subject: 'MFA re-enrollment: Jane Doe got a new phone',
          body: 'Jane Doe (jane.doe) got a new phone and needs to re-enroll in MFA. Her old device is no longer available. Please reset her TOTP enrollment so she can register her new device.',
          username: 'jane.doe',
          priority: 'normal' as const,
        },
      ];
      buildBatchSeed(ctx, ticketIds, configs);
    },
    buildLab(flavor, ticketIds) {
      const subjects = [
        'New hire onboarding: Devin Park',
        'Password reset for Bob Sato',
        'Finance Portal access for Cara Patel',
        'MFA reset for Dan Rivera',
        'Contractor account for Maya Torres',
        'Remove Finn Müller from grp-legacy-hr',
        'Account locked out: Greta Olsen',
        "Transfer: Hank O'Neill from Engineering to IT Support",
        'Temporary Analytics Dashboard access for Ivy Park',
        'MFA re-enrollment: Jane Doe got a new phone',
      ];
      const steps = ticketIds.map((id, i) => ticketStep(`s${i + 1}`, id, subjects[i]!));
      steps.forEach((s, i) => {
        s.brief = `Resolve the "${subjects[i]}" ticket in the Ticket Console. Verify access is restored and document the resolution.`;
      });
      return baseLab(
        { id: this.id, zoneId: this.zoneId, targetDisplayName: 'the Help Desk Queue' },
        flavor,
        steps,
        {
          title: 'Help Desk Queue: 10 Tickets',
          durationMinutes: 45,
          extraObjectives: [
            {
              id: 'o0',
              description: 'Triage all 10 tickets and prioritize by urgency',
              points: 10,
              category: 'exec',
            },
            {
              id: 'oT',
              description: 'Resolve all tickets in the Ticket Console',
              points: 0,
              category: 'exec',
            },
          ],
        },
      );
    },
  },

  // ── 15-ticket IAM Ops queue ─────────────────────────────────────────────
  {
    id: 'ticket-queue-15',
    zoneId: 'iam-ops',
    label: 'IAM Ops Queue (15 tickets)',
    ticketCount: 15,
    seed(ctx, ticketIds) {
      const configs = [
        {
          id: ticketIds[0]!,
          kind: 'leaver' as const,
          subject: 'Terminate Alex Morgan (departing employee)',
          body: 'Alex Morgan (alex.morgan, alex.morgan@northwind.example) is leaving the company today. Disable their account immediately, revoke all active sessions, and remove them from all groups.',
          username: 'alex.morgan',
          evidence: { openSession: true },
          priority: 'urgent' as const,
        },
        {
          id: ticketIds[1]!,
          kind: 'password-reset' as const,
          subject: 'Executive password reset: Greta Olsen (CFO)',
          body: 'Greta Olsen (greta.olsen) is locked out after repeated failed sign-ins, and she is the CFO. Unlock the account and reset her password, then pass the temporary password to her by phone — not by email.',
          username: 'bob.sato',
          subjectUsername: 'greta.olsen',
          evidence: { failedSignIns: 6, fromIp: '10.20.7.14', lockAccount: true },
          priority: 'urgent' as const,
        },
        {
          id: ticketIds[2]!,
          kind: 'access-request' as const,
          subject: 'Production DB read access for Cara Patel',
          body: 'Cara Patel (cara.patel) is requesting read-only access to the production PostgreSQL database for a quarterly audit. Grant her the role role-db-prod-readonly. Manager approved: Ivy Park.',
          username: 'cara.patel',
          priority: 'high' as const,
        },
        {
          id: ticketIds[3]!,
          kind: 'mfa-issue' as const,
          subject: 'MFA device replacement for Dan Rivera',
          body: 'Dan Rivera (dan.rivera) has lost his authenticator device. He needs a temporary MFA bypass to enroll a new device. Enable bypass for 24 hours, then confirm re-enrollment.',
          username: 'dan.rivera',
          priority: 'high' as const,
        },
        {
          id: ticketIds[4]!,
          kind: 'onboarding' as const,
          subject: 'VP of Sales onboarding: Marcus Chen',
          subjectUsername: 'marcus.chen',
          body: 'Marcus Chen starts tomorrow as VP of Sales. Create his account (marcus.chen). Title: VP of Sales, Department: Sales. Add to grp-sales-executives and grp-all-employees. Full IAM provisioning needed.',
          username: 'erin.cho',
          priority: 'high' as const,
        },
        {
          id: ticketIds[5]!,
          kind: 'access-request' as const,
          subject: 'PCI compliance group for Finance team',
          body: 'Finance needs a PCI-scoped access group for the upcoming PCI DSS audit. Create grp-finance-pci, then add finn.muller and greta.olsen to grp-finance-pci. Nobody else goes in it.',
          username: 'finn.muller',
          priority: 'normal' as const,
        },
        {
          id: ticketIds[6]!,
          kind: 'transfer' as const,
          subject: 'Promotion: Greta Olsen promoted to IAM Admin',
          body: 'Greta Olsen (greta.olsen) has been promoted to IAM Admin. Remove her from grp-finance-payroll. Add her to grp-iam-admins. Her finance access does not carry over.',
          username: 'greta.olsen',
          priority: 'normal' as const,
        },
        {
          id: ticketIds[7]!,
          kind: 'password-reset' as const,
          subject: 'Service account password rotation: svc-backup',
          body: 'The automated backup job (svc-backup) failed because its service account password expired. Rotate the password for svc-backup and update the credential in the backup scheduler. Priority: production impact.',
          username: 'hank.oneill',
          subjectUsername: 'svc-backup',
          priority: 'high' as const,
        },
        {
          id: ticketIds[8]!,
          kind: 'mfa-issue' as const,
          subject: 'VPN MFA loop for Ivy Park',
          body: 'Ivy Park (ivy.park) is stuck in an MFA challenge loop when connecting to the corporate VPN. The push notification keeps looping. Please reset her VPN MFA enrollment and re-enroll her device.',
          username: 'ivy.park',
          priority: 'high' as const,
        },
        {
          id: ticketIds[9]!,
          kind: 'onboarding' as const,
          subject: 'Summer intern onboarding: Bella Santos (first of five)',
          subjectUsername: 'bella.santos',
          body: 'Five summer interns start next Monday and the first one needs an account today: Bella Santos (bella.santos), department Engineering, 90-day expiry. Create the account and add bella.santos to grp-engineering-dev. The other four follow once their paperwork clears.',
          username: 'jane.doe',
          priority: 'normal' as const,
        },
        {
          id: ticketIds[10]!,
          kind: 'access-request' as const,
          subject: "Cross-training access for Hank O'Neill to Sales",
          body: "Manager Ivy Park requests 2-week read-only access for Hank O'Neill (hank.oneill) to the Sales team's shared resources. Add hank.oneill to grp-sales-readonly.",
          username: 'ivy.park',
          // The ticket is written about Hank and was filed against Alex, who
          // is terminated two tickets earlier in the same queue: resolving it
          // granted the departed account fresh access, and the termination
          // that had already been done correctly then failed its review.
          subjectUsername: 'hank.oneill',
          priority: 'low' as const,
        },
        {
          id: ticketIds[11]!,
          kind: 'leaver' as const,
          subject: 'Contractor offboard: Sam Nguyen',
          body: 'Contractor Sam Nguyen (sam.nguyen) project ended. Disable their account (sam.nguyen), revoke all sessions, and remove from grp-engineering-dev within 24 hours.',
          username: 'bob.sato',
          subjectUsername: 'sam.nguyen',
          evidence: { inGroups: ['grp-engineering-dev'], openSession: true },
          seedSubject: {
            displayName: 'Sam Nguyen',
            department: 'Engineering',
            title: 'Contractor',
          },
          priority: 'normal' as const,
        },
        {
          id: ticketIds[12]!,
          kind: 'password-reset' as const,
          subject: 'New hire first-day access: Cara Patel',
          body: 'Cara Patel (cara.patel, HR Business Partner) cannot log in on her first day. Her account was created yesterday. Please verify the account is active and reset her password.',
          username: 'cara.patel',
          priority: 'high' as const,
        },
        {
          id: ticketIds[13]!,
          kind: 'mfa-issue' as const,
          subject: 'SMS MFA codes not arriving for Dan Rivera',
          body: 'Dan Rivera (dan.rivera) reports that SMS MFA codes never arrive on his mobile. Delivery to his carrier is unreliable, so move him off SMS: reset his MFA enrollment and re-enroll him on TOTP.',
          username: 'dan.rivera',
          priority: 'normal' as const,
        },
        {
          id: ticketIds[14]!,
          kind: 'access-request' as const,
          subject: 'Jira admin rights for Erin Cho',
          body: 'Erin Cho (erin.cho) is setting up a new Jira project and needs Jira admin rights. Grant her the role role-jira-admin. Manager approved: Ivy Park. Duration: ongoing.',
          username: 'erin.cho',
          priority: 'normal' as const,
        },
      ];
      buildBatchSeed(ctx, ticketIds, configs);
    },
    buildLab(flavor, ticketIds) {
      const subjects = [
        'Terminate Alex Morgan (departing employee)',
        'Executive password reset: Greta Olsen (CFO)',
        'Production DB read access for Cara Patel',
        'MFA device replacement for Dan Rivera',
        'VP of Sales onboarding: Marcus Chen',
        'PCI compliance group for Finance team',
        'Promotion: Greta Olsen promoted to IAM Admin',
        'Service account password rotation: svc-backup',
        'VPN MFA loop for Ivy Park',
        'Bulk hire: 5 summer interns (Engineering)',
        "Cross-training access for Hank O'Neill to Sales",
        'Contractor offboard: Sam Nguyen',
        'New hire first-day access: Cara Patel',
        'SMS MFA codes not arriving for Dan Rivera',
        'Jira admin rights for Erin Cho',
      ];
      const steps = ticketIds.map((id, i) => ticketStep(`s${i + 1}`, id, subjects[i]!));
      return baseLab(
        { id: this.id, zoneId: this.zoneId, targetDisplayName: 'the IAM Ops Queue' },
        flavor,
        steps,
        {
          title: 'IAM Ops Queue: 15 Tickets',
          durationMinutes: 60,
          extraObjectives: [
            {
              id: 'o0',
              description: 'Triage all 15 tickets by priority (urgent → low)',
              points: 15,
              category: 'exec',
            },
            {
              id: 'oT',
              description: 'Resolve all tickets and document each action',
              points: 0,
              category: 'exec',
            },
          ],
        },
      );
    },
  },

  // ── 20-ticket SecOps escalation queue ──────────────────────────────────
  {
    id: 'ticket-queue-20',
    zoneId: 'sec-ops',
    label: 'SecOps Escalation Queue (20 tickets)',
    ticketCount: 20,
    seed(ctx, ticketIds) {
      const configs = [
        {
          id: ticketIds[0]!,
          kind: 'incident' as const,
          subject: 'Credential stuffing attack: 50 failed logins from 185.220.101.x',
          subjectUsername: 'greta.olsen',
          body: 'Fifty failed sign-ins in five minutes from 185.220.101.x, against Finance accounts. The edge team is blocking the address. Your part: for the targeted account greta.olsen, revoke the active sessions and reset the password, so a guessed credential is worth nothing.',
          username: 'alex.morgan',
          // The stuffed credential worked once: there is a session to revoke.
          evidence: {
            failedSignIns: 12,
            fromIp: '185.220.101.44',
            thenSuccess: true,
            openSession: true,
          },
          priority: 'urgent' as const,
        },
        {
          id: ticketIds[1]!,
          kind: 'incident' as const,
          subject: "Ransomware infection: Cara Patel's workstation",
          subjectUsername: 'cara.patel',
          body: 'Cara Patel (cara.patel) reports a ransom note on her workstation. Desktop support has the machine. Your part: disable her account (cara.patel) and revoke all active sessions, so the credential is worthless while the machine is quarantined.',
          username: 'bob.sato',
          evidence: { openSession: true },
          priority: 'urgent' as const,
        },
        {
          id: ticketIds[2]!,
          kind: 'mfa-issue' as const,
          subject: 'Suspicious MFA bypass for Greta Olsen (CFO account)',
          body: 'An MFA bypass was requested for greta.olsen at 02:47 AM from a device nobody recognises, and the CFO is not in the office. Treat the enrollment as compromised: reset her MFA enrollment and re-enroll her on TOTP.',
          username: 'cara.patel',
          subjectUsername: 'greta.olsen',
          priority: 'urgent' as const,
        },
        {
          id: ticketIds[3]!,
          kind: 'leaver' as const,
          subject: 'Immediate offboard: Dan Rivera — HR flagged',
          body: 'HR has flagged Dan Rivera (dan.rivera) for immediate termination per management request. Disable account, revoke all sessions, remove from all groups, and revoke any application tokens NOW.',
          username: 'dan.rivera',
          evidence: { openSession: true },
          priority: 'urgent' as const,
        },
        {
          id: ticketIds[4]!,
          kind: 'access-request' as const,
          subject: 'Unauthorized admin role on svc-deploy service account',
          body: 'The monthly audit found the svc-deploy service account holding grp-domain-admins, which a deployment account has no business in. Check the audit log for who added it, then remove svc-deploy from grp-domain-admins.',
          username: 'erin.cho',
          subjectUsername: 'svc-deploy',
          seedSubject: { displayName: 'svc-deploy', department: 'IT', title: 'Service Account' },
          // The finding itself: without it there was nothing to remove.
          evidence: { inGroups: ['grp-domain-admins'] },
          priority: 'high' as const,
        },
        {
          id: ticketIds[5]!,
          kind: 'password-reset' as const,
          subject: 'Phishing: Finn Müller clicked link',
          body: 'Finn Müller (finn.muller) reported clicking a phishing link in an email. His credentials may be compromised. Reset his password immediately, revoke all active sessions, and confirm MFA is enforced.',
          username: 'finn.muller',
          evidence: { openSession: true },
          priority: 'high' as const,
        },
        {
          id: ticketIds[6]!,
          kind: 'incident' as const,
          subject: 'Stale session: ivy.park session active after termination',
          body: "Ivy Park's (ivy.park) account was terminated three days ago, but a session against the HR Portal is still valid. Revoke all her active sessions and confirm the account is disabled.",
          username: 'greta.olsen',
          subjectUsername: 'ivy.park',
          // Terminated three days ago, with a session that outlived it.
          evidence: { openSession: true, disableAccount: true },
          priority: 'high' as const,
        },
        {
          id: ticketIds[7]!,
          kind: 'incident' as const,
          subject: 'Dormant account used after 90 days idle: hank.oneill',
          body: "Hank O'Neill's account (hank.oneill) had no sign-in activity for 90 days, then signed in at 14:22 today from an address nobody recognises. Hank is on leave and unreachable. Disable the account and revoke its sessions until he confirms it was him.",
          username: 'hank.oneill',
          evidence: { thenSuccess: true, fromIp: '45.83.64.12', openSession: true },
          priority: 'high' as const,
        },
        {
          id: ticketIds[8]!,
          kind: 'password-reset' as const,
          subject: 'Password leak: svc-admin shared credentials on GitHub',
          body: 'The shared admin credential for svc-admin was found in a public GitHub repository (repo: northwind/devops, commit: a3f9c2d). Rotate the password immediately and update the credential in all systems that use it.',
          username: 'ivy.park',
          subjectUsername: 'svc-admin',
          seedSubject: { displayName: 'svc-admin', department: 'IT', title: 'Service Account' },
          priority: 'urgent' as const,
        },
        {
          id: ticketIds[9]!,
          kind: 'mfa-issue' as const,
          subject: 'MFA push fatigue attack: Jane Doe receiving 100+ notifications',
          body: 'Jane Doe (jane.doe) has had over 100 MFA push notifications in the past hour - a push fatigue attack. Take her off push: reset her MFA enrollment and re-enroll her on TOTP.',
          username: 'jane.doe',
          priority: 'high' as const,
        },
        {
          id: ticketIds[10]!,
          kind: 'incident' as const,
          subject: 'OAuth token theft: third-party app "QuickReports" using stolen tokens',
          // A session to revoke. Without one the instruction is a no-op that
          // records nothing, and the ticket cannot be closed.
          evidence: {
            openSession: true,
            oauthGrants: [
              {
                appName: 'QuickReports',
                publisher: 'QuickReports Inc. (unverified)',
                clientId: 'quickreports-app',
                scopes: ['Mail.Read', 'Files.Read.All', 'offline_access'],
              },
            ],
          },
          body: 'Security team detected the third-party app "QuickReports" using OAuth tokens belonging to alex.morgan. Tokens were likely stolen via a phishing campaign. Revoke all OAuth tokens for alex.morgan, contact QuickReports support, and audit other compromised accounts.',
          username: 'alex.morgan',
          priority: 'high' as const,
        },
        {
          id: ticketIds[11]!,
          kind: 'access-request' as const,
          subject: 'Privilege creep: cara.patel holds access beyond her role',
          body: 'The Q3 access review flagged Cara Patel (cara.patel): she is in grp-finance-payroll, which an HR Business Partner has no need of — it was granted for a project that finished. Remove her from grp-finance-payroll and note the change.',
          // The access the ticket is about, so there is something to take
          // away. The ticket said she held too much; the seed had put her in
          // one group, which her role needs.
          evidence: { inGroups: ['grp-finance-payroll'] },
          username: 'bob.sato',
          subjectUsername: 'cara.patel',
          priority: 'normal' as const,
        },
        {
          id: ticketIds[12]!,
          kind: 'password-reset' as const,
          subject: 'Brute force attack: 1,000 attempts from 198.51.100.50',
          body: 'A brute force run from 198.51.100.50 made over a thousand attempts against Finance and HR accounts, and the address is already blocked at the edge. It hit cara.patel hardest and the account is locked out. Unlock it, force a password reset, and revoke the active sessions on it.',
          username: 'cara.patel',
          evidence: { failedSignIns: 15, fromIp: '198.51.100.50', lockAccount: true },
          priority: 'high' as const,
        },
        {
          id: ticketIds[13]!,
          kind: 'mfa-issue' as const,
          subject: 'FIDO2 hardware key not registering: Dan Rivera',
          body: 'Dan Rivera (dan.rivera) has a new YubiKey (serial YK-8821-44190) that will not register while his old enrollment is still in place. Reset his MFA enrollment and re-enroll him, so the new key can be registered.',
          username: 'dan.rivera',
          priority: 'normal' as const,
        },
        {
          id: ticketIds[14]!,
          kind: 'leaver' as const,
          subject: 'Contractor offboard: Sam Nguyen — project ended',
          body: 'Contractor Sam Nguyen (sam.nguyen) project ended today. Remove sam.nguyen from grp-engineering-dev, grp-build-servers, and any other groups. Disable the account and confirm all access is revoked within 24 hours.',
          username: 'erin.cho',
          subjectUsername: 'sam.nguyen',
          // What the ticket asks to take away.
          evidence: { inGroups: ['grp-engineering-dev', 'grp-build-servers'] },
          seedSubject: {
            displayName: 'Sam Nguyen',
            department: 'Engineering',
            title: 'Contractor',
          },
          priority: 'normal' as const,
        },
        {
          id: ticketIds[15]!,
          kind: 'password-reset' as const,
          subject: 'Password policy non-compliance: Greta Olsen (CFO) account',
          body: "Greta Olsen's (greta.olsen) password does not meet the new complexity requirements of 12 characters and a symbol. Reset her password to a compliant value, and hand it to her in person — not by email or chat.",
          username: 'finn.muller',
          subjectUsername: 'greta.olsen',
          priority: 'high' as const,
        },
        {
          id: ticketIds[16]!,
          kind: 'access-request' as const,
          subject: 'Partner project: Erin Cho cannot open the Analytics Dashboard',
          subjectUsername: 'erin.cho',
          body: 'Erin Cho (erin.cho) is running the Contoso partner project and cannot open the Analytics Dashboard: she signs in, and the application refuses her. That access is granted by group - add her to grp-analytics-readers.',
          username: 'greta.olsen',
          priority: 'normal' as const,
        },
        {
          id: ticketIds[17]!,
          kind: 'access-request' as const,
          subject: 'Hank O.Neill cannot sign in to the Jenkins build server',
          body: "Hank O'Neill (hank.oneill) cannot sign in to the Jenkins build server. Jenkins authorises on group membership, and he is not in grp-build-servers. Add him to grp-build-servers, which is what his server administration work needs.",
          username: 'hank.oneill',
          priority: 'normal' as const,
        },
        {
          id: ticketIds[18]!,
          kind: 'onboarding' as const,
          subject: 'Acme acquisition: provision the first engineer, Priya Raman',
          body: 'Acme Corp acquisition: the first engineer transfers today, the rest follow next week. Create an account for Priya Raman (priya.raman), department Engineering, and add her to grp-engineering-dev. Set a temporary password and force a change at first sign-in.',
          username: 'ivy.park',
          // The joiner, who does not exist yet — that is the work. Without
          // this the subject fell back to the requester, so the review of an
          // onboarding ticket checked Ivy Park's account instead, and failed
          // it for being disabled by an unrelated incident ticket in the same
          // queue.
          subjectUsername: 'priya.raman',
          priority: 'normal' as const,
        },
        {
          id: ticketIds[19]!,
          kind: 'access-request' as const,
          subject: 'Q3 access review remediation: start with finn.muller',
          subjectUsername: 'finn.muller',
          body: 'The Q3 access review flagged several accounts carrying access their role no longer justifies. Start with the clearest: Finn Muller (finn.muller) is still in grp-legacy-hr from a previous role. Remove that membership and record the change.',
          username: 'jane.doe',
          priority: 'normal' as const,
        },
      ];
      buildBatchSeed(ctx, ticketIds, configs);
    },
    buildLab(flavor, ticketIds) {
      const subjects = [
        'Credential stuffing attack: 50 failed logins from 185.220.101.x',
        "Ransomware infection: Cara Patel's workstation",
        'Suspicious MFA bypass for Greta Olsen (CFO account)',
        'Immediate offboard: Dan Rivera — HR flagged',
        'Unauthorized admin role on svc-deploy service account',
        'Phishing: Finn Müller clicked link',
        'Stale session: ivy.park session active after termination',
        'Dormant account reactivation: hank.oneill (90 days inactive)',
        'Password leak: svc-admin shared credentials on GitHub',
        'MFA push fatigue attack: Jane Doe receiving 100+ notifications',
        'OAuth token theft: third-party app "QuickReports" using stolen tokens',
        'Privilege creep: cara.patel has 47 group memberships',
        'Brute force attack: 1,000 attempts from 198.51.100.50',
        'FIDO2 hardware key not registering: Dan Rivera',
        'Contractor offboard: Sam Nguyen — project ended',
        'Password policy non-compliance: Greta Olsen (CFO) account',
        'SSO failure: partner company Contoso reports SAML login failing',
        'SAML assertion failure: hank.oneill cannot sign in to Jenkins',
        'Bulk provisioning: 50 new users from Acme Corp acquisition',
        'Q3 access review remediation: 23 over-privileged accounts',
      ];
      const steps = ticketIds.map((id, i) => ticketStep(`s${i + 1}`, id, subjects[i]!));
      return baseLab(
        { id: this.id, zoneId: this.zoneId, targetDisplayName: 'the SecOps Escalation Queue' },
        flavor,
        steps,
        {
          title: 'SecOps Escalation Queue: 20 Tickets',
          durationMinutes: 90,
          extraObjectives: [
            {
              id: 'o0',
              description: 'Triage 20 tickets: separate critical incidents from routine requests',
              points: 20,
              category: 'exec',
            },
            {
              id: 'oA',
              description:
                'Address critical security incidents first (attacks, leaks, insider threats)',
              points: 15,
              category: 'troubleshoot',
            },
            {
              id: 'oR',
              description: 'Resolve remaining routine tickets in priority order',
              points: 10,
              category: 'exec',
            },
            {
              id: 'oT',
              description: 'Document all actions taken in the audit log',
              points: 10,
              category: 'docs',
            },
          ],
        },
      );
    },
  },
];

// Register every template's seed function once, at module load, so a
// generated lab's startingSeed (its own template id) is always resolvable.
for (const t of LAB_TEMPLATES) {
  registerLabSeed(t.id, (ctx) => {
    if (t.seed) t.seed(ctx);
    else applyBaseline(ctx.dir, ctx.idp, ctx.apps);
    fileDailyTicket(ctx, dailyTicketOf(ctx._currentLab));
  });
}

// Register batch templates — reads _batchTicketIds from the Lab at start time
// so the IDs match what buildLab() used when creating the lab.
for (const bt of BATCH_TEMPLATES) {
  registerLabSeed(bt.id, (ctx) => {
    // No applyBaseline here: bt.seed applies it, and applying it twice is
    // what left the queues' group memberships one-sided.
    // Retrieve ticket IDs that were stored on the Lab object during generation.
    const ticketIds: string[] =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ctx._currentLab as any)?._batchTicketIds ??
      BATCH_TICKET_IDS(bt.ticketCount, `batch-${bt.id}`);
    bt.seed(ctx, ticketIds);
  });
}
