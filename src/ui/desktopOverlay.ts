/**
 * ui/desktopOverlay.ts — Windowed desktop OS overlay.
 *
 * Appears when the learner clicks the 3D workstation mesh. Provides a full
 * corporate OS shell (dark theme, taskbar, Start menu, system tray, live clock)
 * with multiple draggable/minimizable/maximizable/closable windows.
 */
import type { Conductor } from '@/conductor/conductor';
import { renderIAMConsole } from './consoles/iamConsole';
import { renderTicketConsole } from './consoles/ticketConsole';
import { renderSecOpsDashboard } from './consoles/secOpsDashboard';
import { renderOllamaConsole } from './consoles/ollamaConsole';
import { renderObjectivesWindow } from './consoles/objectivesWindow';
import { renderNotepadWindow } from './consoles/notepadWindow';
import { renderStickyNotesWindow } from './consoles/stickyNotesWindow';
import { renderFileExplorerWindow } from './consoles/fileExplorerWindow';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WindowDef {
  id: string;
  title: string;
  icon: string;
  width: number;
  height: number;
  render(conductor: Conductor, body: HTMLElement): void;
}

export interface DesktopOverlay {
  show(conductor: Conductor): void;
  hide(): void;
  isVisible(): boolean;
  openWindow(id: string, conductor: Conductor): void;
}

const DESKTOP_APPS: WindowDef[] = [
  { id: 'iam-console',     title: 'IAM Console',      icon: '🔐', width: 720, height: 580, render: (c, b) => renderIAMConsole(b, c) },
  { id: 'ticket-console',  title: 'Ticket Queue',     icon: '🎫', width: 680, height: 560, render: (c, b) => renderTicketConsole(b, c) },
  { id: 'secops-dashboard', title: 'SecOps Dashboard', icon: '🛡️', width: 740, height: 600, render: (c, b) => renderSecOpsDashboard(b, c) },
  { id: 'ollama-console',  title: 'AI Supervisor',    icon: '🤖', width: 640, height: 600, render: (c, b) => renderOllamaConsole(b, c) },
  { id: 'objectives',      title: 'Objectives',        icon: '📋', width: 380, height: 560, render: (c, b) => renderObjectivesWindow(b, c) },
  { id: 'notepad',         title: 'Notepad',           icon: '📝', width: 560, height: 480, render: (_c, b) => renderNotepadWindow(b) },
  { id: 'sticky-notes',    title: 'Sticky Notes',      icon: '📌', width: 480, height: 400, render: (_c, b) => renderStickyNotesWindow(b) },
  { id: 'explorer',        title: 'File Explorer',     icon: '📁', width: 700, height: 500, render: (_c, b) => renderFileExplorerWindow(b) },
];

const APP_BY_ID: Record<string, WindowDef> =
  Object.fromEntries(DESKTOP_APPS.map((a) => [a.id, a]));

// ---------------------------------------------------------------------------
// WindowManager
// ---------------------------------------------------------------------------

interface WinState {
  id: string;
  el: HTMLElement;
  body: HTMLElement;
  minimized: boolean;
  maximized: boolean;
  preMax: DOMRect | null;
}

class WindowManager {
  readonly conductor: Conductor;
  readonly desktop: HTMLElement;
  readonly windows: Map<string, WinState> = new Map();
  zIndex = 200;

  constructor(conductor: Conductor, desktop: HTMLElement) {
    this.conductor = conductor;
    this.desktop = desktop;
  }

  openById(id: string): void {
    const def = APP_BY_ID[id];
    if (def) this.open(def);
  }

  open(def: WindowDef): void {
    if (this.windows.has(def.id)) {
      this.focus(def.id);
      return;
    }
    const win = this.createWindowElement(def);
    this.desktop.appendChild(win.el);
    this.windows.set(def.id, win);
    this.focus(def.id);
    def.render(this.conductor, win.body);
    this.updateTaskbar();
  }

  close(id: string): void {
    const w = this.windows.get(id);
    if (!w) return;
    w.el.remove();
    this.windows.delete(id);
    this.updateTaskbar();
  }

  minimize(id: string): void {
    const w = this.windows.get(id);
    if (!w) return;
    w.el.style.display = 'none';
    w.minimized = true;
    this.updateTaskbar();
  }

