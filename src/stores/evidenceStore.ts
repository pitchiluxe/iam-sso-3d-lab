/**
 * stores/evidenceStore.ts — collected evidence.
 */
import { create } from 'zustand';
import type { Evidence, EvidenceId, LabId } from '@/domain';

interface EvidenceState {
  items: Evidence[];
  add(e: Evidence): void;
  byStep(stepId: string): Evidence[];
  byLab(labId: LabId): Evidence[];
  reset(): void;
}

export const evidenceStore = create<EvidenceState>()((set, get) => ({
  items: [],

  add(e) { set((s) => ({ items: [...s.items, e] })); },

  byStep(stepId) { return get().items.filter((e) => e.stepId === stepId); },
  byLab(labId)   { return get().items.filter((e) => e.labId  === labId); },

  reset() { set({ items: [] }); },
}));
