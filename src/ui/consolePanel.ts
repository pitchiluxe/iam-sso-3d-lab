/**
 * ui/consolePanel.ts — bottom-center console prompt + activation overlay.
 * Phase D ships a stub that displays a "Console activated" message and
 * shows the available actions. Real console UIs come in Phase E (IAM/Ticket
 * console) and Phase F (other zones).
 */
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
      const body = overlayEl.querySelector('#console-overlay-body') as HTMLElement;
      body.innerHTML = '';
      ui.onRender?.(consoleId, body);
    },
    close() { overlayEl.style.display = 'none'; },
  };

  // ESC closes the overlay
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') ui.close();
  });

  return ui;
}
