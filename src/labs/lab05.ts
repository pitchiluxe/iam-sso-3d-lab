/**
 * labs/lab05.ts — MFA & Conditional Access.
 *
 * s4 used to validate 'fault-cleared'/mfa-prompt-loop while its brief
 * described an unrelated foreign-ASN conditional-access policy — the step
 * would complete off s3's MFA fix regardless of whether the learner did any
 * CA work at all. Split cleanly: s3 owns the MFA-loop fix, s4 owns the CA
 * policy (evidence-collected, same pattern lab11's CA-policy steps use —
 * this app has no CA-policy authoring capability, so it's narrative/manual
 * like every other CA step, not mechanically enforced).
 */
import { mkLabId } from '@/domain';
import type { Lab, UserId } from '@/domain';

export const LAB_05: Lab = {
  id: mkLabId('lab05'),
  number: 5,
  title: 'MFA & Conditional Access',
  brief:
    'Enforce MFA for privileged users. Fix a repeated MFA prompt issue. Design and test a conditional access policy that blocks a foreign ASN — without locking out a legitimate exception.',
  durationMinutes: 50,
  zoneIds: ['iam-ops', 'sec-ops'],
  startingZone: 'iam-ops',
  startingSeed: 'lab05',
  objectives: [
    { id: 'o1', description: 'Enable MFA for privileged roles', points: 10, category: 'exec' },
    { id: 'o2', description: 'Enroll Erin in TOTP', points: 5, category: 'exec' },
    { id: 'o3', description: 'Fix MFA prompt loop', points: 8, category: 'troubleshoot' },
    {
      id: 'o4',
      description: 'Design and test a foreign-ASN conditional access policy',
      points: 10,
      category: 'exec',
    },
    {
      id: 'o5',
      description: 'Test a policy exception without weakening the block',
      points: 7,
      category: 'least-privilege',
    },
    { id: 'o6', description: 'Document the MFA and CA configuration', points: 7, category: 'docs' },
  ],
  steps: [
    {
      id: 's1',
      title: 'Enable MFA for privileged roles',
      brief: 'In the IdP, enable MFA enforcement for role-iam-admins and role-domain-admins.',
      validator: { kind: 'mfa-challenge-completed', params: { userId: 'erin.cho' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } }],
      tutorPrompts: ['Why should MFA be required for privileged accounts, not all accounts?'],
      hintIds: ['lab05.s1.h1'],
      points: { exec: 10 },
    },
    {
      id: 's2',
      title: 'Enroll Erin in TOTP',
      brief: 'Complete MFA enrollment for Erin Cho. Complete a sign-in with MFA.',
      validator: { kind: 'signin-succeeded', params: { userId: 'erin.cho' } },
      evidence: [{ kind: 'log-excerpt', capture: 'auto', params: { count: 3 } }],
      tutorPrompts: ['What happens when a user loses their TOTP device?'],
      hintIds: ['lab05.s2.h1'],
      points: { exec: 5 },
    },
    {
      id: 's3',
      title: 'Fix MFA prompt loop (fault)',
      brief:
        'Erin reports being prompted for MFA repeatedly. Diagnose via sign-in logs. Fix the issue and complete a clean MFA challenge.',
      validator: { kind: 'mfa-challenge-completed', params: { userId: 'erin.cho' } },
      evidence: [{ kind: 'log-excerpt', capture: 'auto', params: { count: 5 } }],
      tutorPrompts: [
        'What log fields distinguish a genuine failure from a loop caused by misconfiguration?',
      ],
      hintIds: ['lab05.s3.h1'],
      points: { troubleshoot: 8 },
    },
    {
      id: 's4',
      title: 'Design and test a conditional access policy',
      brief:
        'Write a CA policy that blocks sign-ins from a foreign ASN. Simulate a sign-in from that ASN and confirm it is blocked. Capture the block as evidence.',
      validator: { kind: 'evidence-collected', params: { stepId: 's4' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'secOpsDashboard' } }],
      tutorPrompts: [
        'Where would you evaluate a conditional access policy: IdP, app, or proxy?',
        'What signal tells you a sign-in is from a foreign ASN in the first place?',
      ],
      hintIds: ['lab05.s4.h1'],
      points: { exec: 10 },
    },
    {
      id: 's5',
      title: 'Test a policy exception',
      brief:
        'A traveling executive legitimately signs in from the blocked ASN next week. Add a scoped exception (named user, time-boxed) and verify it does not open the block for anyone else.',
      validator: { kind: 'evidence-collected', params: { stepId: 's5' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'secOpsDashboard' } }],
      tutorPrompts: [
        'If the exception were "allow this ASN" instead of "allow this user from this ASN", who else would slip through?',
        'How would you make sure the exception expires instead of becoming permanent?',
      ],
      hintIds: ['lab05.s5.h1'],
      points: { 'least-privilege': 7 },
    },
    {
      id: 's6',
      title: 'Document the MFA and CA configuration',
      brief:
        'Write up: which roles require MFA, the prompt-loop root cause and fix, the CA block policy, and the exception with its expiry.',
      validator: { kind: 'evidence-collected', params: { stepId: 's6' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } }],
      tutorPrompts: [
        'Six months from now, would your document explain why the exception exists, or just that it does?',
      ],
      hintIds: ['lab05.s6.h1'],
      points: { docs: 7 },
    },
  ],
  faults: [
    {
      id: 'f1',
      kind: 'mfa-prompt-loop',
      applyAtStep: 's3',
      params: {},
      targetUserId: 'erin.cho' as UserId,
    },
  ],
  debriefQuestions: [
    'Where would you put a step-up auth requirement: IdP, app, or proxy?',
    'What MFA method would you recommend for a CFO who refuses to install an authenticator app?',
    'A scoped exception and a policy rollback both "unblock" someone — what makes one safe and the other a regression?',
  ],
};
