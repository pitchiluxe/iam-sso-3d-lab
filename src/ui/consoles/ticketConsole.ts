/**
 * ui/consoles/ticketConsole.ts — Ticket Queue console.
 * Shows open tickets with subject, kind, and assignee; allows resolving.
 */
import type { Conductor } from '@/conductor/conductor';
import { evidenceStore } from '@/stores';
import { mkEvidenceId } from '@/domain';
import type { Evidence, UserId } from '@/domain';

export function renderTicketConsole(body: HTMLElement, conductor: Conductor) {
  body.innerHTML = '';
  if (!conductor.tickets || !conductor.audit) {
    body.style.cssText = 'padding:24px;color:var(--muted);font-size:13px;line-height:1.6;';
    body.innerHTML = `
      <div style="text-align:center;">
        <div style="font-size:32px;margin-bottom:8px;">🎫</div>
        <div style="color:var(--accent);font-size:14px;font-weight:600;margin-bottom:6px;">Ticket Queue</div>
        <div>No active lab session.</div>
        <div style="margin-top:12px;font-size:12px;line-height:1.5;">
          Press <strong>Esc</strong> to return to the menu, then choose a lab<br/>
          to manage tickets, access requests, and escalations.
        </div>
      </div>
    `;
    return;
  }
  const queue = conductor.tickets;
  const audit = conductor.audit;

  const addEvidence = (stepId: string, label: string) => {
    const lab = (
      window as unknown as { __lab?: { get(): import('@/domain').Lab | null } }
    ).__lab?.get?.();
    const stepIdx =
      (window as unknown as { __labState?: { stepIndex: number } }).__labState?.stepIndex ?? 0;
    const ev: Evidence = {
      id: mkEvidenceId(),
      labId: lab?.id ?? ('unknown' as never),
      stepId: lab?.steps[stepIdx]?.id ?? stepId,
      kind: 'ticket',
      capturedAt: Date.now(),
      label,
      payload: {},
    };
    evidenceStore.getState().add(ev);
  };

  const refresh = () => {
    const open = queue.list().filter((t) => t.status !== 'resolved');
    const resolved = queue.list().filter((t) => t.status === 'resolved');
    body.innerHTML = '';

    /* Summary */
    const sum = document.createElement('div');
    sum.style.cssText =
      'display:flex;gap:16px;font-size:12px;color:var(--muted);margin-bottom:12px;';
    sum.innerHTML = `<span style="color:var(--accent)">${open.length} open</span><span>${resolved.length} resolved</span>`;
    body.appendChild(sum);

    if (open.length === 0) {
      body.appendChild(empty('✓ No open tickets'));
      return;
    }

    for (const t of open) {
      const card = document.createElement('div');
      card.style.cssText = `
        background:var(--panel-2);border:1px solid var(--border);border-radius:4px;
        padding:10px 12px;margin-bottom:8px;font-size:12px;
      `;
      const kindColors: Record<string, string> = {
        onboarding: 'var(--accent)',
        termination: 'var(--err)',
        transfer: 'var(--warn)',
        'access-request': '#a78bfa',
        'password-reset': '#60a5fa',
        'mfa-issue': '#fb923c',
        incident: 'var(--err)',
      };
      const color = kindColors[t.kind] ?? 'var(--muted)';
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
          <span style="font-weight:600;">${t.subject}</span>
          <span style="color:${color};font-size:10px;text-transform:uppercase;letter-spacing:0.05em;">${t.kind}</span>
        </div>
        <div style="color:var(--muted);margin-bottom:8px;">${t.body}</div>
        <div style="color:var(--muted);font-size:11px;margin-bottom:8px;">
          ${t.assigneeId ? `Assignee: ${t.assigneeId}` : 'Unassigned'}
          · Priority: <strong>${t.priority}</strong>
        </div>
      `;
      const actions = document.createElement('div');
      actions.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;';
      actions.appendChild(
        btn('Assign to me', '#60a5fa', () => {
          // For now, assign to 'player'
          queue.assign(t.id, 'player' as UserId);
          refresh();
        }),
      );
      actions.appendChild(
        btn('Resolve', 'var(--accent)', () => {
          try {
            queue.resolve(t.id, 'system' as UserId);
            addEvidence('s1', `Resolved: ${t.subject}`);
          } catch (e) {
            alert(String(e));
          }
          refresh();
        }),
      );
      card.appendChild(actions);
      body.appendChild(card);
    }

    /* Resolved */
    if (resolved.length > 0) {
      const hdr = document.createElement('h3');
      hdr.style.cssText =
        'color:var(--muted);font-size:12px;text-transform:uppercase;margin:16px 0 6px;letter-spacing:0.05em;';
      hdr.textContent = 'Recently Resolved';
      body.appendChild(hdr);
      for (const t of resolved.slice(-5).reverse()) {
        const r = document.createElement('div');
        r.style.cssText =
          'font-size:12px;color:var(--muted);padding:4px 0;border-bottom:1px solid var(--border);';
        r.textContent = `✓ ${t.subject}`;
        body.appendChild(r);
      }
    }

    /* Audit events for tickets */
    const hdr = document.createElement('h3');
    hdr.style.cssText =
      'color:var(--muted);font-size:12px;text-transform:uppercase;margin:16px 0 6px;letter-spacing:0.05em;';
    hdr.textContent = 'Ticket Audit Events';
    body.appendChild(hdr);
    const auditList = document.createElement('div');
    auditList.style.cssText =
      'max-height:120px;overflow-y:auto;border:1px solid var(--border);border-radius:4px;';
    const ticketEvents = audit.events
      .filter((e) => e.action.startsWith('ticket.'))
      .slice(-15)
      .reverse();
    if (ticketEvents.length === 0) {
      auditList.appendChild(empty('No ticket audit events yet'));
    } else {
      for (const ev of ticketEvents) {
        const row = document.createElement('div');
        row.style.cssText =
          'padding:4px 10px;border-bottom:1px solid var(--border);font-size:11px;color:var(--muted);font-family:monospace;';
        row.textContent = `[${new Date(ev.at).toLocaleTimeString()}] ${ev.action} ${ev.targetId ?? ''}`;
        auditList.appendChild(row);
      }
    }
    body.appendChild(auditList);
  };

  refresh();
}

function btn(label: string, color: string, onClick: () => void): HTMLElement {
  const b = document.createElement('button');
  b.textContent = label;
  b.style.cssText = `background:transparent;color:${color};border:1px solid ${color};border-radius:4px;padding:3px 8px;font-size:11px;cursor:pointer;`;
  b.addEventListener('click', onClick);
  return b;
}

function empty(msg: string): HTMLElement {
  const d = document.createElement('div');
  d.style.cssText = 'color:var(--muted);font-size:12px;text-align:center;padding:20px;';
  d.textContent = msg;
  return d;
}
