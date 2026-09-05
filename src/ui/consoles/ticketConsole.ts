/**
 * ui/consoles/ticketConsole.ts — Ticket Queue console.
 * Shows open tickets with subject, kind, and assignee; allows resolving.
 *
 * The console subscribes to the ticketStore so it re-renders whenever
 * tickets are created (e.g. a lab seed) or resolved — the learner
 * always sees the current queue state.
 */
import type { Conductor } from '@/conductor/conductor';
import { evidenceStore, ticketStore } from '@/stores';
import { mkEvidenceId } from '@/domain';
import type { Evidence, UserId } from '@/domain';

export function renderTicketConsole(body: HTMLElement, conductor: Conductor) {
  // One-time injection of thin scrollbar CSS for Webkit browsers
  if (!document.getElementById('ticket-console-scroll-css')) {
    const style = document.createElement('style');
    style.id = 'ticket-console-scroll-css';
    style.textContent =
      '#ticket-console-wrap::-webkit-scrollbar{width:6px}' +
      '#ticket-console-wrap::-webkit-scrollbar-track{background:#0e1116}' +
      '#ticket-console-wrap::-webkit-scrollbar-thumb{background:#2d343d;border-radius:3px}' +
      '#ticket-console-wrap::-webkit-scrollbar-thumb:hover{background:#3d4a56}';
    document.head.appendChild(style);
  }

  // Always use a dedicated scrollable inner container so the scrollbar always
  // works regardless of how the caller's body is styled (desktop overlay vs
  // console overlay both pass in differently-styled divs).
  const wrap = document.createElement('div');
  wrap.id = 'ticket-console-wrap';
  wrap.style.cssText =
    'height:100%;overflow-y:auto;padding:16px;box-sizing:border-box;' +
    'scrollbar-width:thin;scrollbar-color:#2d343d #0e1116;';
  body.innerHTML = '';
  body.style.cssText = 'overflow:hidden;';
  body.appendChild(wrap);

  if (!conductor.tickets || !conductor.audit) {
    wrap.innerHTML = `
      <div style="text-align:center;padding:24px 16px;color:var(--muted);font-size:13px;line-height:1.6;">
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

  const render = () => {
    const open = queue.list().filter((t) => t.status !== 'resolved');
    const resolved = queue.list().filter((t) => t.status === 'resolved');
    wrap.innerHTML = '';

    /* Summary — always show, even with 1-2 tickets */
    const sum = document.createElement('div');
    sum.style.cssText =
      'display:flex;align-items:center;gap:10px;padding:8px 12px;background:#1b1f24;border:1px solid var(--border);border-radius:6px;margin-bottom:12px;';
    sum.innerHTML = `
      <span style="font-size:20px;">🎫</span>
      <div>
        <div style="font-size:13px;color:var(--accent);font-weight:600;">
          ${open.length} open · ${resolved.length} resolved
        </div>
        <div style="font-size:11px;color:var(--muted);margin-top:1px;">
          ${open.length > 0 ? 'Resolve tickets to advance the lab' : open.length === 0 && resolved.length > 0 ? 'All tickets resolved — great work!' : 'No tickets in this lab.'}
        </div>
      </div>
    `;
    wrap.appendChild(sum);

    /* Open tickets */
    for (const t of open) {
      const card = document.createElement('div');
      card.style.cssText = `
        background:var(--panel-2);border:1px solid var(--border);border-radius:4px;
        padding:10px 12px;margin-bottom:8px;font-size:12px;min-height:80px;
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
          queue.assign(t.id, 'player' as UserId);
          render();
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
          render();
        }),
      );
      card.appendChild(actions);
      wrap.appendChild(card);
    }

    /* Empty state */
    if (open.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.style.cssText =
        'text-align:center;padding:24px 12px;color:var(--muted);font-size:13px;';
      emptyState.innerHTML = '✓ No open tickets';
      wrap.appendChild(emptyState);
    }

    /* Resolved */
    if (resolved.length > 0) {
      const hdr = document.createElement('h3');
      hdr.style.cssText =
        'color:var(--muted);font-size:12px;text-transform:uppercase;margin:16px 0 6px;letter-spacing:0.05em;';
      hdr.textContent = 'Recently Resolved';
      wrap.appendChild(hdr);
      for (const t of resolved.slice(-5).reverse()) {
        const r = document.createElement('div');
        r.style.cssText =
          'font-size:12px;color:var(--muted);padding:4px 0;border-bottom:1px solid var(--border);';
        r.textContent = `✓ ${t.subject}`;
        wrap.appendChild(r);
      }
    }

    /* Audit events for tickets */
    const hdr = document.createElement('h3');
    hdr.style.cssText =
      'color:var(--muted);font-size:12px;text-transform:uppercase;margin:16px 0 6px;letter-spacing:0.05em;';
    hdr.textContent = 'Ticket Audit Events';
    const auditHdr = document.createElement('h3');
    auditHdr.style.cssText =
      'color:var(--muted);font-size:12px;text-transform:uppercase;margin:16px 0 6px;letter-spacing:0.05em;';
    auditHdr.textContent = 'Ticket Audit Events';
    wrap.appendChild(auditHdr);
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
    wrap.appendChild(auditList);
  };

  // Subscribe to the ticket store so the console re-renders whenever tickets
  // are created (lab seed) or the store is otherwise updated.
  const unsub = ticketStore.subscribe(render);

  // Also re-render if the console is revisited (e.g. after lab reset/switch).
  const observer = new MutationObserver(() => {
    if (document.contains(body)) {
      // body still in DOM — no-op, unsubscribe will fire when window closes
    } else {
      observer.disconnect();
      unsub();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  render();
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
