/**
 * ui/startScreen.ts — lab selection overlay.
 * Shown before the 3D scene. The learner picks a lab to start.
 *
 * Includes a footer with Export, Import, and Reset buttons so the learner
 * can save their progress between sessions.
 */
import { progressStore } from '@/stores';
import { showToast } from './toast';

const LABS = [
  {
    id: 'lab01',
    title: 'IAM Foundation',
    brief:
      'Build the directory from scratch. Create users, groups, and configure your first IdP policy.',
  },
  {
    id: 'lab02',
    title: 'Joiner / Mover / Leaver',
    brief: 'Process onboarding, transfer, and termination tickets.',
  },
  {
    id: 'lab03',
    title: 'RBAC & Least Privilege',
    brief: 'Create roles, discover standing privilege, and enforce least privilege.',
  },
  {
    id: 'lab04',
    title: 'Enterprise SSO',
    brief: 'Configure SAML and OIDC single sign-on for two business applications.',
  },
  {
    id: 'lab05',
    title: 'MFA & Conditional Access',
    brief: 'Enforce MFA for privileged accounts and block foreign sign-ins.',
  },
  {
    id: 'lab06',
    title: 'Access Reviews',
    brief: 'Conduct the Q3 access review campaign and remove stale access.',
  },
  {
    id: 'lab07',
    title: 'SSO Break/Fix',
    brief: 'Diagnose and resolve a live SSO outage. Randomized fault.',
  },
  {
    id: 'lab08',
    title: 'Identity Incident',
    brief: 'Respond to a compromised account: triage, contain, and write the report.',
  },
  {
    id: 'lab09',
    title: 'Privileged Access Mgmt',
    brief: 'Remove standing admin privilege and implement time-limited elevation.',
  },
  {
    id: 'lab10',
    title: 'Enterprise Capstone',
    brief: 'Run the full identity program: 10+ objectives, two faults, one debrief.',
  },
  {
    id: 'lab11',
    title: 'Conditional Access',
    brief: 'Block legacy auth, enforce MFA via CA policies, add named location exceptions.',
  },
  {
    id: 'lab12',
    title: 'Hybrid Identity Sync',
    brief:
      'Provision on-prem AD users, install the cloud sync agent, resolve a soft-match conflict.',
  },
  {
    id: 'lab13',
    title: 'Break-Glass Accounts',
    brief: 'Design and test a break-glass emergency access policy with real-time alerting.',
  },
];

