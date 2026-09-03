/**
 * seed/perLab/lab04.ts — Enterprise SSO (SAML + OIDC).
 * Baseline + ensure Finance and Help Desk apps are present and configurable.
 */
import type { MockDirectory } from '@/services';
import type { MockIdP } from '@/services';
import type { MockAppServer } from '@/services';
import { applyBaseline } from '../baseline';

export function applyLab04Seed(dir: MockDirectory, idp: MockIdP, apps: MockAppServer): void {
  applyBaseline(dir, idp, apps);
  // Both apps are already registered in baseline.
}
