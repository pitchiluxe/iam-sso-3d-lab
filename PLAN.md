# Implementation Plan — IAM/SSO 3D Real-World Lab Workflows

A thin-slice, end-to-end implementation plan for a browser-based 3D training environment covering Labs 01–10. All ten labs must be reachable and playable in the first pass; depth grows in later iterations.

---

## 0. Guiding Principles

1. **One conductor, ten configs.** A single `Conductor` module drives all labs. Each lab is just a config object.
2. **Boring and working beats clever.** Vanilla Three.js + Vite + TS. No React, no backend, no real services.
3. **Thin slice first, depth later.** Every lab is reachable with a minimum viable loop: brief → steps → debrief.
4. **All state in memory + localStorage.** `MockIdP`, `MockDirectory`, `MockAppServer`, and `MockTicketQueue` are in-process services seeded by per-lab data.
5. **Fictional and consistent.** One company, one IdP realm, one set of users, shared across labs (Labs 02–10 mutate the post-Lab-01 baseline).

---

## 1. Tech Stack & Dependencies

### Runtime & build
| Package | Purpose | Why |
|---|---|---|
| `three` | 3D engine | Required by user. Mature, smallest viable API surface. |
| `@types/three` | TS types | Required for strict TS. |
| `vite` | Dev server + bundler | Fastest HMR for Three.js; zero-config TS. |
| `typescript` | Language | Required by user. |

### App-layer
| Package | Purpose | Why |
|---|---|---|
| `zustand` | State stores | 1 KB, no provider, works outside React. One store per concern. |
| `nanoid` | ID generation | Short, URL-safe IDs for tickets, audit events, evidence. |

### Dev / test
| Package | Purpose | Why |
|---|---|---|
| `vitest` | Unit tests | Vite-native, fast, ESM-first. |
| `eslint` + `@typescript-eslint/*` | Lint | Catches dead code and unused types early. |
| `prettier` | Format | Removes bike-shedding. |

### Not used (and why)
- **No React, no R3F.** User specified vanilla Three.js.
- **No backend / no network.** All IdP/directory/app/ticket behavior is mocked in-app.
- **No Tailwind / CSS framework.** A single `styles.css` with CSS variables for the HUD is enough.
- **No router library.** Lab selection is a one-screen menu; state carries the current lab.
- **No LLM SDK for tutor v1.** Tutor ships with a hand-authored question/hint bank. (See §14 for the upgrade path.)

### `package.json` (excerpt)
```json
{
  "name": "iam-sso-3d-lab",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src --ext .ts",
    "format": "prettier --write src"
  },
  "dependencies": {
    "three": "^0.169.0",
    "nanoid": "^5.0.0",
    "zustand": "^4.5.0"
  },
  "devDependencies": {
    "@types/three": "^0.169.0",
    "typescript": "^5.5.0",
    "vite": "^5.4.0",
    "vitest": "^2.0.0",
    "eslint": "^9.0.0",
    "@typescript-eslint/parser": "^8.0.0",
    "@typescript-eslint/eslint-plugin": "^8.0.0",
    "prettier": "^3.3.0"
  }
}
```

### Vite config
- `base: './'` so the bundle works from `file://`.
- `server.port: 5173`, `server.strictPort: true`.

### tsconfig
- `target: ES2022`, `module: ESNext`, `moduleResolution: bundler`.
- `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`.
- `paths: { "@/*": ["src/*"] }`.

---

## 2. Top-Level Project Structure

```
IAM_SSO_3D_Real_World_Lab_Workflows/
├── PLAN.md
├── README.md
├── CLAUDE.md
├── 3D_LAB_DESIGN_SPEC.md
├── LAB_01..LAB_10*.md
├── STUDY_PLAN_8_WEEKS.md
├── TOOLS_AND_ENVIRONMENT.md
└── app/                             # new — the runnable web app
    ├── index.html
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── .eslintrc.cjs
    ├── .prettierrc
    ├── .gitignore
    ├── public/
    │   └── favicon.svg
    ├── src/
    │   ├── main.ts                  # bootstraps renderer, scene, stores, conductor
    │   ├── app.ts                   # top-level controller (wires game loop to stores)
    │   ├── config/
    │   │   ├── company.ts           # fictional company, domain, IdP realm
    │   │   ├── credentials.ts       # fictional users, reusable across labs
    │   │   └── scoring.ts           # 100-pt rubric constants
    │   ├── domain/
    │   │   ├── types.ts             # all interfaces from §3
    │   │   ├── ids.ts               # branded ID types
    │   │   └── enums.ts             # Role, TicketKind, FaultKind, etc.
    │   ├── services/
    │   │   ├── mockDirectory.ts
    │   │   ├── mockIdP.ts
    │   │   ├── mockAppServer.ts
    │   │   ├── mockTicketQueue.ts
    │   │   ├── mockAuditLog.ts
    │   │   ├── mockAccessReviews.ts
    │   │   ├── mockIncidents.ts
    │   │   └── faultService.ts
    │   ├── seed/
    │   │   ├── baseline.ts
    │   │   └── perLab/
    │   │       ├── lab01.ts … lab10.ts
    │   ├── stores/
    │   │   ├── progressStore.ts
    │   │   ├── labStore.ts
    │   │   ├── ticketStore.ts
    │   │   ├── auditStore.ts
    │   │   ├── faultStore.ts
    │   │   ├── tutorStore.ts
    │   │   ├── evidenceStore.ts
    │   │   └── scoreStore.ts
    │   ├── conductor/
    │   │   ├── conductor.ts
    │   │   ├── validate.ts
    │   │   ├── score.ts
    │   │   ├── evidence.ts
    │   │   └── debrief.ts
    │   ├── tutor/
    │   │   ├── questionBank.ts
    │   │   ├── hintLadder.ts
    │   │   ├── explanationMode.ts
    │   │   └── tutorService.ts
    │   ├── three/
    │   │   ├── engine.ts
    │   │   ├── input.ts
    │   │   ├── nav.ts
    │   │   ├── zones/
    │   │   │   ├── zoneRegistry.ts
    │   │   │   ├── reception.ts, hr.ts, helpDesk.ts, iamOps.ts
    │   │   │   ├── serverRoom.ts, noc.ts, finance.ts, engineering.ts
    │   │   │   ├── appCenter.ts, exec.ts
    │   │   ├── consoles/
    │   │   │   ├── consoleRegistry.ts
    │   │   │   ├── iamConsole.ts, ticketConsole.ts
    │   │   │   ├── serverRack.ts, appTile.ts, secOpsDashboard.ts
    │   │   └── transitions.ts
    │   ├── ui/
    │   │   ├── hud.ts
    │   │   ├── ticketPanel.ts
    │   │   ├── appPanel.ts
    │   │   ├── auditPanel.ts
    │   │   ├── tutorPanel.ts
    │   │   ├── debriefPanel.ts
    │   │   ├── evidenceTray.ts
    │   │   ├── mainMenu.ts
    │   │   └── styles.css
    │   ├── labs/
    │   │   ├── types.ts
    │   │   ├── registry.ts
    │   │   ├── lab01.ts … lab10.ts
    │   │   └── sharedObjectives.ts
    │   └── util/
    │       ├── log.ts
    │       ├── snapshot.ts
    │       ├── persist.ts
    │       ├── assert.ts
    │       └── events.ts
    └── tests/
        ├── conductor.test.ts
        ├── validate.test.ts
        ├── score.test.ts
        ├── faultService.test.ts
        ├── tutor.test.ts
        ├── mockIdP.test.ts
        └── labs/
            ├── lab01.test.ts … lab10.test.ts
```

