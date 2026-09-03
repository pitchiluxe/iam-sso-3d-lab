/**
 * tests/labFlavorGenerator.test.ts
 *
 * Only tests the offline/fallback path — no real network call. Mirrors how
 * ollamaSupervisor.ts is designed (window.env.OLLAMA_DISABLED short-circuits
 * before any fetch).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { generateFlavor } from '@/services/labFlavorGenerator';

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
