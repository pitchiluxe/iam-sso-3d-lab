/**
 * labs/lab16.ts — LDAP & Kerberos Authentication Troubleshooting.
 *
 * Windows domain logon runs on Kerberos, which fails hard the moment the
 * client and KDC clocks disagree by more than a few minutes — the mock
 * clock-skew fault this app already had (built for lab07) is exactly that
 * failure mode, just never framed as a Kerberos scenario until now.
 */
import { mkLabId } from '@/domain';
import type { Lab } from '@/domain';

export const LAB_16: Lab = {
  id: mkLabId('lab16'),
  number: 16,
  title: 'LDAP & Kerberos Authentication Troubleshooting',
  brief:
    'Multiple domain-joined workstations start failing Windows logon at the same time. Triage the pattern, find the clock skew behind it, fix it, and recover the account it locked out along the way.',
  durationMinutes: 40,
  zoneIds: ['iam-ops', 'sec-ops', 'network-ops', 'server-room'],
  startingZone: 'sec-ops',
  startingSeed: 'lab16',
  objectives: [
    {
      id: 'o1',
      description: 'Triage the logon failure pattern across multiple workstations',
      points: 10,
      category: 'troubleshoot',
    },
    {
      id: 'o2',
      description: 'Diagnose and fix the underlying clock skew',
      points: 15,
      category: 'troubleshoot',
    },
    {
      id: 'o3',
      description: 'Unlock the account locked out during the incident',
      points: 10,
      category: 'exec',
    },
    {
      id: 'o4',
      description: 'Verify sign-in succeeds post-fix',
      points: 8,
      category: 'evidence',
    },
    {
      id: 'o5',
      description: 'Document the Kerberos-specific root cause and prevention',
      points: 7,
      category: 'docs',
    },
  ],
  steps: [
    {
      id: 's1',
      title: 'Triage the logon failure pattern',
      brief:
        'Several users report Windows logon failures at the same time, all against domain-joined machines — no VPN, no SSO portal involved. Review sign-in logs. What do the failures have in common that would point away from a bad password and toward something systemic?',
      validator: { kind: 'evidence-collected', params: { stepId: 's1' } },
      evidence: [{ kind: 'log-excerpt', capture: 'auto', params: { count: 10 } }],
      tutorPrompts: [
        'If this were a bad-password problem, would you expect it to hit multiple users at the same moment?',
        'What is different about a Kerberos ticket failure versus a simple wrong-credential failure?',
      ],
      hintIds: ['lab16.s1.h1'],
      points: { troubleshoot: 10 },
    },
    {
      id: 's2',
      title: 'Diagnose and fix the clock skew (fault)',
      brief:
        'Kerberos tickets are only valid within a tight time window between client and domain controller — by default about 5 minutes. Confirm the DC clock has drifted, then resynchronize it.',
      validator: { kind: 'fault-cleared', params: { kind: 'clock-skew' } },
      evidence: [{ kind: 'log-excerpt', capture: 'auto', params: { count: 5 } }],
      tutorPrompts: [
        'Why does Kerberos care about clock accuracy when password authentication does not?',
        'What tool would you use on a real domain controller to check its time source?',
      ],
      hintIds: ['lab16.s2.h1'],
      points: { troubleshoot: 15 },
    },
    {
      id: 's3',
      title: 'Unlock the account locked out during the incident',
      brief:
        "Greta Olsen's account locked after repeated failed logons while the clock skew was active. Unlock it — the lockout was a side effect of the outage, not evidence of a compromised account.",
      validator: { kind: 'account-unlocked', params: { userId: 'greta.olsen' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } }],
      tutorPrompts: [
        'How would you tell the difference between a lockout caused by this outage and one caused by an actual credential-stuffing attempt?',
      ],
      hintIds: ['lab16.s3.h1'],
      points: { exec: 10 },
    },
    {
      id: 's4',
      title: 'Verify sign-in succeeds',
      brief: 'Confirm Greta can sign in now that the clock is synced and her account is unlocked.',
      validator: { kind: 'signin-succeeded', params: { userId: 'greta.olsen' } },
      evidence: [{ kind: 'log-excerpt', capture: 'auto', params: { count: 3 } }],
      tutorPrompts: [
        'If the sign-in still failed here, which of the two fixes would you suspect first?',
      ],
      hintIds: ['lab16.s4.h1'],
      points: { evidence: 8 },
    },
    {
      id: 's5',
      title: 'Document root cause and prevention',
      brief:
        "Write up: the Kerberos time-tolerance mechanism, why the clock drift caused a mass logon failure instead of one user's problem, and what NTP monitoring would have caught it earlier.",
      validator: { kind: 'evidence-collected', params: { stepId: 's5' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } }],
      tutorPrompts: [
        'Why did this incident affect many users at once instead of looking like isolated help-desk tickets?',
      ],
      hintIds: ['lab16.s5.h1'],
      points: { docs: 7 },
    },
  ],
  faults: [
    {
      id: 'f1',
      kind: 'clock-skew',
      applyAtStep: 's1',
      params: {},
    },
  ],
  debriefQuestions: [
    'Why does Kerberos fail closed on clock skew instead of just being slow?',
    'What is the difference between LDAP (the directory protocol) and Kerberos (the authentication protocol) — why does a domain need both?',
    'What monitoring would turn this into a non-event instead of an incident?',
  ],
};
