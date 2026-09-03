/**
 * ui/consoles/objectivesWindow.ts — VM Objectives window.
 *
 * Displays the current lab's objectives, current step details, evidence
 * requirements, and the "Open VM & Tutor" button. Lives inside the
 * desktop overlay VM. Updates live as the user advances through steps.
 */
import { labStore } from '@/stores';
import type { Conductor } from '@/conductor/conductor';
import type { ValidatorKind } from '@/domain';

const VALIDATOR_LABELS: Record<ValidatorKind, string> = {
  'ticket-resolved':         'Resolve the ticket in the Ticket Console',
  'user-disabled':           'Disable the user account in IAM Console',
  'user-enabled':            'Unlock / re-enable the user in IAM Console',
  'user-created':            'Create the user in IAM Console',
  'user-moved':             'Move the user to the new group',
  'group-added':            'Create the security group in IAM Console',
  'group-removed':          'Remove the user from the group',
  'role-granted':           'Grant the role to the user',
  'role-revoked':           'Revoke the role from the user',
  'app-config-fixed':        'Fix the application configuration',
  'signin-succeeded':       'Sign in as the user in IAM Console',
  'mfa-challenge-completed':'Complete an MFA challenge',
  'session-revoked':        'Revoke the user session',
  'fault-cleared':         'Clear the injected fault',
  'evidence-collected':     'Capture evidence for this step',
  'audit-note-written':     'Write a note in the audit log',
  'review-decisions-recorded':'Record access review decisions',
};

export function renderObjectivesWindow(body: HTMLElement, conductor: Conductor): void {
  // Use a container that fills the body
  const container = document.createElement('div');
  container.style.cssText = `
    display: flex; flex-direction: column; height: 100%;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI Variable', 'Segoe UI', sans-serif;
    font-size: 12px; color: #c8cdd3; overflow: hidden;
  `;
  body.appendChild(container);

  function render(): void {
    const lab = labStore.getState().current;
    const idx = labStore.getState().stepIndex;
    if (!lab || !lab.steps[idx]) {
      container.innerHTML = `
        <div style="padding:24px;text-align:center;color:#8b95a1;">
          <div style="font-size:32px;margin-bottom:8px;">📋</div>
          <div style="font-size:13px;">No active lab. Return to the 3D scene and start a lab.</div>
        </div>
      `;
      return;
    }

    const step = lab.steps[idx]!;
    const status = labStore.getState().stepStatuses[step.id] ?? 'pending';
    const statusColor = status === 'done' ? '#4ec9b0' : status === 'in-progress' ? '#d7ba7d' : '#8b95a1';
    const statusLabel = status === 'done' ? '✓ DONE' : status === 'in-progress' ? 'IN PROGRESS' : 'PENDING';
    const isStepDone = status === 'done';

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

    const evidenceList = step.evidence.length > 0
      ? step.evidence.map((e) => {
          const how = e.capture === 'auto' ? 'auto-captured' : 'capture manually';
          return `<li style="margin:2px 0;">${e.kind} — <span style="color:#8b95a1;">${how}</span></li>`;
        }).join('')
      : '<li style="color:#8b95a1;">No specific evidence required.</li>';

    const tutoring = step.tutorPrompts.length > 0
      ? `<div style="margin-top:8px;padding:8px 10px;background:rgba(78,201,176,0.06);border:1px solid rgba(78,201,176,0.25);border-radius:6px;">
           <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#4ec9b0;margin-bottom:4px;">🤖 Coaching Focus</div>
           <div style="font-size:11px;font-style:italic;color:#8b95a1;">${step.tutorPrompts[0]}</div>
         </div>`
      : '';

    container.innerHTML = `
      <div style="padding:10px 14px;border-bottom:1px solid #2d343d;background:#1b1f24;flex-shrink:0;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <strong style="color:#4ec9b0;font-size:13px;">${lab.title}</strong>
          <span style="font-size:10px;letter-spacing:0.1em;color:${statusColor};">${statusLabel}</span>
        </div>
        <div style="color:#8b95a1;font-size:10px;margin-top:2px;">Step ${idx + 1} / ${lab.steps.length}</div>
      </div>

      <div style="flex:1;overflow-y:auto;padding:12px;">

        <h3 style="margin:0 0 6px 0;font-size:13px;color:#e6e6e6;">${step.title}</h3>
        <p style="color:#8b95a1;margin:0 0 12px 0;line-height:1.5;">${step.brief}</p>

        <div style="margin-bottom:10px;">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#4ec9b0;margin-bottom:5px;">What unlocks the next step</div>
          <div style="background:#1b1f24;border-left:3px solid #4ec9b0;padding:7px 10px;border-radius:0 4px 4px 0;font-size:11px;color:#c8cdd3;line-height:1.4;">
            <strong>${unlockLabel}</strong>${unlockDetail}
          </div>
        </div>

        <div style="margin-bottom:10px;">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#4ec9b0;margin-bottom:5px;">Evidence to capture</div>
          <ul style="margin:0;padding-left:18px;color:#8b95a1;font-size:11px;line-height:1.5;">${evidenceList}</ul>
        </div>

        <div style="margin-bottom:10px;">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#4ec9b0;margin-bottom:5px;">Lab Objectives</div>
          <ul style="margin:0;padding-left:18px;color:#8b95a1;font-size:11px;line-height:1.6;">
            ${lab.objectives.map((o) => `<li>${o.description} <span style="color:#4ec9b0;">(${o.points}pt)</span></li>`).join('')}
          </ul>
        </div>

        ${tutoring}

        <div style="margin-top:12px;display:flex;gap:8px;">
          <button id="obj-open-tutor"
            style="flex:1;background:#4ec9b0;color:#0e1116;border:none;border-radius:5px;padding:7px;font-size:12px;cursor:pointer;font-weight:700;">
            🤖 Open VM &amp; Tutor
          </button>
          <button id="obj-reset-lab"
            style="flex:1;background:#1b1f24;color:#8b95a1;border:1px solid #2d343d;border-radius:5px;padding:7px;font-size:11px;cursor:pointer;">
            Reset lab
          </button>
        </div>

        <div id="obj-hint" style="margin-top:6px;padding:6px 8px;font-size:10px;
          color:${isStepDone ? '#4ec9b0' : '#d7ba7d'};
          background:${isStepDone ? 'rgba(78,201,176,0.08)' : 'rgba(215,186,125,0.08)'};
          border-left:2px solid ${isStepDone ? '#4ec9b0' : '#d7ba7d'};
          border-radius:0 4px 4px 0;line-height:1.4;">
          ${isStepDone
            ? 'Step complete — click <strong>Advance</strong> in the lab to move on.'
            : `<strong>${unlockLabel}${unlockDetail}</strong> — the conductor observes this action automatically when complete.`}
        </div>

      </div>
    `;

    // Wire buttons
    container.querySelector('#obj-open-tutor')?.addEventListener('click', () => {
      const __lab = (window as unknown as { __lab?: {
        desktop?: { openWindow(id: string, c: unknown): void };
        conductor?: unknown;
      } }).__lab;
      if (__lab?.desktop && __lab.conductor) {
        __lab.desktop.openWindow('ollama-console', __lab.conductor);
      }
    });

    container.querySelector('#obj-reset-lab')?.addEventListener('click', () => {
      const lab2 = labStore.getState().current;
      if (lab2) {
        const labId = `lab${String(lab2.number).padStart(2, '0')}`;
        (window as unknown as { __lab?: { start(id: string): void } }).__lab?.start(labId);
      }
    });
  }

  render();
  labStore.subscribe(render);
}
