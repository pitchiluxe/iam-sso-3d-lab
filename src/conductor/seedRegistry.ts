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

export interface SeedContext {
  dir: MockDirectory;
  idp: MockIdP;
  apps: MockAppServer;
  tickets: MockTicketQueue;
  reviews: MockAccessReviews;
  incidents: MockIncidents;
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
  lab10: (ctx) => applyLab10Seed(ctx.dir, ctx.idp, ctx.apps, ctx.tickets),
  lab11: (ctx) => applyLab11Seed(ctx.dir, ctx.idp, ctx.apps, ctx.tickets),
  lab12: (ctx) => applyLab12Seed(ctx.dir, ctx.idp, ctx.apps, ctx.tickets),
  lab13: (ctx) => applyLab13Seed(ctx.dir, ctx.idp, ctx.apps, ctx.tickets),
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
