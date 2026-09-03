/**
 * tests/generatedLabsStore.test.ts
 *
 * Vitest runs this suite under the `node` test environment (see
 * vite.config.ts), which has no global `localStorage`. Importing
 * generatedLabsStore triggers zustand's `create()` factory synchronously at
 * import time, which calls loadPersistedState() -> localStorage.getItem().
 * Shim a minimal in-memory Storage here, mirroring tests/persistence.test.ts,
 * rather than pulling in jsdom/happy-dom project-wide.
 */
import { describe, it, expect, beforeEach } from 'vitest';

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

import { pickTemplateBatch } from '@/stores/generatedLabsStore';
import { LAB_TEMPLATES } from '@/labs/generated/templates';

describe('pickTemplateBatch', () => {
  it('picks 10 unique templates never used before, on a fresh ledger', () => {
    const batch = pickTemplateBatch([], 10);
    expect(batch).toHaveLength(10);
    expect(new Set(batch.map((t) => t.id)).size).toBe(10);
  });

  it('prefers never-used templates over used ones', () => {
    const usedFive = LAB_TEMPLATES.slice(0, 5).map((t) => t.id);
    const batch = pickTemplateBatch(usedFive, 5);
    expect(batch.every((t) => !usedFive.includes(t.id))).toBe(true);
  });

  it('falls back to least-recently-used once all 15 are exhausted', () => {
    const allUsed = LAB_TEMPLATES.map((t) => t.id); // oldest-first order
    const batch = pickTemplateBatch(allUsed, 10);
    expect(batch).toHaveLength(10);
    // The 10 picked should be the 10 used longest ago — i.e. the first
    // 10 ids in the (oldest-first) ledger.
    expect(batch.map((t) => t.id)).toEqual(allUsed.slice(0, 10));
  });
});
