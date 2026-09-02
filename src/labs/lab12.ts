/**
 * labs/lab12.ts — Hybrid Identity (Cloud Sync).
 *
 * Learner provisions on-premises AD, installs the cloud sync agent,
 * configures password hash sync (PHS), runs the initial sync,
 * processes joiner / mover / leaver deltas, and resolves common
 * sync errors.
 *
 * Validator notes:
 *   - 'user-created' + 'group-added' cover the JML provisioning actions.
 *   - 'sync-completed' is a NEW validator the conductor must add; it
 *     should fire on 'sync.delta.success' events emitted by a mock
 *     sync scheduler.
 *   - 'sync-conflict-resolved' is a NEW validator for the conflict
 *     resolution step; it should fire on 'sync.conflict.resolved'.
 */
import { mkLabId } from '@/domain';
import type { Lab, UserId } from '@/domain';

export const LAB_12: Lab = {
  id: mkLabId('lab12'),
  number: 12,
  title: 'Hybrid Identity — Cloud Sync',
  brief:
    'Stand up the on-prem AD, install and configure the cloud sync agent, sync users to the cloud directory, process a joiner / mover / leaver delta, and resolve a soft-match conflict.',
  durationMinutes: 50,
  zoneIds: ['help-desk', 'iam-ops'],
  startingZone: 'iam-ops',
  startingSeed: 'lab12',
  objectives: [
    {
      id: 'o1',
      description: 'Configure on-prem AD and install cloud sync agent',
      points: 10,
      category: 'exec',
    },
    {
      id: 'o2',
      description: 'Enable password hash sync (PHS)',
      points: 10,
      category: 'exec',
    },
    {
      id: 'o3',
      description: 'Run initial sync and verify cloud identities',
      points: 5,
      category: 'exec',
    },
    {
      id: 'o4',
      description: 'Process joiner / mover / leaver delta sync',
      points: 10,
      category: 'exec',
    },
    {
      id: 'o5',
      description: 'Diagnose and resolve a soft-match conflict',
      points: 5,
      category: 'troubleshoot',
    },
    {
      id: 'o6',
      description: 'Document the sync topology and recovery plan',
      points: 5,
      category: 'docs',
    },
  ],
  steps: [
    {
      id: 's1',
      title: 'Provision on-prem AD users',
      brief:
        'Open the Help Desk console. Confirm the on-prem AD has the seed users (alex.morgan, jane.doe, bob.sato, erin.cho, hank.oneill). Add a new on-prem user "mel.tan" to test sync.',
      validator: { kind: 'user-created', params: { userId: 'mel.tan' } },
      evidence: [
        {
          kind: 'snapshot',
          capture: 'manual',
          params: { console: 'iamConsole' },
        },
      ],
      tutorPrompts: [
        'What attribute in on-prem AD is the source of truth for UPN?',
        'Why is the choice of UPN suffix important for cloud sign-in?',
      ],
      hintIds: ['lab12.s1.h1'],
      points: { exec: 5, evidence: 3 },
    },
    {
      id: 's2',
      title: 'Install the cloud sync agent',
      brief:
        'In the IAM Console, navigate to Cloud Sync. Install the cloud sync agent on the simulated on-prem connector. Configure it to use the staged service account. Verify the agent registers as healthy.',
      validator: { kind: 'evidence-collected', params: { stepId: 's2' } },
      evidence: [
        {
          kind: 'snapshot',
          capture: 'manual',
          params: { console: 'iamConsole' },
        },
      ],
      tutorPrompts: [
        'What ports must be open from the on-prem connector to the cloud?',
        'What happens if the service account password expires?',
      ],
      hintIds: ['lab12.s2.h1'],
      points: { exec: 5 },
    },
    {
      id: 's3',
      title: 'Enable password hash sync',
      brief:
        'Configure the sync to include Password Hash Sync. The on-prem AD is the source of truth; cloud accounts will not store a separate password.',
      validator: { kind: 'evidence-collected', params: { stepId: 's3' } },
      evidence: [
        {
          kind: 'snapshot',
          capture: 'manual',
          params: { console: 'iamConsole' },
        },
      ],
      tutorPrompts: [
        'What does PHS transmit — the cleartext password, the hash, or a derived value?',
        'How does the cloud validate the PHS value at sign-in?',
        'What is the risk of an attacker stealing the PHS blob, and how do you mitigate it?',
      ],
      hintIds: ['lab12.s3.h1', 'lab12.s3.h2'],
      points: { exec: 10, docs: 3 },
    },
    {
      id: 's4',
      title: 'Run initial sync and verify',
      brief:
        'Trigger the initial sync. Wait for it to complete. Verify all 6 users (the 5 seeded + mel.tan) appear in the cloud directory. Verify each has the correct UPN and group membership.',
      validator: { kind: 'evidence-collected', params: { stepId: 's4' } },
      evidence: [
        {
          kind: 'log-excerpt',
          capture: 'auto',
          params: { count: 10 },
        },
      ],
      tutorPrompts: [
        'How long does initial sync typically take for 1,000 / 10,000 / 100,000 users?',
        'What is a delta sync, and how often does it run by default?',
      ],
      hintIds: ['lab12.s4.h1'],
      points: { exec: 5, troubleshoot: 3 },
    },
    {
      id: 's5',
      title: 'Process JML delta sync',
      brief:
        'Process three deltas in the on-prem AD:\n' +
        '  1. Joiner: add nina.patel as Engineering Intern\n' +
        '  2. Mover: move jane.doe from Finance to Engineering\n' +
        '  3. Leaver: disable bob.sato\n' +
        'Trigger a delta sync. Verify each change appears in the cloud directory.',
      validator: { kind: 'signin-succeeded', params: { userId: 'nina.patel' } },
      evidence: [
        {
          kind: 'log-excerpt',
          capture: 'auto',
          params: { count: 8 },
        },
      ],
      tutorPrompts: [
        'How long does a delta sync take to propagate to the cloud?',
        'If a leaver is disabled in on-prem, how long until the cloud refuses sign-in?',
      ],
      hintIds: ['lab12.s5.h1'],
      points: { exec: 10, troubleshoot: 5 },
    },
    {
      id: 's6',
      title: 'Resolve a soft-match conflict',
      brief:
        'A new on-prem user "Alex Morgan" has been provisioned with a different UPN than the existing cloud account. The sync reports a soft-match conflict. Resolve it by joining the two accounts (NOT by deleting one) and write a one-line justification.',
      validator: { kind: 'evidence-collected', params: { stepId: 's6' } },
      evidence: [
        {
          kind: 'snapshot',
          capture: 'manual',
          params: { console: 'iamConsole' },
        },
      ],
      tutorPrompts: [
        'What is the difference between a soft match and a hard match?',
        'What is the most important attribute for hard-matching?',
        'If you accidentally delete the cloud object during conflict resolution, what is the blast radius?',
      ],
      hintIds: ['lab12.s6.h1', 'lab12.s6.h2'],
      points: { troubleshoot: 5, evidence: 5, docs: 2 },
    },
    {
      id: 's7',
      title: 'Document the sync topology and DR plan',
      brief:
        'Write a one-page document covering: source of truth, sync direction, schedule, alert thresholds, fallback (how would you sign in if the connector is down?), and the runbook for the conflict you just resolved.',
      validator: { kind: 'evidence-collected', params: { stepId: 's7' } },
      evidence: [
        {
          kind: 'snapshot',
          capture: 'manual',
          params: { console: 'iamConsole' },
        },
      ],
      tutorPrompts: [
        'If the cloud sync agent fails for 24 hours, what compensating control keeps you safe?',
        'What KPI would you track to know sync is healthy?',
      ],
      hintIds: ['lab12.s7.h1'],
      points: { docs: 5 },
    },
  ],
  faults: [
    {
      id: 'f1',
      kind: 'sync-soft-match-conflict',
      applyAtStep: 's6',
      params: {},
      targetUserId: 'alex.morgan' as UserId,
    },
  ],
  debriefQuestions: [
    'What is the difference between cloud sync and Azure AD Connect? When would you pick one over the other?',
    'If the on-prem AD is offline for 6 hours, what is the impact on cloud sign-in for synced users?',
    'What is the security model of PHS, and what attack does it protect against?',
    'How would you handle a multi-forest merge into a single cloud tenant?',
  ],
};
