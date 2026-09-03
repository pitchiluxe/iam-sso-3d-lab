/**
 * services/ollamaSupervisor.ts — AI supervisor powered by a local Ollama LLM.
 *
 * Responsibilities:
 *   - Score learner performance after each step (exec, troubleshoot, least-priv, docs, evidence, comms)
 *   - Provide Socratic coaching (never gives the answer) based on audit log events and step context
 *   - Generate per-step feedback and a debrief summary at lab completion
 *   - Send messages to the tutor dialog via tutorStore
 *
 * Configuration:
 *   Set OLLAMA_BASE_URL in window.env (defaults to http://localhost:11434).
 *   Model is configured via window.env.OLLAMA_MODEL (default: llama3.2).
 *   Disable via window.env.OLLAMA_DISABLED=true (no network call, uses local hints).
 */
import { tutorStore } from '@/stores';
import type { Lab, LabStep, AuditEvent } from '@/domain';

const DEFAULT_BASE_URL = 'http://localhost:11434';
const DEFAULT_MODEL = 'llama3.2';

export interface OllamaConfig {
  baseUrl?: string;
  model?: string;
  /** Set to true to skip LLM calls (uses built-in scoring). */
  disabled?: boolean;
}

interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OllamaChatResponse {
  message: { role: string; content: string };
  done: boolean;
}

export interface StepScore {
  exec: number;
  troubleshoot: number;
  leastPrivilege: number;
  docs: number;
  evidence: number;
  comms: number;
  coaching: string;
  passed: boolean;
}

function ollamaBaseUrl(): string {
  return (
    (window as unknown as { env?: { OLLAMA_BASE_URL?: string } }).env?.OLLAMA_BASE_URL ??
    DEFAULT_BASE_URL
  );
}
function ollamaModel(): string {
  return (
    (window as unknown as { env?: { OLLAMA_MODEL?: string } }).env?.OLLAMA_MODEL ?? DEFAULT_MODEL
  );
}
function isDisabled(): boolean {
  return (
    (window as unknown as { env?: { OLLAMA_DISABLED?: string } }).env?.OLLAMA_DISABLED === 'true'
  );
}

// ---------------------------------------------------------------------------
// System prompts
// ---------------------------------------------------------------------------

/**
 * CORE_SYSTEM_PROMPT — used for the "Score my step" / "Where am I stuck?" buttons.
 * Socratic-first: the supervisor never gives the answer directly. The supervisor
 * asks the right diagnostic question and points to the smallest verifiable next
 * action, grounded in the current step's objective and the learner's audit log.
 */
const CORE_SYSTEM_PROMPT = `You are an expert IAM/SSO instructor at Northwind Holdings overseeing a learner's performance in a realistic enterprise identity lab (Apex Identity Platform). You watch their audit log and guide them with Socratic coaching.

HARD RULES — never violate:
1. NEVER give the final answer. The learner must discover it. If they ask "what should I do", respond with a diagnostic question, not an action.
2. NEVER reveal exact resource IDs, validator parameters, or specific evidence values.
3. NEVER name the exact file path, button, or value the system is checking for. Point to the area, not the target.
4. Reference the step's objective and the learner's most recent audit events. Be specific to what they just did.
5. Keep every response to 3 sentences maximum.

COACHING STYLE (use this exact structure, no markdown):
HINT:   [one diagnostic question that steers the learner's reasoning]
STATUS: [on-track | stuck | needs-evidence | complete]
NEXT:   [the single smallest verifiable action they should take right now]

WHEN TO USE EACH HINT LEVEL:
- The learner is just starting: ask a Socratic question about the OBJECTIVE itself.
- The learner has tried once: ask a Socratic question about the AUDIT LOG (what does it show?).
- The learner is stuck: name the AREA (which console, which form) but not the field or value.
- The learner explicitly switches to "explanation mode" or asks for the answer three times: only then reveal the approach-level answer from the hint ladder.

CONSOLE LAYOUT THE LEARNER CAN ACTUALLY SEE:
- IAM Console: provision/edit/disable/delete users, create/edit/delete groups, manage group membership, MFA policy, register apps, verify sign-in.
- Ticket Console: read incoming tickets, triage, resolve, escalate.
- SecOps Dashboard: alerts, audit log, session revocation, fault indicators, role assignments.
- AI Supervisor (this console): ask questions, score your step, request hints.

DOMAIN GRAPH (use this when naming areas, not specific IDs):
- Users have: username, displayName, email, department, title, MFA method, status (active/disabled), group memberships.
- Groups have: name (convention: grp-<dept>-<role>), description, members.
- Apps have: name, protocol (SAML/OIDC), status (configured/misconfigured/down), MFA requirement, required roles.
- Tickets have: id, requester, action (create/modify/disable/delete), target, priority, state.
- Audit log records every action: user.created, user.updated, user.disabled, user.deleted, group.created, group.add, group.remove, group.updated, group.deleted, role.grant, role.revoke, app.config.fixed, signin.succeeded, mfa.challenge.completed, session.revoked, fault.cleared, evidence.collected.

SCORING RUBRIC (when the learner clicks "Score my step"):
- exec            0-25: completed the required action correctly
- troubleshoot    0-20: diagnosed any failures before marking done
- least-privilege 0-15: used correct naming convention and minimum permissions
- docs            0-15: documented the action in evidence
- evidence        0-15: captured snapshots or log excerpts
- comms           0-10: communicated appropriately to stakeholders

When scoring, respond with this JSON object only (no markdown, no extra text):
{
  "exec": <0-25>,
  "troubleshoot": <0-20>,
  "leastPrivilege": <0-15>,
  "docs": <0-15>,
  "evidence": <0-15>,
  "comms": <0-10>,
  "coaching": "<3-sentence coaching using HINT/STATUS/NEXT format above>",
  "passed": <true if total >= 60, false otherwise>
}`;

