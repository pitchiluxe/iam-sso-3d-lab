/**
 * conductor/seedRegistry.ts — the map of seed key → seed function.
 *
 * Extracted from conductor.ts to break an import cycle:
 *
 *   conductor -> stores -> generatedLabsStore -> templates -> conductor
 *
 * templates.ts registers its seeds at module scope, so it needs
 * registerLabSeed the moment it evaluates. While that came from conductor.ts,
 * evaluating conductor.ts first left the binding uninitialised and the whole
 * graph threw "registerLabSeed is not a function". The app only survived
 * because main.ts happened to import in an order that hid it.
 *
 * This module imports services and seeds only — never stores, never the
 * conductor — so it can always be evaluated first and the cycle cannot re-form.
 */
import type {
  MockAccessReviews,
  MockAppServer,
  MockAuditLog,
  MockDirectory,
  MockIdP,
  MockIncidents,
  MockOAuthGrants,
  MockCloudRoles,
  MockTicketQueue,
} from '@/services';
import type { Lab } from '@/domain';
import { applyBaseline } from '@/seed/baseline';
import { applyLab01Seed } from '@/seed/perLab/lab01';
import { applyLab02Seed } from '@/seed/perLab/lab02';
import { applyLab03Seed } from '@/seed/perLab/lab03';
import { applyLab04Seed } from '@/seed/perLab/lab04';
import { applyLab05Seed } from '@/seed/perLab/lab05';
import { applyLab06Seed } from '@/seed/perLab/lab06';
import { applyLab07Seed } from '@/seed/perLab/lab07';
import { applyLab08Seed } from '@/seed/perLab/lab08';
import { applyLab09Seed } from '@/seed/perLab/lab09';
import { applyLab10Seed } from '@/seed/perLab/lab10';
import { applyLab11Seed } from '@/seed/perLab/lab11';
import { applyLab12Seed } from '@/seed/perLab/lab12';
import { applyLab13Seed } from '@/seed/perLab/lab13';
import { applyLab14Seed } from '@/seed/perLab/lab14';
import { applyLab15Seed } from '@/seed/perLab/lab15';
import { applyLab16Seed } from '@/seed/perLab/lab16';
import { applyLab17Seed } from '@/seed/perLab/lab17';
import { applyLab18Seed } from '@/seed/perLab/lab18';
import { applyLab19Seed } from '@/seed/perLab/lab19';
import { applyLab20Seed } from '@/seed/perLab/lab20';
import { applyLab21Seed } from '@/seed/perLab/lab21';
import { applyLab22Seed } from '@/seed/perLab/lab22';
import { applyLab23Seed } from '@/seed/perLab/lab23';
import { applyLab24Seed } from '@/seed/perLab/lab24';
import { applyLab25Seed } from '@/seed/perLab/lab25';
import { applyLab26Seed } from '@/seed/perLab/lab26';

export interface SeedContext {
  dir: MockDirectory;
  idp: MockIdP;
  apps: MockAppServer;
  tickets: MockTicketQueue;
  reviews: MockAccessReviews;
  incidents: MockIncidents;
  oauthGrants: MockOAuthGrants;
  cloudRoles: MockCloudRoles;
  audit: MockAuditLog;
  /** Current lab being seeded. Lets batch templates recover the ticket IDs
   *  stored on the lab object during generation. Optional. */
  _currentLab?: Lab;
}

export type SeedFn = (ctx: SeedContext) => void;

const SEEDS: Record<string, SeedFn> = {
  baseline: (ctx) => applyBaseline(ctx.dir, ctx.idp, ctx.apps),
  lab01: (ctx) => applyLab01Seed(ctx.dir, ctx.idp, ctx.apps),
  lab02: (ctx) => applyLab02Seed(ctx.dir, ctx.idp, ctx.apps, ctx.tickets),
  lab03: (ctx) => applyLab03Seed(ctx.dir, ctx.idp, ctx.apps, ctx.tickets),
  lab04: (ctx) => applyLab04Seed(ctx.dir, ctx.idp, ctx.apps),
  lab05: (ctx) => applyLab05Seed(ctx.dir, ctx.idp, ctx.apps, ctx.tickets),
  lab06: (ctx) => applyLab06Seed(ctx.dir, ctx.idp, ctx.apps, ctx.reviews),
  lab07: (ctx) => applyLab07Seed(ctx.dir, ctx.idp, ctx.apps, ctx.incidents),
  lab08: (ctx) => applyLab08Seed(ctx.dir, ctx.idp, ctx.apps, ctx.incidents, ctx.audit),
  lab09: (ctx) => applyLab09Seed(ctx.dir, ctx.idp, ctx.apps),
  lab10: (ctx) => applyLab10Seed(ctx.dir, ctx.idp, ctx.apps, ctx.tickets, ctx.reviews),
  lab11: (ctx) => applyLab11Seed(ctx.dir, ctx.idp, ctx.apps, ctx.tickets),
  lab12: (ctx) => applyLab12Seed(ctx.dir, ctx.idp, ctx.apps, ctx.tickets),
  lab13: (ctx) => applyLab13Seed(ctx.dir, ctx.idp, ctx.apps, ctx.tickets),
  lab14: (ctx) => applyLab14Seed(ctx.dir, ctx.idp, ctx.apps, ctx.oauthGrants),
  lab15: (ctx) => applyLab15Seed(ctx.dir, ctx.idp, ctx.apps),
  lab16: (ctx) => applyLab16Seed(ctx.dir, ctx.idp, ctx.apps),
  lab17: (ctx) => applyLab17Seed(ctx.dir, ctx.idp, ctx.apps, ctx.cloudRoles),
  lab18: (ctx) => applyLab18Seed(ctx.dir, ctx.idp, ctx.apps),
  lab19: (ctx) => applyLab19Seed(ctx.dir, ctx.idp, ctx.apps),
  lab20: (ctx) => applyLab20Seed(ctx.dir, ctx.idp, ctx.apps, ctx.audit),
  lab21: (ctx) => applyLab21Seed(ctx.dir, ctx.idp, ctx.apps),
  lab22: (ctx) => applyLab22Seed(ctx.dir, ctx.idp, ctx.apps),
  lab23: (ctx) => applyLab23Seed(ctx.dir, ctx.idp, ctx.apps),
  lab24: (ctx) => applyLab24Seed(ctx.dir, ctx.idp, ctx.apps),
  lab25: (ctx) => applyLab25Seed(ctx.dir, ctx.idp, ctx.apps),
  lab26: (ctx) => applyLab26Seed(ctx.dir, ctx.idp, ctx.apps),
};

/**
 * Register (or overwrite) one seed function by key — used by the
 * AI-generated-lab templates so each generated lab can seed baseline plus its
 * own small extra setup without the conductor knowing about any of them.
 */
export function registerLabSeed(key: string, fn: SeedFn): void {
  SEEDS[key] = fn;
}

/** Look up a seed by key, falling back to the baseline seed. */
export function getSeed(key: string): SeedFn {
  return SEEDS[key] ?? SEEDS['baseline']!;
}
