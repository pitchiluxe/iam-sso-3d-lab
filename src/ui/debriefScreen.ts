/**
 * ui/debriefScreen.ts — lab completion screen.
 * Shown when the score store gets a non-null current score.
 * Displays the score breakdown, a pass/fail banner, and the debrief questions.
 */
import { chime } from './audio';
import { scoreStore, labStore } from '@/stores';

export function initDebriefScreen() {
  const overlay = document.createElement('div');
  overlay.id = 'debrief-screen';
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(14,17,22,0.95);z-index:90;
    display:none;flex-direction:column;align-items:center;padding:40px 20px;overflow-y:auto;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  `;
  document.body.appendChild(overlay);

  let currentScore: import('@/domain').ScoreBreakdown | null = null;

  const render = () => {
    const score = scoreStore.getState().current;
    const lab = labStore.getState().current;
    if (!score || !lab) {
      overlay.style.display = 'none';
      return;
    }
    const isFirst = currentScore === null;
    if (currentScore?.total === score.total) return; // already showing
    currentScore = score;
    if (isFirst) chime();

    const passed = score.total >= 85;
    const bannerColor = passed ? '#4ec9b0' : '#d7ba7d';
    const bannerBg = passed ? 'rgba(78,201,176,0.1)' : 'rgba(215,186,125,0.1)';

    overlay.style.display = 'flex';
    overlay.innerHTML = `
      <div style="max-width:640px;width:100%;">
        <div style="text-align:center;margin-bottom:32px;">
          <div style="color:${bannerColor};font-size:11px;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:8px;">
            ${passed ? 'PASSED · Capstone threshold: 85' : 'INCOMPLETE · Target: 85/100'}
          </div>
          <h1 style="color:#e6e6e6;font-size:36px;font-weight:700;margin:0 0 8px;">
            ${score.total}<span style="font-size:20px;color:#8b95a1;"> / 100</span>
          </h1>
          <div style="color:#8b95a1;font-size:14px;">${lab.title}</div>
        </div>

        <!-- Score breakdown -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:24px;">
          ${([
            ['Technical Execution', score.exec, 25],
            ['Troubleshooting', score.troubleshoot, 20],
            ['Least Privilege', score['least-privilege'], 15],
            ['Documentation', score.docs, 15],
            ['Evidence & Verification', score.evidence, 15],
            ['Communication', score.comms, 10],
          ] as Array<[string, number, number]>).map(([label, earned, max]) => `
            <div style="background:#1b1f24;border:1px solid #2d343d;border-radius:6px;padding:10px 14px;">
              <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;">
                <span style="color:#8b95a1;font-size:12px;">${label}</span>
                <span style="color:#4ec9b0;font-size:13px;font-weight:600;">${earned}<span style="font-size:11px;color:#8b95a1;">/${max}</span></span>
              </div>
              <div style="height:4px;background:#2d343d;border-radius:2px;">
                <div style="height:4px;width:${Math.round((earned / max) * 100)}%;background:#4ec9b0;border-radius:2px;"></div>
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Debrief questions -->
        <div style="background:#1b1f24;border:1px solid #2d343d;border-radius:8px;padding:20px;margin-bottom:24px;">
          <h2 style="color:#4ec9b0;font-size:14px;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 16px;">
            Debrief Questions
          </h2>
          <ol style="margin:0;padding-left:24px;color:#8b95a1;font-size:13px;line-height:2;">
            ${lab.debriefQuestions.map((q) => `<li style="margin-bottom:8px;">${q}</li>`).join('')}
          </ol>
          <div style="margin-top:14px;padding:10px 12px;background:rgba(78,201,176,0.05);border-left:3px solid #4ec9b0;border-radius:0 4px 4px 0;font-size:12px;color:#8b95a1;">
            These questions are designed for discussion or interview preparation.
            The debrief screen in the full product will support guided answers.
          </div>
        </div>

        <!-- Actions -->
        <div style="display:flex;gap:12px;justify-content:center;">
          <button id="debrief-restart"
                  style="background:#1b1f24;color:#8b95a1;border:1px solid #2d343d;border-radius:6px;padding:10px 20px;font-size:13px;cursor:pointer;">
            Retry this lab
          </button>
          <button id="debrief-next"
                  style="background:#4ec9b0;color:#0e1116;border:none;border-radius:6px;padding:10px 20px;font-size:13px;cursor:pointer;font-weight:600;">
            Next lab →
          </button>
          <button id="debrief-close"
                  style="background:transparent;color:#8b95a1;border:1px solid #2d343d;border-radius:6px;padding:10px 20px;font-size:13px;cursor:pointer;">
            Continue free-roam
          </button>
        </div>
      </div>
    `;

    overlay.querySelector('#debrief-restart')?.addEventListener('click', () => {
      overlay.style.display = 'none';
      currentScore = null;
      if (lab) (window as unknown as { __lab: { start(id: string): void } }).__lab.start(`lab${String(lab.number).padStart(2, '0')}`);
    });
    overlay.querySelector('#debrief-next')?.addEventListener('click', () => {
      overlay.style.display = 'none';
      currentScore = null;
      const next = lab.number + 1;
      if (next <= 10) (window as unknown as { __lab: { start(id: string): void } }).__lab.start(`lab${String(next).padStart(2, '0')}`);
    });
    overlay.querySelector('#debrief-close')?.addEventListener('click', () => {
      overlay.style.display = 'none';
      currentScore = null;
    });
  };

  scoreStore.subscribe(render);
  labStore.subscribe(render);
}
