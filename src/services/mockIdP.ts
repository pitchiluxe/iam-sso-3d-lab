/**
 * services/mockIdP.ts — in-memory identity provider.
 */
import { nanoid } from 'nanoid';
import type {
  MfaMethod, Session, SessionId, SignInResult, MfaResult, User, UserId, AppId, RoleId,
} from '@/domain';
import { mkSessionId } from '@/domain';
import type { MockAuditLog } from './mockAuditLog';
import type { MockDirectory } from './mockDirectory';

export type PasswordResolver = (username: string) => string | undefined;

export interface IdPConditionalPolicy {
  userId?: UserId;
  roleId?: RoleId;
  requireMfa: boolean;
  blockIf?: (ctx: { user: User; ip?: string; asn?: string }) => boolean;
}

export class MockIdP {
  private passwords = new Map<string, string>();
  private sessions  = new Map<SessionId, Session>();
  private policies: IdPConditionalPolicy[] = [];
  /** Time source — overridable for fault injection. */
  now: () => number = () => Date.now();

  constructor(
    private readonly audit: MockAuditLog,
    private readonly dir: MockDirectory,
    private passwordResolver: PasswordResolver = () => undefined,
  ) {}

  setPasswordResolver(r: PasswordResolver) { this.passwordResolver = r; }
  seedPasswords(map: Record<string, string>): void {
    for (const [u, p] of Object.entries(map)) this.passwords.set(u, p);
  }

  signIn(username: string, password: string, ip?: string, asn?: string): SignInResult {
    const user = this.dir.getUserByUsername(username);
    if (!user) return { ok: false, reason: 'bad-password' };
    if (user.status === 'disabled') return { ok: false, reason: 'disabled' };
    if (user.status === 'locked')   return { ok: false, reason: 'locked' };

    const expected = this.passwords.get(username) ?? this.passwordResolver(username);
    if (expected !== password) {
      const sessionId = mkSessionId('failed-' + nanoid(8));
      this.audit.record({
        actorId: user.id, action: 'signin.failure', targetId: user.id,
        sessionId, ip,
      });
      return { ok: false, reason: 'bad-password' };
    }

    for (const p of this.policies) {
      if (p.userId && p.userId !== user.id) continue;
      if (p.blockIf && p.blockIf({ user, ip, asn })) {
        return { ok: false, reason: 'conditional-block' };
      }
    }

    if (user.mfa !== 'none') {
      const session = this.createSession(user.id, ip, asn, false);
      return { ok: true, session, user };
    }

    const session = this.createSession(user.id, ip, asn, true);
    this.dir.recordSignIn(user.id);
    this.audit.record({ actorId: user.id, action: 'signin.success', targetId: user.id, sessionId: session.id, ip });
    return { ok: true, session, user };
  }

  completeMfa(sessionId: SessionId, _method: MfaMethod): MfaResult {
    const s = this.sessions.get(sessionId);
    if (!s) return { ok: false, reason: 'session-not-found' };
    s.mfaCompleted = true;
    const user = this.dir.getUser(s.userId);
    if (user) {
      this.dir.recordSignIn(user.id);
      this.audit.record({ actorId: user.id, action: 'mfa.challenge', targetId: user.id });
    }
    return { ok: true };
  }

  signOut(sessionId: SessionId, by: UserId): void {
    const s = this.sessions.get(sessionId);
    if (!s) return;
    this.audit.record({ actorId: by, action: 'signout', targetId: s.userId, sessionId });
    this.sessions.delete(sessionId);
  }

  revokeAllSessions(userId: UserId, by: UserId): number {
    let n = 0;
    for (const [sid, s] of this.sessions) {
      if (s.userId === userId) {
        this.sessions.delete(sid);
        this.audit.record({ actorId: by, action: 'session.revoked', targetId: sid, subjectId: userId });
        n++;
      }
    }
    return n;
  }

  resetMfa(userId: UserId, by: UserId): void {
    const u = this.dir.getUser(userId);
    if (!u) return;
    u.mfa = 'none';
    this.audit.record({ actorId: by, action: 'mfa.reset', targetId: userId });
  }

  enrollMfa(userId: UserId, method: MfaMethod, by: UserId): void {
    const u = this.dir.getUser(userId);
    if (!u) return;
    u.mfa = method;
    this.audit.record({ actorId: by, action: 'mfa.challenge', targetId: userId });
  }

  setConditionalPolicy(p: IdPConditionalPolicy): void { this.policies.push(p); }
  clearPolicies(): void { this.policies = []; }

  samlAssertion(appId: AppId, userId: UserId, _sessionId: SessionId):
    | { ok: true; xml: string } | { ok: false; reason: string } {
    const u = this.dir.getUser(userId);
    if (!u) return { ok: false, reason: 'unknown-user' };
    if (u.status === 'disabled') return { ok: false, reason: 'user-disabled' };
    if (u.mfa === 'none' && this.requiresMfa(appId)) return { ok: false, reason: 'mfa-required' };
    const xml = `<saml:Assertion issuer="northwind-idp" subject="${u.username}" roles="${u.groupIds.join(',')}" />`;
    return { ok: true, xml };
  }

  oidcToken(appId: AppId, userId: UserId, _code: string):
    | { ok: true; idToken: string; claims: Record<string, unknown> } | { ok: false; reason: string } {
    const u = this.dir.getUser(userId);
    if (!u) return { ok: false, reason: 'unknown-user' };
    if (u.status === 'disabled') return { ok: false, reason: 'user-disabled' };
    const claims = { sub: u.username, email: u.email, department: u.department, roles: u.groupIds };
    const idToken = btoa(JSON.stringify(claims));
    return { ok: true, idToken, claims };
  }

  getSession(id: SessionId): Session | undefined { return this.sessions.get(id); }
  listSessions(userId?: UserId): Session[] {
    const all = Array.from(this.sessions.values());
    return userId ? all.filter((s) => s.userId === userId) : all;
  }

  private createSession(userId: UserId, ip?: string, asn?: string, mfaDone = false): Session {
    const id = mkSessionId(nanoid(16));
    const now = this.now();
    const s: Session = {
      id, userId, createdAt: now, expiresAt: now + 8 * 60 * 60 * 1000,
      mfaCompleted: mfaDone,
      ...(ip ? { ip } : {}),
      ...(asn ? { asn } : {}),
    };
    this.sessions.set(id, s);
    return s;
  }

  private requiresMfa(_appId: AppId): boolean { return false; }

  reset(): void {
    this.passwords.clear();
    this.sessions.clear();
    this.policies = [];
    this.now = () => Date.now();
  }
}
