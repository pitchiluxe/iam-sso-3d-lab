/**
 * services/mockDirectory.ts — in-memory directory of Users, Groups, and Roles.
 * Every mutation records an audit event and emits a bus event.
 */
import { nanoid } from 'nanoid';
import type { User, Group, RoleRecord, GroupId, RoleId, UserId, MfaMethod, Application, AppId } from '@/domain';
import { mkUserId, mkGroupId, mkRoleId, SYSTEM_ACTOR } from '@/domain';
import type { MockAuditLog } from './mockAuditLog';

export class MockDirectory {
  private users   = new Map<UserId, User>();
  private groups  = new Map<GroupId, Group>();
  private roles   = new Map<RoleId, RoleRecord>();
  private appIndex = new Map<string, Application>();

  constructor(private readonly audit: MockAuditLog) {}

  // --- USERS ----------------------------------------------------------------

  listUsers(filter?: Partial<Pick<User, 'department' | 'status'>>): User[] {
    const all = Array.from(this.users.values());
    if (!filter) return all;
    return all.filter((u) => {
      if (filter.department && u.department !== filter.department) return false;
      if (filter.status && u.status !== filter.status) return false;
      return true;
    });
  }

  getUser(id: UserId): User | undefined { return this.users.get(id); }
  getUserByUsername(username: string): User | undefined {
    return Array.from(this.users.values()).find((u) => u.username === username);
  }

  createUser(
    input: {
      username: string; displayName: string; email: string;
      department: string; title: string; managerId?: UserId; mfa?: MfaMethod; groupIds?: GroupId[];
    },
    actor: UserId = SYSTEM_ACTOR,
  ): User {
    const id = mkUserId(input.username + '-' + nanoid(6));
    const user: User = {
      id, username: input.username, displayName: input.displayName,
      email: input.email, department: input.department, title: input.title,
      status: 'active', mfa: input.mfa ?? 'none',
      groupIds: input.groupIds ?? [], createdAt: Date.now(),
      ...(input.managerId ? { managerId: input.managerId } : {}),
    };
    this.users.set(id, user);
    this.audit.record({ actorId: actor, action: 'user.created', targetId: id });
    return user;
  }

  disableUser(id: UserId, by: UserId, _reason = 'unspecified'): void {
    const u = this.users.get(id);
    if (!u) throw new Error(`[directory] disableUser: user ${id} not found`);
    if (u.status === 'disabled') return;
    u.status = 'disabled';
    u.disabledAt = Date.now();
    this.audit.record({ actorId: by, action: 'user.disabled', targetId: id });
  }

  enableUser(id: UserId, by: UserId): void {
    const u = this.users.get(id);
    if (!u) throw new Error(`[directory] enableUser: user ${id} not found`);
    if (u.status !== 'disabled') return;
    u.status = 'active';
    u.disabledAt = undefined;
    this.audit.record({ actorId: by, action: 'user.unlocked', targetId: id });
  }

  recordSignIn(id: UserId): void {
    const u = this.users.get(id);
    if (u) u.lastSignInAt = Date.now();
  }

  // --- GROUPS ---------------------------------------------------------------

  listGroups(): Group[] { return Array.from(this.groups.values()); }
  getGroup(id: GroupId): Group | undefined { return this.groups.get(id); }
  getGroupByName(name: string): Group | undefined {
    return Array.from(this.groups.values()).find((g) => g.name === name);
  }

  createGroup(name: string, description: string, actor: UserId = SYSTEM_ACTOR): Group {
    const id = mkGroupId(name);
    const g: Group = { id, name, description, memberIds: [] };
    this.groups.set(id, g);
    this.audit.record({ actorId: actor, action: 'group.add', targetId: id, subjectId: actor });
    return g;
  }

  addToGroup(userId: UserId, groupId: GroupId, by: UserId): void {
    const g = this.groups.get(groupId);
    const u = this.users.get(userId);
    if (!g) throw new Error(`[directory] addToGroup: group ${groupId} not found`);
    if (!u) throw new Error(`[directory] addToGroup: user ${userId} not found`);
    if (!g.memberIds.includes(userId)) g.memberIds.push(userId);
    if (!u.groupIds.includes(groupId)) u.groupIds.push(groupId);
    this.audit.record({ actorId: by, action: 'group.add', targetId: groupId, subjectId: userId });
  }

  removeFromGroup(userId: UserId, groupId: GroupId, by: UserId): void {
    const g = this.groups.get(groupId);
    const u = this.users.get(userId);
    if (!g || !u) return;
    g.memberIds = g.memberIds.filter((id) => id !== userId);
    u.groupIds  = u.groupIds.filter((id) => id !== groupId);
    this.audit.record({ actorId: by, action: 'group.remove', targetId: groupId, subjectId: userId });
  }

  moveUser(userId: UserId, toDepartment: string, by: UserId): void {
    const u = this.users.get(userId);
    if (!u) throw new Error(`[directory] moveUser: user ${userId} not found`);
    u.department = toDepartment;
    this.audit.record({ actorId: by, action: 'group.remove', targetId: mkGroupId('move'), subjectId: userId });
  }

  // --- ROLES ----------------------------------------------------------------

  listRoles(): RoleRecord[] { return Array.from(this.roles.values()); }
  getRole(id: RoleId): RoleRecord | undefined { return this.roles.get(id); }
  getRoleByName(name: string): RoleRecord | undefined {
    return Array.from(this.roles.values()).find((r) => r.name === name);
  }

  createRole(
    name: string, description: string, permissions: string[],
    appId?: AppId, actor: UserId = SYSTEM_ACTOR,
  ): RoleRecord {
    const id = mkRoleId(name);
    const r: RoleRecord = appId ? { id, name, description, permissions, appId } : { id, name, description, permissions };
    this.roles.set(id, r);
    if (appId) {
      const a = this.appIndex.get(appId);
      if (a && !a.requiredRoleIds.includes(id)) a.requiredRoleIds.push(id);
    }
    this.audit.record({ actorId: actor, action: 'role.grant', targetId: id, subjectId: actor });
    return r;
  }

  grantRoleDirect(userId: UserId, roleId: RoleId, by: UserId): void {
    const u = this.users.get(userId);
    if (!u) throw new Error(`[directory] grantRole: user not found`);
    this.audit.record({ actorId: by, action: 'role.grant', targetId: roleId, subjectId: userId });
  }

  revokeRoleDirect(userId: UserId, roleId: RoleId, by: UserId): void {
    this.audit.record({ actorId: by, action: 'role.revoke', targetId: roleId, subjectId: userId });
  }

  effectiveRoleIds(userId: UserId): RoleId[] {
    const u = this.users.get(userId);
    if (!u) return [];
    const ids: RoleId[] = [];
    for (const gid of u.groupIds) {
      const g = this.groups.get(gid);
      if (g?.ownerRoleId) ids.push(g.ownerRoleId);
    }
    return ids;
  }

  isDormant(userId: UserId, days: number, now = Date.now()): boolean {
    const u = this.users.get(userId);
    if (!u) return false;
    if (!u.lastSignInAt) return true;
    return (now - u.lastSignInAt) > days * 24 * 60 * 60 * 1000;
  }

  // --- APP REGISTRY (lightweight) -------------------------------------------

  registerApp(app: Application): void { this.appIndex.set(app.id, app); }
  getApp(id: string): Application | undefined { return this.appIndex.get(id); }

  // --- RESET ----------------------------------------------------------------

  reset(): void {
    this.users.clear(); this.groups.clear(); this.roles.clear(); this.appIndex.clear();
  }
}
