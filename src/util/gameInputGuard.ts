/**
 * util/gameInputGuard.ts — decides whether a keyboard event belongs to the 3D
 * world or to whatever the learner is typing into.
 *
 * The player's keydown handler is bound to `window`, so without this guard every
 * keystroke reaches the world: `E` activates the workstation the avatar is
 * standing at, and WASD walks the avatar around, while the learner is typing a
 * ticket comment or a PowerShell command inside the VM.
 *
 * Guard `keydown` only. `keyup` must always be processed, or a key held down in
 * the world and released over an input stays stuck in the pressed set and the
 * avatar walks forever.
 */

/** Elements that own the caret while focused. */
const TEXT_ENTRY_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/** Structural shape of the bits of an element this guard reads. Keeps the
 *  function testable without a DOM environment (vitest runs in `node`). */
interface GuardTarget {
  tagName?: string;
  isContentEditable?: boolean;
}

/**
 * @param target  The event's `target` (may be null).
 * @param inputEnabled  False while an overlay — VM desktop, console, start
 *   screen — owns input; the world should receive nothing at all.
 * @returns true when the 3D world must ignore this keydown.
 */
export function shouldIgnoreGameKey(target: unknown, inputEnabled: boolean): boolean {
  if (!inputEnabled) return true;
  if (!target || typeof target !== 'object') return false;

  const t = target as GuardTarget;
  if (t.isContentEditable === true) return true;
  return TEXT_ENTRY_TAGS.has((t.tagName ?? '').toUpperCase());
}
