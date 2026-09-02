/**
 * labs/lab08.ts — Identity Security Incident Response.
 */
import { mkLabId } from '@/domain';
import type { Lab, UserId } from '@/domain';

export const LAB_08: Lab = {
  id: mkLabId('lab08'),
  number: 8,
  title: 'Identity Security Incident',
  brief: 'Jane Doe\'s account shows suspicious sign-in activity. Contain, investigate, and write the incident report.',
  durationMinutes: 45,
  zoneIds: ['sec-ops', 'iam-ops'],
  startingZone: 'sec-ops',
  startingSeed: 'lab08',
  objectives: [
    { id: 'o1', description: 'Open and triage the incident',     points: 5,  category: 'exec' },
    { id: 'o2', description: 'Contain Jane\'s account',         points: 10, category: 'exec' },
    { id: 'o3', description: 'Search for related activity',     points: 5,  category: 'troubleshoot' },
    { id: 'o4', description: 'Write incident report',           points: 10, category: 'docs' },
    { id: 'o5', description: 'Close the incident',              points: 5,  category: 'exec' },
  ],
  steps: [
    {
      id: 's1',
      title: 'Triage the suspicious sign-in',
      brief: 'Review the audit events. Three failed sign-ins from foreign ASN 203.0.113.42, then one success. Identify the affected account.',
      validator: { kind: 'evidence-collected', params: { stepId: 's1' } },
      evidence: [{ kind: 'log-excerpt', capture: 'auto', params: { count: 10 } }],
      tutorPrompts: ['What indicators distinguish credential stuffing from a legitimate foreign sign-in?'],
      hintIds: ['lab08.s1.h1'],
      points: { exec: 5 },
    },
    {
      id: 's2',
      title: 'Contain Jane\'s account',
      brief: 'Disable Jane\'s account. Revoke all active sessions. Reset her credentials and MFA enrollment.',
      validator: { kind: 'user-disabled', params: { userId: 'jane.doe' } },
      evidence: [
        { kind: 'log-excerpt', capture: 'auto', params: { count: 5 } },
        { kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } },
      ],
      tutorPrompts: ['What is the difference between containment and eradication here?'],
      hintIds: ['lab08.s2.h1'],
      points: { exec: 10, evidence: 3 },
    },
    {
      id: 's3',
      title: 'Search for related activity',
      brief: 'Search the audit log for any other accounts with activity from ASN 203.0.113.42. Check for privilege escalation.',
      validator: { kind: 'evidence-collected', params: { stepId: 's3' } },
      evidence: [{ kind: 'log-excerpt', capture: 'auto', params: { count: 20 } }],
      tutorPrompts: ['How would you know if the attacker used Jane\'s account to pivot to other systems?'],
      hintIds: ['lab08.s3.h1'],
      points: { troubleshoot: 5 },
    },
    {
      id: 's4',
      title: 'Write the incident report',
      brief: 'Produce a concise incident report: timeline, indicators, containment actions, and next steps.',
      validator: { kind: 'evidence-collected', params: { stepId: 's4' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'secOpsDashboard' } }],
      tutorPrompts: ['What would you recommend to prevent this from happening again?'],
      hintIds: ['lab08.s4.h1'],
      points: { docs: 10 },
    },
    {
      id: 's5',
      title: 'Close the incident',
      brief: 'Close the incident and mark it as recovered. Mark the campaign as closed.',
      validator: { kind: 'fault-cleared', params: {} },
      evidence: [{ kind: 'log-excerpt', capture: 'auto', params: { count: 3 } }],
      tutorPrompts: ['When would you re-enable Jane\'s account? What conditions must be met?'],
      hintIds: ['lab08.s5.h1'],
      points: { exec: 5 },
    },
  ],
  faults: [{ id: 'f1', kind: 'suspicious-signin', applyAtStep: 's1', params: {}, targetUserId: 'jane.doe' as UserId }],
  debriefQuestions: [
    'What is the difference between containment and eradication here?',
    'When would you re-enable Jane\'s account?',
  ],
};
