/**
 * ui/errorLog.ts — floating background error log.
 *
 * Captures ALL errors that flow through the errorStore and displays them
 * in a collapsible panel in the corner. The panel can be opened/closed
 * with a hotkey (Ctrl+Shift+E) and exports a downloadable log file.
 *
 * Errors are also persisted to localStorage so they survive a page reload
 * (which is essential when debugging crashes).
 */
import { errorStore } from '@/stores';
import type { AppErrorReport } from '@/util/errors';

const STORAGE_KEY = 'iam-sso-error-log';
const MAX_PERSISTED = 200;

interface StoredError {
  kind: string;
  message: string;
  timestamp: number;
  context?: Record<string, unknown>;
  cause?: string;
}

function loadStored(): StoredError[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStored(errors: StoredError[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(errors.slice(0, MAX_PERSISTED)));
  } catch {
    /* quota exceeded — silently drop */
  }
}

function causeToString(cause: unknown): string {
  if (cause === undefined || cause === null) return '';
  if (cause instanceof Error) {
    return `${cause.message}\n${cause.stack ?? ''}`;
  }
  try {
    return JSON.stringify(cause);
  } catch {
    return String(cause);
  }
}

function reportToStored(r: AppErrorReport): StoredError {
  return {
    kind: r.kind,
    message: r.message,
    timestamp: r.timestamp,
    context: r.context,
    cause: causeToString(r.cause),
  };
}

let initialized = false;
let panelEl: HTMLElement | null = null;
let listEl: HTMLElement | null = null;
let badgeEl: HTMLElement | null = null;
let lastSeenTimestamp = 0;
let unreadCount = 0;

