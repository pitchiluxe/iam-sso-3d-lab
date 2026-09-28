/**
 * ui/consoles/adLabWindow.ts — the Active Directory Enterprise Lab Series,
 * done on the in-app DC01 and CLIENT01.
 *
 *   left    the brief — scenario, objectives, requirements (or, in Real-World
 *           mode, only the ticket) and the last validation checklist
 *   centre  the two machines: open them from here or from the desktop, and
 *           watch what they look like and what was just done on them
 *   right   the Ollama instructor — observes a frozen snapshot, never acts
 *
 * The work happens inside DC01 and CLIENT01 (their PowerShell, Server
 * Manager, ADUC, DHCP, Settings…), which share one lab world. "Check my work"
 * runs the deterministic validation engine on that world first and hands the
 * result to the instructor to explain; only the engine can mark a lab done.
 *
 * Each lab keeps its own machines: switching lab sets the current ones aside
 * (like a snapshot) and brings the other lab's back.
 */
import { openDesktopApp } from '@/ui/desktopBus';
import { AD_LABS, type AdLab, labById, startingState } from '@/vm/adlab/labs';
import { type HostName, type LabState, dcIsPromoted } from '@/vm/adlab/state';
import { validate, type ValidationReport } from '@/vm/adlab/validation';
import { snapshotForInstructor } from '@/vm/adlab/observe';
import {
  forgetStashed,
  loadWorld,
  notifyWorldChanged,
  onWorldChanged,
  switchWorld,
} from '@/vm/adlab/world';
import { OLLAMA_HOST } from '@/config/ollama';
import { renderMarkdown } from '@/ui/markdown';
import {
  HINT_LEVEL_NAME,
  METHODOLOGY,
  MODE_BLURB,
  MODE_LABEL,
  type InstructorMode,
  type InstructorRequest,
  type InstructorSession,
  askInstructor,
  clearConversation,
  instructorStatus,
  newSession,
  nextHint,
  recordReport,
} from '@/vm/adlab/instructor';

const STORE_KEY = 'iam3d.adlabSeries.v1';
const MODES: InstructorMode[] = ['guided', 'coach', 'interview', 'real-world'];
const HOSTS: HostName[] = ['DC01', 'CLIENT01'];

interface LabSave {
  session: InstructorSession;
  notes: string;
}

interface Store {
  labId: string;
  perLab: Record<string, LabSave>;
  completed: string[];
}

function loadStore(): Store {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as Store;
      if (s && typeof s.labId === 'string' && s.perLab && Array.isArray(s.completed)) return s;
    }
  } catch {
    // Blocked or corrupt storage: start clean, the lab still works.
  }
  return { labId: AD_LABS[0]!.id, perLab: {}, completed: [] };
}

function saveStore(s: Store): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {
    // Quota or privacy mode: progress is simply not remembered.
  }
}

