/**
 * services/faultService.ts — registry of fault mutators.
 */
import type { FaultKind, AppId, UserId, SessionId } from '@/domain';
import { SYSTEM_ACTOR, mkSessionId } from '@/domain';
import { COMPANY } from '@/config';
import type { MockDirectory } from './mockDirectory';
import type { MockIdP } from './mockIdP';
import type { MockAppServer } from './mockAppServer';
import type { MockAuditLog } from './mockAuditLog';

export interface FaultContext {
  dir: MockDirectory;
  idp: MockIdP;
  apps: MockAppServer;
  audit: MockAuditLog;
  targetAppId?: AppId;
  targetUserId?: UserId;
}

export type FaultMutator = (ctx: FaultContext) => void;

function pickApp(ctx: FaultContext) {
  return ctx.targetAppId ? ctx.apps.getApp(ctx.targetAppId) : ctx.apps.apps()[0];
}

const faultRegistry: Record<FaultKind, FaultMutator> = {
  'wrong-redirect-uri': (ctx) => {
    const app = pickApp(ctx);
    if (!app) return;
    app.configDiffFromBaseline = {
      ...(app.configDiffFromBaseline ?? {}),
      redirectUri: { expected: app.redirectUri, actual: 'https://finance.northwind.example/oops' },
    };
  },
  'expired-cert': (ctx) => {
    const app = pickApp(ctx);
    if (!app) return;
    app.status = 'misconfigured';
    app.configDiffFromBaseline = {
      ...(app.configDiffFromBaseline ?? {}),
      'cert.validUntil': { expected: '2027-01-01', actual: '2024-01-01' },
    };
  },
  'wrong-issuer': (ctx) => {
    const app = pickApp(ctx);
    if (!app || !app.issuer) return;
    app.configDiffFromBaseline = {
      ...(app.configDiffFromBaseline ?? {}),
      issuer: { expected: app.issuer, actual: `${COMPANY.idpUrl}-wrong` },
    };
  },
  'wrong-client-secret': (ctx) => {
    const app = pickApp(ctx);
    if (!app) return;
    app.configDiffFromBaseline = {
      ...(app.configDiffFromBaseline ?? {}),
      'clientSecret.match': { expected: true, actual: false },
    };
  },
  'wrong-claim-mapping': (ctx) => {
    const app = pickApp(ctx);
    if (!app) return;
    app.configDiffFromBaseline = {
      ...(app.configDiffFromBaseline ?? {}),
      'claim.role': { expected: 'role', actual: 'group' },
    };
  },
  'missing-role': (ctx) => {
    if (!ctx.targetUserId) return;
    const g = ctx.dir.getGroupByName('grp-finance-payroll');
    if (g) ctx.dir.removeFromGroup(ctx.targetUserId, g.id, SYSTEM_ACTOR);
  },
  'clock-skew': (ctx) => {
    const realNow = Date.now;
    ctx.idp.now = () => realNow() + 6 * 60 * 1000;
  },
  'dns-resolution': (ctx) => {
    const app = pickApp(ctx);
    if (!app) return;
    app.status = 'offline';
  },
  'mfa-prompt-loop': (ctx) => {
    if (!ctx.targetUserId) return;
    const u = ctx.dir.getUser(ctx.targetUserId);
    if (!u) return;
    let flip = false;
    const origComplete = ctx.idp.completeMfa.bind(ctx.idp);
    ctx.idp.completeMfa = (sessionId: SessionId, method: import('@/domain').MfaMethod) => {
      if (flip) return { ok: false, reason: 'mfa-challenge-failed' };
      flip = true;
      return origComplete(sessionId, method);
    };
  },
  'suspicious-signin': (ctx) => {
    if (!ctx.targetUserId) return;
    const u = ctx.dir.getUser(ctx.targetUserId);
    if (!u) return;
    const sessionId = mkSessionId('suspicious');
    for (let i = 0; i < 3; i++) {
      ctx.audit.record({
        actorId: u.id,
        action: 'signin.failure',
        targetId: u.id,
        sessionId,
        ip: '203.0.113.42',
      });
    }
    ctx.audit.record({
      actorId: u.id,
      action: 'signin.success',
      targetId: u.id,
      sessionId,
      ip: '203.0.113.42',
    });
  },
  'excessive-permissions': (ctx) => {
    if (!ctx.targetUserId) return;
    const role = ctx.dir.createRole(
      'role-domain-admins',
      'Domain Administrators',
      ['domain:*'],
      undefined,
      SYSTEM_ACTOR,
    );
    ctx.dir.grantRoleDirect(ctx.targetUserId, role.id, SYSTEM_ACTOR);
  },
  'dormant-account': (ctx) => {
    if (!ctx.targetUserId) return;
    const u = ctx.dir.getUser(ctx.targetUserId);
    if (!u) return;
    u.lastSignInAt = Date.now() - 200 * 24 * 60 * 60 * 1000;
  },
  // Stub mutators for the lab11–lab13 fault kinds. The lab validators
  // advance on the user's remediation action; these mutators currently
  // only record the fault presence in the audit log so the SecOps
  // Dashboard can surface them. Real implementations would change
  // IdP/sync behavior to match the scenario.
  'legacy-auth-misconfiguration': (ctx) => {
    if (!ctx.targetUserId) return;
    const u = ctx.dir.getUser(ctx.targetUserId);
    if (!u) return;
    ctx.audit.record({
      actorId: u.id,
      action: 'app.config.changed',
      targetId: u.id,
      diff: { fault: 'legacy-auth-misconfiguration' },
    });
  },
  'sync-soft-match-conflict': (ctx) => {
    if (!ctx.targetUserId) return;
    const u = ctx.dir.getUser(ctx.targetUserId);
    if (!u) return;
    ctx.audit.record({
      actorId: u.id,
      action: 'app.config.changed',
      targetId: u.id,
      diff: { fault: 'sync-soft-match-conflict' },
    });
  },
  'idp-mfa-outage': (ctx) => {
    if (!ctx.targetUserId) return;
    const u = ctx.dir.getUser(ctx.targetUserId);
    if (!u) return;
    ctx.audit.record({
      actorId: u.id,
      action: 'app.config.changed',
      targetId: u.id,
      diff: { fault: 'idp-mfa-outage' },
    });
  },
};

export class FaultService {
  constructor(private readonly ctx: FaultContext) {}

  apply(kind: FaultKind, params: { targetAppId?: AppId; targetUserId?: UserId } = {}): void {
    const mutator = faultRegistry[kind];
    if (!mutator) throw new Error(`[faults] unknown fault: ${kind}`);
    mutator({ ...this.ctx, ...params });
  }

  applyAll(faults: { kind: FaultKind; targetAppId?: AppId; targetUserId?: UserId }[]): void {
    for (const f of faults) this.apply(f.kind, f);
  }

  clearAll(): void {
    this.ctx.apps.reset();
    this.ctx.idp.now = () => Date.now();
  }
}

export { faultRegistry };
