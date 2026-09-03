/**
 * ui/consoles/settingsWindow.ts — VM Settings app (Windows 11 style).
 *
 * Sidebar of categories + a content pane. Only the Sound toggle has a real
 * effect (wired to ui/audio.ts's mute flag); the rest mirror real Settings
 * categories with plausible read-only info, consistent with how File
 * Explorer and Control Panel present fake-but-realistic system data.
 */
import { isMuted, setMuted, blip } from '@/ui/audio';
import { WALLPAPERS, WALLPAPER_STORAGE_KEY, DEFAULT_WALLPAPER_ID } from '@/util/wallpapers';

const DENSITY_KEY = 'settings_density';

type CategoryId = 'system' | 'personalization' | 'apps' | 'accounts' | 'sound' | 'about';

interface Category {
  id: CategoryId;
  icon: string;
  label: string;
}

const CATEGORIES: Category[] = [
  { id: 'system', icon: '🖥️', label: 'System' },
  { id: 'personalization', icon: '🎨', label: 'Personalization' },
  { id: 'apps', icon: '📦', label: 'Apps' },
  { id: 'accounts', icon: '👤', label: 'Accounts' },
  { id: 'sound', icon: '🔊', label: 'Sound' },
  { id: 'about', icon: 'ℹ️', label: 'About' },
];

function toggleRow(
  label: string,
  description: string,
  checked: boolean,
  onChange: (v: boolean) => void,
): HTMLElement {
  const row = document.createElement('div');
  row.style.cssText = `
    display:flex;align-items:center;justify-content:space-between;gap:12px;
    padding:14px 0;border-bottom:1px solid #2d343d;
  `;
  const text = document.createElement('div');
  text.innerHTML = `<div style="font-size:13px;color:#e6e6e6;">${label}</div><div style="font-size:11px;color:#8b95a1;margin-top:2px;">${description}</div>`;
  row.appendChild(text);

  const toggle = document.createElement('button');
  toggle.setAttribute('role', 'switch');
  toggle.setAttribute('aria-checked', String(checked));
  let state = checked;
  const paint = () => {
    toggle.style.cssText = `
      width:40px;height:22px;border-radius:11px;border:none;cursor:pointer;flex-shrink:0;
      background:${state ? '#4ec9b0' : '#2d343d'};position:relative;transition:background 0.15s;
    `;
    toggle.innerHTML = `<span style="position:absolute;top:2px;left:${state ? '20px' : '2px'};width:18px;height:18px;border-radius:50%;background:#fff;transition:left 0.15s;"></span>`;
  };
  paint();
  toggle.addEventListener('click', () => {
    state = !state;
    paint();
    onChange(state);
  });
  row.appendChild(toggle);
  return row;
}

function sectionTitle(text: string): HTMLElement {
  const h = document.createElement('h2');
  h.textContent = text;
  h.style.cssText = 'font-size:18px;color:#e6e6e6;margin:0 0 16px 0;font-weight:600;';
  return h;
}

function infoRow(label: string, value: string): string {
  return `
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #232830;font-size:12px;">
      <span style="color:#8b95a1;">${label}</span><span style="color:#e6e6e6;">${value}</span>
    </div>
  `;
}

