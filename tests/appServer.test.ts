/**
 * tests/appServer.test.ts
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockAuditLog, MockDirectory, MockIdP, MockAppServer } from '@/services';
import { mkAppId, mkRoleId, type UserId } from '@/domain';

describe('MockAppServer', () => {
  let audit: MockAuditLog, dir: MockDirectory, idp: MockIdP, apps: MockAppServer;
  let userId: UserId, appId: import('@/domain').AppId;

  beforeEach(() => {
    audit = new MockAuditLog();
    dir = new MockDirectory(audit);
    idp = new MockIdP(audit, dir);
    apps = new MockAppServer(dir, idp, audit);

    const u = dir.createUser({
      username: 'alice', displayName: 'A', email: 'a@e.com',
      department: 'Finance', title: 'T', mfa: 'none',
    });
    userId = u.id;
    const r = dir.createRole('role-finance', 'Finance role', ['payroll:read']);
    const g = dir.createGroup('grp-finance', 'f');
    g.ownerRoleId = r.id;
    dir.addToGroup(userId, g.id, userId);

    appId = mkAppId('app-test');
    apps.registerApp({
      id: appId, name: 'Test App', protocol: 'OIDC',
      redirectUri: 'https://x/cb', clientId: 'cid', issuer: 'https://x/iss',
      requiredRoleIds: [r.id], mfaRequired: false, status: 'configured',
    });
  });

  it('ssoLogin succeeds for a user with the required role', () => {
    const r = apps.ssoLogin(appId, userId);
    expect(r.ok).toBe(true);
  });

  it('ssoLogin: unknown-app', () => {
    const r = apps.ssoLogin(mkAppId('app-missing'), userId);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('unknown-app');
  });

  it('ssoLogin: app-offline when status=offline', () => {
    const a = apps.getApp(appId)!;
    a.status = 'offline';
    const r = apps.ssoLogin(appId, userId);
    if (!r.ok) expect(r.reason).toBe('app-offline');
  });

  it('ssoLogin: invalid-redirect-uri when fault injected', () => {
    const a = apps.getApp(appId)!;
    a.configDiffFromBaseline = { redirectUri: { expected: a.redirectUri, actual: 'wrong' } };
    const r = apps.ssoLogin(appId, userId);
    if (!r.ok) expect(r.reason).toBe('invalid-redirect-uri');
  });

  it('ssoLogin: missing-role when user has no required role', () => {
    const a = apps.getApp(appId)!;
    a.requiredRoleIds = [mkRoleId('role-other')];
    const r = apps.ssoLogin(appId, userId);
    if (!r.ok) expect(r.reason).toBe('missing-role');
  });

  it('ssoLogin: mfa-required when app requires MFA and user has none', () => {
    const a = apps.getApp(appId)!;
    a.mfaRequired = true;
    const r = apps.ssoLogin(appId, userId);
    if (!r.ok) expect(r.reason).toBe('mfa-required');
  });

  it('fixConfigField updates a field and clears matching fault', () => {
    const a = apps.getApp(appId)!;
    a.configDiffFromBaseline = { redirectUri: { expected: a.redirectUri, actual: 'wrong' } };
    apps.fixConfigField(appId, 'redirectUri', a.redirectUri, userId);
    expect(a.configDiffFromBaseline).toBeUndefined();
    expect(a.status).toBe('configured');
  });

  it('clearFault resets status and diff', () => {
    const a = apps.getApp(appId)!;
    a.status = 'misconfigured';
    a.configDiffFromBaseline = { 'cert.validUntil': { expected: '2027', actual: '2024' } };
    apps.clearFault(appId, userId);
    expect(a.status).toBe('configured');
  });
});
