/**
 * seed/perLab/lab23.ts — M&A Identity Consolidation.
 *
 * Northwind Labs has just acquired Fabrikam Analytics (the same partner
 * company lab21 uses for guest access — no third fictional company gets
 * invented here). Baseline already has an alex.morgan (Finance, Payroll
 * Analyst); Fabrikam's migration roster happens to include a different
 * person with the same name — a coincidence real mergers hit constantly,
 * not a data-entry error to fix. One more thing came across from Fabrikam
 * before this lab starts: a shared login several of their staff used
 * day-to-day, already active in this directory because someone migrated it
 * without checking what it was.
 */
import type { MockDirectory } from '@/services';
import type { MockIdP } from '@/services';
import type { MockAppServer } from '@/services';
import { SYSTEM_ACTOR } from '@/domain';
import { PARTNER_COMPANY } from '@/config';
import { applyBaseline } from '../baseline';

export function applyLab23Seed(dir: MockDirectory, idp: MockIdP, apps: MockAppServer): void {
  applyBaseline(dir, idp, apps);

  dir.ensureUser(
    {
      username: 'fabrikam-shared-login',
      displayName: 'Fabrikam Shared Login',
      email: `shared@${PARTNER_COMPANY.domain}`,
      department: `External — ${PARTNER_COMPANY.name}`,
      title: 'Shared account used by multiple Fabrikam staff — migrated without review',
      mfa: 'none',
    },
    SYSTEM_ACTOR,
  );
}
