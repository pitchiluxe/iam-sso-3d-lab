/**
 * labs/lab03.ts — RBAC & Least Privilege.
 */
import { mkLabId } from '@/domain';
import type { Lab, UserId } from '@/domain';

export const LAB_03: Lab = {
  id: mkLabId('lab03'),
  number: 3,
  title: 'RBAC & Least Privilege',
  brief: 'Finance needs payroll access. Discover and remove Bob\'s standing admin privilege. Test the denial path.',
  durationMinutes: 40,
  zoneIds: ['finance', 'iam-ops'],
  startingZone: 'finance',
  startingSeed: 'lab03',
  objectives: [
    { id: 'o1', description: 'Create a role for Finance access',       points: 5,  category: 'exec' },
    { id: 'o2', description: 'Grant Jane access via group membership',  points: 5,  category: 'exec' },
    { id: 'o3', description: 'Discover and remove Bob\'s excess priv', points: 10, category: 'least-privilege' },
    { id: 'o4', description: 'Test and document denied action',       points: 5,  category: 'exec' },
    { id: 'o5', description: 'Document the authorization model',       points: 5,  category: 'docs' },
  ],
  steps: [
    {
      id: 's1',
      title: 'Create a role for Finance Payroll',
      brief: 'Create role-finance-payroll-writer. Assign payroll:read and payroll:write permissions. Do NOT assign directly to users — use group membership.',
      validator: { kind: 'role-granted', params: { userId: 'jane.doe' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } }],
      tutorPrompts: ['Why should roles be granted via group membership, not directly to users?'],
      hintIds: ['lab03.s1.h1'],
      points: { exec: 5, 'least-privilege': 3 },
    },
    {
      id: 's2',
      title: 'Verify Jane gets the role via group membership',
      brief: 'Check Jane\'s effective roles. Verify she can log into the Finance Portal.',
      validator: { kind: 'signin-succeeded', params: { userId: 'jane.doe' } },
      evidence: [{ kind: 'log-excerpt', capture: 'auto', params: { count: 3 } }],
      tutorPrompts: ['If a group membership can grant a role, where does authorization actually happen?'],
      hintIds: ['lab03.s2.h1'],
      points: { exec: 5 },
    },
    {
      id: 's3',
      title: 'Discover and remove Bob\'s standing admin privilege',
      brief: 'Bob has role-domain-admin standing. Find it, understand the risk, revoke it, document the removal.',
      validator: { kind: 'role-revoked', params: { userId: 'bob.sato' } },
      evidence: [
        { kind: 'log-excerpt', capture: 'auto', params: { count: 3 } },
        { kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } },
      ],
      tutorPrompts: ['What is the risk of a standing privileged account? How would an attacker use it?'],
      hintIds: ['lab03.s3.h1'],
      points: { exec: 5, 'least-privilege': 10, docs: 5 },
    },
    {
      id: 's4',
      title: 'Test the denial path',
      brief: 'Attempt a payroll write action as Alex Morgan (who has read-only access). Expect denied. Capture the audit log.',
      validator: { kind: 'fault-cleared', params: { kind: 'excessive-permissions' } },
      evidence: [{ kind: 'log-excerpt', capture: 'auto', params: { count: 5 } }],
      tutorPrompts: ['If Alex can\'t write, what is the correct next step?'],
      hintIds: ['lab03.s4.h1'],
      points: { exec: 5, troubleshoot: 5 },
    },
  ],
  faults: [{ id: 'f1', kind: 'excessive-permissions', applyAtStep: 's1', params: {}, targetUserId: 'bob.sato' as UserId }],
  debriefQuestions: [
    'If a group membership can grant a role, where does authorization actually happen?',
    'What is the blast radius of assigning permissions directly to users instead of via roles?',
  ],
};
