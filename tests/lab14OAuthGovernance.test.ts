/**
 * tests/lab14OAuthGovernance.test.ts
 *
 * Lab 14 closes a real capability gap: before this, no capability, console
 * section, or validator existed for third-party OAuth app consent — the
 * governance surface a real consent-phishing incident is worked through.
 * This locks in the mechanical pieces: the seed has no duplicate (userId,
 * clientId) pair (the exact bug that made lab06 unreachable), both
 * grant-revoke steps fire on the specific (user, clientId) pair named in
 * the lab rather than on any revoke, and the block step is scoped to the
 * specific clientId.
 */
import { describe, it, expect } from 'vitest';
import { Conductor } from '@/conductor/conductor';
import { findLab } from '@/labs/registry';
import { mkLabId } from '@/domain';
import { labStore } from '@/stores';
import { CAPABILITY_BY_ID } from '@/services/capabilities';

describe('lab14 OAuth grant seed', () => {
  it('has no duplicate (userId, clientId) grant pair', () => {
    const conductor = new Conductor();
    conductor.start(mkLabId('lab14'));
    const { oauthGrants } = conductor.getServices();
    const keys = oauthGrants.list().map((g) => `${g.grantedByUserId}:${g.clientId}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('seeds the malicious app under two different users, and a legitimate app as noise', () => {
    const conductor = new Conductor();
    conductor.start(mkLabId('lab14'));
    const { oauthGrants } = conductor.getServices();
    const malicious = oauthGrants.byClientId('oauth-quicksign-docs');
    expect(malicious).toHaveLength(2);
    expect(malicious.every((g) => g.status === 'active')).toBe(true);
    const legit = oauthGrants.byClientId('oauth-teamsync');
    expect(legit.length).toBeGreaterThanOrEqual(1);
  });
});

describe('lab14 revoke/block capabilities are scoped correctly', () => {
  it('revoking one user does not revoke the other victim, or the legitimate grant', () => {
    const conductor = new Conductor();
    conductor.start(mkLabId('lab14'));
    const { dir, idp, apps, oauthGrants, cloudRoles, tickets, audit } = conductor.getServices();
    const ctx = { dir, idp, apps, oauthGrants, cloudRoles, tickets, audit, actor: 'system' as never };

    const res = CAPABILITY_BY_ID['oauth.grant.revoke']!.run(ctx, {
      Identity: 'dan.rivera',
      ClientId: 'oauth-quicksign-docs',
    });
    expect(res.ok).toBe(true);

    const dan = oauthGrants.byClientId('oauth-quicksign-docs').find((g) => {
      const u = dir.getUser(g.grantedByUserId);
      return u?.username === 'dan.rivera';
    })!;
    const erin = oauthGrants.byClientId('oauth-quicksign-docs').find((g) => {
      const u = dir.getUser(g.grantedByUserId);
      return u?.username === 'erin.cho';
    })!;
    expect(dan.status).toBe('revoked');
    expect(erin.status).toBe('active');
    expect(oauthGrants.byClientId('oauth-teamsync').every((g) => g.status === 'active')).toBe(true);
  });

  it('blocking the malicious app does not block the legitimate one', () => {
    const conductor = new Conductor();
    conductor.start(mkLabId('lab14'));
    const { dir, idp, apps, oauthGrants, cloudRoles, tickets, audit } = conductor.getServices();
    const ctx = { dir, idp, apps, oauthGrants, cloudRoles, tickets, audit, actor: 'system' as never };

    CAPABILITY_BY_ID['oauth.app.block']!.run(ctx, { ClientId: 'oauth-quicksign-docs' });
    expect(oauthGrants.isBlocked('oauth-quicksign-docs')).toBe(true);
    expect(oauthGrants.isBlocked('oauth-teamsync')).toBe(false);
  });

  it("s2's validator does not fire on revoking the wrong user's grant", () => {
    const lab = findLab(mkLabId('lab14'))!;
    const s2 = lab.steps.find((s) => s.id === 's2')!;
    expect(s2.validator.params).toEqual({ userId: 'dan.rivera', clientId: 'oauth-quicksign-docs' });

    const conductor = new Conductor();
    conductor.start(mkLabId('lab14'));
    conductor.forceAdvance(); // s1 -> s2
    expect(labStore.getState().stepIndex).toBe(1);
    const { dir, idp, apps, oauthGrants, cloudRoles, tickets, audit } = conductor.getServices();
    const ctx = { dir, idp, apps, oauthGrants, cloudRoles, tickets, audit, actor: 'system' as never };

    // Revoking Erin's (wrong-user) grant must not complete s2, which is
    // scoped to Dan.
    CAPABILITY_BY_ID['oauth.grant.revoke']!.run(ctx, {
      Identity: 'erin.cho',
      ClientId: 'oauth-quicksign-docs',
    });
    expect(labStore.getState().stepStatuses['s2']).not.toBe('done');

    CAPABILITY_BY_ID['oauth.grant.revoke']!.run(ctx, {
      Identity: 'dan.rivera',
      ClientId: 'oauth-quicksign-docs',
    });
    expect(labStore.getState().stepStatuses['s2']).toBe('done');
  });
});
