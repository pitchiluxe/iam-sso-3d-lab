/**
 * labs/lab05.ts — MFA & Conditional Access.
 */
import { mkLabId } from '@/domain';
import type { Lab, UserId } from '@/domain';

export const LAB_05: Lab = {
  id: mkLabId('lab05'),
  number: 5,
  title: 'MFA & Conditional Access',
  brief:
    'Enforce MFA for privileged users. Fix a repeated MFA prompt issue. Block a foreign ASN sign-in.',
  durationMinutes: 40,
  zoneIds: ['iam-ops', 'sec-ops'],
  startingZone: 'iam-ops',
  startingSeed: 'lab05',
  objectives: [
    { id: 'o1', description: 'Enable MFA for privileged roles', points: 10, category: 'exec' },
    { id: 'o2', description: 'Enroll Erin in TOTP', points: 5, category: 'exec' },
    { id: 'o3', description: 'Fix MFA prompt loop', points: 5, category: 'troubleshoot' },
    {
      id: 'o4',
      description: 'Set and test conditional access policy',
      points: 10,
      category: 'exec',
    },
    { id: 'o5', description: 'Document the MFA configuration', points: 5, category: 'docs' },
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
        'Erin reports being prompted for MFA repeatedly. Diagnose via sign-in logs. Fix the issue.',
      validator: { kind: 'mfa-challenge-completed', params: { userId: 'erin.cho' } },
      evidence: [{ kind: 'log-excerpt', capture: 'auto', params: { count: 5 } }],
      tutorPrompts: [
        'What log fields distinguish a genuine failure from a loop caused by misconfiguration?',
      ],
      hintIds: ['lab05.s3.h1'],
      points: { exec: 5, troubleshoot: 5 },
    },
    {
      id: 's4',
      title: 'Set a conditional access policy',
      brief:
        'Block sign-ins from a foreign ASN. Verify the policy is evaluated correctly in a simulated block.',
      validator: { kind: 'fault-cleared', params: { kind: 'mfa-prompt-loop' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'secOpsDashboard' } }],
      tutorPrompts: ['Where would you put a step-up auth requirement: IdP, app, or proxy?'],
      hintIds: ['lab05.s4.h1'],
      points: { exec: 10, docs: 5 },
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
  ],
};
