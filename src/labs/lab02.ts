/**
 * labs/lab02.ts — Joiner / Mover / Leaver.
 */
import { mkLabId } from '@/domain';
import type { Lab } from '@/domain';

export const LAB_02: Lab = {
  id: mkLabId('lab02'),
  number: 2,
  title: 'Identity Lifecycle — Joiner / Mover / Leaver',
  brief:
    'Process three HR tickets: onboard Alex Morgan, transfer Jane Doe to Engineering, and terminate Bob Sato.',
  durationMinutes: 45,
  zoneIds: ['hr', 'iam-ops', 'help-desk'],
  startingZone: 'iam-ops',
  startingSeed: 'lab02',
  objectives: [
    { id: 'o1', description: 'Onboard Alex Morgan', points: 10, category: 'exec' },
    { id: 'o2', description: 'Transfer Jane Doe', points: 10, category: 'exec' },
    { id: 'o3', description: 'Terminate Bob Sato', points: 10, category: 'exec' },
    {
      id: 'o4',
      description: 'Verify no stale access after moves',
      points: 5,
      category: 'troubleshoot',
    },
    {
      id: 'o5',
      description: 'Collect session revocation evidence',
      points: 5,
      category: 'evidence',
    },
    {
      id: 'o6',
      description: 'Document all actions in the change log',
      points: 5,
      category: 'docs',
    },
  ],
  steps: [
    {
      id: 's1',
      title: 'Resolve onboarding ticket for Alex Morgan',
      brief:
        'Open the "Onboard Alex Morgan" ticket in the Help Desk console. Create Alex\'s account, add to grp-finance-payroll, verify sign-in to Finance Portal.',
      validator: { kind: 'signin-succeeded', params: { userId: 'alex.morgan' } },
      evidence: [
        { kind: 'snapshot', capture: 'manual', params: { console: 'ticketConsole' } },
        { kind: 'log-excerpt', capture: 'auto', params: { count: 5 } },
      ],
      tutorPrompts: [
        'What is the smallest set of permissions Alex needs to do their job?',
        'How do you verify a new user was actually provisioned correctly?',
      ],
      hintIds: ['lab02.s1.h1'],
      points: { exec: 10, evidence: 3 },
    },
    {
      id: 's2',
      title: 'Transfer Jane Doe to Engineering',
      brief:
        'Open the transfer ticket. Remove Jane from grp-finance-payroll and grp-finance-analysts. Add to grp-engineering-dev. Verify Jane can no longer access Finance Portal.',
      validator: { kind: 'user-moved', params: { userId: 'jane.doe' } },
      evidence: [{ kind: 'log-excerpt', capture: 'auto', params: { count: 5 } }],
      tutorPrompts: [
        'What is the smallest set of actions that would have left Jane with stale HR access?',
      ],
      hintIds: ['lab02.s2.h1'],
      points: { exec: 10, troubleshoot: 5, evidence: 2 },
    },
    {
      id: 's3',
      title: 'Terminate Bob Sato',
      brief:
        "Open the termination ticket. Disable Bob's account. Revoke all active sessions. Remove from all groups. Verify Bob cannot sign in.",
      validator: { kind: 'signin-succeeded', params: { userId: 'bob.sato' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } }],
      tutorPrompts: [
        'Is disabling the account sufficient, or must sessions be revoked too?',
        'What audit evidence proves Bob is no longer able to authenticate?',
      ],
      hintIds: ['lab02.s3.h1'],
      points: { exec: 10, evidence: 5, docs: 5 },
    },
  ],
  faults: [],
  debriefQuestions: [
    'What is the smallest set of actions that would have left Jane with stale HR access? How would you detect it?',
    'What is the blast radius of skipping session revocation on termination?',
  ],
};
