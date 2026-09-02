/**
 * stores/progressStore.ts — persisted lab progress and best scores.
 */
import { create } from 'zustand';
import type { LabId, ScoreBreakdown } from '@/domain';

const STORAGE_KEY = 'iam-lab-progress-v1';

interface ProgressState {
  completedLabIds: LabId[];
  bestScores: Partial<Record<LabId, ScoreBreakdown>>;
  startedAt: Partial<Record<LabId, number>>;
  markComplete(labId: LabId, score: ScoreBreakdown): void;
  markStarted(labId: LabId): void;
  reset(): void;
}

function load(): Pick<ProgressState, 'completedLabIds' | 'bestScores' | 'startedAt'> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { completedLabIds: [], bestScores: {}, startedAt: {} };
    const parsed = JSON.parse(raw);
    return {
      completedLabIds: parsed.completedLabIds ?? [],
      bestScores: parsed.bestScores ?? {},
      startedAt: parsed.startedAt ?? {},
    };
  } catch {
    return { completedLabIds: [], bestScores: {}, startedAt: {} };
  }
}

function save(s: Pick<ProgressState, 'completedLabIds' | 'bestScores' | 'startedAt'>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      completedLabIds: s.completedLabIds,
      bestScores: s.bestScores,
      startedAt: s.startedAt,
    }));
  } catch { /* ignore */ }
}

export const progressStore = create<ProgressState>()((set, get) => ({
  ...load(),

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
      const snap = { completedLabIds: next, bestScores: newScores, startedAt: s.startedAt };
      save(snap);
      return snap;
    });
  },

  markStarted(labId) {
    set((s) => {
      const snap = { ...s, startedAt: { ...s.startedAt, [labId]: Date.now() } };
      save(snap);
      return snap;
    });
  },

  reset() {
    localStorage.removeItem(STORAGE_KEY);
    set({ completedLabIds: [], bestScores: {}, startedAt: {} });
  },
}));
