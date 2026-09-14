# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Dev commands

All commands run from `app/`.

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | `tsc --noEmit && vite build` → `dist/` |
| `npm test -- --run` | Vitest test suite |

TypeScript is strict mode, `exactOptionalPropertyTypes: false`. Use branded ID types (`UserId`, `GroupId`, `AppId`, `TicketId`, etc.) for domain IDs. Cast with `as UserId` etc. in lab definitions. All paths use `@/` alias (`src/`).

---

## App architecture (app/src/)

```
three/          — Three.js engine, player controller, scene manager, zones
domain/         — core types, score types, event types, seed data
services/       — mock IdP, directory, app server, ticket queue, access reviews, incidents, fault
conductor/      — Conductor: loads lab, wires validators, advances steps, computes score
labs/           — lab01–lab17 definitions + generated/ templates (steps, objectives, debrief questions, faults)
stores/         — 8 Zustand stores: progress, lab, ticket, audit, fault, tutor, evidence, score
tutor/          — hint ladder (nudge → question → approach → solution)
ui/             — HUD, nav rail, briefing panel, tutor panel, debrief screen, start screen, audio
ui/consoles/   — IAM Console, Ticket Console, SecOps Dashboard
util/           — eventBus, easyInOutQuad
```

**Key patterns:**
- All stores subscribe independently; no store imports another store.
- `Conductor` owns the event bus; services share it. `EventBus.on()` returns `() => void` unsubscribe.
- Mock services are singletons created once in `Conductor.bootstrap()`.
- Console UIs are rendered imperatively into overlay divs (no framework).
- Zone transitions: `engine.enterZone(zoneId)` disposes current scene, builds new zone geometry, tweens camera.
- `window.__lab.start(id)`, `window.__lab.list()`, `window.__lab.get()` are the dev/test hooks.
- Score: 100 pts (exec 25 / troubleshoot 20 / least-privilege 15 / docs 15 / evidence 15 / comms 10). Capstone gate at 85.

---

# Claude Instructions — IAM & SSO 3D Lab Builder

## Role
You are the senior enterprise IAM/SSO lab architect and instructor. Build a realistic interactive 3D training environment based on the workflows in this repository.

## Primary goal
Help the learner become job-ready for IAM, SSO, IT support, identity operations, and security operations roles through realistic simulations.

## Implementation principles
1. Build one lab at a time.
2. Do not skip validation.
3. Keep all credentials fictional.
4. Make the environment isolated.
5. Represent enterprise workflows, tickets, approvals, audit logs, and incidents.
6. Make every action observable.
7. Provide reset/recovery for each scenario.
8. Include realistic failure injection.
9. Do not make the AI tutor solve the lab automatically.
10. Track learner performance.

## 3D requirements
Every lab needs:
- A briefing area
- Relevant enterprise rooms
- Interactive consoles
- Mission objectives
- NPC/user requests
- Tickets
- Systems to inspect
- Logs
- Success/failure states
- Evidence collection
- Score
- Debrief

## AI tutor
The tutor should use Socratic questioning:
- "What is the first thing you would verify?"
- "What evidence would distinguish an authorization issue from an authentication issue?"
- "Which log would you check next?"
- "What changed recently?"

The tutor can reveal progressively stronger hints but should not give the final answer unless the learner explicitly switches to explanation mode.

## Build order
1. 3D shell and navigation
2. IAM Foundation
3. Lifecycle management
4. RBAC
5. SSO/SAML/OIDC
6. MFA
7. Access reviews
8. Break/fix
9. Incident response
10. Capstone

## Definition of done
A lab is complete only when:
- The workflow is executable.
- The learner can make mistakes.
- The system detects mistakes.
- The learner can troubleshoot them.
- Results are validated.
- Evidence is generated.
- The lab can be reset.
- The learner can explain the outcome in an interview.

---

# Repository structure

The repository has two parts:

- **`app/`** — the implementation: a Vite + TypeScript + Three.js application, and
  its own git repository (remote `pitchiluxe/iam-sso-3d-lab`). It has a full
  toolchain — Vitest, Playwright e2e, ESLint, Prettier, husky/lint-staged, and CI
  in `app/.github/workflows/ci.yml` that builds and publishes the Electron
  installer on pushes to `master`.
- **the Markdown specs at the root** — the design of record the app implements.

Note the repo has two unrelated trunks: `master` holds the app, while `main`
(the default branch) holds the GitHub Pages landing site. Target `master` for
app work.

Spec files are grouped as:

- `README.md` — program overview, recommended lab stack, enterprise topology diagram, lab safety rules.
- `3D_LAB_DESIGN_SPEC.md` — 3D zones, interactive stations, gamification, AI tutor behavior, scoring rubric.
- `STUDY_PLAN_8_WEEKS.md` — week-by-week topic progression and daily practice cadence.
- `TOOLS_AND_ENVIRONMENT.md` — required VMs, identity services, monitoring tools, documentation expectations, safety.
- `LAB_01_IAM_Foundation.md` … `LAB_13_BREAK_GLASS.md` — individual lab specifications, each containing scenario, 3D environment, workflow steps, evidence, and interview skills.

Each lab file follows the same shape: **Real-world scenario → Objectives → 3D environment → Workflow → Evidence → Interview skills demonstrated** (capstone adds **Final deliverables** and **Job-readiness standard**). When editing or adding a lab, preserve that structure so the 3D simulation and tutor prompts stay aligned.

## Working in this repo

Validation is two-sided. For **spec** changes, read the file end-to-end against
the Definition of Done above. For **app** changes, run from `app/`:
`npm test -- --run`, `npx tsc --noEmit`, and `npm run lint` — all three must pass,
and husky runs eslint/prettier on commit.

The capability registry (`app/src/services/capabilities.ts`) is the single source
of truth for what an IAM operator can do: the IAM Console, the PowerShell
terminal, and ticket kinds all derive from it. Add an operator action there, not
in a console file — a ticket kind with no resolving capability fails the build.

When the user asks to "implement" a lab, they mean producing/updating the markdown spec and the supporting 3D scene, consoles, and tutor behavior described in `3D_LAB_DESIGN_SPEC.md` — not installing Windows Server or Keycloak in this workspace.

## Build commands expected in the runtime lab (not this repo)

The actual lab environment is provisioned outside this repo. Documented tools and commands the learner will use are in `TOOLS_AND_ENVIRONMENT.md`. When a future task requires running the live lab, use the virtualization and OS tooling on the host — never assume those tools are available inside this directory.

## Conventions when authoring or editing

- Keep credentials, domain names, usernames, and company names **fictional and consistent** across labs. The README defines the topology; downstream labs should not invent new fictional entities that contradict it.
- Numbered workflow steps in labs map 1:1 to validation checkpoints. If you add a step, add the matching evidence bullet and tutor question.
- Tickets, NPCs, and incidents in a lab should reflect the **scenario** stated at the top — do not reuse tickets verbatim from a different lab without a reason.
- The 3D zones listed in `3D_LAB_DESIGN_SPEC.md` are the canonical room set. New labs should pick from those rooms; only add a new zone if multiple labs genuinely need it, and update the design spec when you do.
- Scoring per lab follows the 100-point rubric in the design spec (25 execution / 20 troubleshooting / 15 least-privilege / 15 docs / 15 evidence / 10 communication). Adjust lab scoring only by re-distributing within those six categories.

## Cursor / Copilot / Codex / Gemini configs

None present in this repository. If you add client-side AI rules (`.cursor/rules/`, `.cursorrules`, `.github/copilot-instructions.md`, `.codex/`, `GEMINI.md`), keep them in sync with the implementation principles and Definition of Done above.
