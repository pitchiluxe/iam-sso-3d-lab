/**
 * tests/labRegistry.test.ts
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { findLab } from '@/labs/registry';
import { generatedLabsStore } from '@/stores';
import { mkLabId } from '@/domain';
import type { Lab } from '@/domain';

const FAKE_GENERATED_LAB: Lab = {
  id: mkLabId('gen-test-lab'),
  number: 0,
  title: 'Test Generated Lab',
  brief: 'test',
  durationMinutes: 5,
  zoneIds: ['help-desk'],
  startingZone: 'help-desk',
  startingSeed: 'account-lockout',
  objectives: [],
  steps: [],
  faults: [],
  debriefQuestions: [],
};

describe('findLab', () => {
  beforeEach(() => {
    generatedLabsStore.setState({ labs: [FAKE_GENERATED_LAB] });
  });

  it('still finds a core lab', () => {
    expect(findLab('lab01')?.title).toBeTruthy();
  });

  it('finds a generated lab by id', () => {
    expect(findLab(FAKE_GENERATED_LAB.id)).toBe(FAKE_GENERATED_LAB);
  });

  it('returns undefined for an unknown id', () => {
    expect(findLab('nope')).toBeUndefined();
  });
});