  restore(id: string): void {
    const w = this.windows.get(id);
    if (!w) return;
    w.el.style.display = 'flex';
    w.minimized = false;
    this.focus(id);
    this.updateTaskbar();
  }

  toggleMaximize(id: string): void {
    const w = this.windows.get(id);
    if (!w) return;
    if (!w.maximized) {
      w.preMax = w.el.getBoundingClientRect();
      w.el.style.left = '0';
      w.el.style.top = '0';
      w.el.style.width = '100%';
      w.el.style.height = 'calc(100% - 48px)';
      w.maximized = true;
    } else {
      if (w.preMax) {
        w.el.style.left = `${w.preMax.left}px`;
        w.el.style.top = `${w.preMax.top}px`;
        w.el.style.width = `${w.preMax.width}px`;
        w.el.style.height = `${w.preMax.height}px`;
      }
      w.maximized = false;
    }
  }

  focus(id: string): void {
    const w = this.windows.get(id);
    if (!w) return;
    w.el.style.zIndex = String(++this.zIndex);
    this.updateTaskbar();
  }

  getMinimizedIds(): string[] {
    return [...this.windows.values()].filter((w) => w.minimized).map((w) => w.id);
  }

  getOpenIds(): string[] {
    return [...this.windows.keys()];
  }

  updateTaskbar(): void {
    const strip = document.getElementById('taskbar-apps');
    if (strip) strip.innerHTML = this.buildTaskbarHTML();
  }

  buildTaskbarHTML(): string {
    const open = this.getOpenIds();
    const minimized = this.getMinimizedIds();
    return DESKTOP_APPS
      .map((d) => {
        const isOpen = open.includes(d.id);
        const isMin = minimized.includes(d.id);
        if (!isOpen && !isMin) return '';
        const active = isOpen && !isMin ? 'taskbar-app--active' : '';
        const dataAttrs = `data-win="${d.id}" data-min="${isMin}"`;
        return `<button class="taskbar-app ${active}" ${dataAttrs} title="${d.title}">
          <span>${d.icon}</span>
          <span class="taskbar-app-label">${d.title}</span>
        </button>`;
      })
      .join('');
  }

  private createWindowElement(def: WindowDef): WinState {
    const el = document.createElement('div');
    el.className = 'apex-window';
    el.style.cssText = `
      position: fixed;
      display: flex;
      flex-direction: column;
      width: ${def.width}px;
      height: ${def.height}px;
      left: ${80 + Math.random() * 200}px;
      top: ${60 + Math.random() * 120}px;
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 8px 8px 4px 4px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04);
      overflow: hidden;
      resize: both;
    `;

    const titleBar = document.createElement('div');
    titleBar.className = 'apex-window-titlebar';
    titleBar.style.cssText = `
      display: flex; align-items: center; justify-content: space-between;
      padding: 8px 12px; background: #1b1f24; border-bottom: 1px solid #2d343d;
      cursor: move; user-select: none; flex-shrink: 0;
    `;

    const titleEl = document.createElement('div');
    titleEl.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:13px;color:#e6e6e6;font-weight:500;';
    titleEl.innerHTML = `<span>${def.icon}</span><span>${def.title}</span>`;
    titleBar.appendChild(titleEl);

    const lights = document.createElement('div');
    lights.style.cssText = 'display:flex;gap:6px;align-items:center;';
    const lightData = [
      { color: '#f48771', action: 'close' as const },
      { color: '#d7ba7d', action: 'minimize' as const },
      { color: '#4ec9b0', action: 'maximize' as const },
    ];
    for (const ld of lightData) {
      const btn = document.createElement('button');
      btn.style.cssText = `
        width: 12px; height: 12px; border-radius: 50%; border: none; cursor: pointer;
        background: ${ld.color}; opacity: 0.85;
        transition: opacity 0.15s;
      `;
      btn.title = ld.action;
      btn.addEventListener('click', () => {
        if (ld.action === 'close') this.close(def.id);
        else if (ld.action === 'minimize') this.minimize(def.id);
        else this.toggleMaximize(def.id);
      });
      btn.addEventListener('mouseenter', () => { btn.style.opacity = '1'; });
      btn.addEventListener('mouseleave', () => { btn.style.opacity = '0.85'; });
      lights.appendChild(btn);
    }
    titleBar.appendChild(lights);
    el.appendChild(titleBar);

    const body = document.createElement('div');
    body.style.cssText = 'flex: 1; overflow: auto; min-height: 0; background: #0e1116;';
    el.appendChild(body);

    // Dragging
    let dragging = false;
    let dx = 0, dy = 0;

    titleBar.addEventListener('mousedown', (e) => {
      if ((e.target as HTMLElement).tagName === 'BUTTON') return;
      dragging = true;
      const rect = el.getBoundingClientRect();
      dx = e.clientX - rect.left;
      dy = e.clientY - rect.top;
      this.focus(def.id);
    });

    const onMove = (e: MouseEvent) => {
      if (!dragging) return;
      const w = this.windows.get(def.id);
      if (!w || w.maximized) return;
      const maxX = window.innerWidth - 60;
      const maxY = window.innerHeight - 60;
      const x = Math.max(0, Math.min(maxX, e.clientX - dx));
      const y = Math.max(0, Math.min(maxY, e.clientY - dy));
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    };
    const onUp = () => { dragging = false; };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);

