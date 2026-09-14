/**
 * labs/lab14.ts — OAuth App Governance & Consent Phishing.
 *
 * Nothing in this codebase gated a third-party OAuth app's delegated-access
 * grant before this lab: no capability, no console section, no validator.
 * A consent-phishing attack doesn't steal a password — the user authenticates
 * as themselves and clicks "Accept" on a scope list they didn't read. This
 * lab is that response: detect the grant, sweep for other victims, revoke
 * both, and block the app so a third click can't happen.
 */
import { mkLabId } from '@/domain';
import type { Lab } from '@/domain';

export const LAB_14: Lab = {
  id: mkLabId('lab14'),
  number: 14,
  title: 'OAuth App Governance & Consent Phishing',
  brief:
    'Dan Rivera granted a third-party app broad mailbox and file access twenty minutes ago. Detect it, find who else fell for the same campaign, revoke both grants, and block the app.',
  durationMinutes: 40,
  zoneIds: ['iam-ops', 'sec-ops'],
  startingZone: 'iam-ops',
  startingSeed: 'lab14',
  objectives: [
    {
      id: 'o1',
      description: 'Identify the suspicious OAuth grant among the legitimate ones',
      points: 12,
      category: 'troubleshoot',
    },
    {
      id: 'o2',
      description: "Revoke the malicious app's grant for the first victim",
      points: 12,
      category: 'exec',
    },
    {
      id: 'o3',
      description: 'Sweep for other users who granted the same app',
      points: 10,
      category: 'troubleshoot',
    },
    {
      id: 'o4',
      description: 'Revoke the grant for the second victim',
      points: 8,
      category: 'exec',
    },
    {
      id: 'o5',
      description: 'Block the app tenant-wide',
      points: 8,
      category: 'least-privilege',
    },
    {
      id: 'o6',
      description: 'Document the incident and notify affected users',
      points: 10,
      category: 'comms',
    },
  ],
  steps: [
    {
      id: 's1',
      title: 'Identify the suspicious grant',
      brief:
        'Open OAuth Consent Grants in the IAM Console. Several apps are listed. One requests broad, unrelated scopes (Mail.Read, Files.ReadWrite.All, Contacts.Read) from an unverified publisher, granted only 20 minutes ago — find it.',
      validator: { kind: 'evidence-collected', params: { stepId: 's1' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } }],
      tutorPrompts: [
        'TeamSync Meetings is also a third-party app on this list — why is it not suspicious the same way?',
        'What made this grant worth a second look: the scopes, the publisher, the timing, or all three?',
      ],
      hintIds: ['lab14.s1.h1'],
      points: { troubleshoot: 12 },
    },
    {
      id: 's2',
      title: "Revoke the app's access for Dan",
      brief: "Revoke Dan Rivera's grant to QuickSign Docs (client ID oauth-quicksign-docs).",
      validator: {
        kind: 'oauth-grant-revoked',
        params: { userId: 'dan.rivera', clientId: 'oauth-quicksign-docs' },
      },
      evidence: [{ kind: 'log-excerpt', capture: 'auto', params: { count: 3 } }],
      tutorPrompts: [
        'Revoking the grant stops future access — does it undo anything the app already read or wrote?',
      ],
      hintIds: ['lab14.s2.h1'],
      points: { exec: 12 },
    },
    {
      id: 's3',
      title: 'Sweep for other victims',
      brief:
        'A consent-phishing email rarely goes to one person. Search OAuth Consent Grants for any other user with an active grant to client ID oauth-quicksign-docs.',
      validator: { kind: 'evidence-collected', params: { stepId: 's3' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } }],
      tutorPrompts: [
        'If you stopped after fixing Dan, what would you be assuming about how the phishing email was sent?',
      ],
      hintIds: ['lab14.s3.h1'],
      points: { troubleshoot: 10 },
    },
    {
      id: 's4',
      title: 'Revoke the second victim’s grant',
      brief: "Revoke Erin Cho's grant to the same app.",
      validator: {
        kind: 'oauth-grant-revoked',
        params: { userId: 'erin.cho', clientId: 'oauth-quicksign-docs' },
      },
      evidence: [{ kind: 'log-excerpt', capture: 'auto', params: { count: 3 } }],
      tutorPrompts: ['Why sweep before revoking, instead of revoking Dan and calling it resolved?'],
      hintIds: ['lab14.s4.h1'],
      points: { exec: 8 },
    },
    {
      id: 's5',
      title: 'Block the app tenant-wide',
      brief:
        'Revoking existing grants does not stop a third user from clicking "Accept" tomorrow. Block oauth-quicksign-docs so it cannot be consented to again.',
      validator: { kind: 'oauth-app-blocked', params: { clientId: 'oauth-quicksign-docs' } },
      evidence: [{ kind: 'log-excerpt', capture: 'auto', params: { count: 3 } }],
      tutorPrompts: [
        'What is the difference between revoking a grant and blocking an app — why do you need both?',
      ],
      hintIds: ['lab14.s5.h1'],
      points: { 'least-privilege': 8 },
    },
    {
      id: 's6',
      title: 'Document and notify',
      brief:
        'Write up the incident: which app, which scopes, which users, when granted, when revoked. Note who should be notified (Dan and Erin, plus a recommendation to require admin approval for future third-party app consent).',
      validator: { kind: 'evidence-collected', params: { stepId: 's6' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } }],
      tutorPrompts: [
        'If admin-consent-required had already been policy, would this incident have happened at all?',
      ],
      hintIds: ['lab14.s6.h1'],
      points: { comms: 10 },
    },
  ],
  faults: [],
  debriefQuestions: [
    'What made the malicious grant identifiable among the legitimate ones — was it any single signal, or the combination?',
    'Why does a consent-phishing response need both a revoke action and a block action?',
    'What organizational policy would prevent this class of incident instead of just responding to it?',
  ],
};
