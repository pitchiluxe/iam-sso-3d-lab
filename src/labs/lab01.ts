/**
 * labs/lab01.ts — IAM Foundation.
 * Seed: empty (no baseline). Learner creates the directory.
 */
import { mkLabId } from '@/domain';
import type { Lab } from '@/domain';

export const LAB_01: Lab = {
  id: mkLabId('lab01'),
  number: 1,
  title: 'Enterprise IAM Foundation',
  brief: 'Establish the identity foundation: directory, OUs, users, groups, and baseline policy.',
  durationMinutes: 60,
  zoneIds: ['iam-ops', 'server-room'],
  startingZone: 'iam-ops',
  startingSeed: 'lab01',
  objectives: [
    { id: 'o1', description: 'Create 5 security groups', points: 5, category: 'exec' },
    { id: 'o2', description: 'Create 5 baseline users', points: 5, category: 'exec' },
    { id: 'o3', description: 'Configure IdP realm', points: 5, category: 'exec' },
    { id: 'o4', description: 'Apply baseline password policy', points: 5, category: 'exec' },
    { id: 'o5', description: 'Verify user can authenticate', points: 5, category: 'exec' },
    { id: 'o6', description: 'Troubleshoot an auth failure', points: 5, category: 'troubleshoot' },
    { id: 'o7', description: 'Document the authorization model', points: 10, category: 'docs' },
    { id: 'o8', description: 'Collect evidence snapshots', points: 5, category: 'evidence' },
    { id: 'o9', description: 'Use least-privilege naming', points: 5, category: 'least-privilege' },
  ],
  steps: [
    {
      id: 's1',
      title: 'Create the directory structure',
      brief:
        'Create 5 OUs (Users, Groups, Computers, Servers, ServiceAccounts) and 5 security groups (grp-hr-readers, grp-finance-payroll, grp-engineering-dev, grp-helpdesk-tier1, grp-iam-admins).',
      validator: { kind: 'group-created', params: { groupId: 'grp-iam-admins' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } }],
      tutorPrompts: [
        'What is the first artifact you would create in a new directory, and why?',
        'Which service provides naming authority for everything else you will build?',
      ],
      hintIds: ['lab01.s1.h1', 'lab01.s1.h2'],
      points: { exec: 5, troubleshoot: 2, docs: 3 },
    },
    {
      id: 's2',
      title: 'Create baseline users',
      brief:
        'Create 5 test users (Alex Morgan, Bob Sato, Cara Patel, Dan Rivera, Erin Cho). Assign each to their department group. Leave MFA disabled for now.',
      validator: { kind: 'user-created', params: { userId: 'alex.morgan' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } }],
      tutorPrompts: [
        'How will you prove the user was actually created, not just added to a spreadsheet?',
      ],
      hintIds: ['lab01.s2.h1'],
      points: { exec: 5, evidence: 3 },
    },
    {
      id: 's3',
      title: 'Configure the IdP realm',
      brief:
        'Configure the IdP realm "northwind" with default settings. Create the admin user and set the admin password.',
      validator: { kind: 'user-created', params: { userId: 'admin' } },
      evidence: [{ kind: 'log-excerpt', capture: 'auto', params: { count: 10 } }],
      tutorPrompts: ['What does the IdP provide that a flat user list cannot?'],
      hintIds: ['lab01.s3.h1'],
      points: { exec: 5, troubleshoot: 3 },
    },
    {
      id: 's4',
      title: 'Apply baseline Group Policy',
      brief:
        'Set a minimum password length of 12 characters and require MFA for all privileged role holders.',
      validator: { kind: 'mfa-policy-enforced', params: {} },
      evidence: [{ kind: 'config-diff', capture: 'auto', params: { appId: 'app-admin-console' } }],
      tutorPrompts: ['What is the security implication of a 6-character password?'],
      hintIds: ['lab01.s4.h1'],
      points: { exec: 5, 'least-privilege': 5 },
    },
    {
      id: 's5',
      title: 'Verify authentication',
      brief:
        'Sign in as admin and capture the resulting session in the audit log. Take a screenshot of the session details.',
      validator: { kind: 'signin-succeeded', params: { userId: 'admin' } },
      evidence: [
        { kind: 'log-excerpt', capture: 'auto', params: { count: 5 } },
        { kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } },
      ],
      tutorPrompts: [
        'How will you prove the user actually authenticated and is not just a record in a list?',
      ],
      hintIds: ['lab01.s5.h1'],
      points: { exec: 5, evidence: 5, docs: 5 },
    },
  ],
  faults: [],
  debriefQuestions: [
    'Why is naming consistency a security control, not just an aesthetic choice?',
    'What would you check first if a user reports they cannot authenticate?',
  ],
};
