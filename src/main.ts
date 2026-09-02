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
import { listZones, type ZoneId, ZONE_BLUEPRINTS } from './three/zones';
import { Conductor } from './conductor/conductor';
import { findLab } from './labs/registry';
import { mkLabId } from './domain';
import { labStore } from './stores';
import type { Lab } from './domain';
import { renderIAMConsole } from './ui/consoles/iamConsole';
import { renderTicketConsole } from './ui/consoles/ticketConsole';
import { renderSecOpsDashboard } from './ui/consoles/secOpsDashboard';

async function bootstrap() {
  console.log('[boot] Starting IAM/SSO 3D Lab…');

  const appEl = document.getElementById('app')!;
  const engine = initEngine(appEl);

  // HUD
  initHUD(() => showStartScreen((id) => {
    (window as unknown as { __lab: { start(id: string): void } }).__lab.start(id);
  }));
  setHUDZone(engine.sceneMgr.getCurrentZoneId()!, ZONE_BLUEPRINTS['iam-ops'].displayName);

  // Zone nav rail at the bottom of the screen
  initNavRail(listZones(), (zoneId: ZoneId) => {
    engine.enterZone(zoneId);
    setHUDZone(zoneId, ZONE_BLUEPRINTS[zoneId].displayName);
  });

  // Console overlay
  const consoleUI = initConsoleUI();

  // Briefing panel (left side)
  initBriefingPanel();

  // Tutor panel (bottom right)
  initTutorPanel();

  // Debrief screen (shown when lab completes)
  initDebriefScreen();
  engine.onConsolePrompt = (c) => {
    consoleUI.setPrompt(c ? c.prompt : null);
  };
  engine.onConsoleActivate = (c) => {
    consoleUI.open(c.id, c.title);
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
      default:
        body.innerHTML = `<div style="color:var(--muted);font-size:13px;padding:20px;">
          <p>Console "${c.title}" is not yet implemented.</p>
          <p>Available consoles: IAM Console, Ticket Console, SecOps Dashboard</p>
        </div>`;
    }
  };

  // Pointer-lock hint
  const hint = document.getElementById('pointer-lock-hint')!;
  let lockTimer: number | null = null;
  const showHint = () => {
    hint.style.display = 'block';
    if (lockTimer) clearTimeout(lockTimer);
    lockTimer = window.setTimeout(() => { hint.style.display = 'none'; }, 4000);
  };
  showHint();
  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === engine.renderer.domElement;
    hint.style.display = locked ? 'none' : 'block';
  });

  // Render loop
  startLoop(engine);

  // Conductor + global dev hook so a lab can be started from the console:
  //   window.__lab.start('lab01')
  const conductor = new Conductor();

  // Expose the lab step index so consoles can bind evidence to the right step.
  (window as unknown as { __labState: { stepIndex: number } }).__labState = { stepIndex: 0 };
  let lastStepIndex = -1;
  let lastLabId: string | null = null;
  labStore.subscribe(() => {
    const s = labStore.getState();
    (window as unknown as { __labState: { stepIndex: number } }).__labState = {
      stepIndex: s.stepIndex,
    };
    // Soft "step done" cue when the step advances, but not on initial load or lab switch.
    if (lastLabId === s.current?.id && s.stepIndex !== lastStepIndex && lastStepIndex !== -1) {
      blip(660, 60, 0.04);
    }
    lastLabId = s.current?.id ?? null;
    lastStepIndex = s.stepIndex;
  });

  (window as unknown as { __lab: { start(id: string): void; list(): string[]; get(): Lab | null; conductor: Conductor; engine: typeof engine } }).__lab = {
    start(id: string) {
      const lab = findLab(id) ?? findLab(mkLabId('lab01'))!;
      conductor.start(lab.id);
      engine.enterZone(lab.startingZone as ZoneId);
      setHUDZone(lab.startingZone as ZoneId, ZONE_BLUEPRINTS[lab.startingZone as ZoneId].displayName);
    },
    list() {
      return ['lab01','lab02','lab03','lab04','lab05','lab06','lab07','lab08','lab09','lab10'];
    },
    get() { return conductor.currentLab; },
    conductor,
    engine,
  };

  // Show the start screen — learner picks a lab to begin
  showStartScreen((labId) => {
    (window as unknown as { __lab: { start(id: string): void } }).__lab.start(labId);
  });

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
