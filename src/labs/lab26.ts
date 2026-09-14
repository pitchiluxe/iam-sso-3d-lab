/**
 * labs/lab26.ts — Active Directory Attack-Path Review.
 *
 * A BloodHound-style exercise: find the shortest path from a low-privilege
 * account to full domain compromise. This app's world already contains one
 * without any fault injected — dan.rivera's help-desk password-reset rights
 * reach hank.oneill, who holds standing domain-admin. The fix is the same
 * PAM pattern lab09 teaches: a password reset should never be able to
 * hijack a standing privilege that shouldn't be standing in the first place.
 */
import { mkLabId } from '@/domain';
import type { Lab } from '@/domain';

export const LAB_26: Lab = {
  id: mkLabId('lab26'),
  number: 26,
  title: 'Active Directory Attack-Path Review',
  brief:
    "Find the shortest path from a help-desk account to full domain compromise, prove it's real, then close it.",
  durationMinutes: 40,
  zoneIds: ['iam-ops', 'sec-ops'],
  startingZone: 'iam-ops',
  startingSeed: 'lab26',
  objectives: [
    {
      id: 'o1',
      description: 'Map a path from a low-privilege account to a domain admin',
      points: 20,
      category: 'troubleshoot',
    },
    {
      id: 'o2',
      description: 'Prove the path is real, not theoretical',
      points: 20,
      category: 'troubleshoot',
    },
    {
      id: 'o3',
      description: 'Close the path by removing the standing privilege it reaches',
      points: 20,
      category: 'least-privilege',
    },
    {
      id: 'o4',
      description: 'Check for other accounts with the same one-hop exposure',
      points: 20,
      category: 'troubleshoot',
    },
    {
      id: 'o5',
      description: 'Document the finding, the fix, and a recurring review',
      points: 20,
      category: 'docs',
    },
  ],
  steps: [
    {
      id: 's1',
      title: 'Map the attack path',
      brief:
        "Dan Rivera is Help Desk Tier 1 — no admin group membership at all. But help-desk tier 1 can reset any user's password, and Hank O'Neill holds standing role-domain-admins. Trace the path: who can reset whose password, and where does it lead?",
      validator: { kind: 'evidence-collected', params: { stepId: 's1' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } }],
      tutorPrompts: [
        'Dan holds no admin group membership at all. Why does that not mean he has no path to admin?',
        "What single capability, held by an unprivileged role, is functionally equivalent to holding the target account's password?",
      ],
      hintIds: ['lab26.s1.h1'],
      points: { troubleshoot: 20 },
    },
    {
      id: 's2',
      title: 'Prove the path is real',
      brief:
        "A path on paper is not a finding until it works. Reset Hank O'Neill's password — the same action Dan's role is permitted to take — and confirm you now control the credential for a standing domain admin.",
      validator: { kind: 'password-reset', params: { userId: 'hank.oneill' } },
      evidence: [{ kind: 'log-excerpt', capture: 'auto', params: { count: 3 } }],
      tutorPrompts: [
        'You just did, with permission, exactly what a compromised help-desk account could do without it. What does that tell you about where the real privilege boundary sits?',
      ],
      hintIds: ['lab26.s2.h1'],
      points: { troubleshoot: 10, evidence: 10 },
    },
    {
      id: 's3',
      title: 'Close the path',
      brief:
        'The fix is not to take password-reset away from help desk — that breaks their job. The fix is that Hank should not hold standing domain-admin a password reset can hijack in the first place. Revoke his standing role-domain-admins.',
      validator: { kind: 'role-revoked', params: { userId: 'hank.oneill' } },
      evidence: [{ kind: 'log-excerpt', capture: 'auto', params: { count: 3 } }],
      tutorPrompts: [
        'Why does removing standing privilege close this path more effectively than trying to restrict what help desk can reset?',
      ],
      hintIds: ['lab26.s3.h1'],
      points: { 'least-privilege': 15, exec: 5 },
    },
    {
      id: 's4',
      title: 'Check for other exposed accounts',
      brief:
        'Hank was not necessarily the only standing admin one password reset away from full compromise. Review the other privileged groups for the same exposure.',
      validator: { kind: 'evidence-collected', params: { stepId: 's4' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'secOpsDashboard' } }],
      tutorPrompts: [
        'If you only fixed the one path you were shown, what would still be true about every other standing admin in the tenant?',
      ],
      hintIds: ['lab26.s4.h1'],
      points: { troubleshoot: 20 },
    },
    {
      id: 's5',
      title: 'Document the finding and the fix',
      brief:
        'Write up the attack path, the proof, the fix, and a recommendation: every standing privileged role is one password reset away from compromise by whoever holds reset rights — recommend PAM/JIT elevation (lab09) for all of them, and a recurring path review instead of a one-time fix.',
      validator: { kind: 'evidence-collected', params: { stepId: 's5' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } }],
      tutorPrompts: [
        'A one-time fix closes this path. What closes the next one that shows up after the org chart changes?',
      ],
      hintIds: ['lab26.s5.h1'],
      points: { docs: 20 },
    },
  ],
  faults: [],
  debriefQuestions: [
    'Why is "who can reset your password" as important a security boundary as "what groups are you in"?',
    'This lab fixed one path. What would a recurring, automated version of this review need to check every time?',
    'How is this attack path different from the one lab09 addresses, and how is the fix the same?',
  ],
};
