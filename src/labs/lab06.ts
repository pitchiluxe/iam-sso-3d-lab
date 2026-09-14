/**
 * labs/lab06.ts — Access Reviews.
 */
import { mkLabId } from '@/domain';
import type { Lab, UserId } from '@/domain';

export const LAB_06: Lab = {
  id: mkLabId('lab06'),
  number: 6,
  title: 'Access Reviews & Governance',
  brief:
    'Conduct the Q3 2026 access review campaign. Identify dormant accounts and excessive memberships.',
  durationMinutes: 35,
  zoneIds: ['sec-ops', 'iam-ops'],
  startingZone: 'sec-ops',
  startingSeed: 'lab06',
  objectives: [
    { id: 'o1', description: 'Identify dormant accounts', points: 19, category: 'exec' },
    { id: 'o2', description: 'Identify excessive memberships', points: 16, category: 'exec' },
    {
      id: 'o3',
      description: 'Identify privileged accounts in scope',
      points: 19,
      category: 'least-privilege',
    },
    { id: 'o4', description: 'Record 8 review decisions correctly', points: 22, category: 'exec' },
    { id: 'o5', description: 'Close campaign and produce summary', points: 12, category: 'docs' },
    { id: 'o6', description: 'Collect review evidence', points: 12, category: 'evidence' },
  ],
  steps: [
    {
      id: 's1',
      title: 'Identify dormant accounts',
      brief:
        'Review the user list. Bob Sato has not signed in for 200 days. Mark his account for review.',
      validator: { kind: 'evidence-collected', params: { stepId: 's1' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } }],
      tutorPrompts: [
        'What signals make an account "dormant"? Is dormancy alone enough to revoke access?',
      ],
      hintIds: ['lab06.s1.h1'],
      points: { exec: 19 },
    },
    {
      id: 's2',
      title: 'Identify excessive memberships',
      brief:
        "Bob also retains grp-engineering-dev even though he is in Finance. Mark both of Bob's memberships for revocation.",
      validator: { kind: 'evidence-collected', params: { stepId: 's2' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } }],
      tutorPrompts: ['What signals would tell you a review campaign is being rubber-stamped?'],
      hintIds: ['lab06.s2.h1'],
      points: { exec: 16 },
    },
    {
      id: 's3',
      title: 'Identify privileged accounts in scope',
      brief:
        'Two of the 8 pending items grant grp-iam-admins or grp-helpdesk-tier1 to Ivy Park. Flag which items in this campaign touch privileged access — those deserve closer scrutiny than a routine department group.',
      validator: { kind: 'evidence-collected', params: { stepId: 's3' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'secOpsDashboard' } }],
      tutorPrompts: [
        'Should a privileged-group item get the same 30-second glance as a routine one?',
      ],
      hintIds: ['lab06.s3.h1'],
      points: { 'least-privilege': 19 },
    },
    {
      id: 's4',
      title: 'Record 8 review decisions',
      brief:
        "As Ivy Park, record decisions for all 8 pending items: 6 approve, 2 revoke (Bob's memberships). Use the per-item Approve/Revoke controls — the flagged recommendation is a starting point, not an instruction to click one bulk button.",
      validator: { kind: 'review-decisions-recorded', params: {} },
      evidence: [{ kind: 'log-excerpt', capture: 'auto', params: { count: 8 } }],
      tutorPrompts: ['What would you do if a manager approved every item without reading it?'],
      hintIds: ['lab06.s4.h1'],
      points: { exec: 22 },
    },
    {
      id: 's5',
      title: 'Close campaign and produce summary',
      brief: 'Close the Q3-2026 campaign. Export the summary markdown.',
      validator: { kind: 'evidence-collected', params: { stepId: 's5' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'secOpsDashboard' } }],
      tutorPrompts: ['What should an access review summary contain for a compliance auditor?'],
      hintIds: ['lab06.s5.h1'],
      points: { docs: 12, evidence: 12 },
    },
  ],
  faults: [
    {
      id: 'f1',
      kind: 'dormant-account',
      applyAtStep: 's1',
      params: {},
      targetUserId: 'bob.sato' as UserId,
    },
  ],
  debriefQuestions: [
    'What signals would tell you a review campaign is being rubber-stamped?',
    'How would you automate dormant account detection at scale?',
  ],
};
