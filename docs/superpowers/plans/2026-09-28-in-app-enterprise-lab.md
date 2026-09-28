# In-App Enterprise Lab (DC01 + CLIENT01, AD Enterprise Lab, IAM Portfolio) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring IAM Range's AD Enterprise Lab Series and IAM Portfolio into the IAM SSO 3D Lab, done entirely inside the app: two simulated machines (DC01, Windows Server 2022; CLIENT01, Windows 11) that open from the main VM's desktop like IAM Range's Remote Desktop, plus IAM Range's Windows-style Active Directory Users and Computers.

**Architecture:** One persistent in-app "lab world" (`LabState`, ported from IAM Range `vm/adlab/state.ts`) holds both machines. Machine windows (nested Windows desktops) run their shells through the ported `runCommand` engine; their GUI tools issue the same commands, so typed and clicked work are graded identically. The AD Enterprise Lab app grades that state with the ported checks; the IAM Portfolio's VM projects seed scenarios into DC01's state and grade it with the ported `vmChecks` through `factsFromLabState`, replacing VirtualBox. The Active Directory window is ported once as a view over a `DirectoryAdapter`, with adapters for the main VM (`Conductor.dir`) and DC01 (`LabState.ad`).

**Tech Stack:** TypeScript 5, Vite 5, Vitest 2 (node env), Electron 31, three.js (untouched), zustand. No new dependencies.

**Spec:** The user's instructions of 2026-09-28 (summarised in Global Constraints).

## Global Constraints

- Work only in `IAM_SSO_3D_Real_World_Lab_Workflows` (code in `app/`). Do not modify IAM Range (`IAM_virtual-machine`); read it only as the port source.
- No real VMs, VirtualBox, ISOs or host PowerShell.
- DC01 and CLIENT01 are icons on the main VM desktop (entered with E). Double-click opens the machine inside the main VM like IAM Range's Remote Desktop (connect → sign in → nested Windows desktop).
- The Active Directory UI looks like IAM Range `src/ui/consoles/activeDirectoryWindow.ts`.
- Names: `corp.technobiz.local` / `CORP`, DC01 172.16.0.1/24, DHCP scope "TechnoBiz LAN" 172.16.0.100–200, internal network TechnoBiz-LAN.
- Keep existing tests green; test every new module; type-check, lint, test and build pass before each commit.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Push only after testing, to the repo the user provides (package.json: `pitchiluxe/iam-sso-3d-lab`).
- Ollama optional everywhere; offline fallbacks; the model never changes lab state.

## Phases and tasks

### Phase 1 — Foundations
1. **Port engine:** `config/ollama.ts`, `ui/markdown.ts`, `vm/adlab/{state,network,commands,validation,labs,observe,instructor}.ts` (no `realVm.ts`), `tests/setup.ts` + vite `setupFiles`; port `tests/adLab.test.ts` minus real-VM blocks.
2. **Lab world** `vm/adlab/world.ts`: `loadWorld()`, `saveWorld()`, `resetWorld(labId)`, `onWorldChanged(fn)`, `notifyWorldChanged()`, `runOn(world, host, line)`; localStorage key `iam3d.labWorld.v1`.

### Phase 2 — Active Directory, the IAM Range way
3. **DirectoryAdapter + ADUC view (main VM):** `ui/contextMenu.ts`, `ui/directory/directoryAdapter.ts` (`conductorAdapter`), `ui/directory/activeDirectoryView.ts`; desktop app `active-directory`.
4. **LabState adapter (DC01):** `labStateAdapter(getWorld)`; mutations run the equivalent PowerShell through `runOn`.

### Phase 3 — DC01 and CLIENT01 inside the main VM
5. **Machine window** `ui/machines/machineWindow.ts`: connect → sign in → nested desktop; icons `dc01`, `client01`.
6. **DC01 apps:** PowerShell, Command Prompt, Server Manager, Active Directory, Network Connections, DNS, DHCP, Notepad, File Explorer.
7. **CLIENT01 apps:** Settings (network), System (rename, join domain), PowerShell, Command Prompt, Notepad, File Explorer.

### Phase 4 — AD Enterprise Lab app
8. **Files and scripts** `vm/adlab/files.ts`.
9. **AD Lab window** (port, simulated only) grading the shared world; desktop app `ad-lab`.

### Phase 5 — IAM Portfolio app
10. **Engine port:** `vm/portfolio/{config,lint,instructor,vmChecks}.ts` + `portfolio.config.json`.
11. **In-app DC01 for the Portfolio:** `prepareDc01`, `seedScenario`, `factsFromLabState`; per-project tests (fail after setup, pass after reference work).
12. **Portfolio window** port; desktop app `iam-portfolio`.

### Phase 6 — Verification and release
13. Type-check, lint, tests, build; dev-server walkthrough with screenshots; README; version 0.6.0; commit; push after the user provides the repo; watch CI.
