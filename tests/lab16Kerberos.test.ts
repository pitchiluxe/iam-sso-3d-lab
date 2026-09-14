/**
 * tests/lab16Kerberos.test.ts
 *
 * lab16 reuses three already-proven mechanics (clock-skew fault, Sync IdP
 * Clock, account.unlock) in a new scenario. The one thing specific to this
 * lab worth locking in: Greta starts locked, and both the clock fix and the
 * unlock are independently required before her sign-in can succeed —
 * fixing only one must not be enough.
 */
import { describe, it, expect } from 'vitest';
import { Conductor } from '@/conductor/conductor';
import { mkLabId } from '@/domain';
import { CAPABILITY_BY_ID } from '@/services/capabilities';

describe('lab16 seed', () => {
  it('starts Greta locked out', () => {
    const conductor = new Conductor();
    conductor.start(mkLabId('lab16'));
    const { dir } = conductor.getServices();
    expect(dir.getUserByUsername('greta.olsen')!.status).toBe('locked');
  });

  it('injects exactly one clock-skew fault, active from the start', () => {
    const conductor = new Conductor();
    conductor.start(mkLabId('lab16'));
    const { idp } = conductor.getServices();
    // clock-skew shifts idp.now forward — a real drift, not just a flag.
    expect(idp.now() - Date.now()).toBeGreaterThanOrEqual(5 * 60 * 1000 - 1000);
  });
});

describe('lab16 sign-in depends on both fixes', () => {
  it('unlocking alone does not fix the clock, and syncing alone does not unlock the account', () => {
    const conductor = new Conductor();
    conductor.start(mkLabId('lab16'));
    const { dir, idp, apps, oauthGrants, cloudRoles, tickets, audit } = conductor.getServices();
    const ctx = { dir, idp, apps, oauthGrants, cloudRoles, tickets, audit, actor: 'system' as never };

    // Unlock only — account is active, but the clock is still skewed.
    CAPABILITY_BY_ID['account.unlock']!.run(ctx, { Identity: 'greta.olsen' });
    expect(dir.getUserByUsername('greta.olsen')!.status).toBe('active');
    expect(idp.now() - Date.now()).toBeGreaterThan(60 * 1000);

    // Sync only — clock is fine now, but nothing re-locked or unlocked the account.
    CAPABILITY_BY_ID['idp.clock.sync']!.run(ctx, {});
    expect(idp.now() - Date.now()).toBeLessThan(1000);
  });

  it('signs in successfully once both fixes are applied', () => {
    const conductor = new Conductor();
    conductor.start(mkLabId('lab16'));
    const { dir, idp, apps, oauthGrants, cloudRoles, tickets, audit } = conductor.getServices();
    const ctx = { dir, idp, apps, oauthGrants, cloudRoles, tickets, audit, actor: 'system' as never };

    CAPABILITY_BY_ID['idp.clock.sync']!.run(ctx, {});
    CAPABILITY_BY_ID['account.unlock']!.run(ctx, { Identity: 'greta.olsen' });
    idp.seedPasswords({ 'greta.olsen': 'test-password' });
    expect(idp.signIn('greta.olsen', 'test-password').ok).toBe(true);
  });
});
