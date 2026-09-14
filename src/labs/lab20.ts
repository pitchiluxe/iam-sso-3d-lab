/**
 * labs/lab20.ts — Identity Threat Detection (ITDR).
 *
 * lab08 already teaches incident containment once the affected account is
 * known. This lab is the step before that: three accounts show overnight
 * sign-in activity and only one is real. The sign-in pattern alone does not
 * prove anything — Dan's failed-then-succeeded login is a mistyped password,
 * Greta's new-city login is a business trip. What makes Finn's the real one
 * is the privilege change that followed it, which nobody requested. The real
 * threat is also the SecOps analyst's own account, on purpose: this lab
 * tests whether the learner investigates a colleague's account as
 * impartially as a stranger's.
 */
import { mkLabId } from '@/domain';
import type { Lab } from '@/domain';

export const LAB_20: Lab = {
  id: mkLabId('lab20'),
  number: 20,
  title: 'Identity Threat Detection (ITDR)',
  brief:
    'Three accounts show overnight sign-in alerts: Dan Rivera, Greta Olsen, and Finn Müller. Two are false positives with a mundane explanation. One is real — find which, rule out the other two on the record, and contain it.',
  durationMinutes: 45,
  zoneIds: ['sec-ops', 'iam-ops'],
  startingZone: 'sec-ops',
  startingSeed: 'lab20',
  objectives: [
    {
      id: 'o1',
      description: 'Triage all three overnight sign-in alerts',
      points: 20,
      category: 'exec',
    },
    {
      id: 'o2',
      description: "Rule out Dan Rivera's alert with a documented reason",
      points: 15,
      category: 'troubleshoot',
    },
    {
      id: 'o3',
      description: "Rule out Greta Olsen's alert with a documented reason",
      points: 15,
      category: 'troubleshoot',
    },
    {
      id: 'o4',
      description: "Identify Finn Müller's account as the real threat",
      points: 20,
      category: 'troubleshoot',
    },
    {
      id: 'o5',
      description: "Contain: disable Finn's account and revoke the self-granted role",
      points: 20,
      category: 'least-privilege',
    },
    {
      id: 'o6',
      description: 'Revoke sessions and write the incident report',
      points: 10,
      category: 'docs',
    },
  ],
  steps: [
    {
      id: 's1',
      title: 'Triage the overnight alerts',
      brief:
        'Open the SecOps Dashboard. Three accounts show overnight sign-in activity: dan.rivera, greta.olsen, and finn.muller. Review the audit trail for each before deciding anything.',
      validator: { kind: 'evidence-collected', params: { stepId: 's1' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'secOpsDashboard' } }],
      tutorPrompts: [
        'What in a sign-in event distinguishes an anomaly from an ordinary mistake — the failure count, the source, the timing, or the combination?',
      ],
      hintIds: ['lab20.s1.h1'],
      points: { exec: 10, troubleshoot: 10 },
    },
    {
      id: 's2',
      title: 'Rule out Dan Rivera',
      brief:
        "Dan's alert: one failed sign-in, then a success, from his usual location. Confirm there is no follow-on privilege change, and record why this one is not an incident.",
      validator: { kind: 'evidence-collected', params: { stepId: 's2' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } }],
      tutorPrompts: [
        'One failed sign-in from a normal location — what would have to be true for you to escalate this instead of closing it?',
      ],
      hintIds: ['lab20.s2.h1'],
      points: { troubleshoot: 10, comms: 5 },
    },
    {
      id: 's3',
      title: 'Rule out Greta Olsen',
      brief:
        "Greta's alert: a sign-in from a new city, no failed attempts first. She is travelling for a board meeting this week. Confirm there is no follow-on privilege change, and record why this one is not an incident either.",
      validator: { kind: 'evidence-collected', params: { stepId: 's3' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } }],
      tutorPrompts: [
        'A new-location sign-in with no failed attempts and a business reason on file — what makes this different from a real impossible-travel case?',
      ],
      hintIds: ['lab20.s3.h1'],
      points: { troubleshoot: 10, comms: 5 },
    },
    {
      id: 's4',
      title: "Identify Finn Müller's account as the real threat",
      brief:
        "Finn's alert: three failed sign-ins then a success from a foreign address — and immediately after, his account gained standing domain-admin that nobody requested. That combination is the signal the other two alerts didn't have.",
      validator: { kind: 'evidence-collected', params: { stepId: 's4' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } }],
      tutorPrompts: [
        'Finn is on your own team. Does that change how you investigate his account, or how you should?',
        'If the privilege change had not happened, would you still call this an incident on the sign-in pattern alone?',
      ],
      hintIds: ['lab20.s4.h1'],
      points: { troubleshoot: 15, evidence: 5 },
    },
    {
      id: 's5',
      title: 'Contain: revoke the self-granted role',
      brief:
        "Revoke Finn's role-domain-admins grant — the privilege he gained right after the suspicious sign-in.",
      validator: { kind: 'role-revoked', params: { userId: 'finn.muller' } },
      evidence: [{ kind: 'log-excerpt', capture: 'auto', params: { count: 3 } }],
      tutorPrompts: [
        'Why revoke the privilege before disabling the account, rather than the other way around?',
      ],
      hintIds: ['lab20.s5.h1'],
      points: { exec: 10, 'least-privilege': 10 },
    },
    {
      id: 's6',
      title: 'Revoke sessions and write the report',
      brief:
        "Revoke Finn's active sessions, then write the incident report: what happened, why Dan and Greta were correctly ruled out, and what evidence made Finn's case real.",
      validator: { kind: 'session-revoked', params: { userId: 'finn.muller' } },
      evidence: [{ kind: 'log-excerpt', capture: 'auto', params: { count: 5 } }],
      tutorPrompts: [
        'If someone asked why you did not also disable Dan and Greta, what is your answer?',
      ],
      hintIds: ['lab20.s6.h1'],
      points: { exec: 5, docs: 5 },
    },
  ],
  faults: [],
  debriefQuestions: [
    "What made Finn's alert real when Dan's and Greta's, on the sign-in pattern alone, looked similar?",
    'What would it have cost the team if you had disabled all three accounts instead of investigating first?',
    "Finn is a SecOps analyst. What does it mean for a detection process if colleagues' accounts get a lighter review than everyone else's?",
  ],
};
