/**
 * types/global.d.ts — browser global augmentation for the dev console API.
 * Allows `window.__lab.start('lab01')` etc. without TypeScript errors.
 */
import type { Conductor } from './conductor/conductor';
import type { Lab } from './domain';

declare global {
  interface Window {
    __lab: {
      start(id: string): void;
      list(): string[];
      get(): Lab | null;
      conductor: Conductor;
    };
    __labState: {
      stepIndex: number;
    };
    /** Electron IPC bridge — populated by preload.cjs when running in Electron.
     *  Undefined in browser/dev mode. */
    electron?: {
      invoke(cmd: string, ...args: unknown[]): Promise<unknown>;
      onUpdateStatus?(fn: (status: { state: string; info: unknown }) => void): () => void;
    };
  }
}

export {};
