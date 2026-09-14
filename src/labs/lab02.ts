/**
 * labs/lab02.ts — Joiner / Mover / Leaver.
 *
 * Three HR tickets run the full identity lifecycle: onboard, transfer,
 * terminate. Each ends with a dedicated verification step so the objective
 * "no stale access" is a validation checkpoint, not just a debrief question —
 * matching the 1:1 step-to-evidence shape used by the later labs.
 */
import { mkLabId } from '@/domain';
import type { Lab } from '@/domain';

export const LAB_02: Lab = {
  id: mkLabId('lab02'),
  number: 2,
  title: 'Identity Lifecycle — Joiner / Mover / Leaver',
  brief:
    'Process three HR tickets: onboard Alex Morgan, transfer Jane Doe to Engineering, and terminate Bob Sato. Every move and every termination gets verified, not just performed.',
  durationMinutes: 45,
  zoneIds: ['hr', 'iam-ops', 'help-desk'],
  startingZone: 'iam-ops',
  startingSeed: 'lab02',
  objectives: [
    {
      id: 'o1',
      description: 'Onboard Alex Morgan with least-privilege access',
      points: 12,
      category: 'exec',
    },
    {
      id: 'o2',
      description: 'Transfer Jane Doe: add new access, remove old',
      points: 13,
      category: 'exec',
    },
    {
      id: 'o3',
      description: "Verify Jane's Finance access is actually gone",
      points: 10,
      category: 'troubleshoot',
    },
    {
      id: 'o4',
      description: "Disable Bob Sato's account on termination",
      points: 10,
      category: 'exec',
    },
    {
      id: 'o5',
      description: "Revoke Bob's active sessions and capture proof",
      points: 12,
      category: 'evidence',
    },
    {
      id: 'o6',
      description: 'Write the change-log note for all three tickets',
      points: 10,
      category: 'docs',
    },
  ],
  steps: [
    {
      id: 's1',
      title: 'Resolve onboarding ticket for Alex Morgan',
      brief:
        'Open the "Onboard Alex Morgan" ticket in the Help Desk console. Create Alex\'s account, add to grp-finance-payroll only, verify sign-in to Finance Portal.',
      validator: { kind: 'signin-succeeded', params: { userId: 'alex.morgan' } },
      evidence: [
        { kind: 'snapshot', capture: 'manual', params: { console: 'ticketConsole' } },
        { kind: 'log-excerpt', capture: 'auto', params: { count: 5 } },
      ],
      tutorPrompts: [
        'What is the smallest set of permissions Alex needs to do their job?',
        'How do you verify a new user was actually provisioned correctly, not just created?',
      ],
      hintIds: ['lab02.s1.h1'],
      points: { exec: 10, evidence: 2 },
    },
    {
      id: 's2',
      title: 'Transfer Jane Doe to Engineering',
      brief:
        'Open the transfer ticket. Remove Jane from grp-finance-payroll and grp-finance-analysts. Add to grp-engineering-dev.',
      validator: { kind: 'user-moved', params: { userId: 'jane.doe' } },
      evidence: [{ kind: 'log-excerpt', capture: 'auto', params: { count: 5 } }],
      tutorPrompts: [
        'A transfer is two operations, not one — which comes first, add or remove, and does the order matter?',
      ],
      hintIds: ['lab02.s2.h1'],
      points: { exec: 8, 'least-privilege': 5, evidence: 2 },
    },
    {
      id: 's3',
      title: "Verify Jane's old access is actually gone",
      brief:
        'A completed move is not verified by itself. Confirm Jane can no longer reach the Finance Portal and is out of both finance groups. Capture the check as evidence.',
      validator: { kind: 'evidence-collected', params: { stepId: 's3' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } }],
      tutorPrompts: [
        'What is the smallest set of actions that would have left Jane with stale Finance access?',
        'If you only checked her group list and not her app access, what could you still be missing?',
      ],
      hintIds: ['lab02.s3.h1'],
      points: { troubleshoot: 8, 'least-privilege': 3 },
    },
    {
      id: 's4',
      title: 'Terminate Bob Sato',
      brief: "Open the termination ticket. Disable Bob's account. Verify Bob cannot sign in.",
      // Not signin-succeeded. This step ends "verify Bob cannot sign in", and
      // validating a successful sign-in meant the step only advanced if the
      // termination had failed -- so a learner who did it correctly could
      // never finish. Disabling is the instruction, and it always emits.
      validator: { kind: 'user-disabled', params: { userId: 'bob.sato' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } }],
      tutorPrompts: [
        'Is disabling the account sufficient on its own, or is a session still live underneath it?',
      ],
      hintIds: ['lab02.s4.h1'],
      points: { exec: 8, 'least-privilege': 2 },
    },
    {
      id: 's5',
      title: "Revoke Bob's active sessions",
      brief:
        "Disabling the account blocks new sign-ins, but any session Bob already holds stays live until it's revoked. Revoke every active session for bob.sato and capture the audit trail as evidence.",
      validator: { kind: 'session-revoked', params: { userId: 'bob.sato' } },
      evidence: [{ kind: 'log-excerpt', capture: 'auto', params: { count: 5 } }],
      tutorPrompts: [
        'What audit evidence proves Bob can no longer act, not just no longer log in fresh?',
        'What is the blast radius of skipping session revocation on a termination?',
      ],
      hintIds: ['lab02.s5.h1'],
      points: { exec: 4, troubleshoot: 3, evidence: 5 },
    },
    {
      id: 's6',
      title: 'Write the change-log note',
      brief:
        'Write a short change-log note covering all three tickets: what was done, when, and who requested it. This is the record an auditor would pull six months from now.',
      validator: { kind: 'evidence-collected', params: { stepId: 's6' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'ticketConsole' } }],
      tutorPrompts: [
        'If an auditor asked "who authorized Jane\'s transfer" six months from now, would your note answer it?',
      ],
      hintIds: ['lab02.s6.h1'],
      points: { docs: 6, comms: 4 },
    },
  ],
  faults: [],
  debriefQuestions: [
    'What is the smallest set of actions that would have left Jane with stale HR access? How would you detect it after the fact?',
    'What is the blast radius of skipping session revocation on termination?',
    'Onboarding, transfer, and termination each touch groups and sessions differently — which one carries the most risk if rushed, and why?',
    'How would you prove to an auditor that Bob lost access on the day he left, not the day someone remembered to revoke it?',
  ],
};
