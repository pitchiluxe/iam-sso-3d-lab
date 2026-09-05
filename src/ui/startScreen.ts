/**
 * ui/startScreen.ts — lab selection overlay.
 * Shown before the 3D scene. The learner picks a lab to start.
 *
 * Includes a footer with Export, Import, and Reset buttons so the learner
 * can save their progress between sessions.
 *
 * Batch lab section: three "Generate Queue" buttons produce single labs with
 * 10/15/20 pre-seeded tickets that appear in the Ticket Console when the
 * learner starts the lab.
 */
import { mkLabId } from '@/domain';
import { progressStore, generatedLabsStore } from '@/stores';
import { BATCH_TEMPLATES } from '@/labs/generated/templates';
import { showToast } from './toast';
import { isTutorialComplete, showTutorial } from './tutorialOverlay';
import { getEarnedAchievements } from '@/util/achievements';

/** Escapes HTML-significant characters. Used for any text originating from
 * the AI flavor generator (LLM output is untrusted) before interpolating it
 * into innerHTML — the 13 hand-authored core lab titles/briefs don't need this. */
function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

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

  // Compute progress stats and achievement badges once for the dashboard.
  const progress = progressStore.getState();
  const completedCount = progress.completedLabIds.length;
  const totalBest = Object.values(progress.bestScores).reduce((sum, s) => sum + (s?.total ?? 0), 0);
  const earnedBadges = getEarnedAchievements(progress.achievedBadges ?? []);

  const progressBars = LABS.map((l) => {
    const labId = mkLabId(l.id);
    const completed = progress.completedLabIds.includes(labId);
    const best = progress.bestScores[labId];
    return `<div title="${l.title}${completed ? ` — ${best?.total ?? 0} pts` : ' — Not started'}"
                 style="height:10px;border-radius:3px;background:${completed ? '#4ec9b0' : '#2d343d'};cursor:help;position:relative;display:flex;align-items:center;justify-content:center;font-size:9px;color:#0e1116;font-weight:700;">${completed ? '✓' : ''}</div>`;
  }).join('');

  const badgesHtml =
    earnedBadges.length > 0
      ? earnedBadges
          .map(
            (a) =>
              `<span title="${a.description}" style="display:inline-flex;align-items:center;gap:4px;padding:4px 8px;background:#1b1f24;border:1px solid #2d343d;border-radius:14px;font-size:11px;color:#c8cdd3;">${a.emoji} ${a.label}</span>`,
          )
          .join(' ')
      : '<span style="color:#8b95a1;font-size:11px;font-style:italic;">No badges yet — complete labs to earn them.</span>';

  overlay.innerHTML = `
    <div style="max-width:680px;width:100%;">
      <div style="text-align:center;margin-bottom:24px;position:relative;">
        <div style="color:#4ec9b0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:8px;">Interactive Training Environment</div>
        <h1 style="color:#e6e6e6;font-size:28px;font-weight:700;margin:0 0 8px;">IAM &amp; SSO 3D Lab</h1>
        <p style="color:#8b95a1;font-size:14px;margin:0;">Northwind Labs · Identity Operations Simulation</p>
        <button id="ss-close" aria-label="Close lab menu"
                style="position:absolute;top:0;right:0;background:#1b1f24;color:#8b95a1;border:1px solid #2d343d;border-radius:6px;padding:6px 10px;font-size:18px;line-height:1;cursor:pointer;min-width:36px;min-height:36px;">
          &times;
        </button>
      </div>

      <!-- My Progress Dashboard -->
      <div style="background:#1b1f24;border:1px solid #2d343d;border-radius:8px;padding:16px;margin-bottom:24px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <h2 style="color:#e6e6e6;font-size:14px;margin:0;text-transform:uppercase;letter-spacing:0.08em;">📊 My Progress</h2>
          <div style="color:#8b95a1;font-size:11px;">${completedCount} / ${LABS.length} labs · ${totalBest} total pts · ${earnedBadges.length} badges</div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(${LABS.length},1fr);gap:3px;margin-bottom:12px;">
          ${progressBars}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          ${badgesHtml}
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        ${LABS.map((l, i) => {
          const labId = mkLabId(l.id);
          const completed = progress.completedLabIds.includes(labId);
          const best = progress.bestScores[labId];
          return `
          <div class="lab-card" data-id="${l.id}"
               style="background:#1b1f24;border:1px solid ${completed ? '#4ec9b0' : '#2d343d'};border-radius:8px;padding:14px 16px;cursor:pointer;transition:border-color 0.15s,transform 0.1s;position:relative;">
            ${completed ? `<div style="position:absolute;top:8px;right:8px;background:#4ec9b0;color:#0e1116;font-size:10px;font-weight:700;padding:2px 6px;border-radius:8px;">✓ ${best?.total ?? 0} pts</div>` : ''}
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;">
              <strong style="color:#4ec9b0;font-size:13px;">${String(i + 1).padStart(2, '0')}. ${l.title}</strong>
            </div>
            <div style="color:#8b95a1;font-size:12px;line-height:1.5;">${l.brief}</div>
          </div>
        `;
        }).join('')}
      </div>

      <div style="margin-top:32px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <div>
            <h2 style="color:#e6e6e6;font-size:16px;margin:0;">Daily IT Support Tickets</h2>
            <div style="color:#8b95a1;font-size:11px;margin-top:2px;">AI-generated — real-world help-desk scenarios, never repeated</div>
          </div>
          <button id="ss-generate" style="background:#4ec9b0;color:#0e1116;border:none;border-radius:6px;padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer;min-height:36px;white-space:nowrap;">
            🤖 Generate 10 More
          </button>
        </div>
        <div id="ss-generated-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;"></div>
        <div id="ss-generated-pager" style="display:none;justify-content:center;gap:8px;margin-top:12px;">
          <button id="ss-gen-prev" style="background:#1b1f24;color:#8b95a1;border:1px solid #2d343d;border-radius:6px;padding:6px 12px;font-size:12px;cursor:pointer;">← Prev</button>
          <span id="ss-gen-page-label" style="color:#8b95a1;font-size:12px;align-self:center;"></span>
          <button id="ss-gen-next" style="background:#1b1f24;color:#8b95a1;border:1px solid #2d343d;border-radius:6px;padding:6px 12px;font-size:12px;cursor:pointer;">Next →</button>
        </div>
      </div>

      <div style="margin-top:32px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <div>
            <h2 style="color:#e6e6e6;font-size:16px;margin:0;">🎫 Multi-Ticket Queue Labs</h2>
            <div style="color:#8b95a1;font-size:11px;margin-top:2px;">
              AI-generated — each lab spawns 10, 15, or 20 pre-seeded tickets. Triage them in priority order.
            </div>
          </div>
          <button id="ss-generate-batches" style="background:#fbbf24;color:#0e1116;border:none;border-radius:6px;padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer;min-height:36px;white-space:nowrap;">
            🤖 Generate 3 More
          </button>
        </div>
        <div id="ss-batch-grid" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;"></div>
        <div id="ss-batch-pager" style="display:none;justify-content:center;gap:8px;margin-top:12px;">
          <button id="ss-batch-prev" style="background:#1b1f24;color:#8b95a1;border:1px solid #2d343d;border-radius:6px;padding:6px 12px;font-size:12px;cursor:pointer;">← Prev</button>
          <span id="ss-batch-page-label" style="color:#8b95a1;font-size:12px;align-self:center;"></span>
          <button id="ss-batch-next" style="background:#1b1f24;color:#8b95a1;border:1px solid #2d343d;border-radius:6px;padding:6px 12px;font-size:12px;cursor:pointer;">Next →</button>
        </div>
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
        <button id="ss-tutorial" class="ss-toolbar-btn"
                style="background:#1b1f24;color:#4ec9b0;border:1px solid #2d343d;border-radius:6px;padding:8px 14px;font-size:12px;cursor:pointer;min-height:36px;">
          🎓 ${isTutorialComplete() ? 'Replay tutorial' : 'Start tutorial'}
        </button>
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

  const PAGE_SIZE = 10;
  let genPage = 0;

  function renderGeneratedGrid(): void {
    const grid = overlay.querySelector('#ss-generated-grid') as HTMLElement;
    const pager = overlay.querySelector('#ss-generated-pager') as HTMLElement;
    const pageLabel = overlay.querySelector('#ss-gen-page-label') as HTMLElement;
    const labs = generatedLabsStore.getState().labs;

    if (labs.length === 0) {
      grid.innerHTML = `<div style="grid-column:1/-1;color:#8b95a1;font-size:12px;padding:12px 0;">No generated tickets yet — click "Generate 10 More" to create your first batch.</div>`;
      pager.style.display = 'none';
      return;
    }

    const totalPages = Math.max(1, Math.ceil(labs.length / PAGE_SIZE));
    genPage = Math.min(genPage, totalPages - 1);
    const pageLabs = labs.slice(genPage * PAGE_SIZE, genPage * PAGE_SIZE + PAGE_SIZE);

    // l.title/l.brief may originate from the local LLM's text response
    // (see src/services/labFlavorGenerator.ts) — treat as untrusted and escape.
    grid.innerHTML = pageLabs
      .map(
        (l) => `
        <div class="gen-lab-card" data-id="${l.id}"
             style="background:#1b1f24;border:1px solid #2d343d;border-radius:8px;padding:14px 16px;cursor:pointer;transition:border-color 0.15s,transform 0.1s;">
          <div style="color:#4ec9b0;font-size:13px;font-weight:700;margin-bottom:4px;">${escapeHtml(l.title)}</div>
          <div style="color:#8b95a1;font-size:12px;line-height:1.5;">${escapeHtml(l.brief)}</div>
        </div>
      `,
      )
      .join('');

    for (const card of grid.querySelectorAll('.gen-lab-card')) {
      card.addEventListener('mouseenter', () => {
        (card as HTMLElement).style.borderColor = '#4ec9b0';
      });
      card.addEventListener('mouseleave', () => {
        (card as HTMLElement).style.borderColor = '#2d343d';
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

    pager.style.display = totalPages > 1 ? 'flex' : 'none';
    pageLabel.textContent = `Page ${genPage + 1} of ${totalPages}`;
  }

  renderGeneratedGrid();

  overlay.querySelector('#ss-gen-prev')?.addEventListener('click', () => {
    genPage = Math.max(0, genPage - 1);
    renderGeneratedGrid();
  });
  overlay.querySelector('#ss-gen-next')?.addEventListener('click', () => {
    genPage += 1;
    renderGeneratedGrid();
  });
  overlay.querySelector('#ss-generate')?.addEventListener('click', async () => {
    const btn = overlay.querySelector('#ss-generate') as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = 'Generating…';
    try {
      await generatedLabsStore.getState().generateBatch(10);
      genPage = Math.ceil(generatedLabsStore.getState().labs.length / PAGE_SIZE) - 1;
      renderGeneratedGrid();
      showToast('10 new daily tickets generated.', { kind: 'success' });
    } catch {
      showToast('Could not generate new tickets. Try again.', { kind: 'error' });
    } finally {
      btn.disabled = false;
      btn.textContent = '🤖 Generate 10 More';
    }
  });

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

  // ── Batch (multi-ticket queue) grid ───────────────────────────────────────────
  const BATCH_PAGE_SIZE = 6;
  let batchPage = 0;

  function renderBatchGrid(): void {
    const grid = overlay.querySelector('#ss-batch-grid') as HTMLElement;
    const pager = overlay.querySelector('#ss-batch-pager') as HTMLElement;
    const pageLabel = overlay.querySelector('#ss-batch-page-label') as HTMLElement;
    // Only show labs that are actual multi-ticket queue labs (10+ steps / tickets).
    // Single-ticket generated labs go in the regular section instead.
    const labs = generatedLabsStore.getState().labs.filter((l) => l.steps.length >= 10);

    if (labs.length === 0) {
      // Show the template cards as placeholder when no batch labs generated yet
      grid.innerHTML = BATCH_TEMPLATES.map(
        (bt) => `
        <div class="batch-template-card" data-batch-id="${bt.id}"
             style="background:#1b1f24;border:1px solid #2d343d;border-radius:8px;padding:14px 16px;cursor:pointer;transition:border-color 0.15s,transform 0.1s;">
          <div style="color:#fbbf24;font-size:13px;font-weight:700;margin-bottom:4px;">${escapeHtml(bt.label)}</div>
          <div style="color:#8b95a1;font-size:11px;line-height:1.4;">
            ${bt.ticketCount} pre-seeded tickets · click to generate and start
          </div>
        </div>
      `,
      ).join('');
      pager.style.display = 'none';
      // Wire template card clicks
      for (const card of grid.querySelectorAll('.batch-template-card')) {
        card.addEventListener('mouseenter', () => {
          (card as HTMLElement).style.borderColor = '#fbbf24';
        });
        card.addEventListener('mouseleave', () => {
          (card as HTMLElement).style.borderColor = '#2d343d';
        });
        card.addEventListener('click', async () => {
          const batchId = (card as HTMLElement).dataset['batchId']!;
          (card as HTMLElement).style.pointerEvents = 'none';
          const originalHtml = (card as HTMLElement).innerHTML;
          (card as HTMLElement).innerHTML =
            '<div style="color:#8b95a1;font-size:12px;">Generating…</div>';
          try {
            const newLab = await generatedLabsStore.getState().generateBatchLab(batchId);
            overlay.style.opacity = '0';
            overlay.style.transition = 'opacity 0.3s';
            setTimeout(() => {
              overlay.remove();
              onStart(newLab.id);
            }, 300);
          } catch {
            (card as HTMLElement).innerHTML = originalHtml;
            (card as HTMLElement).style.pointerEvents = 'auto';
            showToast('Could not generate batch lab. Try again.', { kind: 'error' });
          }
        });
      }
      return;
    }

    const totalPages = Math.max(1, Math.ceil(labs.length / BATCH_PAGE_SIZE));
    batchPage = Math.min(batchPage, totalPages - 1);
    const pageLabs = labs.slice(
      batchPage * BATCH_PAGE_SIZE,
      batchPage * BATCH_PAGE_SIZE + BATCH_PAGE_SIZE,
    );

    grid.innerHTML = pageLabs
      .map(
        (l) => `
        <div class="batch-lab-card" data-id="${l.id}"
             style="background:#1b1f24;border:1px solid #2d343d;border-radius:8px;padding:14px 16px;cursor:pointer;transition:border-color 0.15s,transform 0.1s;">
          <div style="color:#fbbf24;font-size:13px;font-weight:700;margin-bottom:4px;">${escapeHtml(l.title)}</div>
          <div style="color:#8b95a1;font-size:11px;line-height:1.4;margin-bottom:6px;">${l.steps.length} tickets</div>
          <div style="color:#8b95a1;font-size:11px;line-height:1.4;">${escapeHtml(l.brief)}</div>
        </div>
      `,
      )
      .join('');

    for (const card of grid.querySelectorAll('.batch-lab-card')) {
      card.addEventListener('mouseenter', () => {
        (card as HTMLElement).style.borderColor = '#fbbf24';
      });
      card.addEventListener('mouseleave', () => {
        (card as HTMLElement).style.borderColor = '#2d343d';
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

    pager.style.display = totalPages > 1 ? 'flex' : 'none';
    pageLabel.textContent = `Page ${batchPage + 1} of ${totalPages}`;
  }

  renderBatchGrid();

  overlay.querySelector('#ss-batch-prev')?.addEventListener('click', () => {
    batchPage = Math.max(0, batchPage - 1);
    renderBatchGrid();
  });
  overlay.querySelector('#ss-batch-next')?.addEventListener('click', () => {
    batchPage += 1;
    renderBatchGrid();
  });
  overlay.querySelector('#ss-generate-batches')?.addEventListener('click', async () => {
    const btn = overlay.querySelector('#ss-generate-batches') as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = 'Generating…';
    try {
      await generatedLabsStore.getState().generateAllBatches();
      batchPage = Math.ceil(generatedLabsStore.getState().labs.length / BATCH_PAGE_SIZE) - 1;
      renderBatchGrid();
      showToast('3 multi-ticket queue labs generated.', { kind: 'success' });
    } catch {
      showToast('Could not generate batch labs. Try again.', { kind: 'error' });
    } finally {
      btn.disabled = false;
      btn.textContent = '🤖 Generate 3 More';
    }
  });

  // Close button (top-right) — returns to the 3D scene
  overlay.querySelector('#ss-close')?.addEventListener('click', () => dismiss());

  // Tutorial button
  overlay.querySelector('#ss-tutorial')?.addEventListener('click', () => {
    dismiss();
    showTutorial();
  });

  // Auto-trigger tutorial on first visit
  if (!isTutorialComplete()) {
    setTimeout(() => {
      dismiss();
      showTutorial();
    }, 500);
  }

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