    titleBar.addEventListener('dblclick', (e) => {
      if ((e.target as HTMLElement).tagName === 'BUTTON') return;
      this.toggleMaximize(def.id);
    });
    titleBar.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).tagName === 'BUTTON') return;
      this.focus(def.id);
    });

    return { id: def.id, el, body, minimized: false, maximized: false, preMax: null };
  }
}

// ---------------------------------------------------------------------------
// DesktopOverlay
// ---------------------------------------------------------------------------

export function createDesktopOverlay(): DesktopOverlay {
  const wmCtx = { current: null as WindowManager | null };
  let visible = false;
  let container: HTMLElement | null = null;
  let clockInterval: number | null = null;

  function buildContainer(): HTMLElement {
    const c = document.createElement('div');
    c.id = 'desktop-overlay';
    c.style.cssText = `
      position: fixed; inset: 0; z-index: 90;
      background: rgba(6, 8, 12, 0.82);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      display: none; flex-direction: column;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI Variable', 'Segoe UI', sans-serif;
      font-size: 14px; color: #e6e6e6;
    `;
    document.body.appendChild(c);
    return c;
  }

  function buildDesktop(c: HTMLElement): void {
    const bg = document.createElement('div');
    bg.style.cssText = `
      position: absolute; inset: 0; bottom: 48px;
      background: linear-gradient(145deg, #0d1117 0%, #0e1520 60%, #0a1015 100%);
    `;
    const grid = document.createElement('div');
    grid.style.cssText = `
      position: absolute; inset: 0;
      background-image:
        linear-gradient(rgba(78,201,176,0.04) 1px, transparent 1px),
        linear-gradient(90deg, rgba(78,201,176,0.04) 1px, transparent 1px);
      background-size: 40px 40px;
      pointer-events: none;
    `;
    bg.appendChild(grid);
    c.appendChild(bg);

    // Desktop icons
    const iconCol = document.createElement('div');
    iconCol.style.cssText = `
      position: absolute; top: 20px; left: 16px;
      display: flex; flex-direction: column; gap: 8px; align-items: center;
    `;
    for (const app of DESKTOP_APPS) {
      const iconBtn = document.createElement('button');
      iconBtn.style.cssText = `
        background: transparent; border: none; cursor: pointer;
        display: flex; flex-direction: column; align-items: center; gap: 4px;
        padding: 8px; border-radius: 6px; width: 80px;
      `;
      iconBtn.innerHTML = `
        <span style="font-size:32px;line-height:1;">${app.icon}</span>
        <span style="font-size:11px;color:#c8cdd3;text-align:center;max-width:72px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${app.title}</span>
      `;
      iconBtn.title = `Open ${app.title} (double-click)`;
      iconBtn.addEventListener('dblclick', () => { wmCtx.current?.open(app); });
      iconBtn.addEventListener('click', () => { wmCtx.current?.open(app); });
      iconCol.appendChild(iconBtn);
    }
    bg.appendChild(iconCol);
  }

  function buildTaskbar(c: HTMLElement, conductor: Conductor): void {
    const wm = new WindowManager(conductor, c);
    wmCtx.current = wm;

    const tb = document.createElement('div');
    tb.id = 'apex-taskbar';
    tb.style.cssText = `
      position: absolute; bottom: 0; left: 0; right: 0; height: 48px;
      background: rgba(27, 31, 36, 0.85);
      border-top: 1px solid #2d343d;
      backdrop-filter: blur(12px);
      display: flex; align-items: center; gap: 4px;
      padding: 0 8px; z-index: 50;
    `;

    const startBtn = document.createElement('button');
    startBtn.id = 'taskbar-start';
    startBtn.style.cssText = `
      height: 36px; padding: 0 14px; border-radius: 6px; border: none; cursor: pointer;
      background: #232830; color: #4ec9b0; font-size: 13px; font-weight: 600;
      display: flex; align-items: center; gap: 6px;
      transition: background 0.15s;
    `;
    startBtn.innerHTML = `<span style="font-size:16px;">⌂</span><span>Start</span>`;
    startBtn.addEventListener('mouseenter', () => { startBtn.style.background = '#2d343d'; });
    startBtn.addEventListener('mouseleave', () => { startBtn.style.background = '#232830'; });
    startBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleStartMenu();
    });
    tb.appendChild(startBtn);

    const sep = document.createElement('div');
    sep.style.cssText = 'width:1px;height:24px;background:#2d343d;margin:0 4px;';
    tb.appendChild(sep);

    const appsStrip = document.createElement('div');
    appsStrip.id = 'taskbar-apps';
    appsStrip.style.cssText = 'display:flex;gap:4px;flex:1;align-items:center;';
    tb.appendChild(appsStrip);

    const tray = document.createElement('div');
    tray.style.cssText = `
      display: flex; align-items: center; gap: 8px;
      padding: 0 10px; border-radius: 6px;
      background: #232830; height: 36px;
      font-size: 12px; color: #8b95a1;
    `;
    tray.innerHTML = `<span title="Connected" style="font-size:14px;">📶</span>`;
    const clock = document.createElement('span');
    clock.id = 'taskbar-clock';
    clock.style.cssText = 'font-variant-numeric: tabular-nums;';
    const updateClock = () => {
      const now = new Date();
      clock.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };
    updateClock();
    if (clockInterval) clearInterval(clockInterval);
    clockInterval = window.setInterval(updateClock, 10000);
    tray.appendChild(clock);

    const logoutBtn = document.createElement('button');
    logoutBtn.style.cssText = `
      margin-left: 4px; height: 32px; padding: 0 12px; border-radius: 4px;
      border: 1px solid #2d343d; background: transparent; color: #8b95a1;
      font-size: 12px; cursor: pointer; transition: all 0.15s;
    `;
    logoutBtn.textContent = '↩ Exit';
    logoutBtn.title = 'Close workstation and return to 3D navigation';
    logoutBtn.addEventListener('mouseenter', () => { logoutBtn.style.background = '#2d343d'; logoutBtn.style.color = '#e6e6e6'; });
    logoutBtn.addEventListener('mouseleave', () => { logoutBtn.style.background = 'transparent'; logoutBtn.style.color = '#8b95a1'; });
    logoutBtn.addEventListener('click', () => {
      const overlay = document.getElementById('desktop-overlay');
      if (overlay) overlay.style.display = 'none';
      visible = false;
    });
    tray.appendChild(logoutBtn);

    tb.appendChild(tray);
    c.appendChild(tb);

    tb.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('.taskbar-app') as HTMLElement | null;
      if (!btn || !wmCtx.current) return;
      const id = btn.dataset['win'] ?? '';
      const isMin = btn.dataset['min'] === 'true';
      if (isMin) wmCtx.current.restore(id);
      else wmCtx.current.focus(id);
    });

    buildStartMenu(c, conductor, wm);

    c.addEventListener('click', (e) => {
      const tgt = e.target as HTMLElement;
      if (!tgt.closest('#start-menu') && !tgt.closest('#taskbar-start')) {
        const sm = document.getElementById('start-menu');
        if (sm) sm.style.display = 'none';
      }
    });
  }

  function toggleStartMenu(): void {
    const sm = document.getElementById('start-menu');
    if (sm) sm.style.display = sm.style.display === 'flex' ? 'none' : 'flex';
  }

  function buildStartMenu(c: HTMLElement, conductor: Conductor, wm: WindowManager): void {
    const sm = document.createElement('div');
    sm.id = 'start-menu';
    sm.style.cssText = `
      display: none; position: absolute; bottom: 52px; left: 8px;
      width: 340px; background: rgba(27, 31, 36, 0.95);
      border: 1px solid #2d343d; border-radius: 8px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.6);
      backdrop-filter: blur(12px);
      z-index: 100; overflow: hidden;
      flex-direction: column;
    `;

    const header = document.createElement('div');
    header.style.cssText = 'padding: 16px 20px 12px; border-bottom: 1px solid #2d343d;';
    header.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:36px;height:36px;background:#4ec9b0;border-radius:8px;display:flex;align-items:center;justify-content:center;">
          <span style="font-size:20px;color:#0e1116;font-weight:bold;">A</span>
        </div>
        <div>
          <div style="font-size:14px;font-weight:600;color:#e6e6e6;">Apex Identity</div>
          <div style="font-size:11px;color:#8b95a1;">IAM Operations Workstation</div>
        </div>
      </div>
    `;
    sm.appendChild(header);

    const pinnedLabel = document.createElement('div');
    pinnedLabel.style.cssText = `
      padding: 10px 16px 6px;
      font-size: 11px; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.08em; color: #8b95a1;
    `;
    pinnedLabel.textContent = 'Pinned';
    sm.appendChild(pinnedLabel);

    const appsGrid = document.createElement('div');
    appsGrid.style.cssText = 'padding: 0 8px 8px; display: grid; grid-template-columns: 1fr 1fr; gap: 2px;';
    for (const app of DESKTOP_APPS) {
      const appBtn = document.createElement('button');
      appBtn.style.cssText = `
        display: flex; align-items: center; gap: 10px;
        padding: 10px 12px; border-radius: 6px; border: none; cursor: pointer;
        background: transparent; color: #e6e6e6; font-size: 13px; text-align: left;
        transition: background 0.15s;
      `;
      appBtn.innerHTML = `<span style="font-size:20px;">${app.icon}</span><span>${app.title}</span>`;
      appBtn.addEventListener('mouseenter', () => { appBtn.style.background = '#232830'; });
      appBtn.addEventListener('mouseleave', () => { appBtn.style.background = 'transparent'; });
      appBtn.addEventListener('click', () => {
        wm.open(app);
        const sm2 = document.getElementById('start-menu');
        if (sm2) sm2.style.display = 'none';
      });
      appsGrid.appendChild(appBtn);
    }
    sm.appendChild(appsGrid);

    const footer = document.createElement('div');
    footer.style.cssText = `
      padding: 10px 16px; border-top: 1px solid #2d343d;
      font-size: 11px; color: #8b95a1; display: flex; justify-content: space-between;
    `;
    footer.innerHTML = `<span>Apex OS 11</span><span>Northwind Holdings</span>`;
    sm.appendChild(footer);

    c.appendChild(sm);
  }

  return {
    show(conductor: Conductor) {
      if (!container) {
        container = buildContainer();
        buildDesktop(container);
        buildTaskbar(container, conductor);
        // Auto-open AI Supervisor + Objectives inside the VM
        wmCtx.current?.openById('ollama-console');
        wmCtx.current?.openById('objectives');
      } else {
        // Update the WindowManager for a fresh conductor
        wmCtx.current = new WindowManager(conductor, container);
        wmCtx.current.updateTaskbar();
        // Re-open default windows for the new conductor
        wmCtx.current?.openById('ollama-console');
        wmCtx.current?.openById('objectives');
      }
      if (container) container.style.display = 'flex';
      visible = true;
    },
    hide() {
      const overlay = document.getElementById('desktop-overlay');
      if (overlay) overlay.style.display = 'none';
      visible = false;
    },
    isVisible() { return visible; },
    openWindow(id: string, conductor: Conductor) {
      if (!visible) this.show(conductor);
      wmCtx.current?.openById(id);
    },
  };
}
