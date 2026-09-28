/**
 * ui/machines/machineWindow.ts — DC01 and CLIENT01, opened inside the main VM.
 *
 * Double-clicking DC01 or CLIENT01 on the main VM's desktop opens the machine
 * the way IAM Range's Remote Desktop opens a workstation: a Remote Desktop
 * Connection screen, the machine's own Windows sign-in, then its desktop, with
 * icons, a taskbar with Start and a clock, and windows you can drag, minimise,
 * maximise and close. Everything the machine's apps do runs through the AD Lab
 * engine on the shared lab world, so the AD Enterprise Lab and the IAM
 * Portfolio grade exactly what was done here.
 *
 * DC01 looks like Windows Server 2022, CLIENT01 like Windows 11, so the two
 * sessions are never confused with each other or with the main VM.
 */
import type { HostName } from '@/vm/adlab/state';
import {
  loadWorld,
  notifyWorldChanged,
  onWorldChanged,
  saveWorld,
  type LabWorld,
} from '@/vm/adlab/world';
import type { CommandResult } from '@/vm/adlab/commands';
import { LAB_ADMIN_PASSWORD, MACHINE_INFO, runOnMachine, signIn } from './machineCore';

export interface MachineContext {
  host: HostName;
  /** The current world (re-read each time: a reset replaces it). */
  world(): LabWorld;
  /** Run a command on this machine. A restart signs the session out, as it would. */
  run(line: string): CommandResult;
  /** Open another app on this machine's desktop. */
  open(appId: string): void;
  /** Called when the world changes, until the app's window closes. */
  onChange(fn: () => void): void;
  /** The account signed in, e.g. CORP\Administrator. */
  account(): string;
}

export interface MachineApp {
  id: string;
  title: string;
  /** Short glyph or emoji for the desktop, Start and taskbar. */
  icon: string;
  width: number;
  height: number;
  /** Shown on the desktop (all apps are in Start). */
  desktop?: boolean;
  render(body: HTMLElement, ctx: MachineContext): void;
}

interface Theme {
  wallpaper: string;
  taskbar: string;
  taskbarFg: string;
  window: string;
  windowFg: string;
  titlebar: string;
  accent: string;
  startLabel: string;
  signinBg: string;
  centeredTaskbar: boolean;
}

const THEMES: Record<HostName, Theme> = {
  // Windows Server 2022: the dark-blue desktop, a left-aligned taskbar.
  DC01: {
    wallpaper: 'radial-gradient(ellipse at 70% 30%, #1b6ac9 0%, #0b3d7a 45%, #061c3d 100%)',
    taskbar: '#101820',
    taskbarFg: '#e8eef5',
    window: '#ffffff',
    windowFg: '#1b1b1b',
    titlebar: '#f0f0f0',
    accent: '#0063b1',
    startLabel: '⊞',
    signinBg: 'linear-gradient(160deg,#0a3a78,#04203f)',
    centeredTaskbar: false,
  },
  // Windows 11: the light bloom and a centred taskbar.
  CLIENT01: {
    wallpaper:
      'radial-gradient(circle at 60% 55%, #9cc6ff 0%, #5f96e8 30%, #3a6fd0 55%, #cfe0fb 100%)',
    taskbar: 'rgba(243,243,243,0.92)',
    taskbarFg: '#1b1b1b',
    window: '#ffffff',
    windowFg: '#1b1b1b',
    titlebar: '#f3f3f3',
    accent: '#005fb8',
    startLabel: '⊞',
    signinBg: 'linear-gradient(160deg,#3a6fd0,#9cc6ff)',
    centeredTaskbar: true,
  },
};

type Screen = 'connect' | 'signin' | 'restarting' | 'desktop';

/**
 * Render a machine session into `body` (the main VM window's body).
 * `apps` is the machine's software; `defaultApps` open after signing in.
 */
