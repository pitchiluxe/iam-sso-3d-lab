/**
 * labs/lab24.ts — SaaS License Reclamation & Entitlement Governance.
 *
 * Group-based licensing means group membership IS the billing signal —
 * every validator here (group-removed, evidence-collected) already exists.
 * The two seeded defects are two different failure modes finance actually
 * hits: a disabled account whose license never got reclaimed, and an
 * active account whose license is simply going unused.
 */
import { mkLabId } from '@/domain';
import type { Lab } from '@/domain';

export const LAB_24: Lab = {
  id: mkLabId('lab24'),
  number: 24,
  title: 'SaaS License Reclamation & Entitlement Governance',
  brief:
    "Finance wants to know why the VPN client and analytics tool license counts don't match headcount. Find out, reclaim what's owed, and report the number.",
  durationMinutes: 40,
  zoneIds: ['iam-ops', 'finance'],
  startingZone: 'iam-ops',
  startingSeed: 'lab24',
  objectives: [
    {
      id: 'o1',
      description: 'Audit both license groups against actual account status',
      points: 20,
      category: 'troubleshoot',
    },
    {
      id: 'o2',
      description: "Reclaim the VPN license from a departed employee's account",
      points: 20,
      category: 'least-privilege',
    },
    {
      id: 'o3',
      description: 'Reclaim the analytics license from a dormant seat',
      points: 20,
      category: 'least-privilege',
    },
    {
      id: 'o4',
      description: 'Report the reclaimed seat count to Finance',
      points: 20,
      category: 'comms',
    },
    {
      id: 'o5',
      description: 'Recommend a recurring reconciliation to catch the next one',
      points: 20,
      category: 'docs',
    },
  ],
  steps: [
    {
      id: 's1',
      title: 'Audit the license groups',
      brief:
        'Run Get-ADUser and review grp-vpn-users and grp-analytics-readers membership. Cross-check each member against their account status (enabled/disabled) and last sign-in — a license group has no idea what either one means unless you check.',
      validator: { kind: 'evidence-collected', params: { stepId: 's1' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } }],
      tutorPrompts: [
        "A license group's member count and the number of people actually paying for is not the same fact. What closes that gap?",
      ],
      hintIds: ['lab24.s1.h1'],
      points: { troubleshoot: 20 },
    },
    {
      id: 's2',
      title: "Reclaim Hank's VPN license",
      brief:
        "Hank O'Neill left the company last month and his account is already disabled — but he's still in grp-vpn-users, and the license is still being billed. Remove him from the group.",
      validator: {
        kind: 'group-removed',
        params: { userId: 'hank.oneill', groupId: 'grp-vpn-users' },
      },
      evidence: [{ kind: 'log-excerpt', capture: 'auto', params: { count: 3 } }],
      tutorPrompts: ['Disabling an account stops sign-in. What does it not automatically stop?'],
      hintIds: ['lab24.s2.h1'],
      points: { exec: 10, 'least-privilege': 10 },
    },
    {
      id: 's3',
      title: "Reclaim Cara's analytics license",
      brief:
        "Cara Patel's account is active, but she hasn't signed in to anything for over 90 days. Confirm she's dormant, then remove her from grp-analytics-readers — the seat is going unused, not misused, and it still costs the same either way.",
      validator: {
        kind: 'group-removed',
        params: { userId: 'cara.patel', groupId: 'grp-analytics-readers' },
      },
      evidence: [{ kind: 'log-excerpt', capture: 'auto', params: { count: 3 } }],
      tutorPrompts: [
        'A dormant seat and a departed employee cost the same license fee. Why does one get caught by offboarding and the other does not?',
      ],
      hintIds: ['lab24.s3.h1'],
      points: { troubleshoot: 10, 'least-privilege': 10 },
    },
    {
      id: 's4',
      title: 'Report the reclaimed seats to Finance',
      brief:
        'Write up for Finance: two licenses reclaimed (one VPN, one analytics), who held each, why, and the effective date so the next invoice reflects it.',
      validator: { kind: 'evidence-collected', params: { stepId: 's4' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } }],
      tutorPrompts: [
        'If Finance asked "how do we know this won\'t just happen again next quarter", what would your report need to say?',
      ],
      hintIds: ['lab24.s4.h1'],
      points: { docs: 10, comms: 10 },
    },
    {
      id: 's5',
      title: 'Recommend a recurring reconciliation',
      brief:
        'Document a recurring process: monthly, cross-reference every license group against account status and last-sign-in, before Finance has to ask why the numbers are wrong.',
      validator: { kind: 'evidence-collected', params: { stepId: 's5' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } }],
      tutorPrompts: [
        'Whose job should this recurring check be: IAM, Finance, or the app owner — and why?',
      ],
      hintIds: ['lab24.s5.h1'],
      points: { docs: 20 },
    },
  ],
  faults: [],
  debriefQuestions: [
    'Group-based licensing means the group is the only signal billing sees. What are the two distinct ways that signal goes stale?',
    "Why does offboarding usually catch a departed employee's email but miss their SaaS group memberships?",
    'How would you scale this reconciliation to fifty license groups instead of two, without doing it by hand every time?',
  ],
};
