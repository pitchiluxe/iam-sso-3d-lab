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
import { registerLabSeed } from '@/conductor/conductor';
import type { SeedContext } from '@/conductor/conductor';
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
function ticketStep(stepId: string, ticketId: string, subject: string): LabStep {
  return step(
    stepId,
    `Resolve ticket: ${subject}`,
    `Resolve the "${subject}" ticket in the Ticket Console. Verify access is restored and document the resolution.`,
    { kind: 'ticket-resolved', params: { ticketId } },
    { exec: 8, comms: 2 },
  );
}

/** Shared seed builder that creates N mixed-kind tickets on top of baseline. */
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
    username: string;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
  }>,
): void {
  applyBaseline(ctx.dir, ctx.idp, ctx.apps);
  for (let i = 0; i < ticketConfigs.length; i++) {
    const cfg = ticketConfigs[i]!;
    const userId = ctx.dir.getUserByUsername(cfg.username)?.id;
    if (!userId) continue;
    // Use a permissive payload — the real TicketKind type is large and
    // varies per kind. For ticket-resolution lab purposes, the validator
    // only matches by id, so a minimal payload is sufficient.
    ctx.tickets.create({
      id: ticketIds[i] as ReturnType<typeof mkTicketId>,
      kind: cfg.kind,
      requesterId: userId,
      subject: cfg.subject,
      body: cfg.body,
      priority: cfg.priority ?? 'normal',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      payload: { userId, method: 'helpdesk' } as any,
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
          subject: 'New hire onboarding',
          body: 'Please create an account for our new developer starting Monday.',
          username: 'alex.morgan',
          priority: 'high' as const,
        },
        {
          id: ticketIds[1]!,
          kind: 'password-reset' as const,
          subject: 'Cannot log in',
          body: 'I have forgotten my password and need a reset.',
          username: 'bob.sato',
          priority: 'normal' as const,
        },
        {
          id: ticketIds[2]!,
          kind: 'access-request' as const,
          subject: 'Needs Finance Portal access',
          body: 'Please grant me access to the Finance Portal application.',
          username: 'cara.patel',
          priority: 'normal' as const,
        },
        {
          id: ticketIds[3]!,
          kind: 'mfa-issue' as const,
          subject: 'MFA token not working',
          body: 'My authenticator app shows an invalid code. Please reset MFA.',
          username: 'dan.rivera',
          priority: 'high' as const,
        },
        {
          id: ticketIds[4]!,
          kind: 'onboarding' as const,
          subject: 'Contractor account needed',
          body: 'A contractor is starting next week. Please create a time-limited account.',
          username: 'erin.cho',
          priority: 'normal' as const,
        },
        {
          id: ticketIds[5]!,
          kind: 'access-request' as const,
          subject: 'Revoke old access',
          body: 'I no longer need access to the legacy HR system. Please remove my account.',
          username: 'finn.muller',
          priority: 'low' as const,
        },
        {
          id: ticketIds[6]!,
          kind: 'password-reset' as const,
          subject: 'Account locked out',
          body: 'My account is locked after too many failed attempts.',
          username: 'greta.olsen',
          priority: 'urgent' as const,
        },
        {
          id: ticketIds[7]!,
          kind: 'transfer' as const,
          subject: 'Department transfer',
          body: 'I am moving from Engineering to IT Support. Please update my group memberships.',
          username: 'hank.oneill',
          priority: 'normal' as const,
        },
        {
          id: ticketIds[8]!,
          kind: 'access-request' as const,
          subject: 'Temporary project access',
          body: 'I need 30-day access to the Analytics Dashboard for a project.',
          username: 'ivy.park',
          priority: 'normal' as const,
        },
        {
          id: ticketIds[9]!,
          kind: 'mfa-issue' as const,
          subject: 'New phone — MFA re-enrollment',
          body: 'I got a new phone and need to re-enroll in MFA.',
          username: 'jane.doe',
          priority: 'normal' as const,
        },
      ];
      buildBatchSeed(ctx, ticketIds, configs);
    },
    buildLab(flavor, ticketIds) {
      const steps = ticketIds.map((id, i) =>
        ticketStep(
          `s${i + 1}`,
          id,
          [
            'New hire onboarding',
            'Cannot log in',
            'Needs Finance Portal access',
            'MFA token not working',
            'Contractor account needed',
            'Revoke old access',
            'Account locked out',
            'Department transfer',
            'Temporary project access',
            'New phone — MFA re-enrollment',
          ][i]!,
        ),
      );
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
          subject: 'Terminate departing employee',
          body: 'An employee is leaving today. Disable their account immediately.',
          username: 'alex.morgan',
          priority: 'urgent' as const,
        },
        {
          id: ticketIds[1]!,
          kind: 'password-reset' as const,
          subject: 'Executive password reset',
          body: 'CEO locked out of email. Need immediate reset.',
          username: 'bob.sato',
          priority: 'urgent' as const,
        },
        {
          id: ticketIds[2]!,
          kind: 'access-request' as const,
          subject: 'Production database access',
          body: 'Developer requesting read-only access to the production database.',
          username: 'cara.patel',
          priority: 'high' as const,
        },
        {
          id: ticketIds[3]!,
          kind: 'mfa-issue' as const,
          subject: 'MFA device replacement',
          body: 'Lost Authenticator device. Need temporary bypass to enroll new device.',
          username: 'dan.rivera',
          priority: 'high' as const,
        },
        {
          id: ticketIds[4]!,
          kind: 'onboarding' as const,
          subject: 'VP of Sales onboarding',
          body: 'New VP starts tomorrow. Full IAM provisioning needed.',
          username: 'erin.cho',
          priority: 'high' as const,
        },
        {
          id: ticketIds[5]!,
          kind: 'access-request' as const,
          subject: 'PCI compliance group needed',
          body: 'Finance team needs PCI-compliant access group for audit.',
          username: 'finn.muller',
          priority: 'normal' as const,
        },
        {
          id: ticketIds[6]!,
          kind: 'transfer' as const,
          subject: 'Promotion — IAM Admin role',
          body: 'Employee promoted to IAM Admin. Remove old groups, add new permissions.',
          username: 'greta.olsen',
          priority: 'normal' as const,
        },
        {
          id: ticketIds[7]!,
          kind: 'password-reset' as const,
          subject: 'Service account password rotation',
          body: 'Automated job failed due to expired service account password.',
          username: 'hank.oneill',
          priority: 'high' as const,
        },
        {
          id: ticketIds[8]!,
          kind: 'mfa-issue' as const,
          subject: 'VPN MFA loop',
          body: 'User stuck in MFA challenge loop when connecting to VPN.',
          username: 'ivy.park',
          priority: 'high' as const,
        },
        {
          id: ticketIds[9]!,
          kind: 'onboarding' as const,
          subject: 'Bulk hire (5 users)',
          body: 'Five summer interns starting next Monday. Create accounts.',
          username: 'jane.doe',
          priority: 'normal' as const,
        },
        {
          id: ticketIds[10]!,
          kind: 'access-request' as const,
          subject: 'Cross-training shadow access',
          body: "Manager requests 2-week read-only access to another team's resources.",
          username: 'alex.morgan',
          priority: 'low' as const,
        },
        {
          id: ticketIds[11]!,
          kind: 'leaver' as const,
          subject: 'Contractor offboarding',
          body: 'Contractor project ended. Remove account access.',
          username: 'bob.sato',
          priority: 'normal' as const,
        },
        {
          id: ticketIds[12]!,
          kind: 'password-reset' as const,
          subject: 'New employee first-day access',
          body: 'New hire cannot log in on their first day.',
          username: 'cara.patel',
          priority: 'high' as const,
        },
        {
          id: ticketIds[13]!,
          kind: 'mfa-issue' as const,
          subject: 'SMS MFA not receiving codes',
          body: 'User reports SMS MFA codes never arrive. Investigate and fix.',
          username: 'dan.rivera',
          priority: 'normal' as const,
        },
        {
          id: ticketIds[14]!,
          kind: 'access-request' as const,
          subject: 'Jira admin rights',
          body: 'IT team member requesting Jira admin rights for project setup.',
          username: 'erin.cho',
          priority: 'normal' as const,
        },
      ];
      buildBatchSeed(ctx, ticketIds, configs);
    },
    buildLab(flavor, ticketIds) {
      const subjects = [
        'Terminate departing employee',
        'Executive password reset',
        'Production database access',
        'MFA device replacement',
        'VP of Sales onboarding',
        'PCI compliance group needed',
        'Promotion — IAM Admin role',
        'Service account password rotation',
        'VPN MFA loop',
        'Bulk hire (5 users)',
        'Cross-training shadow access',
        'Contractor offboarding',
        'New employee first-day access',
        'SMS MFA not receiving codes',
        'Jira admin rights',
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
          subject: 'Credential stuffing attack detected',
          body: 'Multiple failed logins from suspicious IP. Investigate and contain.',
          username: 'alex.morgan',
          priority: 'urgent' as const,
        },
        {
          id: ticketIds[1]!,
          kind: 'password-reset' as const,
          subject: 'Ransomware infection response',
          body: 'User reports ransom note on screen. Immediate account lockout needed.',
          username: 'bob.sato',
          priority: 'urgent' as const,
        },
        {
          id: ticketIds[2]!,
          kind: 'mfa-issue' as const,
          subject: 'Suspicious MFA bypass attempt',
          body: 'MFA bypass flagged for executive account. Verify legitimacy.',
          username: 'cara.patel',
          priority: 'urgent' as const,
        },
        {
          id: ticketIds[3]!,
          kind: 'leaver' as const,
          subject: 'Insider threat — immediate offboard',
          body: 'HR has flagged an employee for immediate termination. Disable all access NOW.',
          username: 'dan.rivera',
          priority: 'urgent' as const,
        },
        {
          id: ticketIds[4]!,
          kind: 'access-request' as const,
          subject: 'Unauthorized privilege escalation',
          body: 'Audit found unexpected admin role on service account. Investigate.',
          username: 'erin.cho',
          priority: 'high' as const,
        },
        {
          id: ticketIds[5]!,
          kind: 'password-reset' as const,
          subject: 'Phishing email reported',
          body: 'Employee clicked phishing link. Reset password and revoke sessions.',
          username: 'finn.muller',
          priority: 'high' as const,
        },
        {
          id: ticketIds[6]!,
          kind: 'mfa-issue' as const,
          subject: 'Stale session still active after termination',
          body: "Terminated employee's session is still valid in app. Revoke.",
          username: 'greta.olsen',
          priority: 'high' as const,
        },
        {
          id: ticketIds[7]!,
          kind: 'access-request' as const,
          subject: 'Dormant account reactivation',
          body: '90-day inactive account was used. Disable and investigate.',
          username: 'hank.oneill',
          priority: 'high' as const,
        },
        {
          id: ticketIds[8]!,
          kind: 'password-reset' as const,
          subject: 'Shared account password leak',
          body: 'Shared admin password found in public GitHub repo. Rotate immediately.',
          username: 'ivy.park',
          priority: 'urgent' as const,
        },
        {
          id: ticketIds[9]!,
          kind: 'mfa-issue' as const,
          subject: 'MFA push fatigue attack',
          body: 'User receiving 100 MFA push notifications. Possible attack in progress.',
          username: 'jane.doe',
          priority: 'high' as const,
        },
        {
          id: ticketIds[10]!,
          kind: 'incident' as const,
          subject: 'OAuth token theft suspected',
          body: 'Third-party app using stolen OAuth tokens. Revoke all and re-issue.',
          username: 'alex.morgan',
          priority: 'high' as const,
        },
        {
          id: ticketIds[11]!,
          kind: 'access-request' as const,
          subject: 'Privilege creep in finance team',
          body: 'Access review found finance analyst with 47 groups. Audit needed.',
          username: 'bob.sato',
          priority: 'normal' as const,
        },
        {
          id: ticketIds[12]!,
          kind: 'password-reset' as const,
          subject: 'Brute force attack on login page',
          body: 'Rate limit bypass detected. Block IP and force password reset for affected users.',
          username: 'cara.patel',
          priority: 'high' as const,
        },
        {
          id: ticketIds[13]!,
          kind: 'mfa-issue' as const,
          subject: 'FIDO2 key not registering',
          body: 'New hardware security key not working. Need to troubleshoot enrollment.',
          username: 'dan.rivera',
          priority: 'normal' as const,
        },
        {
          id: ticketIds[14]!,
          kind: 'leaver' as const,
          subject: 'Contractor project complete — offboard',
          body: '3rd-party contractor project ended. Remove all access within 24h.',
          username: 'erin.cho',
          priority: 'normal' as const,
        },
        {
          id: ticketIds[15]!,
          kind: 'password-reset' as const,
          subject: 'Password policy non-compliance',
          body: 'CEO password does not meet complexity requirements. Update securely.',
          username: 'finn.muller',
          priority: 'high' as const,
        },
        {
          id: ticketIds[16]!,
          kind: 'access-request' as const,
          subject: 'Cross-tenant federation misconfig',
          body: 'Partner company reports SSO failing. Investigate trust relationship.',
          username: 'greta.olsen',
          priority: 'normal' as const,
        },
        {
          id: ticketIds[17]!,
          kind: 'mfa-issue' as const,
          subject: 'SAML assertion validation failure',
          body: 'SAML sign-in failing for one app. Check certificate and configuration.',
          username: 'hank.oneill',
          priority: 'normal' as const,
        },
        {
          id: ticketIds[18]!,
          kind: 'password-reset' as const,
          subject: 'Bulk user provisioning needed',
          body: 'Acquisition integration: provision 50 new users from acquired company.',
          username: 'ivy.park',
          priority: 'normal' as const,
        },
        {
          id: ticketIds[19]!,
          kind: 'access-request' as const,
          subject: 'Quarterly access review remediation',
          body: 'Q3 review flagged 23 over-privileged accounts. Remove unneeded access.',
          username: 'jane.doe',
          priority: 'normal' as const,
        },
      ];
      buildBatchSeed(ctx, ticketIds, configs);
    },
    buildLab(flavor, ticketIds) {
      const subjects = [
        'Credential stuffing attack detected',
        'Ransomware infection response',
        'Suspicious MFA bypass attempt',
        'Insider threat — immediate offboard',
        'Unauthorized privilege escalation',
        'Phishing email reported',
        'Stale session still active after termination',
        'Dormant account reactivation',
        'Shared account password leak',
        'MFA push fatigue attack',
        'OAuth token theft suspected',
        'Privilege creep in finance team',
        'Brute force attack on login page',
        'FIDO2 key not registering',
        'Contractor project complete — offboard',
        'Password policy non-compliance',
        'Cross-tenant federation misconfig',
        'SAML assertion validation failure',
        'Bulk user provisioning needed',
        'Quarterly access review remediation',
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ticketIds: string[] =
      (ctx._currentLab as any)?._batchTicketIds ??
      BATCH_TICKET_IDS(bt.ticketCount, `batch-${bt.id}`);
    bt.seed(ctx, ticketIds);
  });
}
