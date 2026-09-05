/**
 * services/labFlavorGenerator.ts — asks local Ollama for the ticket
 * narrative + coaching question for one AI-generated daily-ticket lab,
 * or a batch-flavor for a multi-ticket queue lab.
 *
 * Deliberately the smallest possible AI surface: two short strings (or one
 * batch flavor object), given real facts (a real seeded person's name/title/
 * department, a real ticket type) as context. Never asked to invent IDs,
 * users, or lab structure —
 * see docs/superpowers/specs/2026-09-03-ai-generated-daily-tickets-design.md.
 *
 * Mirrors ollamaSupervisor.ts's call shape exactly: same base URL
 * resolution, same disabled-flag short-circuit, same timeout, same
 * graceful fallback so a click never fails even with Ollama offline.
 */

export interface GeneratedFlavor {
  narrative: string;
  coachingQuestion: string;
}

export interface BatchFlavor {
  narrative: string;
  coachingQuestion: string;
  /** Per-ticket specific subjects (optional, may be empty to use generic). */
  ticketSubjects?: string[];
}

export interface FlavorRequest {
  ticketTypeLabel: string;
  targetDisplayName: string;
  targetTitle: string;
  targetDept: string;
}

export interface BatchFlavorRequest {
  /** Lab type label, e.g. "Help Desk Queue (10 tickets)" */
  labLabel: string;
  /** Number of tickets in this batch. */
  ticketCount: number;
  /** Zone context, e.g. "help-desk", "iam-ops", "sec-ops". */
  zoneId: string;
  /** List of generic ticket subject labels (already defined in templates). */
  ticketSubjects: string[];
}

const SYSTEM_PROMPT = `You are a cybersecurity and IT-helpdesk operations expert writing a short, realistic daily support ticket for an internal training simulation at a mid-size company. You are given the real facts below — do not invent any names, titles, departments, or IDs beyond what's given. Write only what's asked, in plain prose, no markdown.

Respond with strict JSON only, no other text:
{"narrative": "<2-3 sentence realistic ticket description, written from the reporter's or IT's point of view>", "coachingQuestion": "<one Socratic diagnostic question a mentor would ask the learner — never reveal the answer>"}`;

const BATCH_SYSTEM_PROMPT = `You are a cybersecurity and IT-helpdesk operations expert writing a brief, realistic scenario narrative for an internal training simulation at a mid-size company. The lab will spawn a queue of ${'${ticketCount}'} tickets. You are given the lab type, the zone, and the list of ticket subjects already defined. Do not invent new ticket subjects — use what is given. Write only what's asked, in plain prose, no markdown.

Respond with strict JSON only, no other text:
{"narrative": "<2-3 sentence scenario framing for the queue: who is the IT team supporting, what time of day, what kind of day this is shaping up to be>", "coachingQuestion": "<one Socratic triage question: how should the learner approach a queue of this many tickets?>", "ticketSubjects": []}`;

function ollamaDisabled(): boolean {
  if (typeof window === 'undefined') return true;
  return (
    (window as unknown as { env?: { OLLAMA_DISABLED?: string } }).env?.OLLAMA_DISABLED === 'true'
  );
}
function ollamaBaseUrl(): string {
  if (typeof window === 'undefined') return 'http://localhost:11434';
  return (
    (window as unknown as { env?: { OLLAMA_BASE_URL?: string } }).env?.OLLAMA_BASE_URL ??
    'http://localhost:11434'
  );
}
function ollamaModel(): string {
  if (typeof window === 'undefined') return 'llama3.2';
  return (window as unknown as { env?: { OLLAMA_MODEL?: string } }).env?.OLLAMA_MODEL ?? 'llama3.2';
}

function fallbackFlavor(req: FlavorRequest): GeneratedFlavor {
  return {
    narrative: `${req.targetDisplayName} (${req.targetTitle}, ${req.targetDept}) has an open "${req.ticketTypeLabel}" ticket that needs to be resolved.`,
    coachingQuestion: 'What is the first thing you would verify before making any change?',
  };
}

function fallbackBatchFlavor(req: BatchFlavorRequest): BatchFlavor {
  return {
    narrative: `A queue of ${req.ticketCount} tickets has landed in the ${req.labLabel} workspace this morning. Triage by priority, then resolve each one using the appropriate console.`,
    coachingQuestion:
      'When faced with many tickets at once, what is the first thing you should do before opening any individual ticket?',
    ticketSubjects: [],
  };
}

function isValidFlavor(v: unknown): v is GeneratedFlavor {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o['narrative'] === 'string' &&
    o['narrative'].length > 0 &&
    o['narrative'].length < 1000 &&
    typeof o['coachingQuestion'] === 'string' &&
    o['coachingQuestion'].length > 0 &&
    o['coachingQuestion'].length < 500
  );
}

function isValidBatchFlavor(v: unknown): v is BatchFlavor {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  if (
    typeof o['narrative'] !== 'string' ||
    o['narrative'].length === 0 ||
    o['narrative'].length >= 1000
  )
    return false;
  if (
    typeof o['coachingQuestion'] !== 'string' ||
    o['coachingQuestion'].length === 0 ||
    o['coachingQuestion'].length >= 500
  )
    return false;
  if (o['ticketSubjects'] !== undefined && !Array.isArray(o['ticketSubjects'])) return false;
  return true;
}

export async function generateFlavor(req: FlavorRequest): Promise<GeneratedFlavor> {
  if (ollamaDisabled()) return fallbackFlavor(req);

  try {
    const res = await fetch(`${ollamaBaseUrl()}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ollamaModel(),
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Ticket type: ${req.ticketTypeLabel}\nReporter/subject: ${req.targetDisplayName}, ${req.targetTitle}, ${req.targetDept} department.`,
          },
        ],
        stream: false,
      }),
      signal: AbortSignal.timeout(90000),
    });
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    const data = (await res.json()) as { message?: { content?: string } };
    const raw = (data.message?.content ?? '')
      .replace(/^```json\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
    const parsed = JSON.parse(raw) as unknown;
    if (isValidFlavor(parsed)) return parsed;
    return fallbackFlavor(req);
  } catch {
    return fallbackFlavor(req);
  }
}

/** Generate a flavor for a batch (multi-ticket) lab. */
export async function generateBatchFlavor(req: BatchFlavorRequest): Promise<BatchFlavor> {
  if (ollamaDisabled()) return fallbackBatchFlavor(req);

  try {
    const systemContent = BATCH_SYSTEM_PROMPT.replace('${ticketCount}', String(req.ticketCount));
    const userContent = `Lab: ${req.labLabel}\nZone: ${req.zoneId}\nTicket count: ${req.ticketCount}\nTicket subjects already defined: ${req.ticketSubjects.join(' | ')}`;
    const res = await fetch(`${ollamaBaseUrl()}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ollamaModel(),
        messages: [
          { role: 'system', content: systemContent },
          { role: 'user', content: userContent },
        ],
        stream: false,
      }),
      signal: AbortSignal.timeout(90000),
    });
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    const data = (await res.json()) as { message?: { content?: string } };
    const raw = (data.message?.content ?? '')
      .replace(/^```json\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
    const parsed = JSON.parse(raw) as unknown;
    if (isValidBatchFlavor(parsed)) {
      // Always use our pre-defined subjects; ignore whatever the model returned.
      return { ...parsed, ticketSubjects: [] };
    }
    return fallbackBatchFlavor(req);
  } catch {
    return fallbackBatchFlavor(req);
  }
}
