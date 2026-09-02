/**
 * ui/startScreen.ts — lab selection overlay.
 * Shown before the 3D scene. The learner picks a lab to start.
 */
import { findLab } from '@/labs/registry';
import { mkLabId } from '@/domain';

const LABS = [
  { id: 'lab01', title: 'IAM Foundation',       brief: 'Build the directory from scratch. Create users, groups, and configure your first IdP policy.' },
  { id: 'lab02', title: 'Joiner / Mover / Leaver', brief: 'Process onboarding, transfer, and termination tickets.' },
  { id: 'lab03', title: 'RBAC & Least Privilege', brief: 'Create roles, discover standing privilege, and enforce least privilege.' },
  { id: 'lab04', title: 'Enterprise SSO',         brief: 'Configure SAML and OIDC single sign-on for two business applications.' },
  { id: 'lab05', title: 'MFA & Conditional Access', brief: 'Enforce MFA for privileged accounts and block foreign sign-ins.' },
  { id: 'lab06', title: 'Access Reviews',          brief: 'Conduct the Q3 access review campaign and remove stale access.' },
  { id: 'lab07', title: 'SSO Break/Fix',           brief: 'Diagnose and resolve a live SSO outage. Randomized fault.' },
  { id: 'lab08', title: 'Identity Incident',       brief: 'Respond to a compromised account: triage, contain, and write the report.' },
  { id: 'lab09', title: 'Privileged Access Mgmt', brief: 'Remove standing admin privilege and implement time-limited elevation.' },
  { id: 'lab10', title: 'Enterprise Capstone',      brief: 'Run the full identity program: 10+ objectives, two faults, one debrief.' },
];

export function showStartScreen(onStart: (labId: string) => void) {
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
      <div style="text-align:center;margin-bottom:40px;">
        <div style="color:#4ec9b0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:8px;">Interactive Training Environment</div>
        <h1 style="color:#e6e6e6;font-size:28px;font-weight:700;margin:0 0 8px;">IAM &amp; SSO 3D Lab</h1>
        <p style="color:#8b95a1;font-size:14px;margin:0;">Northwind Labs · Identity Operations Simulation</p>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        ${LABS.map((l, i) => `
          <div class="lab-card" data-id="${l.id}"
               style="background:#1b1f24;border:1px solid #2d343d;border-radius:8px;padding:14px 16px;cursor:pointer;transition:border-color 0.15s,transform 0.1s;">
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;">
              <strong style="color:#4ec9b0;font-size:13px;">${String(i + 1).padStart(2, '0')}. ${l.title}</strong>
            </div>
            <div style="color:#8b95a1;font-size:12px;line-height:1.5;">${l.brief}</div>
          </div>
        `).join('')}
      </div>

      <div style="margin-top:32px;text-align:center;color:#8b95a1;font-size:12px;">
        Click a lab to start · <span style="color:#4ec9b0;">WASD</span> to move · <span style="color:#4ec9b0;">E</span> to open console · <span style="color:#4ec9b0;">ESC</span> to close
      </div>
    </div>
  `;

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
}
