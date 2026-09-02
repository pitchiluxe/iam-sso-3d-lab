/**
 * labs/lab06.ts — Access Reviews.
 */
import { mkLabId } from '@/domain';
import type { Lab, UserId } from '@/domain';

export const LAB_06: Lab = {
  id: mkLabId('lab06'),
  number: 6,
  title: 'Access Reviews & Governance',
  brief: 'Conduct the Q3 2026 access review campaign. Identify dormant accounts and excessive memberships.',
  durationMinutes: 35,
  zoneIds: ['sec-ops', 'iam-ops'],
  startingZone: 'sec-ops',
  startingSeed: 'lab06',
  objectives: [
    { id: 'o1', description: 'Identify dormant and excessive accounts', points: 15, category: 'exec' },
    { id: 'o2', description: 'Record 8 review decisions',              points: 10, category: 'exec' },
    { id: 'o3', description: 'Close campaign and produce summary',     points: 5,  category: 'docs' },
    { id: 'o4', description: 'Collect review evidence',              points: 5,  category: 'evidence' },
  ],
  steps: [
    {
      id: 's1',
      title: 'Identify dormant accounts',
      brief: 'Review the user list. Bob Sato has not signed in for 200 days. Mark his account for review.',
      validator: { kind: 'evidence-collected', params: { stepId: 's1' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } }],
      tutorPrompts: ['What signals make an account "dormant"? Is dormancy alone enough to revoke access?'],
      hintIds: ['lab06.s1.h1'],
      points: { exec: 10 },
    },
    {
      id: 's2',
      title: 'Identify excessive memberships',
      brief: 'Bob also retains grp-engineering-dev even though he is in Finance. Mark both of Bob\'s memberships for revocation.',
      validator: { kind: 'evidence-collected', params: { stepId: 's2' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } }],
      tutorPrompts: ['What signals would tell you a review campaign is being rubber-stamped?'],
      hintIds: ['lab06.s2.h1'],
      points: { exec: 5 },
    },
    {
      id: 's3',
      title: 'Record 8 review decisions',
      brief: 'As Ivy Park, record decisions for all 8 pending items: 6 approve, 2 revoke (Bob\'s memberships).',
      validator: { kind: 'review-decisions-recorded', params: {} },
      evidence: [{ kind: 'log-excerpt', capture: 'auto', params: { count: 8 } }],
      tutorPrompts: ['What would you do if a manager approved every item without reading it?'],
      hintIds: ['lab06.s3.h1'],
      points: { exec: 10, docs: 5 },
    },
    {
      id: 's4',
      title: 'Close campaign and produce summary',
      brief: 'Close the Q3-2026 campaign. Export the summary markdown.',
      validator: { kind: 'evidence-collected', params: { stepId: 's4' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'secOpsDashboard' } }],
      tutorPrompts: ['What should an access review summary contain for a compliance auditor?'],
      hintIds: ['lab06.s4.h1'],
      points: { docs: 5, evidence: 5 },
    },
  ],
  faults: [{ id: 'f1', kind: 'dormant-account', applyAtStep: 's1', params: {}, targetUserId: 'bob.sato' as UserId }],
  debriefQuestions: [
    'What signals would tell you a review campaign is being rubber-stamped?',
    'How would you automate dormant account detection at scale?',
  ],
};
