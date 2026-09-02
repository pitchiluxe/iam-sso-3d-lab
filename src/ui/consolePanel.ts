/**
 * ui/consolePanel.ts — bottom-center console prompt + activation overlay.
 * Phase D ships a stub that displays a "Console activated" message and
 * shows the available actions. Real console UIs come in Phase E (IAM/Ticket
 * console) and Phase F (other zones).
 *
 * Errors thrown by a console renderer are caught and rendered as an
 * in-overlay error panel — the surrounding app keeps working.
 */
import { report } from '@/util/errors';

export interface ConsoleUI {
  /** Container element for the prompt (bottom of screen, near the crosshair). */
  promptEl: HTMLElement;
  /** Container for the full overlay that opens on activate. */
  overlayEl: HTMLElement;
  /** Set the current proximity prompt. */
  setPrompt(text: string | null): void;
  /** Show the overlay for a given console. */
  open(consoleId: string, title: string): void;
  /** Close the overlay. */
  close(): void;
  /** Register a render hook called every time the overlay is shown. */
  onRender: ((consoleId: string, body: HTMLElement) => void) | null;
  /**
   * Re-render the current console's body using the registered onRender hook.
   * Used by the in-overlay "Reload console" button after a render failure.
   */
  retry(): void;
}

export function initConsoleUI(): ConsoleUI {
  const promptEl = document.createElement('div');
  promptEl.id = 'console-prompt';
  promptEl.style.cssText = `
    position: fixed; left: 50%; bottom: 64px; transform: translateX(-50%);
    background: rgba(27,31,36,0.92); color: var(--fg);
    padding: 6px 14px; border-radius: 4px; font-size: 13px;
    border: 1px solid var(--border); pointer-events: none;
    display: none; z-index: 20;
  `;
  document.body.appendChild(promptEl);

  const overlayEl = document.createElement('div');
  overlayEl.id = 'console-overlay';
  overlayEl.style.cssText = `
    position: fixed; right: 24px; top: 60px; width: 480px; max-height: calc(100vh - 96px);
    background: var(--panel); border: 1px solid var(--border); border-radius: 6px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.6);
    display: none; flex-direction: column; z-index: 30;
    font-size: 13px;
  `;
  overlayEl.innerHTML = `
    <div id="console-overlay-header"
         style="display:flex;align-items:center;justify-content:space-between;
                padding:10px 14px;border-bottom:1px solid var(--border);
                background: var(--panel-2); border-radius: 6px 6px 0 0;">
      <strong id="console-overlay-title">Console</strong>
      <span id="console-overlay-close"
            style="cursor:pointer;color:var(--muted);user-select:none;font-size:18px;line-height:1;">&times;</span>
    </div>
    <div id="console-overlay-body"
         style="padding:14px;overflow-y:auto;flex:1;min-height:200px;">
    </div>
  `;
  document.body.appendChild(overlayEl);

  const closeBtn = overlayEl.querySelector('#console-overlay-close') as HTMLElement;
  closeBtn.addEventListener('click', () => ui.close());

  let lastConsoleId: string | null = null;

  const ui: ConsoleUI = {
    promptEl, overlayEl,
    onRender: null,
    setPrompt(text) {
      if (text) { promptEl.textContent = text; promptEl.style.display = 'block'; }
      else      { promptEl.style.display = 'none'; }
    },
    open(consoleId, title) {
      const titleEl = overlayEl.querySelector('#console-overlay-title')!;
      titleEl.textContent = title;
      overlayEl.style.display = 'flex';
      lastConsoleId = consoleId;
      const body = overlayEl.querySelector('#console-overlay-body') as HTMLElement;
      body.innerHTML = '';
      try {
        ui.onRender?.(consoleId, body);
      } catch (err) {
        renderConsoleError(body, consoleId, err, ui);
      }
    },
    close() { overlayEl.style.display = 'none'; },
    retry() {
      if (!lastConsoleId) return;
      const title = (overlayEl.querySelector('#console-overlay-title') as HTMLElement).textContent ?? '';
      ui.open(lastConsoleId, title);
    },
  };

  return ui;
}

/**
 * Render an in-overlay error panel for a failed console. The rest of the
 * app keeps working — the learner can close the console, switch consoles,
 * or hit "Reload console" to try again.
 */
function renderConsoleError(body: HTMLElement, consoleId: string, err: unknown, ui: ConsoleUI): void {
  report('console-render-failed', `Console "${consoleId}" failed to render`, {
    context: { consoleId },
    cause: err,
  });
  const msg = err instanceof Error ? err.message : String(err);
  body.innerHTML = `
    <div style="padding:20px;color:var(--fg);">
      <div style="color:#f48771;font-weight:600;margin-bottom:8px;">Console error</div>
      <div style="color:var(--muted);font-size:12px;margin-bottom:14px;line-height:1.5;">
        The ${consoleId} console failed to render.<br>
        <span style="font-family:monospace;color:#8b95a1;">${msg}</span>
      </div>
      <div style="display:flex;gap:8px;">
        <button id="console-retry-btn"
                style="background:#1b1f24;color:var(--fg);border:1px solid #2d343d;
                       border-radius:4px;padding:8px 14px;font-size:12px;cursor:pointer;min-height:36px;">
          ↻ Reload console
        </button>
        <button id="console-close-btn"
                style="background:#1b1f24;color:var(--muted);border:1px solid #2d343d;
                       border-radius:4px;padding:8px 14px;font-size:12px;cursor:pointer;min-height:36px;">
          Close
        </button>
      </div>
    </div>
  `;
  body.querySelector('#console-retry-btn')?.addEventListener('click', () => ui.retry());
  body.querySelector('#console-close-btn')?.addEventListener('click', () => ui.close());
}