const SYSTEM_PROMPT = CORE_SYSTEM_PROMPT;

function buildScoringPrompt(
  lab: Lab,
  step: LabStep,
  stepIndex: number,
  events: AuditEvent[],
): string {
  const eventSummary =
    events.length === 0
      ? 'No audit events recorded yet for this step.'
      : events
          .slice(-10)
          .map(
            (e) =>
              `[${new Date(e.at).toLocaleTimeString()}] ${e.actorId}: ${e.action} target=${e.targetId ?? ''} subject=${e.subjectId ?? ''}`,
          )
          .join('\n');

  const tutorPrompts = (step.tutorPrompts ?? []).join(' | ') || 'None provided';

  return `CURRENT STEP — Lab ${lab.number}: ${lab.title} / Step ${stepIndex + 1}: ${step.title}
OBJECTIVE: ${step.brief}
TUTOR PROMPTS FOR THIS STEP (use these as diagnostic question seeds, do NOT repeat them verbatim): ${tutorPrompts}

LAST 10 AUDIT EVENTS (what the learner actually did):
${eventSummary}

Score the learner on the 6-category rubric. In the "coaching" field, use the HINT/STATUS/NEXT format. Do not reveal the validator or specific resource IDs. Output JSON only.`;
}

// ---------------------------------------------------------------------------
// Local (non-LLM) fallback scorer
// ---------------------------------------------------------------------------

const STEP_PASS_THRESHOLDS: Record<string, number> = {
  'ticket-resolved': 1,
  'user-disabled': 1,
  'user-enabled': 1,
  'user-created': 1,
  'user-moved': 1,
  'group-created': 1,
  'group-added': 1,
  'group-removed': 1,
  'role-granted': 1,
  'role-revoked': 1,
  'app-config-fixed': 1,
  'signin-succeeded': 1,
  'mfa-challenge-completed': 1,
  'mfa-policy-enforced': 1,
  'session-revoked': 1,
  'fault-cleared': 1,
  'evidence-collected': 1,
  'user-deleted': 1,
};

function localFallbackScore(
  events: AuditEvent[],
  step: LabStep,
  params: Record<string, string>,
): StepScore {
  const { kind } = step.validator;
  const required = params.userId ?? params.groupId ?? params.ticketId ?? params.appId ?? '';

  const matched = events.filter((e) => {
    if (
      e.action ===
      kind
        .replace(/-([a-z])/g, (_, c) => c.toUpperCase())
        .replace(/([A-Z])/g, '.$1')
        .toLowerCase()
    ) {
      return true;
    }
    return e.targetId === required || e.subjectId === required;
  });

  const passed = matched.length >= (STEP_PASS_THRESHOLDS[kind] ?? 1);
  const evidencePct =
    events.filter((e) => e.action.includes('log') || e.action.includes('audit')).length > 0
      ? 1.0
      : 0.0;

  return {
    exec: passed ? 20 : 0,
    troubleshoot: passed ? 15 : 5,
    leastPrivilege: passed ? 12 : 5,
    docs: evidencePct ? 12 : 5,
    evidence: evidencePct ? 12 : 0,
    comms: passed ? 8 : 3,
    coaching: passed
      ? 'Good work completing the step. Review the audit log to confirm your changes are reflected there before moving on.'
      : 'Not quite — check the audit log to see if your action was recorded. Review the validator requirement in the briefing panel.',
    passed,
  };
}

// ---------------------------------------------------------------------------
// OllamaSupervisor
// ---------------------------------------------------------------------------

export class OllamaSupervisor {
  private config: OllamaConfig;

  constructor(config: OllamaConfig = {}) {
    this.config = { disabled: isDisabled(), ...config };
  }

