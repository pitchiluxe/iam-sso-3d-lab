/**
 * labs/lab10.ts — Capstone.
 * Full end-to-end: lifecycle + SSO + MFA + review + incident.
 */
import { mkLabId } from '@/domain';
import type { Lab, UserId } from '@/domain';

export const LAB_10: Lab = {
  id: mkLabId('lab10'),
  number: 10,
  title: 'Enterprise IAM & SSO Capstone',
  brief:
    'Build and operate the full identity environment. Onboard 5, move 2, terminate 1, configure SSO, enforce MFA, conduct access review, resolve an SSO outage and a security incident.',
  durationMinutes: 120,
  zoneIds: ['hr', 'iam-ops', 'sec-ops', 'app-center', 'help-desk'],
  startingZone: 'iam-ops',
  startingSeed: 'lab10',
  objectives: [
    { id: 'o1', description: 'Onboard 5 new employees', points: 15, category: 'exec' },
    { id: 'o2', description: 'Move 2 employees correctly', points: 10, category: 'exec' },
    { id: 'o3', description: 'Terminate 1 employee cleanly', points: 10, category: 'exec' },
    { id: 'o4', description: 'Integrate 2 apps with SSO', points: 10, category: 'exec' },
    { id: 'o5', description: 'Enforce MFA for privileged roles', points: 5, category: 'exec' },
    { id: 'o6', description: 'Conduct Q3 access review', points: 10, category: 'exec' },
    { id: 'o7', description: 'Resolve SSO break/fix', points: 10, category: 'troubleshoot' },
    { id: 'o8', description: 'Resolve identity incident', points: 10, category: 'troubleshoot' },
    { id: 'o9', description: 'Produce final audit report', points: 10, category: 'docs' },
    { id: 'o10', description: 'Collect all evidence', points: 10, category: 'evidence' },
  ],
  steps: [
    {
      id: 's1',
      title: 'Onboard 5 new employees',
      brief:
        'Resolve 5 onboarding tickets from HR. Create each user, assign groups, verify access.',
      validator: { kind: 'evidence-collected', params: { stepId: 's1' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'ticketConsole' } }],
      tutorPrompts: ['What is the fastest way to provision 5 users consistently?'],
      hintIds: ['lab10.s1.h1'],
      points: { exec: 15 },
    },
    {
      id: 's2',
      title: 'Move 2 employees; remove stale access',
      brief:
        'Transfer Jane (Finance→Engineering) and Alex (Finance→HR). Remove their old group memberships.',
      validator: { kind: 'user-moved', params: { userId: 'alex.morgan' } },
      evidence: [{ kind: 'log-excerpt', capture: 'auto', params: { count: 5 } }],
      tutorPrompts: ['What is the minimum set of group changes for each transfer?'],
      hintIds: ['lab10.s2.h1'],
      points: { exec: 10 },
    },
    {
      id: 's3',
      title: 'Terminate Bob Sato',
      brief:
        'Resolve the termination ticket. Disable Bob, revoke sessions, remove all groups. Verify no residual access.',
      validator: { kind: 'signin-succeeded', params: { userId: 'bob.sato' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } }],
      tutorPrompts: ['Prove Bob cannot reach any application after termination.'],
      hintIds: ['lab10.s3.h1'],
      points: { exec: 10 },
    },
    {
      id: 's4',
      title: 'Integrate Finance Portal (SAML) and Help Desk (OIDC)',
      brief: 'Configure both portals with SSO. Test sign-in for 2 users.',
      validator: { kind: 'app-config-fixed', params: { appId: 'app-finance' } },
      evidence: [{ kind: 'log-excerpt', capture: 'auto', params: { count: 5 } }],
      tutorPrompts: [
        'Explain the difference between SAML and OIDC to a non-technical stakeholder.',
      ],
      hintIds: ['lab10.s4.h1'],
      points: { exec: 10 },
    },
    {
      id: 's5',
      title: 'Enforce MFA for privileged roles',
      brief: 'Enable MFA for role-iam-admins and role-domain-admins. Enroll Erin.',
      validator: { kind: 'mfa-challenge-completed', params: { userId: 'erin.cho' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } }],
      tutorPrompts: ['Where does MFA enforcement happen — IdP, app, or network?'],
      hintIds: ['lab10.s5.h1'],
      points: { exec: 5 },
    },
    {
      id: 's6',
      title: 'Conduct Q3 access review',
      brief: 'Open the Q3-2026 review. Record decisions for all pending items. Close the campaign.',
      validator: { kind: 'review-decisions-recorded', params: {} },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'secOpsDashboard' } }],
      tutorPrompts: ['What would you automate to make this review faster next quarter?'],
      hintIds: ['lab10.s6.h1'],
      points: { exec: 10 },
    },
    {
      id: 's7',
      title: 'Resolve SSO break/fix',
      brief: 'An SSO fault has been injected. Triage, diagnose via logs, and fix.',
      validator: { kind: 'app-config-fixed', params: { appId: 'app-finance' } },
      evidence: [{ kind: 'config-diff', capture: 'auto', params: { appId: 'app-finance' } }],
      tutorPrompts: ['What runbook would prevent this fault?'],
      hintIds: ['lab10.s7.h1'],
      points: { troubleshoot: 10 },
    },
    {
      id: 's8',
      title: 'Resolve identity security incident',
      brief:
        'An incident ticket is open. Contain the affected account, search for related activity, write the report.',
      validator: { kind: 'user-disabled', params: { userId: 'jane.doe' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'secOpsDashboard' } }],
      tutorPrompts: ['What is your escalation path for a critical identity incident?'],
      hintIds: ['lab10.s8.h1'],
      points: { troubleshoot: 10 },
    },
    {
      id: 's9',
      title: 'Produce final audit report',
      brief:
        'Compile the final audit report: architecture diagram, IAM procedures, SSO config record, access matrix, lifecycle records, incident report, change log.',
      validator: { kind: 'evidence-collected', params: { stepId: 's9' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'secOpsDashboard' } }],
      tutorPrompts: [
        'If you had 30 seconds to explain your IAM architecture to a CISO, what would you say?',
      ],
      hintIds: ['lab10.s9.h1'],
      points: { docs: 10, evidence: 10 },
    },
  ],
  faults: [
    {
      id: 'f1',
      kind: 'excessive-permissions',
      applyAtStep: 's1',
      params: {},
      targetUserId: 'bob.sato' as UserId,
    },
    {
      id: 'f2',
      kind: 'suspicious-signin',
      applyAtStep: 's8',
      params: {},
      targetUserId: 'jane.doe' as UserId,
    },
  ],
  debriefQuestions: [
    'Explain authentication vs authorization.',
    'Walk through the Joiner/Mover/Leaver lifecycle.',
    'Describe the trust boundary in SAML.',
    'How would you troubleshoot an SSO outage at 2 AM?',
    'What would you change about this environment if you had another week?',
  ],
};
