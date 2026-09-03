/**
 * stores/labStore.ts — current lab state.
 *
 * Lab progress (current lab + stepIndex + stepStatuses) is persisted to
 * localStorage via util/persistence so a learner can reload and resume.
 */
import { create } from 'zustand';
import type { Lab, LabId } from '@/domain';
import { loadPersistedState, saveEnvelope, type PersistedResume } from '@/util/persistence';

export type StepStatus = 'pending' | 'in-progress' | 'done' | 'failed';

interface LabState {
  current: Lab | null;
  stepIndex: number;
  stepStatuses: Record<string, StepStatus>;
  failed: boolean;
  labId: LabId | null;

  load(lab: Lab): void;
  /** Restore a previously persisted resume state. Used on app boot. */
  restore(
    lab: Lab,
    stepIndex: number,
    stepStatuses: Record<string, StepStatus>,
    failed: boolean,
  ): void;
  start(): void;
  /** Mark the current step 'done' without moving stepIndex yet — lets the UI
   * show a brief completed/greyed-out state before advance() moves on. */
  markStepDone(stepId: string): void;
  advance(): void;
  failStep(stepId: string): void;
  reset(): void;
}

function saveResume(
  s: Pick<LabState, 'current' | 'stepIndex' | 'stepStatuses' | 'failed' | 'labId'>,
): void {
  if (!s.current || !s.labId) return;
  const resume: PersistedResume = {
    currentLabId: s.labId,
    stepIndex: s.stepIndex,
    stepStatuses: s.stepStatuses,
    failed: s.failed,
  };
  const current = loadPersistedState();
  saveEnvelope({ ...current, version: 2, resume });
}

function clearResume(): void {
  const current = loadPersistedState();
  saveEnvelope({ ...current, version: 2, resume: null });
}

export const labStore = create<LabState>()((set, get) => ({
  current: null,
  stepIndex: 0,
  stepStatuses: {},
  failed: false,
  labId: null,

  load(lab) {
    const next: Partial<LabState> = {
      current: lab,
      labId: lab.id,
      stepIndex: 0,
      failed: false,
      stepStatuses: Object.fromEntries(lab.steps.map((s) => [s.id, 'pending'])),
    };
    set(next as LabState);
    saveResume({ ...get() });
  },

  restore(lab, stepIndex, stepStatuses, failed) {
    // Merge persisted statuses with the lab's full set so any new steps default to pending.
    const full: Record<string, StepStatus> = Object.fromEntries(
      lab.steps.map((s) => [s.id, stepStatuses[s.id] ?? 'pending']),
    );
    set({
      current: lab,
      labId: lab.id,
      stepIndex,
      stepStatuses: full,
      failed,
    });
    // Don't re-save on restore — we just read it.
  },

  start() {
    const { current, stepIndex } = get();
    if (!current) return;
    const statuses: Record<string, StepStatus> = {
      ...get().stepStatuses,
      [current.steps[stepIndex]!.id]: 'in-progress',
    };
    set({ stepStatuses: statuses });
    saveResume({ ...get() });
  },

  markStepDone(stepId) {
    set((s) => ({ stepStatuses: { ...s.stepStatuses, [stepId]: 'done' } }));
  },

  advance() {
    const { current, stepIndex } = get();
    if (!current) return;
    const statuses: Record<string, StepStatus> = {
      ...get().stepStatuses,
      [current.steps[stepIndex]!.id]: 'done',
    };
    const next = stepIndex + 1;
    if (next >= current.steps.length) {
      set({ stepIndex: next, stepStatuses: statuses, failed: false });
    } else {
      const nextStatuses: Record<string, StepStatus> = {
        ...statuses,
        [current.steps[next]!.id]: 'in-progress',
      };
      set({ stepIndex: next, stepStatuses: nextStatuses, failed: false });
    }
    saveResume({ ...get() });
  },

  failStep(stepId: string) {
    set((s) => ({ stepStatuses: { ...s.stepStatuses, [stepId]: 'failed' }, failed: true }));
    saveResume({ ...get() });
  },

  reset() {
    set({ current: null, stepIndex: 0, stepStatuses: {}, failed: false, labId: null });
    clearResume();
  },
}));
