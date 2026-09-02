/**
 * tests/idp.test.ts
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockAuditLog, MockDirectory, MockIdP } from '@/services';

describe('MockIdP', () => {
  let audit: MockAuditLog, dir: MockDirectory, idp: MockIdP;
  let userId: import('@/domain').UserId;

  beforeEach(() => {
    audit = new MockAuditLog();
    dir  = new MockDirectory(audit);
    idp  = new MockIdP(audit, dir);
    const u = dir.createUser({
      username: 'alice', displayName: 'Alice', email: 'a@e.com',
      department: 'IT', title: 'Tester', mfa: 'none',
    });
    userId = u.id;
    idp.seedPasswords({ alice: 'secret' });
  });

  it('signIn: ok on correct password', () => {
    const r = idp.signIn('alice', 'secret');
    expect(r.ok).toBe(true);
  });

  it('signIn: bad-password on wrong password', () => {
    const r = idp.signIn('alice', 'wrong');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('bad-password');
  });

  it('signIn: disabled for disabled user', () => {
    dir.disableUser(userId, userId, 'test');
    const r = idp.signIn('alice', 'secret');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('disabled');
  });

  it('signIn: MFA-required user gets a session with mfaCompleted=false', () => {
    const u = dir.getUser(userId)!;
    u.mfa = 'totp';
    const r = idp.signIn('alice', 'secret');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.session.mfaCompleted).toBe(false);
  });

  it('completeMfa succeeds and marks session mfaCompleted=true', () => {
    const u = dir.getUser(userId)!;
    u.mfa = 'totp';
    const r = idp.signIn('alice', 'secret');
    if (!r.ok) throw new Error('expected ok');
    const m = idp.completeMfa(r.session.id, 'totp');
    expect(m.ok).toBe(true);
    expect(idp.getSession(r.session.id)!.mfaCompleted).toBe(true);
  });

  it('revokeAllSessions removes sessions and audits each', () => {
    idp.signIn('alice', 'secret');
    const beforeAudit = audit.events.length;
    const n = idp.revokeAllSessions(userId, userId);
    expect(n).toBeGreaterThanOrEqual(1);
    expect(audit.events.length).toBeGreaterThan(beforeAudit);
  });

  it('resetMfa clears the mfa method and audits', () => {
    const u = dir.getUser(userId)!;
    u.mfa = 'totp';
    idp.resetMfa(userId, userId);
    expect(dir.getUser(userId)!.mfa).toBe('none');
  });

  it('enrollMfa sets mfa method and audits', () => {
    idp.enrollMfa(userId, 'fido2', userId);
    expect(dir.getUser(userId)!.mfa).toBe('fido2');
  });

  it('clock skew: idp.now can be shifted by fault service', () => {
    const realNow = Date.now;
    idp.now = () => realNow() + 6 * 60 * 1000;
    expect(idp.now() - realNow()).toBeGreaterThanOrEqual(6 * 60 * 1000);
  });
});
