/**
 * labs/lab04.ts — Enterprise SSO (SAML + OIDC).
 *
 * s1/s2 start with both apps deliberately unconfigured (seed/perLab/lab04.ts)
 * so 'app-config-fixed' — which fires on the app.config.changed event the
 * new app.config.update capability emits — actually gates on the learner
 * doing the configuration, not on the app already being ready at baseline.
 */
import { mkLabId } from '@/domain';
import type { Lab, AppId } from '@/domain';

export const LAB_04: Lab = {
  id: mkLabId('lab04'),
  number: 4,
  title: 'Enterprise SSO — SAML & OIDC',
  brief:
    'Configure single sign-on for the Finance Portal (SAML) and Help Desk Portal (OIDC). Map identity claims, then diagnose a live redirect-URI fault.',
  durationMinutes: 55,
  zoneIds: ['iam-ops', 'app-center'],
  startingZone: 'iam-ops',
  startingSeed: 'lab04',
  objectives: [
    {
      id: 'o1',
      description: 'Configure Finance Portal as SAML client',
      points: 22,
      category: 'exec',
    },
    { id: 'o2', description: 'Configure Help Desk as OIDC client', points: 22, category: 'exec' },
    { id: 'o3', description: 'Map the role claim', points: 11, category: 'exec' },
    { id: 'o4', description: 'Verify SSO for Dan and Erin', points: 11, category: 'troubleshoot' },
    {
      id: 'o5',
      description: 'Diagnose and fix an injected redirect-URI fault',
      points: 18,
      category: 'troubleshoot',
    },
    { id: 'o6', description: 'Document SSO configuration', points: 16, category: 'docs' },
  ],
  steps: [
    {
      id: 's1',
      title: 'Configure Finance Portal as SAML client',
      brief:
        'In the IAM Console, use "Update App Configuration" to set app-finance: entity ID urn:finance.northwind.example, redirect URI https://finance.northwind.example/callback.',
      validator: { kind: 'app-config-fixed', params: { appId: 'app-finance' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } }],
      tutorPrompts: ['What is the trust boundary in SAML — the browser, the IdP, or the SP?'],
      hintIds: ['lab04.s1.h1'],
      points: { exec: 21 },
    },
    {
      id: 's2',
      title: 'Configure Help Desk Portal as OIDC client',
      brief:
        'Use "Update App Configuration" to set app-helpdesk-portal: redirect URI https://helpdesk.northwind.example/callback, issuer https://idp.northwind.example/realms/northwind.',
      validator: { kind: 'app-config-fixed', params: { appId: 'app-helpdesk-portal' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } }],
      tutorPrompts: ['What does the OIDC issuer URL represent in the trust chain?'],
      hintIds: ['lab04.s2.h1'],
      points: { exec: 21 },
    },
    {
      id: 's3',
      title: 'Map the role claim',
      brief:
        'Map the role claim from the IdP to grp-helpdesk-tier1 for the Help Desk Portal. Test that Dan can reach the portal.',
      validator: { kind: 'signin-succeeded', params: { userId: 'dan.rivera' } },
      evidence: [{ kind: 'log-excerpt', capture: 'auto', params: { count: 3 } }],
      tutorPrompts: ['What attributes would you need to map to grant Finance access?'],
      hintIds: ['lab04.s3.h1'],
      points: { exec: 11 },
    },
    {
      id: 's4',
      title: 'Verify SSO for both portals',
      brief:
        'Sign in as Erin Cho and reach both Finance Portal and Help Desk without re-entering credentials.',
      validator: { kind: 'signin-succeeded', params: { userId: 'erin.cho' } },
      evidence: [{ kind: 'log-excerpt', capture: 'auto', params: { count: 5 } }],
      tutorPrompts: ['What evidence proves SSO is working and not just cached credentials?'],
      hintIds: ['lab04.s4.h1'],
      points: { exec: 11, troubleshoot: 4 },
    },
    {
      id: 's5',
      title: 'Diagnose a live redirect-URI fault (fault)',
      brief:
        'Finance Portal sign-ins have started failing. Something changed the redirect URI. Read the "Configuration mismatch" panel on the failed sign-in, then correct it with "Update App Configuration".',
      validator: { kind: 'fault-cleared', params: { kind: 'wrong-redirect-uri' } },
      evidence: [{ kind: 'config-diff', capture: 'auto', params: { appId: 'app-finance' } }],
      tutorPrompts: [
        'What is the first evidence you would check to confirm this is a redirect-URI mismatch and not an IdP outage?',
        'Why does a wrong redirect URI fail closed instead of silently logging in to the wrong place?',
      ],
      hintIds: ['lab04.s5.h1'],
      points: { troubleshoot: 17 },
    },
    {
      id: 's6',
      title: 'Document the SSO configuration',
      brief:
        'Write up both app configurations (protocol, entity ID/issuer, redirect URI, claim mapping) and the redirect-URI incident: cause, fix, and how you would detect it faster next time.',
      validator: { kind: 'evidence-collected', params: { stepId: 's6' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } }],
      tutorPrompts: [
        'If a new SSO integration used your document as a template, would it have every field it needs?',
      ],
      hintIds: ['lab04.s6.h1'],
      points: { docs: 15 },
    },
  ],
  faults: [
    {
      id: 'f1',
      kind: 'wrong-redirect-uri',
      applyAtStep: 's5',
      params: {},
      targetAppId: 'app-finance' as AppId,
    },
  ],
  debriefQuestions: [
    'What is the trust boundary in SAML — the browser, the IdP, or the SP?',
    'Why does OIDC need a redirect URI, and what is the security implication of a misconfigured one?',
    'Sign-in succeeded in step 4 and failed in step 5 with the exact same user. What single field changed, and how did you find it?',
  ],
};
