/**
 * stores/tutorStore.ts — AI tutor dialog and hint state.
 */
import { create } from 'zustand';

export interface DialogEntry {
  from: 'tutor' | 'learner' | 'system';
  at: number;
  body: string;
  promptIds?: string[];
}

interface TutorState {
  dialog: DialogEntry[];
  hintLevel: 0 | 1 | 2 | 3;
  explanationMode: boolean;
  stuckTimer: ReturnType<typeof setTimeout> | null;

  addDialog(entry: Omit<DialogEntry, 'at'>): void;
  bumpHint(): void;
  setHintLevel(level: 0 | 1 | 2 | 3): void;
  setExplanationMode(on: boolean): void;
  startStuckTimer(onStuck: () => void, ms: number): void;
  cancelStuckTimer(): void;
  reset(): void;
}

export const tutorStore = create<TutorState>()((set, get) => ({
  dialog: [],
  hintLevel: 0,
  explanationMode: false,
  stuckTimer: null,

  addDialog(entry) {
    set((s) => ({ dialog: [...s.dialog, { ...entry, at: Date.now() }] }));
  },

  bumpHint() {
    set((s) => ({ hintLevel: Math.min(s.hintLevel + 1, 3) as 0 | 1 | 2 | 3 }));
  },

  setHintLevel(level) {
    set({ hintLevel: level });
  },

  setExplanationMode(on) {
    set({ explanationMode: on });
  },

  startStuckTimer(onStuck, ms) {
    const existing = get().stuckTimer;
    if (existing) clearTimeout(existing);
    set({ stuckTimer: setTimeout(onStuck, ms) });
  },

  cancelStuckTimer() {
    const t = get().stuckTimer;
    if (t) clearTimeout(t);
    set({ stuckTimer: null });
  },

  reset() {
    get().cancelStuckTimer();
    set({ dialog: [], hintLevel: 0, explanationMode: false });
  },
}));