### Ownership rules
- `services/` knows nothing about Three.js or DOM.
- `stores/` are pure state; they call services and re-render UI subscribers.
- `three/` knows nothing about labs or scoring — it emits high-level events (`consoleActivated`, `zoneEntered`) on a tiny event bus the conductor subscribes to.
- `ui/` is the only DOM-touching code besides `three/` overlays.
- `labs/` is pure data + tiny step definitions. No Three.js imports.

---

## 3. Core Domain Model

All types in `src/domain/types.ts`. Branded ID types in `src/domain/ids.ts` prevent mixing `UserId` and `TicketId`.

```ts
export type Role =
  | 'Employee' | 'Manager' | 'HR' | 'Finance'
  | 'HelpDesk' | 'IAMAdmin' | 'SecOps' | 'ServerAdmin'
  | 'Auditor' | 'AppOwner' | 'Executive' | 'ServiceAccount';

export type TicketKind =
  | 'onboarding' | 'mover' | 'leaver' | 'access-request'
  | 'password-reset' | 'mfa-issue' | 'transfer' | 'termination' | 'incident';

export type TicketStatus = 'open' | 'in-progress' | 'pending-approval' | 'resolved' | 'closed' | 'cancelled';
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TicketApproval = { approverRole: Role; approved: boolean; note?: string; at: number };

export type FaultKind =
  | 'wrong-redirect-uri' | 'expired-cert' | 'wrong-issuer'
  | 'wrong-client-secret' | 'wrong-claim-mapping' | 'missing-role'
  | 'clock-skew' | 'dns-resolution' | 'mfa-prompt-loop'
  | 'suspicious-signin' | 'excessive-permissions' | 'dormant-account';

export type AuthProtocol = 'SAML' | 'OIDC';
export type MfaMethod = 'totp' | 'fido2' | 'sms' | 'push' | 'none';
export type EvidenceKind = 'snapshot' | 'log-excerpt' | 'config-diff' | 'ticket' | 'audit-event';
```

```ts
// Branded IDs
export type UserId      = string & { __brand: 'UserId' };
export type GroupId     = string & { __brand: 'GroupId' };
export type RoleId      = string & { __brand: 'RoleId' };
export type AppId       = string & { __brand: 'AppId' };
export type TicketId    = string & { __brand: 'TicketId' };
export type AuditId     = string & { __brand: 'AuditId' };
export type IncidentId  = string & { __brand: 'IncidentId' };
export type ReviewId    = string & { __brand: 'ReviewId' };
export type LabId       = string & { __brand: 'LabId' };
export type EvidenceId  = string & { __brand: 'EvidenceId' };
export type SessionId   = string & { __brand: 'SessionId' };
```

