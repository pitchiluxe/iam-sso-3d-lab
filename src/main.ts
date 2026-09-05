/**
 * main.ts — entry point.
 * Phase D wiring: bootstrap engine + HUD + console panel; expose `window.__lab`
 * so the developer console can start a lab and exercise the system.
 */
import { initEngine, startLoop } from './three/engine';
import { initHUD, initNavRail, setHUDZone } from './ui/hud';
import { initConsoleUI } from './ui/consolePanel';
import { showStartScreen } from './ui/startScreen';
import { initBriefingPanel } from './ui/briefingPanel';
import { initTutorPanel } from './ui/tutorPanel';
import { initDebriefScreen } from './ui/debriefScreen';
import { blip } from './ui/audio';
import { listZones, type ZoneId, ZONE_BLUEPRINTS, IT_ZONE_IDS } from './three/zones';
import { Conductor } from './conductor/conductor';
import { findLab } from './labs/registry';
import { mkLabId } from './domain';
import { labStore, errorStore } from './stores';
import type { Lab } from './domain';
import { renderIAMConsole } from './ui/consoles/iamConsole';
import { renderTicketConsole } from './ui/consoles/ticketConsole';
import { renderSecOpsDashboard } from './ui/consoles/secOpsDashboard';
import { renderOllamaConsole } from './ui/consoles/ollamaConsole';
import { report } from './util/errors';
import { showToast } from './ui/toast';
import { isTouchDevice, TouchController } from './three/touchController';
import { createDesktopOverlay, type DesktopOverlay } from './ui/desktopOverlay';
import { initErrorLog } from './ui/errorLog';

// ---------------------------------------------------------------------------
// Overlay manager — single source of truth for which full-screen overlay is
// currently active. Used to route ESC keypresses to the correct dismiss target.
// ---------------------------------------------------------------------------
type OverlayKind = 'start' | 'console' | 'desktop';

interface OverlayManager {
  setActive(kind: OverlayKind): void;
  clearActive(kind: OverlayKind): void;
  dismissTop(): void;
}

function makeOverlayManager(
  onDismissStart: () => void,
  onDismissConsole: () => void,
  onDismissDesktop: () => void,
): OverlayManager {
  // Stack of overlays, most-recently-shown at the end. ESC always closes the top.
  const stack: OverlayKind[] = [];

  function dismissTop() {
    const top = stack[stack.length - 1];
    if (!top) return;
    switch (top) {
      case 'start':
        onDismissStart();
        break;
      case 'console':
        onDismissConsole();
        break;
      case 'desktop':
        onDismissDesktop();
        break;
    }
  }

  function setActive(kind: OverlayKind) {
    // Remove it if already present (move to top)
    const idx = stack.indexOf(kind);
    if (idx !== -1) stack.splice(idx, 1);
    stack.push(kind);
  }

  function clearActive(kind: OverlayKind) {
    const idx = stack.indexOf(kind);
    if (idx !== -1) stack.splice(idx, 1);
  }

  // Single global ESC handler — always the same, never replaced
  function escHandler(e: KeyboardEvent) {
    if (e.key === 'Escape') dismissTop();
  }
  window.addEventListener('keydown', escHandler);

  return { setActive, clearActive, dismissTop };
}

