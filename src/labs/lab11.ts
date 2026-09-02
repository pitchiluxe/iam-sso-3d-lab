/**
 * labs/lab11.ts — Conditional Access Deep-Dive (Zero Trust).
 *
 * Learner configures two named CA policies:
 *   CA-001: Block legacy authentication protocols (POP, IMAP, SMTP, LDAP).
 *   CA-002: Require MFA for privileged roles and high-risk sign-ins.
 *
 * Validators reuse existing kinds where possible:
 *   role-granted, mfa-challenge-completed, evidence-collected,
 *   fault-cleared.
 * New conductor validator: 'ca-policy-created' (emit on policy.upsert).
 */
import { mkLabId } from '@/domain';
import type { Lab, UserId } from '@/domain';

export const LAB_11: Lab = {
  id: mkLabId('lab11'),
  number: 11,
  title: 'Conditional Access — Zero Trust',
  brief:
    'Design and deploy two CA policies: CA-001 blocks legacy auth across the tenant; CA-002 enforces MFA for privileged roles and risky sign-ins. Simulate sign-in scenarios and verify policy evaluation.',
  durationMinutes: 45,
  zoneIds: ['iam-ops', 'sec-ops'],
  startingZone: 'iam-ops',
  startingSeed: 'lab11',
  objectives: [
    {
      id: 'o1',
      description: 'Design CA-001: block legacy auth protocols',
      points: 10,
      category: 'exec',
    },
    {
      id: 'o2',
      description: 'Design CA-002: MFA for privileged roles',
      points: 10,
      category: 'exec',
    },
    {
      id: 'o3',
      description: 'Enforce CA-001 by assigning to all apps',
      points: 5,
      category: 'exec',
    },
    {
      id: 'o4',
      description: 'Verify legacy auth is blocked in sign-in simulation',
      points: 5,
      category: 'troubleshoot',
    },
    {
      id: 'o5',
      description: 'Enroll privileged user in MFA and test CA-002',
      points: 5,
      category: 'exec',
    },
    {
      id: 'o6',
      description: 'Document the CA policy design rationale',
      points: 5,
      category: 'docs',
    },
  ],
  steps: [
    {
      id: 's1',
      title: 'Review current authentication methods',
      brief:
        'Open the IAM Console. Inspect the current authentication methods. Note which legacy protocols (POP, IMAP, SMTP, LDAP basic) are still enabled. List the apps that rely on each.',
      validator: { kind: 'evidence-collected', params: { stepId: 's1' } },
      evidence: [
        {
          kind: 'snapshot',
          capture: 'manual',
          params: { console: 'iamConsole' },
        },
      ],
      tutorPrompts: [
        'Why would a modern cloud tenant still allow POP/IMAP authentication?',
        'What is the blast radius of a legacy auth compromise?',
      ],
      hintIds: ['lab11.s1.h1'],
      points: { exec: 5 },
    },
    {
      id: 's2',
      title: 'Create CA-001: Block Legacy Auth',
      brief:
        'In the IAM Console CA policy editor, create policy CA-001:\n' +
        '  - Name: "Block Legacy Authentication"\n' +
        '  - Users: All (exclude break-glass accounts)\n' +
        '  - Client apps: Exchange ActiveSync, POP, IMAP, SMTP, Authenticated SMTP\n' +
        '  - Conditions: Any platform, any location\n' +
        '  - Grant: Block access\n' +
        'Assign it to Finance Portal and HR Suite.',
      validator: { kind: 'evidence-collected', params: { stepId: 's2' } },
      evidence: [
        {
          kind: 'snapshot',
          capture: 'manual',
          params: { console: 'iamConsole' },
        },
        { kind: 'log-excerpt', capture: 'auto', params: { count: 3 } },
      ],
      tutorPrompts: [
        'Why do you exclude break-glass accounts from the block?',
        'Should you block legacy auth for all users or just high-risk groups?',
        'What happens to a legitimate IMAP client when this policy is enforced?',
      ],
      hintIds: ['lab11.s2.h1', 'lab11.s2.h2'],
      points: { exec: 10, docs: 3 },
    },
    {
      id: 's3',
      title: 'Create CA-002: MFA for Privileged Roles',
      brief:
        'Create policy CA-002:\n' +
        '  - Name: "MFA for Privileged Roles"\n' +
        '  - Users: Members of role-iam-admins, role-domain-admins, role-sec-ops\n' +
        '  - Cloud apps: All\n' +
        '  - Conditions: Any device state\n' +
        '  - Grant: Require MFA\n' +
        'Test by signing in as erin.cho (IAM Admin). Verify MFA is challenged.',
      validator: { kind: 'mfa-challenge-completed', params: { userId: 'erin.cho' } },
      evidence: [
        {
          kind: 'log-excerpt',
          capture: 'auto',
          params: { count: 5 },
        },
      ],
      tutorPrompts: [
        'Is requiring MFA on every sign-in the right balance, or should it be step-up only?',
        'How would you test this policy before assigning it to all admins?',
      ],
      hintIds: ['lab11.s3.h1'],
      points: { exec: 10, troubleshoot: 5 },
    },
    {
      id: 's4',
      title: 'Simulate a legacy auth block',
      brief:
        'Simulate a sign-in from a legacy IMAP client as any Finance user. Use the sign-in simulator in the SecOps Dashboard. Record the result (blocked or allowed) and the CA policy that applied.',
      validator: { kind: 'evidence-collected', params: { stepId: 's4' } },
      evidence: [
        {
          kind: 'snapshot',
          capture: 'manual',
          params: { console: 'secOpsDashboard' },
        },
      ],
      tutorPrompts: [
        'If the simulation shows "allowed" instead of "blocked", what would you check first?',
        'What audit event is emitted when CA-001 blocks a sign-in?',
      ],
      hintIds: ['lab11.s4.h1'],
      points: { troubleshoot: 5, evidence: 5 },
    },
    {
      id: 's5',
      title: 'Add a named location exception',
      brief:
        'Engineering needs legacy auth from the on-premises datacenter ASN (10.0.0.0/8) while the migration is in progress. Add an exception to CA-001 that allows legacy auth from that trusted ASN only. Document the risk acceptance.',
      validator: { kind: 'evidence-collected', params: { stepId: 's5' } },
      evidence: [
        {
          kind: 'snapshot',
          capture: 'manual',
          params: { console: 'iamConsole' },
        },
      ],
      tutorPrompts: [
        'What risk does allowing legacy auth from a corporate ASN introduce?',
        'What compensating control would you add alongside this exception?',
      ],
      hintIds: ['lab11.s5.h1'],
      points: { exec: 5, 'least-privilege': 5, docs: 2 },
    },
    {
      id: 's6',
      title: 'Document the CA policy design',
      brief:
        'Write a brief policy document covering: policy names, what each blocks/requires, who is excluded, how exceptions are managed, and the review cadence.',
      validator: { kind: 'evidence-collected', params: { stepId: 's6' } },
      evidence: [
        {
          kind: 'snapshot',
          capture: 'manual',
          params: { console: 'iamConsole' },
        },
      ],
      tutorPrompts: [
        'How often should CA policies be reviewed?',
        'Who should own the policy review: IAM, SecOps, or the business?',
      ],
      hintIds: ['lab11.s6.h1'],
      points: { docs: 5 },
    },
  ],
  faults: [
    {
      id: 'f1',
      kind: 'legacy-auth-misconfiguration',
      applyAtStep: 's4',
      params: {},
      targetUserId: 'alex.morgan' as UserId,
    },
  ],
  debriefQuestions: [
    'Walk through the decision logic for assigning CA-001 to all apps vs. specific apps.',
    'What is the difference between a "grant" control and a "session" control in CA?',
    'How would you handle a legitimate SaaS app that only supports basic auth?',
    'What would a comprehensive CA policy portfolio look like for a zero-trust maturity level 2 org?',
  ],
};
