/**
 * seed/perLab/lab16.ts — LDAP & Kerberos Authentication Troubleshooting.
 * Baseline + Greta Olsen locked out mid-incident. The clock-skew fault
 * itself lives in lab16.ts's own `faults` array, applied at s2, matching
 * how every other break/fix-style lab injects its fault.
 */
import type { MockDirectory } from '@/services';
import type { MockIdP } from '@/services';
import type { MockAppServer } from '@/services';
import { applyBaseline } from '../baseline';

export function applyLab16Seed(dir: MockDirectory, idp: MockIdP, apps: MockAppServer): void {
  const base = applyBaseline(dir, idp, apps);
  // Locked out from repeated failed logons while the domain controller's
  // clock was drifting and every Kerberos ticket she was issued failed
  // validation.
  const greta = dir.getUser(base.userIds['greta.olsen']!);
  if (greta) greta.status = 'locked';
}
