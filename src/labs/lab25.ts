/**
 * labs/lab25.ts — Passwordless / FIDO2 Migration.
 *
 * MfaMethod already includes 'fido2' and Enrol MFA already accepts it as a
 * value — nothing new to build. Three accounts, three different starting
 * points (no MFA, SMS, TOTP), all phishable to different degrees, all
 * migrating to the same non-phishable method.
 */
import { mkLabId } from '@/domain';
import type { Lab } from '@/domain';

export const LAB_25: Lab = {
  id: mkLabId('lab25'),
  number: 25,
  title: 'Passwordless / FIDO2 Migration',
  brief:
    'Three high-value accounts are on three different MFA methods, none of them phishing-resistant. Migrate all three to FIDO2 and document the rollout.',
  durationMinutes: 35,
  zoneIds: ['iam-ops', 'sec-ops'],
  startingZone: 'iam-ops',
  startingSeed: 'lab25',
  objectives: [
    {
      id: 'o1',
      description: 'Review current MFA coverage across the three accounts',
      points: 20,
      category: 'troubleshoot',
    },
    {
      id: 'o2',
      description: 'Enroll erin.cho (no MFA) directly in FIDO2',
      points: 20,
      category: 'exec',
    },
    {
      id: 'o3',
      description: 'Migrate greta.olsen from SMS to FIDO2',
      points: 20,
      category: 'exec',
    },
    {
      id: 'o4',
      description: 'Migrate finn.muller from TOTP to FIDO2',
      points: 20,
      category: 'exec',
    },
    {
      id: 'o5',
      description: 'Document the rollout and the fallback exception process',
      points: 20,
      category: 'docs',
    },
  ],
  steps: [
    {
      id: 's1',
      title: 'Review current MFA coverage',
      brief:
        'Check MFA status for erin.cho (IAM Admin), greta.olsen (CFO), and finn.muller (SecOps). None of them are on FIDO2 yet — erin has no MFA at all, greta is on SMS, finn is on TOTP.',
      validator: { kind: 'evidence-collected', params: { stepId: 's1' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } }],
      tutorPrompts: [
        'SMS, TOTP, and FIDO2 are all "MFA". What specific attack does each one fail to stop that FIDO2 does?',
      ],
      hintIds: ['lab25.s1.h1'],
      points: { troubleshoot: 20 },
    },
    {
      id: 's2',
      title: 'Enroll Erin in FIDO2',
      brief:
        'Erin Cho has no MFA registered. Enroll her directly in FIDO2 — skip legacy methods entirely.',
      validator: { kind: 'mfa-challenge-completed', params: { userId: 'erin.cho' } },
      evidence: [{ kind: 'log-excerpt', capture: 'auto', params: { count: 3 } }],
      tutorPrompts: [
        'Why enroll a new privileged account straight into FIDO2 instead of TOTP first and upgrading later?',
      ],
      hintIds: ['lab25.s2.h1'],
      points: { exec: 20 },
    },
    {
      id: 's3',
      title: 'Migrate Greta from SMS to FIDO2',
      brief:
        'Greta Olsen, the CFO, is the highest-value phishing target in the company and is still on SMS — the easiest MFA method to intercept. Migrate her to FIDO2 first among the legacy-enrolled accounts.',
      validator: { kind: 'mfa-challenge-completed', params: { userId: 'greta.olsen' } },
      evidence: [{ kind: 'log-excerpt', capture: 'auto', params: { count: 3 } }],
      tutorPrompts: [
        'What specifically about SMS makes it the weakest of the three methods this lab covers?',
      ],
      hintIds: ['lab25.s3.h1'],
      points: { exec: 15, 'least-privilege': 5 },
    },
    {
      id: 's4',
      title: 'Migrate Finn from TOTP to FIDO2',
      brief:
        'Finn Müller is on TOTP — better than SMS, but still vulnerable to a real-time phishing relay. Migrate him to FIDO2.',
      validator: { kind: 'mfa-challenge-completed', params: { userId: 'finn.muller' } },
      evidence: [{ kind: 'log-excerpt', capture: 'auto', params: { count: 3 } }],
      tutorPrompts: [
        'TOTP codes are typically considered stronger than SMS. What attack still works against TOTP that does not work against FIDO2?',
      ],
      hintIds: ['lab25.s4.h1'],
      points: { exec: 15, troubleshoot: 5 },
    },
    {
      id: 's5',
      title: 'Document the rollout',
      brief:
        'Write up: which accounts are now on FIDO2, the retirement timeline for SMS and TOTP, and the temporary fallback process for someone without a hardware key yet.',
      validator: { kind: 'evidence-collected', params: { stepId: 's5' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } }],
      tutorPrompts: [
        'If the fallback process is "just use TOTP until your key arrives", what stops that from quietly becoming permanent?',
      ],
      hintIds: ['lab25.s5.h1'],
      points: { docs: 20 },
    },
  ],
  faults: [],
  debriefQuestions: [
    'What specific attack does FIDO2 stop that SMS and TOTP both fail to stop?',
    'Why start a passwordless rollout with the highest-value accounts instead of the whole company at once?',
    'A user without a hardware key needs a fallback during rollout. How do you make sure that fallback expires instead of becoming the new normal?',
  ],
};