export function showStartScreen(onStart: (labId: string) => void, onDismiss: () => void) {
  // Remove any existing start screen first (prevents double-overlay on rapid calls)
  const existing = document.getElementById('start-screen');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'start-screen';
  overlay.style.cssText = `
    position:fixed;inset:0;background:#0e1116;z-index:100;
    display:flex;flex-direction:column;align-items:center;
    padding:40px 20px;overflow-y:auto;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  `;

  overlay.innerHTML = `
    <div style="max-width:680px;width:100%;">
      <div style="text-align:center;margin-bottom:40px;position:relative;">
        <div style="color:#4ec9b0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:8px;">Interactive Training Environment</div>
        <h1 style="color:#e6e6e6;font-size:28px;font-weight:700;margin:0 0 8px;">IAM &amp; SSO 3D Lab</h1>
        <p style="color:#8b95a1;font-size:14px;margin:0;">Northwind Labs · Identity Operations Simulation</p>
        <button id="ss-close" aria-label="Close lab menu"
                style="position:absolute;top:0;right:0;background:#1b1f24;color:#8b95a1;border:1px solid #2d343d;border-radius:6px;padding:6px 10px;font-size:18px;line-height:1;cursor:pointer;min-width:36px;min-height:36px;">
          &times;
        </button>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        ${LABS.map(
          (l, i) => `
          <div class="lab-card" data-id="${l.id}"
               style="background:#1b1f24;border:1px solid #2d343d;border-radius:8px;padding:14px 16px;cursor:pointer;transition:border-color 0.15s,transform 0.1s;">
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;">
              <strong style="color:#4ec9b0;font-size:13px;">${String(i + 1).padStart(2, '0')}. ${l.title}</strong>
            </div>
            <div style="color:#8b95a1;font-size:12px;line-height:1.5;">${l.brief}</div>
          </div>
        `,
        ).join('')}
      </div>

      <div style="margin-top:32px;text-align:center;color:#8b95a1;font-size:12px;">
        Click a lab to start · <span style="color:#4ec9b0;">WASD</span> to move · <span style="color:#4ec9b0;">E</span> to open console · <span style="color:#4ec9b0;">ESC</span> to close
      </div>

      <div style="margin-top:24px;padding:14px 16px;background:#1b1f24;border:1px solid #2d343d;border-radius:8px;display:flex;gap:12px;align-items:flex-start;">
        <span style="font-size:22px;flex-shrink:0;">🤖</span>
        <div style="flex:1;min-width:0;">
          <div style="color:#4ec9b0;font-weight:600;font-size:13px;margin-bottom:4px;">AI Supervisor available in every lab</div>
          <div style="color:#8b95a1;font-size:12px;line-height:1.5;">
            An AI tutor watches your audit log, scores each step, and guides you with
            Socratic hints when you're stuck — it never gives you the answer.
            <a id="ss-ollama-check" href="#" style="color:#4ec9b0;font-weight:600;margin-left:4px;white-space:nowrap;">Check Ollama status →</a>
          </div>
        </div>
      </div>

      <div style="margin-top:16px;display:flex;justify-content:center;gap:10px;flex-wrap:wrap;">
        <button id="ss-export" class="ss-toolbar-btn"
                style="background:#1b1f24;color:#8b95a1;border:1px solid #2d343d;border-radius:6px;padding:8px 14px;font-size:12px;cursor:pointer;min-height:36px;">
          ⤓ Export progress
        </button>
        <button id="ss-import" class="ss-toolbar-btn"
                style="background:#1b1f24;color:#8b95a1;border:1px solid #2d343d;border-radius:6px;padding:8px 14px;font-size:12px;cursor:pointer;min-height:36px;">
          ⤒ Import progress
        </button>
        <button id="ss-reset" class="ss-toolbar-btn"
                style="background:#1b1f24;color:#f48771;border:1px solid #2d343d;border-radius:6px;padding:8px 14px;font-size:12px;cursor:pointer;min-height:36px;">
          ⟲ Reset all progress
        </button>
        <input id="ss-import-file" type="file" accept="application/json" style="display:none;" />
      </div>
    </div>
  `;

  function dismiss() {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.2s';
    setTimeout(() => overlay.remove(), 200);
    onDismiss();
  }

  document.body.appendChild(overlay);

  // Add hover effect via JS (no CSS class needed)
  for (const card of overlay.querySelectorAll('.lab-card')) {
    card.addEventListener('mouseenter', () => {
      (card as HTMLElement).style.borderColor = '#4ec9b0';
      (card as HTMLElement).style.transform = 'translateY(-1px)';
    });
    card.addEventListener('mouseleave', () => {
      (card as HTMLElement).style.borderColor = '#2d343d';
      (card as HTMLElement).style.transform = 'none';
    });
    card.addEventListener('click', () => {
      const id = (card as HTMLElement).dataset['id']!;
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.3s';
      setTimeout(() => {
        overlay.remove();
        onStart(id);
      }, 300);
    });
  }

  // Close button (top-right) — returns to the 3D scene
  overlay.querySelector('#ss-close')?.addEventListener('click', () => dismiss());

  // Toolbar actions
  overlay.querySelector('#ss-export')?.addEventListener('click', () => {
    progressStore.getState().exportProgress();
    showToast('Progress exported.', { kind: 'success' });
  });
  overlay.querySelector('#ss-import')?.addEventListener('click', () => {
    overlay.querySelector<HTMLInputElement>('#ss-import-file')?.click();
  });
  overlay.querySelector('#ss-import-file')?.addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      await progressStore.getState().importProgress(file);
      showToast('Progress imported. Reload to see changes.', { kind: 'success' });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Import failed.', { kind: 'error' });
    }
  });
  overlay.querySelector('#ss-reset')?.addEventListener('click', () => {
    if (
      window.confirm(
        'Reset ALL progress (completed labs, best scores, in-flight lab)? This cannot be undone.',
      )
    ) {
      progressStore.getState().reset();
      // Also clear any in-flight lab and evidence.
      localStorage.removeItem('iam-lab-state-v2');
      showToast('All progress cleared.', { kind: 'info' });
    }
  });

  // Ollama status check — pings the local Ollama server and reports the result inline.
  overlay.querySelector('#ss-ollama-check')?.addEventListener('click', async (e) => {
    e.preventDefault();
    const card = overlay.querySelector('#ss-ollama-check')?.parentElement?.parentElement;
    if (!card) return;
    const link = overlay.querySelector('#ss-ollama-check') as HTMLElement;
    link.textContent = 'Checking…';
    link.style.pointerEvents = 'none';
    try {
      const disabled =
        (window as unknown as { env?: { OLLAMA_DISABLED?: string } }).env?.OLLAMA_DISABLED ===
        'true';
      if (disabled) {
        card.style.borderColor = '#d7ba7d';
        link.textContent = '⚙️ Ollama disabled — local hints only';
        return;
      }
      const baseUrl =
        (window as unknown as { env?: { OLLAMA_BASE_URL?: string } }).env?.OLLAMA_BASE_URL ??
        'http://localhost:11434';
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 3000);
      const res = await fetch(`${baseUrl}/api/tags`, { signal: ctrl.signal });
      clearTimeout(t);
      if (res.ok) {
        card.style.borderColor = '#4ec9b0';
        link.textContent = '✅ Ollama is online — AI coaching active';
        link.style.color = '#4ec9b0';
      } else {
        card.style.borderColor = '#f48771';
        link.textContent = '⚠️ Ollama unreachable — install from ollama.com';
        link.style.color = '#f48771';
      }
    } catch {
      card.style.borderColor = '#f48771';
      link.textContent =
        '⚠️ Ollama offline — install from ollama.com and run `ollama pull llama3.2`';
      link.style.color = '#f48771';
    }
  });
}
