/**
 * tests/lab09PIM.test.ts
 *
 * s4's validator is session-revoked for hank.oneill, but nothing in
 * seed/perLab/lab09.ts ever signs Hank in, and the step's brief did not say
 * to — it only said "exercise the elevated privilege," which a learner could
 * satisfy without ever creating a session. Revoke-UserSession against zero
 * sessions revokes zero and emits no event, so the step never completed.
 * The brief now explicitly instructs signing Hank in first.
 */
import { describe, it, expect } from 'vitest';
import { Conductor } from '@/conductor/conductor';
import { findLab } from '@/labs/registry';
import { mkLabId } from '@/domain';
import { labStore } from '@/stores';

describe('lab09 s4 (exercise + auto-revoke) is reachable', () => {
  it("s4's brief instructs signing Hank in before revoking", () => {
    const lab = findLab(mkLabId('lab09'))!;
    const s4 = lab.steps.find((s) => s.id === 's4')!;
    expect(s4.brief.toLowerCase()).toMatch(/sign.*in|verify authentication/);
  });

  it('signing Hank in, then revoking his session, completes s4', () => {
    const conductor = new Conductor();
    conductor.start(mkLabId('lab09'));
    conductor.forceAdvance();
    conductor.forceAdvance();
    conductor.forceAdvance();
    expect(labStore.getState().stepIndex).toBe(3);

    const { dir, idp } = conductor.getServices();
    const hank = dir.getUserByUsername('hank.oneill')!;
    idp.seedPasswords({ 'hank.oneill': 'temp-for-test' });
    expect(idp.signIn('hank.oneill', 'temp-for-test').ok).toBe(true);
    expect(idp.revokeAllSessions(hank.id, hank.id)).toBeGreaterThan(0);
    expect(labStore.getState().stepStatuses['s4']).toBe('done');
  });

  it('revoking with nobody signed in accomplishes nothing (the original trap)', () => {
    const conductor = new Conductor();
    conductor.start(mkLabId('lab09'));
    conductor.forceAdvance();
    conductor.forceAdvance();
    conductor.forceAdvance();
    const { dir, idp } = conductor.getServices();
    const hank = dir.getUserByUsername('hank.oneill')!;
    expect(idp.revokeAllSessions(hank.id, hank.id)).toBe(0);
    expect(labStore.getState().stepStatuses['s4']).not.toBe('done');
  });
});
