/**
 * tests/namePool.test.ts
 */
import { describe, it, expect } from 'vitest';
import { pickUnusedName, NAME_POOL } from '@/labs/generated/namePool';

describe('pickUnusedName', () => {
  it('returns a name from the pool with a lowercase dotted username', () => {
    const picked = pickUnusedName([]);
    expect(NAME_POOL.some((n) => n.displayName === picked.displayName)).toBe(true);
    expect(picked.username).toMatch(/^[a-z]+\.[a-z]+$/);
  });

  it('never returns an already-used name while unused ones remain', () => {
    const usedAllButOne = NAME_POOL.slice(1).map((n) => n.displayName);
    const picked = pickUnusedName(usedAllButOne);
    expect(picked.displayName).toBe(NAME_POOL[0]!.displayName);
  });

  it('falls back to the least-recently-used name once the pool is exhausted', () => {
    const allUsed = NAME_POOL.map((n) => n.displayName);
    const picked = pickUnusedName(allUsed);
    expect(picked.displayName).toBe(NAME_POOL[0]!.displayName);
  });
});
