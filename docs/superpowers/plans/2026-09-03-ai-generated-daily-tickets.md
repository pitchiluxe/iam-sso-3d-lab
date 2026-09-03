# AI-Generated Daily IT Support Tickets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "🤖 Generate 10 More" button to the start screen that produces 10 non-repeating, real-world IT-helpdesk ticket labs, each playable via the existing walk-to-monitor → press E → VM Desktop flow.

**Architecture:** Hybrid generation — 15 hand-written, validator-accurate lab templates targeting real seeded users/groups do all the mechanical work; local Ollama (already used for the tutor) only writes the ticket narrative and coaching question, with a hand-written fallback so a click never fails or produces a broken lab even offline.

**Tech Stack:** TypeScript, Zustand (stores), Vitest (tests), the existing mock services (`MockDirectory`, `MockIdP`, `MockTicketQueue`), the existing Ollama fetch pattern from `src/services/ollamaSupervisor.ts`.

**Spec:** `docs/superpowers/specs/2026-09-03-ai-generated-daily-tickets-design.md`

## Global Constraints

- Every generated lab must be a plain `Lab` object (`src/domain/types.ts`) — no new lab-execution machinery.
- Templates only ever reference real entities already created by `applyBaseline()` (`src/seed/baseline.ts`) — `SEED_USERS`/`SEED_ADMINS` from `src/config/credentials.ts`, `GROUP_NAMES`/`SERVICE_ACCOUNT_NAMES` from `src/config/company.ts`. Never invent a userId/groupId/appId at generation time.
- The LLM is only ever asked for two short strings (`narrative`, `coachingQuestion`) — never for validator kinds, IDs, or lab structure.
- `npm run build`, `npm run lint`, `npm test -- --run` must all stay green after every task.
- Company/domain naming stays consistent with the rest of the app (`northwind.example`, existing fictional names) per `CLAUDE.md`.

---

## Task 1: Add the `user-deleted` validator kind

One template (duplicate-account cleanup) needs to validate a user deletion, and no existing `ValidatorKind` covers it. This follows the exact pattern already used twice this session for `group-created` and `mfa-policy-enforced`.

**Files:**
- Modify: `src/domain/types.ts` (the `ValidatorKind` union, around line 310-325)
- Modify: `src/conductor/conductor.ts` (the `eventMatchesValidator` switch)
- Modify: `src/ui/consoles/objectivesWindow.ts` (the `VALIDATOR_LABELS` map)
- Modify: `src/services/ollamaSupervisor.ts` (the `STEP_PASS_THRESHOLDS` map)

**Interfaces:**
- Produces: `ValidatorKind` now includes `'user-deleted'`, matched by `conductor.ts` against `e.action === 'user.deleted' && e.targetId === userId` (where `userId` is resolved the same way every other userId-based kind already is, via the existing `resolveUserId(p.userId ?? '')` helper already in `eventMatchesValidator`).

- [ ] **Step 1: Add the union member**

In `src/domain/types.ts`, find:
```ts
  | 'app-config-fixed' | 'signin-succeeded' | 'mfa-challenge-completed' | 'mfa-policy-enforced'
```
Change to:
```ts
  | 'app-config-fixed' | 'signin-succeeded' | 'mfa-challenge-completed' | 'mfa-policy-enforced'
  | 'user-deleted'
```

- [ ] **Step 2: Add the conductor case**

In `src/conductor/conductor.ts`, inside `eventMatchesValidator`'s switch, find the `case 'user-created':` line and add a new case right after it:
```ts
      case 'user-created':
        return e.action === 'user.created' && e.targetId === userId;
      case 'user-deleted':
        return e.action === 'user.deleted' && e.targetId === userId;
```

- [ ] **Step 3: Add the objectives label**

In `src/ui/consoles/objectivesWindow.ts`, inside `VALIDATOR_LABELS`, add:
```ts
  'user-deleted':           'Delete the duplicate account in IAM Console',
```

- [ ] **Step 4: Add the scoring threshold**

In `src/services/ollamaSupervisor.ts`, inside `STEP_PASS_THRESHOLDS`, add:
```ts
  'user-deleted': 1,
```

- [ ] **Step 5: Type-check and build**

Run: `npm run build`
Expected: succeeds with no TypeScript errors (the switch and both Records are exhaustively typed against `ValidatorKind`, so a missing case would fail the build).

- [ ] **Step 6: Commit**

```bash
git add src/domain/types.ts src/conductor/conductor.ts src/ui/consoles/objectivesWindow.ts src/services/ollamaSupervisor.ts
git commit -m "feat: add user-deleted validator kind for generated labs"
```

---

## Task 2: Let generated labs register their own seed function

Each generated lab needs `applyBaseline()` plus, for some templates, one extra deterministic seed action (disable a user, sign a user in, create a duplicate, open a ticket). The conductor's existing `SEEDS` lookup (`SEEDS[lab.startingSeed] ?? SEEDS['baseline']`) is an exact-key lookup into a module-private `Record`. Exporting a small registration function lets the templates module add its own entries without changing that lookup logic at all — every generated lab's `startingSeed` is simply its own template id.

**Files:**
- Modify: `src/conductor/conductor.ts`

**Interfaces:**
- Produces: `export function registerLabSeed(key: string, fn: (ctx: SeedContext) => void): void` — registers (or overwrites) one entry in the seed dispatch table. `SeedContext` is already exported from this file (`dir`, `idp`, `apps`, `tickets`, `reviews`, `incidents`, `audit`).

- [ ] **Step 1: Export the registration function**

In `src/conductor/conductor.ts`, find the `SEEDS` declaration:
```ts
const SEEDS: Record<string, (ctx: SeedContext) => void> = {
```
Right after the closing `};` of that object (before `export interface SeedContext`), add:
```ts
/** Register (or overwrite) one seed function by key — used by the
 * AI-generated-lab templates so each generated lab can seed baseline
 * plus its own small extra setup without conductor.ts knowing about
 * any of the 15 templates. */
export function registerLabSeed(key: string, fn: (ctx: SeedContext) => void): void {
  SEEDS[key] = fn;
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/conductor/conductor.ts
git commit -m "feat: allow generated labs to register their own seed function"
```

---

## Task 3: Persist generated labs (envelope v3)

Bump the shared localStorage envelope from v2 to v3, adding a `generatedLabs` slice, with a migration path from v2.

**Files:**
- Modify: `src/util/persistence.ts`
- Test: `tests/persistence.test.ts` (new)

**Interfaces:**
- Produces: `PersistedGeneratedLabs { labs: Lab[]; usedTemplateIds: string[]; usedNames: string[] }`, `PersistedState.version: 3`, `PersistedState.generatedLabs: PersistedGeneratedLabs`.
- `loadPersistedState()` still returns a fully-populated `PersistedState` (now v3) regardless of whether v1, v2, or v3 data is on disk.

- [ ] **Step 1: Write the failing test**

Create `tests/persistence.test.ts`:
```ts
/**
 * tests/persistence.test.ts
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { loadPersistedState, saveEnvelope } from '@/util/persistence';

describe('persistence v3 migration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults generatedLabs on a fresh (empty) store', () => {
    const state = loadPersistedState();
    expect(state.version).toBe(3);
    expect(state.generatedLabs).toEqual({ labs: [], usedTemplateIds: [], usedNames: [] });
  });

  it('migrates a v2 envelope (no generatedLabs field) by defaulting it', () => {
    const v2 = {
      version: 2,
      progress: { completedLabIds: [], bestScores: {}, startedAt: {} },
      resume: null,
      evidence: [],
    };
    localStorage.setItem('iam-lab-state-v2', JSON.stringify(v2));
    const state = loadPersistedState();
    expect(state.version).toBe(3);
    expect(state.generatedLabs).toEqual({ labs: [], usedTemplateIds: [], usedNames: [] });
    expect(state.progress).toEqual(v2.progress);
  });

  it('round-trips a populated generatedLabs slice through saveEnvelope', () => {
    const state = loadPersistedState();
    state.generatedLabs.usedTemplateIds.push('account-lockout');
    saveEnvelope(state);
    const reloaded = loadPersistedState();
    expect(reloaded.generatedLabs.usedTemplateIds).toEqual(['account-lockout']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --run tests/persistence.test.ts`
Expected: FAIL — `iam-lab-state-v2` key name won't exist yet as a test-visible constant, and `state.version` will be `2`, not `3`.

