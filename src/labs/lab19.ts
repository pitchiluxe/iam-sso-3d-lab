/**
 * labs/lab19.ts — SCIM Provisioning at Scale.
 *
 * Automation fails at scale in three specific, recurring ways: a batch job
 * that just needs to be run correctly, a soft-match collision between an
 * incoming record and an unrelated existing one, and a deprovisioning event
 * that silently never fired. All three validators and the fault this lab
 * uses already exist — the bulk-onboarding PowerShell template (used by the
 * generated daily-ticket labs), 'user-created', and 'sync-soft-match-conflict'
 * (first used by lab12). This is the first fixed, numbered lab to put the
 * bulk-provisioning mechanic in a single story rather than an endless drill.
 */
import { mkLabId } from '@/domain';
import type { Lab, UserId } from '@/domain';

export const LAB_19: Lab = {
  id: mkLabId('lab19'),
  number: 19,
  title: 'SCIM Provisioning at Scale',
  brief:
    "This quarter's HR feed: provision five new analytics hires, catch a name collision with an unrelated former contractor before it becomes one merged record, and find the termination the deprovisioning feed silently dropped.",
  durationMinutes: 45,
  zoneIds: ['iam-ops', 'help-desk'],
  startingZone: 'iam-ops',
  startingSeed: 'lab19',
  objectives: [
    {
      id: 'o1',
      description: 'Provision the 5-person Q3 analytics batch via the bulk-onboarding script',
      points: 20,
      category: 'exec',
    },
    {
      id: 'o2',
      description: 'Resolve the sam.oduya soft-match without touching the existing record',
      points: 20,
      category: 'troubleshoot',
    },
    {
      id: 'o3',
      description: "Detect that Priya Fernandes's termination never actually deprovisioned",
      points: 15,
      category: 'troubleshoot',
    },
    {
      id: 'o4',
      description: "Disable Priya's account and remove her group memberships",
      points: 20,
      category: 'least-privilege',
    },
    {
      id: 'o5',
      description: "Revoke Priya's live session",
      points: 10,
      category: 'exec',
    },
    {
      id: 'o6',
      description: 'Document the SCIM failure and the audit that should catch the next one',
      points: 15,
      category: 'docs',
    },
  ],
  steps: [
    {
      id: 's1',
      title: 'Run the Q3 analytics bulk-onboarding batch',
      brief:
        'HR\'s SCIM feed lists five new analytics-team starters: nina.volkov, theo.marsh, yuki.abe, devon.clarke, ines.rocha. Open PowerShell, load "Bulk onboarding — new hires", put these five usernames in $names, set the group to grp-analytics-readers, and run it.',
      validator: {
        kind: 'users-provisioned',
        params: { groupId: 'grp-analytics-readers', count: 5 },
      },
      evidence: [{ kind: 'log-excerpt', capture: 'auto', params: { count: 5 } }],
      tutorPrompts: [
        'What is the fastest way to provision five accounts identically, without five separate chances to mistype a field?',
      ],
      hintIds: ['lab19.s1.h1'],
      points: { exec: 20 },
    },
    {
      id: 's2',
      title: 'Resolve the sam.oduya soft-match',
      brief:
        'The feed also lists sam.oduya. Northwind already has a sam.oduya on file — a contractor whose engagement ended eighteen months ago. Check whether this is the same person before creating anything. It is not: provision the new hire as sam.oduya2 and leave the existing dormant record untouched.',
      validator: { kind: 'user-created', params: { userId: 'sam.oduya2' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } }],
      tutorPrompts: [
        'Lab 12 taught you to join a genuine same-person soft-match instead of deleting one side. What tells you this case is different?',
        'If you had merged these two records, what would the new hire have inherited from an eighteen-month-old contractor engagement?',
      ],
      hintIds: ['lab19.s2.h1'],
      points: { troubleshoot: 15, 'least-privilege': 5 },
    },
    {
      id: 's3',
      title: 'Find the termination that never took effect',
      brief:
        'HR says Priya Fernandes left the company six weeks ago. Check her account status in the IAM Console — the deprovisioning side of the SCIM feed does not always run just because the joiner side does.',
      validator: { kind: 'evidence-collected', params: { stepId: 's3' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } }],
      tutorPrompts: [
        'A joiner feed and a leaver feed are two different automated jobs. Why would one silently fail while the other keeps working?',
      ],
      hintIds: ['lab19.s3.h1'],
      points: { troubleshoot: 15 },
    },
    {
      id: 's4',
      title: "Disable Priya's account",
      brief:
        "Disable Priya Fernandes's account and remove her from grp-engineering-dev. She left six weeks ago — every day since then was excess access nobody knew about.",
      validator: { kind: 'user-disabled', params: { userId: 'priya.fernandes' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } }],
      tutorPrompts: [
        'Six weeks of access nobody tracked — what would you check to find out whether any of it was actually used?',
      ],
      hintIds: ['lab19.s4.h1'],
      points: { 'least-privilege': 20 },
    },
    {
      id: 's5',
      title: "Revoke Priya's live session",
      brief:
        'Disabling the account does not end a session that is already open. Revoke every active session for priya.fernandes.',
      validator: { kind: 'session-revoked', params: { userId: 'priya.fernandes' } },
      evidence: [{ kind: 'log-excerpt', capture: 'auto', params: { count: 5 } }],
      tutorPrompts: [
        'A termination feed that only disables the account and never checks for a live session — what does that miss?',
      ],
      hintIds: ['lab19.s5.h1'],
      points: { exec: 10 },
    },
    {
      id: 's6',
      title: 'Document the SCIM failure and the catch',
      brief:
        'Write up what happened: the deprovisioning event that never fired, how you found it, and a periodic audit (stale-account review comparing HR termination dates against directory status) that would catch the next silent failure without waiting six weeks.',
      validator: { kind: 'evidence-collected', params: { stepId: 's6' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } }],
      tutorPrompts: [
        'If this audit had run weekly, how many days of excess access would Priya have actually had?',
      ],
      hintIds: ['lab19.s6.h1'],
      points: { docs: 15 },
    },
  ],
  faults: [
    {
      id: 'f1',
      kind: 'sync-soft-match-conflict',
      applyAtStep: 's2',
      params: {},
      targetUserId: 'sam.oduya' as UserId,
    },
  ],
  debriefQuestions: [
    'A joiner feed and a leaver feed are two different jobs. Why would one keep working while the other silently fails?',
    'What would have caught this sooner: better connector monitoring, or a periodic audit that does not depend on the connector at all?',
    'Lab 12 taught "join, don\'t delete" for a genuine soft-match. This lab taught the opposite call. What is the actual test that tells the two cases apart?',
  ],
};