```ts
// Directory
export interface User {
  id: UserId;
  username: string;
  displayName: string;
  email: string;
  department: string;
  title: string;
  managerId?: UserId;
  status: 'active' | 'disabled' | 'locked' | 'pending-creation';
  mfa: MfaMethod;
  groupIds: GroupId[];
  lastSignInAt?: number;
  createdAt: number;
  disabledAt?: number;
}

export interface Group {
  id: GroupId;
  name: string;
  description: string;
  memberIds: UserId[];
  ownerRoleId?: RoleId;
}

export interface Role {
  id: RoleId;
  name: string;
  description: string;
  permissions: string[];
  appId?: AppId;
}

// Applications & IdP
export interface Application {
  id: AppId;
  name: string;
  protocol: AuthProtocol;
  redirectUri: string;
  clientId: string;
  entityId?: string;
  issuer?: string;
  requiredRoleIds: RoleId[];
  mfaRequired: boolean;
  status: 'configured' | 'misconfigured' | 'offline';
  configDiffFromBaseline?: Record<string, { expected: unknown; actual: unknown }>;
}

// Tickets
interface TicketBase {
  id: TicketId;
  kind: TicketKind;
  status: TicketStatus;
  priority: TicketPriority;
  requesterId: UserId;
  assigneeId?: UserId;
  subject: string;
  body: string;
  createdAt: number;
  updatedAt: number;
  approvals: TicketApproval[];
  comments: { authorId: UserId; at: number; body: string }[];
  relatedUserIds: UserId[];
}

export type Ticket =
  | (TicketBase & { kind: 'onboarding';   payload: { proposedGroupIds: GroupId[]; proposedRoleIds: RoleId[]; startDate: number } })
  | (TicketBase & { kind: 'mover';        payload: { userId: UserId; fromGroupIds: GroupId[]; toGroupIds: GroupId[] } })
  | (TicketBase & { kind: 'leaver';       payload: { userId: UserId; lastDay: number; revokeSessions: boolean } })
  | (TicketBase & { kind: 'transfer';     payload: { userId: UserId; fromDepartment: string; toDepartment: string } })
  | (TicketBase & { kind: 'termination';  payload: { userId: UserId; reason: string; immediate: boolean } })
  | (TicketBase & { kind: 'access-request'; payload: { userId: UserId; requestedRoleIds: RoleId[]; justification: string } })
  | (TicketBase & { kind: 'password-reset'; payload: { userId: UserId; method: 'helpdesk' | 'self-service' } })
  | (TicketBase & { kind: 'mfa-issue';    payload: { userId: UserId; symptom: 'repeated-prompts' | 'lost-device' | 'locked-out' } })
  | (TicketBase & { kind: 'incident';     payload: { incidentId: IncidentId; affectedUserId?: UserId; affectedAppId?: AppId } });

// Audit & incidents
export type AuditEvent =
  | { id: AuditId; at: number; actorId: UserId; action: 'user.created' | 'user.disabled' | 'user.unlocked'; targetId: UserId }
  | { id: AuditId; at: number; actorId: UserId; action: 'group.add' | 'group.remove'; targetId: GroupId; subjectId: UserId }
  | { id: AuditId; at: number; actorId: UserId; action: 'role.grant' | 'role.revoke'; targetId: RoleId; subjectId: UserId }
  | { id: AuditId; at: number; actorId: UserId; action: 'app.config.changed'; targetId: AppId; diff: Record<string, unknown> }
  | { id: AuditId; at: number; actorId: UserId; action: 'signin.success' | 'signin.failure' | 'signout'; targetId: UserId; sessionId: SessionId; mfaUsed?: MfaMethod; ip?: string }
  | { id: AuditId; at: number; actorId: UserId; action: 'mfa.challenge' | 'mfa.reset'; targetId: UserId }
  | { id: AuditId; at: number; actorId: UserId; action: 'session.revoked'; targetId: SessionId; subjectId: UserId }
  | { id: AuditId; at: number; actorId: UserId; action: 'ticket.created' | 'ticket.resolved' | 'ticket.escalated'; targetId: TicketId };

export interface Incident {
  id: IncidentId;
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'contained' | 'eradicated' | 'recovered' | 'closed';
  detectedAt: number;
  containedAt?: number;
  closedAt?: number;
  affectedUserIds: UserId[];
  affectedAppIds: AppId[];
  summary: string;
  indicators: string[];
  containmentActions: { at: number; actorId: UserId; action: string }[];
  reportBody?: string;
}

export interface AccessReview {
  id: ReviewId;
  campaign: string;
  openedAt: number;
  dueAt: number;
  status: 'open' | 'in-progress' | 'closed';
  decisions: {
    userId: UserId;
    groupId: GroupId;
    roleId?: RoleId;
    decision: 'approve' | 'revoke';
    decidedBy: UserId;
    decidedAt: number;
    note?: string;
  }[];
}
```

```ts
// Labs
export type StepGateMode = 'sequential' | 'any-order';
export type ValidatorKind =
  | 'ticket-resolved' | 'user-disabled' | 'user-created'
  | 'group-added' | 'group-removed' | 'role-granted' | 'role-revoked'
  | 'app-config-fixed' | 'signin-succeeded' | 'mfa-challenge-completed'
  | 'session-revoked' | 'review-decisions-recorded' | 'evidence-collected'
  | 'fault-cleared' | 'audit-note-written';

export interface LabStep {
  id: string;
  title: string;
  brief: string;
  validator: { kind: ValidatorKind; params: Record<string, unknown> };
  evidence: { kind: EvidenceKind; capture: 'auto' | 'manual'; params?: Record<string, unknown> }[];
  tutorPrompts: string[];
  hintIds: string[];
  points?: { exec?: number; troubleshoot?: number; leastPrivilege?: number; docs?: number; evidence?: number; comms?: number };
}

export interface LabObjective {
  id: string;
  description: string;
  points: number;
  category: 'exec' | 'troubleshoot' | 'least-privilege' | 'docs' | 'evidence' | 'comms';
}

export interface FaultInjection {
  id: string;
  kind: FaultKind;
  applyAtStep: string;
  params: Record<string, unknown>;
  targetAppId?: AppId;
  targetUserId?: UserId;
}

export interface Lab {
  id: LabId;
  number: number;
  title: string;
  brief: string;
  durationMinutes: number;
  zoneIds: string[];
  startingZone: string;
  startingSeed: 'baseline' | 'after-lab01' | 'after-lab02' | …;
  objectives: LabObjective[];
  steps: LabStep[];
  faults: FaultInjection[];
  debriefQuestions: string[];
}
```

```ts
// Evidence
export interface Evidence {
  id: EvidenceId;
  labId: LabId;
  stepId: string;
  kind: EvidenceKind;
  capturedAt: number;
  payload: unknown;
  label: string;
}

// Score
export interface ScoreBreakdown {
  labId: LabId;
  exec: number;
  troubleshoot: number;
  leastPrivilege: number;
  docs: number;
  evidence: number;
  comms: number;
  total: number;
  notes: string[];
}
```

---

## 4. Mock Identity Services

All services are in-process TypeScript classes. They live entirely in memory. Every mutation appends to the audit log where appropriate.

### 4.1 `MockDirectory`
```ts
class MockDirectory {
  listUsers(filter?: Partial<User>): User[];
  getUser(id: UserId): User | undefined;
  createUser(input: Omit<User, 'id' | 'createdAt' | 'status' | 'mfa'> & { mfa?: MfaMethod }): User;
  disableUser(id: UserId, by: UserId, reason: string): void;
  unlockUser(id: UserId, by: UserId): void;
  addToGroup(userId: UserId, groupId: GroupId, by: UserId): void;
  removeFromGroup(userId: UserId, groupId: GroupId, by: UserId): void;
  listGroups(): Group[];
  createRole(input: Omit<Role, 'id'>): Role;
  grantRole(userId: UserId, roleId: RoleId, by: UserId): void;
  revokeRole(userId: UserId, roleId: RoleId, by: UserId): void;
  effectiveRoleIds(userId: UserId): RoleId[];
  isDormant(userId: UserId, days: number): boolean;
}
```
Every mutating call writes an `AuditEvent`.

