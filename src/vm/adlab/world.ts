/**
 * vm/adlab/world.ts — DC01 and CLIENT01, as one world that survives closing
 * the app.
 *
 * The two lab machines are not VirtualBox VMs here: they are the AD Lab
 * engine's LabState, opened from the main VM's desktop like a Remote Desktop
 * session. The machine windows, the AD Enterprise Lab and the IAM Portfolio
 * all read and change this one world, so work typed in DC01's PowerShell,
 * clicked in its Active Directory window, or seeded by a Portfolio project is
 * the same work everywhere, and a learner who closes the app resumes where
 * they left off.
 */
import { runCommand, type CommandResult } from './commands';
import { startingState } from './labs';
import type { HostName, LabState } from './state';

export const WORLD_KEY = 'iam3d.labWorld.v1';

export interface LabWorld {
  state: LabState;
  /** Which lab the world was last set up for: an AD Lab id, or 'portfolio'. */
  labId: string;
  /** Whether each machine's session is signed in (the connect screen is skipped). */
  signedIn: Record<HostName, boolean>;
}

const listeners = new Set<() => void>();

function storage(): Storage | null {
  try {
    return (globalThis as { localStorage?: Storage }).localStorage ?? null;
  } catch {
    return null;
  }
}

function fresh(labId: string): LabWorld {
  return { state: startingState(labId), labId, signedIn: { DC01: false, CLIENT01: false } };
}

/** The saved world, or AD Lab 01's starting point when there is none. */
export function loadWorld(): LabWorld {
  try {
    const raw = storage()?.getItem(WORLD_KEY);
    if (raw) {
      const w = JSON.parse(raw) as Partial<LabWorld>;
      if (
        w &&
        w.state &&
        typeof w.labId === 'string' &&
        w.state.hosts?.DC01 &&
        w.state.hosts?.CLIENT01
      ) {
        return {
          state: w.state,
          labId: w.labId,
          signedIn: { DC01: false, CLIENT01: false, ...(w.signedIn ?? {}) },
        };
      }
    }
  } catch {
    // An unreadable save is ignored: the lab starts over rather than half-loading.
  }
  return fresh('adl-01');
}

export function saveWorld(w: LabWorld): void {
  try {
    storage()?.setItem(WORLD_KEY, JSON.stringify(w));
  } catch {
    // Full or blocked storage: the lab keeps working, it just is not remembered.
  }
}

/** Save and tell every open window the world changed. */
export function notifyWorldChanged(w: LabWorld): void {
  saveWorld(w);
  for (const fn of [...listeners]) {
    try {
      fn();
    } catch {
      // One broken window must not stop the others from refreshing.
    }
  }
}

export function onWorldChanged(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Start over: the world as it is at the start of `labId`, both machines signed out. */
export function resetWorld(labId: string): LabWorld {
  const w = fresh(labId);
  notifyWorldChanged(w);
  return w;
}

/**
 * Machines set aside when the learner moves to another lab, by lab id, so
 * going back resumes where they were — as snapshots do on real VMs.
 */
export const STASH_KEY = 'iam3d.labStash.v1';

function readStash(): Record<string, LabState> {
  try {
    const raw = storage()?.getItem(STASH_KEY);
    const v = raw ? (JSON.parse(raw) as unknown) : null;
    return v && typeof v === 'object' ? (v as Record<string, LabState>) : {};
  } catch {
    return {};
  }
}

function writeStash(stash: Record<string, LabState>): void {
  try {
    storage()?.setItem(STASH_KEY, JSON.stringify(stash));
  } catch {
    // Too big or blocked: the other labs simply start over when reopened.
  }
}

/**
 * Put DC01 and CLIENT01 in the state of `labId`: the current machines are set
 * aside under their lab, and `labId`'s are brought back — or built with
 * `build` the first time. Both machines sign out, as after a snapshot restore.
 */
export function switchWorld(labId: string, build: () => LabState): LabWorld {
  const current = loadWorld();
  if (current.labId === labId) return current;
  const stash = readStash();
  stash[current.labId] = current.state;
  const state = stash[labId] ?? build();
  delete stash[labId];
  writeStash(stash);
  const w: LabWorld = { state, labId, signedIn: { DC01: false, CLIENT01: false } };
  notifyWorldChanged(w);
  return w;
}

/** Forget set-aside machines (Start over), so those labs are rebuilt when next opened. */
export function forgetStashed(labIds: string[]): void {
  const stash = readStash();
  for (const id of labIds) delete stash[id];
  writeStash(stash);
}

/** Run one command line on a machine, then save and notify. */
export function runOn(w: LabWorld, host: HostName, line: string): CommandResult {
  const result = runCommand(w.state, host, line);
  notifyWorldChanged(w);
  return result;
}
