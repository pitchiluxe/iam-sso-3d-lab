/**
 * util/persistence.ts — versioned localStorage envelope for all persisted state.
 *
 * Schema v2 unifies what was previously split across:
 *   - iam-lab-progress-v1  (progressStore only: completedLabIds + bestScores)
 *
 * The v2 envelope holds:
 *   - progress: migrated from v1
 *   - resume:  current lab + step index + step statuses (labStore)
 *   - evidence: collected evidence items (evidenceStore)
 *
 * Migration: on load, if only v1 exists, its data is migrated into v2 and
 * the v1 key is deleted. Future reads always read v2.
 */
import type { LabId, ScoreBreakdown } from '@/domain';
import type { StepStatus } from '@/stores/labStore';
import type { Evidence } from '@/domain';

const V2_KEY = 'iam-lab-state-v2';
const V1_KEY = 'iam-lab-progress-v1';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export interface PersistedProgress {
  completedLabIds: LabId[];
  bestScores: Partial<Record<LabId, ScoreBreakdown>>;
  startedAt: Partial<Record<LabId, number>>;
}

export interface PersistedResume {
  currentLabId: LabId;
  stepIndex: number;
  stepStatuses: Record<string, StepStatus>;
  failed: boolean;
}

export interface PersistedState {
  version: 2;
  progress: PersistedProgress;
  resume: PersistedResume | null;
  evidence: Evidence[];
}

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------

function migrateFromV1(): PersistedProgress {
  try {
    const raw = localStorage.getItem(V1_KEY);
    if (!raw) return { completedLabIds: [], bestScores: {}, startedAt: {} };
    const parsed = JSON.parse(raw) as {
      completedLabIds?: LabId[];
      bestScores?: Partial<Record<LabId, ScoreBreakdown>>;
      startedAt?: Partial<Record<LabId, number>>;
    };
    return {
      completedLabIds: parsed.completedLabIds ?? [],
      bestScores: parsed.bestScores ?? {},
      startedAt: parsed.startedAt ?? {},
    };
  } catch {
    return { completedLabIds: [], bestScores: {}, startedAt: {} };
  }
}

export function loadPersistedState(): PersistedState {
  try {
    const raw = localStorage.getItem(V2_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PersistedState;
      if (parsed.version === 2) return parsed;
    }
    // Fall back to v1 and migrate
    const progress = migrateFromV1();
    const state: PersistedState = {
      version: 2,
      progress,
      resume: null,
      evidence: [],
    };
    saveEnvelope(state);
    localStorage.removeItem(V1_KEY);
    return state;
  } catch {
    return {
      version: 2,
      progress: { completedLabIds: [], bestScores: {}, startedAt: {} },
      resume: null,
      evidence: [],
    };
  }
}

// ---------------------------------------------------------------------------
// Save
// ---------------------------------------------------------------------------

export function saveEnvelope(state: PersistedState): void {
  try {
    localStorage.setItem(V2_KEY, JSON.stringify(state));
    // Clean up v1 if it still exists (migration)
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
    s['version'] === 2 &&
    typeof s['progress'] === 'object' &&
    (s['resume'] === null || typeof s['resume'] === 'object') &&
    Array.isArray(s['evidence'])
  );
}
