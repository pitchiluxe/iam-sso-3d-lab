/**
 * seed/perLab/lab04.ts — Enterprise SSO (SAML + OIDC).
 * Baseline, then both target apps are rolled back to a needs-configuration
 * state — baseline ships them already fully configured, which would let the
 * learner's first two steps here pass without touching anything.
 */
import { mkAppId } from '@/domain';
import type { MockDirectory } from '@/services';
import type { MockIdP } from '@/services';
import type { MockAppServer } from '@/services';
import { applyBaseline } from '../baseline';
import { COMPANY } from '@/config';

export function applyLab04Seed(dir: MockDirectory, idp: MockIdP, apps: MockAppServer): void {
  applyBaseline(dir, idp, apps);

  const finance = apps.getApp(mkAppId('app-finance'))!;
  finance.status = 'misconfigured';
  finance.entityId = '';
  finance.redirectUri = '';
  finance.configDiffFromBaseline = {
    entityId: { expected: 'urn:finance.northwind.example', actual: '' },
    redirectUri: { expected: 'https://finance.northwind.example/callback', actual: '' },
  };

  const helpdesk = apps.getApp(mkAppId('app-helpdesk-portal'))!;
  helpdesk.status = 'misconfigured';
  helpdesk.redirectUri = '';
  helpdesk.issuer = '';
  helpdesk.configDiffFromBaseline = {
    redirectUri: { expected: 'https://helpdesk.northwind.example/callback', actual: '' },
    issuer: { expected: COMPANY.idpUrl, actual: '' },
  };
}
