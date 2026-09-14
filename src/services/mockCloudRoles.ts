/**
 * services/mockCloudRoles.ts — cloud IAM cross-account roles.
 *
 * Models the two independently-misconfigurable halves of a cloud IAM role:
 * permissions (what it can do) and trust policy (who can become it). A
 * wildcard permission and an over-broad trust policy are two separate bugs
 * that happen to live on the same object — fixing one says nothing about
 * the other, which is the point of the lab this backs.
 */
import type { CloudRole, CloudRoleId, UserId } from '@/domain';
import { mkCloudRoleId } from '@/domain';
import type { MockAuditLog } from './mockAuditLog';

export class MockCloudRoles {
  private roles = new Map<CloudRoleId, CloudRole>();

  constructor(private readonly audit?: MockAuditLog) {}

  seedRole(r: Omit<CloudRole, 'id'>): CloudRole {
    const id = mkCloudRoleId();
    const role: CloudRole = { ...r, id };
    this.roles.set(id, role);
    return role;
  }

  list(): CloudRole[] {
    return Array.from(this.roles.values());
  }

  getByName(name: string): CloudRole | undefined {
    return this.list().find((r) => r.name === name);
  }

  updatePermissions(name: string, permissions: string[], by: UserId): void {
    const role = this.getByName(name);
    if (!role) throw new Error(`[cloud-roles] updatePermissions: role '${name}' not found`);
    role.permissions = permissions;
    this.audit?.record({
      actorId: by,
      action: 'cloud.role.permissions.updated',
      targetId: role.id,
      diff: { roleName: name, permissions },
    });
  }

  updateTrust(name: string, trustedUserIds: UserId[], by: UserId): void {
    const role = this.getByName(name);
    if (!role) throw new Error(`[cloud-roles] updateTrust: role '${name}' not found`);
    role.trustedUserIds = trustedUserIds;
    this.audit?.record({
      actorId: by,
      action: 'cloud.role.trust.updated',
      targetId: role.id,
      diff: { roleName: name, trustedCount: trustedUserIds.length },
    });
  }

  /** Simulates an AssumeRole call: allowed only if the trust policy names
   *  this user. Always records which — a denial is as much evidence as a
   *  success. */
  assume(name: string, userId: UserId): { ok: boolean } {
    const role = this.getByName(name);
    if (!role) throw new Error(`[cloud-roles] assume: role '${name}' not found`);
    const allowed = role.trustedUserIds.includes(userId);
    this.audit?.record({
      actorId: userId,
      action: allowed ? 'cloud.role.assumed' : 'cloud.role.assume.denied',
      targetId: role.id,
      subjectId: userId,
    });
    return { ok: allowed };
  }

  reset(): void {
    this.roles.clear();
  }
}