### 4.2 `MockIdP`
```ts
class MockIdP {
  signIn(username, password, ip?, asn?):
    | { ok: true; session: Session; user: User }
    | { ok: false; reason: 'bad-password' | 'disabled' | 'locked' | 'mfa-required' | 'conditional-block' };
  completeMfa(sessionId, method): { ok: boolean; reason?: string };
  signOut(sessionId, by);
  revokeAllSessions(userId, by): number;
  resetMfa(userId, by);
  setConditionalPolicy(policy);
  samlAssertion(appId, userId);
  oidcToken(appId, userId, code);
  events(userId?, sinceAt?): AuditEvent[];
}
```
`MockIdP` reads time from a swappable `now()` so `FaultService` can shift time.

### 4.3 `MockAppServer`
```ts
class MockAppServer {
  apps(): Application[];
  getApp(id: AppId): Application | undefined;
  ssoLogin(appId, userId): { ok: true; appSessionId: string } | { ok: false; reason: string };
  fixConfigField(appId, field, value, by);
}
```
`reason` codes: `'invalid-redirect-uri' | 'expired-cert' | 'wrong-issuer' | 'missing-role' | 'mfa-required' | 'mfa-failed' | 'claim-mismatch' | 'app-offline'`.

### 4.4 `MockTicketQueue`
```ts
class MockTicketQueue {
  list(filter?): Ticket[];
  get(id): Ticket | undefined;
  create<T extends Ticket>(t): T;
  assign(id, by);
  comment(id, by, body);
  approve(id, by, note?);
  resolve(id, by);
  escalate(id, by);
}
```

### 4.5 `MockAuditLog`
Append-only. Other services call `audit.record(event)` on each mutation.

### 4.6 `MockAccessReviews`
```ts
class MockAccessReviews {
  openCampaign(c): AccessReview;
  recordDecision(reviewId, d);
  close(reviewId);
  pendingFor(managerId): AccessReview['decisions'];
}
```

### 4.7 `MockIncidents`
```ts
class MockIncidents {
  list(): Incident[];
  open(input): Incident;
  contain(id, action, by);
  recover(id, by);
  writeReport(id, body, by);
}
```

### 4.8 `FaultService`
A registry of mutator functions. The conductor asks the fault service to apply a fault at a given step; the service mutates the relevant mock and records an `AuditEvent` with `actorId = 'system'`.

```ts
type FaultMutator = (ctx: { idp: MockIdP; dir: MockDirectory; apps: MockAppServer; now: () => number }) => void;

const faultRegistry: Record<FaultKind, FaultMutator> = {
  'wrong-redirect-uri':     ({ apps }) => apps.getApp('app-finance')!.configDiffFromBaseline!['redirectUri'] = { expected: 'https://finance.northwind.example/cb', actual: 'https://finance.northwind.example/oops' },
  'expired-cert':            ({ apps }) => { const a = apps.getApp('app-finance')!; a.status = 'misconfigured'; a.configDiffFromBaseline!['cert.validUntil'] = { expected: '2027-01-01', actual: '2024-01-01' }; },
  'wrong-issuer':            ({ apps }) => apps.getApp('app-finance')!.configDiffFromBaseline!['issuer'] = { expected: 'https://idp.northwind.example/realms/northwind', actual: 'https://idp.northwind.example/realms/wrong' },
  'wrong-client-secret':     ({ apps }) => apps.getApp('app-finance')!.configDiffFromBaseline!['clientSecret.match'] = { expected: true, actual: false },
  'wrong-claim-mapping':     ({ apps }) => apps.getApp('app-finance')!.configDiffFromBaseline!['claim.role'] = { expected: 'role', actual: 'group' },
  'missing-role':            ({ dir }) => dir.removeFromGroup('user-jane', 'grp-finance-payroll', 'system'),
  'clock-skew':              ({ idp }) => { const real = Date.now; (idp as any).now = () => real() + 6 * 60 * 1000; },
  'dns-resolution':          ({ apps }) => apps.getApp('app-finance')!.status = 'offline',
  'mfa-prompt-loop':         ({ idp }) => { /* monkey-patch completeMfa to fail every other call */ },
  'suspicious-signin':       ({ idp }) => { /* schedule 3 sign-ins from foreign IP at step start */ },
  'excessive-permissions':   ({ dir }) => dir.grantRole('user-bob', 'role-domain-admin', 'system'),
  'dormant-account':         ({ dir }) => { const u = dir.getUser('user-bob')!; u.lastSignInAt = Date.now() - 200 * 24 * 3600 * 1000; },
};
```

### 4.9 Seed data per lab

All labs share a fictional company: **Northwind Labs** (domain `northwind.example`, IdP realm `northwind`).

**Baseline (post-Lab-01) seed — shared by Labs 02–10:**
- Departments: HR, Finance, Engineering, IT, Security.
- OUs: `ou=Users,ou=Groups,ou=Computers,ou=Servers,ou=ServiceAccounts`.
- Security groups: `grp-hr-readers`, `grp-finance-payroll`, `grp-engineering-dev`, `grp-helpdesk-tier1`, `grp-iam-admins`, `grp-sec-ops`, `grp-domain-admins` (privileged), `grp-server-admins` (privileged).
- Service accounts: `svc-backup`, `svc-monitor`, `svc-idp-sync`.
- Users (fictional, consistent across labs):
  - `user-alex` — Alex Morgan, Finance / Payroll Analyst
  - `user-bob` — Bob Sato, Engineering / Dev (dormant in Lab 06)
  - `user-cara` — Cara Patel, HR / HRBP
  - `user-dan` — Dan Rivera, IT / Help Desk Tier 1
  - `user-erin` — Erin Cho, IT / IAM Admin
  - `user-finn` — Finn Müller, Security / SecOps
  - `user-greta` — Greta Olsen, Finance / CFO
  - `user-hank` — Hank O'Neill, IT / Server Admin
  - `user-ivy` — Ivy Park, IT / Help Desk Manager
  - `user-jane` — Jane Doe, Finance / Junior Analyst
- Applications: `app-hr-portal` (OIDC), `app-finance` (SAML), `app-helpdesk-portal` (OIDC), `app-vpn-portal` (OIDC, role `role-vpn-users`), `app-admin-console` (OIDC, requires `role-iam-admins` + MFA).
- IdP: realm `northwind`, MFA required for `role-iam-admins` and `role-domain-admins`.
- Help desk: only `user-dan` and `user-ivy` can reset MFA / passwords (RBAC).

Per-lab seed deltas are listed in §11.

---

## 5. State Management

**Choice: zustand.** No provider, no context, works perfectly with vanilla Three.js. One store per concern.

