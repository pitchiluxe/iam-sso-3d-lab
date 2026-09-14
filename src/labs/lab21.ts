/**
 * labs/lab21.ts — B2B Guest Access & External Collaboration.
 *
 * Northwind has never had an external identity before this lab. A guest is
 * modeled as a User whose department and title carry the facts a real
 * directory would put in dedicated fields (sponsor, company, access window)
 * — Get-ADUser's Title column (added for this lab) is where that becomes
 * visible, the same way lab19 and lab20 read backstory off existing fields
 * rather than inventing a new type for a fact that appears in exactly one
 * or two labs.
 */
import { mkLabId } from '@/domain';
import type { Lab } from '@/domain';

export const LAB_21: Lab = {
  id: mkLabId('lab21'),
  number: 21,
  title: 'B2B Guest Access & External Collaboration',
  brief:
    'Fabrikam Analytics is sending a contractor to review shared data for two weeks. Provision him narrowly and on the record. Then find the guest account from a previous engagement that outlived its access window by four months.',
  durationMinutes: 40,
  zoneIds: ['iam-ops', 'help-desk'],
  startingZone: 'iam-ops',
  startingSeed: 'lab21',
  objectives: [
    {
      id: 'o1',
      description: 'Provision the Fabrikam contractor with sponsor and access window on record',
      points: 20,
      category: 'exec',
    },
    {
      id: 'o2',
      description: 'Grant only the narrow access the engagement actually needs',
      points: 20,
      category: 'least-privilege',
    },
    {
      id: 'o3',
      description: 'Find the guest account whose access window expired unnoticed',
      points: 20,
      category: 'troubleshoot',
    },
    {
      id: 'o4',
      description: 'Disable the expired guest account',
      points: 20,
      category: 'least-privilege',
    },
    {
      id: 'o5',
      description: "Revoke the expired guest's live session",
      points: 10,
      category: 'exec',
    },
    {
      id: 'o6',
      description: 'Document the guest-access policy: sponsor, expiry, and periodic review',
      points: 10,
      category: 'docs',
    },
  ],
  steps: [
    {
      id: 's1',
      title: 'Provision the Fabrikam Analytics contractor',
      brief:
        'Marcus Webb, a contractor from Fabrikam Analytics, needs two weeks of access to review shared data. Provision marcus.webb with department "External — Fabrikam Analytics" and a title recording the sponsor (Ivy Park) and the access window (14 days) — the same way this directory records everything else it doesn\'t have a dedicated field for.',
      validator: { kind: 'user-created', params: { userId: 'marcus.webb' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } }],
      tutorPrompts: [
        'A guest account with no sponsor and no end date on record — who is accountable for it six months from now?',
      ],
      hintIds: ['lab21.s1.h1'],
      points: { exec: 20 },
    },
    {
      id: 's2',
      title: 'Grant only what the engagement needs',
      brief:
        'Add marcus.webb to grp-analytics-readers only. He is reviewing data, not administering anything — do not add him anywhere else.',
      validator: {
        kind: 'group-added',
        params: { userId: 'marcus.webb', groupId: 'grp-analytics-readers' },
      },
      evidence: [{ kind: 'log-excerpt', capture: 'auto', params: { count: 3 } }],
      tutorPrompts: [
        'An external contractor with the same access as a full-time employee — what makes that riskier than the same mistake for an internal hire?',
      ],
      hintIds: ['lab21.s2.h1'],
      points: { exec: 10, 'least-privilege': 10 },
    },
    {
      id: 's3',
      title: 'Find the guest account past its access window',
      brief:
        'Run Get-ADUser and look at the Title column for every external account. One of them — a Fabrikam Analytics guest from an earlier engagement — is still active well past when her access should have ended.',
      validator: { kind: 'evidence-collected', params: { stepId: 's3' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } }],
      tutorPrompts: ['Nothing technical enforces a guest access window by itself. What does?'],
      hintIds: ['lab21.s3.h1'],
      points: { troubleshoot: 20 },
    },
    {
      id: 's4',
      title: 'Disable the expired guest account',
      brief:
        "Disable layla.haddad's account. Her sponsored access window ended four months ago and nobody acted on it.",
      validator: { kind: 'user-disabled', params: { userId: 'layla.haddad' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } }],
      tutorPrompts: [
        'Four months of access past the intended end date — what would you check to see whether any of it was used?',
      ],
      hintIds: ['lab21.s4.h1'],
      points: { 'least-privilege': 20 },
    },
    {
      id: 's5',
      title: "Revoke the expired guest's session",
      brief:
        'Disabling the account does not end a session already open. Revoke every active session for layla.haddad.',
      validator: { kind: 'session-revoked', params: { userId: 'layla.haddad' } },
      evidence: [{ kind: 'log-excerpt', capture: 'auto', params: { count: 5 } }],
      tutorPrompts: [
        'A guest account with no expiry enforcement and no session review — how long could this have run unnoticed if nobody had looked?',
      ],
      hintIds: ['lab21.s5.h1'],
      points: { exec: 10 },
    },
    {
      id: 's6',
      title: 'Document the guest-access policy',
      brief:
        'Write up the policy this incident is missing: every guest gets a named sponsor, a hard access-window end date, and a periodic review comparing guest accounts against their recorded expiry.',
      validator: { kind: 'evidence-collected', params: { stepId: 's6' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } }],
      tutorPrompts: [
        'If this review had run monthly, how many months of unnecessary access would Layla have actually had?',
      ],
      hintIds: ['lab21.s6.h1'],
      points: { docs: 10 },
    },
  ],
  faults: [],
  debriefQuestions: [
    'What makes an external account riskier by default than an internal one with the same permissions?',
    'A sponsor and an expiry date are only useful if something checks them. What would that something be here?',
    "Marcus's engagement is legitimate today. What turns his account into next year's Layla if nobody follows up?",
  ],
};
