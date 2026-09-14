/**
 * tests/appConfigCapability.test.ts
 *
 * mockAppServer.fixConfigField() was already correct in isolation (see
 * appServer.test.ts) but had zero callers anywhere in the app: no capability,
 * no console form, no cmdlet. Meanwhile the 'app-config-fixed' validator
 * checked only `apps.getApp(appId)?.status === 'configured'` against
 * whichever event happened to fire next — and every baseline app already
 * ships `status: 'configured'`, so lab04's first two steps (and lab07's core
 * break/fix step) could pass on the learner's next unrelated click, having
 * fixed nothing.
 *
 * This locks in both halves of the fix: a real capability exists to correct
 * a field, and the validator only fires on the event that capability emits.
 */
import { describe, it, expect } from 'vitest';
import { CAPABILITY_BY_ID, CAPABILITY_BY_CMDLET } from '@/services/capabilities';
import { Conductor } from '@/conductor/conductor';
import { mkLabId } from '@/domain';
import { labStore } from '@/stores';

describe('app.config.update capability', () => {
  it('is registered under a cmdlet the terminal can dispatch', () => {
    expect(CAPABILITY_BY_ID['app.config.update']).toBeDefined();
    expect(CAPABILITY_BY_CMDLET['set-appconfig']).toBe(CAPABILITY_BY_ID['app.config.update']);
  });

  it('declares the validator it satisfies, like every other mutating capability', () => {
    expect(CAPABILITY_BY_ID['app.config.update']!.validator).toBe('app-config-fixed');
  });

  it('actually completes an app-config-fixed step end to end', () => {
    const conductor = new Conductor();
    conductor.start(mkLabId('lab04'));
    const { dir, idp, apps, oauthGrants, cloudRoles, tickets, audit } = conductor.getServices();

    // lab04's seed leaves app-finance needing its entityId set correctly.
    const app = apps.getApp('app-finance' as never)!;
    expect(app.status).not.toBe('configured');
    expect(labStore.getState().stepStatuses['s1']).toBe('in-progress');

    const cap = CAPABILITY_BY_ID['app.config.update']!;
    const diff = app.configDiffFromBaseline!;
    for (const [field, { expected }] of Object.entries(diff)) {
      const res = cap.run(
        { dir, idp, apps, oauthGrants, cloudRoles, tickets, audit, actor: 'system' as never },
        { App: 'app-finance', Field: field, Value: String(expected) },
      );
      expect(res.ok).toBe(true);
    }

    expect(app.status).toBe('configured');
    expect(labStore.getState().stepStatuses['s1']).toBe('done');
  });

  it('an unrelated event does not complete the step (the old loophole)', () => {
    const conductor = new Conductor();
    conductor.start(mkLabId('lab04'));
    const { dir, idp } = conductor.getServices();
    // Any audit event that isn't app.config.changed on this app.
    dir.createUser({
      username: 'noise',
      displayName: 'Noise',
      email: 'noise@e.com',
      department: 'IT',
      title: 'T',
    });
    void idp;
    expect(labStore.getState().stepStatuses['s1']).toBe('in-progress');
  });
});
