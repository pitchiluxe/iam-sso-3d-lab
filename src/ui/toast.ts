/**
 * ui/toast.ts — transient error / info notifications.
 * Toasts appear bottom-center, stack vertically, auto-dismiss after `durationMs`.
 * Imported by startScreen (for import errors) and by service/zone error handlers.
 */
interface ToastOptions {
  durationMs?: number;
  kind?: 'info' | 'error' | 'warn' | 'success';
}

let container: HTMLDivElement | null = null;

function getContainer(): HTMLDivElement {
  if (container) return container;
  container = document.createElement('div');
  container.id = 'toast-container';
  container.style.cssText = `
    position: fixed;
    bottom: 60px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 9999;
    pointer-events: none;
    align-items: center;
  `;
  document.body.appendChild(container);
  return container;
}

const KIND_COLORS: Record<NonNullable<ToastOptions['kind']>, { bg: string; border: string; icon: string }> = {
  info:    { bg: 'rgba(27,31,36,0.96)', border: '#4ec9b0', icon: 'ℹ' },
  error:   { bg: 'rgba(36,20,20,0.96)', border: '#f48771', icon: '✕' },
  warn:    { bg: 'rgba(36,30,20,0.96)', border: '#d7ba7d', icon: '⚠' },
  success: { bg: 'rgba(20,36,28,0.96)', border: '#4ec9b0', icon: '✓' },
};

export function showToast(message: string, opts: ToastOptions = {}): void {
  const kind = opts.kind ?? 'info';
  const duration = opts.durationMs ?? 4000;
  const { bg, border, icon } = KIND_COLORS[kind];

  const el = document.createElement('div');
  el.style.cssText = `
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    background: ${bg};
    border: 1px solid ${border};
    border-radius: 6px;
    color: #e6e6e6;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 13px;
    max-width: 360px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    pointer-events: all;
    animation: toast-in 0.2s ease-out;
    white-space: nowrap;
  `;
  el.textContent = `${icon}  ${message}`;

  // Inject keyframes once
  if (!document.getElementById('toast-keyframes')) {
    const style = document.createElement('style');
    style.id = 'toast-keyframes';
    style.textContent = `
      @keyframes toast-in {
        from { opacity: 0; transform: translateY(8px); }
        to   { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head.appendChild(style);
  }

  const cont = getContainer();
  cont.appendChild(el);

  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.25s';
    setTimeout(() => el.remove(), 300);
  }, duration);
}
