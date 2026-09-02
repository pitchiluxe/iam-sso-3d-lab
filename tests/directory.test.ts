/**
 * tests/directory.test.ts
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockAuditLog, MockDirectory } from '@/services';
import { mkUserId, mkGroupId } from '@/domain';

describe('MockDirectory', () => {
  let dir: MockDirectory;
  let audit: MockAuditLog;

  beforeEach(() => {
    audit = new MockAuditLog();
    dir = new MockDirectory(audit);
  });

  it('creates a user with active status', () => {
    const u = dir.createUser({
      username: 'test.user', displayName: 'Test', email: 't@e.com',
      department: 'IT', title: 'Tester',
    });
    expect(u.status).toBe('active');
    expect(dir.listUsers()).toHaveLength(1);
  });

  it('disables a user and records audit', () => {
    const u = dir.createUser({
      username: 't', displayName: 'T', email: 't@e.com',
      department: 'IT', title: 'Tester',
    });
    dir.disableUser(u.id, u.id, 'leaving');
    expect(dir.getUser(u.id)!.status).toBe('disabled');
    expect(audit.byAction('user.')).toHaveLength(2);
  });

  it('enableUser is a no-op if user is not disabled', () => {
    const u = dir.createUser({
      username: 't', displayName: 'T', email: 't@e.com',
      department: 'IT', title: 'Tester',
    });
    dir.enableUser(u.id, u.id); // should not throw
    expect(dir.getUser(u.id)!.status).toBe('active');
  });

  it('addToGroup / removeFromGroup keep both sides in sync', () => {
    const u = dir.createUser({
      username: 't', displayName: 'T', email: 't@e.com',
      department: 'IT', title: 'Tester',
    });
    const g = dir.createGroup('grp-test', 'test');
    dir.addToGroup(u.id, g.id, u.id);
    expect(g.memberIds).toContain(u.id);
    expect(u.groupIds).toContain(g.id);
    dir.removeFromGroup(u.id, g.id, u.id);
    expect(g.memberIds).not.toContain(u.id);
    expect(u.groupIds).not.toContain(g.id);
  });

  it('effectiveRoleIds returns the role owned by each group', () => {
    const u = dir.createUser({
      username: 't', displayName: 'T', email: 't@e.com',
      department: 'IT', title: 'Tester',
    });
    const g = dir.createGroup('grp-x', 'x');
    const r = dir.createRole('role-x', 'role x', ['x:read']);
    g.ownerRoleId = r.id;
    dir.addToGroup(u.id, g.id, u.id);
    expect(dir.effectiveRoleIds(u.id)).toContain(r.id);
  });

  it('isDormant: true if lastSignInAt > days ago, false otherwise', () => {
    const u = dir.createUser({
      username: 't', displayName: 'T', email: 't@e.com',
      department: 'IT', title: 'Tester',
    });
    u.lastSignInAt = Date.now() - 100 * 24 * 60 * 60 * 1000; // 100 days ago
    expect(dir.isDormant(u.id, 30)).toBe(true);
    expect(dir.isDormant(u.id, 365)).toBe(false);
  });

  it('getUserByUsername finds the user', () => {
    dir.createUser({
      username: 'alice', displayName: 'Alice', email: 'a@e.com',
      department: 'IT', title: 'Tester',
    });
    expect(dir.getUserByUsername('alice')!.displayName).toBe('Alice');
  });

  it('moveUser updates department', () => {
    const u = dir.createUser({
      username: 't', displayName: 'T', email: 't@e.com',
      department: 'IT', title: 'Tester',
    });
    dir.moveUser(u.id, 'HR', u.id);
    expect(dir.getUser(u.id)!.department).toBe('HR');
  });

  it('reset clears everything', () => {
    const u = dir.createUser({
      username: 't', displayName: 'T', email: 't@e.com',
      department: 'IT', title: 'Tester',
    });
    dir.createGroup('grp', 'desc');
    dir.reset();
    expect(dir.listUsers()).toHaveLength(0);
    expect(dir.listGroups()).toHaveLength(0);
  });
});
