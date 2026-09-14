/**
 * labs/lab05.ts — MFA & Conditional Access.
 *
 * s4 used to validate 'fault-cleared'/mfa-prompt-loop while its brief
 * described an unrelated foreign-ASN conditional-access policy — the step
 * would complete off s3's MFA fix regardless of whether the learner did any
 * CA work at all. Split cleanly: s3 owns the MFA-loop fix, s4 owns the CA
 * policy — now the real policy.conditionalAccess.set capability added for
 * lab22, with Verify Authentication actually passing an ASN through and a
 * genuine block getting audited, not just narrated.
 * s5 (the named exception) stays evidence-collected/narrative: this app's
 * policy model has no per-user exception override, only role/tenant scoping.
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
    { id: 'o1', description: 'Enable MFA for privileged roles', points: 21, category: 'exec' },
    { id: 'o2', description: 'Enroll Erin in TOTP', points: 11, category: 'exec' },
    { id: 'o3', description: 'Fix MFA prompt loop', points: 17, category: 'troubleshoot' },
    {
      id: 'o4',
      description: 'Design and test a foreign-ASN conditional access policy',
      points: 21,
      category: 'exec',
    },
    {
      id: 'o5',
      description: 'Test a policy exception without weakening the block',
      points: 15,
      category: 'least-privilege',
    },
    {
      id: 'o6',
      description: 'Document the MFA and CA configuration',
      points: 15,
      category: 'docs',
    },
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
      points: { exec: 21 },
    },
    {
      id: 's2',
      title: 'Enroll Erin in TOTP',
      brief: 'Complete MFA enrollment for Erin Cho. Complete a sign-in with MFA.',
      validator: { kind: 'signin-succeeded', params: { userId: 'erin.cho' } },
      evidence: [{ kind: 'log-excerpt', capture: 'auto', params: { count: 3 } }],
      tutorPrompts: ['What happens when a user loses their TOTP device?'],
      hintIds: ['lab05.s2.h1'],
      points: { exec: 11 },
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
      points: { troubleshoot: 17 },
    },
    {
      id: 's4',
      title: 'Design and test a conditional access policy',
      brief:
        'Use Set Conditional Access Policy to block sign-ins from ASN AS-99999 tenant-wide (leave Role blank). Then use Verify Authentication with ASN set to AS-99999 and confirm the sign-in is actually blocked, not just described as blocked.',
      validator: { kind: 'ca-policy-created', params: { policyKind: 'foreign-asn' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'secOpsDashboard' } }],
      tutorPrompts: [
        'Where would you evaluate a conditional access policy: IdP, app, or proxy?',
        'What signal tells you a sign-in is from a foreign ASN in the first place?',
      ],
      hintIds: ['lab05.s4.h1'],
      points: { exec: 21 },
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
      points: { 'least-privilege': 15 },
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
      points: { docs: 15 },
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
