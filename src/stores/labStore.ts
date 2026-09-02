/**
 * stores/labStore.ts — current lab state.
 */
import { create } from 'zustand';
import type { Lab, LabId } from '@/domain';

export type StepStatus = 'pending' | 'in-progress' | 'done' | 'failed';

interface LabState {
  current: Lab | null;
  stepIndex: number;
  stepStatuses: Record<string, StepStatus>;
  failed: boolean;
  labId: LabId | null;

  load(lab: Lab): void;
  start(): void;
  advance(): void;
  failStep(stepId: string): void;
  reset(): void;
}

export const labStore = create<LabState>()((set, get) => ({
  current: null,
  stepIndex: 0,
  stepStatuses: {},
  failed: false,
  labId: null,

  load(lab) {
    set({
      current: lab,
      labId: lab.id,
      stepIndex: 0,
      failed: false,
      stepStatuses: Object.fromEntries(lab.steps.map((s) => [s.id, 'pending'])),
    });
  },

  start() {
    const { current, stepIndex } = get();
    if (!current) return;
    const statuses: Record<string, StepStatus> = { ...get().stepStatuses, [current.steps[stepIndex]!.id]: 'in-progress' };
    set({ stepStatuses: statuses });
  },

  advance() {
    const { current, stepIndex } = get();
    if (!current) return;
    const statuses: Record<string, StepStatus> = { ...get().stepStatuses, [current.steps[stepIndex]!.id]: 'done' };
    const next = stepIndex + 1;
    if (next >= current.steps.length) {
      set({ stepIndex: next, stepStatuses: statuses, failed: false });
    } else {
      const nextStatuses: Record<string, StepStatus> = { ...statuses, [current.steps[next]!.id]: 'in-progress' };
      set({ stepIndex: next, stepStatuses: nextStatuses, failed: false });
    }
  },

  failStep(stepId: string) {
    set((s) => ({ stepStatuses: { ...s.stepStatuses, [stepId]: 'failed' }, failed: true }));
  },

  reset() {
    set({ current: null, stepIndex: 0, stepStatuses: {}, failed: false, labId: null });
  },
}));
