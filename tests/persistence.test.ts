/**
 * tests/persistence.test.ts
 *
 * Vitest runs this suite under the `node` test environment (see
 * vite.config.ts), which has no global `localStorage` (Node 22 only
 * exposes one behind an experimental flag + file backing). No other test
 * in this repo touches localStorage, so we shim a minimal in-memory
 * Storage here rather than pulling in jsdom/happy-dom project-wide.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { loadPersistedState, saveEnvelope } from '@/util/persistence';

if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  const memoryStorage: Storage = {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(globalThis, 'localStorage', {
    value: memoryStorage,
    writable: true,
    configurable: true,
  });
}

describe('persistence v3 migration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults generatedLabs on a fresh (empty) store', () => {
    const state = loadPersistedState();
    expect(state.version).toBe(3);
    expect(state.generatedLabs).toEqual({ labs: [], usedTemplateIds: [], usedNames: [] });
  });

  it('migrates a v2 envelope (no generatedLabs field) by defaulting it', () => {
    const v2 = {
      version: 2,
      progress: { completedLabIds: [], bestScores: {}, startedAt: {} },
      resume: null,
      evidence: [],
    };
    localStorage.setItem('iam-lab-state-v2', JSON.stringify(v2));
    const state = loadPersistedState();
    expect(state.version).toBe(3);
    expect(state.generatedLabs).toEqual({ labs: [], usedTemplateIds: [], usedNames: [] });
    expect(state.progress).toEqual(v2.progress);
  });

  it('round-trips a populated generatedLabs slice through saveEnvelope', () => {
    const state = loadPersistedState();
    state.generatedLabs.usedTemplateIds.push('account-lockout');
    saveEnvelope(state);
    const reloaded = loadPersistedState();
    expect(reloaded.generatedLabs.usedTemplateIds).toEqual(['account-lockout']);
  });
});
