/**
 * ui/tutorPanel.ts — floating tutor bubble.
 * Shows the current hint level for the active step, with a button to reveal
 * the next hint. The "Explain it" button switches to explanation mode and
 * reveals the full solution immediately.
 */
import { labStore, tutorStore } from '@/stores';
import { getHint } from '@/tutor/hintLadder';

export function initTutorPanel() {
  const panel = document.createElement('div');
  panel.id = 'tutor-panel';
  panel.style.cssText = `
    position: fixed; right: 24px; bottom: 60px; width: 320px;
    background: var(--panel); border: 1px solid var(--border); border-radius: 6px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.5);
    padding: 12px 14px; z-index: 25; display: none;
    font-size: 12px;
  `;
  document.body.appendChild(panel);

  const render = () => {
    const lab = labStore.getState().current;
    const idx = labStore.getState().stepIndex;
    if (!lab || !lab.steps[idx]) { panel.style.display = 'none'; return; }
    panel.style.display = 'block';

    const step = lab.steps[idx]!;
    const hintLevel = tutorStore.getState().hintLevel;
    const explainMode = tutorStore.getState().explanationMode;
    const text = getHint(lab.id, step.id, explainMode ? 3 : hintLevel);

    const levels = ['Nudge', 'Question', 'Approach', 'Solution'];
    const dots = [0, 1, 2, 3].map((i) =>
      `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;margin:0 2px;background:${i <= hintLevel ? 'var(--accent)' : 'var(--border)'};"></span>`
    ).join('');

    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;">
        <strong style="color:var(--accent);">AI Tutor</strong>
        <span style="font-size:10px;color:var(--muted);letter-spacing:0.05em;">${levels[hintLevel] ?? 'Nudge'} ${dots}</span>
      </div>
      <div style="color:var(--fg);line-height:1.5;margin-bottom:10px;min-height:48px;">${text}</div>
      <div style="display:flex;gap:6px;">
        <button id="tutor-next"
                style="flex:1;background:var(--accent);color:var(--bg);border:none;border-radius:4px;padding:5px 10px;font-size:11px;cursor:pointer;font-weight:600;">
          ${hintLevel >= 3 ? 'Reset to nudge' : 'Show next hint'}
        </button>
        <button id="tutor-explain"
                style="background:${explainMode ? 'var(--accent)' : 'transparent'};color:${explainMode ? 'var(--bg)' : 'var(--muted)'};border:1px solid ${explainMode ? 'var(--accent)' : 'var(--border)'};border-radius:4px;padding:5px 10px;font-size:11px;cursor:pointer;">
          ${explainMode ? '✓ Explanation' : 'Explain it'}
        </button>
      </div>
    `;

    panel.querySelector('#tutor-next')?.addEventListener('click', () => {
      if (hintLevel >= 3) {
        tutorStore.getState().setHintLevel(0);
        tutorStore.getState().setExplanationMode(false);
      } else {
        tutorStore.getState().bumpHint();
      }
    });
    panel.querySelector('#tutor-explain')?.addEventListener('click', () => {
      tutorStore.getState().setExplanationMode(!explainMode);
    });
  };

  labStore.subscribe(render);
  tutorStore.subscribe(render);
  return panel;
}
