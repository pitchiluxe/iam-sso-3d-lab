/**
 * stores/generatedLabsStore.ts — AI-generated daily-ticket labs.
 *
 * Orchestrates one "Generate 10 More" click: picks 10 templates the
 * learner hasn't seen before (or the 10 used longest ago, once all 15
 * have been used at least once), asks the AI flavor generator for each
 * one's narrative/coaching-question in parallel, builds the Lab objects,
 * and persists everything (labs + the dedup ledger) via the same
 * versioned envelope every other store uses.
 *
 * Also supports batch (multi-ticket queue) generation via generateBatchLab(),
 * which produces a single lab with 10/15/20 pre-seeded tickets.
 */
import { create } from 'zustand';
import type { Lab } from '@/domain';
import { loadPersistedState, saveEnvelope, type PersistedGeneratedLabs } from '@/util/persistence';
import {
  LAB_TEMPLATES,
  BATCH_TEMPLATES,
  type LabTemplate,
  type BatchTemplate,
} from '@/labs/generated/templates';
import { generateFlavor, generateBatchFlavor } from '@/services/labFlavorGenerator';
import { NAME_POOL } from '@/labs/generated/namePool';
import { batchTicketSubjects } from '@/labs/generated/queuePreview';

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

/** Pick a batch template by id (10/15/20 ticket queues). */
export function pickBatchTemplate(batchId: string): BatchTemplate | undefined {
  return BATCH_TEMPLATES.find((bt) => bt.id === batchId);
}

/** Run `fn` over `items`, at most `limit` at a time, keeping order. */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
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
  generateBatchLab(batchId: string): Promise<Lab>;
  /** Generate one lab per batch template (10, 15, 20 ticket queues) in parallel. */
  generateAllBatches(): Promise<Lab[]>;
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

        // Plan each lab first, in order: which new starter it names (so two
        // labs in one batch never create the same person) and the exact work
        // it grades — the only names the AI's narrative is allowed to use.
        const usedNames = [...current.usedNames];
        const plans = templates.map((t) => {
          const namesBefore = [...usedNames];
          const probe = t.buildLab({ narrative: '', coachingQuestion: '' }, namesBefore);
          const person = probe.title.replace(/^Daily Ticket:\s*/, '');
          if (NAME_POOL.some((n) => n.displayName === person)) usedNames.push(person);
          return { t, namesBefore, person, facts: probe.steps.map((st) => st.brief.trim()) };
        });

        // Two at a time. A local model answers one request after another, so
        // ten sent together meant the last ones waited out their timeout and
        // fell back to the plain template.
        const newLabs = await mapLimit(plans, 2, async ({ t, namesBefore, person, facts }) => {
          const flavor = await generateFlavor({
            ticketTypeLabel: t.ticketTypeLabel,
            targetDisplayName: person || t.targetDisplayName,
            targetTitle: t.targetTitle,
            targetDept: t.targetDept,
            ...(t.requester ? { requester: t.requester } : {}),
            lifecycle: t.lifecycle,
            facts,
          });
          return t.buildLab(flavor, namesBefore);
        });

        const usedTemplateIds = [...current.usedTemplateIds, ...templates.map((t) => t.id)];
        const labs = [...current.labs, ...newLabs];
        saveGenerated({ labs, usedTemplateIds, usedNames });
        set({ labs, generating: false });
        return newLabs;
      } catch (err) {
        set({ generating: false });
        throw err;
      }
    },

    async generateBatchLab(batchId: string) {
      set({ generating: true });
      try {
        const bt = pickBatchTemplate(batchId);
        if (!bt) throw new Error(`Unknown batch template: ${batchId}`);

        const current = loadGenerated();
        // For batch templates, the ticket subjects are pre-defined in the
        // template. We just need a scene-narrative + coaching question.
        // Pre-compute the ticket ids so buildLab() can reference them in steps.
        const ticketIds = Array.from(
          { length: bt.ticketCount },
          (_, i) => `batch-${bt.id}-${String(i + 1).padStart(3, '0')}`,
        );
        // The scene is written from the queue's real tickets, not placeholders.
        const flavor = await generateBatchFlavor({
          labLabel: bt.label,
          ticketCount: bt.ticketCount,
          zoneId: bt.zoneId,
          ticketSubjects: batchTicketSubjects(bt, ticketIds),
        });
        const newLab = bt.buildLab(
          { narrative: flavor.narrative, coachingQuestion: flavor.coachingQuestion },
          ticketIds,
        );

        // Store the ticket ids on the lab object so the seed function can
        // read them back at start time (conductor's seedFn has no other way
        // to receive these since it only receives SeedContext).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (newLab as any)._batchTicketIds = ticketIds;

        const usedTemplateIds = [...current.usedTemplateIds, bt.id];
        const labs = [...current.labs, newLab];
        saveGenerated({ labs, usedTemplateIds, usedNames: current.usedNames });
        set({ labs, generating: false });
        return newLab;
      } catch (err) {
        set({ generating: false });
        throw err;
      }
    },

    async generateAllBatches() {
      set({ generating: true });
      try {
        const current = loadGenerated();
        // Build all 3 batch labs in parallel, each with a fresh flavor
        const flavorResults = await Promise.all(
          BATCH_TEMPLATES.map(async (bt) => {
            const ticketIds = Array.from(
              { length: bt.ticketCount },
              (_, i) => `batch-${bt.id}-${String(i + 1).padStart(3, '0')}`,
            );
            const flavor = await generateBatchFlavor({
              labLabel: bt.label,
              ticketCount: bt.ticketCount,
              zoneId: bt.zoneId,
              ticketSubjects: batchTicketSubjects(bt, ticketIds),
            });
            const lab = bt.buildLab(
              { narrative: flavor.narrative, coachingQuestion: flavor.coachingQuestion },
              ticketIds,
            );
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (lab as any)._batchTicketIds = ticketIds;
            return lab;
          }),
        );

        const usedTemplateIds = [...current.usedTemplateIds, ...BATCH_TEMPLATES.map((bt) => bt.id)];
        const labs = [...current.labs, ...flavorResults];
        saveGenerated({ labs, usedTemplateIds, usedNames: current.usedNames });
        set({ labs, generating: false });
        return flavorResults;
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
