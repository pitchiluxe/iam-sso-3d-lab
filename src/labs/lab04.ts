/**
 * labs/lab04.ts — Enterprise SSO (SAML + OIDC).
 */
import { mkLabId } from '@/domain';
import type { Lab } from '@/domain';

export const LAB_04: Lab = {
  id: mkLabId('lab04'),
  number: 4,
  title: 'Enterprise SSO — SAML & OIDC',
  brief:
    'Configure single sign-on for the Finance Portal (SAML) and Help Desk Portal (OIDC). Map identity claims.',
  durationMinutes: 50,
  zoneIds: ['iam-ops', 'app-center'],
  startingZone: 'iam-ops',
  startingSeed: 'lab04',
  objectives: [
    {
      id: 'o1',
      description: 'Configure Finance Portal as SAML client',
      points: 10,
      category: 'exec',
    },
    { id: 'o2', description: 'Configure Help Desk as OIDC client', points: 10, category: 'exec' },
    { id: 'o3', description: 'Map the role claim', points: 5, category: 'exec' },
    { id: 'o4', description: 'Verify SSO for Dan and Erin', points: 5, category: 'troubleshoot' },
    { id: 'o5', description: 'Document SSO configuration', points: 5, category: 'docs' },
  ],
  steps: [
    {
      id: 's1',
      title: 'Configure Finance Portal as SAML client',
      brief:
        'In the IAM Console, configure the Finance Portal: protocol SAML, entity ID urn:finance.northwind.example, redirect URI https://finance.northwind.example/callback.',
      validator: { kind: 'app-config-fixed', params: { appId: 'app-finance' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } }],
      tutorPrompts: ['What is the trust boundary in SAML — the browser, the IdP, or the SP?'],
      hintIds: ['lab04.s1.h1'],
      points: { exec: 10 },
    },
    {
      id: 's2',
      title: 'Configure Help Desk Portal as OIDC client',
      brief:
        'Configure Help Desk: protocol OIDC, redirect URI https://helpdesk.northwind.example/callback, issuer https://idp.northwind.example/realms/northwind.',
      validator: { kind: 'app-config-fixed', params: { appId: 'app-helpdesk-portal' } },
      evidence: [{ kind: 'snapshot', capture: 'manual', params: { console: 'iamConsole' } }],
      tutorPrompts: ['What does the OIDC issuer URL represent in the trust chain?'],
      hintIds: ['lab04.s2.h1'],
      points: { exec: 10 },
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
      points: { exec: 5 },
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
      points: { exec: 5, troubleshoot: 5, docs: 5 },
    },
  ],
  faults: [],
  debriefQuestions: [
    'What is the trust boundary in SAML — the browser, the IdP, or the SP?',
    'Why does OIDC need a redirect URI, and what is the security implication of a misconfigured one?',
  ],
};