const STYLES = `
.adl-root{display:flex;flex-direction:column;height:100%;background:var(--panel);color:var(--fg);font-family:"Segoe UI",system-ui,sans-serif;font-size:12.5px;}
.adl-head{flex-shrink:0;display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:8px 12px;background:var(--panel-2);border-bottom:1px solid var(--border);}
.adl-title{font-weight:650;font-size:13.5px;margin-right:6px;}
.adl-head select,.adl-btn{padding:5px 9px;border-radius:4px;border:1px solid var(--border);background:var(--panel);color:var(--fg);font:inherit;font-size:12px;cursor:pointer;}
.adl-btn:hover{background:var(--border);}
.adl-btn:disabled{opacity:.55;cursor:default;}
.adl-primary{background:#2563eb;border-color:#2563eb;color:#fff;font-weight:600;}
.adl-primary:hover{background:#1d4ed8;}
.adl-badge{margin-left:auto;font-size:11px;color:var(--muted);white-space:nowrap;}
.adl-badge.on{color:var(--accent);}
.adl-badge.off{color:#e2a03f;}
.adl-main{flex:1;min-height:0;display:grid;grid-template-columns:260px minmax(0,1fr) 340px;}
.adl-brief{overflow:auto;padding:12px 14px;border-right:1px solid var(--border);line-height:1.5;}
.adl-brief h3,.adl-machines h3{margin:12px 0 4px;font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);}
.adl-brief h2{margin:0 0 6px;font-size:14px;color:var(--accent);}
.adl-brief ul{margin:0;padding-left:16px;}
.adl-brief li{margin:2px 0;}
.adl-ticket{border:1px solid var(--border);border-left:3px solid #e2a03f;border-radius:5px;padding:8px 10px;background:var(--panel-2);}
.adl-ticket div{margin:2px 0;}
.adl-notes{width:100%;box-sizing:border-box;min-height:110px;margin-top:4px;padding:6px 8px;border-radius:4px;border:1px solid var(--border);background:var(--panel-2);color:var(--fg);font:inherit;resize:vertical;}
.adl-check{display:flex;gap:6px;margin:3px 0;}
.adl-check .ok{color:#22c55e;}
.adl-check .no{color:#ef4444;}
.adl-done{margin-top:8px;padding:6px 8px;border-radius:4px;background:rgba(34,197,94,.12);color:#22c55e;font-weight:600;}
.adl-machines{overflow:auto;padding:12px 14px;min-width:0;}
.adl-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;}
.adl-card{border:1px solid var(--border);border-radius:8px;padding:10px 12px;background:var(--panel-2);}
.adl-card b{font-size:13px;}
.adl-card .kv{display:grid;grid-template-columns:92px 1fr;gap:2px 8px;margin:8px 0;font-size:11.5px;}
.adl-card .kv span:nth-child(odd){color:var(--muted);}
.adl-card .warn{color:#e2a03f;font-size:11.5px;margin:4px 0;}
.adl-switch{margin:0 0 10px;padding:9px 11px;border:1px solid #e2a03f;border-radius:6px;background:rgba(226,160,63,.1);line-height:1.5;}
.adl-activity{font-family:Consolas,'Cascadia Mono',monospace;font-size:11.5px;background:#0c0c0c;color:#d4d4d4;border-radius:6px;padding:8px 10px;max-height:260px;overflow:auto;}
.adl-activity div{white-space:pre-wrap;word-break:break-word;margin:1px 0;}
.adl-activity .bad{color:#f87171;}
.adl-coach{display:flex;flex-direction:column;min-height:0;border-left:1px solid var(--border);}
.adl-coach-head{flex-shrink:0;padding:8px 12px;border-bottom:1px solid var(--border);font-size:11.5px;color:var(--muted);line-height:1.45;}
.adl-log{flex:1;overflow:auto;padding:10px 12px;display:flex;flex-direction:column;gap:10px;}
.adl-msg{padding:8px 10px;border-radius:7px;white-space:pre-wrap;line-height:1.55;font-size:12.3px;max-width:94%;}
.adl-msg.ins{white-space:normal;align-self:flex-start;background:var(--panel-2);border:1px solid var(--border);}
.adl-msg.me{align-self:flex-end;background:#2563eb;color:#fff;}
.adl-msg.sys{align-self:center;background:transparent;color:var(--muted);font-size:11px;text-align:center;}
.adl-src{font-size:10px;color:var(--muted);margin-top:4px;}
.adl-actions{flex-shrink:0;display:flex;flex-wrap:wrap;gap:6px;padding:8px 12px;border-top:1px solid var(--border);}
.adl-ask{flex-shrink:0;display:flex;gap:6px;padding:0 12px 10px;}
.adl-ask input{flex:1;padding:7px 9px;border-radius:4px;border:1px solid var(--border);background:var(--panel);color:var(--fg);font:inherit;outline:none;}
.adl-foot{flex-shrink:0;padding:0 12px 8px;font-size:10.5px;color:var(--muted);}
.adl-reset{position:relative;display:inline-block;}
.adl-menu{position:absolute;top:calc(100% + 4px);left:0;z-index:20;min-width:300px;padding:6px;border:1px solid var(--border);border-radius:6px;background:var(--panel);box-shadow:0 8px 24px rgba(0,0,0,.35);}
.adl-menu button{display:block;width:100%;text-align:left;padding:7px 9px;border:none;border-radius:4px;background:transparent;color:var(--fg);font:inherit;font-size:12px;cursor:pointer;}
.adl-menu button:hover{background:var(--panel-2);}
.adl-menu small{display:block;color:var(--muted);font-size:10.5px;margin-top:2px;}
`;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

