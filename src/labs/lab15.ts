/**
 * labs/lab15.ts — PKI & Certificate Lifecycle.
 *
 * Uses a single expired-cert fault, not two. faultStore tracks active
 * faults by kind in a flat array — Conductor.autoClearFaults calls
 * faultStore.clear(kind), which removes every entry of that kind at once.
 * Two same-kind fault instances (even targeting different apps) would let
 * fixing the first silently clear the second's marker too, making its
 * fault-cleared step trivially pass. s4's proactive rotation is instead
 * validated via app-config-fixed, which is scoped to the specific
 * app.config.changed event — safe to reuse even with no fault behind it.
 */
import { mkLabId } from '@/domain';
import type { Lab, AppId } from '@/domain';

export const LAB_15: Lab = {
  id: mkLabId('lab15'),
  number: 15,
  title: 'PKI & Certificate Lifecycle',
  brief:
    "Finance Portal's signing certificate just expired mid-morning. Fix it, verify both affected portals, then rotate Help Desk Portal's certificate before it fails the same way.",
  durationMinutes: 40,
  zoneIds: ['iam-ops', 'app-center', 'server-room'],
  startingZone: 'iam-ops',
  startingSeed: 'lab15',
  objectives: [
    {
      id: 'o1',
      description: 'Inventory application certificates and identify expiry risk',
      points: 10,
      category: 'troubleshoot',
    },
    {
      id: 'o2',
      description: "Diagnose and fix Finance Portal's expired certificate",
      points: 15,
      category: 'troubleshoot',
    },
    {
      id: 'o3',
      description: 'Verify sign-in for two users post-fix',
      points: 10,
      category: 'evidence',
    },
    {
      id: 'o4',
      description: "Proactively rotate Help Desk Portal's certificate before it expires",
      points: 12,
      category: 'exec',
    },
    {
      id: 'o5',
      description: 'Document a certificate monitoring and renewal policy',
      points: 8,
      category: 'docs',
    },
  ],
  steps: [
    {
      id: 's1',
      title: 'Inventory application certificates',
      brief:
        'Review Registered Applications in the IAM Console. Note which apps have certificate-backed trust and which are closest to expiry.',
      validator: { kind: 'evidence-collected', params: { stepId: 's1' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } }],
      tutorPrompts: [
        'What breaks first when a signing certificate expires — authentication, or the trust the assertion relies on?',
      ],
      hintIds: ['lab15.s1.h1'],
      points: { troubleshoot: 10 },
    },
    {
      id: 's2',
      title: "Fix Finance Portal's expired certificate (fault)",
      brief:
        'Finance Portal sign-ins are failing. Read the "Configuration mismatch" panel — it names the expired field and the expected renewal date — then correct it with "Update App Configuration".',
      validator: { kind: 'fault-cleared', params: { kind: 'expired-cert' } },
      evidence: [{ kind: 'config-diff', capture: 'auto', params: { appId: 'app-finance' } }],
      tutorPrompts: [
        "What is the practical difference between an expired certificate and a wrong redirect URI, from the end user's point of view?",
        'Who in a real organization owns certificate renewal — IAM, network engineering, or whoever set it up originally?',
      ],
      hintIds: ['lab15.s2.h1'],
      points: { troubleshoot: 15 },
    },
    {
      id: 's3',
      title: 'Verify both portals authenticate',
      brief:
        'Sign in as Dan Rivera on Finance Portal and Erin Cho on Help Desk Portal — both must succeed.',
      validator: { kind: 'signin-succeeded', params: { userId: 'erin.cho' } },
      evidence: [{ kind: 'log-excerpt', capture: 'auto', params: { count: 5 } }],
      tutorPrompts: ['Why verify a second, unaffected app instead of only the one you just fixed?'],
      hintIds: ['lab15.s3.h1'],
      points: { evidence: 10 },
    },
    {
      id: 's4',
      title: "Rotate Help Desk Portal's certificate proactively",
      brief:
        "The inventory in step 1 flagged Help Desk Portal's certificate as next to expire. Rotate it now — set cert.validUntil to a date at least a year out — before it fails the same way Finance Portal just did.",
      validator: { kind: 'app-config-fixed', params: { appId: 'app-helpdesk-portal' } },
      evidence: [
        { kind: 'config-diff', capture: 'auto', params: { appId: 'app-helpdesk-portal' } },
      ],
      tutorPrompts: [
        "What is the advantage of rotating this certificate now versus waiting for it to fail like Finance Portal's did?",
      ],
      hintIds: ['lab15.s4.h1'],
      points: { exec: 12 },
    },
    {
      id: 's5',
      title: 'Document a certificate monitoring policy',
      brief:
        'Write up: how far ahead of expiry an alert should fire, who owns renewal, and how you would have caught the Finance Portal expiry before it caused an outage.',
      validator: { kind: 'evidence-collected', params: { stepId: 's5' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } }],
      tutorPrompts: [
        "If every certificate in this tenant were monitored with a 30-day-out alert, would today's incident have happened?",
      ],
      hintIds: ['lab15.s5.h1'],
      points: { docs: 8 },
    },
  ],
  faults: [
    {
      id: 'f1',
      kind: 'expired-cert',
      applyAtStep: 's2',
      params: {},
      targetAppId: 'app-finance' as AppId,
    },
  ],
  debriefQuestions: [
    'What is the chain of trust a certificate actually establishes, in your own words?',
    'Why did fixing Finance Portal not also require touching Help Desk Portal?',
    'What monitoring would have turned this incident into a routine renewal instead?',
  ],
};
