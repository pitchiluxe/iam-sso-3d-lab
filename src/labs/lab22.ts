/**
 * labs/lab22.ts — Zero Trust: Device Compliance for Privileged Access.
 *
 * Every other conditional-access step in this app (lab05 s4/s5, lab11 s2-s5)
 * is narrative: there was no capability that actually set an enforced
 * policy, and "Verify Authentication" never passed ip/asn/device to
 * MockIdP.signIn to begin with. This lab is built on the real mechanism
 * added alongside it — policy.conditionalAccess.set, an IdPConditionalPolicy
 * that is actually scoped by role (roleId scoping existed on the type but
 * was never checked), and a Verify Authentication form that can simulate a
 * non-compliant device and observe a genuine block, audited as such.
 */
import { mkLabId } from '@/domain';
import type { Lab } from '@/domain';

export const LAB_22: Lab = {
  id: mkLabId('lab22'),
  number: 22,
  title: 'Zero Trust: Device Compliance for Privileged Access',
  brief:
    'Right now, role-iam-admins and role-domain-admins can sign in from any device, managed or not. Require a compliant device for both, then prove the block actually holds and a compliant device still gets through.',
  durationMinutes: 40,
  zoneIds: ['iam-ops', 'sec-ops'],
  startingZone: 'iam-ops',
  startingSeed: 'lab22',
  objectives: [
    {
      id: 'o1',
      description: 'Review current admin sign-in exposure',
      points: 20,
      category: 'troubleshoot',
    },
    {
      id: 'o2',
      description: 'Require a compliant device for role-iam-admins',
      points: 20,
      category: 'exec',
    },
    {
      id: 'o3',
      description: 'Prove a non-compliant device is actually blocked',
      points: 20,
      category: 'troubleshoot',
    },
    {
      id: 'o4',
      description: 'Prove a compliant device still gets through',
      points: 20,
      category: 'least-privilege',
    },
    {
      id: 'o5',
      description: 'Extend the requirement to role-domain-admins',
      points: 10,
      category: 'exec',
    },
    {
      id: 'o6',
      description: 'Document the rollout: scope, what "compliant" means, exceptions',
      points: 10,
      category: 'docs',
    },
  ],
  steps: [
    {
      id: 's1',
      title: 'Review current admin sign-in exposure',
      brief:
        'Open the IAM Console. Confirm that role-iam-admins and role-domain-admins currently have no device requirement at all — any machine, managed or not, can authenticate as an admin today.',
      validator: { kind: 'evidence-collected', params: { stepId: 's1' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } }],
      tutorPrompts: [
        'A stolen but otherwise valid admin credential — what stops it from being used today, and what should?',
      ],
      hintIds: ['lab22.s1.h1'],
      points: { troubleshoot: 20 },
    },
    {
      id: 's2',
      title: 'Require a compliant device for role-iam-admins',
      brief:
        'Use Set Conditional Access Policy: Role = role-iam-admins, Require compliant device = on.',
      validator: {
        kind: 'ca-policy-created',
        params: { policyKind: 'device-compliance', roleId: 'role-iam-admins' },
      },
      evidence: [{ kind: 'log-excerpt', capture: 'auto', params: { count: 3 } }],
      tutorPrompts: ['Why scope this to role-iam-admins instead of every employee on day one?'],
      hintIds: ['lab22.s2.h1'],
      points: { exec: 20 },
    },
    {
      id: 's3',
      title: 'Prove the block actually holds',
      brief:
        'Verify Authentication as erin.cho with "device compliant" unchecked. The sign-in must be blocked — not just described as blocked.',
      validator: { kind: 'signin-blocked', params: { userId: 'erin.cho' } },
      evidence: [{ kind: 'log-excerpt', capture: 'auto', params: { count: 3 } }],
      tutorPrompts: [
        'If this had failed silently instead of logging a blocked sign-in, how would anyone know the policy was working at all?',
      ],
      hintIds: ['lab22.s3.h1'],
      points: { troubleshoot: 15, evidence: 5 },
    },
    {
      id: 's4',
      title: 'Prove a compliant device still gets through',
      brief:
        'Verify Authentication as erin.cho again, this time with "device compliant" checked. It must succeed — the policy blocks non-compliant devices, not Erin.',
      validator: { kind: 'signin-succeeded', params: { userId: 'erin.cho' } },
      evidence: [{ kind: 'log-excerpt', capture: 'auto', params: { count: 3 } }],
      tutorPrompts: ['Why test the allow case at all, if you already confirmed the block works?'],
      hintIds: ['lab22.s4.h1'],
      points: { exec: 10, 'least-privilege': 10 },
    },
    {
      id: 's5',
      title: 'Extend the requirement to role-domain-admins',
      brief:
        'Domain admin is at least as sensitive as IAM admin. Use Set Conditional Access Policy again: Role = role-domain-admins, Require compliant device = on.',
      validator: {
        kind: 'ca-policy-created',
        params: { policyKind: 'device-compliance', roleId: 'role-domain-admins' },
      },
      evidence: [{ kind: 'log-excerpt', capture: 'auto', params: { count: 3 } }],
      tutorPrompts: [
        'What would you check to make sure this second policy did not accidentally weaken the first one?',
      ],
      hintIds: ['lab22.s5.h1'],
      points: { exec: 10 },
    },
    {
      id: 's6',
      title: 'Document the rollout',
      brief:
        'Write up: which roles now require a compliant device, what "compliant" means (MDM-enrolled, disk encryption on, OS patched), and the exception process for a legitimate admin on a new, not-yet-enrolled device.',
      validator: { kind: 'evidence-collected', params: { stepId: 's6' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } }],
      tutorPrompts: [
        'An admin is issued a new laptop today and needs to work before MDM enrollment finishes. What is the safe exception, and what is not?',
      ],
      hintIds: ['lab22.s6.h1'],
      points: { docs: 10 },
    },
  ],
  faults: [],
  debriefQuestions: [
    'Where should a device-compliance check actually be evaluated: the IdP, the app, or the network — and why does it matter?',
    'A policy that blocks and logs nothing is barely better than no policy. What does the audit trail here actually let SecOps see?',
    'This lab covers two roles. How would you find every privileged role in the tenant that still has no device requirement?',
  ],
};
