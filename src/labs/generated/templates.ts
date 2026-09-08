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
      return baseLab(this, flavor, [
        step(
          's1',
          'Unlock the locked-out account',
          `${flavor.narrative} Jane Doe is locked out after repeated failed sign-ins — ` +
            `check the audit log, then unlock her account in IAM Console.`,
          { kind: 'account-unlocked', params: { userId: 'jane.doe' } },
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
          evidence: { failedSignIns: 12, fromIp: '185.220.101.44', thenSuccess: true },
          priority: 'urgent' as const,
        },
        {
          id: ticketIds[1]!,
          kind: 'incident' as const,
          subject: "Ransomware infection: Cara Patel's workstation",
          subjectUsername: 'cara.patel',
          body: 'Cara Patel (cara.patel) reports a ransom note on her workstation. Desktop support has the machine. Your part: disable her account (cara.patel) and revoke all active sessions, so the credential is worthless while the machine is quarantined.',
          username: 'bob.sato',
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
          kind: 'incident' as const,
          subject: 'Stale session: ivy.park session active after termination',
          body: "Ivy Park's (ivy.park) account was terminated three days ago, but a session against the HR Portal is still valid. Revoke all her active sessions and confirm the account is disabled.",
          username: 'greta.olsen',
          subjectUsername: 'ivy.park',
          priority: 'high' as const,
        },
        {
          id: ticketIds[7]!,
          kind: 'incident' as const,
          subject: 'Dormant account used after 90 days idle: hank.oneill',
          body: "Hank O'Neill's account (hank.oneill) had no sign-in activity for 90 days, then signed in at 14:22 today from an address nobody recognises. Hank is on leave and unreachable. Disable the account and revoke its sessions until he confirms it was him.",
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
          evidence: { openSession: true },
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