export function renderSettingsWindow(body: HTMLElement): void {
  body.style.cssText =
    'display:flex;height:100%;background:#161a20;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI Variable","Segoe UI",sans-serif;color:#c8cdd3;';

  const sidebar = document.createElement('div');
  sidebar.style.cssText =
    'width:180px;flex-shrink:0;background:#12151a;border-right:1px solid #2d343d;padding:12px 0;overflow-y:auto;';
  body.appendChild(sidebar);

  const content = document.createElement('div');
  content.style.cssText = 'flex:1;padding:24px 28px;overflow-y:auto;';
  body.appendChild(content);

  let active: CategoryId = 'system';

  function renderSidebar(): void {
    sidebar.innerHTML = '';
    for (const cat of CATEGORIES) {
      const btn = document.createElement('button');
      const isActive = cat.id === active;
      btn.style.cssText = `
        display:flex;align-items:center;gap:10px;width:100%;text-align:left;
        padding:9px 16px;border:none;cursor:pointer;font-size:13px;
        background:${isActive ? '#232830' : 'transparent'};
        color:${isActive ? '#4ec9b0' : '#c8cdd3'};
        border-left:3px solid ${isActive ? '#4ec9b0' : 'transparent'};
      `;
      btn.innerHTML = `<span style="font-size:16px;">${cat.icon}</span><span>${cat.label}</span>`;
      btn.addEventListener('click', () => {
        active = cat.id;
        renderSidebar();
        renderContent();
      });
      sidebar.appendChild(btn);
    }
  }

  function renderContent(): void {
    content.innerHTML = '';

    if (active === 'system') {
      content.appendChild(sectionTitle('System'));
      const box = document.createElement('div');
      box.innerHTML =
        infoRow('Device name', 'APEX-OPS-01') +
        infoRow('Processor', 'Apex vCPU @ 3.2 GHz (8 cores)') +
        infoRow('Installed RAM', '16.0 GB') +
        infoRow('OS', 'Apex OS 11 Enterprise') +
        infoRow('OS build', '26100.4331') +
        infoRow('System type', '64-bit operating system');
      content.appendChild(box);
      content.appendChild(
        toggleRow(
          'Reduce motion',
          'Minimizes animations across the desktop (cosmetic preference).',
          localStorage.getItem('settings_reduce_motion') === 'true',
          (v) => {
            try {
              localStorage.setItem('settings_reduce_motion', String(v));
            } catch {
              /* ignore */
            }
          },
        ),
      );
      return;
    }

    if (active === 'personalization') {
      content.appendChild(sectionTitle('Personalization'));
      const label = document.createElement('div');
      label.textContent = 'Background';
      label.style.cssText =
        'font-size:12px;color:#8b95a1;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.06em;';
      content.appendChild(label);

      const grid = document.createElement('div');
      grid.style.cssText = 'display:flex;flex-wrap:wrap;gap:14px;';
      const current = localStorage.getItem(WALLPAPER_STORAGE_KEY) ?? DEFAULT_WALLPAPER_ID;
      for (const wp of WALLPAPERS) {
        const card = document.createElement('button');
        const isSel = wp.id === current;
        card.style.cssText = `
          width:120px;height:72px;border-radius:8px;cursor:pointer;
          background:${wp.gradient};border:2px solid ${isSel ? '#4ec9b0' : 'transparent'};
          display:flex;align-items:flex-end;padding:6px;position:relative;
        `;
        card.innerHTML = `<span style="font-size:11px;color:#e6e6e6;text-shadow:0 1px 3px rgba(0,0,0,0.8);">${wp.label}</span>${isSel ? '<span style="position:absolute;top:6px;right:6px;color:#4ec9b0;font-size:14px;">✓</span>' : ''}`;
        card.addEventListener('click', () => {
          try {
            localStorage.setItem(WALLPAPER_STORAGE_KEY, wp.id);
          } catch {
            /* ignore */
          }
          document.dispatchEvent(
            new CustomEvent('apex-wallpaper-changed', { detail: wp.gradient }),
          );
          renderContent();
        });
        grid.appendChild(card);
      }
      content.appendChild(grid);

      content.appendChild(
        toggleRow(
          'Compact taskbar',
          'Reduces the taskbar height for a denser layout.',
          localStorage.getItem(DENSITY_KEY) === 'compact',
          (v) => {
            try {
              localStorage.setItem(DENSITY_KEY, v ? 'compact' : 'normal');
            } catch {
              /* ignore */
            }
          },
        ),
      );
      return;
    }

    if (active === 'apps') {
      content.appendChild(sectionTitle('Installed apps'));
      const list = [
        { icon: '🔐', name: 'IAM Console', size: '54.1 MB', version: '1.45.1' },
        { icon: '🎫', name: 'Ticket Queue', size: '38.7 MB', version: '1.45.1' },
        { icon: '🛡️', name: 'SecOps Dashboard', size: '61.3 MB', version: '1.45.1' },
        { icon: '📝', name: 'Notepad', size: '2.1 MB', version: '11.2409' },
      ];
      const rows = list
        .map(
          (a) => `
        <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #232830;">
          <span style="font-size:22px;">${a.icon}</span>
          <div style="flex:1;">
            <div style="font-size:13px;color:#e6e6e6;">${a.name}</div>
            <div style="font-size:11px;color:#8b95a1;">${a.size} · v${a.version}</div>
          </div>
        </div>
      `,
        )
        .join('');
      const wrap = document.createElement('div');
      wrap.innerHTML = rows;
      content.appendChild(wrap);
      return;
    }

    if (active === 'accounts') {
      content.appendChild(sectionTitle('Accounts'));
      const card = document.createElement('div');
      card.style.cssText =
        'display:flex;align-items:center;gap:14px;padding:16px;background:#1b1f24;border-radius:8px;margin-bottom:16px;';
      card.innerHTML = `
        <div style="width:52px;height:52px;border-radius:50%;background:#4ec9b0;display:flex;align-items:center;justify-content:center;font-size:22px;color:#0e1116;font-weight:700;">A</div>
        <div>
          <div style="font-size:14px;color:#e6e6e6;font-weight:600;">admin@northwind.local</div>
          <div style="font-size:11px;color:#8b95a1;">IAM Administrator</div>
        </div>
      `;
      content.appendChild(card);
      const box = document.createElement('div');
      box.innerHTML =
        infoRow('Account type', 'Administrator') + infoRow('Sign-in method', 'Password + TOTP');
      content.appendChild(box);
      return;
    }

    if (active === 'sound') {
      content.appendChild(sectionTitle('Sound'));
      content.appendChild(
        toggleRow(
          'Play UI sounds',
          'Console activations, step completion chimes, and workstation blips.',
          !isMuted(),
          (v) => {
            setMuted(!v);
            if (v) blip(660, 60, 0.05);
          },
        ),
      );
      return;
    }

    if (active === 'about') {
      content.appendChild(sectionTitle('About'));
      const box = document.createElement('div');
      box.innerHTML =
        infoRow('Edition', 'Apex OS 11 Enterprise') +
        infoRow('Version', '24H2') +
        infoRow('Installed on', '8/12/2026') +
        infoRow('Product ID', '00330-80000-00000-AA457');
      content.appendChild(box);
      const footer = document.createElement('div');
      footer.style.cssText = 'margin-top:16px;font-size:11px;color:#8b95a1;';
      footer.textContent = 'Northwind Holdings — Apex Identity Workstation';
      content.appendChild(footer);
      return;
    }
  }

  renderSidebar();
  renderContent();
}
