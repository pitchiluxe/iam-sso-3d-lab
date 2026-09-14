/**
 * tests/lab15Pki.test.ts
 *
 * Guards the one real trap in this lab's design: it deliberately uses a
 * single 'expired-cert' fault instance, not two. faultStore tracks active
 * faults by kind in a flat array, and Conductor.autoClearFaults calls
 * faultStore.clear(kind) — which removes every entry of that kind, not just
 * the one that was actually fixed. Two same-kind faults on different apps
 * would let fixing the first silently clear the second's marker too. s4's
 * proactive rotation uses app-config-fixed instead, which is scoped to its
 * own app.config.changed event and carries no such risk.
 */
import { describe, it, expect } from 'vitest';
import { LAB_15 } from '@/labs/lab15';
import { Conductor } from '@/conductor/conductor';
import { mkLabId } from '@/domain';
import { labStore } from '@/stores';
import { CAPABILITY_BY_ID } from '@/services/capabilities';

describe('lab15 fault design', () => {
  it('injects exactly one fault instance', () => {
    expect(LAB_15.faults).toHaveLength(1);
    expect(LAB_15.faults[0]!.kind).toBe('expired-cert');
  });

  it("s4 (proactive rotation) does not depend on any fault having been applied to Help Desk Portal", () => {
    const s4 = LAB_15.steps.find((s) => s.id === 's4')!;
    expect(s4.validator.kind).toBe('app-config-fixed');
    expect(LAB_15.faults.some((f) => f.targetAppId === 'app-helpdesk-portal')).toBe(false);
  });
});

describe('lab15 end-to-end mechanics', () => {
  it('the expired-cert fault applies to app-finance, not app-helpdesk-portal', () => {
    const conductor = new Conductor();
    conductor.start(mkLabId('lab15'));
    conductor.forceAdvance(); // s1 -> s2, where the fault applies
    const { apps } = conductor.getServices();
    expect(apps.getApp('app-finance' as never)!.status).toBe('misconfigured');
    expect(apps.getApp('app-helpdesk-portal' as never)!.status).toBe('configured');
  });

  it('fixing the Finance Portal fault does not touch Help Desk Portal, and s4 still requires its own action', async () => {
    // A real (event-driven) step completion schedules its index-advance
    // 1200ms out rather than moving immediately — mixing that with a
    // synchronous forceAdvance() the instant after double-advances the
    // index. Waiting out that pause before the next forceAdvance() keeps
    // the two advance paths from colliding.
    const wait = () => new Promise((r) => setTimeout(r, 1300));

    const conductor = new Conductor();
    conductor.start(mkLabId('lab15'));
    conductor.forceAdvance(); // s1 -> s2 (clean skip, nothing pending yet)
    const { dir, idp, apps, oauthGrants, cloudRoles, tickets, audit } = conductor.getServices();
    const ctx = { dir, idp, apps, oauthGrants, cloudRoles, tickets, audit, actor: 'system' as never };

    const diff = apps.getApp('app-finance' as never)!.configDiffFromBaseline!;
    for (const [field, { expected }] of Object.entries(diff)) {
      CAPABILITY_BY_ID['app.config.update']!.run(ctx, {
        App: 'app-finance',
        Field: field,
        Value: String(expected),
      });
    }
    expect(apps.getApp('app-finance' as never)!.status).toBe('configured');
    expect(apps.getApp('app-helpdesk-portal' as never)!.status).toBe('configured');
    await wait(); // let s2's real advance to s3 finish before skipping further

    conductor.forceAdvance(); // s3 -> s4
    expect(labStore.getState().stepIndex).toBe(3);
    expect(labStore.getState().stepStatuses['s4']).not.toBe('done');

    CAPABILITY_BY_ID['app.config.update']!.run(ctx, {
      App: 'app-helpdesk-portal',
      Field: 'cert.validUntil',
      Value: '2030-01-01',
    });
    expect(labStore.getState().stepStatuses['s4']).toBe('done');
  }, 10000);
});