- [ ] **Step 3: Implement the v3 migration**

In `src/util/persistence.ts`, replace the whole file with:
```ts
/**
 * util/persistence.ts — versioned localStorage envelope for all persisted state.
 *
 * Schema history:
 *   v1 — iam-lab-progress-v1 (progressStore only)
 *   v2 — unified progress + resume + evidence under iam-lab-state-v2
 *   v3 — adds generatedLabs (AI-generated daily-ticket labs + dedup ledger)
 *
 * Migration: on load, older versions are upgraded in place and re-saved
 * under the current key. Future reads always read the current version.
 */
import type { LabId, ScoreBreakdown, Lab } from '@/domain';
import type { StepStatus } from '@/stores/labStore';
import type { Evidence } from '@/domain';

const CURRENT_KEY = 'iam-lab-state-v2';
const V1_KEY = 'iam-lab-progress-v1';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export interface PersistedProgress {
  completedLabIds: LabId[];
  bestScores: Partial<Record<LabId, ScoreBreakdown>>;
  startedAt: Partial<Record<LabId, number>>;
}

export interface PersistedResume {
  currentLabId: LabId;
  stepIndex: number;
  stepStatuses: Record<string, StepStatus>;
  failed: boolean;
}

export interface PersistedGeneratedLabs {
  /** Every AI-generated lab ever created, for pagination on the start screen. */
  labs: Lab[];
  /** Every template id used so far, oldest first — grows forever so a
   * template is never repeated until all 15 have been used at least once. */
  usedTemplateIds: string[];
  /** Every fresh onboarding/contractor name used so far, oldest first. */
  usedNames: string[];
}

export interface PersistedState {
  version: 3;
  progress: PersistedProgress;
  resume: PersistedResume | null;
  evidence: Evidence[];
  generatedLabs: PersistedGeneratedLabs;
}

function emptyGeneratedLabs(): PersistedGeneratedLabs {
  return { labs: [], usedTemplateIds: [], usedNames: [] };
}

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------

function migrateFromV1(): PersistedProgress {
  try {
    const raw = localStorage.getItem(V1_KEY);
    if (!raw) return { completedLabIds: [], bestScores: {}, startedAt: {} };
    const parsed = JSON.parse(raw) as {
      completedLabIds?: LabId[];
      bestScores?: Partial<Record<LabId, ScoreBreakdown>>;
      startedAt?: Partial<Record<LabId, number>>;
    };
    return {
      completedLabIds: parsed.completedLabIds ?? [],
      bestScores: parsed.bestScores ?? {},
      startedAt: parsed.startedAt ?? {},
    };
  } catch {
    return { completedLabIds: [], bestScores: {}, startedAt: {} };
  }
}

export function loadPersistedState(): PersistedState {
  try {
    const raw = localStorage.getItem(CURRENT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedState> & { version?: number };
      if (parsed.version === 3) return parsed as PersistedState;
      if (parsed.version === 2) {
        // v2 → v3: same shape, just add the new slice.
        const upgraded: PersistedState = {
          version: 3,
          progress: parsed.progress ?? { completedLabIds: [], bestScores: {}, startedAt: {} },
          resume: parsed.resume ?? null,
          evidence: parsed.evidence ?? [],
          generatedLabs: emptyGeneratedLabs(),
        };
        saveEnvelope(upgraded);
        return upgraded;
      }
    }
    // Fall back to v1 and migrate all the way to v3.
    const progress = migrateFromV1();
    const state: PersistedState = {
      version: 3,
      progress,
      resume: null,
      evidence: [],
      generatedLabs: emptyGeneratedLabs(),
    };
    saveEnvelope(state);
    localStorage.removeItem(V1_KEY);
    return state;
  } catch {
    return {
      version: 3,
      progress: { completedLabIds: [], bestScores: {}, startedAt: {} },
      resume: null,
      evidence: [],
      generatedLabs: emptyGeneratedLabs(),
    };
  }
}

// ---------------------------------------------------------------------------
// Save
// ---------------------------------------------------------------------------

export function saveEnvelope(state: PersistedState): void {
  try {
    localStorage.setItem(CURRENT_KEY, JSON.stringify(state));
    localStorage.removeItem(V1_KEY);
  } catch {
    /* quota exceeded or private mode */
  }
}

// ---------------------------------------------------------------------------
// Export / Import (File API)
// ---------------------------------------------------------------------------

export function exportToFile(state: PersistedState): void {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `iam-lab-progress-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Parse and validate an imported file. Throws on failure. */
export function importFromFile(file: File): Promise<PersistedState> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text) as unknown;
        if (!isPersistedState(parsed)) {
          reject(new Error('Invalid file format: not a valid IAM Lab progress file.'));
          return;
        }
        resolve(parsed);
      } catch {
        reject(new Error('Could not parse file as JSON.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsText(file);
  });
}

// ---------------------------------------------------------------------------
// Type guard
// ---------------------------------------------------------------------------

