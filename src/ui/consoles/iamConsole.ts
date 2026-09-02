/**
 * ui/consoles/iamConsole.ts — IAM Console renderer.
 * Shows: users, groups, applications, and a Create Group / Create User form.
 * Operates against the running Conductor's MockDirectory + MockIdP.
 */
import type { Conductor } from '@/conductor/conductor';
import { evidenceStore } from '@/stores';
import { mkUserId, mkGroupId, mkEvidenceId } from '@/domain';
import type { GroupId, UserId, Evidence, MfaMethod } from '@/domain';

export function renderIAMConsole(body: HTMLElement, conductor: Conductor) {
  const dir = conductor.dir;
  const idp = conductor.idp;
  const apps = conductor.apps;
  const audit = conductor.audit;

  // Track local MFA policy state (IdP stores policies internally; we expose a toggle)
  let mfaEnabled = false;

  const addEvidence = (stepId: string, kind: Evidence['kind'], label: string) => {
    const lab = (window as unknown as { __lab?: { get(): import('@/domain').Lab | null } }).__lab?.get?.();
    const stepIdx = (window as unknown as { __labState?: { stepIndex: number } }).__labState?.stepIndex ?? 0;
    const labId = lab?.id;
    const sId = lab?.steps[stepIdx]?.id ?? stepId;
    const ev: Evidence = {
      id: mkEvidenceId(),
      labId: labId ?? ('unknown' as never),
      stepId: sId,
      kind,
      capturedAt: Date.now(),
      label,
      payload: {},
    };
    evidenceStore.getState().add(ev);
  };

  const refresh = () => {
    const users  = dir.listUsers();
    const groups = dir.listGroups();
    const appsList = apps.apps();
    body.innerHTML = '';

    /* Summary */
    const head = document.createElement('div');
    head.style.cssText = 'display:flex;justify-content:space-between;color:var(--muted);font-size:12px;margin-bottom:12px;';
    head.innerHTML = `
      <span>${users.length} users · ${groups.length} groups · ${appsList.length} apps</span>
      <span>audit: ${audit.events.length} events</span>
    `;
    body.appendChild(head);

    /* Users */
    body.appendChild(h2('Users'));
    const userList = document.createElement('div');
    userList.style.cssText = 'max-height:160px;overflow-y:auto;border:1px solid var(--border);border-radius:4px;margin-bottom:8px;';
    for (const u of users) {
      const row = document.createElement('div');
      row.style.cssText = 'padding:6px 10px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;font-size:12px;';
      const statusColor = u.status === 'active' ? 'var(--accent)' : u.status === 'disabled' ? 'var(--err)' : 'var(--warn)';
      const mfaColor = u.mfa !== 'none' ? 'var(--accent)' : 'var(--muted)';
      row.innerHTML = `
        <span><span style="color:${statusColor}">●</span> <strong>${u.username}</strong> <span style="color:var(--muted)">${u.displayName}</span></span>
        <span style="color:var(--muted)">${u.groupIds.length} groups</span>
        <span style="color:${mfaColor}">MFA:${u.mfa}</span>
      `;
      userList.appendChild(row);
    }
    body.appendChild(userList);

    /* Add User form */
    body.appendChild(h2('Provision User'));
    body.appendChild(formRow([
      inp('username', 'username'),
      inp('display', 'display name'),
      inp('email', 'email'),
      inp('dept', 'department'),
      inp('title', 'job title'),
      btn('Create User', () => {
        const username = val('username').trim();
        const display  = val('display').trim() || username;
        const email    = val('email').trim() || `${username}@northwind.example`;
        const dept     = val('dept').trim() || 'General';
        const title    = val('title').trim() || 'Employee';
        if (!username) return;
        try {
          const u = dir.createUser({ username, displayName: display, email, department: dept, title });
          idp.setPasswordResolver((u2) => u2 === username ? `${username}123` : undefined);
          addEvidence('s1', 'snapshot', `Created user: ${u.username}`);
        } catch (e) { showError(body, String(e)); }
        refresh();
      }),
    ]));

    /* Groups */
    body.appendChild(h2('Groups'));
    const groupList = document.createElement('div');
    groupList.style.cssText = 'max-height:120px;overflow-y:auto;border:1px solid var(--border);border-radius:4px;margin-bottom:8px;';
    for (const g of groups) {
      const row = document.createElement('div');
      row.style.cssText = 'padding:6px 10px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;font-size:12px;';
      row.innerHTML = `
        <span><strong>${g.name}</strong></span>
        <span style="color:var(--muted)">${g.memberIds.length} members</span>
      `;
      groupList.appendChild(row);
    }
    body.appendChild(groupList);

    /* Create Group form */
    body.appendChild(formRow([
      inp('gname', 'group name'),
      inp('gdesc', 'description'),
      btn('Create Group', () => {
        const name = val('gname').trim();
        const desc = val('gdesc').trim();
        if (!name) return;
        try {
          const g = dir.createGroup(name, desc);
          addEvidence('s2', 'snapshot', `Created group: ${g.name}`);
        } catch (e) { showError(body, String(e)); }
        refresh();
      }),
    ]));

    /* Group membership */
    body.appendChild(h2('Group Membership'));
    body.appendChild(formRow([
      sel('msel', users.map((u) => ({ v: u.username, t: u.username }))),
      sel('gsel', groups.map((g) => ({ v: g.name, t: g.name }))),
      btn('Add to group', () => {
        const username  = (body.querySelector<HTMLSelectElement>('[data-k="msel"]')!).value;
        const groupname = (body.querySelector<HTMLSelectElement>('[data-k="gsel"]')!).value;
        try {
          const u = dir.getUserByUsername(username);
          const g = dir.getGroupByName(groupname);
          if (!u || !g) return;
          dir.addToGroup(u.id, g.id, 'system' as UserId);
          addEvidence('s3', 'snapshot', `Added ${u.username} to ${g.name}`);
        } catch (e) { showError(body, String(e)); }
        refresh();
      }),
      btn('Remove from group', () => {
        const username  = (body.querySelector<HTMLSelectElement>('[data-k="msel"]')!).value;
        const groupname = (body.querySelector<HTMLSelectElement>('[data-k="gsel"]')!).value;
        try {
          const u = dir.getUserByUsername(username);
          const g = dir.getGroupByName(groupname);
          if (!u || !g) return;
          dir.removeFromGroup(u.id, g.id, 'system' as UserId);
        } catch (e) { showError(body, String(e)); }
        refresh();
      }),
    ]));

    /* MFA policy toggle */
    body.appendChild(h2('MFA Policy'));
    const polRow = document.createElement('div');
    polRow.style.cssText = 'padding:8px 0;display:flex;gap:8px;align-items:center;font-size:12px;flex-wrap:wrap;';
    polRow.innerHTML = `<span style="color:var(--muted)">Require MFA on privileged sign-in:</span> <strong>${mfaEnabled ? 'YES' : 'no'}</strong>`;
    const polBtn = btn(mfaEnabled ? 'Disable MFA enforcement' : 'Enable MFA enforcement', () => {
      mfaEnabled = !mfaEnabled;
      idp.setConditionalPolicy({ requireMfa: mfaEnabled });
      addEvidence('s4', 'snapshot', `MFA enforcement: ${mfaEnabled ? 'enabled' : 'disabled'}`);
      refresh();
    });
    polRow.appendChild(polBtn);
    body.appendChild(polRow);

    /* Applications */
    body.appendChild(h2('Registered Applications'));
    const appList = document.createElement('div');
    appList.style.cssText = 'max-height:100px;overflow-y:auto;border:1px solid var(--border);border-radius:4px;margin-bottom:8px;';
    for (const a of appsList) {
      const row = document.createElement('div');
      row.style.cssText = 'padding:6px 10px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;font-size:12px;';
      const statusColor = a.status === 'configured' ? 'var(--accent)' : a.status === 'misconfigured' ? 'var(--warn)' : 'var(--err)';
      row.innerHTML = `
        <span><strong>${a.name}</strong> <span style="color:var(--muted)">${a.protocol}</span></span>
        <span style="color:${statusColor}">${a.status}</span>
        <span style="color:var(--muted)">${a.mfaRequired ? 'MFA' : ''}</span>
      `;
      appList.appendChild(row);
    }
    body.appendChild(appList);

    /* Recent audit */
    body.appendChild(h2('Recent Audit Events'));
    const auditList = document.createElement('div');
    auditList.style.cssText = 'max-height:120px;overflow-y:auto;border:1px solid var(--border);border-radius:4px;';
    const recent = audit.events.slice(-15).reverse();
    for (const ev of recent) {
      const row = document.createElement('div');
      row.style.cssText = 'padding:4px 10px;border-bottom:1px solid var(--border);font-size:11px;color:var(--muted);font-family:monospace;';
      row.textContent = `[${new Date(ev.at).toLocaleTimeString()}] ${ev.action} ${ev.targetId ?? ''} ${ev.subjectId ? `(subject:${ev.subjectId})` : ''}`;
      auditList.appendChild(row);
    }
    body.appendChild(auditList);

    /* Sign-in verification */
    body.appendChild(h2('Verify Authentication'));
    body.appendChild(formRow([
      sel('siuser', users.map((u) => ({ v: u.username, t: u.username }))),
      btn('Sign in (verify)', () => {
        const username = (body.querySelector<HTMLSelectElement>('[data-k="siuser"]')!).value;
        const result = idp.signIn(username, `${username}123`);
        if (result.ok) {
          if (result.user.mfa !== 'none') {
            const mfa = idp.completeMfa(result.session.id, result.user.mfa as MfaMethod);
            if (mfa.ok) addEvidence('s5', 'log-excerpt', `${username} signed in + MFA completed`);
            else showError(body, `MFA failed: ${mfa.reason}`);
          } else {
            addEvidence('s5', 'log-excerpt', `${username} signed in successfully`);
          }
        } else {
          showError(body, `Sign-in failed: ${result.reason}`);
        }
        refresh();
      }),
    ]));
  };

  function val(k: string): string {
    return (body.querySelector<HTMLInputElement>(`[data-k="${k}"]`))?.value ?? '';
  }

  refresh();
}

