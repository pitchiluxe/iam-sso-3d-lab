/**
 * services/labFlavorGenerator.ts — asks local Ollama for the ticket
 * narrative + coaching question for one AI-generated daily-ticket lab.
 *
 * Deliberately the smallest possible AI surface: two short strings, given
 * real facts (a real seeded person's name/title/department, a real ticket
 * type) as context. Never asked to invent IDs, users, or lab structure —
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

export interface FlavorRequest {
  ticketTypeLabel: string;
  targetDisplayName: string;
  targetTitle: string;
  targetDept: string;
}

const SYSTEM_PROMPT = `You are a cybersecurity and IT-helpdesk operations expert writing a short, realistic daily support ticket for an internal training simulation at a mid-size company. You are given the real facts below — do not invent any names, titles, departments, or IDs beyond what's given. Write only what's asked, in plain prose, no markdown.

Respond with strict JSON only, no other text:
{"narrative": "<2-3 sentence realistic ticket description, written from the reporter's or IT's point of view>", "coachingQuestion": "<one Socratic diagnostic question a mentor would ask the learner — never reveal the answer>"}`;

function ollamaDisabled(): boolean {
  return (
    (window as unknown as { env?: { OLLAMA_DISABLED?: string } }).env?.OLLAMA_DISABLED === 'true'
  );
}
function ollamaBaseUrl(): string {
  return (
    (window as unknown as { env?: { OLLAMA_BASE_URL?: string } }).env?.OLLAMA_BASE_URL ??
    'http://localhost:11434'
  );
}
function ollamaModel(): string {
  return (window as unknown as { env?: { OLLAMA_MODEL?: string } }).env?.OLLAMA_MODEL ?? 'llama3.2';
}

function fallbackFlavor(req: FlavorRequest): GeneratedFlavor {
  return {
    narrative: `${req.targetDisplayName} (${req.targetTitle}, ${req.targetDept}) has an open "${req.ticketTypeLabel}" ticket that needs to be resolved.`,
    coachingQuestion: 'What is the first thing you would verify before making any change?',
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
