/**
 * seed/perLab/lab11.ts — Conditional Access Deep-Dive.
 * Baseline + ensure legacy auth is enabled and no CA policies exist.
 * The fault (legacy-auth-misconfiguration) is applied at step s4 by the conductor.
 */
import type { MockDirectory } from '@/services';
import type { MockIdP } from '@/services';
import type { MockAppServer } from '@/services';
import type { MockTicketQueue } from '@/services';
import { applyBaseline } from '../baseline';

export function applyLab11Seed(
  dir: MockDirectory,
  idp: MockIdP,
  apps: MockAppServer,
  _tickets: MockTicketQueue,
): void {
  applyBaseline(dir, idp, apps);
  // Ensure legacy auth methods are enabled (baseline disables some).
  // The scenario: no CA policies are configured yet — learner builds them from scratch.
  // Fault (legacy-auth-misconfiguration) applied by conductor at s4.
}
