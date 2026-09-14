/**
 * labs/lab17.ts — Cloud IAM: Cross-Account Role & Least Privilege.
 *
 * A cloud IAM role has two independently-misconfigurable halves —
 * permissions (what it can do) and trust policy (who can become it) — and
 * fixing one proves nothing about the other. This lab treats them as two
 * separate defects with two separate proofs, the same allow/deny pairing
 * lab03 uses for on-prem RBAC.
 */
import { mkLabId } from '@/domain';
import type { Lab } from '@/domain';

export const LAB_17: Lab = {
  id: mkLabId('lab17'),
  number: 17,
  title: 'Cloud IAM — Cross-Account Role & Least Privilege',
  brief:
    'A production cross-account role grants wildcard permissions and trusts nearly every employee to assume it. Scope both halves down to what the data team actually needs, then prove the fix both ways.',
  durationMinutes: 45,
  zoneIds: ['iam-ops', 'sec-ops'],
  startingZone: 'iam-ops',
  startingSeed: 'lab17',
  objectives: [
    {
      id: 'o1',
      description: 'Review the role and identify both defects: permissions and trust',
      points: 10,
      category: 'troubleshoot',
    },
    {
      id: 'o2',
      description: "Scope the role's permissions to remove wildcard access",
      points: 12,
      category: 'exec',
    },
    {
      id: 'o3',
      description: 'Scope the trust policy to the intended data team',
      points: 10,
      category: 'exec',
    },
    {
      id: 'o4',
      description: 'Prove the trusted user can still assume the role',
      points: 8,
      category: 'evidence',
    },
    {
      id: 'o5',
      description: 'Prove a previously-trusted, now-excluded user is denied',
      points: 10,
      category: 'least-privilege',
    },
    {
      id: 'o6',
      description: 'Document the least-privilege cloud IAM policy',
      points: 8,
      category: 'docs',
    },
  ],
  steps: [
    {
      id: 's1',
      title: 'Review the role',
      brief:
        'Open Cloud IAM Roles. prod-data-readonly grants s3:*, ec2:*, and iam:PassRole, and trusts nearly every employee in the company. Identify both problems — the permissions are far broader than "read-only" implies, and the trust policy names people who have nothing to do with the data team.',
      validator: { kind: 'evidence-collected', params: { stepId: 's1' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } }],
      tutorPrompts: [
        'The role is named "readonly" — does its permission list actually match that name?',
        "Fixing the permissions and fixing the trust policy are two different changes. Why can't one fix cover both?",
      ],
      hintIds: ['lab17.s1.h1'],
      points: { troubleshoot: 10 },
    },
    {
      id: 's2',
      title: "Scope the role's permissions",
      brief:
        'Replace the wildcard permissions with what a read-only data role actually needs: s3:GetObject and s3:ListBucket. Drop ec2:* and iam:PassRole entirely — this role has no business touching compute or passing other roles.',
      validator: { kind: 'cloud-role-least-privilege', params: { roleName: 'prod-data-readonly' } },
      evidence: [{ kind: 'log-excerpt', capture: 'auto', params: { count: 3 } }],
      tutorPrompts: [
        'What would iam:PassRole on a "read-only" role let someone do that has nothing to do with reading data?',
      ],
      hintIds: ['lab17.s2.h1'],
      points: { exec: 12 },
    },
    {
      id: 's3',
      title: 'Scope the trust policy',
      brief:
        'Replace the trust policy so only Ivy Park and Dan Rivera — the actual data team — can assume this role.',
      validator: {
        kind: 'cloud-role-trust-scoped',
        params: { roleName: 'prod-data-readonly', maxTrusted: 2, mustIncludeUserId: 'ivy.park' },
      },
      evidence: [{ kind: 'log-excerpt', capture: 'auto', params: { count: 3 } }],
      tutorPrompts: [
        'If nine people were trusted and the role touches production data, what is the realistic blast radius of one compromised laptop?',
      ],
      hintIds: ['lab17.s3.h1'],
      points: { exec: 10 },
    },
    {
      id: 's4',
      title: 'Prove the trusted user can still assume the role',
      brief: 'Attempt to assume prod-data-readonly as Ivy Park. It must still succeed.',
      validator: { kind: 'cloud-role-assumed', params: { userId: 'ivy.park' } },
      evidence: [{ kind: 'log-excerpt', capture: 'auto', params: { count: 3 } }],
      tutorPrompts: [
        'Why test the allow case at all, if you already know Ivy is on the trust list you just wrote?',
      ],
      hintIds: ['lab17.s4.h1'],
      points: { evidence: 8 },
    },
    {
      id: 's5',
      title: 'Prove the excluded user is denied',
      brief:
        'Bob Sato was trusted under the old, over-broad policy. Attempt to assume the role as Bob — it must now be denied.',
      validator: { kind: 'cloud-role-assume-denied', params: { userId: 'bob.sato' } },
      evidence: [{ kind: 'log-excerpt', capture: 'auto', params: { count: 3 } }],
      tutorPrompts: [
        'If you only tested the allow case, would you actually know the trust policy was scoped correctly?',
      ],
      hintIds: ['lab17.s5.h1'],
      points: { 'least-privilege': 10 },
    },
    {
      id: 's6',
      title: 'Document the least-privilege cloud IAM policy',
      brief:
        "Write up: the role's original overprivilege (permissions and trust), what it was scoped down to, and the allow/deny proof.",
      validator: { kind: 'evidence-collected', params: { stepId: 's6' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } }],
      tutorPrompts: [
        'If a new hire joined the data team next month, what would this document need to tell them to do?',
      ],
      hintIds: ['lab17.s6.h1'],
      points: { docs: 8 },
    },
  ],
  faults: [],
  debriefQuestions: [
    'Why does a cloud IAM role need two separate proofs — one for permissions, one for trust — instead of one "it works now" check?',
    'What is the cloud-IAM equivalent of a direct role grant bypassing a group, from lab03?',
    'How would you find every over-trusted role like this one across an entire AWS account, not just this one?',
  ],
};
