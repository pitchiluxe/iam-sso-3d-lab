/**
 * stores/scoreStore.ts — current and historical scores.
 */
import { create } from 'zustand';
import type { ScoreBreakdown } from '@/domain';

interface ScoreState {
  current: ScoreBreakdown | null;
  history: ScoreBreakdown[];
  set(b: ScoreBreakdown): void;
  addNote(n: string): void;
  reset(): void;
}

export const scoreStore = create<ScoreState>()((set, get) => ({
  current: null,
  history: [],

  set(b) {
    set((s) => ({ current: b, history: [...s.history, b] }));
  },

  addNote(n) {
    const cur = get().current;
    if (cur) set({ current: { ...cur, notes: [...cur.notes, n] } });
  },

  reset() { set({ current: null }); },
}));