function ensurePanel(): void {
  if (panelEl) return;
  // Container
  panelEl = document.createElement('div');
  panelEl.id = 'error-log-panel';
  panelEl.style.cssText = `
    position: fixed; bottom: 60px; right: 12px; width: 480px; max-height: 400px;
    background: rgba(15, 17, 21, 0.97); color: #e6e6e6;
    border: 1px solid #2d343d; border-radius: 8px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.7);
    display: none; flex-direction: column; z-index: 200;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', monospace;
    font-size: 12px; overflow: hidden;
  `;

  // Header
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 12px; background: #1b1f24; border-bottom: 1px solid #2d343d;
  `;
  header.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;">
      <span style="color:#f48771;font-size:14px;">⚠</span>
      <strong style="color:#e6e6e6;font-size:12px;">Error Log</strong>
      <span id="error-log-count" style="color:#8b95a1;font-size:11px;">0</span>
    </div>
    <div style="display:flex;gap:4px;">
      <button id="error-log-copy" title="Copy log to clipboard"
        style="background:transparent;border:1px solid #2d343d;color:#8b95a1;
               border-radius:4px;padding:2px 8px;font-size:11px;cursor:pointer;">Copy</button>
      <button id="error-log-export" title="Download log as .json"
        style="background:transparent;border:1px solid #2d343d;color:#8b95a1;
               border-radius:4px;padding:2px 8px;font-size:11px;cursor:pointer;">Save</button>
      <button id="error-log-clear" title="Clear all errors"
        style="background:transparent;border:1px solid #2d343d;color:#8b95a1;
               border-radius:4px;padding:2px 8px;font-size:11px;cursor:pointer;">Clear</button>
      <button id="error-log-close" title="Hide"
        style="background:transparent;border:1px solid #2d343d;color:#8b95a1;
               border-radius:4px;padding:2px 8px;font-size:11px;cursor:pointer;">×</button>
    </div>
  `;
  panelEl.appendChild(header);

  // List
  listEl = document.createElement('div');
  listEl.id = 'error-log-list';
  listEl.style.cssText = `
    flex: 1; overflow-y: auto; padding: 6px;
  `;
  panelEl.appendChild(listEl);

  document.body.appendChild(panelEl);

  // Wire header buttons
  panelEl.querySelector('#error-log-close')?.addEventListener('click', () => {
    if (panelEl) panelEl.style.display = 'none';
  });
  panelEl.querySelector('#error-log-clear')?.addEventListener('click', () => {
    errorStore.getState().clear();
    saveStored([]);
    if (listEl) listEl.innerHTML = renderEmpty();
    if (badgeEl) {
      badgeEl.style.display = 'none';
      badgeEl.textContent = '0';
    }
    unreadCount = 0;
  });
  panelEl.querySelector('#error-log-copy')?.addEventListener('click', () => {
    const errors = errorStore.getState().errors;
    const text = errors.map((e) => formatForExport(e)).join('\n\n');
    void navigator.clipboard?.writeText(text);
  });
  panelEl.querySelector('#error-log-export')?.addEventListener('click', () => {
    const errors = errorStore.getState().errors;
    const text = errors.map((e) => formatForExport(e)).join('\n\n');
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `iam-sso-errors-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

function formatForExport(e: AppErrorReport): string {
  return JSON.stringify(
    {
      kind: e.kind,
      message: e.message,
      timestamp: new Date(e.timestamp).toISOString(),
      context: e.context,
      cause: causeToString(e.cause),
    },
    null,
    2,
  );
}

function renderEmpty(): string {
  return `
    <div style="padding:20px;text-align:center;color:#8b95a1;">
      <div style="font-size:24px;margin-bottom:6px;">✓</div>
      <div>No errors recorded.</div>
      <div style="font-size:11px;margin-top:4px;">All systems operational.</div>
    </div>
  `;
}

function renderError(e: AppErrorReport): string {
  const time = new Date(e.timestamp).toLocaleTimeString();
  const isFatal = e.kind === 'zone-build-failed' || e.kind === 'webgl-lost';
  const isWarn = e.kind === 'console-render-failed' || e.kind === 'service-call-failed';
  const color = isFatal ? '#f48771' : isWarn ? '#d7ba7d' : '#8b95a1';
  const ctxStr = e.context ? `\n  context: ${JSON.stringify(e.context)}` : '';
  const causeStr = e.cause ? `\n  cause: ${causeToString(e.cause).split('\n')[0]}` : '';
  return `
    <div style="padding:6px 8px;margin-bottom:4px;background:#0e1116;
                border-left:2px solid ${color};border-radius:0 4px 4px 0;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;">
        <span style="color:${color};font-weight:600;font-size:11px;">${e.kind}</span>
        <span style="color:#8b95a1;font-size:10px;">${time}</span>
      </div>
      <div style="color:#c8cdd3;margin-top:2px;line-height:1.4;">${escapeHtml(e.message)}</div>
      <pre style="color:#8b95a1;font-size:10px;margin:4px 0 0 0;white-space:pre-wrap;
                  word-break:break-all;font-family:monospace;">${escapeHtml(ctxStr + causeStr)}</pre>
    </div>
  `;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function refreshList(): void {
  if (!listEl) return;
  const errors = errorStore.getState().errors;
  const countEl = document.getElementById('error-log-count');
  if (countEl) countEl.textContent = String(errors.length);
  if (errors.length === 0) {
    listEl.innerHTML = renderEmpty();
  } else {
    listEl.innerHTML = errors.map(renderError).join('');
  }
  // Scroll to top so newest is visible
  listEl.scrollTop = 0;
}

function ensureBadge(): void {
  if (badgeEl) return;
  badgeEl = document.createElement('button');
  badgeEl.id = 'error-log-badge';
  badgeEl.title = 'Error log (Ctrl+Shift+E)';
  badgeEl.style.cssText = `
    position: fixed; bottom: 60px; right: 12px; width: 38px; height: 38px;
    background: #1b1f24; color: #f48771; border: 1px solid #2d343d;
    border-radius: 50%; font-size: 16px; cursor: pointer; z-index: 199;
    display: none; align-items: center; justify-content: center;
    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
  `;
  badgeEl.textContent = '⚠';
  badgeEl.addEventListener('click', () => {
    if (panelEl) {
      const isOpen = panelEl.style.display !== 'none';
      panelEl.style.display = isOpen ? 'none' : 'flex';
      if (!isOpen) refreshList();
      unreadCount = 0;
      updateBadgeCount();
    }
  });
  document.body.appendChild(badgeEl);
}

function updateBadgeCount(): void {
  if (!badgeEl) return;
  if (unreadCount > 0) {
    badgeEl.textContent = String(unreadCount);
    badgeEl.style.display = 'flex';
    badgeEl.title = `${unreadCount} new error(s) — click to view (Ctrl+Shift+E)`;
  } else {
    badgeEl.textContent = '⚠';
    badgeEl.style.display = 'none';
  }
}

/**
 * Initialize the error log. Call once after the DOM is ready.
 * Restores any persisted errors from localStorage and subscribes
 * to the errorStore so new errors appear immediately.
 */
export function initErrorLog(): void {
  if (initialized) return;
  initialized = true;

  // Restore persisted errors
  const stored = loadStored();
  if (stored.length > 0) {
    for (const e of stored.reverse()) {
      errorStore.getState().record({
        kind: e.kind as AppErrorReport['kind'],
        message: e.message,
        context: e.context,
        cause: e.cause,
        timestamp: e.timestamp,
      });
    }
  }

  ensureBadge();
  ensurePanel();

  // Subscribe to new errors
  let lastSeen = errorStore.getState().lastError?.timestamp ?? 0;
  errorStore.subscribe((s) => {
    const e = s.lastError;
    if (!e) return;
    if (e.timestamp <= lastSeen) return;
    lastSeen = e.timestamp;
    if (e.timestamp > lastSeenTimestamp) {
      unreadCount++;
      lastSeenTimestamp = e.timestamp;
      updateBadgeCount();
    }
    // Persist
    const all = s.errors.map(reportToStored);
    saveStored(all);
    // If panel is open, refresh
    if (panelEl && panelEl.style.display !== 'none') {
      refreshList();
    }
  });

  // Hotkey: Ctrl+Shift+E
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.code === 'KeyE') {
      e.preventDefault();
      if (panelEl) {
        const isOpen = panelEl.style.display !== 'none';
        panelEl.style.display = isOpen ? 'none' : 'flex';
        if (!isOpen) {
          refreshList();
          unreadCount = 0;
          updateBadgeCount();
        }
      }
    }
  });
}
