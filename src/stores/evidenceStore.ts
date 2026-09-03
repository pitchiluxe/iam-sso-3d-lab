/**
 * stores/evidenceStore.ts — collected evidence.
 *
 * Evidence is persisted to localStorage so it survives a page reload.
 */
import { create } from 'zustand';
import type { Evidence, LabId } from '@/domain';
import { loadPersistedState, saveEnvelope } from '@/util/persistence';

function loadEvidence(): Evidence[] {
  try {
    return loadPersistedState().evidence ?? [];
  } catch {
    return [];
  }
}

function saveEvidence(items: Evidence[]): void {
  const current = loadPersistedState();
  saveEnvelope({ ...current, evidence: items });
}

interface EvidenceState {
  items: Evidence[];
  add(e: Evidence): void;
  byStep(stepId: string): Evidence[];
  byLab(labId: LabId): Evidence[];
  reset(): void;
}

export const evidenceStore = create<EvidenceState>()((set, get) => ({
  items: loadEvidence(),

  add(e) {
    set((s) => {
      const next = [...s.items, e];
      saveEvidence(next);
      return { items: next };
    });
  },

  byStep(stepId) {
    return get().items.filter((e) => e.stepId === stepId);
  },
  byLab(labId) {
    return get().items.filter((e) => e.labId === labId);
  },

  reset() {
    saveEvidence([]);
    set({ items: [] });
  },
}));