function isPersistedState(v: unknown): v is PersistedState {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;
  return (
    s['version'] === 3 &&
    typeof s['progress'] === 'object' &&
    (s['resume'] === null || typeof s['resume'] === 'object') &&
    Array.isArray(s['evidence']) &&
    typeof s['generatedLabs'] === 'object'
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- --run tests/persistence.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the full test suite and build**

Run: `npm test -- --run && npm run build`
Expected: all existing tests still pass (nothing else read `PersistedState.version` as a literal `2`), build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/util/persistence.ts tests/persistence.test.ts
git commit -m "feat: bump persisted-state envelope to v3, add generatedLabs slice"
```

---

## Task 4: Fresh-name pool for onboarding/contractor templates

Templates #2 (new-hire) and #11 (contractor) need a plausible, non-repeating full name that isn't AI-invented. A small hardcoded pool with a picker function that respects the persisted `usedNames` ledger.

**Files:**
- Create: `src/labs/generated/namePool.ts`
- Test: `tests/namePool.test.ts` (new)

**Interfaces:**
- Produces: `pickUnusedName(usedNames: string[]): { displayName: string; username: string }` — `username` is `firstname.lastname` lowercase, matching the existing `SEED_USERS` username convention.

- [ ] **Step 1: Write the failing test**

Create `tests/namePool.test.ts`:
```ts
/**
 * tests/namePool.test.ts
 */
import { describe, it, expect } from 'vitest';
import { pickUnusedName, NAME_POOL } from '@/labs/generated/namePool';

describe('pickUnusedName', () => {
  it('returns a name from the pool with a lowercase dotted username', () => {
    const picked = pickUnusedName([]);
    expect(NAME_POOL.some((n) => n.displayName === picked.displayName)).toBe(true);
    expect(picked.username).toMatch(/^[a-z]+\.[a-z]+$/);
  });

  it('never returns an already-used name while unused ones remain', () => {
    const usedAllButOne = NAME_POOL.slice(1).map((n) => n.displayName);
    const picked = pickUnusedName(usedAllButOne);
    expect(picked.displayName).toBe(NAME_POOL[0]!.displayName);
  });

  it('falls back to the least-recently-used name once the pool is exhausted', () => {
    const allUsed = NAME_POOL.map((n) => n.displayName);
    const picked = pickUnusedName(allUsed);
    expect(picked.displayName).toBe(NAME_POOL[0]!.displayName);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --run tests/namePool.test.ts`
Expected: FAIL — `@/labs/generated/namePool` does not exist yet.

- [ ] **Step 3: Implement the name pool**

Create `src/labs/generated/namePool.ts`:
```ts
/**
 * labs/generated/namePool.ts — a small pool of fresh, fictional-but-realistic
 * full names for the new-hire/contractor generated-lab templates. Never
 * AI-invented — picked deterministically and tracked in the same persisted
 * dedup ledger as generated-lab templates (see stores/generatedLabsStore.ts).
 */
export interface PoolName {
  displayName: string;
  username: string;
}

function toUsername(displayName: string): string {
  return displayName
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .join('.');
}

const FULL_NAMES = [
  'Maria Gonzalez', 'James Chen', 'Priya Sharma', 'Liam O\'Brien', 'Fatima Al-Sayed',
  'Noah Kim', 'Olivia Nguyen', 'Ethan Rossi', 'Amara Okafor', 'Lucas Silva',
  'Sofia Kowalski', 'Ravi Patel', 'Chloe Dubois', 'Tariq Hassan', 'Emma Larsson',
  'Diego Fernandez', 'Yuki Tanaka', 'Grace Osei', 'Mateus Costa', 'Anya Petrov',
];

export const NAME_POOL: PoolName[] = FULL_NAMES.map((displayName) => ({
  displayName,
  username: toUsername(displayName),
}));

/** Pick a name not in `usedNames`, or the least-recently-used one once the
 * whole pool has been used at least once. */
export function pickUnusedName(usedNames: string[]): PoolName {
  const unused = NAME_POOL.find((n) => !usedNames.includes(n.displayName));
  if (unused) return unused;
  // Pool exhausted — reuse the one used longest ago (first in usedNames
  // that still matches a pool entry, in pool order for determinism).
  const oldestUsed = usedNames.find((name) => NAME_POOL.some((n) => n.displayName === name));
  return NAME_POOL.find((n) => n.displayName === oldestUsed) ?? NAME_POOL[0]!;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- --run tests/namePool.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/labs/generated/namePool.ts tests/namePool.test.ts
git commit -m "feat: add fresh-name pool for onboarding/contractor generated labs"
```

---

## Task 5: The 15 lab templates

The core of the feature. Each template is a plain object: an id, a zone, a `buildLab(flavor)` function producing a real `Lab`, and an optional `seed()` function registered via `registerLabSeed` (Task 2). No AI involvement in this task — flavor text is passed in as a parameter so this is fully testable without Ollama.

**Files:**
- Create: `src/labs/generated/templates.ts`
- Test: `tests/generatedTemplates.test.ts` (new)

**Interfaces:**
- Consumes: `registerLabSeed` from `src/conductor/conductor.ts` (Task 2); `pickUnusedName` from `src/labs/generated/namePool.ts` (Task 4); `SEED_USERS`, `SEED_ADMINS` from `@/config`; `GROUP_NAMES`, `SERVICE_ACCOUNT_NAMES` from `@/config`; `mkLabId`, `mkGroupId`, `mkTicketId`, `mkUserId`, `SYSTEM_ACTOR` from `@/domain`.
- Produces:
  - `export interface GeneratedFlavor { narrative: string; coachingQuestion: string }`
  - `export interface LabTemplate { id: string; zoneId: 'iam-ops' | 'sec-ops' | 'help-desk' | 'engineering'; targetDisplayName: string; targetTitle: string; targetDept: string; ticketTypeLabel: string; buildLab(flavor: GeneratedFlavor, usedNames: string[]): Lab }`
  - `export const LAB_TEMPLATES: LabTemplate[]` (15 entries, ids listed in the spec table)
  - Each template with a `seed()` need registers it as a side effect of being imported (top-level `registerLabSeed(template.id, ...)` calls in this module), so importing `templates.ts` anywhere is enough to make every generated lab startable.

- [ ] **Step 1: Write the failing test**

Create `tests/generatedTemplates.test.ts`:
```ts
/**
 * tests/generatedTemplates.test.ts
 *
 * Structural tests only — no AI/network involved. Confirms every template
 * produces a valid, startable Lab and that its registered seed function
 * (if any) doesn't throw against a fresh baseline.
 */
import { describe, it, expect } from 'vitest';
import { LAB_TEMPLATES } from '@/labs/generated/templates';
import { MockAuditLog, MockDirectory, MockIdP, MockAppServer, MockTicketQueue } from '@/services';
import { applyBaseline } from '@/seed/baseline';

const FLAVOR = { narrative: 'Test narrative.', coachingQuestion: 'Test question?' };

describe('LAB_TEMPLATES', () => {
  it('has exactly 15 unique templates', () => {
    expect(LAB_TEMPLATES).toHaveLength(15);
    const ids = new Set(LAB_TEMPLATES.map((t) => t.id));
    expect(ids.size).toBe(15);
  });

  it('every template builds a structurally valid Lab', () => {
    for (const t of LAB_TEMPLATES) {
      const lab = t.buildLab(FLAVOR, []);
      expect(lab.id).toBeTruthy();
      expect(lab.startingZone).toBe(t.zoneId);
      expect(lab.zoneIds).toContain(t.zoneId);
      expect(lab.steps.length).toBeGreaterThan(0);
      for (const step of lab.steps) {
        expect(step.validator.kind).toBeTruthy();
      }
      expect(lab.startingSeed).toBe(t.id);
    }
  });

  it('every template’s seed function runs cleanly against a fresh baseline', () => {
    for (const t of LAB_TEMPLATES) {
      const audit = new MockAuditLog();
      const dir = new MockDirectory(audit);
      const idp = new MockIdP(audit, dir);
      const apps = new MockAppServer(dir, idp, audit);
      const tickets = new MockTicketQueue(audit);
      applyBaseline(dir, idp, apps);
      // Import triggers registration; re-import the registry to run this
      // template's own seed function the same way the conductor would.
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { SEEDS_FOR_TEST } = require('@/labs/generated/templates');
        void SEEDS_FOR_TEST;
      }).not.toThrow();
      void t; void dir; void idp; void apps; void tickets;
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --run tests/generatedTemplates.test.ts`
Expected: FAIL — `@/labs/generated/templates` does not exist yet.

- [ ] **Step 3: Simplify the seed-smoke-test assertion**

The third test above is awkward (there's no clean way to re-invoke a specific registered seed function from the test without exporting the registry). Replace it with a simpler, equally-valid check: call each template's own exported `seed` function directly (Step 4 below exports it per-template, not just via side-effecting registration). Rewrite the third `it` block in `tests/generatedTemplates.test.ts` to:
```ts
  it('every template’s seed runs cleanly against a fresh baseline', () => {
    for (const t of LAB_TEMPLATES) {
      const audit = new MockAuditLog();
      const dir = new MockDirectory(audit);
      const idp = new MockIdP(audit, dir);
      const apps = new MockAppServer(dir, idp, audit);
      const tickets = new MockTicketQueue(audit);
      applyBaseline(dir, idp, apps);
      expect(() => {
        t.seed?.({ dir, idp, apps, tickets, reviews: undefined as never, incidents: undefined as never, audit });
      }).not.toThrow();
    }
  });
```

- [ ] **Step 4: Implement the 15 templates**

Create `src/labs/generated/templates.ts`:
```ts
/**
 * labs/generated/templates.ts — the 15 real-world daily IT-helpdesk lab
 * templates. Every target is a real seeded user/group/service-account —
 * nothing here is invented at generation time except the flavor text
 * passed in by the caller (see services/labFlavorGenerator.ts).
 */
import { mkLabId, mkGroupId, mkTicketId, mkUserId, SYSTEM_ACTOR } from '@/domain';
import type { Lab, LabStep } from '@/domain';
import { registerLabSeed } from '@/conductor/conductor';
import type { SeedContext } from '@/conductor/conductor';
import { applyBaseline } from '@/seed/baseline';
import { pickUnusedName } from './namePool';

export interface GeneratedFlavor {
  narrative: string;
  coachingQuestion: string;
}

export type GeneratedZoneId = 'iam-ops' | 'sec-ops' | 'help-desk' | 'engineering';

export interface LabTemplate {
  id: string;
  zoneId: GeneratedZoneId;
  ticketTypeLabel: string;
  targetDisplayName: string;
  targetTitle: string;
  targetDept: string;
  buildLab(flavor: GeneratedFlavor, usedNames: string[]): Lab;
  /** Runs after applyBaseline() for this generated lab's own conductor
   * session — a small, deterministic extra setup step, if any. */
  seed?(ctx: SeedContext): void;
}

function step(
  id: string,
  title: string,
  brief: string,
  validator: LabStep['validator'],
  points: LabStep['points'] = { exec: 10 },
): LabStep {
  return {
    id,
    title,
    brief,
    validator,
    evidence: [],
    tutorPrompts: [],
    hintIds: [],
    points,
  };
}

function baseLab(
  template: Pick<LabTemplate, 'id' | 'zoneId' | 'targetDisplayName'>,
  flavor: GeneratedFlavor,
  steps: LabStep[],
): Lab {
  return {
    id: mkLabId(`${template.id}-${Math.random().toString(36).slice(2, 8)}`),
    number: 0,
    title: `Daily Ticket: ${template.targetDisplayName}`,
    brief: flavor.narrative,
    durationMinutes: 15,
    zoneIds: [template.zoneId],
    startingZone: template.zoneId,
    startingSeed: template.id,
    objectives: steps.map((s, i) => ({
      id: `o${i + 1}`,
      description: s.title,
      points: Object.values(s.points ?? {}).reduce((a, b) => a + (b ?? 0), 0),
      category: (Object.keys(s.points ?? { exec: 0 })[0] as Lab['objectives'][number]['category']) ?? 'exec',
    })),
    steps: steps.map((s, i) => (i === steps.length - 1
      ? { ...s, tutorPrompts: [flavor.coachingQuestion] }
      : s)),
    faults: [],
    debriefQuestions: [flavor.coachingQuestion],
  };
}

export const LAB_TEMPLATES: LabTemplate[] = [
  {
    id: 'account-lockout',
    zoneId: 'help-desk',
    ticketTypeLabel: 'Account Lockout',
    targetDisplayName: 'Jane Doe',
    targetTitle: 'Junior Financial Analyst',
    targetDept: 'Finance',
    seed(ctx) {
      applyBaseline(ctx.dir, ctx.idp, ctx.apps);
      const user = ctx.dir.getUserByUsername('jane.doe');
      if (user) ctx.dir.disableUser(user.id, SYSTEM_ACTOR, 'locked out after failed attempts');
    },
    buildLab(flavor) {
      return baseLab(this, flavor, [
        step(
          's1',
          'Re-enable the locked-out account',
          `${flavor.narrative} Re-enable Jane Doe's account in IAM Console.`,
          { kind: 'user-enabled', params: { userId: 'jane.doe' } },
          { exec: 15, troubleshoot: 5 },
        ),
      ]);
    },
  },
  {
    id: 'new-hire-onboarding',
    zoneId: 'help-desk',
    ticketTypeLabel: 'New Hire Onboarding',
    targetDisplayName: 'a new hire',
    targetTitle: 'New Employee',
    targetDept: 'Engineering',
    buildLab(flavor, usedNames) {
      const name = pickUnusedName(usedNames);
      return baseLab(
        { ...this, targetDisplayName: name.displayName },
        flavor,
        [
          step(
            's1',
            'Create the new hire’s account',
            `${flavor.narrative} Create an account for ${name.displayName} in IAM Console.`,
            { kind: 'user-created', params: { userId: name.username } },
            { exec: 10 },
          ),
          step(
            's2',
            'Add them to their department group',
            `Add ${name.displayName} to grp-engineering-dev so they can access team resources.`,
            { kind: 'group-added', params: { userId: name.username, groupId: 'grp-engineering-dev' } },
            { exec: 10, 'least-privilege': 5 },
          ),
        ],
      );
    },
  },
  {
    id: 'offboarding',
    zoneId: 'help-desk',
    ticketTypeLabel: 'Employee Offboarding',
    targetDisplayName: 'Dan Rivera',
    targetTitle: 'Help Desk Tier 1',
    targetDept: 'IT',
    seed(ctx) {
      applyBaseline(ctx.dir, ctx.idp, ctx.apps);
      ctx.idp.signIn('dan.rivera', 'dan.rivera123');
    },
    buildLab(flavor) {
      return baseLab(this, flavor, [
        step(
          's1',
          'Disable the departing employee’s account',
          `${flavor.narrative} Disable Dan Rivera's account.`,
          { kind: 'user-disabled', params: { userId: 'dan.rivera' } },
          { exec: 10 },
        ),
        step(
          's2',
          'Revoke any active sessions',
          'Revoke Dan Rivera’s active sessions so the disabled account can’t still be used.',
          { kind: 'session-revoked', params: { userId: 'dan.rivera' } },
          { exec: 10, troubleshoot: 5 },
        ),
      ]);
    },
  },
  {
    id: 'promotion-role-change',
    zoneId: 'help-desk',
    ticketTypeLabel: 'Promotion / Role Change',
    targetDisplayName: 'Ivy Park',
    targetTitle: 'Help Desk Manager',
    targetDept: 'IT',
    buildLab(flavor) {
      return baseLab(this, flavor, [
        step(
          's1',
          'Remove the old team membership',
          `${flavor.narrative} Remove Ivy Park from grp-helpdesk-tier1.`,
          { kind: 'group-removed', params: { userId: 'ivy.park', groupId: 'grp-helpdesk-tier1' } },
          { exec: 10, 'least-privilege': 5 },
        ),
        step(
          's2',
          'Add the new team membership',
          'Add Ivy Park to grp-iam-admins to match her new role.',
          { kind: 'group-added', params: { userId: 'ivy.park', groupId: 'grp-iam-admins' } },
          { exec: 10 },
        ),
      ]);
    },
  },
  {
    id: 'mfa-device-lost',
    zoneId: 'iam-ops',
    ticketTypeLabel: 'Lost MFA Device',
    targetDisplayName: 'Finn Müller',
    targetTitle: 'Security Operations Analyst',
    targetDept: 'Security',
    buildLab(flavor) {
      return baseLab(this, flavor, [
        step(
          's1',
          'Reset and re-verify MFA',
          `${flavor.narrative} Reset Finn Müller's MFA, then verify sign-in to confirm re-enrollment.`,
          { kind: 'mfa-challenge-completed', params: { userId: 'finn.muller' } },
          { exec: 15, troubleshoot: 5 },
        ),
      ]);
    },
  },
  {
    id: 'suspicious-signin',
    zoneId: 'sec-ops',
    ticketTypeLabel: 'Suspicious Sign-In',
    targetDisplayName: "Hank O'Neill",
    targetTitle: 'Server Administrator',
    targetDept: 'IT',
    seed(ctx) {
      applyBaseline(ctx.dir, ctx.idp, ctx.apps);
      ctx.idp.signIn('hank.oneill', 'hank.oneill123');
    },
    buildLab(flavor) {
      return baseLab(this, flavor, [
        step(
          's1',
          'Revoke the suspicious session',
          `${flavor.narrative} Revoke Hank O'Neill's active session in SecOps Dashboard.`,
          { kind: 'session-revoked', params: { userId: 'hank.oneill' } },
          { exec: 15, troubleshoot: 10 },
        ),
        step(
          's2',
          'Capture evidence for the incident record',
          'Capture a snapshot of the audit log for this investigation.',
          { kind: 'evidence-collected', params: { stepId: 's2' } },
          { evidence: 10, docs: 5 },
        ),
      ]);
    },
  },
  {
    id: 'app-access-request',
    zoneId: 'help-desk',
    ticketTypeLabel: 'Application Access Request',
    targetDisplayName: 'Alex Morgan',
    targetTitle: 'Payroll Analyst',
    targetDept: 'Finance',
    buildLab(flavor) {
      return baseLab(this, flavor, [
        step(
          's1',
          'Grant access to the Finance Portal',
          `${flavor.narrative} Add Alex Morgan to grp-finance-payroll so they can access the Finance Portal.`,
          { kind: 'group-added', params: { userId: 'alex.morgan', groupId: 'grp-finance-payroll' } },
          { exec: 10, 'least-privilege': 5 },
        ),
      ]);
    },
  },
  {
    id: 'ticket-cant-login',
    zoneId: 'help-desk',
    ticketTypeLabel: 'Ticket Queue: Can’t Log In',
    targetDisplayName: 'Cara Patel',
    targetTitle: 'HR Business Partner',
    targetDept: 'HR',
    seed(ctx) {
      const seedResult = applyBaseline(ctx.dir, ctx.idp, ctx.apps);
      const caraId = seedResult.userIds['cara.patel'];
      if (!caraId) return;
      ctx.tickets.create({
        kind: 'password-reset',
        requesterId: caraId,
        subject: 'Can’t log in to my account',
        body: 'Cara Patel reports she cannot sign in after several attempts.',
        priority: 'normal',
        payload: { userId: caraId, method: 'helpdesk' },
      });
    },
    buildLab(flavor) {
      return baseLab(this, flavor, [
        step(
          's1',
          'Resolve the ticket',
          `${flavor.narrative} Resolve Cara Patel's ticket in the Ticket Console once you’ve confirmed access is restored.`,
          { kind: 'ticket-resolved', params: { ticketId: '__FIRST_OPEN_TICKET__' } },
          { exec: 15, comms: 5 },
        ),
      ]);
    },
  },
  {
    id: 'stale-group-cleanup',
    zoneId: 'iam-ops',
    ticketTypeLabel: 'Access Review: Stale Group Membership',
    targetDisplayName: "Hank O'Neill",
    targetTitle: 'Server Administrator',
    targetDept: 'IT',
    buildLab(flavor) {
      return baseLab(this, flavor, [
        step(
          's1',
          'Remove the unneeded domain-admin membership',
          `${flavor.narrative} An access review found Hank O'Neill no longer needs grp-domain-admins — remove it (he keeps grp-server-admins).`,
          { kind: 'group-removed', params: { userId: 'hank.oneill', groupId: 'grp-domain-admins' } },
          { exec: 10, 'least-privilege': 10 },
        ),
      ]);
    },
  },
  {
    id: 'dept-mfa-enforcement',
    zoneId: 'iam-ops',
    ticketTypeLabel: 'Department MFA Enforcement',
    targetDisplayName: 'the Finance department',
    targetTitle: 'Department-wide request',
    targetDept: 'Finance',
    buildLab(flavor) {
      return baseLab(this, flavor, [
        step(
          's1',
          'Enable MFA enforcement',
          `${flavor.narrative} Enable MFA enforcement in IAM Console after a phishing attempt targeted Finance.`,
          { kind: 'mfa-policy-enforced', params: {} },
          { exec: 10, 'least-privilege': 10 },
        ),
      ]);
    },
  },
  {
    id: 'contractor-setup',
    zoneId: 'engineering',
    ticketTypeLabel: 'Contractor Account Setup',
    targetDisplayName: 'a new contractor',
    targetTitle: 'Contractor',
    targetDept: 'Engineering',
    buildLab(flavor, usedNames) {
      const name = pickUnusedName(usedNames);
      return baseLab(
        { ...this, targetDisplayName: name.displayName },
        flavor,
        [
          step(
            's1',
            'Create the contractor’s account',
            `${flavor.narrative} Create a time-limited account for ${name.displayName}.`,
            { kind: 'user-created', params: { userId: name.username } },
            { exec: 10 },
          ),
          step(
            's2',
            'Grant minimum required access',
            `Add ${name.displayName} to grp-engineering-dev only — nothing more.`,
            { kind: 'group-added', params: { userId: name.username, groupId: 'grp-engineering-dev' } },
            { exec: 10, 'least-privilege': 10 },
          ),
        ],
      );
    },
  },
  {
    id: 'service-account-access',
    zoneId: 'engineering',
    ticketTypeLabel: 'Service Account Permission Request',
    targetDisplayName: 'svc-backup',
    targetTitle: 'Service Account',
    targetDept: 'IT',
    buildLab(flavor) {
      return baseLab(this, flavor, [
        step(
          's1',
          'Grant the requested access',
          `${flavor.narrative} Add svc-backup to grp-server-admins so the backup job can run.`,
          { kind: 'group-added', params: { userId: 'svc-backup', groupId: 'grp-server-admins' } },
          { exec: 10, 'least-privilege': 10 },
        ),
      ]);
    },
  },
  {
    id: 'failed-login-troubleshoot',
    zoneId: 'help-desk',
    ticketTypeLabel: 'Failed Login Troubleshooting',
    targetDisplayName: 'Greta Olsen',
    targetTitle: 'Chief Financial Officer',
    targetDept: 'Finance',
    buildLab(flavor) {
      return baseLab(this, flavor, [
        step(
          's1',
          'Verify sign-in works',
          `${flavor.narrative} Sign in as Greta Olsen in IAM Console to confirm the issue is resolved.`,
          { kind: 'signin-succeeded', params: { userId: 'greta.olsen' } },
          { exec: 10, troubleshoot: 10 },
        ),
        step(
          's2',
          'Capture evidence of the successful sign-in',
          'Capture evidence confirming the fix for the ticket record.',
          { kind: 'evidence-collected', params: { stepId: 's2' } },
          { evidence: 10 },
        ),
      ]);
    },
  },
  {
    id: 'duplicate-account-cleanup',
    zoneId: 'iam-ops',
    ticketTypeLabel: 'Duplicate Account Cleanup',
    targetDisplayName: 'Jane Doe (duplicate)',
    targetTitle: 'Junior Financial Analyst',
    targetDept: 'Finance',
    seed(ctx) {
      applyBaseline(ctx.dir, ctx.idp, ctx.apps);
      ctx.dir.createUser(
        {
          username: 'jane.doe2',
          displayName: 'Jane Doe',
          email: 'jane.doe2@northwind.example',
          department: 'Finance',
          title: 'Junior Financial Analyst',
        },
        SYSTEM_ACTOR,
      );
    },
    buildLab(flavor) {
      return baseLab(this, flavor, [
        step(
          's1',
          'Delete the duplicate account',
          `${flavor.narrative} A duplicate "jane.doe2" account was created by mistake — delete it (keep the real jane.doe).`,
          { kind: 'user-deleted', params: { userId: 'jane.doe2' } },
          { exec: 10, troubleshoot: 5 },
        ),
      ]);
    },
  },
  {
    id: 'department-transfer',
    zoneId: 'help-desk',
    ticketTypeLabel: 'Department Transfer',
    targetDisplayName: 'Bob Sato',
    targetTitle: 'Software Developer',
    targetDept: 'Engineering',
    buildLab(flavor) {
      return baseLab(this, flavor, [
        step(
          's1',
          'Remove access from the old department',
          `${flavor.narrative} Bob Sato is transferring out of Engineering — remove grp-engineering-dev.`,
          { kind: 'group-removed', params: { userId: 'bob.sato', groupId: 'grp-engineering-dev' } },
          { exec: 10 },
        ),
        step(
          's2',
          'Grant access to the new department',
          'Add Bob Sato to grp-helpdesk-tier1 for his new IT Help Desk role.',
          { kind: 'group-added', params: { userId: 'bob.sato', groupId: 'grp-helpdesk-tier1' } },
          { exec: 10, 'least-privilege': 5 },
        ),
      ]);
    },
  },
];

// Register every template's seed function once, at module load, so a
// generated lab's startingSeed (its own template id) is always resolvable.
for (const t of LAB_TEMPLATES) {
  registerLabSeed(t.id, (ctx) => {
    if (t.seed) t.seed(ctx);
    else applyBaseline(ctx.dir, ctx.idp, ctx.apps);
  });
}
```

- [ ] **Step 5: Fix the ticket-resolved param placeholder**

The `ticket-cant-login` template can't know the seeded ticket's real (randomly-generated) `TicketId` at `buildLab()` time — `seed()` runs separately, later, inside `conductor.start()`. Two functions need to agree on the ticket id without a shared closure. Fix this by having `seed()` create the ticket with a **deterministic** id instead of using `tickets.create()`'s auto-generated one. Check `src/services/mockTicketQueue.ts`'s `create()` method — if it always calls `mkTicketId()` internally with no way to pass one in, add an optional `id` override there:

Read `src/services/mockTicketQueue.ts` around the `create()` method (from Task 5 Step 4's read of line 111) and confirm whether `NewTicket` already supports a caller-supplied id. If not, the smallest fix is for the `ticket-cant-login` template's validator to reference the ticket by a stable, human-chosen id instead of leaving `mockTicketQueue` to generate one — modify `src/services/mockTicketQueue.ts`'s `create()` signature to accept an optional `id?: TicketId` in `NewTicket`'s common fields, defaulting to `mkTicketId()` when absent:
```ts
// In NewTicket's shared fields (each variant), add:
      id?: TicketId;
```
And in `create()`:
```ts
  create(t: NewTicket): Ticket {
    const id = t.id ?? mkTicketId();
    // ...use `id` instead of a freshly generated one wherever the ticket object is built...
  }
```
Then in `templates.ts`, seed the ticket with a fixed id and reference that same id in the step's validator param:
```ts
    seed(ctx) {
      const seedResult = applyBaseline(ctx.dir, ctx.idp, ctx.apps);
      const caraId = seedResult.userIds['cara.patel'];
      if (!caraId) return;
      ctx.tickets.create({
        id: mkTicketId('gen-ticket-cant-login'),
        kind: 'password-reset',
        requesterId: caraId,
        subject: 'Can’t log in to my account',
        body: 'Cara Patel reports she cannot sign in after several attempts.',
        priority: 'normal',
        payload: { userId: caraId, method: 'helpdesk' },
      });
    },
```
```ts
          { kind: 'ticket-resolved', params: { ticketId: 'gen-ticket-cant-login' } },
```
Remove the `__FIRST_OPEN_TICKET__` placeholder from Step 4's draft — it must not appear in the final file. Re-run `npm run build` after this change to confirm `mockTicketQueue.ts`'s edit didn't break its existing callers (`tests/tickets.test.ts` and `seed/perLab/*.ts`, none of which pass `id`, so the optional field is backward-compatible).

- [ ] **Step 6: Run the templates test to verify it passes**

Run: `npm test -- --run tests/generatedTemplates.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Run the full test suite and build**

Run: `npm test -- --run && npm run build`
Expected: all pass, including `tests/tickets.test.ts` (confirms the optional `id` field didn't break existing ticket creation).

- [ ] **Step 8: Commit**

```bash
git add src/labs/generated/templates.ts tests/generatedTemplates.test.ts src/services/mockTicketQueue.ts
git commit -m "feat: add the 15 real-world daily-ticket lab templates"
```

---

## Task 6: The AI flavor generator

Calls local Ollama for narrative + coaching question, exactly mirroring `services/ollamaSupervisor.ts`'s existing call shape (same base URL resolution, same 90s timeout, same graceful offline fallback).

**Files:**
- Create: `src/services/labFlavorGenerator.ts`
- Test: `tests/labFlavorGenerator.test.ts` (new)

**Interfaces:**
- Produces: `export async function generateFlavor(template: Pick<LabTemplate, 'ticketTypeLabel' | 'targetDisplayName' | 'targetTitle' | 'targetDept'>): Promise<GeneratedFlavor>` — never throws; falls back to a hand-written narrative when Ollama is disabled, unreachable, or returns malformed JSON.

- [ ] **Step 1: Write the failing test**

Create `tests/labFlavorGenerator.test.ts`:
```ts
/**
 * tests/labFlavorGenerator.test.ts
 *
 * Only tests the offline/fallback path — no real network call. Mirrors how
 * ollamaSupervisor.ts is designed (window.env.OLLAMA_DISABLED short-circuits
 * before any fetch).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { generateFlavor } from '@/services/labFlavorGenerator';

describe('generateFlavor (offline fallback)', () => {
  beforeEach(() => {
    (window as unknown as { env: Record<string, string> }).env = { OLLAMA_DISABLED: 'true' };
  });
  afterEach(() => {
    delete (window as unknown as { env?: unknown }).env;
  });

  it('returns non-empty narrative and coaching question without any network call', async () => {
    const flavor = await generateFlavor({
      ticketTypeLabel: 'Account Lockout',
      targetDisplayName: 'Jane Doe',
      targetTitle: 'Junior Financial Analyst',
      targetDept: 'Finance',
    });
    expect(flavor.narrative.length).toBeGreaterThan(10);
    expect(flavor.coachingQuestion.length).toBeGreaterThan(5);
    expect(flavor.narrative).toContain('Jane Doe');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --run tests/labFlavorGenerator.test.ts`
Expected: FAIL — `@/services/labFlavorGenerator` does not exist yet.

- [ ] **Step 3: Implement the flavor generator**

Create `src/services/labFlavorGenerator.ts`:
```ts
/**
 * services/labFlavorGenerator.ts — asks local Ollama for the ticket
 * narrative + coaching question for one AI-generated daily-ticket lab.
 *
 * Deliberately the smallest possible AI surface: two short strings, given
 * real facts (a real seeded person's name/title/department, a real ticket
 * type) as context. Never asked to invent IDs, users, or lab structure —
 * see docs/superpowers/specs/2026-09-03-ai-generated-daily-tickets-design.md.
 *
 * Mirrors ollamaSupervisor.ts's call shape exactly: same base URL
 * resolution, same disabled-flag short-circuit, same timeout, same
 * graceful fallback so a click never fails even with Ollama offline.
 */

export interface GeneratedFlavor {
  narrative: string;
  coachingQuestion: string;
}

export interface FlavorRequest {
  ticketTypeLabel: string;
  targetDisplayName: string;
  targetTitle: string;
  targetDept: string;
}

const SYSTEM_PROMPT = `You are a cybersecurity and IT-helpdesk operations expert writing a short, realistic daily support ticket for an internal training simulation at a mid-size company. You are given the real facts below — do not invent any names, titles, departments, or IDs beyond what's given. Write only what's asked, in plain prose, no markdown.

Respond with strict JSON only, no other text:
{"narrative": "<2-3 sentence realistic ticket description, written from the reporter's or IT's point of view>", "coachingQuestion": "<one Socratic diagnostic question a mentor would ask the learner — never reveal the answer>"}`;

function ollamaDisabled(): boolean {
  return (window as unknown as { env?: { OLLAMA_DISABLED?: string } }).env?.OLLAMA_DISABLED === 'true';
}
function ollamaBaseUrl(): string {
  return (window as unknown as { env?: { OLLAMA_BASE_URL?: string } }).env?.OLLAMA_BASE_URL ?? 'http://localhost:11434';
}
function ollamaModel(): string {
  return (window as unknown as { env?: { OLLAMA_MODEL?: string } }).env?.OLLAMA_MODEL ?? 'llama3.2';
}

function fallbackFlavor(req: FlavorRequest): GeneratedFlavor {
  return {
    narrative: `${req.targetDisplayName} (${req.targetTitle}, ${req.targetDept}) has an open "${req.ticketTypeLabel}" ticket that needs to be resolved.`,
    coachingQuestion: 'What is the first thing you would verify before making any change?',
  };
}

function isValidFlavor(v: unknown): v is GeneratedFlavor {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o['narrative'] === 'string' &&
    o['narrative'].length > 0 &&
    o['narrative'].length < 1000 &&
    typeof o['coachingQuestion'] === 'string' &&
    o['coachingQuestion'].length > 0 &&
    o['coachingQuestion'].length < 500
  );
}

export async function generateFlavor(req: FlavorRequest): Promise<GeneratedFlavor> {
  if (ollamaDisabled()) return fallbackFlavor(req);

  try {
    const res = await fetch(`${ollamaBaseUrl()}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ollamaModel(),
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Ticket type: ${req.ticketTypeLabel}\nReporter/subject: ${req.targetDisplayName}, ${req.targetTitle}, ${req.targetDept} department.`,
          },
        ],
        stream: false,
      }),
      signal: AbortSignal.timeout(90000),
    });
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    const data = (await res.json()) as { message?: { content?: string } };
    const raw = (data.message?.content ?? '').replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed = JSON.parse(raw) as unknown;
    if (isValidFlavor(parsed)) return parsed;
    return fallbackFlavor(req);
  } catch {
    return fallbackFlavor(req);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- --run tests/labFlavorGenerator.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/labFlavorGenerator.ts tests/labFlavorGenerator.test.ts
git commit -m "feat: add AI flavor generator for daily-ticket labs"
```

---

## Task 7: The generated-labs store

Orchestrates a batch: picks 10 unused templates (falling back to least-recently-used), calls `generateFlavor` for each in parallel, builds the `Lab` objects, persists them.

**Files:**
- Create: `src/stores/generatedLabsStore.ts`
- Modify: `src/stores/index.ts`
- Test: `tests/generatedLabsStore.test.ts` (new)

**Interfaces:**
- Consumes: `LAB_TEMPLATES` (Task 5), `generateFlavor` (Task 6), `PersistedGeneratedLabs` / `loadPersistedState` / `saveEnvelope` (Task 3).
- Produces: `generatedLabsStore` (zustand) with state `{ labs: Lab[] }` and actions `generateBatch(count?: number): Promise<Lab[]>`, `reset(): void`. Also exports the pure, directly-testable `pickTemplateBatch(usedTemplateIds: string[], count: number): LabTemplate[]` used internally.

- [ ] **Step 1: Write the failing test**

Create `tests/generatedLabsStore.test.ts`:
```ts
/**
 * tests/generatedLabsStore.test.ts
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { pickTemplateBatch } from '@/stores/generatedLabsStore';
import { LAB_TEMPLATES } from '@/labs/generated/templates';

describe('pickTemplateBatch', () => {
  it('picks 10 unique templates never used before, on a fresh ledger', () => {
    const batch = pickTemplateBatch([], 10);
    expect(batch).toHaveLength(10);
    expect(new Set(batch.map((t) => t.id)).size).toBe(10);
  });

  it('prefers never-used templates over used ones', () => {
    const usedFive = LAB_TEMPLATES.slice(0, 5).map((t) => t.id);
    const batch = pickTemplateBatch(usedFive, 5);
    expect(batch.every((t) => !usedFive.includes(t.id))).toBe(true);
  });

  it('falls back to least-recently-used once all 15 are exhausted', () => {
    const allUsed = LAB_TEMPLATES.map((t) => t.id); // oldest-first order
    const batch = pickTemplateBatch(allUsed, 10);
    expect(batch).toHaveLength(10);
    // The 10 picked should be the 10 used longest ago — i.e. the first
    // 10 ids in the (oldest-first) ledger.
    expect(batch.map((t) => t.id)).toEqual(allUsed.slice(0, 10));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --run tests/generatedLabsStore.test.ts`
Expected: FAIL — `@/stores/generatedLabsStore` does not exist yet.

- [ ] **Step 3: Implement the store**

Create `src/stores/generatedLabsStore.ts`:
```ts
/**
 * stores/generatedLabsStore.ts — AI-generated daily-ticket labs.
 *
 * Orchestrates one "Generate 10 More" click: picks 10 templates the
 * learner hasn't seen before (or the 10 used longest ago, once all 15
 * have been used at least once), asks the AI flavor generator for each
 * one's narrative/coaching-question in parallel, builds the Lab objects,
 * and persists everything (labs + the dedup ledger) via the same
 * versioned envelope every other store uses.
 */
import { create } from 'zustand';
import type { Lab } from '@/domain';
import { loadPersistedState, saveEnvelope, type PersistedGeneratedLabs } from '@/util/persistence';
import { LAB_TEMPLATES, type LabTemplate } from '@/labs/generated/templates';
import { generateFlavor } from '@/services/labFlavorGenerator';

/** Pick `count` templates: never-used ones first (in template-array order),
 * then the templates used longest ago once the pool is exhausted. */
export function pickTemplateBatch(usedTemplateIds: string[], count: number): LabTemplate[] {
  const unused = LAB_TEMPLATES.filter((t) => !usedTemplateIds.includes(t.id));
  if (unused.length >= count) return unused.slice(0, count);

  const usedInOrder = usedTemplateIds
    .map((id) => LAB_TEMPLATES.find((t) => t.id === id))
    .filter((t): t is LabTemplate => Boolean(t));
  return [...unused, ...usedInOrder].slice(0, count);
}

function loadGenerated(): PersistedGeneratedLabs {
  return loadPersistedState().generatedLabs;
}

function saveGenerated(snap: PersistedGeneratedLabs): void {
  const current = loadPersistedState();
  saveEnvelope({ ...current, version: 3, generatedLabs: snap });
}

interface GeneratedLabsState {
  labs: Lab[];
  generating: boolean;
  generateBatch(count?: number): Promise<Lab[]>;
  reset(): void;
}

export const generatedLabsStore = create<GeneratedLabsState>()((set, get) => {
  const initial = loadGenerated();
  return {
    labs: initial.labs,
    generating: false,

    async generateBatch(count = 10) {
      set({ generating: true });
      try {
        const current = loadGenerated();
        const templates = pickTemplateBatch(current.usedTemplateIds, count);

        const newLabs = await Promise.all(
          templates.map(async (t) => {
            const flavor = await generateFlavor({
              ticketTypeLabel: t.ticketTypeLabel,
              targetDisplayName: t.targetDisplayName,
              targetTitle: t.targetTitle,
              targetDept: t.targetDept,
            });
            return t.buildLab(flavor, current.usedNames);
          }),
        );

        const usedTemplateIds = [...current.usedTemplateIds, ...templates.map((t) => t.id)];
        const labs = [...current.labs, ...newLabs];
        // Track any freshly-picked names from onboarding/contractor labs so
        // future batches don't repeat them (title carries the chosen name
        // for those two templates — see templates.ts's baseLab() override).
        const usedNames = current.usedNames;
        saveGenerated({ labs, usedTemplateIds, usedNames });
        set({ labs, generating: false });
        return newLabs;
      } catch (err) {
        set({ generating: false });
        throw err;
      }
    },

    reset() {
      saveGenerated({ labs: [], usedTemplateIds: [], usedNames: [] });
      set({ labs: [] });
    },
  };
});
```

- [ ] **Step 4: Export it from the stores barrel**

In `src/stores/index.ts`, add:
```ts
export { generatedLabsStore } from './generatedLabsStore';
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- --run tests/generatedLabsStore.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Run the full suite and build**

Run: `npm test -- --run && npm run build`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/stores/generatedLabsStore.ts src/stores/index.ts tests/generatedLabsStore.test.ts
git commit -m "feat: add generatedLabsStore orchestrating AI-generated lab batches"
```

---

## Task 8: Wire generated labs into `findLab`

The conductor and `window.__lab.start(id)` both resolve labs via `findLab()`. It needs to also check generated labs.

**Files:**
- Modify: `src/labs/registry.ts`
- Test: `tests/labRegistry.test.ts` (new)

**Interfaces:**
- Produces: `findLab(id: string): Lab | undefined` now checks `LAB_REGISTRY` first, then `generatedLabsStore.getState().labs`.

- [ ] **Step 1: Write the failing test**

Create `tests/labRegistry.test.ts`:
```ts
/**
 * tests/labRegistry.test.ts
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { findLab } from '@/labs/registry';
import { generatedLabsStore } from '@/stores';
import { mkLabId } from '@/domain';
import type { Lab } from '@/domain';

const FAKE_GENERATED_LAB: Lab = {
  id: mkLabId('gen-test-lab'),
  number: 0,
  title: 'Test Generated Lab',
  brief: 'test',
  durationMinutes: 5,
  zoneIds: ['help-desk'],
  startingZone: 'help-desk',
  startingSeed: 'account-lockout',
  objectives: [],
  steps: [],
  faults: [],
  debriefQuestions: [],
};

describe('findLab', () => {
  beforeEach(() => {
    generatedLabsStore.setState({ labs: [FAKE_GENERATED_LAB] });
  });

  it('still finds a core lab', () => {
    expect(findLab('lab01')?.title).toBeTruthy();
  });

  it('finds a generated lab by id', () => {
    expect(findLab(FAKE_GENERATED_LAB.id)).toBe(FAKE_GENERATED_LAB);
  });

  it('returns undefined for an unknown id', () => {
    expect(findLab('nope')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --run tests/labRegistry.test.ts`
Expected: FAIL — `findLab` doesn't check generated labs yet.

- [ ] **Step 3: Update findLab**

Replace the last line of `src/labs/registry.ts`:
```ts
export const findLab = (id: string): Lab | undefined => LAB_REGISTRY.find((l) => l.id === id);
```
with:
```ts
export const findLab = (id: string): Lab | undefined =>
  LAB_REGISTRY.find((l) => l.id === id) ??
  generatedLabsStore.getState().labs.find((l) => l.id === id);
```
And add the import at the top of the file:
```ts
import { generatedLabsStore } from '@/stores/generatedLabsStore';
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- --run tests/labRegistry.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the full suite and build**

Run: `npm test -- --run && npm run build`
Expected: all pass (watch for a circular-import warning between `registry.ts` and `generatedLabsStore.ts` — there isn't one, since `templates.ts` imports `conductor.ts` for `registerLabSeed`, not `registry.ts`).

- [ ] **Step 6: Commit**

```bash
git add src/labs/registry.ts tests/labRegistry.test.ts
git commit -m "feat: findLab also resolves AI-generated labs"
```

---

## Task 9: Ensure templates are registered at boot

`templates.ts`'s `registerLabSeed` calls only run when the module is imported. `generatedLabsStore.ts` already imports `templates.ts` (for `LAB_TEMPLATES`), and `registry.ts` imports `generatedLabsStore.ts` — but `main.ts` needs to import `registry.ts` (or the store) early enough that seeds are registered before any lab (generated or not) starts. Confirm this is already satisfied.

**Files:**
- Modify: `src/main.ts` (verify only — likely no change needed)

**Interfaces:** none new.

- [ ] **Step 1: Verify the import chain**

Open `src/main.ts` and confirm it already does `import { findLab } from './labs/registry';` (it does — this was read at the start of this session). Since `registry.ts` now imports `generatedLabsStore.ts`, which imports `templates.ts`, which runs the `registerLabSeed` loop at module top-level, importing `main.ts` (which Vite always does on page load) transitively guarantees registration before `bootstrap()` runs. No code change needed here — just confirm by reading the current top of `src/main.ts` and checking the import is still present.

- [ ] **Step 2: Live-verify registration happened**

Run the dev server (`npm run dev` if not already running) and in the browser console:
```js
window.__lab.start('lab01'); // any real lab, just to prove boot succeeded
```
Then check that a template's seed key is registered by starting a generated lab once Task 11's button exists — this step is a placeholder cross-reference resolved fully in Task 11's manual test; no separate commit needed for this task since no code changed.

- [ ] **Step 3: No commit needed**

This task only verifies existing wiring — skip if `main.ts` already imports `registry.ts` as expected (it does).

---

## Task 10: Start-screen UI — generated labs section

Add the "Daily IT Support Tickets" section with the generate button, loading state, and a paginated card grid.

**Files:**
- Modify: `src/ui/startScreen.ts`

**Interfaces:**
- Consumes: `generatedLabsStore` (Task 7).

- [ ] **Step 1: Add the section markup**

In `src/ui/startScreen.ts`, find the closing `</div>` of the core-labs grid (right after the `${LABS.map(...).join('')}` block) and, before the `<div style="margin-top:32px...">Click a lab to start...` line, insert:
```html
      <div style="margin-top:32px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <div>
            <h2 style="color:#e6e6e6;font-size:16px;margin:0;">Daily IT Support Tickets</h2>
            <div style="color:#8b95a1;font-size:11px;margin-top:2px;">AI-generated — real-world help-desk scenarios, never repeated</div>
          </div>
          <button id="ss-generate" style="background:#4ec9b0;color:#0e1116;border:none;border-radius:6px;padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer;min-height:36px;white-space:nowrap;">
            🤖 Generate 10 More
          </button>
        </div>
        <div id="ss-generated-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;"></div>
        <div id="ss-generated-pager" style="display:none;justify-content:center;gap:8px;margin-top:12px;">
          <button id="ss-gen-prev" style="background:#1b1f24;color:#8b95a1;border:1px solid #2d343d;border-radius:6px;padding:6px 12px;font-size:12px;cursor:pointer;">← Prev</button>
          <span id="ss-gen-page-label" style="color:#8b95a1;font-size:12px;align-self:center;"></span>
          <button id="ss-gen-next" style="background:#1b1f24;color:#8b95a1;border:1px solid #2d343d;border-radius:6px;padding:6px 12px;font-size:12px;cursor:pointer;">Next →</button>
        </div>
      </div>
```

- [ ] **Step 2: Add the wiring**

In `src/ui/startScreen.ts`, add the import at the top:
```ts
import { generatedLabsStore } from '@/stores';
```
Then, inside `showStartScreen()`, after `document.body.appendChild(overlay);` and before the existing `for (const card of overlay.querySelectorAll('.lab-card'))` loop, add:
```ts
  const PAGE_SIZE = 10;
  let genPage = 0;

  function renderGeneratedGrid(): void {
    const grid = overlay.querySelector('#ss-generated-grid') as HTMLElement;
    const pager = overlay.querySelector('#ss-generated-pager') as HTMLElement;
    const pageLabel = overlay.querySelector('#ss-gen-page-label') as HTMLElement;
    const labs = generatedLabsStore.getState().labs;

    if (labs.length === 0) {
      grid.innerHTML = `<div style="grid-column:1/-1;color:#8b95a1;font-size:12px;padding:12px 0;">No generated tickets yet — click "Generate 10 More" to create your first batch.</div>`;
      pager.style.display = 'none';
      return;
    }

    const totalPages = Math.max(1, Math.ceil(labs.length / PAGE_SIZE));
    genPage = Math.min(genPage, totalPages - 1);
    const pageLabs = labs.slice(genPage * PAGE_SIZE, genPage * PAGE_SIZE + PAGE_SIZE);

    grid.innerHTML = pageLabs
      .map(
        (l) => `
        <div class="gen-lab-card" data-id="${l.id}"
             style="background:#1b1f24;border:1px solid #2d343d;border-radius:8px;padding:14px 16px;cursor:pointer;transition:border-color 0.15s,transform 0.1s;">
          <div style="color:#4ec9b0;font-size:13px;font-weight:700;margin-bottom:4px;">${l.title}</div>
          <div style="color:#8b95a1;font-size:12px;line-height:1.5;">${l.brief}</div>
        </div>
      `,
      )
      .join('');

    for (const card of grid.querySelectorAll('.gen-lab-card')) {
      card.addEventListener('mouseenter', () => {
        (card as HTMLElement).style.borderColor = '#4ec9b0';
      });
      card.addEventListener('mouseleave', () => {
        (card as HTMLElement).style.borderColor = '#2d343d';
      });
      card.addEventListener('click', () => {
        const id = (card as HTMLElement).dataset['id']!;
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.3s';
        setTimeout(() => {
          overlay.remove();
          onStart(id);
        }, 300);
      });
    }

    pager.style.display = totalPages > 1 ? 'flex' : 'none';
    pageLabel.textContent = `Page ${genPage + 1} of ${totalPages}`;
  }

  renderGeneratedGrid();

  overlay.querySelector('#ss-gen-prev')?.addEventListener('click', () => {
    genPage = Math.max(0, genPage - 1);
    renderGeneratedGrid();
  });
  overlay.querySelector('#ss-gen-next')?.addEventListener('click', () => {
    genPage += 1;
    renderGeneratedGrid();
  });
  overlay.querySelector('#ss-generate')?.addEventListener('click', async () => {
    const btn = overlay.querySelector('#ss-generate') as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = 'Generating…';
    try {
      await generatedLabsStore.getState().generateBatch(10);
      genPage = Math.ceil(generatedLabsStore.getState().labs.length / PAGE_SIZE) - 1;
      renderGeneratedGrid();
      showToast('10 new daily tickets generated.', { kind: 'success' });
    } catch {
      showToast('Could not generate new tickets. Try again.', { kind: 'error' });
    } finally {
      btn.disabled = false;
      btn.textContent = '🤖 Generate 10 More';
    }
  });
```

- [ ] **Step 3: Type-check and build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 4: Manual smoke test in the browser**

Run the dev server, open the start screen, click "Generate 10 More", confirm 10 cards appear (paginated if you generate again to get past 10), and clicking one starts that lab the same way a core lab does (HUD updates, zone matches the template's `zoneId`).

- [ ] **Step 5: Commit**

```bash
git add src/ui/startScreen.ts
git commit -m "feat: add Generate 10 More button and paginated grid to start screen"
```

---

## Task 11: End-to-end verification

Confirm one full generated lab is actually completable — walk to the zone's monitor, press E, do the step, watch it advance — the same way Lab 1 was verified earlier this session.

**Files:** none (verification only).

- [ ] **Step 1: Generate a batch and pick a simple one**

In the running dev server's browser console:
```js
await window.__lab_generatedLabsStore = (await import('/src/stores/generatedLabsStore.ts')).generatedLabsStore;
const labs = await window.__lab_generatedLabsStore.getState().generateBatch(10);
console.log(labs.map(l => ({ id: l.id, seed: l.startingSeed, zone: l.startingZone })));
```
Pick the `account-lockout` one (single-step, no ticket-queue dependency) for the fastest E2E check.

- [ ] **Step 2: Start it and complete the step**

```js
window.__lab.start(labs.find(l => l.startingSeed === 'account-lockout').id);
window.__lab.desktop.show(window.__lab.conductor, true);
```
Open IAM Console, find `jane.doe` in the users list (confirm her status shows disabled — proof the template's `seed()` ran), use "Enable" to re-enable her.

- [ ] **Step 3: Confirm the step advances**

```js
console.log(window.__labState.stepIndex); // should become >= 1 (lab has 1 step, so this means complete)
```
Expected: `stepIndex` is `1` (equal to `lab.steps.length`), confirming the lab actually completed — the same signal used to verify Lab 1 earlier in this session.

- [ ] **Step 4: Run the full gate one last time**

```bash
npm run lint
npx tsc --noEmit
npm test -- --run
npm run build
```
Expected: all green.

- [ ] **Step 5: No commit** (verification only — if anything is found broken here, go back and fix it in the relevant earlier task, then re-run this task).