async function bootstrap() {
  console.log('[boot] Starting IAM/SSO 3D Lab…');

  // Global error listeners — surface anything that escapes the per-zone
  // and per-console boundaries.
  window.addEventListener('error', (e) => {
    const msg = e.error instanceof Error ? e.error.message : e.message;
    report('unhandled', msg, { context: { source: e.filename, line: e.lineno }, cause: e.error });
    showToast('Unexpected error. Check the console for details.', { kind: 'error' });
  });
  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason instanceof Error ? e.reason : new Error(String(e.reason));
    report('unhandled', reason.message, { cause: e.reason });
    showToast('Unexpected error. Check the console for details.', { kind: 'error' });
  });

  // Background error log — captures all errors flowing through errorStore
  // and displays them in a floating panel (Ctrl+Shift+E to toggle).
  // Also writes to localStorage so the log survives a page reload.
  initErrorLog();
  console.log('[boot] Error log initialized. Press Ctrl+Shift+E to view.');

  const appEl = document.getElementById('app')!;
  const engine = initEngine(appEl);

  // WebGL context loss is fatal — the renderer can't recover. Toast + log.
  engine.renderer.domElement.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    report('webgl-lost', 'WebGL context lost', { cause: e });
    showToast('Graphics context lost. Please refresh the page.', {
      kind: 'error',
      durationMs: 8000,
    });
  });

  // Surface non-fatal service errors as toasts (zone/console have their own
  // in-place fallbacks, but service errors don't have a host UI).
  let lastShownTimestamp = 0;
  errorStore.subscribe((s) => {
    const e = s.lastError;
    if (!e) return;
    if (e.timestamp === lastShownTimestamp) return;
    lastShownTimestamp = e.timestamp;
    if (e.kind === 'zone-build-failed' || e.kind === 'webgl-lost') return;
    showToast(e.message, { kind: e.kind === 'console-render-failed' ? 'warn' : 'error' });
  });

  // ── Create overlay services early so their dismiss hooks can be wired ───────
  const consoleUI = initConsoleUI();
  const desktop: DesktopOverlay = createDesktopOverlay();

  // ── Overlay manager — single ESC key handler, routes to the topmost overlay ─
  const overlayMgr = makeOverlayManager(
    /* onDismissStart   */ () => {
      /* handled by startScreen.ts dismiss() */
    },
    /* onDismissConsole */ () => {
      consoleUI.close();
    },
    /* onDismissDesktop */ () => {
      desktop.hide();
    },
  );

  // ── Helper: open the lab-selection menu ────────────────────────────────────
  const openStartScreen = () => {
    consoleUI.close();
    desktop.hide();
    overlayMgr.clearActive('console');
    overlayMgr.clearActive('desktop');
    overlayMgr.setActive('start');
    showStartScreen(
      (labId) => {
        overlayMgr.clearActive('start');
        (window as unknown as { __lab: { start(id: string): void } }).__lab.start(labId);
      },
      () => overlayMgr.clearActive('start'),
    );
  };

  // ── HUD + Nav rail ────────────────────────────────────────────────────────
  initHUD(() => openStartScreen());
  setHUDZone(engine.sceneMgr.getCurrentZoneId()!, ZONE_BLUEPRINTS['iam-ops'].displayName);
  initNavRail(listZones(), (zoneId: ZoneId) => {
    engine.enterZone(zoneId);
    setHUDZone(zoneId, ZONE_BLUEPRINTS[zoneId].displayName);
  });

  // ── Panels ────────────────────────────────────────────────────────────────
  initBriefingPanel();
  initTutorPanel();
  initDebriefScreen();

  // ── Pointer-lock hint ─────────────────────────────────────────────────────
  const hint = document.getElementById('pointer-lock-hint')!;
  let lockTimer: number | null = null;
  const showHint = () => {
    hint.style.display = 'block';
    if (lockTimer) clearTimeout(lockTimer);
    lockTimer = window.setTimeout(() => {
      hint.style.display = 'none';
    }, 4000);
  };

  // ── Engine ────────────────────────────────────────────────────────────────
  const stopLoop = startLoop(engine);
  const conductor = new Conductor();

  // Wire console interactions
  engine.onConsolePrompt = (c) => {
    consoleUI.setPrompt(c ? c.prompt : null);
  };
  engine.onWorkstationPrompt = (show) => {
    consoleUI.setPrompt(show ? 'Open VM (E)' : null);
  };
  engine.onConsoleActivate = (c) => {
    consoleUI.open(c.id, c.title);
    overlayMgr.setActive('console');
    const body = consoleUI.overlayEl.querySelector('#console-overlay-body') as HTMLElement;
    switch (c.id) {
      case 'iam-console':
        renderIAMConsole(body, conductor);
        break;
      case 'ticket-console':
        renderTicketConsole(body, conductor);
        break;
      case 'secops-dashboard':
        renderSecOpsDashboard(body, conductor);
        break;
      case 'ollama-console':
        renderOllamaConsole(body, conductor);
        break;
      default:
        body.innerHTML = `<div style="color:var(--muted);font-size:13px;padding:20px;">
          <p>Console "${c.title}" is not yet implemented.</p>
          <p>Available consoles: IAM Console, Ticket Console, SecOps Dashboard, AI Supervisor</p>
        </div>`;
    }
  };
  engine.onWorkstationActivate = () => {
    if (document.pointerLockElement) document.exitPointerLock();
    const zoneId = engine.sceneMgr.getCurrentZoneId();
    const isIT = zoneId !== null && IT_ZONE_IDS.has(zoneId);
    desktop.show(conductor, isIT);
    overlayMgr.setActive('desktop');
    blip(800, 80, 0.05);
  };

  // ── Touch / pointer-lock mode ──────────────────────────────────────────────
  if (isTouchDevice()) {
    new TouchController(engine.player, openStartScreen);
    document.body.classList.add('touch-mode');
  } else {
    showHint();
    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === engine.renderer.domElement;
      hint.style.display = locked ? 'none' : 'block';
    });
  }

  // ── Lab step index subscriber ─────────────────────────────────────────────
  (window as unknown as { __labState: { stepIndex: number } }).__labState = { stepIndex: 0 };
  let lastStepIndex = -1;
  let lastLabId: string | null = null;
  labStore.subscribe(() => {
    const s = labStore.getState();
    (window as unknown as { __labState: { stepIndex: number } }).__labState = {
      stepIndex: s.stepIndex,
    };
    if (lastLabId === s.current?.id && s.stepIndex !== lastStepIndex && lastStepIndex !== -1) {
      blip(660, 60, 0.04);
    }
    lastLabId = s.current?.id ?? null;
    lastStepIndex = s.stepIndex;
  });

  // ── window.__lab ──────────────────────────────────────────────────────────
  (
    window as unknown as {
      __lab: {
        start(id: string): void;
        list(): string[];
        get(): Lab | null;
        conductor: Conductor;
        engine: typeof engine;
        stopRenderLoop(): void;
        desktop: DesktopOverlay;
        showWorkstation(): void;
      };
    }
  ).__lab = {
    stopRenderLoop: stopLoop,
    start(id: string) {
      const lab = findLab(id) ?? findLab(mkLabId('lab01'))!;
      conductor.start(lab.id);
      engine.enterZone(lab.startingZone as ZoneId);
      setHUDZone(
        lab.startingZone as ZoneId,
        ZONE_BLUEPRINTS[lab.startingZone as ZoneId].displayName,
      );
    },
    list() {
      return [
        'lab01',
        'lab02',
        'lab03',
        'lab04',
        'lab05',
        'lab06',
        'lab07',
        'lab08',
        'lab09',
        'lab10',
        'lab11',
        'lab12',
        'lab13',
      ];
    },
    get() {
      return conductor.currentLab;
    },
    conductor,
    engine,
    desktop,
    showWorkstation() {
      desktop.show(conductor);
    },
  };

  // Always show the start screen on launch — the menu is the app's home page,
  // not the 3D workspace. The learner can resume an in-flight lab from the
  // start screen (the lab appears in the "Daily IT Support Tickets" section
  // and as a known entry; for core labs the start screen is the entry point
  // for every session, even when persisted resume data is present).
  openStartScreen();

  console.log('[boot] Engine ready. 60 FPS target.');
}

bootstrap().catch((err) => {
  console.error('[boot] Fatal:', err);
  document.body.insertAdjacentHTML(
    'beforeend',
    `<div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#0e1116;color:#f48771;font-family:monospace;font-size:16px;">
      Fatal: ${String(err)}
    </div>`,
  );
});
