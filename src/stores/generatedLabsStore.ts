/**
 * stores/generatedLabsStore.ts — AI-generated daily-ticket labs.
 *
 * Orchestrates one "Generate 10 More" click: picks 10 templates the
 * learner hasn't seen before (or the 10 used longest ago, once all 15
 * have been used at least once), asks the AI flavor generator for each
 * one's narrative/coaching-question in parallel, builds the Lab objects,
 * and persists everything (labs + the dedup ledger) via the same
 * versioned envelope every other store uses.
 */
import { create } from 'zustand';
import type { Lab } from '@/domain';
import { loadPersistedState, saveEnvelope, type PersistedGeneratedLabs } from '@/util/persistence';
import { LAB_TEMPLATES, type LabTemplate } from '@/labs/generated/templates';
import { generateFlavor } from '@/services/labFlavorGenerator';

/** Pick `count` templates: never-used ones first (in template-array order),
 * then the templates used longest ago once the pool is exhausted. */
export function pickTemplateBatch(usedTemplateIds: string[], count: number): LabTemplate[] {
  const unused = LAB_TEMPLATES.filter((t) => !usedTemplateIds.includes(t.id));
  if (unused.length >= count) return unused.slice(0, count);

  const usedInOrder = usedTemplateIds
    .map((id) => LAB_TEMPLATES.find((t) => t.id === id))
    .filter((t): t is LabTemplate => Boolean(t));
  return [...unused, ...usedInOrder].slice(0, count);
}

function loadGenerated(): PersistedGeneratedLabs {
  return loadPersistedState().generatedLabs;
}

function saveGenerated(snap: PersistedGeneratedLabs): void {
  const current = loadPersistedState();
  saveEnvelope({ ...current, version: 3, generatedLabs: snap });
}

interface GeneratedLabsState {
  labs: Lab[];
  generating: boolean;
  generateBatch(count?: number): Promise<Lab[]>;
  reset(): void;
}

export const generatedLabsStore = create<GeneratedLabsState>()((set) => {
  const initial = loadGenerated();
  return {
    labs: initial.labs,
    generating: false,

    async generateBatch(count = 10) {
      set({ generating: true });
      try {
        const current = loadGenerated();
        const templates = pickTemplateBatch(current.usedTemplateIds, count);

        const newLabs = await Promise.all(
          templates.map(async (t) => {
            const flavor = await generateFlavor({
              ticketTypeLabel: t.ticketTypeLabel,
              targetDisplayName: t.targetDisplayName,
              targetTitle: t.targetTitle,
              targetDept: t.targetDept,
            });
            return t.buildLab(flavor, current.usedNames);
          }),
        );

        const usedTemplateIds = [...current.usedTemplateIds, ...templates.map((t) => t.id)];
        const labs = [...current.labs, ...newLabs];
        // Track any freshly-picked names from onboarding/contractor labs so
        // future batches don't repeat them (title carries the chosen name
        // for those two templates — see templates.ts's baseLab() override).
        const usedNames = current.usedNames;
        saveGenerated({ labs, usedTemplateIds, usedNames });
        set({ labs, generating: false });
        return newLabs;
      } catch (err) {
        set({ generating: false });
        throw err;
      }
    },

    reset() {
      saveGenerated({ labs: [], usedTemplateIds: [], usedNames: [] });
      set({ labs: [] });
    },
  };
});
