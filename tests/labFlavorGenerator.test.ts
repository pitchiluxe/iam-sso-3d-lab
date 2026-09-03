/**
 * tests/labFlavorGenerator.test.ts
 *
 * Only tests the offline/fallback path — no real network call. Mirrors how
 * ollamaSupervisor.ts is designed (window.env.OLLAMA_DISABLED short-circuits
 * before any fetch).
 *
 * Vitest runs this under the `node` test environment (see vite.config.ts),
 * which has no global `window`. We provide a minimal in-memory shim here
 * rather than pulling in jsdom project-wide.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { generateFlavor } from '@/services/labFlavorGenerator';

if (typeof globalThis.window === 'undefined') {
  (globalThis as unknown as { window: unknown }).window = {};
}

describe('generateFlavor (offline fallback)', () => {
  beforeEach(() => {
    (window as unknown as { env: Record<string, string> }).env = { OLLAMA_DISABLED: 'true' };
  });
  afterEach(() => {
    delete (window as unknown as { env?: unknown }).env;
  });

  it('returns non-empty narrative and coaching question without any network call', async () => {
    const flavor = await generateFlavor({
      ticketTypeLabel: 'Account Lockout',
      targetDisplayName: 'Jane Doe',
      targetTitle: 'Junior Financial Analyst',
      targetDept: 'Finance',
    });
    expect(flavor.narrative.length).toBeGreaterThan(10);
    expect(flavor.coachingQuestion.length).toBeGreaterThan(5);
    expect(flavor.narrative).toContain('Jane Doe');
  });
});
