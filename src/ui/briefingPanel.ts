/**
 * ui/briefingPanel.ts — left-side panel showing the current step's brief,
 * objectives, and tutor prompts.
 */
import { labStore } from '@/stores';
import type { ValidatorKind } from '@/domain';

const VALIDATOR_LABELS: Record<ValidatorKind, string> = {
  'ticket-resolved':        'Resolve the ticket in the Ticket Console',
  'user-disabled':          'Disable the user account in IAM Console',
  'user-enabled':           'Unlock / re-enable the user in IAM Console',
  'user-created':           'Create the user in IAM Console',
  'user-moved':             'Move the user to the new group',
  'group-added':            'Create the security group in IAM Console',
  'group-removed':          'Remove the user from the group',
  'role-granted':           'Grant the role to the user',
  'role-revoked':           'Revoke the role from the user',
  'app-config-fixed':       'Fix the application configuration',
  'signin-succeeded':       'Sign in as the user in IAM Console',
  'mfa-challenge-completed':'Complete an MFA challenge',
  'session-revoked':        'Revoke the user session',
  'fault-cleared':         'Clear the injected fault',
  'evidence-collected':     'Capture evidence for this step',
  'audit-note-written':     'Write a note in the audit log',
  'review-decisions-recorded':'Record access review decisions',
};

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

    // The "what unlocks the next step" label comes from the validator kind.
    const unlockLabel = VALIDATOR_LABELS[step.validator.kind] ?? `Complete validator: ${step.validator.kind}`;
    const unlockParams = step.validator.params as Record<string, string>;
    const unlockDetail = unlockParams.userId
      ? ` (user: ${unlockParams.userId})`
      : unlockParams.groupId
        ? ` (group: ${unlockParams.groupId})`
        : unlockParams.ticketId
          ? ` (ticket: ${unlockParams.ticketId})`
          : unlockParams.appId
            ? ` (app: ${unlockParams.appId})`
            : '';

    // Evidence to capture this step (so users know what to take a screenshot of).
    const evidenceList = step.evidence.length > 0
      ? step.evidence.map((e) => {
          const how = e.capture === 'auto' ? 'auto-captured' : 'capture manually';
          return `<li style="margin:2px 0;">${e.kind} — <span style="color:var(--muted);">${how}</span></li>`;
        }).join('')
      : '<li style="color:var(--muted);">No specific evidence required.</li>';

    const isStepDone = status === 'done';

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
          <div style="color:var(--accent);font-size:10px;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">What unlocks the next step</div>
          <div style="background:var(--panel-2);border-left:3px solid var(--accent);padding:8px 10px;border-radius:0 4px 4px 0;font-size:12px;color:var(--fg);line-height:1.4;">
            <strong>${unlockLabel}</strong>${unlockDetail}
          </div>
        </div>

        <div style="margin-top:14px;">
          <div style="color:var(--accent);font-size:10px;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">Evidence to capture</div>
          <ul style="margin:0;padding-left:20px;color:var(--muted);font-size:12px;line-height:1.5;">${evidenceList}</ul>
        </div>

        <div style="margin-top:14px;">
          <div style="color:var(--accent);font-size:10px;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">Lab Objectives</div>
          <ul style="margin:0;padding-left:20px;color:var(--muted);font-size:12px;line-height:1.6;">
            ${lab.objectives.map((o) => `<li>${o.description} <span style="color:var(--accent);">(${o.points}pt)</span></li>`).join('')}
          </ul>
        </div>

        <div style="margin-top:14px;background:rgba(78,201,176,0.05);border:1px solid var(--accent);border-radius:6px;padding:10px 12px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <div>
              <div style="color:var(--accent);font-size:10px;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:2px;">🤖 AI Tutor</div>
              <div style="color:var(--muted);font-size:11px;">${step.tutorPrompts.length > 0 ? 'Ask me anything — I\'m watching your audit log.' : 'Open the AI Supervisor to get coaching for this step.'}</div>
            </div>
            <button id="bp-open-tutor"
              style="background:var(--accent);color:var(--bg);border:none;border-radius:5px;padding:6px 12px;font-size:11px;cursor:pointer;font-weight:700;white-space:nowrap;">
              Open tutor
            </button>
          </div>
          ${step.tutorPrompts.length > 0 ? `
            <div style="color:var(--muted);font-size:12px;font-style:italic;border-top:1px solid rgba(78,201,176,0.2);padding-top:6px;margin-top:4px;">
              <strong style="color:var(--fg);font-style:normal;">Coaching focus:</strong> ${step.tutorPrompts[0]}
            </div>
          ` : ''}
        </div>

        <div style="margin-top:14px;display:flex;gap:8px;">
          <button id="briefing-prev" style="flex:1;background:var(--panel-2);color:var(--muted);border:1px solid var(--border);border-radius:4px;padding:6px;font-size:12px;cursor:pointer;">Reset lab</button>
          <button id="briefing-next" style="flex:1;background:${isStepDone ? 'var(--accent)' : 'var(--panel-2)'};color:${isStepDone ? 'var(--bg)' : 'var(--muted)'};border:1px solid ${isStepDone ? 'var(--accent)' : 'var(--border)'};border-radius:4px;padding:6px;font-size:12px;cursor:${isStepDone ? 'pointer' : 'not-allowed'};font-weight:600;">${isStepDone ? 'Advance →' : 'Locked'}</button>
        </div>
        <div id="briefing-hint" style="margin-top:8px;padding:6px 8px;font-size:11px;color:${isStepDone ? 'var(--accent)' : 'var(--warn)'};background:${isStepDone ? 'rgba(78,201,176,0.08)' : 'rgba(255,184,108,0.08)'};border-left:2px solid ${isStepDone ? 'var(--accent)' : 'var(--warn)'};border-radius:0 4px 4px 0;line-height:1.4;">
          ${isStepDone
            ? 'Step complete — click <strong>Advance →</strong> to move on.'
            : `<strong>${unlockLabel}${unlockDetail}</strong> — once the conductor observes this action, the step auto-completes.`}
        </div>
      </div>
    `;

    // "Next" — attempt to advance to the next step. The conductor still owns
    // progression, so this is a hint to the user that objectives must be met.
    // When the user clicks it, surface the unsatisfied validator so they know
    // what's still missing. Real advance happens via the conductor when the
    // validator passes (see Conductor.handleEvent → bus.emit('lab.advance')).
    panel.querySelector('#briefing-next')?.addEventListener('click', () => {
      const lab2 = labStore.getState().current;
      const idx = labStore.getState().stepIndex;
      if (!lab2 || !lab2.steps[idx]) return;
      const step = lab2.steps[idx]!;
      const statuses = labStore.getState().stepStatuses;
      if (statuses[step.id] === 'done') {
        // Already passed — let the conductor move us forward.
        (window as unknown as { __lab: { conductor: { forceAdvance(): void } } }).__lab.conductor.forceAdvance();
        return;
      }
      // Show what's missing so the user understands why they're stuck.
      const hint = document.getElementById('briefing-hint');
      if (hint) {
        hint.textContent = `Not yet — finish the objectives in the current step (${step.title}) before advancing. The next button will auto-activate once the validator passes.`;
        hint.style.color = 'var(--warn)';
      }
    });
    panel.querySelector('#briefing-prev')?.addEventListener('click', () => {
      const lab2 = labStore.getState().current;
      if (lab2) (window as unknown as { __lab: { start(id: string): void } }).__lab.start(`lab${String(lab2.number).padStart(2, '0')}`);
    });
    panel.querySelector('#bp-open-tutor')?.addEventListener('click', () => {
      const __lab = (window as unknown as { __lab?: {
        desktop?: { openWindow(id: string, c: unknown): void };
        conductor?: unknown;
      } }).__lab;
      if (!__lab?.desktop) return;
      const c = __lab.conductor;
      if (!c) return;
      __lab.desktop.openWindow('ollama-console', c);
    });
  };

  labStore.subscribe(render);
  return panel;
}
