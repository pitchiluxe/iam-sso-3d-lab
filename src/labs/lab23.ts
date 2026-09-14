/**
 * labs/lab23.ts — M&A Identity Consolidation.
 *
 * Every validator here already exists — user-created, group-added,
 * user-disabled, evidence-collected — because the hard part of an
 * acquisition's identity work isn't a new mechanic, it's judgment: which
 * username collision is a genuine duplicate (lab12's "join, don't delete")
 * versus two different people who each need their own account (lab19's
 * sam.oduya, and this lab's Alex Morgan), which titles carry over and which
 * don't, and which accounts don't get a place in the new directory no
 * matter how you'd map them.
 */
import { mkLabId } from '@/domain';
import type { Lab } from '@/domain';

export const LAB_23: Lab = {
  id: mkLabId('lab23'),
  number: 23,
  title: 'M&A Identity Consolidation',
  brief:
    'Northwind Labs has acquired Fabrikam Analytics. Migrate three Fabrikam employees into the Northwind directory, resolve a genuine username collision, map access on need rather than on title, and decide what happens to a shared account that never should have made the trip.',
  durationMinutes: 45,
  zoneIds: ['iam-ops', 'help-desk'],
  startingZone: 'iam-ops',
  startingSeed: 'lab23',
  objectives: [
    {
      id: 'o1',
      description: 'Review the Fabrikam migration roster against the existing directory',
      points: 15,
      category: 'troubleshoot',
    },
    {
      id: 'o2',
      description: 'Resolve the alex.morgan username collision as two distinct people',
      points: 20,
      category: 'troubleshoot',
    },
    {
      id: 'o3',
      description: 'Migrate Priya Iyer with role-appropriate access',
      points: 20,
      category: 'exec',
    },
    {
      id: 'o4',
      description: 'Migrate Tom Reeves on need, not on his old title',
      points: 20,
      category: 'least-privilege',
    },
    {
      id: 'o5',
      description: 'Refuse to migrate the shared Fabrikam login',
      points: 15,
      category: 'least-privilege',
    },
    {
      id: 'o6',
      description: 'Document the consolidation decisions',
      points: 10,
      category: 'docs',
    },
  ],
  steps: [
    {
      id: 's1',
      title: 'Review the Fabrikam migration roster',
      brief:
        'Three Fabrikam Analytics employees are being migrated into Northwind: Alex Morgan (Data Analyst), Priya Iyer (Data Analyst), and Tom Reeves (Sales Director). Check each name against the existing directory before creating anything.',
      validator: { kind: 'evidence-collected', params: { stepId: 's1' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } }],
      tutorPrompts: [
        'Two companies of any real size will always share at least one common name. What do you check before assuming a match means the same person?',
      ],
      hintIds: ['lab23.s1.h1'],
      points: { troubleshoot: 15 },
    },
    {
      id: 's2',
      title: 'Resolve the Alex Morgan collision',
      brief:
        "Northwind already has an alex.morgan in Finance. Fabrikam's Alex Morgan is a different person entirely. Provision the Fabrikam hire as alex.morgan2 — do not touch, rename, or merge the existing account.",
      validator: { kind: 'user-created', params: { userId: 'alex.morgan2' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } }],
      tutorPrompts: [
        'Lab 12 taught you to join a genuine same-person soft-match instead of deleting one side. What makes this the opposite call?',
        'What would break for the existing Alex Morgan if you renamed her account to make room for the new hire?',
      ],
      hintIds: ['lab23.s2.h1'],
      points: { exec: 15, troubleshoot: 5 },
    },
    {
      id: 's3',
      title: 'Migrate Priya Iyer',
      brief:
        'Provision priya.iyer and add her to grp-analytics-readers — the same access the data team already has, matching what her Fabrikam role actually did.',
      validator: {
        kind: 'group-added',
        params: { userId: 'priya.iyer', groupId: 'grp-analytics-readers' },
      },
      evidence: [{ kind: 'log-excerpt', capture: 'auto', params: { count: 3 } }],
      tutorPrompts: [
        "Priya's Fabrikam job title doesn't exist at Northwind. What do you map against instead of the title?",
      ],
      hintIds: ['lab23.s3.h1'],
      points: { exec: 15, 'least-privilege': 5 },
    },
    {
      id: 's4',
      title: 'Migrate Tom Reeves on need, not on title',
      brief:
        "Tom's Fabrikam title was Sales Director, but titles don't migrate automatically. Provision tom.reeves and add him to grp-sales-readonly only — the standard starting access for his actual day-to-day work here, not grp-sales-executives.",
      validator: {
        kind: 'group-added',
        params: { userId: 'tom.reeves', groupId: 'grp-sales-readonly' },
      },
      evidence: [{ kind: 'log-excerpt', capture: 'auto', params: { count: 3 } }],
      tutorPrompts: [
        'If you had granted grp-sales-executives on the strength of his old title alone, what would you actually be verifying?',
      ],
      hintIds: ['lab23.s4.h1'],
      points: { exec: 10, 'least-privilege': 10 },
    },
    {
      id: 's5',
      title: 'Refuse to migrate the shared login',
      brief:
        'fabrikam-shared-login was used day-to-day by several different Fabrikam staff — it cannot be attributed to one person. Disable it. A shared account does not get a place in this directory no matter how convenient it was.',
      validator: { kind: 'user-disabled', params: { userId: 'fabrikam-shared-login' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } }],
      tutorPrompts: [
        'If this account had a real, encrypted service purpose instead of being shared by people, would your answer change? What would you check to tell the difference?',
      ],
      hintIds: ['lab23.s5.h1'],
      points: { 'least-privilege': 10, docs: 5 },
    },
    {
      id: 's6',
      title: 'Document the consolidation',
      brief:
        'Write up: the alex.morgan collision and how you told the two people apart, why each migrated employee got the access they got, and why the shared login was refused instead of migrated.',
      validator: { kind: 'evidence-collected', params: { stepId: 's6' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } }],
      tutorPrompts: [
        'Six months from now, a Fabrikam manager asks why their team lost the shared login they always used. Does your document answer that?',
      ],
      hintIds: ['lab23.s6.h1'],
      points: { docs: 10 },
    },
  ],
  faults: [],
  debriefQuestions: [
    'What is the actual test that tells a genuine same-person soft-match (lab12) apart from two different people who happen to share a name (this lab, and lab19)?',
    "Job titles rarely map 1:1 between two companies' org charts. What should access be based on instead?",
    'A shared account is convenient for the people using it and unauditable for everyone else. Why does convenience keep losing this argument, and why does it keep coming up anyway?',
  ],
};
