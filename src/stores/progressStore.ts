/**
 * stores/progressStore.ts — persisted lab progress and best scores.
 *
 * Uses the shared v2 localStorage envelope via util/persistence.
 * Reads progress slice on construction; writes back on every mutation.
 */
import { create } from 'zustand';
import type { LabId, ScoreBreakdown } from '@/domain';
import {
  loadPersistedState,
  saveEnvelope,
  exportToFile,
  importFromFile,
  type PersistedProgress,
} from '@/util/persistence';

function loadProgress(): PersistedProgress {
  return loadPersistedState().progress;
}

function saveProgress(snap: PersistedProgress): void {
  const current = loadPersistedState();
  saveEnvelope({ ...current, version: 2, progress: snap });
}

type ProgressState = PersistedProgress & {
  markComplete: (labId: LabId, score: ScoreBreakdown) => void;
  markStarted: (labId: LabId) => void;
  reset: () => void;
  exportProgress: () => void;
  importProgress: (file: File) => Promise<void>;
};

export const progressStore = create<ProgressState>()((set) => {
  const initial = loadProgress();
  return {
    ...initial,

    markComplete(labId, score) {
      set((s) => {
        const best = s.bestScores[labId];
        const newScores = {
          ...s.bestScores,
          [labId]: !best || score.total > best.total ? score : best,
        };
        const next = s.completedLabIds.includes(labId)
          ? s.completedLabIds
          : [...s.completedLabIds, labId];
        const snap: PersistedProgress = {
          completedLabIds: next,
          bestScores: newScores,
          startedAt: s.startedAt,
        };
        saveProgress(snap);
        return snap;
      });
    },

    markStarted(labId) {
      set((s) => {
        const snap: PersistedProgress = {
          ...s,
          startedAt: { ...s.startedAt, [labId]: Date.now() },
        };
        saveProgress(snap);
        return snap;
      });
    },

    reset() {
      saveEnvelope({
        ...loadPersistedState(),
        version: 2,
        progress: { completedLabIds: [], bestScores: {}, startedAt: {} },
      });
      set({ completedLabIds: [], bestScores: {}, startedAt: {} });
    },

    exportProgress() {
      exportToFile(loadPersistedState());
    },

    async importProgress(file: File) {
      const state = await importFromFile(file);
      saveEnvelope(state);
      set({ ...state.progress });
    },
  };
});
