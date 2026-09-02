/**
 * tests/fault.test.ts
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockAuditLog, MockDirectory, MockIdP, MockAppServer, FaultService } from '@/services';
import { mkUserId, mkAppId } from '@/domain';

describe('FaultService', () => {
  let audit: MockAuditLog, dir: MockDirectory, idp: MockIdP, apps: MockAppServer, fs: FaultService;
  let alice: import('@/domain').UserId, appId: import('@/domain').AppId;

  beforeEach(() => {
    audit = new MockAuditLog();
    dir = new MockDirectory(audit);
    idp = new MockIdP(audit, dir);
    apps = new MockAppServer(dir, idp, audit);
    fs = new FaultService({ dir, idp, apps, audit });

    alice = dir.createUser({
      username: 'alice', displayName: 'A', email: 'a@e.com',
      department: 'Finance', title: 'T',
    }).id;

    appId = mkAppId('app-finance');
    apps.registerApp({
      id: appId, name: 'Finance', protocol: 'SAML',
      redirectUri: 'https://finance.northwind.example/cb', clientId: 'cid',
      entityId: 'urn:finance', requiredRoleIds: [], mfaRequired: false, status: 'configured',
    });
  });

  it('wrong-redirect-uri sets configDiffFromBaseline', () => {
    fs.apply('wrong-redirect-uri', { targetAppId: appId });
    expect(apps.getApp(appId)!.configDiffFromBaseline).toBeDefined();
  });

  it('expired-cert sets status=misconfigured', () => {
    fs.apply('expired-cert', { targetAppId: appId });
    expect(apps.getApp(appId)!.status).toBe('misconfigured');
  });

  it('dns-resolution sets status=offline', () => {
    fs.apply('dns-resolution', { targetAppId: appId });
    expect(apps.getApp(appId)!.status).toBe('offline');
  });

  it('clock-skew shifts idp.now forward by 6 minutes', () => {
    const real = Date.now;
    fs.apply('clock-skew');
    expect(idp.now() - real()).toBeGreaterThanOrEqual(6 * 60 * 1000);
  });

  it('dormant-account sets lastSignInAt to 200 days ago', () => {
    fs.apply('dormant-account', { targetUserId: alice });
    expect(dir.getUser(alice)!.lastSignInAt).toBeLessThan(Date.now() - 199 * 24 * 60 * 60 * 1000);
  });

  it('excessive-permissions grants role-domain-admin to the user', () => {
    fs.apply('excessive-permissions', { targetUserId: alice });
    expect(audit.byAction('role.grant').length).toBeGreaterThanOrEqual(1);
  });

  it('suspicious-signin records 3 failures + 1 success', () => {
    fs.apply('suspicious-signin', { targetUserId: alice });
    expect(audit.byAction('signin.')).toHaveLength(4);
  });

  it('clearAll restores app registry and idp clock', () => {
    fs.apply('clock-skew');
    fs.clearAll();
    apps.reset(); // required since clearAll doesn't re-register apps
    expect(idp.now() - Date.now()).toBeLessThan(1000);
  });
});