### 5.1 `progressStore` (persisted to localStorage)
```ts
interface ProgressState {
  completedLabIds: LabId[];
  bestScores: Record<LabId, ScoreBreakdown>;
  startedAt: Record<LabId, number>;
  markComplete(labId, score);
  reset();
}
```

### 5.2 `labStore`
```ts
interface LabState {
  current: Lab | null;
  stepIndex: number;
  stepStatuses: Record<string, 'pending' | 'in-progress' | 'done' | 'failed'>;
  failed: boolean;
  load(lab);
  start();
  advance();
  fail(reason);
}
```

### 5.3 `ticketStore`
```ts
interface TicketState {
  tickets: Ticket[];
  selectedId: TicketId | null;
  refresh();
  select(id);
  act(action);
}
```

### 5.4 `auditStore`
```ts
interface AuditState {
  events: AuditEvent[];
  filter: { actorId?: UserId; action?: string; sinceAt?: number };
  append(e);
  setFilter(f);
  byUser(id);
}
```

### 5.5 `faultStore`
```ts
interface FaultState {
  active: FaultKind[];
  log: { at: number; kind: FaultKind; stepId: string }[];
  apply(kind, stepId);
  clear(kind);
}
```

### 5.6 `tutorStore`
```ts
interface TutorState {
  dialog: { from: 'tutor' | 'learner' | 'system'; at: number; body: string; promptIds?: string[] }[];
  hintLevel: 0 | 1 | 2 | 3;
  explanationMode: boolean;
  ask(promptIds);
  answer(body);
  bumpHint();
  setExplanationMode(on);
}
```

### 5.7 `evidenceStore`
```ts
interface EvidenceState {
  items: Evidence[];
  add(e);
  byStep(stepId);
  byLab(labId);
}
```

### 5.8 `scoreStore`
```ts
interface ScoreState {
  current: ScoreBreakdown | null;
  history: ScoreBreakdown[];
  set(b);
  addNote(n);
}
```

### 5.9 Cross-store rules
- **Services own truth.** Stores mirror services. The conductor orchestrates services, then refreshes store slices.
- **UI is reactive.** A tiny pub/sub in `ui/` subscribes to specific slices.

---

## 6. 3D Scene Architecture

### 6.1 One scene, zone-managed
A **single Three.js scene** is loaded at boot. Zones are **sub-scenes** (groups) attached under a root. Doors between zones are portals that the player walks through; the engine fades for 200 ms and snaps the player to the door's exit point.

### 6.2 Renderer
```ts
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#0e1116');

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 1.7, 5);
```

A first-person controller. Pointer-lock for mouse look. WASD for movement, `Shift` to sprint, `E` to interact, `Tab` for tickets, `H` for hint, `R` to reset lab (with confirm).

### 6.3 Navigation
- **WASD + pointer-lock** primary.
- **Click-to-move** fallback: raycast on ground plane, walk there.
- **No jumping, no flying, no furniture collision.** Walls are tall invisible boxes; AABB sweep.

### 6.4 Interactive consoles
Each console is a `THREE.Group` with `userData.kind = 'console' | 'door' | 'npc'`. Each frame the engine raycasts from the camera center; if it hits a console within 3 m, it lights up and the HUD shows the interaction label. Pressing `E` emits `consoleActivated(id)` on the bus.

### 6.5 UI rendering — HTML overlay vs. in-scene panels
- **HUD:** HTML overlay, fixed-position divs.
- **In-scene readouts:** `CanvasTexture` for big text (e.g. rack status grid).
- **Panels the user reads closely (IAM Console):** HTML overlay docked to projected world position.
- **Tickets and audit log:** HTML panel only.

### 6.6 Asset strategy (thin slice)
- **Procedural geometry only** in v1. No GLTF, no textures, no audio.
- **Lighting:** one hemispheric + one directional per zone.
- **No physics.**
- `RoomEnvironment` for IBL on shiny consoles.

### 6.7 Performance budget
- 10 zones × ~200 primitives ≈ 2 000 meshes.
- All materials use `MeshStandardMaterial`.

### 6.8 Zone-to-zone transition
200 ms `renderer.toneMappingExposure` fade to black, set player position to target door's exit, fade back.

---

## 7. Conductor / Lab Runner

A single `Conductor` class in `src/conductor/conductor.ts` consumes a `Lab` and runs it. It owns references to all services and stores.

### 7.1 Lifecycle
1. `conductor.start(labId)` → load `Lab` → apply `startingSeed` to a fresh service set → push to `labStore.start()`.
2. **For each `step` in `lab.steps`:**
   - Mark `step in_progress`.
   - Register the step's validator with the service event bus.
   - When a matching event fires, call the step's `validate()` predicate. If true:
     - Capture the step's evidence.
     - Apply points per `lab.objectives[].category`.
     - Mark `step done` and call `labStore.advance()`.
3. When all steps are done, call `debrief.build(lab, evidence, score)` and show `debriefPanel`.
4. `conductor.reset()` → teardown listeners, re-seed services, push `labStore.load(lab)` again.

### 7.2 Validators (`src/conductor/validate.ts`)
Pure functions of `(ctx, event) => boolean | { ok: true } | { ok: false; why: string }`. The bus is a tiny in-process emitter (`util/events.ts`).

### 7.3 Scoring (`src/conductor/score.ts`)
Each `LabObjective` declares a category and max points. The conductor allocates a step's points across the step's objectives, declared on the lab (`step.points: { exec?, troubleshoot?, … }`).

Penalties:
- Wrong action: −2 per failed `validate` (capped at −10) under `troubleshoot`.
- Excessive permission retention at debrief = 0 on `leastPrivilege`.
- Missing evidence at debrief = 0 on `evidence`.

### 7.4 Evidence capture (`src/conductor/evidence.ts`)
- `'snapshot'`: serialize panel state to JSON.
- `'log-excerpt'`: last N `AuditEvent` rows matching step filter.
- `'config-diff'`: snapshot app config vs. lab baseline.
- `'ticket' | 'audit-event'`: store reference id.

### 7.5 Debrief (`src/conductor/debrief.ts`)
HTML report with score bars, per-step pass/fail + evidence thumbnails, pre-written answers, and interview prompts.