/* -------------------------------------------------------------------------- */
/* helpers                                                                    */
/* -------------------------------------------------------------------------- */
function h2(text: string): HTMLElement {
  const h = document.createElement('h3');
  h.style.cssText = 'color:var(--accent);font-size:12px;margin:12px 0 4px 0;letter-spacing:0.05em;text-transform:uppercase;';
  h.textContent = text;
  return h;
}

function inp(key: string, placeholder: string): HTMLElement {
  const i = document.createElement('input');
  i.type = 'text';
  i.setAttribute('data-k', key);
  i.placeholder = placeholder;
  i.style.cssText = 'background:var(--bg);color:var(--fg);border:1px solid var(--border);border-radius:4px;padding:4px 8px;font-size:12px;flex:1;min-width:90px;';
  return i;
}

function sel(key: string, options: { v: string; t: string }[]): HTMLElement {
  const s = document.createElement('select');
  s.setAttribute('data-k', key);
  s.style.cssText = 'background:var(--bg);color:var(--fg);border:1px solid var(--border);border-radius:4px;padding:4px 6px;font-size:12px;flex:1;min-width:100px;';
  for (const o of options) {
    const opt = document.createElement('option');
    opt.value = o.v; opt.textContent = o.t;
    s.appendChild(opt);
  }
  return s;
}

function btn(label: string, onClick: () => void): HTMLElement {
  const b = document.createElement('button');
  b.textContent = label;
  b.style.cssText = 'background:var(--accent);color:var(--bg);border:none;border-radius:4px;padding:4px 10px;font-size:12px;cursor:pointer;font-weight:600;white-space:nowrap;';
  b.addEventListener('click', onClick);
  return b;
}

function formRow(children: HTMLElement[]): HTMLElement {
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:4px 0;';
  for (const c of children) row.appendChild(c);
  return row;
}

function showError(body: HTMLElement, msg: string) {
  const err = document.createElement('div');
  err.style.cssText = 'color:var(--err);font-size:12px;margin:4px 0;padding:4px 8px;background:rgba(244,135,113,0.1);border-radius:3px;';
  err.textContent = msg;
  body.appendChild(err);
  setTimeout(() => err.remove(), 4000);
}
