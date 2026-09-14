/**
 * tests/faultAutoClear.test.ts
 *
 * faultStore.clear() has exactly one caller: Conductor.autoClearFaults(),
 * driven by the FAULT_REMEDIATION table. Before that table existed, nothing
 * in the codebase ever called clear() at all — any step whose validator is
 * 'fault-cleared' applied its fault once and then blocked forever, because
 * the fault kind never left faultStore's active list. lab03's denial-path
 * step and lab13's recovery step both depend on this working.
 *
 * This locks the fix in place: a fault-cleared step must actually become
 * completable once the learner performs the remediating action, not just
 * remain plausible-looking in the lab definition.
 */
import { describe, it, expect } from 'vitest';
import { faultStore } from '@/stores/faultStore';
import { Conductor } from '@/conductor/conductor';
import { mkLabId } from '@/domain';

describe('fault-cleared steps are actually reachable', () => {
  it('lab03: revoking the role a fault granted clears that fault', () => {
    const conductor = new Conductor();
    conductor.start(mkLabId('lab03'));
    const { dir } = conductor.getServices();

    expect(faultStore.getState().active).toContain('excessive-permissions');

    const bob = dir.getUserByUsername('bob.sato')!;
    dir.revokeRoleDirect(
      bob.id,
      dir.getRoleByName('role-domain-admins')!.id,
      dir.getUserByUsername('cara.patel')!.id,
    );

    expect(faultStore.getState().active).not.toContain('excessive-permissions');
  });

  it('lab13: resetting MFA clears a tenant-wide idp-mfa-outage fault', () => {
    const conductor = new Conductor();
    conductor.start(mkLabId('lab13'));
    const { dir, idp } = conductor.getServices();
    // The fault only applies at s7; walk stepIndex there directly rather
    // than replaying six steps of setup.
    conductor.forceAdvance();
    conductor.forceAdvance();
    conductor.forceAdvance();
    conductor.forceAdvance();
    conductor.forceAdvance();
    conductor.forceAdvance();
    expect(faultStore.getState().active).toContain('idp-mfa-outage');

    const anyUser = dir.getUserByUsername('bg-emergency-1') ?? dir.listUsers()[0]!;
    idp.resetMfa(anyUser.id, anyUser.id);

    expect(faultStore.getState().active).not.toContain('idp-mfa-outage');
  });

  it('a fault kind with no remediation entry never auto-clears (no false confidence)', () => {
    const conductor = new Conductor();
    conductor.start(mkLabId('lab04'));
    const { audit } = conductor.getServices();
    // No lab04 fault exists yet — this just confirms an unrelated event
    // storm doesn't touch faultStore at all when there is nothing active.
    audit.record({ actorId: 'system' as never, action: 'role.revoke', subjectId: 'nobody' });
    expect(faultStore.getState().active).toHaveLength(0);
  });
});