### 7.6 What the conductor does NOT do
- Render 3D.
- Own UI.
- Call LLM APIs.
- Persist to disk beyond the `progressStore` writing the final score.

---

## 8. Tutor Service

The tutor is a **local rule engine** in v1 — no network calls.

### 8.1 `tutor/questionBank.ts`
```ts
export const questionBank: Record<string, string[]> = {
  'lab01.step1': [
    'Before you start clicking, what is the first artifact you would create and why?',
    'Which service provides naming authority for everything else you will build?',
  ],
  'lab01.step3': [
    'How will you prove the user actually authenticates and is not just a record in a list?',
  ],
};
```

### 8.2 `tutor/hintLadder.ts`
3 levels per question, increasing detail.
```ts
export const hintLadder: Record<string, [string, string, string]> = {
  'lab01.step1.h1': [
    'Think about the service everything else will look up to find each other.',
    'You will need a directory service — the rest of the stack joins to it.',
    'Promote a server to a domain controller and choose a DNS name for the forest root (e.g. northwind.example).',
  ],
};
```

### 8.3 `tutor/explanationMode.ts`
Boolean in `tutorStore`. When on, the tutor may give a step's full answer immediately.

### 8.4 `tutor/tutorService.ts`
Picks the right prompt based on `labId + stepId`, `hintLevel`, recent learner actions, and a stuck timer. v1 mapping is a small lookup table.

### 8.5 Why no LLM in v1
- Thin slice must be deterministic and zero-cost.
- All labs are short; bank is <300 entries.
- LLM is a future upgrade: replace `tutorService.ask()` body with a fetch to a self-hosted model (e.g. via Ollama) and reuse the same prompts as system messages.

---

## 9. Logging / Audit / Evidence

### 9.1 Audit log
- `MockAuditLog` is the source of truth; `auditStore` is a read mirror.
- Every mutating service call calls `audit.record(event)` first.
- Security Ops zone shows a dedicated HTML console with filters.

### 9.2 Evidence
- Structured records: snapshot, log excerpt, config diff, ticket id, audit id.
- Snapshots are **JSON of the panel's state at capture time** — a structured "screenshot" that survives resets.

### 9.3 Faking a "screenshot"
- Panel modules expose `getState(): unknown`.
- `snapshot.capture(panelId)` returns `{ kind: 'snapshot', payload: panel.getState(), label, at }`.
- The evidence tray re-renders each snapshot via `panel.render(state)` against a hidden container.

### 9.4 Evidence requirements
Each `LabStep` lists its required `evidence[]`. The conductor captures them at completion (`'auto'`) or reminds the learner to click "Capture" (`'manual'`). Score for `evidence` = `100% × (captured / required)`.

---

## 10. Reset & Recovery

### 10.1 Reset contract
- `Lab.startingSeed: 'baseline' | 'after-labXX' | …` — the seed chain.
- `services.resetTo(seedKey)` — wipes primary services + audit + reviews + incidents + faults, re-applies seed chain.
- Conductor reinstalls the lab's `FaultInjection`s after the seed is in place.
- Reset is **idempotent**: pressing reset twice produces the same world.

### 10.2 Triggers
- `R` keyboard shortcut (with confirm).
- "Reset Lab" button in HUD.
- Automatic reset on entering a new lab.

### 10.3 Mid-step recovery
If a step's validator fails:
- Log failure to audit (`learner.error`).
- Don't advance.
- Tutor surfaces a misconception-targeting question.
- Allow undo; the conductor re-runs the validator.

---

## 11. Thin-Slice Lab Definitions

Each entry below is the **minimum viable lab**. Steps are numbered for the conductor; the original 10–12-step spec is collapsed to 3–8.

### Lab 01 — IAM Foundation
- **Seed:** empty (no users, no groups, no apps; one IdP realm ready).
- **Steps:**
  1. Create the directory: 5 OUs, 5 security groups, 3 service accounts.
  2. Create 5 baseline users and assign them to the correct groups.
  3. Stand up the IdP (realm `northwind`, default admin user).
  4. Apply a baseline policy (password length 12, MFA required for `role-iam-admins`).
  5. Authenticate as one baseline user; capture the resulting session in audit.
- **Faults:** none.
- **Evidence:** snapshot of group list; snapshot of one user's effective roles; audit excerpt of the sign-in.
- **Debrief:** "Why is naming consistency a security control, not just an aesthetic choice?"

### Lab 02 — Joiner / Mover / Leaver
- **Seed:** post-Lab-01 baseline.
- **Steps:**
  1. Resolve the **onboarding** ticket for `user-alex`. Verify Alex can sign in to `app-finance`.
  2. Resolve the **transfer** ticket for `user-jane` (Finance → Engineering). Verify Jane can no longer reach `app-hr-portal`.
  3. Resolve the **termination** ticket for `user-bob`. Verify Bob cannot sign in.
- **Faults:** none.
- **Evidence:** three user-state snapshots; audit excerpt of session revocations.
- **Debrief:** "What is the smallest set of actions that would have left Jane with stale HR access? How would you detect it?"

### Lab 03 — RBAC & Least Privilege
- **Seed:** post-Lab-01 + Finance requests `app-finance` access.
- **Steps:**
  1. Create `role-finance-payroll-writer`. Do not grant direct user permissions.
  2. Add `user-jane` to `grp-finance-payroll`. Verify Jane gets the role via group membership.
  3. Discover `user-bob` has `role-domain-admin` standing privilege. Remove and document.
  4. Test denial: as `user-alex`, attempt to write a payroll entry → expect denied.
- **Faults:** `excessive-permissions` (Bob has standing admin).
- **Evidence:** role catalog snapshot; "denied" audit excerpt; removal audit excerpt.
- **Debrief:** "If a group membership can grant a role, where does authorization actually happen?"

### Lab 04 — Enterprise SSO (SAML + OIDC)
- **Seed:** post-Lab-01 + `app-finance` (SAML) and `app-helpdesk-portal` (OIDC).
- **Steps:**
  1. Configure `app-finance` as a SAML client.
  2. Configure `app-helpdesk-portal` as an OIDC client.
  3. Map the `role` claim to `grp-helpdesk-tier1`.
  4. Sign in as `user-dan` and reach both apps without re-entering credentials.
