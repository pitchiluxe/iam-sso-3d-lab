/**
 * util/persistence.ts — versioned localStorage envelope for all persisted state.
 *
 * Schema history:
 *   v1 — iam-lab-progress-v1 (progressStore only)
 *   v2 — unified progress + resume + evidence under iam-lab-state-v2
 *   v3 — adds generatedLabs (AI-generated daily-ticket labs + dedup ledger)
 *
 * Migration: on load, older versions are upgraded in place and re-saved
 * under the current key. Future reads always read the current version.
 */
import type { LabId, ScoreBreakdown, Lab } from '@/domain';
import type { StepStatus } from '@/stores/labStore';
import type { Evidence } from '@/domain';

const CURRENT_KEY = 'iam-lab-state-v2';
const V1_KEY = 'iam-lab-progress-v1';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export interface PersistedProgress {
  completedLabIds: LabId[];
  bestScores: Partial<Record<LabId, ScoreBreakdown>>;
  startedAt: Partial<Record<LabId, number>>;
  /** Achievement badge IDs the learner has earned. */
  achievedBadges: string[];
}

export interface PersistedResume {
  currentLabId: LabId;
  stepIndex: number;
  stepStatuses: Record<string, StepStatus>;
  failed: boolean;
}

export interface PersistedGeneratedLabs {
  /** Every AI-generated lab ever created, for pagination on the start screen. */
  labs: Lab[];
  /** Every template id used so far, oldest first — grows forever so a
   * template is never repeated until all 15 have been used at least once. */
  usedTemplateIds: string[];
  /** Every fresh onboarding/contractor name used so far, oldest first. */
  usedNames: string[];
}

export interface PersistedState {
  version: 3;
  progress: PersistedProgress;
  resume: PersistedResume | null;
  evidence: Evidence[];
  generatedLabs: PersistedGeneratedLabs;
}

function emptyGeneratedLabs(): PersistedGeneratedLabs {
  return { labs: [], usedTemplateIds: [], usedNames: [] };
}

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------

function migrateFromV1(): PersistedProgress {
  try {
    const raw = localStorage.getItem(V1_KEY);
    if (!raw) return { completedLabIds: [], bestScores: {}, startedAt: {}, achievedBadges: [] };
    const parsed = JSON.parse(raw) as {
      completedLabIds?: LabId[];
      bestScores?: Partial<Record<LabId, ScoreBreakdown>>;
      startedAt?: Partial<Record<LabId, number>>;
    };
    return {
      completedLabIds: parsed.completedLabIds ?? [],
      bestScores: parsed.bestScores ?? {},
      startedAt: parsed.startedAt ?? {},
      achievedBadges: [],
    };
  } catch {
    return { completedLabIds: [], bestScores: {}, startedAt: {}, achievedBadges: [] };
  }
}

function normalizeProgress(p: Partial<PersistedProgress> | undefined): PersistedProgress {
  return {
    completedLabIds: p?.completedLabIds ?? [],
    bestScores: p?.bestScores ?? {},
    startedAt: p?.startedAt ?? {},
    achievedBadges: p?.achievedBadges ?? [],
  };
}

export function loadPersistedState(): PersistedState {
  try {
    const raw = localStorage.getItem(CURRENT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedState> & { version?: number };
      if (parsed.version === 3) {
        // Backfill missing fields from older v3 saves.
        return {
          version: 3,
          progress: normalizeProgress(parsed.progress),
          resume: parsed.resume ?? null,
          evidence: parsed.evidence ?? [],
          generatedLabs: parsed.generatedLabs ?? emptyGeneratedLabs(),
        };
      }
      if (parsed.version === 2) {
        // v2 → v3: same shape, just add the new slice.
        const upgraded: PersistedState = {
          version: 3,
          progress: normalizeProgress(parsed.progress),
          resume: parsed.resume ?? null,
          evidence: parsed.evidence ?? [],
          generatedLabs: emptyGeneratedLabs(),
        };
        saveEnvelope(upgraded);
        return upgraded;
      }
    }
    // Fall back to v1 and migrate all the way to v3.
    const progress = migrateFromV1();
    const state: PersistedState = {
      version: 3,
      progress,
      resume: null,
      evidence: [],
      generatedLabs: emptyGeneratedLabs(),
    };
    saveEnvelope(state);
    localStorage.removeItem(V1_KEY);
    return state;
  } catch {
    return {
      version: 3,
      progress: { completedLabIds: [], bestScores: {}, startedAt: {}, achievedBadges: [] },
      resume: null,
      evidence: [],
      generatedLabs: emptyGeneratedLabs(),
    };
  }
}

// ---------------------------------------------------------------------------
// Save
// ---------------------------------------------------------------------------

export function saveEnvelope(state: PersistedState): void {
  try {
    localStorage.setItem(CURRENT_KEY, JSON.stringify(state));
    localStorage.removeItem(V1_KEY);
  } catch {
    /* quota exceeded or private mode */
  }
}

// ---------------------------------------------------------------------------
// Export / Import (File API)
// ---------------------------------------------------------------------------

export function exportToFile(state: PersistedState): void {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `iam-lab-progress-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Parse and validate an imported file. Throws on failure. */
export function importFromFile(file: File): Promise<PersistedState> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text) as unknown;
        if (!isPersistedState(parsed)) {
          reject(new Error('Invalid file format: not a valid IAM Lab progress file.'));
          return;
        }
        resolve(parsed);
      } catch {
        reject(new Error('Could not parse file as JSON.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsText(file);
  });
}

// ---------------------------------------------------------------------------
// Type guard
// ---------------------------------------------------------------------------

function isPersistedState(v: unknown): v is PersistedState {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;
  return (
    s['version'] === 3 &&
    typeof s['progress'] === 'object' &&
    (s['resume'] === null || typeof s['resume'] === 'object') &&
    Array.isArray(s['evidence']) &&
    typeof s['generatedLabs'] === 'object'
  );
}
