/**
 * ui/desktopView.ts — how the VM desktop shows its icons: their size, and
 * whether they are shown at all. Right-click the desktop → View, as in
 * Windows. Remembered per browser; a blocked store just means the defaults.
 */
export type IconSize = 'large' | 'medium' | 'small';

export interface DesktopView {
  size: IconSize;
  showIcons: boolean;
}

export const DESKTOP_VIEW_KEY = 'iam3d.desktopView.v1';

export const DEFAULT_DESKTOP_VIEW: DesktopView = { size: 'medium', showIcons: true };

/** Pixel metrics for each size: glyph, tile width, label, rows per column, padding. */
export const ICON_METRICS: Record<
  IconSize,
  { glyph: number; tile: number; label: number; rows: number; pad: number }
> = {
  large: { glyph: 44, tile: 96, label: 12, rows: 5, pad: 10 },
  medium: { glyph: 32, tile: 80, label: 11, rows: 6, pad: 8 },
  small: { glyph: 20, tile: 64, label: 10, rows: 9, pad: 4 },
};

export function loadDesktopView(): DesktopView {
  try {
    const raw = localStorage.getItem(DESKTOP_VIEW_KEY);
    if (!raw) return { ...DEFAULT_DESKTOP_VIEW };
    const v = JSON.parse(raw) as Partial<DesktopView>;
    return {
      size: v.size === 'large' || v.size === 'small' || v.size === 'medium' ? v.size : 'medium',
      showIcons: v.showIcons !== false,
    };
  } catch {
    return { ...DEFAULT_DESKTOP_VIEW };
  }
}

export function saveDesktopView(v: DesktopView): void {
  try {
    localStorage.setItem(DESKTOP_VIEW_KEY, JSON.stringify(v));
  } catch {
    // Not remembered; the desktop still changes for this session.
  }
}

export interface MenuItem {
  label: string;
  checked?: boolean;
  header?: boolean;
  separator?: boolean;
  onClick?: () => void;
}

/** A small Windows-style context menu at the pointer. Returns a close function. */
export function openDesktopMenu(x: number, y: number, items: MenuItem[]): () => void {
  document.getElementById('desktop-context-menu')?.remove();
  const menu = document.createElement('div');
  menu.id = 'desktop-context-menu';
  menu.setAttribute('role', 'menu');
  menu.style.cssText = `
    position: fixed; z-index: 5002; min-width: 220px; padding: 4px;
    background: rgba(32, 36, 42, 0.97); border: 1px solid rgba(255,255,255,0.12);
    border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    font-size: 12.5px; color: #e6edf3; backdrop-filter: blur(18px);
  `;
  const close = (): void => {
    menu.remove();
    document.removeEventListener('mousedown', onDown, true);
    document.removeEventListener('keydown', onKey, true);
  };
  const onDown = (e: MouseEvent): void => {
    if (!menu.contains(e.target as Node)) close();
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') close();
  };
  for (const it of items) {
    if (it.separator) {
      const hr = document.createElement('div');
      hr.style.cssText = 'height:1px;margin:4px 6px;background:rgba(255,255,255,0.1);';
      menu.appendChild(hr);
      continue;
    }
    const row = document.createElement('div');
    if (it.header) {
      row.textContent = it.label;
      row.style.cssText =
        'padding:6px 10px 2px;font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:#8b95a1;';
      menu.appendChild(row);
      continue;
    }
    row.setAttribute('role', 'menuitemcheckbox');
    row.setAttribute('aria-checked', String(!!it.checked));
    row.style.cssText =
      'display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:5px;cursor:pointer;';
    const tick = document.createElement('span');
    tick.style.cssText = 'width:14px;color:#4ec9b0;';
    tick.textContent = it.checked ? '✓' : '';
    const text = document.createElement('span');
    text.textContent = it.label;
    row.append(tick, text);
    row.addEventListener('mouseenter', () => (row.style.background = 'rgba(255,255,255,0.08)'));
    row.addEventListener('mouseleave', () => (row.style.background = 'transparent'));
    row.addEventListener('click', (e) => {
      e.stopPropagation();
      close();
      it.onClick?.();
    });
    menu.appendChild(row);
  }
  document.body.appendChild(menu);
  // Keep it on screen.
  const r = menu.getBoundingClientRect();
  menu.style.left = `${Math.max(0, Math.min(x, window.innerWidth - r.width - 4))}px`;
  menu.style.top = `${Math.max(0, Math.min(y, window.innerHeight - r.height - 4))}px`;
  setTimeout(() => {
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('keydown', onKey, true);
  }, 0);
  return close;
}
