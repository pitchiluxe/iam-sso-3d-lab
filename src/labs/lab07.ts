/**
 * labs/lab07.ts — SSO Break/Fix.
 * Fault is randomized at step 1.
 */
import { mkLabId } from '@/domain';
import type { Lab, FaultKind, AppId } from '@/domain';

const SSO_FAULTS: FaultKind[] = [
  'wrong-redirect-uri',
  'expired-cert',
  'wrong-issuer',
  'wrong-client-secret',
  'wrong-claim-mapping',
  'clock-skew',
  'dns-resolution',
];

// Randomize per run, seeded by lab start time
const pickFault = (): FaultKind => {
  const i = Math.floor((Date.now() / 1000) % SSO_FAULTS.length);
  return SSO_FAULTS[i]!;
};

export const LAB_07_FAULT = pickFault();

export const LAB_07: Lab = {
  id: mkLabId('lab07'),
  number: 7,
  title: 'SSO Production Break/Fix',
  brief:
    'At 09:05 AM employees report authentication errors on the Finance Portal. Triage, diagnose, and fix the SSO fault.',
  durationMinutes: 40,
  zoneIds: ['iam-ops', 'app-center', 'sec-ops'],
  startingZone: 'iam-ops',
  startingSeed: 'lab07',
  objectives: [
    {
      id: 'o1',
      description: 'Triage and reproduce the issue',
      points: 5,
      category: 'troubleshoot',
    },
    { id: 'o2', description: 'Identify the root cause', points: 10, category: 'troubleshoot' },
    { id: 'o3', description: 'Apply the correct fix', points: 5, category: 'exec' },
    { id: 'o4', description: 'Retest with both user types', points: 5, category: 'evidence' },
    { id: 'o5', description: 'Document root cause and fix', points: 5, category: 'docs' },
  ],
  steps: [
    {
      id: 's1',
      title: 'Open incident and receive fault (fault injected)',
      brief: `A fault has been injected. Finance Portal SSO is failing. Open an incident ticket. The fault is: ${LAB_07_FAULT}.`,
      validator: { kind: 'evidence-collected', params: { stepId: 's1' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'ticketConsole' } }],
      tutorPrompts: ['What is the first log you would check when SSO fails?'],
      hintIds: ['lab07.s1.h1'],
      points: { troubleshoot: 5 },
    },
    {
      id: 's2',
      title: 'Triage: check IdP logs, app config, DNS, time',
      brief:
        'Compare the Finance Portal config against the baseline. Check IdP authentication logs. Verify DNS resolution and clock skew.',
      validator: { kind: 'evidence-collected', params: { stepId: 's2' } },
      evidence: [
        { kind: 'config-diff', capture: 'auto', params: { appId: 'app-finance' } },
        { kind: 'log-excerpt', capture: 'auto', params: { count: 10 } },
      ],
      tutorPrompts: ['Why did you check DNS before certificates?'],
      hintIds: ['lab07.s2.h1'],
      points: { troubleshoot: 10, evidence: 3 },
    },
    {
      id: 's3',
      title: 'Identify and apply the fix',
      brief: 'Use the IAM Console to correct the misconfigured field on the Finance Portal.',
      validator: { kind: 'app-config-fixed', params: { appId: 'app-finance' } },
      evidence: [{ kind: 'config-diff', capture: 'auto', params: { appId: 'app-finance' } }],
      tutorPrompts: [
        'What is the difference between the wrong issuer and a wrong redirect URI as failure modes?',
      ],
      hintIds: ['lab07.s3.h1'],
      points: { exec: 5 },
    },
    {
      id: 's4',
      title: 'Retest and document',
      brief:
        'Sign in as Dan Rivera (normal) and Erin Cho (privileged) — both must succeed. Document root cause and remediation.',
      validator: { kind: 'signin-succeeded', params: { userId: 'erin.cho' } },
      evidence: [{ kind: 'log-excerpt', capture: 'auto', params: { count: 5 } }],
      tutorPrompts: ['What would you add to a runbook to prevent this fault from recurring?'],
      hintIds: ['lab07.s4.h1'],
      points: { exec: 5, evidence: 5, docs: 5 },
    },
  ],
  faults: [
    {
      id: 'f1',
      kind: LAB_07_FAULT,
      applyAtStep: 's1',
      params: {},
      targetAppId: 'app-finance' as AppId,
    },
  ],
  debriefQuestions: [
    'Why did you check DNS before certificates?',
    'What monitoring would have caught this fault before users reported it?',
  ],
};
