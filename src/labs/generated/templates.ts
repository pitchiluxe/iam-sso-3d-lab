/**
 * labs/generated/templates.ts — the 15 real-world daily IT-helpdesk lab
 * templates. Every target is a real seeded user/group/service-account —
 * nothing here is invented at generation time except the flavor text
 * passed in by the caller (see services/labFlavorGenerator.ts).
 */
import { mkLabId, mkTicketId, SYSTEM_ACTOR } from '@/domain';
import type { Lab, LabStep } from '@/domain';
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

function baseLab(
  template: Pick<LabTemplate, 'id' | 'zoneId' | 'targetDisplayName'>,
  flavor: GeneratedFlavor,
  steps: LabStep[],
): Lab {
  return {
    id: mkLabId(`${template.id}-${Math.random().toString(36).slice(2, 8)}`),
    number: 0,
    title: `Daily Ticket: ${template.targetDisplayName}`,
    brief: flavor.narrative,
    durationMinutes: 15,
    zoneIds: [template.zoneId],
    startingZone: template.zoneId,
    startingSeed: template.id,
    objectives: steps.map((s, i) => ({
      id: `o${i + 1}`,
      description: s.title,
      points: Object.values(s.points ?? {}).reduce((a, b) => a + (b ?? 0), 0),
      category:
        (Object.keys(s.points ?? { exec: 0 })[0] as Lab['objectives'][number]['category']) ??
        'exec',
    })),
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

// Register every template's seed function once, at module load, so a
// generated lab's startingSeed (its own template id) is always resolvable.
for (const t of LAB_TEMPLATES) {
  registerLabSeed(t.id, (ctx) => {
    if (t.seed) t.seed(ctx);
    else applyBaseline(ctx.dir, ctx.idp, ctx.apps);
  });
}
