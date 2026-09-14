/**
 * tests/lab08Incident.test.ts
 *
 * lab08's closing step used to validate `{ kind: 'fault-cleared', params: {} }`.
 * eventMatchesValidator's fault-cleared case checks
 * `!faultStore.active.includes(p.kind)`, and with no `kind` in params that's
 * `!faultStore.active.includes(undefined)` — the array only ever holds real
 * FaultKind strings, so this was always true, on the very first audit event
 * that happened to fire once the learner reached that step. Closing the
 * incident was never actually checked.
 */
import { describe, it, expect } from 'vitest';
import { findLab } from '@/labs/registry';
import { mkLabId } from '@/domain';
import { Conductor } from '@/conductor/conductor';
import { labStore, evidenceStore } from '@/stores';
import { mkEvidenceId } from '@/domain';

describe('lab08 close-incident step actually gates on evidence, not on any event', () => {
  it("s6's validator is not an always-true fault-cleared check", () => {
    const lab = findLab(mkLabId('lab08'))!;
    const s6 = lab.steps.find((s) => s.id === 's6')!;
    expect(s6.validator.kind).not.toBe('fault-cleared');
    expect(s6.validator.kind).toBe('evidence-collected');
  });

  it('an unrelated event before any evidence is captured does not complete s6', () => {
    const conductor = new Conductor();
    conductor.start(mkLabId('lab08'));
    conductor.forceAdvance();
    conductor.forceAdvance();
    conductor.forceAdvance();
    conductor.forceAdvance();
    conductor.forceAdvance();
    expect(labStore.getState().stepIndex).toBe(5); // s6

    const { dir } = conductor.getServices();
    dir.createUser({
      username: 'unrelated',
      displayName: 'Unrelated',
      email: 'u@e.com',
      department: 'IT',
      title: 'T',
    });
    expect(labStore.getState().stepStatuses['s6']).not.toBe('done');
  });

  it('capturing evidence, then any subsequent event, completes s6', () => {
    const conductor = new Conductor();
    conductor.start(mkLabId('lab08'));
    conductor.forceAdvance();
    conductor.forceAdvance();
    conductor.forceAdvance();
    conductor.forceAdvance();
    conductor.forceAdvance();
    const { dir } = conductor.getServices();

    evidenceStore.getState().add({
      id: mkEvidenceId('e-close-test'),
      labId: mkLabId('lab08'),
      stepId: 's6',
      kind: 'snapshot',
      capturedAt: Date.now(),
      payload: {},
      label: 'closed incident',
    });
    dir.createUser({
      username: 'trigger.recheck',
      displayName: 'Trigger',
      email: 't@e.com',
      department: 'IT',
      title: 'T',
    });
    expect(labStore.getState().stepStatuses['s6']).toBe('done');
  });
});
