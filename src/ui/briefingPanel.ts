/**
 * ui/briefingPanel.ts — left-side panel showing the current step's brief,
 * objectives, and tutor prompts.
 */
import { labStore } from '@/stores';

export function initBriefingPanel() {
  const panel = document.createElement('div');
  panel.id = 'briefing-panel';
  panel.style.cssText = `
    position: fixed; left: 24px; top: 60px; width: 360px;
    background: var(--panel); border: 1px solid var(--border); border-radius: 6px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.6);
    display: none; flex-direction: column; z-index: 20;
    font-size: 13px; max-height: calc(100vh - 120px);
  `;
  document.body.appendChild(panel);

  const render = () => {
    const lab = labStore.getState().current;
    const idx = labStore.getState().stepIndex;
    if (!lab) { panel.style.display = 'none'; return; }
    panel.style.display = 'flex';

    const step = lab.steps[idx];
    if (!step) { panel.style.display = 'none'; return; }

    const status = labStore.getState().stepStatuses[step.id] ?? 'pending';
    const statusColor = status === 'done' ? 'var(--accent)' : status === 'in-progress' ? 'var(--warn)' : 'var(--muted)';
    const statusLabel = status === 'done' ? '✓ DONE' : status === 'in-progress' ? 'IN PROGRESS' : 'PENDING';

    panel.innerHTML = `
      <div style="padding:12px 14px;border-bottom:1px solid var(--border);background:var(--panel-2);border-radius:6px 6px 0 0;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <strong style="color:var(--accent);">${lab.title}</strong>
          <span style="font-size:10px;letter-spacing:0.1em;color:${statusColor};">${statusLabel}</span>
        </div>
        <div style="color:var(--muted);font-size:11px;margin-top:2px;">Step ${idx + 1} / ${lab.steps.length}</div>
      </div>
      <div style="padding:14px;overflow-y:auto;flex:1;">
        <h3 style="margin:0 0 6px 0;font-size:14px;color:var(--fg);">${step.title}</h3>
        <p style="color:var(--muted);margin:0 0 12px 0;line-height:1.5;font-size:12px;">${step.brief}</p>

        <div style="margin-top:14px;">
          <div style="color:var(--accent);font-size:10px;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">Objectives</div>
          <ul style="margin:0;padding-left:20px;color:var(--muted);font-size:12px;line-height:1.6;">
            ${lab.objectives.map((o) => `<li>${o.description} <span style="color:var(--accent);">(${o.points}pt)</span></li>`).join('')}
          </ul>
        </div>

        ${step.tutorPrompts.length > 0 ? `
          <div style="margin-top:14px;background:var(--panel-2);border-left:3px solid var(--accent);padding:8px 10px;border-radius:0 4px 4px 0;">
            <div style="color:var(--accent);font-size:10px;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px;">AI Tutor</div>
            <div style="color:var(--muted);font-size:12px;font-style:italic;">${step.tutorPrompts[0]}</div>
          </div>
        ` : ''}

        <div style="margin-top:14px;display:flex;gap:8px;">
          <button id="briefing-prev" style="flex:1;background:var(--panel-2);color:var(--muted);border:1px solid var(--border);border-radius:4px;padding:6px;font-size:12px;cursor:pointer;">Reset lab</button>
          <button id="briefing-reset" style="flex:1;background:var(--accent);color:var(--bg);border:none;border-radius:4px;padding:6px;font-size:12px;cursor:pointer;font-weight:600;">Next</button>
        </div>
      </div>
    `;

    panel.querySelector('#briefing-reset')?.addEventListener('click', () => {
      const lab2 = labStore.getState().current;
      if (lab2) (window as unknown as { __lab: { start(id: string): void } }).__lab.start(`lab${String(lab2.number).padStart(2, '0')}`);
    });
    panel.querySelector('#briefing-prev')?.addEventListener('click', () => {
      const lab2 = labStore.getState().current;
      if (lab2) (window as unknown as { __lab: { start(id: string): void } }).__lab.start(`lab${String(lab2.number).padStart(2, '0')}`);
    });
  };

  labStore.subscribe(render);
  return panel;
}