export function renderMachineWindow(
  body: HTMLElement,
  host: HostName,
  apps: MachineApp[],
  defaultApps: string[] = [],
): void {
  const theme = THEMES[host];
  const info = MACHINE_INFO[host];
  body.innerHTML = '';
  Object.assign(body.style, {
    overflow: 'hidden',
    flex: '1',
    minHeight: '0',
    background: '#000',
    position: 'relative',
  });

  let world = loadWorld();
  let screen: Screen = world.signedIn[host] ? 'desktop' : 'connect';
  let account = world.signedIn[host] ? (host === 'DC01' ? 'Administrator' : 'Administrator') : '';
  let error = '';
  const cleanups: (() => void)[] = [];

  const root = document.createElement('div');
  root.style.cssText =
    "position:absolute;inset:0;display:flex;flex-direction:column;font-family:'Segoe UI',-apple-system,sans-serif;font-size:12px;";
  body.appendChild(root);

  // Stay in step with the world: a reset elsewhere (Start over) signs out.
  const offWorld = onWorldChanged(() => {
    if (!root.isConnected) {
      offWorld();
      return;
    }
    const fresh = loadWorld();
    const wasSignedIn = world.signedIn[host];
    world = fresh;
    if (wasSignedIn && !fresh.signedIn[host] && screen === 'desktop') {
      screen = 'signin';
      render();
    }
  });

  const setSignedIn = (on: boolean): void => {
    world = loadWorld();
    world.signedIn[host] = on;
    saveWorld(world);
  };

  const ctxFor = (owner?: HTMLElement): MachineContext => ({
    host,
    world: () => loadWorld(),
    run(line) {
      const w = loadWorld();
      const r = runOnMachine(w, host, line);
      world = w;
      if (r.restarted) {
        setTimeout(() => restart(), 400);
      }
      return r;
    },
    open: (id) => openApp(id),
    onChange(fn) {
      // Ends when the app's window closes (or the session is redrawn).
      const off = onWorldChanged(() => {
        if (owner && !owner.isConnected) {
          off();
          return;
        }
        fn();
      });
      cleanups.push(off);
    },
    account: () => account,
  });

  function restart(): void {
    setSignedIn(false);
    screen = 'restarting';
    render();
    setTimeout(() => {
      if (!root.isConnected) return;
      screen = 'signin';
      error = '';
      render();
    }, 2200);
  }

  function el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    css = '',
    text?: string,
  ): HTMLElementTagNameMap[K] {
    const e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function render(): void {
    for (const c of cleanups.splice(0)) c();
    root.innerHTML = '';
    if (screen === 'connect') renderConnect();
    else if (screen === 'signin') renderSignIn();
    else if (screen === 'restarting') renderRestarting();
    else renderDesktop();
  }

  // ── Remote Desktop Connection ────────────────────────────────────────────
  function renderConnect(): void {
    const wrap = el(
      'div',
      'flex:1;display:flex;align-items:center;justify-content:center;background:#e9eef4;color:#1b1b1b;',
    );
    const box = el(
      'div',
      'width:420px;background:#fff;border:1px solid #b9c3cf;border-radius:6px;box-shadow:0 8px 30px rgba(0,0,0,.25);overflow:hidden;',
    );
    const head = el(
      'div',
      'display:flex;align-items:center;gap:10px;padding:14px 16px;background:linear-gradient(180deg,#ffffff,#eef2f7);border-bottom:1px solid #d6dde6;',
    );
    head.append(el('div', 'font-size:26px;', '🖥️'));
    const ht = el('div');
    ht.append(
      el('div', 'font-size:12px;color:#5b6570;', 'Remote Desktop'),
      el('div', 'font-size:17px;font-weight:600;', 'Connection'),
    );
    head.append(ht);
    const form = el(
      'div',
      'padding:16px;display:grid;grid-template-columns:90px 1fr;gap:10px;align-items:center;',
    );
    const computer = el(
      'input',
      'padding:5px 7px;border:1px solid #9aa6b2;border-radius:3px;font:inherit;',
    );
    computer.value = host === 'DC01' ? 'DC01 (172.16.0.1)' : 'CLIENT01';
    computer.readOnly = true;
    const user = el(
      'input',
      'padding:5px 7px;border:1px solid #9aa6b2;border-radius:3px;font:inherit;',
    );
    user.value = 'Administrator';
    form.append(el('label', '', 'Computer:'), computer, el('label', '', 'User name:'), user);
    const note = el(
      'div',
      'grid-column:1 / span 2;font-size:11.5px;color:#5b6570;line-height:1.5;background:#f4f7fb;border:1px solid #dde4ec;border-radius:4px;padding:8px;',
    );
    note.textContent =
      `${info.title} — ${info.os}. This is a simulated lab machine inside the app. ` +
      `Lab Administrator password: ${LAB_ADMIN_PASSWORD} (fictional, for these lab machines only).`;
    form.append(note);
    const foot = el(
      'div',
      'display:flex;justify-content:flex-end;gap:8px;padding:10px 16px;border-top:1px solid #e1e6ec;background:#fafbfc;',
    );
    const connect = el(
      'button',
      `padding:6px 22px;background:${theme.accent};color:#fff;border:none;border-radius:3px;font:inherit;cursor:pointer;`,
      'Connect',
    );
    connect.addEventListener('click', () => {
      account = user.value.trim() || 'Administrator';
      screen = 'signin';
      error = '';
      render();
    });
    foot.append(connect);
    box.append(head, form, foot);
    wrap.append(box);
    root.append(wrap);
    connect.focus();
  }

  // ── Windows sign-in ──────────────────────────────────────────────────────
  function renderSignIn(): void {
    const wrap = el(
      'div',
      `flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:${theme.signinBg};color:#fff;`,
    );
    const avatar = el(
      'div',
      'width:96px;height:96px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:44px;',
    );
    avatar.textContent = '👤';
    const user = el(
      'input',
      'width:240px;padding:7px 9px;border:1px solid rgba(255,255,255,.6);border-radius:4px;background:rgba(255,255,255,.95);color:#1b1b1b;font:inherit;',
    );
    user.value = account || 'Administrator';
    user.setAttribute('aria-label', 'User name');
    const pw = el(
      'input',
      'width:240px;padding:7px 9px;border:1px solid rgba(255,255,255,.6);border-radius:4px;background:rgba(255,255,255,.95);color:#1b1b1b;font:inherit;',
    );
    pw.type = 'password';
    pw.placeholder = 'Password';
    pw.setAttribute('aria-label', 'Password');
    const err = el(
      'div',
      'min-height:18px;font-size:12px;color:#ffd6d6;max-width:340px;text-align:center;',
      error,
    );
    const hint = el(
      'div',
      'font-size:11px;opacity:.85;max-width:360px;text-align:center;line-height:1.5;',
    );
    hint.textContent =
      host === 'DC01'
        ? 'Sign in as Administrator (CORP\\Administrator once DC01 is a domain controller).'
        : 'Sign in as Administrator, or as a domain user (CORP\\name) once CLIENT01 has joined the domain.';
    const go = el(
      'button',
      'padding:7px 26px;border:none;border-radius:4px;background:rgba(255,255,255,.95);color:#1b1b1b;font:inherit;cursor:pointer;',
      'Sign in',
    );
    const attempt = (): void => {
      // Sign-ins are audited on DC01 (4624/4625) and count towards lockout: keep that.
      const w = loadWorld();
      const r = signIn(w.state, host, user.value, pw.value);
      notifyWorldChanged(w);
      if (!r.ok) {
        error = r.reason;
        err.textContent = error;
        pw.value = '';
        pw.focus();
        return;
      }
      account = r.account;
      error = '';
      setSignedIn(true);
      screen = 'desktop';
      render();
      for (const id of defaultApps) openApp(id);
    };
    go.addEventListener('click', attempt);
    pw.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') attempt();
    });
    wrap.append(
      avatar,
      el(
        'div',
        'font-size:22px;font-weight:300;',
        host === 'DC01' ? 'Administrator' : 'Other user',
      ),
      el('div', 'font-size:12px;opacity:.85;', info.title),
      user,
      pw,
      go,
      err,
      hint,
    );
    root.append(wrap);
    pw.focus();
  }

  function renderRestarting(): void {
    const wrap = el(
      'div',
      `flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;background:${theme.signinBg};color:#fff;`,
    );
    const spinner = el(
      'div',
      'width:34px;height:34px;border-radius:50%;border:3px solid rgba(255,255,255,.25);border-top-color:#fff;animation:mw-spin 1s linear infinite;',
    );
    if (!document.getElementById('mw-spin-style')) {
      const st = document.createElement('style');
      st.id = 'mw-spin-style';
      st.textContent = '@keyframes mw-spin{to{transform:rotate(360deg)}}';
      document.head.appendChild(st);
    }
    wrap.append(spinner, el('div', 'font-size:18px;font-weight:300;', 'Restarting'));
    root.append(wrap);
  }

  // ── The desktop ──────────────────────────────────────────────────────────
  let desk: HTMLElement | null = null;
  let taskButtons: HTMLElement | null = null;
  const open = new Map<string, { win: HTMLElement; btn: HTMLElement; minimized: boolean }>();
  let z = 10;

  function renderDesktop(): void {
    open.clear();
    desk = el(
      'div',
      `position:relative;flex:1;min-height:0;background:${theme.wallpaper};overflow:hidden;`,
    );
    desk.dataset.mwDesk = '';
    const icons = el(
      'div',
      'position:absolute;left:10px;top:10px;display:grid;grid-auto-flow:column;grid-template-rows:repeat(6,76px);gap:6px 8px;',
    );
    for (const app of apps.filter((a) => a.desktop !== false)) {
      const ic = el(
        'div',
        'width:76px;display:flex;flex-direction:column;align-items:center;gap:4px;padding:4px;border-radius:3px;cursor:default;color:#fff;text-align:center;',
      );
      ic.title = `Open ${app.title} (double-click)`;
      ic.append(
        el(
          'div',
          'font-size:30px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,.5));',
          app.icon,
        ),
        el(
          'div',
          'font-size:11px;text-shadow:0 1px 3px rgba(0,0,0,.8);line-height:1.2;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word;',
          app.title,
        ),
      );
      ic.addEventListener('mouseenter', () => (ic.style.background = 'rgba(255,255,255,.18)'));
      ic.addEventListener('mouseleave', () => (ic.style.background = 'transparent'));
      ic.addEventListener('dblclick', () => openApp(app.id));
      icons.append(ic);
    }
    desk.append(icons);

    const bar = el(
      'div',
      `height:40px;flex-shrink:0;display:flex;align-items:center;gap:4px;padding:0 8px;background:${theme.taskbar};color:${theme.taskbarFg};` +
        (theme.centeredTaskbar ? 'justify-content:center;border-top:1px solid #d9d9d9;' : ''),
    );
    const start = el(
      'button',
      `height:32px;min-width:40px;border:none;border-radius:4px;background:transparent;color:${theme.accent === '#0063b1' ? '#5ab4ff' : theme.accent};font-size:20px;cursor:pointer;`,
      theme.startLabel,
    );
    start.title = 'Start';
    start.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleStart();
    });
    taskButtons = el('div', 'display:flex;gap:3px;');
    const clock = el(
      'div',
      `margin-left:${theme.centeredTaskbar ? '0' : 'auto'};font-size:11px;text-align:right;padding:0 6px;color:${theme.taskbarFg};line-height:1.3;`,
    );
    const tick = (): void => {
      const d = new Date();
      clock.textContent = `${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}\n${d.toLocaleDateString()}`;
      clock.style.whiteSpace = 'pre';
    };
    tick();
    const timer = setInterval(() => (root.isConnected ? tick() : clearInterval(timer)), 30_000);
    cleanups.push(() => clearInterval(timer));
    bar.append(start, taskButtons);
    if (theme.centeredTaskbar) {
      const spacer = el('div', 'position:absolute;right:8px;');
      spacer.append(clock);
      bar.style.position = 'relative';
      bar.append(spacer);
    } else bar.append(clock);
    root.append(desk, bar);
  }

  function toggleStart(): void {
    if (!desk) return;
    const existing = desk.querySelector('.mw-start');
    if (existing) {
      existing.remove();
      return;
    }
    const menu = el(
      'div',
      `position:absolute;${theme.centeredTaskbar ? 'left:50%;transform:translateX(-50%);' : 'left:6px;'}bottom:6px;width:300px;max-height:80%;overflow:auto;` +
        'background:rgba(250,250,250,.98);color:#1b1b1b;border:1px solid #cfcfcf;border-radius:8px;box-shadow:0 10px 30px rgba(0,0,0,.35);z-index:100000;padding:10px;',
    );
    menu.className = 'mw-start';
    menu.append(
      el(
        'div',
        'font-size:11px;font-weight:600;color:#666;margin:2px 4px 8px;',
        `${info.title} — ${account}`,
      ),
    );
    for (const app of apps) {
      const row = el(
        'div',
        'display:flex;align-items:center;gap:10px;padding:7px 8px;border-radius:4px;cursor:pointer;',
      );
      row.append(
        el('span', 'font-size:18px;width:22px;text-align:center;', app.icon),
        el('span', '', app.title),
      );
      row.addEventListener('mouseenter', () => (row.style.background = '#e8eef7'));
      row.addEventListener('mouseleave', () => (row.style.background = 'transparent'));
      row.addEventListener('click', () => {
        menu.remove();
        openApp(app.id);
      });
      menu.append(row);
    }
    const sep = el('div', 'height:1px;background:#e0e0e0;margin:8px 0;');
    const signOut = el(
      'div',
      'display:flex;align-items:center;gap:10px;padding:7px 8px;border-radius:4px;cursor:pointer;',
    );
    signOut.append(
      el('span', 'font-size:16px;width:22px;text-align:center;', '⏻'),
      el('span', '', 'Sign out'),
    );
    signOut.addEventListener('mouseenter', () => (signOut.style.background = '#e8eef7'));
    signOut.addEventListener('mouseleave', () => (signOut.style.background = 'transparent'));
    signOut.addEventListener('click', () => {
      setSignedIn(false);
      screen = 'signin';
      render();
    });
    const restartRow = el(
      'div',
      'display:flex;align-items:center;gap:10px;padding:7px 8px;border-radius:4px;cursor:pointer;',
    );
    restartRow.append(
      el('span', 'font-size:16px;width:22px;text-align:center;', '↻'),
      el('span', '', 'Restart'),
    );
    restartRow.addEventListener('mouseenter', () => (restartRow.style.background = '#e8eef7'));
    restartRow.addEventListener('mouseleave', () => (restartRow.style.background = 'transparent'));
    restartRow.addEventListener('click', () => {
      menu.remove();
      ctxFor().run('Restart-Computer');
    });
    menu.append(sep, restartRow, signOut);
    desk.append(menu);
    const close = (e: MouseEvent): void => {
      if (!menu.contains(e.target as Node)) {
        menu.remove();
        document.removeEventListener('mousedown', close);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', close), 0);
  }

  function focus(win: HTMLElement): void {
    win.style.zIndex = String(++z);
  }

  function openApp(id: string): void {
    if (!desk || !taskButtons) return;
    const app = apps.find((a) => a.id === id);
    if (!app) return;
    const existing = open.get(id);
    if (existing) {
      existing.win.style.display = 'flex';
      existing.minimized = false;
      focus(existing.win);
      return;
    }
    const n = open.size;
    const dw = desk.clientWidth || 900;
    const dh = desk.clientHeight || 560;
    const w = Math.min(app.width, dw - 20);
    const h = Math.min(app.height, dh - 20);
    const win = el(
      'div',
      `position:absolute;left:${Math.max(6, Math.min(dw - w - 6, 60 + n * 26))}px;top:${Math.max(6, Math.min(dh - h - 6, 30 + n * 22))}px;` +
        `width:${w}px;height:${h}px;display:flex;flex-direction:column;background:${theme.window};color:${theme.windowFg};` +
        'border:1px solid #9aa4ae;border-radius:6px;box-shadow:0 10px 30px rgba(0,0,0,.35);overflow:hidden;',
    );
    const title = el(
      'div',
      `height:30px;flex-shrink:0;display:flex;align-items:center;gap:8px;padding:0 0 0 10px;background:${theme.titlebar};border-bottom:1px solid #dcdcdc;user-select:none;`,
    );
    title.append(
      el('span', 'font-size:14px;', app.icon),
      el('span', 'flex:1;font-size:12px;', app.title),
    );
    const ctl = (label: string, hover: string, onClick: () => void): HTMLElement => {
      const b = el(
        'div',
        'width:40px;height:30px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:13px;',
        label,
      );
      b.addEventListener('mouseenter', () => (b.style.background = hover));
      b.addEventListener('mouseleave', () => (b.style.background = 'transparent'));
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        onClick();
      });
      return b;
    };
    let pre: { left: string; top: string; width: string; height: string } | null = null;
    const toggleMax = (): void => {
      if (pre) {
        Object.assign(win.style, pre);
        pre = null;
      } else {
        pre = {
          left: win.style.left,
          top: win.style.top,
          width: win.style.width,
          height: win.style.height,
        };
        Object.assign(win.style, { left: '0px', top: '0px', width: '100%', height: '100%' });
      }
    };
    title.append(
      ctl('—', 'rgba(0,0,0,.08)', () => {
        win.style.display = 'none';
        const o = open.get(id);
        if (o) o.minimized = true;
      }),
      ctl('▢', 'rgba(0,0,0,.08)', toggleMax),
      ctl('✕', '#e81123', () => closeApp(id)),
    );
    title.addEventListener('dblclick', toggleMax);
    // Drag by the title bar, kept inside the machine's desktop.
    title.addEventListener('mousedown', (e) => {
      if ((e.target as HTMLElement).closest('div[style*="width:40px"]') || pre) return;
      focus(win);
      const sx = e.clientX - win.offsetLeft;
      const sy = e.clientY - win.offsetTop;
      const move = (ev: MouseEvent): void => {
        const maxX = (desk?.clientWidth ?? 900) - 60;
        const maxY = (desk?.clientHeight ?? 560) - 30;
        win.style.left = `${Math.max(-w + 80, Math.min(maxX, ev.clientX - sx))}px`;
        win.style.top = `${Math.max(0, Math.min(maxY, ev.clientY - sy))}px`;
      };
      const up = (): void => {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
      };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    });
    win.addEventListener('mousedown', () => focus(win));
    const content = el(
      'div',
      'flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden;',
    );
    win.append(title, content);
    desk.append(win);
    focus(win);

    const btn = el(
      'button',
      `height:32px;display:flex;align-items:center;gap:6px;padding:0 10px;border:none;border-radius:4px;background:rgba(127,127,127,.18);color:${theme.taskbarFg};font:inherit;cursor:pointer;`,
    );
    btn.append(
      el('span', 'font-size:15px;', app.icon),
      el(
        'span',
        'font-size:11px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;',
        app.title,
      ),
    );
    btn.addEventListener('click', () => {
      const o = open.get(id);
      if (!o) return;
      if (o.minimized || o.win.style.display === 'none') {
        o.win.style.display = 'flex';
        o.minimized = false;
        focus(o.win);
      } else if (Number(o.win.style.zIndex) === z) {
        o.win.style.display = 'none';
        o.minimized = true;
      } else focus(o.win);
    });
    taskButtons.append(btn);
    open.set(id, { win, btn, minimized: false });
    try {
      app.render(content, ctxFor(content));
    } catch (e) {
      content.textContent = `${app.title} could not start: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  function closeApp(id: string): void {
    const o = open.get(id);
    if (!o) return;
    o.win.remove();
    o.btn.remove();
    open.delete(id);
  }

  render();
  if (screen === 'desktop') for (const id of defaultApps) openApp(id);
}
