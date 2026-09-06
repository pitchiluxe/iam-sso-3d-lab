/**
 * tests/moduleGraph.test.ts
 *
 * Guards against the import cycle
 *   conductor -> stores -> generatedLabsStore -> templates -> conductor
 *
 * The cycle only bites depending on which module is evaluated first. The app
 * survived it because main.ts happens to import in a lucky order; importing
 * Conductor first left `registerLabSeed` undefined at templates.ts module
 * scope and threw "registerLabSeed is not a function" during evaluation.
 *
 * ollamaSupervisor.ts already carried a comment working around one edge of
 * this cycle, which is a sign it was load-bearing rather than theoretical.
 */
import { describe, it, expect } from 'vitest';

describe('module graph', () => {
  it('Conductor can be imported before anything else', async () => {
    const mod = await import('@/conductor/conductor');
    expect(typeof mod.Conductor).toBe('function');
  });

  it('the seed registry is usable when imported on its own', async () => {
    const reg = await import('@/conductor/seedRegistry');
    expect(typeof reg.registerLabSeed).toBe('function');
    expect(typeof reg.getSeed).toBe('function');
    // The built-in per-lab seeds are present without touching the conductor.
    expect(reg.getSeed('lab01')).toBeTypeOf('function');
    expect(reg.getSeed('baseline')).toBeTypeOf('function');
  });

  it('generated templates register their seeds without the conductor', async () => {
    const reg = await import('@/conductor/seedRegistry');
    await import('@/labs/generated/templates');
    expect(reg.getSeed('account-lockout')).toBeTypeOf('function');
  });

  it('a conductor instantiated after that import order still starts a lab', async () => {
    const { Conductor } = await import('@/conductor/conductor');
    const { mkLabId } = await import('@/domain');
    const c = new Conductor();
    c.start(mkLabId('lab02'));
    expect(c.dir.listUsers().length).toBeGreaterThan(0);
    expect(c.tickets.list().length).toBeGreaterThan(0);
  });
});
