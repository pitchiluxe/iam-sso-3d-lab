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

/** Run one command line on a machine, then save and notify. */
export function runOn(w: LabWorld, host: HostName, line: string): CommandResult {
  const result = runCommand(w.state, host, line);
  notifyWorldChanged(w);
  return result;
}
