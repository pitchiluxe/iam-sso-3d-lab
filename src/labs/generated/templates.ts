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
import type { Lab, LabStep, LabObjective } from '@/domain';
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

export interface LabTemplate {
  id: string;
  zoneId: GeneratedZoneId;
  ticketTypeLabel: string;
  targetDisplayName: string;
  targetTitle: string;
  targetDept: string;
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

function baseLab(
  template: Pick<LabTemplate, 'id' | 'zoneId' | 'targetDisplayName'>,
  flavor: GeneratedFlavor,
  steps: LabStep[],
  options: { title?: string; durationMinutes?: number; extraObjectives?: LabObjective[] } = {},
): Lab {
  return {
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
}

export const LAB_TEMPLATES: LabTemplate[] = [
  {
    id: 'account-lockout',
    zoneId: 'help-desk',
    ticketTypeLabel: 'Account Lockout',
    targetDisplayName: 'Jane Doe',
    targetTitle: 'Junior Financial Analyst',
    targetDept: 'Finance',
    seed(ctx) {
      applyBaseline(ctx.dir, ctx.idp, ctx.apps);
      const user = ctx.dir.getUserByUsername('jane.doe');
      if (user) ctx.dir.disableUser(user.id, SYSTEM_ACTOR, 'locked out after failed attempts');
    },
    buildLab(flavor) {
      return baseLab(this, flavor, [
        step(
          's1',
          'Re-enable the locked-out account',
          `${flavor.narrative} Re-enable Jane Doe's account in IAM Console.`,
          { kind: 'user-enabled', params: { userId: 'jane.doe' } },
          { exec: 15, troubleshoot: 5 },
        ),
      ]);
    },
  },
  {
    id: 'new-hire-onboarding',
    zoneId: 'help-desk',
    ticketTypeLabel: 'New Hire Onboarding',
    targetDisplayName: 'a new hire',
    targetTitle: 'New Employee',
    targetDept: 'Engineering',
    buildLab(flavor, usedNames) {
      const name = pickUnusedName(usedNames);
      return baseLab({ ...this, targetDisplayName: name.displayName }, flavor, [
        step(
          's1',
          'Create the new hire’s account',
          `${flavor.narrative} Create an account for ${name.displayName} in IAM Console.`,
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
      ]);
    },
  },
  {
    id: 'offboarding',
    zoneId: 'help-desk',
    ticketTypeLabel: 'Employee Offboarding',
    targetDisplayName: 'Dan Rivera',
    targetTitle: 'Help Desk Tier 1',
    targetDept: 'IT',
    seed(ctx) {
      applyBaseline(ctx.dir, ctx.idp, ctx.apps);
      ctx.idp.signIn('dan.rivera', 'dan.rivera123');
    },
    buildLab(flavor) {
      return baseLab(this, flavor, [
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
      ]);
    },
  },
  {
    id: 'promotion-role-change',
    zoneId: 'help-desk',
    ticketTypeLabel: 'Promotion / Role Change',
    targetDisplayName: 'Ivy Park',
    targetTitle: 'Help Desk Manager',
    targetDept: 'IT',
    buildLab(flavor) {
      return baseLab(this, flavor, [
        step(
          's1',
          'Remove the old team membership',
          `${flavor.narrative} Remove Ivy Park from grp-helpdesk-tier1.`,
          { kind: 'group-removed', params: { userId: 'ivy.park', groupId: 'grp-helpdesk-tier1' } },
          { exec: 10, 'least-privilege': 5 },
        ),
        step(
          's2',
          'Add the new team membership',
          'Add Ivy Park to grp-iam-admins to match her new role.',
          { kind: 'group-added', params: { userId: 'ivy.park', groupId: 'grp-iam-admins' } },
          { exec: 10 },
        ),
      ]);
    },
  },
  {
    id: 'mfa-device-lost',
    zoneId: 'iam-ops',
    ticketTypeLabel: 'Lost MFA Device',
    targetDisplayName: 'Finn Müller',
    targetTitle: 'Security Operations Analyst',
    targetDept: 'Security',
    buildLab(flavor) {
      return baseLab(this, flavor, [
        step(
          's1',
          'Reset and re-verify MFA',
          `${flavor.narrative} Reset Finn Müller's MFA, then verify sign-in to confirm re-enrollment.`,
          { kind: 'mfa-challenge-completed', params: { userId: 'finn.muller' } },
          { exec: 15, troubleshoot: 5 },
        ),
      ]);
    },
  },
  {
    id: 'suspicious-signin',
    zoneId: 'sec-ops',
    ticketTypeLabel: 'Suspicious Sign-In',
    targetDisplayName: "Hank O'Neill",
    targetTitle: 'Server Administrator',
    targetDept: 'IT',
    seed(ctx) {
      applyBaseline(ctx.dir, ctx.idp, ctx.apps);
      ctx.idp.signIn('hank.oneill', 'hank.oneill123');
    },
    buildLab(flavor) {
      return baseLab(this, flavor, [
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
      ]);
    },
  },
  {
    id: 'app-access-request',
    zoneId: 'help-desk',
    ticketTypeLabel: 'Application Access Request',
    targetDisplayName: 'Alex Morgan',
    targetTitle: 'Payroll Analyst',
    targetDept: 'Finance',
    buildLab(flavor) {
      return baseLab(this, flavor, [
        step(
          's1',
          'Grant access to the Finance Portal',
          `${flavor.narrative} Add Alex Morgan to grp-finance-payroll so they can access the Finance Portal.`,
          {
            kind: 'group-added',
            params: { userId: 'alex.morgan', groupId: 'grp-finance-payroll' },
          },
          { exec: 10, 'least-privilege': 5 },
        ),
      ]);
    },
  },
  {
    id: 'ticket-cant-login',
    zoneId: 'help-desk',
    ticketTypeLabel: 'Ticket Queue: Can’t Log In',
    targetDisplayName: 'Cara Patel',
    targetTitle: 'HR Business Partner',
    targetDept: 'HR',
    seed(ctx) {
      const seedResult = applyBaseline(ctx.dir, ctx.idp, ctx.apps);
      const caraId = seedResult.userIds['cara.patel'];
      if (!caraId) return;
      ctx.tickets.create({
        id: mkTicketId('gen-ticket-cant-login'),
        kind: 'password-reset',
        requesterId: caraId,
        subject: 'Can’t log in to my account',
        body: 'Cara Patel reports she cannot sign in after several attempts.',
        priority: 'normal',
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
    buildLab(flavor) {
      return baseLab(this, flavor, [
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
      ]);
    },
  },
  {
    id: 'dept-mfa-enforcement',
    zoneId: 'iam-ops',
    ticketTypeLabel: 'Department MFA Enforcement',
    targetDisplayName: 'the Finance department',
    targetTitle: 'Department-wide request',
    targetDept: 'Finance',
    buildLab(flavor) {
      return baseLab(this, flavor, [
        step(
          's1',
          'Enable MFA enforcement',
          `${flavor.narrative} Enable MFA enforcement in IAM Console after a phishing attempt targeted Finance.`,
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
    buildLab(flavor, usedNames) {
      const name = pickUnusedName(usedNames);
      return baseLab({ ...this, targetDisplayName: name.displayName }, flavor, [
        step(
          's1',
          'Create the contractor’s account',
          `${flavor.narrative} Create a time-limited account for ${name.displayName}.`,
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
      ]);
    },
  },
  {
    id: 'service-account-access',
    zoneId: 'engineering',
    ticketTypeLabel: 'Service Account Permission Request',
    targetDisplayName: 'svc-backup',
    targetTitle: 'Service Account',
    targetDept: 'IT',
    buildLab(flavor) {
      return baseLab(this, flavor, [
        step(
          's1',
          'Grant the requested access',
          `${flavor.narrative} Add svc-backup to grp-server-admins so the backup job can run.`,
          { kind: 'group-added', params: { userId: 'svc-backup', groupId: 'grp-server-admins' } },
          { exec: 10, 'least-privilege': 10 },
        ),
      ]);
    },
  },
  {
    id: 'failed-login-troubleshoot',
    zoneId: 'help-desk',
    ticketTypeLabel: 'Failed Login Troubleshooting',
    targetDisplayName: 'Greta Olsen',
    targetTitle: 'Chief Financial Officer',
    targetDept: 'Finance',
    buildLab(flavor) {
      return baseLab(this, flavor, [
        step(
          's1',
          'Verify sign-in works',
          `${flavor.narrative} Sign in as Greta Olsen in IAM Console to confirm the issue is resolved.`,
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
    buildLab(flavor) {
      return baseLab(this, flavor, [
        step(
          's1',
          'Remove access from the old department',
          `${flavor.narrative} Bob Sato is transferring out of Engineering — remove grp-engineering-dev.`,
          { kind: 'group-removed', params: { userId: 'bob.sato', groupId: 'grp-engineering-dev' } },
          { exec: 10 },
        ),
        step(
          's2',
          'Grant access to the new department',
          'Add Bob Sato to grp-helpdesk-tier1 for his new IT Help Desk role.',
          { kind: 'group-added', params: { userId: 'bob.sato', groupId: 'grp-helpdesk-tier1' } },
          { exec: 10, 'least-privilege': 5 },
        ),
      ]);
    },
  },
];

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

    // Who the ticket is about. Defaults to the requester (a user reporting
    // their own lockout), but many tickets are filed on someone else's behalf.
    const subjectName = cfg.subjectUsername ?? cfg.username;
    let subject = ctx.dir.getUserByUsername(subjectName);
    if (!subject && cfg.seedSubject) {
      subject = ctx.dir.ensureUser({
        username: subjectName,
        displayName: cfg.seedSubject.displayName,
        email: `${subjectName}@northwind.example`,
        department: cfg.seedSubject.department,
        title: cfg.seedSubject.title,
        mfa: 'none',
      });
    }
    const subjectId = subject?.id ?? requesterId;
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
      payload: { userId: subjectId, method: 'helpdesk' } as any,
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
          body: 'Please create an account for Devin Park, a new developer starting Monday. Department: Engineering. Title: Junior Developer. Add to grp-engineering-dev. Temporary contractor account with 90-day expiry.',
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
          priority: 'urgent' as const,
        },
        {
          id: ticketIds[7]!,
          kind: 'transfer' as const,
          subject: "Transfer: Hank O'Neill from Engineering to IT Support",
          body: "Hank O'Neill (hank.oneill) is transferring from Engineering to IT Support. Remove him from grp-engineering-dev and add him to grp-helpdesk-tier1. His last day in Engineering is Friday.",
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
          priority: 'urgent' as const,
        },
        {
          id: ticketIds[1]!,
          kind: 'password-reset' as const,
          subject: 'Executive password reset: Greta Olsen (CFO)',
          body: 'Greta Olsen (greta.olsen, greta.olsen@northwind.example) is locked out of her account. She is the CFO. Need immediate password reset via secure channel — do not send via email.',
          username: 'bob.sato',
          subjectUsername: 'greta.olsen',
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
          body: 'Marcus Chen starts tomorrow as VP of Sales. Create his account (marcus.chen). Title: VP of Sales, Department: Sales. Add to grp-sales-executives and grp-all-employees. Full IAM provisioning needed.',
          username: 'erin.cho',
          priority: 'high' as const,
        },
        {
          id: ticketIds[5]!,
          kind: 'access-request' as const,
          subject: 'PCI compliance group for Finance team',
          body: 'Finance team needs a PCI-compliant access group (grp-finance-pci) for the upcoming PCI DSS audit. Create the group and add Finn Müller (finn.muller) and Greta Olsen (greta.olsen) as members.',
          username: 'finn.muller',
          priority: 'normal' as const,
        },
        {
          id: ticketIds[6]!,
          kind: 'transfer' as const,
          subject: 'Promotion: Greta Olsen promoted to IAM Admin',
          body: 'Greta Olsen (greta.olsen) has been promoted to IAM Admin. Remove her from grp-finance-payroll and grp-finance-analysts. Add her to grp-iam-admins and grp-all-employees.',
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
          subject: 'Bulk hire: 5 summer interns (Engineering)',
          body: 'Five summer interns starting next Monday: Alex Kim, Bella Santos, Chris Lee, Dana White, Evan Park. Create accounts in grp-engineering-interns with 90-day expiry. Department: Engineering.',
          username: 'jane.doe',
          priority: 'normal' as const,
        },
        {
          id: ticketIds[10]!,
          kind: 'access-request' as const,
          subject: "Cross-training access for Hank O'Neill to Sales",
          body: "Manager Ivy Park requests 2-week read-only access for Hank O'Neill (hank.oneill) to the Sales team's shared resources. Grant grp-sales-readonly membership, expiring in 14 days.",
          username: 'alex.morgan',
          priority: 'low' as const,
        },
        {
          id: ticketIds[11]!,
          kind: 'leaver' as const,
          subject: 'Contractor offboard: Sam Nguyen',
          body: 'Contractor Sam Nguyen (sam.nguyen) project ended. Disable their account (sam.nguyen), revoke all sessions, and remove from grp-engineering-dev within 24 hours.',
          username: 'bob.sato',
          subjectUsername: 'sam.nguyen',
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
          body: 'Dan Rivera (dan.rivera) reports that SMS MFA codes are never arriving to his mobile (+1-555-0104). Investigate the SMS gateway configuration and fix delivery for dan.rivera.',
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
          body: 'Multiple failed logins detected from IP 185.220.101.x targeting accounts in the Finance department. 50 failed attempts in 5 minutes. Block the IP, investigate the targeted accounts (greta.olsen, alex.morgan), and rotate passwords if compromised.',
          username: 'alex.morgan',
          priority: 'urgent' as const,
        },
        {
          id: ticketIds[1]!,
          kind: 'password-reset' as const,
          subject: "Ransomware infection: Cara Patel's workstation",
          body: 'Cara Patel (cara.patel) reports a ransom note displayed on her workstation screen. Immediate action: disable her account (cara.patel), revoke all sessions, and disconnect her workstation from the network.',
          username: 'bob.sato',
          priority: 'urgent' as const,
        },
        {
          id: ticketIds[2]!,
          kind: 'mfa-issue' as const,
          subject: 'Suspicious MFA bypass for Greta Olsen (CFO account)',
          body: 'MFA bypass request flagged for greta.olsen@northwind.example at 02:47 AM from an unrecognized device. CFO Greta Olsen is not in the office. Verify legitimacy immediately and revoke if unauthorized.',
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
          priority: 'urgent' as const,
        },
        {
          id: ticketIds[4]!,
          kind: 'access-request' as const,
          subject: 'Unauthorized admin role on svc-deploy service account',
          body: 'Monthly audit found svc-deploy service account has unexpected role-admin membership in the Production namespace. Investigate who added it (check audit log), remove the unauthorized role, and document the change.',
          username: 'erin.cho',
          subjectUsername: 'svc-deploy',
          seedSubject: { displayName: 'svc-deploy', department: 'IT', title: 'Service Account' },
          priority: 'high' as const,
        },
        {
          id: ticketIds[5]!,
          kind: 'password-reset' as const,
          subject: 'Phishing: Finn Müller clicked link',
          body: 'Finn Müller (finn.muller) reported clicking a phishing link in an email. His credentials may be compromised. Reset his password immediately, revoke all active sessions, and confirm MFA is enforced.',
          username: 'finn.muller',
          priority: 'high' as const,
        },
        {
          id: ticketIds[6]!,
          kind: 'mfa-issue' as const,
          subject: 'Stale session: ivy.park session active after termination',
          body: "Ivy Park's (ivy.park) account was terminated 3 days ago, but an active session is still valid in the HR Portal application. Revoke the session immediately and confirm account is disabled.",
          username: 'greta.olsen',
          subjectUsername: 'ivy.park',
          priority: 'high' as const,
        },
        {
          id: ticketIds[7]!,
          kind: 'access-request' as const,
          subject: 'Dormant account reactivation: hank.oneill (90 days inactive)',
          body: "Hank O'Neill's account (hank.oneill) had no sign-in activity for 90 days but was used at 14:22 today from IP 203.0.113.42. Disable the account, investigate the login, and confirm with Hank if this was legitimate.",
          username: 'hank.oneill',
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
          body: 'Jane Doe (jane.doe) is receiving over 100 MFA push notifications on her phone in the past hour. This indicates an MFA push fatigue attack. Deny all pending requests, temporarily disable push MFA for jane.doe, and advise her to use TOTP instead.',
          username: 'jane.doe',
          priority: 'high' as const,
        },
        {
          id: ticketIds[10]!,
          kind: 'incident' as const,
          subject: 'OAuth token theft: third-party app "QuickReports" using stolen tokens',
          body: 'Security team detected the third-party app "QuickReports" using OAuth tokens belonging to alex.morgan. Tokens were likely stolen via a phishing campaign. Revoke all OAuth tokens for alex.morgan, contact QuickReports support, and audit other compromised accounts.',
          username: 'alex.morgan',
          priority: 'high' as const,
        },
        {
          id: ticketIds[11]!,
          kind: 'access-request' as const,
          subject: 'Privilege creep: cara.patel has 47 group memberships',
          body: 'Q3 access review found Cara Patel (cara.patel) has 47 group memberships, including several production database roles she no longer needs. Review her current role (HR Business Partner), remove unnecessary groups, and document the cleanup.',
          username: 'bob.sato',
          subjectUsername: 'cara.patel',
          priority: 'normal' as const,
        },
        {
          id: ticketIds[12]!,
          kind: 'password-reset' as const,
          subject: 'Brute force attack: 1,000 attempts from 198.51.100.50',
          body: 'Brute force attack detected on the login page from IP 198.51.100.50 with 1,000+ attempts targeting Finance and HR accounts. Block the IP, force password reset for all accounts that had failed attempts (greta.olsen, cara.patel, finn.muller), and enable account lockout policy.',
          username: 'cara.patel',
          priority: 'high' as const,
        },
        {
          id: ticketIds[13]!,
          kind: 'mfa-issue' as const,
          subject: 'FIDO2 hardware key not registering: Dan Rivera',
          body: 'Dan Rivera (dan.rivera) received a new YubiKey (serial: YK-8821-44190) but it is not registering during enrollment. Verify the YubiKey is not already enrolled to another account, check the FIDO2 RP ID configuration, and help Dan complete enrollment.',
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
          body: "Greta Olsen's (greta.olsen) password does not meet the new complexity requirements (12+ chars, special characters). Assist her in setting a compliant password securely in person — do not send via email or chat.",
          username: 'finn.muller',
          subjectUsername: 'greta.olsen',
          priority: 'high' as const,
        },
        {
          id: ticketIds[16]!,
          kind: 'access-request' as const,
          subject: 'SSO failure: partner company Contoso reports SAML login failing',
          body: 'Partner company Contoso reports SSO to our HR Portal is failing with SAML assertion errors. Their entity ID: contoso-corp. Investigate the SAML trust relationship, check the certificate expiry, and contact Contoso IT.',
          username: 'greta.olsen',
          priority: 'normal' as const,
        },
        {
          id: ticketIds[17]!,
          kind: 'mfa-issue' as const,
          subject: 'SAML assertion failure: hank.oneill cannot sign in to Jenkins',
          body: "Hank O'Neill (hank.oneill) cannot sign in to the Jenkins CI/CD server. The IdP returns a SAML assertion error: 'Invalid NameID format'. Check the SAML NameID format mapping in Jenkins and update the claim configuration in the IdP.",
          username: 'hank.oneill',
          priority: 'normal' as const,
        },
        {
          id: ticketIds[18]!,
          kind: 'password-reset' as const,
          subject: 'Bulk provisioning: 50 new users from Acme Corp acquisition',
          body: 'Acquisition integration: provision 50 new user accounts from Acme Corp. Users are in the file: acme-onboarding-2026.xlsx. Create accounts in the Engineering department, add to grp-engineering-acme, set passwords to temporary values, and force password change on first login.',
          username: 'ivy.park',
          priority: 'normal' as const,
        },
        {
          id: ticketIds[19]!,
          kind: 'access-request' as const,
          subject: 'Q3 access review remediation: 23 over-privileged accounts',
          body: 'Q3 access review flagged 23 accounts with excessive privileges. Priority list: alex.morgan (20 groups), cara.patel (47 groups), finn.muller (15 groups), bob.sato (12 groups), and 19 others listed in the attached report. Remove unneeded groups and document each change in the audit log.',
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
  });
}

// Register batch templates — reads _batchTicketIds from the Lab at start time
// so the IDs match what buildLab() used when creating the lab.
for (const bt of BATCH_TEMPLATES) {
  registerLabSeed(bt.id, (ctx) => {
    applyBaseline(ctx.dir, ctx.idp, ctx.apps);
    // Retrieve ticket IDs that were stored on the Lab object during generation.
    const ticketIds: string[] =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ctx._currentLab as any)?._batchTicketIds ??
      BATCH_TICKET_IDS(bt.ticketCount, `batch-${bt.id}`);
    bt.seed(ctx, ticketIds);
  });
}
