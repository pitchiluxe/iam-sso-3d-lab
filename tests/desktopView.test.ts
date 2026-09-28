/**
 * tests/desktopView.test.ts — the desktop's right-click View settings are
 * remembered, and a damaged or missing save falls back to the defaults.
 */
import { describe, it, expect, beforeEach } from 'vitest';

const store = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  },
});

import { DESKTOP_VIEW_KEY, ICON_METRICS, loadDesktopView, saveDesktopView } from '@/ui/desktopView';

describe('desktop View settings', () => {
  beforeEach(() => store.clear());

  it('defaults to medium icons, shown', () => {
    expect(loadDesktopView()).toEqual({ size: 'medium', showIcons: true });
  });

  it('remembers size and visibility', () => {
    saveDesktopView({ size: 'small', showIcons: false });
    expect(loadDesktopView()).toEqual({ size: 'small', showIcons: false });
  });

  it('ignores a damaged save', () => {
    store.set(DESKTOP_VIEW_KEY, '{not json');
    expect(loadDesktopView()).toEqual({ size: 'medium', showIcons: true });
    store.set(DESKTOP_VIEW_KEY, JSON.stringify({ size: 'huge' }));
    expect(loadDesktopView().size).toBe('medium');
  });

  it('small icons are smaller and fit more per column than large ones', () => {
    expect(ICON_METRICS.small.glyph).toBeLessThan(ICON_METRICS.medium.glyph);
    expect(ICON_METRICS.medium.glyph).toBeLessThan(ICON_METRICS.large.glyph);
    expect(ICON_METRICS.small.rows).toBeGreaterThan(ICON_METRICS.large.rows);
  });
});
