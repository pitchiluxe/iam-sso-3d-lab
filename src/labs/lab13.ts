/**
 * labs/lab13.ts — Break-Glass Account.
 *
 * Emergency access design. Learner creates two break-glass accounts,
 * excludes them from CA policies and MFA enforcement, stores the
 * credentials in a vault, configures alerting on any sign-in, and
 * runs a quarterly access review on the accounts themselves.
 *
 * Validator notes:
 *   - 'user-created' / 'group-added' cover account creation.
 *   - 'role-granted' covers assigning the Global Admin role.
 *   - 'evidence-collected' covers the config-snapshot and review steps.
 *   - 'signin-succeeded' for the break-glass user is the recovery flow.
 *   - 'review-completed' is a NEW validator that should fire on
 *     'access-review.completed' events.
 */
import { mkLabId } from '@/domain';
import type { Lab, UserId } from '@/domain';

export const LAB_13: Lab = {
  id: mkLabId('lab13'),
  number: 13,
  title: 'Break-Glass Account — Emergency Access',
  brief:
    'Design and stand up two break-glass accounts. Exclude them from CA policies, store credentials in the vault, alert on any sign-in, and run a quarterly access review on the accounts themselves.',
  durationMinutes: 35,
  zoneIds: ['iam-ops', 'sec-ops'],
  startingZone: 'iam-ops',
  startingSeed: 'lab13',
  objectives: [
    {
      id: 'o1',
      description: 'Create two break-glass accounts with strongest available auth',
      points: 10,
      category: 'exec',
    },
    {
      id: 'o2',
      description: 'Exclude break-glass from CA policies and MFA enforcement',
      points: 5,
      category: 'least-privilege',
    },
    {
      id: 'o3',
      description: 'Store credentials in the vault and document handoff',
      points: 5,
      category: 'docs',
    },
    {
      id: 'o4',
      description: 'Configure real-time alert on any break-glass sign-in',
      points: 5,
      category: 'exec',
    },
    {
      id: 'o5',
      description: 'Run a quarterly access review on the break-glass accounts',
      points: 10,
      category: 'troubleshoot',
    },
    {
      id: 'o6',
      description: 'Test the recovery flow with a fault scenario',
      points: 5,
      category: 'troubleshoot',
    },
  ],
  steps: [
    {
      id: 's1',
      title: 'Design the break-glass policy',
      brief:
        'Before creating accounts, write a one-paragraph policy covering: how many break-glass accounts, who owns them, where credentials are stored, who is alerted, and the maximum shelf life of the credentials.',
      validator: { kind: 'evidence-collected', params: { stepId: 's1' } },
      evidence: [
        {
          kind: 'snapshot',
          capture: 'manual',
          params: { console: 'iamConsole' },
        },
      ],
      tutorPrompts: [
        'Why two break-glass accounts, not one?',
        'Who should own the break-glass credentials — IT, SecOps, or the CISO?',
      ],
      hintIds: ['lab13.s1.h1'],
      points: { docs: 5 },
    },
    {
      id: 's2',
      title: 'Create break-glass account 1',
      brief:
        'Create bg-emergency-1 in the on-prem AD. Assign the Global Admin role. Configure it with the strongest available auth method (FIDO2). Do not enable MFA enforcement for this account yet — that is the next step.',
      validator: { kind: 'user-created', params: { userId: 'bg-emergency-1' } },
      evidence: [
        {
          kind: 'snapshot',
          capture: 'manual',
          params: { console: 'iamConsole' },
        },
      ],
      tutorPrompts: [
        'Should a break-glass account use the same UPN suffix as regular users?',
        'Why is FIDO2 preferred over TOTP for break-glass?',
      ],
      hintIds: ['lab13.s2.h1'],
      points: { exec: 5, 'least-privilege': 3 },
    },
    {
      id: 's3',
      title: 'Create break-glass account 2',
      brief:
        'Create bg-emergency-2 with the same role and auth profile. Confirm the two accounts have different FIDO2 keys, different device registrations, and different vault handoff locations.',
      validator: { kind: 'user-created', params: { userId: 'bg-emergency-2' } },
      evidence: [
        {
          kind: 'snapshot',
          capture: 'manual',
          params: { console: 'iamConsole' },
        },
      ],
      tutorPrompts: [
        'If both break-glass accounts were stored in the same vault, what is the single point of failure?',
        'How would two staff members each hold a half of a FIDO2 secret?',
      ],
      hintIds: ['lab13.s3.h1'],
      points: { exec: 5, 'least-privilege': 2 },
    },
    {
      id: 's4',
      title: 'Exclude break-glass from CA policies',
      brief:
        'Edit CA-001 (Block Legacy Auth) and CA-002 (MFA for Privileged). Add both break-glass accounts to the "Exclude" list. Document the risk acceptance — a sign-in failure of either CA should not lock out the recovery path.',
      validator: { kind: 'role-granted', params: { userId: 'bg-emergency-1' } },
      evidence: [
        {
          kind: 'snapshot',
          capture: 'manual',
          params: { console: 'iamConsole' },
        },
        { kind: 'log-excerpt', capture: 'auto', params: { count: 3 } },
      ],
      tutorPrompts: [
        'What is the blast radius if an attacker compromises a break-glass account?',
        'How do you detect that compromise quickly?',
      ],
      hintIds: ['lab13.s4.h1'],
      points: { exec: 5, docs: 3 },
    },
    {
      id: 's5',
      title: 'Configure real-time alerting',
      brief:
        'In the SecOps Dashboard, create an alert rule: any sign-in by bg-emergency-1 or bg-emergency-2 fires a P0 alert to the on-call channel. Verify the rule by performing a synthetic sign-in.',
      validator: { kind: 'signin-succeeded', params: { userId: 'bg-emergency-1' } },
      evidence: [
        {
          kind: 'log-excerpt',
          capture: 'auto',
          params: { count: 5 },
        },
      ],
      tutorPrompts: [
        'What should the on-call do when the alert fires — page the CISO immediately, or investigate first?',
        'What is the expected MTTR (mean time to respond) on a break-glass alert?',
      ],
      hintIds: ['lab13.s5.h1'],
      points: { exec: 5, troubleshoot: 3 },
    },
    {
      id: 's6',
      title: 'Run a quarterly access review on the accounts',
      brief:
        'The break-glass accounts themselves are now in scope for an access review. Run a review: confirm both accounts still exist, still hold Global Admin, and the credentials are still in the vault. Approve or revoke as appropriate.',
      validator: { kind: 'evidence-collected', params: { stepId: 's6' } },
      evidence: [
        {
          kind: 'snapshot',
          capture: 'manual',
          params: { console: 'iamConsole' },
        },
      ],
      tutorPrompts: [
        'Who is the appropriate reviewer for break-glass accounts — the same people who can use them?',
        'What evidence proves the credentials were actually rotated this quarter?',
      ],
      hintIds: ['lab13.s6.h1'],
      points: { docs: 5, troubleshoot: 5 },
    },
    {
      id: 's7',
      title: 'Test the recovery flow (fault)',
      brief:
        'A fault has been applied: the IdP is rejecting all MFA challenges. Use the break-glass account to recover. Sign in, disable the failing CA policy, and reset MFA. Document the recovery in a post-incident note.',
      validator: { kind: 'fault-cleared', params: { kind: 'idp-mfa-outage' } },
      evidence: [
        {
          kind: 'log-excerpt',
          capture: 'auto',
          params: { count: 5 },
        },
      ],
      tutorPrompts: [
        'What is the first action a recovered admin should take — change the CA policy or rotate the break-glass credentials?',
        'How quickly must the break-glass credentials be rotated after a recovery?',
      ],
      hintIds: ['lab13.s7.h1'],
      points: { troubleshoot: 5, comms: 5 },
    },
  ],
  faults: [
    {
      id: 'f1',
      kind: 'idp-mfa-outage',
      applyAtStep: 's7',
      params: {},
      targetUserId: 'bg-emergency-1' as UserId,
    },
  ],
  debriefQuestions: [
    'When is a break-glass account appropriate, and what guardrails does it still need?',
    'How would you design the credential handoff so that no single person can sign in as Global Admin unilaterally?',
    'What is the difference between a break-glass account and a stolen admin credential from a detection perspective?',
    'How often should break-glass credentials be rotated, and what evidence proves the rotation happened?',
  ],
};
