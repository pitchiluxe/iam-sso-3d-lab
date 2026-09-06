/**
 * tests/gameInputGuard.test.ts
 *
 * Guards the 3D player's keyboard handler against firing while the learner is
 * typing — inside the VM desktop, in a Notepad/terminal field, or in any HUD
 * input. Regression cover for "pressing E while typing a comment glitches".
 */
import { describe, it, expect } from 'vitest';
import { shouldIgnoreGameKey } from '@/util/gameInputGuard';

/** Minimal stand-in for an EventTarget — avoids needing a DOM environment. */
function el(tagName: string, attrs: Record<string, string> = {}) {
  return {
    tagName: tagName.toUpperCase(),
    isContentEditable: attrs.contentEditable === 'true',
    getAttribute: (k: string) => attrs[k] ?? null,
  };
}

describe('shouldIgnoreGameKey', () => {
  it('allows movement keys against the 3D canvas', () => {
    expect(shouldIgnoreGameKey(el('canvas'), true)).toBe(false);
    expect(shouldIgnoreGameKey(el('body'), true)).toBe(false);
  });

  it('ignores keys typed into text inputs', () => {
    expect(shouldIgnoreGameKey(el('input'), true)).toBe(true);
    expect(shouldIgnoreGameKey(el('textarea'), true)).toBe(true);
    expect(shouldIgnoreGameKey(el('select'), true)).toBe(true);
  });

  it('ignores keys typed into contenteditable regions', () => {
    expect(shouldIgnoreGameKey(el('div', { contentEditable: 'true' }), true)).toBe(true);
  });

  it('ignores every key while the VM desktop has input focus', () => {
    // inputEnabled=false means an overlay (desktop/console/start) owns input.
    expect(shouldIgnoreGameKey(el('canvas'), false)).toBe(true);
    expect(shouldIgnoreGameKey(el('body'), false)).toBe(true);
  });

  it('tolerates a null target', () => {
    expect(shouldIgnoreGameKey(null, true)).toBe(false);
    expect(shouldIgnoreGameKey(null, false)).toBe(true);
  });

  it('treats a readonly input as still typing-focused', () => {
    // A readonly URL bar still owns the caret; E must not reach the world.
    expect(shouldIgnoreGameKey(el('input', { readonly: 'true' }), true)).toBe(true);
  });
});
