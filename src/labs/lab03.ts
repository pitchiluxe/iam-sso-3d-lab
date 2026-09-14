/**
 * labs/lab03.ts — RBAC & Least Privilege.
 *
 * The core RBAC lesson is authentication vs. authorization: signing in
 * proves who you are, an allowed write proves what you're authorized to do.
 * s3 and s5 make that contrast explicit — Jane's allowed write, Alex's
 * denied one — rather than leaving authorization implicit in a sign-in check.
 */
import { mkLabId } from '@/domain';
import type { Lab, UserId } from '@/domain';

export const LAB_03: Lab = {
  id: mkLabId('lab03'),
  number: 3,
  title: 'RBAC & Least Privilege',
  brief:
    "Finance needs payroll access. Discover and remove Bob's standing admin privilege. Prove the allow path and the deny path both work as designed.",
  durationMinutes: 45,
  zoneIds: ['finance', 'iam-ops'],
  startingZone: 'finance',
  startingSeed: 'lab03',
  objectives: [
    { id: 'o1', description: 'Create a role for Finance access', points: 12, category: 'exec' },
    {
      id: 'o2',
      description: 'Grant Jane access via group membership',
      points: 12,
      category: 'exec',
    },
    {
      id: 'o3',
      description: 'Prove Jane can perform the allowed action',
      points: 19,
      category: 'evidence',
    },
    {
      id: 'o4',
      description: "Discover and remove Bob's excess priv",
      points: 24,
      category: 'least-privilege',
    },
    { id: 'o5', description: 'Test and document denied action', points: 19, category: 'exec' },
    { id: 'o6', description: 'Document the authorization model', points: 14, category: 'docs' },
  ],
  steps: [
    {
      id: 's1',
      title: 'Create a role for Finance Payroll',
      brief:
        'Create role-finance-payroll-writer. Assign payroll:read and payroll:write permissions. Do NOT assign directly to users — use group membership.',
      validator: { kind: 'role-granted', params: { userId: 'jane.doe' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } }],
      tutorPrompts: ['Why should roles be granted via group membership, not directly to users?'],
      hintIds: ['lab03.s1.h1'],
      points: { exec: 9, 'least-privilege': 5 },
    },
    {
      id: 's2',
      title: 'Verify Jane gets the role via group membership',
      brief: "Check Jane's effective roles. Verify she can log into the Finance Portal.",
      validator: { kind: 'signin-succeeded', params: { userId: 'jane.doe' } },
      evidence: [{ kind: 'log-excerpt', capture: 'auto', params: { count: 3 } }],
      tutorPrompts: [
        'If a group membership can grant a role, where does authorization actually happen?',
      ],
      hintIds: ['lab03.s2.h1'],
      points: { exec: 9 },
    },
    {
      id: 's3',
      title: 'Prove the allowed action actually works',
      brief:
        'Signing in only proves authentication. As Jane, perform a payroll write in the Finance Portal and confirm it succeeds. Capture the result as evidence.',
      validator: { kind: 'evidence-collected', params: { stepId: 's3' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } }],
      tutorPrompts: [
        'What is the difference between "Jane can sign in" and "Jane is authorized to write payroll"?',
        'If the write silently failed, would the sign-in check from the last step have caught it?',
      ],
      hintIds: ['lab03.s3.h1'],
      points: { evidence: 11, exec: 4 },
    },
    {
      id: 's4',
      title: "Discover and remove Bob's standing admin privilege",
      brief:
        'Bob has role-domain-admin standing. Find it, understand the risk, revoke it, document the removal.',
      validator: { kind: 'role-revoked', params: { userId: 'bob.sato' } },
      evidence: [
        { kind: 'log-excerpt', capture: 'auto', params: { count: 3 } },
        { kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } },
      ],
      tutorPrompts: [
        'What is the risk of a standing privileged account? How would an attacker use it?',
      ],
      hintIds: ['lab03.s4.h1'],
      points: { exec: 9, 'least-privilege': 15, docs: 9 },
    },
    {
      id: 's5',
      title: 'Test the denial path',
      brief:
        'Attempt a payroll write action as Alex Morgan (who has read-only access). Expect denied. Capture the audit log.',
      validator: { kind: 'fault-cleared', params: { kind: 'excessive-permissions' } },
      evidence: [{ kind: 'log-excerpt', capture: 'auto', params: { count: 5 } }],
      tutorPrompts: [
        "If Alex can't write, what is the correct next step?",
        "Jane's write succeeded and Alex's was denied — same portal, same action. What single difference explains both outcomes?",
      ],
      hintIds: ['lab03.s5.h1'],
      points: { exec: 9, troubleshoot: 9 },
    },
    {
      id: 's6',
      title: 'Document the authorization model',
      brief:
        'Write up how authorization actually works here: role → group → user, why Bob was a risk, and how the allow/deny test proves the model is enforced, not just configured.',
      validator: { kind: 'evidence-collected', params: { stepId: 's6' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } }],
      tutorPrompts: [
        'If a new hire asked "how do I know what I can access", could your write-up answer it without reading the code?',
      ],
      hintIds: ['lab03.s6.h1'],
      points: { docs: 11 },
    },
  ],
  faults: [
    {
      id: 'f1',
      kind: 'excessive-permissions',
      applyAtStep: 's1',
      params: {},
      targetUserId: 'bob.sato' as UserId,
    },
  ],
  debriefQuestions: [
    'If a group membership can grant a role, where does authorization actually happen?',
    'What is the blast radius of assigning permissions directly to users instead of via roles?',
    'Authentication proved Jane is Jane. What proved she was authorized to write payroll — and why are those two checks not the same thing?',
  ],
};
