# AI-Generated Daily IT Support Tickets — Design

Status: approved in chat, spec written for the record.

## Goal

Add a "🤖 Generate 10 More" button to the start screen that produces 10
short, realistic day-to-day IT-helpdesk tickets as playable labs — same
walk-to-a-monitor → press E → VM Desktop → objective flow as the 13 core
labs, never duplicated, persisted across sessions.

## Reliability constraint (why this isn't "ask the LLM for a lab")

The app's only AI backend is local Ollama (llama3.2, 3B), already used for
the tutor. A 3B model cannot reliably produce valid structured data —
`ValidatorKind` values, param IDs matching real seeded users/groups/apps —
across 10 labs every click. A validator that can never fire makes a lab
uncompletable, which fails the app's own Definition of Done ("the workflow
is executable").

**Resolution:** hybrid generation. All mechanics (steps, validators,
target users/groups, seeding) are hand-written, deterministic, and tested.
The LLM's only job is prose: a 2-3 sentence ticket narrative and one
Socratic coaching question, given the *real* facts (a real seeded
person's name/title/department, a real ticket type) as context — never
asked to invent IDs or pick validators. This is a strictly smaller,
far more reliable generation surface than the tutor's existing calls.

## Data model

A generated lab is a plain `Lab` (`src/domain/types.ts`) — no new
execution machinery. `Lab.id` uses a `gen-` prefix
(`mkLabId('gen-' + templateId + '-' + nanoid(6))`) so it's visually and
programmatically distinguishable from `lab01..lab13`.

New persisted envelope slice (`src/util/persistence.ts`, bump to
`version: 3`, migrate v2→v3 by defaulting the new field):

```ts
export interface PersistedGeneratedLabs {
  labs: Lab[];               // every generated lab ever created, for pagination
  usedTemplateIds: string[]; // dedup ledger, oldest-first; grows forever
}
```

New `generatedLabsStore` (zustand), same shape/pattern as `progressStore`:
`labs`, `generateBatch(count = 10): Promise<Lab[]>`, `reset()`.

`labs/registry.ts`'s `findLab()` checks `LAB_REGISTRY` first, then
`generatedLabsStore.getState().labs` — the only touch point the rest of
the app (conductor, main.ts) needs.

## The 15 templates

Each template is a small object: `{ id, zoneId, buildLab(flavor): Lab,
seed?(dir, idp, tickets): void }`. All target *real* baseline entities
(`SEED_USERS` / `SEED_ADMINS` / `GROUP_NAMES` / `SERVICE_ACCOUNT_NAMES`
from `src/config/`) — nothing is invented at generation time except the
prose. A few templates need the world in a specific starting state (an
account already disabled, an active session to revoke, a duplicate
account to delete) — those get a small deterministic `seed()` hook that
runs after `applyBaseline` in `conductor.ts`'s seed dispatch, exactly like
`seed/perLab/lab01.ts` does today.

| # | id | Zone | Real target | Steps → validator(s) | Extra seed? |
|---|---|---|---|---|---|
| 1 | account-lockout | Help Desk | jane.doe | re-enable → `user-enabled` | disable jane.doe |
| 2 | new-hire-onboarding | Help Desk | fresh name, code-picked from a ~20-name pool (not AI-invented) | create user, add to dept group → `user-created`, `group-added` | — |
| 3 | offboarding | Help Desk | dan.rivera | disable, revoke sessions → `user-disabled`, `session-revoked` | sign dan.rivera in (so there's a session) |
| 4 | promotion-role-change | Help Desk | ivy.park | remove old group, add new → `group-removed`, `group-added` | — |
| 5 | mfa-device-lost | IAM Ops | finn.muller | reset + re-verify MFA → `mfa-challenge-completed` | — |
| 6 | suspicious-signin | SecOps | hank.oneill | revoke session, capture evidence → `session-revoked`, `evidence-collected` | sign hank.oneill in |
| 7 | app-access-request | Help Desk | alex.morgan | add to grp granting Finance Portal → `group-added` | — |
| 8 | ticket-cant-login | Help Desk | cara.patel | resolve seeded ticket → `ticket-resolved` | create an open `password-reset` ticket |
| 9 | stale-group-cleanup | IAM Ops | hank.oneill (already dual-group in baseline) | remove grp-domain-admins → `group-removed` | — |
| 10 | dept-mfa-enforcement | IAM Ops | Finance dept | enable MFA policy → `mfa-policy-enforced` (existing, proven in lab01) | — |
| 11 | contractor-setup | Engineering | fresh name, same pool as #2 | create user, add to grp-engineering-dev → `user-created`, `group-added` | — |
| 12 | service-account-access | Engineering | svc-backup | add to a group → `group-added` | — |
| 13 | failed-login-troubleshoot | Help Desk | greta.olsen | sign in successfully, capture evidence → `signin-succeeded`, `evidence-collected` | — |
| 14 | duplicate-account-cleanup | IAM Ops | a seeded duplicate of jane.doe | delete the duplicate → `user-deleted` **(new validator kind)** | create the duplicate user |
| 15 | department-transfer | Help Desk | bob.sato | remove old dept group, add new → `group-removed`, `group-added` | — |

**One small domain addition:** `ValidatorKind` gains `'user-deleted'`
(mirrors `user-created`'s pattern exactly:
`e.action === 'user.deleted' && e.targetId === userId`), plus the matching
`conductor.ts` case and `objectivesWindow.ts` label — same pattern as the
`group-created` / `mfa-policy-enforced` additions made earlier this
session.

Zone assignment is fixed per template (table above), not random, so a
lab's narrative always matches where you walk to.

The name pool used by templates #2 and #11 is tracked in the same
persisted dedup ledger as templates (a used-names list) so two
generated onboarding/contractor labs never reuse the same fresh name.

## AI flavor generation

New `services/labFlavorGenerator.ts`, structurally identical to
`ollamaSupervisor.ts`'s existing `_chat()` call (same base URL, same
90s timeout, same disabled/offline fallback):

- System prompt: a cybersecurity/IT-helpdesk-expert persona instructed to
  write realistic, concise, non-fictional-sounding ticket text — no
  invented names, IDs, or facts beyond what's given.
- User prompt per template: the real person's display name, title,
  department, and the ticket type — asks for strict JSON:
  `{ "narrative": "...", "coachingQuestion": "..." }`.
- Output is validated (non-empty strings, length-capped) before use;
  malformed/missing output falls back to one hand-written narrative
  per template (same graceful-degradation pattern the tutor already
  uses when Ollama is offline) — a click never fails or produces a
  broken lab even with no AI available.

## Dedup

`usedTemplateIds` (persisted, grows forever) tracks every template id
used, oldest first. Each `generateBatch(10)` call:
1. Prefers templates never in the ledger.
2. Once all 15 have been used at least once, cycles from the
   least-recently-used end (so batches stay non-repetitive even past
   the 15th generation) — the flavor text is still freshly generated
   each time, so wording never literally repeats even when the
   underlying template does.

## UI

`ui/startScreen.ts` gets a new section below the 13 core lab cards:
"Daily IT Support Tickets" header, a "🤖 Generate 10 More" button
(shows a brief loading state while the 10 Ollama calls run — done in
parallel, capped around ~10-15s worst case), and a paginated grid
(10 per page, simple prev/next) of every generated lab so far, each
card behaving exactly like a core lab card (click → `onStart(id)`).

## Testing

- Unit tests (`tests/labFlavorGenerator.test.ts` or similar): dedup/
  rotation logic with a mocked ledger (no network); the offline-fallback
  path returns valid narrative text with Ollama absent.
- Unit test: each of the 15 templates' `buildLab()` produces a
  structurally valid `Lab` (non-empty steps, valid `ValidatorKind`
  values) — a compile-time-ish smoke test independent of the AI call.
- Live smoke test (manual, via Playwright as done earlier this session):
  click Generate, complete one generated lab end-to-end exactly like
  Lab 1 was completed earlier, confirming stepIndex actually advances.
