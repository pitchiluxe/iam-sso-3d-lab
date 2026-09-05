/**
 * ui/tutorialOverlay.ts — first-time user onboarding tour.
 *
 * Shows a step-by-step overlay explaining the core UI: the start menu, the
 * HUD, consoles, ticket queue, and score. Skipping persists so it never
 * appears again; the user can re-trigger it from the start screen.
 */

const TUTORIAL_KEY = 'tutorial_completed_v1';

export interface TutorialStep {
  /** CSS selector of the element to highlight (or null for centered). */
  target: string | null;
  emoji: string;
  title: string;
  body: string;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    target: '#hud',
    emoji: '🎓',
    title: 'Welcome to the IAM & SSO 3D Lab',
    body: 'This HUD shows your current lab, step, zone, and score at all times. Take a moment to look around — every zone is a real identity ops room you can walk through.',
  },
  {
    target: null,
    emoji: '🖥️',
    title: 'Consoles are interactive workstations',
    body: 'Walk up to any glowing console and press E to activate it. Each console lets you perform the actions that the lab is asking you to perform — provision users, manage groups, or triage tickets.',
  },
  {
    target: null,
    emoji: '🎫',
    title: 'Tickets arrive in the queue',
    body: 'Onboarding, MFA resets, terminations — every real-world identity request becomes a ticket. Your job is to triage them, prioritize them, and resolve them in the order that matches the lab scenario.',
  },
  {
    target: null,
    emoji: '🤖',
    title: 'Your AI tutor never solves the lab',
    body: 'When you get stuck, the tutor panel on the right nudges you with Socratic questions — "What would you check first?" rather than "Do X then Y." You can request a stronger hint as you go, but the answer is yours to find.',
  },
  {
    target: null,
    emoji: '🏆',
    title: 'Earn badges and grow your score',
    body: 'Every completed lab tracks your best score. Earn achievements for first tickets, perfect scores, speed runs, and completing all 13 labs. Export your progress any time to back it up.',
  },
];

let currentOverlay: HTMLDivElement | null = null;

export function isTutorialComplete(): boolean {
  try {
    return localStorage.getItem(TUTORIAL_KEY) === 'true';
  } catch {
    return false;
  }
}

export function markTutorialComplete(): void {
  try {
    localStorage.setItem(TUTORIAL_KEY, 'true');
  } catch {
    /* ignore */
  }
}

export function resetTutorial(): void {
  try {
    localStorage.removeItem(TUTORIAL_KEY);
  } catch {
    /* ignore */
  }
}

/** Show the tutorial overlay. Calls onDone when finished or skipped. */
export function showTutorial(onDone?: () => void): void {
  if (currentOverlay) currentOverlay.remove();
  let stepIndex = 0;

  const overlay = document.createElement('div');
  overlay.id = 'tutorial-overlay';
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 200;
    background: rgba(0,0,0,0.78);
    display: flex; align-items: center; justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  `;
  currentOverlay = overlay;

  let spotlight: HTMLDivElement | null = null;

  function positionSpotlight(target: string | null) {
    if (spotlight) {
      spotlight.remove();
      spotlight = null;
    }
    if (!target) return;
    const el = document.querySelector(target) as HTMLElement | null;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    spotlight = document.createElement('div');
    spotlight.style.cssText = `
      position: fixed;
      left: ${rect.left - 8}px; top: ${rect.top - 8}px;
      width: ${rect.width + 16}px; height: ${rect.height + 16}px;
      border: 2px solid #4ec9b0;
      border-radius: 8px;
      box-shadow: 0 0 0 9999px rgba(0,0,0,0.5);
      pointer-events: none;
      transition: all 0.3s ease;
    `;
    document.body.appendChild(spotlight);
  }

  function render() {
    const step = TUTORIAL_STEPS[stepIndex]!;
    overlay.innerHTML = `
      <div style="max-width:520px;width:90%;background:#1b1f24;border:1px solid #2d343d;border-radius:12px;padding:28px 32px;color:#e6e6e6;">
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px;">
          <div style="font-size:36px;">${step.emoji}</div>
          <div>
            <div style="font-size:11px;color:#8b95a1;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px;">Step ${stepIndex + 1} of ${TUTORIAL_STEPS.length}</div>
            <h2 style="font-size:18px;margin:0;color:#4ec9b0;">${step.title}</h2>
          </div>
        </div>
        <p style="color:#c8cdd3;font-size:14px;line-height:1.6;margin:0 0 24px;">${step.body}</p>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <button id="tut-skip" style="background:transparent;color:#8b95a1;border:none;padding:8px 12px;font-size:12px;cursor:pointer;">Skip tutorial</button>
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="display:flex;gap:4px;">
              ${TUTORIAL_STEPS.map(
                (_, i) =>
                  `<div style="width:6px;height:6px;border-radius:50%;background:${i === stepIndex ? '#4ec9b0' : '#2d343d'};"></div>`,
              ).join('')}
            </div>
            <button id="tut-back" style="background:#1b1f24;color:#8b95a1;border:1px solid #2d343d;border-radius:6px;padding:8px 16px;font-size:13px;cursor:pointer;${
              stepIndex === 0 ? 'opacity:0.4;pointer-events:none;' : ''
            }">← Back</button>
            <button id="tut-next" style="background:#4ec9b0;color:#0e1116;border:none;border-radius:6px;padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer;">${
              stepIndex === TUTORIAL_STEPS.length - 1 ? "I'm ready ✓" : 'Next →'
            }</button>
          </div>
        </div>
      </div>
    `;

    positionSpotlight(step.target);

    overlay.querySelector('#tut-skip')?.addEventListener('click', () => {
      markTutorialComplete();
      finish();
    });
    overlay.querySelector('#tut-back')?.addEventListener('click', () => {
      if (stepIndex > 0) {
        stepIndex--;
        render();
      }
    });
    overlay.querySelector('#tut-next')?.addEventListener('click', () => {
      if (stepIndex < TUTORIAL_STEPS.length - 1) {
        stepIndex++;
        render();
      } else {
        markTutorialComplete();
        finish();
      }
    });
  }

  function finish() {
    if (spotlight) {
      spotlight.remove();
      spotlight = null;
    }
    if (currentOverlay) {
      currentOverlay.remove();
      currentOverlay = null;
    }
    onDone?.();
  }

  // Click on backdrop advances to next step (but not through spotlight)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      const next = overlay.querySelector('#tut-next') as HTMLButtonElement | null;
      next?.click();
    }
  });

  document.body.appendChild(overlay);
  render();
}