- **Faults:** `wrong-redirect-uri` injected at step 4 to test recovery in the debrief.
- **Evidence:** two app config snapshots; audit excerpt of two SSO sign-ins.
- **Debrief:** "What is the trust boundary in SAML — the browser, the IdP, or the SP?"

### Lab 05 — MFA & Conditional Access
- **Seed:** post-Lab-04 + `user-erin` (IAM Admin) without MFA.
- **Steps:**
  1. Enable MFA for `role-iam-admins` and `role-domain-admins`.
  2. Enroll `user-erin` in TOTP. Verify MFA sign-in works.
  3. Set a conditional policy: block foreign ASN; simulate; verify block.
  4. Fix the injected `mfa-prompt-loop`.
- **Faults:** `mfa-prompt-loop`.
- **Evidence:** MFA challenge audit; conditional policy snapshot; blocked sign-in audit.
- **Debrief:** "Where would you put a step-up auth requirement: IdP, app, or proxy?"

### Lab 06 — Access Reviews
- **Seed:** post-Lab-01 + a Q3 review campaign with 8 pending decisions.
- **Steps:**
  1. Identify dormant accounts (`user-bob` is dormant).
  2. Identify excessive memberships (`user-bob` retains `grp-engineering-dev`).
  3. As `user-ivy`, record 8 review decisions (6 approve, 2 revoke).
  4. Close the campaign and produce a summary.
- **Faults:** `dormant-account` already in seed.
- **Evidence:** pending list snapshot; decisions audit; summary markdown.
- **Debrief:** "What signals would tell you a review campaign is being rubber-stamped?"

### Lab 07 — SSO Break/Fix
- **Seed:** post-Lab-04. `app-finance` initially healthy.
- **Steps:**
  1. Open an incident; the conductor injects a random fault.
  2. Triage: read app config, IdP logs, DNS / time.
  3. Identify the fault via config diff snapshot.
  4. Apply the fix via the field-level editor in the IAM Console.
  5. Retest: as `user-dan` and `user-erin`, both must sign in successfully.
- **Faults:** one of `wrong-redirect-uri | expired-cert | wrong-issuer | wrong-client-secret | wrong-claim-mapping | missing-role | clock-skew | dns-resolution`, randomized per run.
- **Evidence:** config diff (before/after); audit excerpt of two retest sign-ins; incident closure.
- **Debrief:** "Why did you check DNS before certificates?"

### Lab 08 — Identity Incident Response
- **Seed:** post-Lab-01 + a `user-jane` account with three suspicious sign-ins (foreign ASN, rapid retry, then success).
- **Steps:**
  1. Open an incident; identify the affected user.
  2. Contain: disable `user-jane`, revoke all sessions, reset credentials, reset MFA.
  3. Search audit for related activity.
  4. Write a concise incident report.
  5. Close the incident.
- **Faults:** `suspicious-signin` already in seed.
- **Evidence:** incident timeline snapshot; containment audit; report body.
- **Debrief:** "What is the difference between containment and eradication here? When would you re-enable the account?"

### Lab 09 — Privileged Access
- **Seed:** post-Lab-01 + `user-hank` has standing `role-domain-admins`.
- **Steps:**
  1. Identify privileged groups and their members.
  2. Remove Hank's standing privilege.
  3. Use an "elevate" workflow: request → manager approval (Ivy) → 15-min grant → one admin action → auto-revoke.
  4. Review the administrative activity log.
  5. Document the approval and elevation.
- **Faults:** none.
- **Evidence:** grant+revoke audit; elevation request snapshot; admin activity log excerpt.
- **Debrief:** "When is a break-glass account appropriate, and what guardrails does it still need?"

### Lab 10 — Capstone
- **Seed:** fresh (`baseline`) with five new employees to onboard, two to move, one to terminate; SSO + MFA + review + incident flows from Labs 04–08 in scope.
- **Steps (8 condensed from 14):**
  1. Onboard 5 employees from HR tickets.
  2. Move 2 employees between departments; remove stale access.
  3. Terminate 1 employee; verify no residual access.
  4. Integrate 2 apps with SSO (one SAML, one OIDC).
  5. Enforce MFA for `role-iam-admins` and `role-domain-admins`.
  6. Conduct the Q3 access review.
  7. Resolve an injected SSO break/fix.
  8. Resolve an identity incident; close the campaign.
  9. Produce the final audit report and the architecture diagram.
- **Faults:** one SSO fault + one suspicious-signin sequence.
- **Evidence:** per step (mostly auto). Final deliverable: audit report + `debrief.md` exported to clipboard.
- **Debrief:** graded against the 100-pt rubric. Score ≥ 85 with all steps passing is the job-readiness gate.

---

## 12. Build Order

### Phase A — Scaffold (½ day)
- `app/` folder; `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`.
- `src/main.ts` boots a Vite-served page with a single `<canvas id="app">`.
- `src/three/engine.ts` creates renderer, scene, camera, gray floor, FPS counter.
- 60 FPS loop, `console.log` "engine ready".

### Phase B — Domain + seed + services (1 day)
- `src/domain/types.ts`, `enums.ts`, `ids.ts`.
- All `services/*` modules.
- `src/seed/baseline.ts` and empty `perLab/lab01.ts`.
- `src/util/assert.ts`, `util/log.ts`, `util/events.ts`.
- Vitest tests for each service covering create/disable/grant/sign-in/resolve.

### Phase C — Stores + conductor skeleton (½ day)
- All eight zustand stores.
- `src/conductor/conductor.ts` with `start(labId)`, `reset()`, no validators yet.
- `src/labs/registry.ts` with stub `Lab` entries.

### Phase D — 3D shell (1 day)
- Procedural zones: one zone (Reception) with floor, four walls, a "door" mesh.
- WASD + pointer-lock nav.
- One interactive console in Reception — pressing `E` writes to `tutorStore.dialog`.
- HUD top bar (lab/step/score placeholders).

### Phase E — Lab 01 end-to-end (1–2 days)
- Implement the 5 Lab 01 steps + validators + evidence + scoring.
- Seed Lab 01.
- Tutorial overlay; conductor runs the lab; debrief shows.
- **This phase proves the entire pattern.**

### Phase F — Labs 02–10 as thin slices (3–4 days)
- One lab per ~½ day in priority order: 02, 03, 04, 05, 07, 08, 06, 09, 10.
- Each lab ships: step list, seed file, fault (where applicable), tutor prompt stub.

