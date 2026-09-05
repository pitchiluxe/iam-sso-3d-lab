/**
 * hud.ts — HUD pill updates, wired to the lab store.
 * Also renders the nav rail at the bottom of the screen for zone switching.
 */
import { labStore } from '@/stores';
import { scoreStore } from '@/stores';
import { type ZoneId } from '@/three/zones';

function formatTimer(ms: number): string {
  const totalSec = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0)
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

let scorePopup: HTMLDivElement | null = null;
let timerInterval: ReturnType<typeof setInterval> | null = null;

function showScoreBreakdown(): void {
  if (scorePopup) {
    scorePopup.remove();
    scorePopup = null;
    return;
  }
  const s = scoreStore.getState().current;
  const lab = labStore.getState().current;
  if (!s) return;

  const popup = document.createElement('div');
  popup.id = 'score-breakdown-popup';
  popup.style.cssText = `
    position:fixed;top:50px;right:16px;z-index:50;
    background:#1b1f24;border:1px solid #2d343d;border-radius:8px;
    padding:16px;min-width:260px;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    box-shadow:0 8px 24px rgba(0,0,0,0.5);
  `;
  const categories: Array<[string, number, number]> = [
    ['Technical Execution', s.exec, 25],
    ['Troubleshooting', s.troubleshoot, 20],
    ['Least Privilege', s['least-privilege'], 15],
    ['Documentation', s.docs, 15],
    ['Evidence & Verification', s.evidence, 15],
    ['Communication', s.comms, 10],
  ];
  popup.innerHTML = `
    <div style="font-size:11px;color:#8b95a1;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:10px;">
      Score Breakdown — ${lab?.title ?? 'Lab'}
    </div>
    ${categories
      .map(
        ([label, earned, max]) => `
      <div style="margin-bottom:8px;">
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;">
          <span style="color:#c8cdd3;">${label}</span>
          <span style="color:#4ec9b0;font-weight:600;">${earned}<span style="color:#8b95a1;">/${max}</span></span>
        </div>
        <div style="height:4px;background:#2d343d;border-radius:2px;overflow:hidden;">
          <div style="height:4px;width:${Math.round((earned / max) * 100)}%;background:#4ec9b0;border-radius:2px;"></div>
        </div>
      </div>
    `,
      )
      .join('')}
    <div style="border-top:1px solid #2d343d;margin-top:10px;padding-top:10px;display:flex;justify-content:space-between;align-items:center;">
      <span style="color:#e6e6e6;font-weight:700;font-size:16px;">Total</span>
      <span style="color:#4ec9b0;font-weight:700;font-size:20px;">${s.total} / 100</span>
    </div>
    ${s.notes.length > 0 ? `<div style="margin-top:10px;font-size:11px;color:#8b95a1;">Notes: ${s.notes.slice(0, 3).join(' · ')}</div>` : ''}
  `;
  document.body.appendChild(popup);
  scorePopup = popup;

  // Dismiss on click outside
  const dismiss = (e: MouseEvent) => {
    if (!popup.contains(e.target as Node) && (e.target as HTMLElement).id !== 'hud-score-pill') {
      popup.remove();
      scorePopup = null;
      document.removeEventListener('click', dismiss);
    }
  };
  setTimeout(() => document.addEventListener('click', dismiss), 0);
}

export function initHUD(onMenuClick?: () => void) {
  const labEl = document.getElementById('hud-lab')!;
  const stepEl = document.getElementById('hud-step')!;
  const scoreEl = document.getElementById('hud-score')!;
  const timerEl = document.getElementById('hud-timer')!;
  const scorePill = document.getElementById('hud-score-pill')!;
  const menuBtn = document.getElementById('hud-menu');

  if (menuBtn && onMenuClick) {
    menuBtn.addEventListener('click', onMenuClick);
  }

  // Score breakdown popup
  scorePill.addEventListener('click', showScoreBreakdown);

  function sync() {
    const lab = labStore.getState().current;
    const idx = labStore.getState().stepIndex;
    const statuses = labStore.getState().stepStatuses;
    labEl.textContent = lab ? `${lab.number}: ${lab.title}` : '—';
    if (lab && lab.steps[idx]) {
      const step = lab.steps[idx]!;
      const status = statuses[step.id] ?? 'pending';
      const done = status === 'done' ? '✓ ' : status === 'in-progress' ? '▸ ' : '  ';
      stepEl.textContent = `${done}${step.title}`;
    } else {
      stepEl.textContent = '—';
    }
  }

  function syncScore() {
    const s = scoreStore.getState();
    scoreEl.textContent = `${s.current?.total ?? 0}`;
  }

  // Timer: update every second when a lab is active
  function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      const startedAt = labStore.getState().startedAt;
      if (!startedAt) {
        timerEl.textContent = '00:00';
        return;
      }
      const elapsed = Date.now() - startedAt;
      timerEl.textContent = formatTimer(elapsed);
    }, 1000);
  }

  function syncTimer() {
    const lab = labStore.getState().current;
    if (lab) {
      startTimer();
    } else {
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
      timerEl.textContent = '00:00';
    }
  }

  // Subscribe to lab store
  labStore.subscribe(() => {
    sync();
    syncTimer();
  });

  // Subscribe to score store
  scoreStore.subscribe(syncScore);

  sync();
  syncScore();
  syncTimer();
}

/** Update the zone label in the HUD (called when the player enters a new zone). */
export function setHUDZone(zoneId: ZoneId, displayName: string) {
  const el = document.getElementById('hud-zone');
  if (el) el.textContent = displayName;
}

/** Build a minimal nav bar for zone switching (shown at the bottom of the screen). */
export function initNavRail(zones: ZoneId[], onSelect: (zoneId: ZoneId) => void) {
  const rail = document.createElement('div');
  rail.id = 'nav-rail';
  rail.style.cssText = `
    position: fixed; bottom: 0; left: 0; right: 0; height: 44px;
    background: rgba(27,31,36,0.95); border-top: 1px solid var(--border);
    display: flex; align-items: center; justify-content: center; gap: 8px;
    padding: 0 16px; z-index: 10;
  `;
  document.body.appendChild(rail);

  const label = document.createElement('span');
  label.style.cssText = 'color:var(--muted);font-size:12px;margin-right:8px;';
  label.textContent = 'Zones:';
  rail.appendChild(label);

  for (const z of zones) {
    const btn = document.createElement('button');
    btn.textContent = z.replace(/-/g, ' ');
    btn.className = 'touch-target';
    btn.style.cssText = `
      background: var(--panel-2); border: 1px solid var(--border); border-radius: 4px;
      color: var(--muted); font-size: 12px; cursor: pointer;
    `;
    btn.addEventListener('click', () => onSelect(z));
    rail.appendChild(btn);
  }
}
