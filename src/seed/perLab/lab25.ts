/**
 * seed/perLab/lab25.ts — Passwordless / FIDO2 Migration.
 * Baseline + Greta Olsen (CFO) on SMS — a legacy rollout, and the highest-
 * value phishing target in the company. finn.muller already has baseline
 * TOTP; erin.cho already has baseline mfa: 'none'. All three represent a
 * different starting point the migration has to cover.
 */
import type { MockDirectory } from '@/services';
import type { MockIdP } from '@/services';
import type { MockAppServer } from '@/services';
import { applyBaseline } from '../baseline';

export function applyLab25Seed(dir: MockDirectory, idp: MockIdP, apps: MockAppServer): void {
  const base = applyBaseline(dir, idp, apps);
  const greta = dir.getUser(base.userIds['greta.olsen']!);
  if (greta) greta.mfa = 'sms';
}
