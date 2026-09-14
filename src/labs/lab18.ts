/**
 * labs/lab18.ts — Non-Human Identity & Service Account Governance.
 *
 * Northwind runs three service accounts and nobody audits them the way a
 * person's account gets audited: svc-backup carries a standing admin grant
 * from an old migration, svc-idp-sync has never once rotated its credential,
 * and svc-monitor's sign-in history has a pattern that would be an obvious
 * red flag on a human account. Nothing in this codebase gated non-human
 * identity before this lab — every validator and fault it uses (role-revoked,
 * password-reset, session-revoked, excessive-permissions, suspicious-signin)
 * already exists; a service account is just a User record with mfa: 'none'.
 */
import { mkLabId } from '@/domain';
import type { Lab, UserId } from '@/domain';

export const LAB_18: Lab = {
  id: mkLabId('lab18'),
  number: 18,
  title: 'Non-Human Identity & Service Account Governance',
  brief:
    'Audit the three service accounts. svc-backup carries a standing domain-admin grant from an old migration project, svc-idp-sync has never rotated its credential, and svc-monitor just produced a sign-in pattern no automated job should produce. Fix all three.',
  durationMinutes: 40,
  zoneIds: ['iam-ops', 'sec-ops'],
  startingZone: 'iam-ops',
  startingSeed: 'lab18',
  objectives: [
    {
      id: 'o1',
      description: 'Inventory all three service accounts and their standing privileges',
      points: 15,
      category: 'exec',
    },
    {
      id: 'o2',
      description: "Remove svc-backup's excessive domain-admin membership",
      points: 20,
      category: 'least-privilege',
    },
    {
      id: 'o3',
      description: "Rotate svc-idp-sync's stale credential",
      points: 15,
      category: 'exec',
    },
    {
      id: 'o4',
      description: 'Detect the anomalous sign-in on svc-monitor',
      points: 20,
      category: 'troubleshoot',
    },
    {
      id: 'o5',
      description: "Contain and rotate svc-monitor's credential",
      points: 20,
      category: 'exec',
    },
    {
      id: 'o6',
      description: 'Document the non-human-identity governance policy',
      points: 10,
      category: 'docs',
    },
  ],
  steps: [
    {
      id: 's1',
      title: 'Inventory the service accounts',
      brief:
        'Northwind runs three service accounts: svc-backup, svc-monitor, and svc-idp-sync. Review each one in the IAM Console — group memberships, last sign-in, sign-in source — before touching anything.',
      validator: { kind: 'evidence-collected', params: { stepId: 's1' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } }],
      tutorPrompts: [
        "What is different about auditing a service account versus a person's account — who notices when something looks wrong?",
        'None of these three accounts should ever produce an interactive sign-in. Which audit fields would tell you if one just did?',
      ],
      hintIds: ['lab18.s1.h1'],
      points: { exec: 10, troubleshoot: 5 },
    },
    {
      id: 's2',
      title: "Remove svc-backup's standing domain-admin",
      brief:
        'svc-backup was granted domain-admin during a server migration eighteen months ago and it was never revoked. The nightly backup job only needs read access to file shares — remove the excess privilege and record why.',
      validator: { kind: 'role-revoked', params: { userId: 'svc-backup' } },
      evidence: [{ kind: 'log-excerpt', capture: 'auto', params: { count: 3 } }],
      tutorPrompts: [
        "A backup job needs to read data, not administer the domain. What's the blast radius if this credential leaks?",
      ],
      hintIds: ['lab18.s2.h1'],
      points: { 'least-privilege': 20, docs: 5 },
    },
    {
      id: 's3',
      title: "Rotate svc-idp-sync's credential",
      brief:
        "svc-idp-sync's credential has never been rotated since the account was created — the sync connector has run on the same secret its entire existence. Rotate it.",
      validator: { kind: 'password-reset', params: { userId: 'svc-idp-sync' } },
      evidence: [{ kind: 'log-excerpt', capture: 'auto', params: { count: 3 } }],
      tutorPrompts: [
        'Why does an unrotated service-account credential matter more than an unrotated human password?',
        "What breaks if you rotate this credential without updating the sync connector's stored copy?",
      ],
      hintIds: ['lab18.s3.h1'],
      points: { exec: 15 },
    },
    {
      id: 's4',
      title: 'Find the anomalous sign-in on svc-monitor',
      brief:
        "svc-monitor should only ever authenticate from the monitoring job's own schedule. Check its sign-in history for anything that doesn't fit that pattern.",
      validator: { kind: 'evidence-collected', params: { stepId: 's4' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } }],
      tutorPrompts: [
        "What in the audit trail — the source, the timing, the failed attempts before the success — tells you this wasn't the monitoring job?",
        "If a person's account showed this pattern, you'd call it a credential-stuffing attempt. Does that change because the account belongs to a service, not a person?",
      ],
      hintIds: ['lab18.s4.h1'],
      points: { troubleshoot: 15, evidence: 5 },
    },
    {
      id: 's5',
      title: "Contain: revoke svc-monitor's sessions",
      brief:
        'Treat this like any other suspicious sign-in response. Revoke every active session for svc-monitor.',
      validator: { kind: 'session-revoked', params: { userId: 'svc-monitor' } },
      evidence: [{ kind: 'log-excerpt', capture: 'auto', params: { count: 5 } }],
      tutorPrompts: [
        "Service accounts don't file tickets when something feels wrong — who is supposed to notice this instead?",
      ],
      hintIds: ['lab18.s5.h1'],
      points: { exec: 10, troubleshoot: 5 },
    },
    {
      id: 's6',
      title: "Rotate svc-monitor's credential and document the policy",
      brief:
        "Reset svc-monitor's credential, then write the non-human-identity policy this incident is missing: an inventory of every service account, its owner, a rotation cadence, and who reviews its sign-in activity.",
      validator: { kind: 'password-reset', params: { userId: 'svc-monitor' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } }],
      tutorPrompts: [
        'If this policy had existed before today, would the svc-backup finding or the svc-monitor anomaly have been caught sooner?',
      ],
      hintIds: ['lab18.s6.h1'],
      points: { docs: 10 },
    },
  ],
  faults: [
    {
      id: 'f1',
      kind: 'excessive-permissions',
      applyAtStep: 's1',
      params: {},
      targetUserId: 'svc-backup' as UserId,
    },
    {
      id: 'f2',
      kind: 'suspicious-signin',
      applyAtStep: 's1',
      params: {},
      targetUserId: 'svc-monitor' as UserId,
    },
  ],
  debriefQuestions: [
    'Why do service accounts often get audited less than human accounts, even though they frequently hold more privilege?',
    "svc-backup's excess privilege sat unnoticed for eighteen months. What review cadence would have caught it sooner?",
    "What made svc-monitor's sign-in pattern suspicious, and how would you tell a real anomaly from a monitoring job that just changed its own schedule?",
  ],
};