const labNo = (l: AdLab): string => String(l.number).padStart(2, '0');

export function renderAdLabWindow(body: HTMLElement): void {
  if (!document.getElementById('adl-css')) {
    const style = document.createElement('style');
    style.id = 'adl-css';
    style.textContent = STYLES;
    document.head.appendChild(style);
  }
  body.innerHTML = '';
  body.style.height = '100%';

  const store = loadStore();
  let lab: AdLab = labById(store.labId) ?? AD_LABS[0]!;
  let save: LabSave = store.perLab[lab.id] ?? freshSave(lab);
  let busy = false;
  let seenHistory = loadWorld().state.history.length;
  let commandsSinceQuestion = 0;

  function freshSave(l: AdLab): LabSave {
    return { session: newSession(l.id, l.defaultMode), notes: '' };
  }
  function persist(): void {
    store.labId = lab.id;
    store.perLab[lab.id] = save;
    saveStore(store);
  }
  /** The machines are set up for this lab (another lab or the Portfolio may hold them). */
  const machinesAreMine = (): boolean => loadWorld().labId === lab.id;
  const labState = (): LabState => loadWorld().state;

  const root = el('div', 'adl-root');

  // --- Header ---------------------------------------------------------------
  const head = el('div', 'adl-head');
  head.appendChild(el('span', 'adl-title', 'AD Enterprise Lab Series'));
  const labSel = el('select');
  labSel.title = 'Lab';
  const modeSel = el('select');
  modeSel.title = 'Instructor mode';
  for (const m of MODES) {
    const o = el('option', undefined, `${MODE_LABEL[m]} mode`);
    o.value = m;
    modeSel.appendChild(o);
  }
  const resetWrap = el('div', 'adl-reset');
  const resetBtn = el('button', 'adl-btn', 'Start over ▾');
  resetBtn.title = 'Restart this lab or the whole series — any time';
  resetWrap.appendChild(resetBtn);
  const badge = el('span', 'adl-badge', 'Checking Ollama…');
  head.append(labSel, modeSel, resetWrap, badge);

  function paintLabSelect(): void {
    labSel.innerHTML = '';
    for (const l of AD_LABS) {
      const o = el(
        'option',
        undefined,
        `${store.completed.includes(l.id) ? '✓ ' : ''}Lab ${labNo(l)} — ${l.title}`,
      );
      o.value = l.id;
      labSel.appendChild(o);
    }
    labSel.value = lab.id;
  }

  async function refreshStatus(): Promise<void> {
    const st = await instructorStatus();
    badge.className = `adl-badge ${st.online ? 'on' : 'off'}`;
    badge.textContent = st.online
      ? `● Ollama Instructor — ${st.model}`
      : '○ Ollama Instructor Offline';
    badge.title = st.online
      ? 'The instructor composes replies with your local model.'
      : st.reason === 'no-models'
        ? 'Ollama is running but has no models. Pull one. The lab works without it.'
        : `Ollama is not reachable at ${OLLAMA_HOST}. The lab and validation work without it; the instructor answers from the lab material.`;
  }

  // --- Brief (left) -----------------------------------------------------------
  const brief = el('div', 'adl-brief');

  function renderBrief(): void {
    brief.innerHTML = '';
    const mode = save.session.mode;
    brief.appendChild(el('h2', undefined, `Lab ${labNo(lab)}: ${lab.title}`));
    if (lab.ticket) {
      const t = el('div', 'adl-ticket');
      t.append(
        el('div', undefined, `${lab.ticket.id} · ${lab.ticket.priority}`),
        el('div', undefined, `USER: ${lab.ticket.user}`),
        el('div', undefined, `COMPUTER: ${lab.ticket.computer}`),
        el('div', undefined, `ISSUE: ${lab.ticket.issue}`),
      );
      brief.appendChild(t);
      brief.append(
        el('h3', undefined, 'Business context'),
        el('div', undefined, lab.ticket.business),
      );
    } else {
      brief.append(el('h3', undefined, 'Business scenario'), el('div', undefined, lab.scenario));
    }
    const section = (title: string, items: string[]): void => {
      brief.appendChild(el('h3', undefined, title));
      const ul = el('ul');
      for (const i of items) ul.appendChild(el('li', undefined, i));
      brief.appendChild(ul);
    };
    if (mode !== 'real-world') {
      section('Objectives', lab.objectives);
      if (!lab.ticket) section('Requirements', lab.requirements);
      brief.append(
        el('h3', undefined, 'Expected result'),
        el('div', undefined, lab.expectedResult),
      );
    }
    section('Available tools', lab.tools);
    brief.append(
      el('h3', undefined, 'Troubleshooting method'),
      el('div', undefined, METHODOLOGY.map((m, i) => `${i + 1}. ${m}`).join('  ')),
    );

    if (lab.checks.includes('ticket-documented')) {
      brief.appendChild(el('h3', undefined, 'Resolution notes'));
      const ta = el('textarea', 'adl-notes');
      ta.placeholder = 'Symptom, evidence, root cause, fix, verification…';
      ta.value = save.notes;
      ta.addEventListener('input', () => {
        save.notes = ta.value;
        persist();
      });
      brief.appendChild(ta);
    }

    const report = save.session.lastReport;
    if (report) {
      brief.appendChild(
        el('h3', undefined, `Validation (${report.score.passed}/${report.score.total})`),
      );
      for (const r of report.results) {
        const row = el('div', 'adl-check');
        row.append(
          el('span', r.pass ? 'ok' : 'no', r.pass ? '✓' : '✗'),
          el('span', undefined, r.label),
        );
        brief.appendChild(row);
      }
      if (report.passed)
        brief.appendChild(el('div', 'adl-done', 'Validation engine: lab complete'));
    }
  }

  // --- Machines (centre) ------------------------------------------------------
  const machines = el('div', 'adl-machines');

  function paintMachines(): void {
    machines.innerHTML = '';
    const w = loadWorld();
    if (w.labId !== lab.id) {
      const box = el('div', 'adl-switch');
      box.append(
        el(
          'div',
          undefined,
          `DC01 and CLIENT01 are set up for ${w.labId === 'portfolio' ? 'the IAM Portfolio' : `Lab ${labNo(labById(w.labId) ?? lab)}`} right now. ` +
            `Load Lab ${labNo(lab)}'s machines to work on it — the others are kept and come back when you return.`,
        ),
      );
      const go = el('button', 'adl-btn adl-primary', `Load Lab ${labNo(lab)} on DC01 and CLIENT01`);
      go.style.marginTop = '8px';
      go.addEventListener('click', () => {
        switchWorld(lab.id, () => startingState(lab.id));
        seenHistory = loadWorld().state.history.length;
        bubble('sys', `DC01 and CLIENT01 now hold Lab ${labNo(lab)}.`);
        paintMachines();
      });
      box.append(go);
      machines.append(box);
      return;
    }
    const s = w.state;
    machines.append(
      el(
        'div',
        undefined,
        'Work inside the machines: double-click DC01 or CLIENT01 on the desktop (or use the buttons), sign in, and use their tools — PowerShell, Server Manager, Active Directory, DHCP, Settings.',
      ),
    );
    machines.append(el('h3', undefined, 'Machines'));
    const cards = el('div', 'adl-cards');
    for (const host of HOSTS) {
      const h = s.hosts[host];
      const card = el('div', 'adl-card');
      card.append(el('b', undefined, `${host === 'DC01' ? '🖥️' : '💻'} ${host}`));
      const kv = el('div', 'kv');
      const row = (k: string, v: string): void => {
        kv.append(el('span', undefined, k), el('span', undefined, v));
      };
      row('Computer name', h.pendingHostname ? `${h.hostname} → ${h.pendingHostname}` : h.hostname);
      for (const n of h.nics)
        row(
          n.alias,
          `${n.ip ?? 'no address'}${n.dhcp ? ' (DHCP)' : ''}  DNS ${n.dns.join(', ') || '—'}`,
        );
      row(
        host === 'DC01' ? 'Role' : 'Domain',
        host === 'DC01'
          ? dcIsPromoted(s)
            ? `Domain controller — ${s.ad.forest}`
            : h.features.includes('AD-Domain-Services')
              ? 'AD DS installed, not promoted'
              : 'Member server (workgroup)'
          : (h.domain ?? (h.pendingDomain ? `${h.pendingDomain} after restart` : 'WORKGROUP')),
      );
      row('Session', w.signedIn[host] ? 'Signed in' : 'Signed out');
      card.append(kv);
      if (h.restartPending) card.append(el('div', 'warn', 'A restart is pending.'));
      const open = el('button', 'adl-btn adl-primary', `Open ${host}`);
      open.addEventListener('click', () => openDesktopApp(host.toLowerCase()));
      card.append(open);
      cards.append(card);
    }
    machines.append(cards);

    machines.append(el('h3', undefined, 'What was done on the machines'));
    const act = el('div', 'adl-activity');
    const recent = s.history.slice(-14);
    if (recent.length === 0) act.append(el('div', undefined, 'Nothing yet.'));
    for (const e of recent) {
      act.append(
        el('div', e.ok ? undefined : 'bad', `${e.host}> ${e.command}${e.ok ? '' : '   ✗'}`),
      );
    }
    machines.append(act);
    act.scrollTop = act.scrollHeight;
  }

  // Keep the machine panel live, and let Interview mode ask while you work.
  const offWorld = onWorldChanged(() => {
    if (!root.isConnected) {
      offWorld();
      return;
    }
    paintMachines();
    const w = loadWorld();
    if (w.labId !== lab.id) return;
    const n = w.state.history.length;
    const added = Math.max(0, n - seenHistory);
    seenHistory = n;
    const worked = added ? w.state.history.slice(-added).filter((e) => e.ok).length : 0;
    if (save.session.mode === 'interview' && worked > 0) {
      commandsSinceQuestion += worked;
      if (commandsSinceQuestion >= 5 && !busy) {
        commandsSinceQuestion = 0;
        void instruct({ kind: 'interview' });
      }
    }
  });

  // --- Instructor (right) ---------------------------------------------------
  const coach = el('div', 'adl-coach');
  const coachHead = el('div', 'adl-coach-head');
  const log = el('div', 'adl-log');
  const actions = el('div', 'adl-actions');
  const checkBtn = el('button', 'adl-btn adl-primary', 'CHECK MY WORK');
  const hintBtn = el('button', 'adl-btn', 'Hint');
  const interviewBtn = el('button', 'adl-btn', 'Ask me a question');
  const clearBtn = el('button', 'adl-btn', 'Clear chat');
  clearBtn.title =
    'Clear the conversation with the instructor. Your lab, hints and check results are kept.';
  clearBtn.style.marginLeft = 'auto';
  actions.append(checkBtn, hintBtn, interviewBtn, clearBtn);
  const ask = el('div', 'adl-ask');
  const askInput = el('input');
  askInput.placeholder = 'Ask your instructor…';
  const askBtn = el('button', 'adl-btn', 'Ask');
  ask.append(askInput, askBtn);
  const foot = el(
    'div',
    'adl-foot',
    'The instructor can see your lab but cannot change it. You make every change.',
  );
  coach.append(coachHead, log, actions, ask, foot);

  function paintCoachHead(): void {
    coachHead.textContent = `${MODE_LABEL[save.session.mode]} mode — ${MODE_BLURB[save.session.mode]}`;
    interviewBtn.style.display =
      save.session.mode === 'interview' || save.session.mode === 'guided' ? '' : 'none';
  }

  /** Instructor replies are Markdown, rendered safely (no innerHTML). */
  function fill(
    b: HTMLElement,
    kind: 'ins' | 'me' | 'sys',
    text: string,
    source?: 'ollama' | 'offline',
  ): void {
    b.replaceChildren(kind === 'ins' ? renderMarkdown(text) : document.createTextNode(text));
    if (source)
      b.appendChild(
        el(
          'div',
          'adl-src',
          source === 'ollama' ? 'Ollama instructor' : 'Offline instructor (from lab material)',
        ),
      );
  }

  function bubble(
    kind: 'ins' | 'me' | 'sys',
    text: string,
    source?: 'ollama' | 'offline',
  ): HTMLElement {
    const b = el('div', `adl-msg ${kind}`);
    fill(b, kind, text, source);
    log.appendChild(b);
    log.scrollTop = log.scrollHeight;
    return b;
  }

  function repaintTranscript(): void {
    log.innerHTML = '';
    for (const t of save.session.transcript) bubble(t.role === 'student' ? 'me' : 'ins', t.text);
  }

  function setBusy(v: boolean): void {
    busy = v;
    // CHECK MY WORK stays available: the engine never waits for the model.
    for (const b of [hintBtn, interviewBtn, askBtn]) b.disabled = v;
  }

  async function instruct(req: InstructorRequest): Promise<void> {
    setBusy(true);
    const pending = bubble('ins', '…');
    try {
      // A frozen copy: the instructor observes the lab as it is right now.
      const reply = await askInstructor(
        req,
        { lab, view: snapshotForInstructor(labState()), session: save.session, notes: save.notes },
        {
          onText: (partial) => {
            fill(pending, 'ins', partial);
            log.scrollTop = log.scrollHeight;
          },
        },
      );
      fill(pending, 'ins', reply.text, reply.source);
      persist();
    } finally {
      setBusy(false);
      log.scrollTop = log.scrollHeight;
      void refreshStatus();
    }
  }

  function runValidation(record: boolean): ValidationReport {
    const report = validate(lab.id, lab.checks, { state: labState(), notes: save.notes });
    if (record) recordReport(save.session, report);
    else save.session.lastReport = report;
    if (report.passed && !store.completed.includes(lab.id)) {
      store.completed.push(lab.id);
      paintLabSelect();
    }
    renderBrief();
    persist();
    return report;
  }

  function needMachines(): boolean {
    if (machinesAreMine()) return true;
    bubble('sys', `Load Lab ${labNo(lab)} on DC01 and CLIENT01 first (the button in the middle).`);
    return false;
  }

  checkBtn.addEventListener('click', () => {
    if (!needMachines()) return;
    const report = runValidation(true);
    const score = `Validation engine: ${report.score.passed}/${report.score.total} checks passed`;
    if (busy) {
      bubble(
        'sys',
        `${score}. The instructor is still answering — click again for its explanation.`,
      );
      return;
    }
    bubble('sys', score);
    void instruct({ kind: 'check', report });
  });

  hintBtn.addEventListener('click', () => {
    if (busy || !needMachines()) return;
    // The engine, not the model, decides what is failing and so what to hint at.
    const report = runValidation(false);
    if (report.passed) {
      bubble(
        'sys',
        'Every check passes — no hints needed. Click CHECK MY WORK to have it reviewed.',
      );
      return;
    }
    const h = nextHint(save.session);
    if (!h) {
      bubble(
        'sys',
        'You have had all three hints for every failing check. Ask the instructor to explain the solution — you will still make the change yourself.',
      );
      return;
    }
    bubble('sys', `Hint ${h.level} of 3 — ${HINT_LEVEL_NAME[h.level]}`);
    void instruct({ kind: 'hint', checkId: h.checkId, level: h.level });
  });

  interviewBtn.addEventListener('click', () => {
    if (!busy) void instruct({ kind: 'interview' });
  });

  clearBtn.addEventListener('click', () => {
    if (busy || save.session.transcript.length === 0) return;
    if (
      !window.confirm(
        'Clear the conversation with the instructor? Your lab, hints and check results are kept.',
      )
    )
      return;
    clearConversation(save.session);
    persist();
    log.innerHTML = '';
    bubble('sys', 'Conversation cleared. Your lab, hints and check results are unchanged.');
    askInput.focus();
  });

  function sendQuestion(): void {
    const q = askInput.value.trim();
    if (!q || busy) return;
    askInput.value = '';
    bubble('me', q);
    void instruct({ kind: 'ask', question: q });
  }
  askBtn.addEventListener('click', sendQuestion);
  askInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendQuestion();
  });

  // --- Lab switching --------------------------------------------------------
  function openLab(l: AdLab, fresh: boolean): void {
    lab = l;
    save = !fresh && store.perLab[l.id] ? store.perLab[l.id]! : freshSave(l);
    modeSel.value = save.session.mode;
    commandsSinceQuestion = 0;
    // The machines follow the lab being worked on, unless the Portfolio holds them.
    if (loadWorld().labId !== 'portfolio') switchWorld(l.id, () => startingState(l.id));
    seenHistory = loadWorld().state.history.length;
    persist();
    paintLabSelect();
    paintCoachHead();
    renderBrief();
    repaintTranscript();
    paintMachines();
    if (save.session.transcript.length === 0) void instruct({ kind: 'intro' });
    else bubble('sys', 'Lab restored where you left it.');
  }

  labSel.addEventListener('change', () => {
    const l = labById(labSel.value);
    if (l) openLab(l, false);
  });
  modeSel.addEventListener('change', () => {
    save.session.mode = modeSel.value as InstructorMode;
    commandsSinceQuestion = 0;
    paintCoachHead();
    renderBrief();
    persist();
    bubble('sys', `Instructor switched to ${MODE_LABEL[save.session.mode]} mode.`);
  });

  // --- Start over ------------------------------------------------------------
  let menu: HTMLElement | null = null;
  const closeMenu = (): void => {
    menu?.remove();
    menu = null;
  };
  function menuItem(title: string, detail: string, action: () => void): HTMLButtonElement {
    const b = el('button');
    b.append(document.createTextNode(title), el('small', undefined, detail));
    b.addEventListener('click', () => {
      closeMenu();
      action();
    });
    return b;
  }
  function forgetProgress(ids: string[]): void {
    for (const id of ids) delete store.perLab[id];
    store.completed = store.completed.filter((id) => !ids.includes(id));
    forgetStashed(ids);
    saveStore(store);
  }
  /** Rebuild `l`'s starting machines in place of whatever DC01 and CLIENT01 hold now. */
  function rebuildMachines(l: AdLab): void {
    forgetStashed([l.id]);
    notifyWorldChanged({
      state: startingState(l.id),
      labId: l.id,
      signedIn: { DC01: false, CLIENT01: false },
    });
  }
  function restartLab(): void {
    if (
      !window.confirm(
        `Start Lab ${labNo(lab)} over? Everything you changed in this lab is discarded.`,
      )
    )
      return;
    forgetProgress([lab.id]);
    if (machinesAreMine()) rebuildMachines(lab);
    openLab(lab, true);
    bubble('sys', `Lab ${labNo(lab)} restarted from its starting state.`);
  }
  function restartSeries(): void {
    if (
      !window.confirm(
        'Start the whole series over? All 11 labs, their progress and completion marks are cleared.',
      )
    )
      return;
    forgetProgress(AD_LABS.map((l) => l.id));
    if (loadWorld().labId !== 'portfolio') rebuildMachines(AD_LABS[0]!);
    openLab(AD_LABS[0]!, true);
    bubble('sys', 'The series was reset. You are back at Lab 01 with fresh machines.');
  }
  resetBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (menu) {
      closeMenu();
      return;
    }
    menu = el('div', 'adl-menu');
    menu.append(
      menuItem(
        `Restart Lab ${labNo(lab)}`,
        "Rebuild this lab's starting machines and clear its progress.",
        restartLab,
      ),
      menuItem('Restart the whole series', 'Clear every lab and go back to Lab 01.', restartSeries),
    );
    resetWrap.appendChild(menu);
  });
  document.addEventListener('click', (e) => {
    if (menu && !resetWrap.contains(e.target as Node)) closeMenu();
  });

  const main = el('div', 'adl-main');
  main.append(brief, machines, coach);
  root.append(head, main);
  body.appendChild(root);

  paintLabSelect();
  void refreshStatus();
  openLab(lab, false);
}