### Phase G — Tutor service (½ day)
- `questionBank.ts` and `hintLadder.ts` populated for Labs 01–05 first, then 06–10.
- `tutorService.ts` with prompt + hint resolution.
- `tutorPanel.ts` UI: dialog, hint button, explanation-mode toggle.

### Phase H — Scoring + debrief (½ day)
- `score.ts` with per-category allocation.
- `debrief.ts` producing the final HTML report.
- `progressStore` persisting best scores to localStorage.

### Phase I — Polish (1 day, optional)
- Zone transitions (200 ms fade).
- Audio cues via `AudioContext` oscillators.
- Accessibility: full keyboard nav, high-contrast theme toggle, captions.
- "Settings" panel.

**Total: ~10 working days for a thin slice across all 10 labs.**

---

## 13. Verification Plan

### Phase A — done when
- `npm install` succeeds, `npm run dev` serves the page.
- A 1024×768 gray canvas shows 60 FPS sustained.
- `npm test` passes (zero tests, no errors).
- `npm run build` produces `app/dist/index.html`, total bundle < 1 MB.

### Phase B — done when
- `npm test` runs and passes ≥ 30 unit tests across services.
- A temporary `src/dev/seedDump.ts` prints the baseline user list; IdP sign-in succeeds for `user-alex`.

### Phase C — done when
- `conductor.start('lab01')` from the browser console loads the lab; `labStore.current?.id === 'lab01'`.
- `conductor.reset()` returns the world to the same baseline snapshot (deep equal).

### Phase D — done when
- WASD moves the camera; mouse look works; the door logs "door activated" on `E`.
- The console in Reception writes a `tutorStore.dialog` entry on `E`.
- No console errors; sustained 60 FPS.

### Phase E — done when
- A fresh `npm run dev` boot lands the player in the IAM zone.
- `labStore.stepIndex` advances 0 → 4 as the learner completes each step.
- Completing all 5 steps produces the debrief screen with a `ScoreBreakdown` whose `total` is 0–100.
- Evidence tray shows at least one captured snapshot and one audit excerpt.

### Phase F — done when
- Each lab in 02–10 is reachable from the main menu, completable end-to-end, and resets cleanly.
- `npm test labs` verifies that for each lab, the conductor advances from step 0 to step N given the right synthetic events.

### Phase G — done when
- The tutor panel displays a question at every step entry.
- Pressing "Hint" three times reaches the strongest hint; pressing "Explain" reveals the final answer (with the warning).
- Dialog is captioned and screen-reader accessible (`aria-live="polite"`).

### Phase H — done when
- Completing a lab writes the score to `localStorage`; main menu shows the best score for that lab.
- Reloading the page preserves the score.
- The debrief shows all six rubric categories with the correct math.

### Phase I — done when
- Walking through a door fades and respawns the camera in the target zone within 250 ms.
- Door chimes play on door activation; ticket jingle plays on new ticket.
- The settings panel persists all toggles to `localStorage`.

### Cross-cutting Definition of Done (mirrors CLAUDE.md)
- The workflow is executable.
- The learner can make mistakes.
- The system detects mistakes.
- The learner can troubleshoot.
- Results are validated.
- Evidence is generated.
- The lab can be reset.
- The learner can explain the outcome.

---

## 14. Risks & Open Questions

### Risks
1. **Scope creep on 3D fidelity.** Mitigation: §6.6 explicitly forbids GLTF and postFX in v1.
2. **Tutor feels rote.** Mitigation: keep prompts short, vary the question, offer an LLM upgrade path.
3. **Validator sprawl.** Mitigation: validators are pure functions; per-lab smoke tests in Phase F.
4. **State mirroring drift.** Mitigation: services are the source of truth; conductor explicitly calls `store.refresh()`.
5. **Time-to-interactive for many zones.** Mitigation: zones are tiny procedural meshes.
6. **localStorage schema drift.** Mitigation: `progressStore` stores a `version` field.
7. **Pointer-lock UX.** Triggered on canvas click; click-to-move fallback.
8. **Determinism for break/fix.** Each run seeds `Math.random` with the lab start time.
9. **Snapshot re-render cost.** Cap at 20 snapshots per lab.
10. **"Faking" screenshots may feel unsatisfying.** Mitigation: thumbnails are HTML re-renders of panel state — visually identical to the live panel; the JSON underneath is the actual ground truth (better for evidence in a real audit).

### Open questions
1. **Clock-skew tolerance window.** v1 uses ±5 minutes; configurable in `MockIdP`.
2. **Sound.** Default off; toggle on in Phase I.
3. **Capstone grading.** v1 auto-graded. Human-grading is v2.
4. **LLM tutor upgrade path.** v2: replace `tutorService.ask()` with a fetch to a local model; same return shape.
5. **Export of the audit report.** v1 ships Blob → anchor-click download.
6. **Multiplayer / instructor view.** Out of scope for v1.
7. **Accessibility audit.** Phase I includes captions and keyboard nav; a real WCAG pass is a separate effort.
8. **Capstone architecture diagram.** v1 ships a hand-drawn SVG embedded in the debrief; a drag-and-drop editor is v2.

---

## 15. Final Notes

- **One company, one set of users, one IdP realm, ten labs.** Every lab advances the same world.
- **All 100 points per lab stay within the six categories** declared in `3D_LAB_DESIGN_SPEC.md` and CLAUDE.md.
- **No network, no real services, no real credentials.** Seed names (Northwind, Alex Morgan, etc.) are clearly fictional and consistent.
- **The conductor is the spine.** Every lab is a data file. Adding Lab 11 is `seed/perLab/lab11.ts` + `labs/lab11.ts` only.
- **The thin slice proves the pattern.** Once Labs 01–10 are playable end-to-end, depth is mechanical.

### Critical Files for Implementation
- `app/src/domain/types.ts` — the domain model everything else imports.
- `app/src/conductor/conductor.ts` — the single module that runs all ten labs.
- `app/src/three/engine.ts` — the renderer + scene + nav the entire 3D layer hangs off.
- `app/src/services/mockIdP.ts` — authentication, sessions, MFA, conditional access; the most behavior-rich service.
- `app/src/labs/lab01.ts` — the first lab definition that proves the conductor end-to-end (Phase E).
