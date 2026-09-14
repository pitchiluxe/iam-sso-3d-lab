/**
 * tests/lab17CloudIam.test.ts
 *
 * Cloud IAM's two independently-misconfigurable halves — permissions and
 * trust policy — are exactly the kind of thing a lab could quietly let one
 * fix satisfy both checks. This locks in that they're genuinely separate:
 * scoping permissions does not touch trust, scoping trust does not touch
 * permissions, and the assume-role capability records a real denial (not
 * just a UI error) when the trust policy actually excludes someone.
 */
import { describe, it, expect } from 'vitest';
import { Conductor } from '@/conductor/conductor';
import { mkLabId } from '@/domain';
import { labStore } from '@/stores';
import { CAPABILITY_BY_ID } from '@/services/capabilities';

describe('lab17 seed', () => {
  it('seeds prod-data-readonly with wildcard permissions and a nine-person trust policy', () => {
    const conductor = new Conductor();
    conductor.start(mkLabId('lab17'));
    const { cloudRoles } = conductor.getServices();
    const role = cloudRoles.getByName('prod-data-readonly')!;
    expect(role.permissions.some((p) => p.includes('*'))).toBe(true);
    expect(role.trustedUserIds.length).toBeGreaterThan(2);
  });
});

describe('lab17 permissions and trust are independently scoped', () => {
  it('scoping permissions does not touch the trust policy', () => {
    const conductor = new Conductor();
    conductor.start(mkLabId('lab17'));
    const { dir, idp, apps, oauthGrants, cloudRoles, tickets, audit } = conductor.getServices();
    const ctx = { dir, idp, apps, oauthGrants, cloudRoles, tickets, audit, actor: 'system' as never };
    const before = cloudRoles.getByName('prod-data-readonly')!.trustedUserIds.length;

    CAPABILITY_BY_ID['cloud.role.scope-permissions']!.run(ctx, {
      RoleName: 'prod-data-readonly',
      Permissions: 's3:GetObject',
    });

    const role = cloudRoles.getByName('prod-data-readonly')!;
    expect(role.permissions).toEqual(['s3:GetObject']);
    expect(role.trustedUserIds.length).toBe(before);
  });

  it('scoping trust does not touch permissions', () => {
    const conductor = new Conductor();
    conductor.start(mkLabId('lab17'));
    const { dir, idp, apps, oauthGrants, cloudRoles, tickets, audit } = conductor.getServices();
    const ctx = { dir, idp, apps, oauthGrants, cloudRoles, tickets, audit, actor: 'system' as never };
    const beforePerms = [...cloudRoles.getByName('prod-data-readonly')!.permissions];

    CAPABILITY_BY_ID['cloud.role.scope-trust']!.run(ctx, {
      RoleName: 'prod-data-readonly',
      TrustedUsers: 'ivy.park',
    });

    const role = cloudRoles.getByName('prod-data-readonly')!;
    expect(role.trustedUserIds).toHaveLength(1);
    expect(role.permissions).toEqual(beforePerms);
  });

  it('assume-role records a real denial event, not just a UI error', () => {
    const conductor = new Conductor();
    conductor.start(mkLabId('lab17'));
    const { dir, idp, apps, oauthGrants, cloudRoles, tickets, audit } = conductor.getServices();
    const ctx = { dir, idp, apps, oauthGrants, cloudRoles, tickets, audit, actor: 'system' as never };

    CAPABILITY_BY_ID['cloud.role.scope-trust']!.run(ctx, {
      RoleName: 'prod-data-readonly',
      TrustedUsers: 'ivy.park',
    });
    const before = audit.byAction('cloud.role.assume.denied').length;
    const res = CAPABILITY_BY_ID['cloud.role.assume']!.run(ctx, {
      RoleName: 'prod-data-readonly',
      Identity: 'bob.sato',
    });
    expect(res.ok).toBe(false);
    expect(audit.byAction('cloud.role.assume.denied').length).toBe(before + 1);
  });
});

describe('lab17 s4/s5 gate on the specific user named, not either outcome', () => {
  it('s5 does not complete when the trusted user (not the excluded one) attempts assumption', async () => {
    const wait = () => new Promise((r) => setTimeout(r, 1300));
    const conductor = new Conductor();
    conductor.start(mkLabId('lab17'));
    conductor.forceAdvance(); // s1 -> s2
    const { dir, idp, apps, oauthGrants, cloudRoles, tickets, audit } = conductor.getServices();
    const ctx = { dir, idp, apps, oauthGrants, cloudRoles, tickets, audit, actor: 'system' as never };

    CAPABILITY_BY_ID['cloud.role.scope-permissions']!.run(ctx, {
      RoleName: 'prod-data-readonly',
      Permissions: 's3:GetObject',
    });
    await wait();
    CAPABILITY_BY_ID['cloud.role.scope-trust']!.run(ctx, {
      RoleName: 'prod-data-readonly',
      TrustedUsers: 'ivy.park, dan.rivera',
    });
    await wait();
    expect(labStore.getState().stepIndex).toBe(3); // s4

    // Wrong user for s4's check (denied, not the trusted assumer s4 wants).
    CAPABILITY_BY_ID['cloud.role.assume']!.run(ctx, {
      RoleName: 'prod-data-readonly',
      Identity: 'bob.sato',
    });
    expect(labStore.getState().stepStatuses['s4']).not.toBe('done');

    CAPABILITY_BY_ID['cloud.role.assume']!.run(ctx, {
      RoleName: 'prod-data-readonly',
      Identity: 'ivy.park',
    });
    expect(labStore.getState().stepStatuses['s4']).toBe('done');
  }, 10000);
});
