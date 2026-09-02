/**
 * stores/faultStore.ts — fault injection state.
 */
import { create } from 'zustand';
import type { FaultKind } from '@/domain';

interface FaultLog { at: number; kind: FaultKind; stepId: string }

interface FaultState {
  active: FaultKind[];
  log: FaultLog[];
  apply(kind: FaultKind, stepId: string): void;
  clear(kind: FaultKind): void;
  reset(): void;
}

export const faultStore = create<FaultState>()((set) => ({
  active: [],
  log: [],

  apply(kind, stepId) {
    set((s) => ({
      active: [...s.active, kind],
      log: [...s.log, { at: Date.now(), kind, stepId }],
    }));
  },

  clear(kind) {
    set((s) => ({ active: s.active.filter((k) => k !== kind) }));
  },

  reset() { set({ active: [], log: [] }); },
}));
