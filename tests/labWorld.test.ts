/**
 * tests/labWorld.test.ts — DC01 and CLIENT01 are one persistent world that
 * the machine windows, the AD Enterprise Lab and the IAM Portfolio share.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  WORLD_KEY,
  loadWorld,
  onWorldChanged,
  resetWorld,
  runOn,
  saveWorld,
} from '@/vm/adlab/world';
import { startingState } from '@/vm/adlab/labs';

class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string): string | null {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.m.set(k, v);
  }
  removeItem(k: string): void {
    this.m.delete(k);
  }
}

beforeEach(() => {
  (globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage();
});
afterEach(() => {
  delete (globalThis as { localStorage?: unknown }).localStorage;
});

/** Lab states built twice differ only in wall-clock stamps (event times, the clock). */
const timeless = (x: unknown): unknown =>
  JSON.parse(JSON.stringify(x, (k, v) => (k === 'clock' || k === 'time' ? undefined : v)));

describe('lab world', () => {
  it('starts at AD Lab 01 with both machines signed out', () => {
    const w = loadWorld();
    expect(w.labId).toBe('adl-01');
    expect(timeless(w.state)).toEqual(timeless(startingState('adl-01')));
    expect(w.signedIn).toEqual({ DC01: false, CLIENT01: false });
  });

  it('work done on a machine is saved and comes back', () => {
    const w = loadWorld();
    const r = runOn(w, 'DC01', 'Rename-Computer -NewName DC01');
    expect(r.ok).toBe(true);
    const again = loadWorld();
    expect(again.state.hosts.DC01.pendingHostname ?? again.state.hosts.DC01.hostname).toBe('DC01');
    expect(again.state.history.length).toBe(w.state.history.length);
  });

  it('reset puts the world at the chosen lab start and signs out', () => {
    const w = loadWorld();
    w.signedIn.DC01 = true;
    saveWorld(w);
    const fresh = resetWorld('adl-02');
    expect(fresh.labId).toBe('adl-02');
    expect(timeless(fresh.state)).toEqual(timeless(startingState('adl-02')));
    expect(loadWorld().signedIn.DC01).toBe(false);
  });

  it('tells listeners once per command', () => {
    const w = loadWorld();
    let calls = 0;
    const off = onWorldChanged(() => calls++);
    runOn(w, 'DC01', 'hostname');
    runOn(w, 'DC01', 'ipconfig');
    off();
    runOn(w, 'DC01', 'hostname');
    expect(calls).toBe(2);
  });

  it('an unreadable save or missing storage never breaks the lab', () => {
    localStorage.setItem(WORLD_KEY, '{not json');
    expect(loadWorld().labId).toBe('adl-01');
    delete (globalThis as { localStorage?: unknown }).localStorage;
    const w = loadWorld();
    expect(runOn(w, 'DC01', 'hostname').ok).toBe(true);
  });
});