  /** Called after each step completes. Returns a score + coaching message. */
  async scoreStep(
    lab: Lab,
    step: LabStep,
    stepIndex: number,
    events: AuditEvent[],
  ): Promise<StepScore> {
    // Local fallback
    if (this.config.disabled ?? isDisabled()) {
      return localFallbackScore(events, step, step.validator.params as Record<string, string>);
    }

    try {
      const score = await this._callLlm(lab, step, stepIndex, events);
      this._coachLearner(score, lab, stepIndex);
      return score;
    } catch (err) {
      console.warn('[ollama] LLM call failed, using local scorer:', err);
      const fallback = localFallbackScore(
        events,
        step,
        step.validator.params as Record<string, string>,
      );
      tutorStore.getState().addDialog({
        from: 'system',
        body: 'AI Supervisor unavailable — using local scoring. Configure Ollama at http://localhost:11434 for AI-powered coaching.',
      });
      return fallback;
    }
  }

  /** Called at lab completion. Returns a debrief message from the supervisor. */
  async generateDebrief(lab: Lab, allEvents: AuditEvent[]): Promise<string> {
    if (this.config.disabled ?? isDisabled()) {
      return `Lab "${lab.title}" complete. Review your audit log and evidence in the debrief screen. Key areas to revisit: ${lab.debriefQuestions[0] ?? 'check your step outcomes'}.`;
    }

    try {
      const messages: OllamaMessage[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Lab complete: ${lab.title}\nTotal audit events: ${allEvents.length}\n\nProvide a brief (3 sentences) summary of this learner's overall performance and one area they should focus on improving.`,
        },
      ];

      const response = await this._chat(messages);
      return response ?? 'Lab complete. Review the debrief screen for your score breakdown.';
    } catch {
      return 'Lab complete. Your score has been recorded. Review the debrief screen for details.';
    }
  }

  /** Check if Ollama is reachable. Returns 'online' | 'offline' | 'disabled'. */
  async healthCheck(): Promise<'online' | 'offline' | 'disabled'> {
    if (this.config.disabled ?? isDisabled()) return 'disabled';
    try {
      const res = await fetch(`${this.config.baseUrl ?? ollamaBaseUrl()}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      return res.ok ? 'online' : 'offline';
    } catch {
      return 'offline';
    }
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private async _callLlm(
    lab: Lab,
    step: LabStep,
    stepIndex: number,
    events: AuditEvent[],
  ): Promise<StepScore> {
    const messages: OllamaMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildScoringPrompt(lab, step, stepIndex, events) },
    ];

    const content = await this._chat(messages);
    return this._parseScore(content ?? '{}', step, events);
  }

  private async _chat(messages: OllamaMessage[]): Promise<string | null> {
    const baseUrl = this.config.baseUrl ?? ollamaBaseUrl();
    const model = this.config.model ?? ollamaModel();

    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: false }),
      // 90s: tolerate a cold model load, not just a warm inference call.
      signal: AbortSignal.timeout(90000),
    });

    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    const data: OllamaChatResponse = (await res.json()) as OllamaChatResponse;
    return data.message?.content ?? null;
  }

  private _parseScore(raw: string, step: LabStep, events: AuditEvent[]): StepScore {
    try {
      // Strip markdown code fences if present
      const json = raw
        .replace(/^```json\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();
      const obj = JSON.parse(json) as Partial<StepScore>;
      const passed = typeof obj.passed === 'boolean' ? obj.passed : (obj.exec ?? 0) >= 15;
      return {
        exec: Math.max(0, Math.min(25, obj.exec ?? 0)),
        troubleshoot: Math.max(0, Math.min(20, obj.troubleshoot ?? 0)),
        leastPrivilege: Math.max(0, Math.min(15, obj.leastPrivilege ?? 0)),
        docs: Math.max(0, Math.min(15, obj.docs ?? 0)),
        evidence: Math.max(0, Math.min(15, obj.evidence ?? 0)),
        comms: Math.max(0, Math.min(10, obj.comms ?? 0)),
        coaching:
          typeof obj.coaching === 'string' && obj.coaching.length > 0
            ? obj.coaching
            : 'Step complete. Review your audit log to confirm the action was recorded.',
        passed,
      };
    } catch {
      return localFallbackScore(events, step, step.validator.params as Record<string, string>);
    }
  }

  private _coachLearner(score: StepScore, lab: Lab, stepIndex: number) {
    const prefix = score.passed ? '✅' : '⚠️';
    tutorStore.getState().addDialog({
      from: 'tutor',
      body: `${prefix} Step ${stepIndex + 1} complete. ${score.coaching}`,
      promptIds: [`${lab.id}.s${stepIndex + 1}`],
    });
  }
}
