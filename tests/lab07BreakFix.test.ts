/**
 * tests/lab07BreakFix.test.ts
 *
 * lab07's randomized fault used to have two independent ways to strand a
 * learner:
 *
 *  1. 'wrong-issuer' was in the fault pool but its mutator no-ops on a SAML
 *     app with no `issuer` field (issuer is OIDC-only), and the pool always
 *     targets app-finance, which is SAML. A draw of that kind silently broke
 *     nothing, so there was never anything to fix.
 *  2. s3 validated 'app-config-fixed' regardless of which fault got drawn —
 *     a check against apps.getApp().status, true by default on every
 *     baseline app — so clock-skew (which never touches app-finance's
 *     config at all) could never satisfy it no matter what the learner did.
 *
 * This locks in: the fault pool only contains kinds that actually break
 * something on a SAML app, and each remaining kind has a real fix path.
 */
import { describe, it, expect } from 'vitest';
import { LAB_07_FAULT } from '@/labs/lab07';
import { findLab } from '@/labs/registry';
import { mkLabId } from '@/domain';
import { Conductor } from '@/conductor/conductor';
import { labStore } from '@/stores';
import { CAPABILITY_BY_ID } from '@/services/capabilities';

describe('lab07 fault pool and fix mechanism', () => {
  it('never draws wrong-issuer against the SAML-only Finance Portal', () => {
    expect(LAB_07_FAULT).not.toBe('wrong-issuer');
  });

  it("s3's validator is scoped to the specific fault drawn this run, not app status alone", () => {
    const lab = findLab(mkLabId('lab07'))!;
    const s3 = lab.steps.find((s) => s.id === 's3')!;
    expect(s3.validator.kind).toBe('fault-cleared');
    expect(s3.validator.params['kind']).toBe(LAB_07_FAULT);
  });

  it('whichever fault this run drew has a real fix path to s3-done', () => {
    const conductor = new Conductor();
    conductor.start(mkLabId('lab07'));
    const { dir, idp, apps, oauthGrants, cloudRoles, tickets, audit } = conductor.getServices();
    conductor.forceAdvance();
    conductor.forceAdvance();
    expect(labStore.getState().stepIndex).toBe(2);

    const ctx = { dir, idp, apps, oauthGrants, cloudRoles, tickets, audit, actor: 'system' as never };
    if (LAB_07_FAULT === 'clock-skew') {
      expect(CAPABILITY_BY_ID['idp.clock.sync']!.run(ctx, {}).ok).toBe(true);
    } else if (LAB_07_FAULT === 'dns-resolution') {
      expect(
        CAPABILITY_BY_ID['app.service.restart']!.run(ctx, { App: 'app-finance' }).ok,
      ).toBe(true);
    } else {
      const diff = apps.getApp('app-finance' as never)!.configDiffFromBaseline!;
      for (const [field, { expected }] of Object.entries(diff)) {
        expect(
          CAPABILITY_BY_ID['app.config.update']!.run(ctx, {
            App: 'app-finance',
            Field: field,
            Value: String(expected),
          }).ok,
        ).toBe(true);
      }
    }
    expect(labStore.getState().stepStatuses['s3']).toBe('done');
  });
});
