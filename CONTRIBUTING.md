# Contributing to IAM & SSO 3D Lab

Thanks for contributing. This guide covers the canonical patterns for adding new labs, consoles, and services to the training simulator.

---

## Dev setup

```bash
cd app
npm install
npm run dev          # starts Vite dev server on :5173
npm test -- --run    # runs the unit suite
npm run e2e          # runs Playwright E2E suite (requires the production build)
npm run build        # type-checks + Vite build
npm run lint         # ESLint
npm run format       # Prettier
```

Pre-commit hooks (Husky) run `eslint --fix` + `prettier --write` on every staged `.ts` file. Install hooks with `npm run prepare`.

---

## Adding a new lab

A lab lives in `app/src/labs/labNN.ts` and is registered in `app/src/labs/registry.ts`.

### 1. Create the lab definition

```ts
// app/src/labs/labNN.ts
import type { Lab } from '@/domain';

export const LAB_NN: Lab = {
  id: mkLabId('labNN'),
  number: NN,
  title: 'My New Lab',
  startingZone: 'iam-ops',
  objectives: ['Objective 1', 'Objective 2'],
  debriefQuestions: [
    'Question 1?',
    'Question 2?',
  ],
  steps: [
    {
      id: 's1',
      title: 'Step One',
      brief: 'What the learner does.',
      objectives: ['Sub-objective'],
      validator: { action: 'user.provisioned', userId: 'alice.smith' },
      maxHints: 3,
    },
    // ... more steps
  ],
};
```

Key rules:
- Each `validator` matches an `AuditEvent.action` string. See `app/src/domain/events.ts` for the full list.
- Use branded ID casts for all domain IDs: `targetUserId: 'alice.smith' as UserId`
- Add `fault` only for labs 07–10 (break/fix scenarios)
- Debrief questions are for discussion/interview prep; they are not validated

### 2. Register it

```ts
// app/src/labs/registry.ts
import { LAB_NN } from './labNN';
export const LAB_REGISTRY = [
  LAB_01, LAB_02, /* ... */, LAB_NN,
] as const;
```

### 3. Add a card to the start screen

```ts
// app/src/ui/startScreen.ts — add to the LABS array
{ id: 'labNN', title: 'My New Lab', brief: '...' },
```

### 4. Add a Vitest spec (optional but recommended)

```ts
// app/tests/labNN.test.ts
import { describe, it, expect } from 'vitest';
import { LAB_NN } from '@/labs/labNN';

describe('LAB_NN', () => {
  it('has at least one step', () => {
    expect(LAB_NN.steps.length).toBeGreaterThan(0);
  });
  it('all steps have validators', () => {
    for (const step of LAB_NN.steps) {
      expect(step.validator).toBeDefined();
    }
  });
});
```

### 5. If the lab uses a new zone

Add the blueprint to `app/src/three/zones.ts` (see the zone guide below) and add the `ZoneId` to the union in `zones.ts`.

---

## Adding a new console

1. Create `app/src/ui/consoles/myConsole.ts` exporting:
   ```ts
   export function renderMyConsole(body: HTMLElement, conductor: Conductor): void {
     body.innerHTML = '...'; // imperative DOM
   }
   ```
2. Add the case to the `switch` in `app/src/main.ts`'s `engine.onConsoleActivate` handler.
3. Add a `ConsoleAnchor` to the relevant zone blueprint in `app/src/three/zones.ts`:
   ```ts
   consoles.push({
     id: 'my-console',
     position: new THREE.Vector3(2, 1.5, -2),
     title: 'My Console',
     prompt: 'Open My Console (E)',
   });
   ```

---

## Adding a new mock service

1. Create `app/src/services/mockMyService.ts` exporting a class with the standard singleton interface.
2. Instantiate it in `Conductor.bootstrap()`.
3. Add a Vitest spec at `app/tests/myService.test.ts`.
4. Services must never throw — return `{ ok: false, error: '...' }` on failure.

---

## Adding a new zone

Each zone is a `ZoneBlueprint` in `app/src/three/zones.ts`. Use the shared helpers in `app/src/three/props.ts` and `app/src/three/materials.ts`:

```ts
// app/src/three/zones.ts
const MY_ZONE_BLUEPRINT: ZoneBlueprint = {
  id: 'my-zone',
  displayName: 'My Zone',
  spawnPoint: new THREE.Vector3(0, 1.7, 8),
  spawnLookAt: new THREE.Vector3(0, 1.5, 0),
  build() {
    const group = new THREE.Group();
    group.name = 'zone:my-zone';
    const mats = getMaterials('my-zone');
    const consoles: ConsoleAnchor[] = [];

    // Floor with zone texture
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), mats.floor);
    floor.rotation.x = -Math.PI / 2;
    group.add(floor);

    // ... build walls, furniture, lighting

    return { group, consoles };
  },
};

export const ZONE_BLUEPRINTS: Record<ZoneId, ZoneBlueprint> = {
  // ... existing zones ...
  'my-zone': MY_ZONE_BLUEPRINT,
};
```

Add `'my-zone'` to the `ZoneId` union in `zones.ts`.

---

## Style guide

- All new files use TypeScript strict mode
- Use branded ID types: `UserId`, `GroupId`, `AppId`, `TicketId`
- No `any` — use `unknown` and narrow with type guards
- UI components are imperative DOM — no React/Vue/Angular
- Prefer `const` over `let`
- All stores subscribe independently — no store imports another store
- Console UIs render into `body`-appended overlay divs; no frameworks
- Web Audio cues (blip, chime, fanfare) live in `app/src/ui/audio.ts`
- Error handling: services return result objects, never throw to the UI

---

## Running the full pipeline

```bash
npm run type-check   # tsc --noEmit
npm run lint        # ESLint
npm run format:check # Prettier
npm test -- --run   # Vitest unit tests
npm run build       # Vite production build
npm run e2e         # Playwright E2E tests
```

All five steps must pass before merging.

---

## File overview

```
app/src/
  three/          — Three.js engine, player controller, scene manager, zones, props
  domain/         — core types, score types, event types, seed data
  services/       — mock IdP, directory, app server, ticket queue, access reviews, incidents, fault
  conductor/      — Conductor: loads lab, wires validators, advances steps, computes score
  labs/           — lab01–lab10 definitions (steps, objectives, debrief questions, faults)
  stores/         — 8 Zustand stores: progress, lab, ticket, audit, fault, tutor, evidence, score
  tutor/          — hint ladder (nudge → question → approach → solution)
  ui/             — HUD, nav rail, briefing panel, tutor panel, debrief screen, start screen, audio
  ui/consoles/   — IAM Console, Ticket Console, SecOps Dashboard
  util/           — eventBus, easyInOutQuad, assert, errors, persistence
```
