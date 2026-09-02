/**
 * ui/consoles/ollamaConsole.ts — AI Supervisor console.
 *
 * Interactive chat interface with the Ollama AI supervisor. Allows the learner
 * to ask free-form questions about the current lab step, request help when
 * stuck, or invoke the supervisor to score their current performance.
 *
 * The supervisor is connected to the local Ollama LLM (default
 * http://localhost:11434, model llama3.2). When Ollama is offline, the
 * console falls back to the local hint ladder and the built-in scorer.
 */
import type { Conductor } from '@/conductor/conductor';
import { labStore, tutorStore, auditStore, scoreStore, evidenceStore } from '@/stores';
import { OllamaSupervisor } from '@/services/ollamaSupervisor';
import { getHintLadder } from '@/tutor/hintLadder';

const SUPERVISOR = new OllamaSupervisor();

interface ChatMessage {
  from: 'user' | 'supervisor' | 'system';
  at: number;
  body: string;
  // optional structured data
  score?: {
    exec: number; troubleshoot: number; leastPrivilege: number;
    docs: number; evidence: number; comms: number; total: number;
    passed: boolean;
  };
}

const chatLog: ChatMessage[] = [];

function formatTime(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function summarizeStepContext(): { labTitle: string; labNumber: number; stepTitle: string; stepBrief: string; stepIdx: number; totalSteps: number } | null {
  const lab = labStore.getState().current;
  const idx = labStore.getState().stepIndex;
  if (!lab || !lab.steps[idx]) return null;
  const step = lab.steps[idx]!;
  return { labTitle: lab.title, labNumber: lab.number, stepTitle: step.title, stepBrief: step.brief, stepIdx: idx, totalSteps: lab.steps.length };
}

async function callSupervisorDirect(prompt: string): Promise<string> {
  const ctx = summarizeStepContext();
  if (!ctx) return 'No active lab. Start a lab to interact with the AI supervisor.';

  const labId = labStore.getState().current?.id ?? '';
  const stepId = labStore.getState().current?.steps[ctx.stepIdx]?.id ?? '';

  if (SUPERVISOR['config'].disabled) {
    const ladder = getHintLadder(labId, stepId);
    return `[Local hint — Ollama disabled]\n${ladder.approach}\n\nEnable AI: install Ollama (https://ollama.com) and run: ollama pull llama3.2`;
  }

  try {
    const baseUrl = (window as unknown as { env?: { OLLAMA_BASE_URL?: string } }).env?.OLLAMA_BASE_URL ?? 'http://localhost:11434';
    const model   = (window as unknown as { env?: { OLLAMA_MODEL?: string } }).env?.OLLAMA_MODEL ?? 'llama3.2';
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: `You are an expert IAM/SSO instructor at Northwind Holdings. The learner is on: Lab ${ctx.labNumber}: ${ctx.labTitle} — Step ${ctx.stepIdx + 1}/${ctx.totalSteps}: ${ctx.stepTitle}.\nStep objective: ${ctx.stepBrief}.\nUse Socratic questioning. Keep responses to 3 sentences. Never give the answer directly. Reference the audit log when guiding the learner.`,
          },
          { role: 'user', content: prompt },
        ],
        stream: false,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as { message?: { content?: string } };
    return data.message?.content ?? 'No response from AI supervisor.';
  } catch {
    const ladder = getHintLadder(labId, stepId);
    return `[Ollama offline — using local hint]\n${ladder.approach}\n\nTo enable AI: install Ollama (https://ollama.com) and run: ollama pull llama3.2`;
  }
}

async function runScoring(): Promise<void> {
  const lab = labStore.getState().current;
  const idx = labStore.getState().stepIndex;
  const step = lab?.steps[idx];
  if (!lab || !step) return;

  chatLog.push({ from: 'system', at: Date.now(), body: `Scoring step ${idx + 1}: ${step.title}…` });
  render();

  // Snapshot audit events for this step
  const allEvents = auditStore.getState().events;
  const stepEvents = allEvents.slice(-20); // last 20 events as a reasonable proxy

  const score = await SUPERVISOR.scoreStep(lab, step, idx, stepEvents);
  const total = score.exec + score.troubleshoot + score.leastPrivilege + score.docs + score.evidence + score.comms;

  chatLog.push({
    from: 'supervisor',
    at: Date.now(),
    body: score.coaching,
    score: {
      exec: score.exec, troubleshoot: score.troubleshoot, leastPrivilege: score.leastPrivilege,
      docs: score.docs, evidence: score.evidence, comms: score.comms,
      total, passed: score.passed,
    },
  });
  tutorStore.getState().addDialog({ from: 'tutor', body: score.coaching });
  render();
}

