/**
 * tests/updateManager.test.ts
 *
 * Verifies the updateManager's pure/typed interface.
 *
 * Note: Full bridge testing requires a DOM environment (Electron renderer or
 * jsdom) because updateManager reads `window.electron`. The singleton pattern
 * also makes clean isolation tricky in Vitest's Node context. We verify the
 * parts that work in Node: subscription, status object shape, and the
 * fallback `idle` response in non-Electron environments.
 */
import { describe, it, expect } from 'vitest';
import { updateManager } from '@/util/updateManager';

describe('updateManager', () => {
  it('subscribers are notified immediately with the current status', () => {
    let received: ReturnType<typeof updateManager.getStatus> | null = null;
    updateManager.subscribe((s) => {
      received = s;
    });
    expect(received).toBeTruthy();
    expect(received!.state).toBe('idle');
  });

  it('returns a well-shaped status object', () => {
    const status = updateManager.getStatus();
    expect(status).toHaveProperty('state');
    expect(typeof status.state).toBe('string');
    expect(['idle', 'checking', 'available', 'downloading', 'downloaded', 'unsupported']).toContain(
      status.state,
    );
  });

  it('has all expected public methods', () => {
    expect(typeof updateManager.isAvailable).toBe('function');
    expect(typeof updateManager.getStatus).toBe('function');
    expect(typeof updateManager.subscribe).toBe('function');
    expect(typeof updateManager.checkForUpdates).toBe('function');
    expect(typeof updateManager.downloadUpdate).toBe('function');
    expect(typeof updateManager.installUpdate).toBe('function');
  });
});

