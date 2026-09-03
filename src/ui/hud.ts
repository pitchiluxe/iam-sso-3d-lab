/**
 * hud.ts — HUD pill updates, wired to the lab store.
 * Also renders the nav rail at the bottom of the screen for zone switching.
 */
import { labStore } from '@/stores';
import { scoreStore } from '@/stores';
import { type ZoneId } from '@/three/zones';

export function initHUD(onMenuClick?: () => void) {
  const labEl = document.getElementById('hud-lab')!;
  const stepEl = document.getElementById('hud-step')!;
  const scoreEl = document.getElementById('hud-score')!;
  const menuBtn = document.getElementById('hud-menu');
  if (menuBtn && onMenuClick) {
    menuBtn.addEventListener('click', onMenuClick);
  }

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

  // Subscribe to lab store
  labStore.subscribe(() => {
    sync();
    syncScore();
  });

  // Subscribe to score store
  scoreStore.subscribe(syncScore);

  sync();
  syncScore();
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