function render() {
  const body = document.getElementById('ollama-console-body');
  if (!body) return;

  const lab = labStore.getState().current;
  const idx = labStore.getState().stepIndex;
  const step = lab?.steps[idx];
  const evidenceCount = evidenceStore.getState().items.length;
  const tutorDialog = tutorStore.getState().dialog;

  const score = scoreStore.getState().current;

  body.innerHTML = `
    <div style="display:flex;flex-direction:column;height:100%;font-size:13px;">

      <div style="padding:10px 12px;background:var(--panel-2);border-bottom:1px solid var(--border);">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
          <div style="width:8px;height:8px;border-radius:50%;background:var(--accent);box-shadow:0 0 6px var(--accent);"></div>
          <strong style="color:var(--accent);">AI Supervisor</strong>
          <span style="font-size:10px;color:var(--muted);">Ollama • llama3.2</span>
          <button id="ollama-health" style="margin-left:auto;background:transparent;border:1px solid var(--border);color:var(--muted);font-size:10px;padding:2px 6px;border-radius:3px;cursor:pointer;">Check status</button>
        </div>
        ${lab && step
          ? (() => {
              const ctx = summarizeStepContext();
              return ctx
                ? `<div style="font-size:11px;color:var(--muted);line-height:1.4;">
                    Lab ${ctx.labNumber}: ${ctx.labTitle} — Step ${ctx.stepIdx + 1}/${ctx.totalSteps}: ${ctx.stepTitle}
                  </div>`
                : `<div style="font-size:11px;color:var(--muted);line-height:1.4;">
                    Step ${labStore.getState().stepIndex + 1}: ${step.title}
                  </div>`;
            })()
          : '<div style="font-size:11px;color:var(--muted);">No active lab.</div>'}
      </div>

      <div id="ollama-chat" style="flex:1;overflow-y:auto;padding:10px 12px;display:flex;flex-direction:column;gap:8px;">
        ${chatLog.length === 0
          ? `<div style="text-align:center;color:var(--muted);padding:20px;font-size:12px;">
              <div style="font-size:32px;margin-bottom:8px;">🤖</div>
              <div><strong style="color:var(--accent);">Hello, I'm your AI supervisor.</strong></div>
              <div style="margin-top:6px;line-height:1.5;">I oversee your work, score your performance,<br/>and guide you to the correct path.</div>
              <div style="margin-top:12px;font-size:11px;">Try: "Where am I stuck?" or click "Score my step".</div>
            </div>`
          : chatLog.map((m) => {
              const isUser = m.from === 'user';
              const isSystem = m.from === 'system';
              const bubbleColor = isSystem
                ? 'var(--panel-2);color:var(--muted);font-style:italic;'
                : isUser
                  ? 'var(--accent);color:var(--bg);'
                  : 'var(--panel);color:var(--fg);border:1px solid var(--border);';
              return `
                <div style="display:flex;justify-content:${isUser ? 'flex-end' : 'flex-start'};">
                  <div style="max-width:80%;background:${bubbleColor};border-radius:8px;padding:8px 10px;">
                    <div style="font-size:10px;opacity:0.7;margin-bottom:2px;">${isUser ? 'You' : isSystem ? 'System' : '🤖 Supervisor'} • ${formatTime(m.at)}</div>
                    <div style="line-height:1.5;white-space:pre-wrap;">${escapeHtml(m.body)}</div>
                    ${m.score ? `
                      <div style="margin-top:6px;padding:6px 8px;background:rgba(0,0,0,0.2);border-radius:4px;font-size:10px;font-family:monospace;line-height:1.6;">
                        <div style="color:${m.score.passed ? 'var(--accent)' : 'var(--warn)'};font-weight:bold;margin-bottom:3px;">${m.score.passed ? '✓ PASS' : '✗ REVIEW'} • ${m.score.total}/100</div>
                        <div>exec: ${m.score.exec}/25 · troubleshoot: ${m.score.troubleshoot}/20 · least-priv: ${m.score.leastPrivilege}/15</div>
                        <div>docs: ${m.score.docs}/15 · evidence: ${m.score.evidence}/15 · comms: ${m.score.comms}/10</div>
                      </div>
                    ` : ''}
                  </div>
                </div>
              `;
            }).join('')}
      </div>

      ${score ? `
        <div style="padding:8px 12px;background:var(--panel-2);border-top:1px solid var(--border);font-size:11px;">
          <div style="color:var(--accent);margin-bottom:4px;">Lab Score</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <span>exec: <strong>${score.exec}/25</strong></span>
            <span>troubleshoot: <strong>${score.troubleshoot}/20</strong></span>
            <span>least-priv: <strong>${score['least-privilege']}/15</strong></span>
            <span>docs: <strong>${score.docs}/15</strong></span>
            <span>evidence: <strong>${score.evidence}/15</strong></span>
            <span>comms: <strong>${score.comms}/10</strong></span>
            <span style="margin-left:auto;color:var(--accent);"><strong>${score.total}/100</strong></span>
          </div>
        </div>
      ` : ''}

      <div style="padding:8px 12px;border-top:1px solid var(--border);display:flex;gap:6px;">
        <input id="ollama-input" type="text" placeholder="Ask: what should I check next?"
               style="flex:1;background:var(--bg);color:var(--fg);border:1px solid var(--border);border-radius:4px;padding:6px 8px;font-size:12px;font-family:inherit;" />
        <button id="ollama-send" style="background:var(--accent);color:var(--bg);border:none;border-radius:4px;padding:6px 12px;font-size:12px;cursor:pointer;font-weight:600;">Send</button>
      </div>

      <div style="padding:6px 12px;display:flex;gap:6px;border-top:1px solid var(--border);background:var(--panel-2);">
        <button id="ollama-score" style="flex:1;background:transparent;border:1px solid var(--accent);color:var(--accent);border-radius:4px;padding:5px;font-size:11px;cursor:pointer;">📊 Score my step</button>
        <button id="ollama-where" style="flex:1;background:transparent;border:1px solid var(--border);color:var(--fg);border-radius:4px;padding:5px;font-size:11px;cursor:pointer;">🧭 Where am I stuck?</button>
        <button id="ollama-clear" style="flex:0 0 auto;background:transparent;border:1px solid var(--border);color:var(--muted);border-radius:4px;padding:5px 8px;font-size:11px;cursor:pointer;">Clear</button>
      </div>

      <div style="padding:6px 12px;font-size:10px;color:var(--muted);background:var(--bg);">
        ${tutorDialog.length} tutor message${tutorDialog.length === 1 ? '' : 's'} • ${evidenceCount} evidence collected
      </div>
    </div>
  `;

  // Wire handlers
  body.querySelector('#ollama-send')?.addEventListener('click', async () => {
    const input = body.querySelector<HTMLInputElement>('#ollama-input')!;
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    chatLog.push({ from: 'user', at: Date.now(), body: text });
    render();
    // Scroll to bottom
    const chat = body.querySelector('#ollama-chat');
    if (chat) chat.scrollTop = chat.scrollHeight;

    const response = await callSupervisorDirect(text);
    chatLog.push({ from: 'supervisor', at: Date.now(), body: response });
    render();
    if (chat) chat.scrollTop = chat.scrollHeight;
  });

  body.querySelector('#ollama-input')?.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Enter') {
      body.querySelector<HTMLButtonElement>('#ollama-send')?.click();
    }
  });

  body.querySelector('#ollama-score')?.addEventListener('click', () => { void runScoring(); });
  body.querySelector('#ollama-where')?.addEventListener('click', async () => {
    chatLog.push({ from: 'user', at: Date.now(), body: 'Where am I stuck?' });
    render();
    const r = await callSupervisorDirect('Where am I stuck? What is the smallest verifiable step I can take right now?');
    chatLog.push({ from: 'supervisor', at: Date.now(), body: r });
    render();
  });
  body.querySelector('#ollama-clear')?.addEventListener('click', () => {
    chatLog.length = 0;
    render();
  });
  body.querySelector('#ollama-health')?.addEventListener('click', async () => {
    const status = await SUPERVISOR.healthCheck();
    chatLog.push({
      from: 'system',
      at: Date.now(),
      body: `Ollama status: ${status.toUpperCase()}. ${status === 'online' ? 'AI coaching available.' : status === 'disabled' ? 'Local-only mode.' : 'Ollama unreachable — using local fallback hints.'}`,
    });
    render();
  });

  // Auto-scroll to bottom on re-render
  const chat = body.querySelector('#ollama-chat');
  if (chat) chat.scrollTop = chat.scrollHeight;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

let subscribed = false;
function ensureSubscriptions() {
  if (subscribed) return;
  subscribed = true;
  labStore.subscribe(render);
  auditStore.subscribe(render);
  scoreStore.subscribe(render);
  evidenceStore.subscribe(render);
  tutorStore.subscribe(render);
}

export function renderOllamaConsole(body: HTMLElement, _conductor: Conductor) {
  body.id = 'ollama-console-body';
  body.style.cssText = 'height:100%;overflow:hidden;';
  ensureSubscriptions();
  render();
}
