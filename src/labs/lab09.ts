/**
 * labs/lab09.ts — Privileged Access Management.
 */
import { mkLabId } from '@/domain';
import type { Lab } from '@/domain';

export const LAB_09: Lab = {
  id: mkLabId('lab09'),
  number: 9,
  title: 'Privileged Identity Management',
  brief: 'Remove Hank\'s standing domain admin privilege. Implement a time-limited elevation workflow with manager approval.',
  durationMinutes: 40,
  zoneIds: ['iam-ops', 'sec-ops'],
  startingZone: 'iam-ops',
  startingSeed: 'lab09',
  objectives: [
    { id: 'o1', description: 'Identify and remove standing privilege', points: 15, category: 'least-privilege' },
    { id: 'o2', description: 'Create time-limited elevation workflow',     points: 5,  category: 'exec' },
    { id: 'o3', description: 'Approve and exercise elevation',             points: 5,  category: 'exec' },
    { id: 'o4', description: 'Review admin activity log',                points: 5,  category: 'troubleshoot' },
    { id: 'o5', description: 'Document the PAM policy',                 points: 5,  category: 'docs' },
  ],
  steps: [
    {
      id: 's1',
      title: 'Identify Hank\'s standing privilege',
      brief: 'Review group memberships. Hank O\'Neill has role-domain-admin standing via grp-domain-admins.',
      validator: { kind: 'evidence-collected', params: { stepId: 's1' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } }],
      tutorPrompts: ['What is wrong with an administrator using a privileged account for daily email?'],
      hintIds: ['lab09.s1.h1'],
      points: { exec: 5, 'least-privilege': 10 },
    },
    {
      id: 's2',
      title: 'Remove standing privilege',
      brief: 'Remove Hank from grp-domain-admins. Document the removal with a reason.',
      validator: { kind: 'role-revoked', params: { userId: 'hank.oneill' } },
      evidence: [{ kind: 'log-excerpt', capture: 'auto', params: { count: 3 } }],
      tutorPrompts: ['What is a break-glass account, and when is it appropriate?'],
      hintIds: ['lab09.s2.h1'],
      points: { exec: 5, docs: 5 },
    },
    {
      id: 's3',
      title: 'Request elevation via workflow',
      brief: 'Submit a privilege elevation request for Hank. Wait for Ivy Park\'s approval. Record the approval.',
      validator: { kind: 'evidence-collected', params: { stepId: 's3' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'ticketConsole' } }],
      tutorPrompts: ['What guardrails should a break-glass workflow still have?'],
      hintIds: ['lab09.s3.h1'],
      points: { exec: 5 },
    },
    {
      id: 's4',
      title: 'Exercise admin action and auto-revoke',
      brief: 'After approval, exercise the elevated privilege. Complete the admin task. Verify the elevation auto-revokes after 15 minutes.',
      validator: { kind: 'session-revoked', params: { userId: 'hank.oneill' } },
      evidence: [{ kind: 'log-excerpt', capture: 'auto', params: { count: 5 } }],
      tutorPrompts: ['How does a time-limited grant differ from a standing privilege in an audit trail?'],
      hintIds: ['lab09.s4.h1'],
      points: { exec: 5, troubleshoot: 5 },
    },
    {
      id: 's5',
      title: 'Document the PAM policy',
      brief: 'Write up the PAM policy: who can request, who approves, duration, and audit requirements.',
      validator: { kind: 'evidence-collected', params: { stepId: 's5' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } }],
      tutorPrompts: ['What guardrails does a break-glass account still need?'],
      hintIds: ['lab09.s5.h1'],
      points: { docs: 5 },
    },
  ],
  faults: [],
  debriefQuestions: [
    'When is a break-glass account appropriate, and what guardrails does it still need?',
    'What audit evidence proves the elevation was legitimate and not abused?',
  ],
};
