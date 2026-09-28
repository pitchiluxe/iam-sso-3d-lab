/**
 * services/labFlavorGenerator.ts — asks local Ollama for the ticket
 * narrative + coaching question for one AI-generated daily-ticket lab,
 * or a batch-flavor for a multi-ticket queue lab.
 *
 * Deliberately the smallest possible AI surface: two short strings (or one
 * batch flavor object), given real facts as context — the company, the
 * person, who reported it, and the exact work the lab grades. Never asked to
 * invent IDs, users, groups or lab structure —
 * see docs/superpowers/specs/2026-09-03-ai-generated-daily-tickets-design.md.
 *
 * A 3B model invents names regardless of instructions, and an invented group
 * in the narrative sits one sentence before the graded instruction naming the
 * real one. So every reply is checked against the facts (groundedNarrative)
 * and replaced by a written-from-facts narrative when it strays.
 *
 * Mirrors ollamaSupervisor.ts's call shape: same base URL resolution, same
 * disabled-flag short-circuit, same graceful fallback so a click never fails
 * even with Ollama offline.
 */
import { COMPANY, DEPARTMENTS } from '@/config/company';

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
  /** Who raised the ticket, e.g. "Greta Olsen (CFO)" or "HR (automated feed)". */
  requester?: string;
  /**
   * The exact work the lab grades, in plain sentences. The only groups,
   * accounts, apps and addresses the narrative may name are the ones here.
   */
  facts?: string[];
  /** The IAM lifecycle stage, e.g. "joiner", "leaver", "privileged access". */
  lifecycle?: string;
}

export interface BatchFlavorRequest {
  /** Lab type label, e.g. "Help Desk Queue (10 tickets)" */
  labLabel: string;
  /** Number of tickets in this batch. */
  ticketCount: number;
  /** Zone context, e.g. "help-desk", "iam-ops", "sec-ops". */
  zoneId: string;
  /** The real subjects of the tickets in this queue. */
  ticketSubjects: string[];
}

/** Who the AI is writing for. Every ticket happens at this company. */
export const ORG_CONTEXT = [
  `Company: ${COMPANY.name}, a mid-size company (domain ${COMPANY.domain}).`,
  `Departments: ${DEPARTMENTS.join(', ')}.`,
  'Identity stack: on-premises Active Directory (managed in Active Directory Users and Computers), ' +
    `a single sign-on identity provider (${COMPANY.idpUrl}) with MFA, and a Ticket Queue for the service desk.`,
  'Business apps behind SSO: HR Portal, Finance Portal, Help Desk Portal, VPN Portal, Admin Console.',
  'IT teams: Help Desk (tier 1), IAM Operations, Security Operations, Engineering.',
].join('\n');

const SYSTEM_PROMPT = `You write one realistic service-desk ticket for an identity and access management (IAM) training simulation. Everything happens at this organisation:

${ORG_CONTEXT}

You are given the person, who reported it, the IAM lifecycle stage, and the EXACT work required. Write the ticket the way it really arrives — from the requester's point of view (an employee, a manager, HR, or a security alert), with the business reason: a start date, a promotion, a departure, a lost phone, an audit finding.

HARD RULES:
- Use ONLY names from the facts: the person, the requester, and every group, account, application, role, IP address and ticket id exactly as written there. Never invent a group, role, account, app or address.
- Do not tell the learner how to do the work step by step; the lab adds the graded instructions after your text.
- 2-3 sentences, plain prose, no markdown, no greeting or signature.

Respond with strict JSON only:
{"narrative": "<the ticket text>", "coachingQuestion": "<one Socratic question a senior IAM engineer would ask before the change — about verification, least privilege, approval or evidence — never the answer>"}`;

const BATCH_SYSTEM_PROMPT = `You write the scene-setting paragraph for a service-desk queue in an IAM training simulation at this organisation:

${ORG_CONTEXT}

You are given the queue, the team working it, and the real subjects of its tickets. Frame the team's day realistically (time of day, what is driving the volume — quarter close, a reorg, a phishing wave, new-starter Monday) using the subjects given. Do not invent people, groups or systems that are not in the subjects or the organisation above. Plain prose, no markdown.

Respond with strict JSON only:
{"narrative": "<2-3 sentences>", "coachingQuestion": "<one Socratic triage question: how should the learner order and verify a queue like this?>", "ticketSubjects": []}`;

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

/** Coaching questions a senior engineer asks, by lifecycle stage. */
const COACHING: Record<string, string> = {
  joiner: 'Who approved this access, and what is the least the person needs on day one?',
  mover: 'Which of the old access should disappear today, and how would you prove it did?',
  leaver: 'If this account were re-enabled tomorrow by mistake, what could it still reach?',
  'access-request': 'Who owns the resource being requested, and did they approve it?',
  authentication:
    'How do you confirm you are talking to the real account owner before you touch the credential?',
  'privileged-access': 'Does this person need the privilege permanently, or only for a task?',
  'access-review': 'What evidence would an auditor want that this access was reviewed and removed?',
  incident:
    'What do you contain first, and what evidence must you keep before you change anything?',
  'service-account':
    'Who owns this service account, and what is the narrowest permission the job needs?',
  policy: 'Who will this change affect on the next sign-in, and how will you tell them?',
  hygiene: 'How do you prove which account is the real one before deleting anything?',
};

export function fallbackFlavor(req: FlavorRequest): GeneratedFlavor {
  const who = `${req.targetDisplayName} (${req.targetTitle}, ${req.targetDept})`;
  const from = req.requester ? `Raised by ${req.requester}: ` : '';
  return {
    narrative: `${from}${req.ticketTypeLabel} for ${who}. Logged with the ${COMPANY.name} service desk.`,
    coachingQuestion:
      COACHING[req.lifecycle ?? ''] ??
      'What is the first thing you would verify before making any change?',
  };
}

function fallbackBatchFlavor(req: BatchFlavorRequest): BatchFlavor {
  return {
    narrative: `A queue of ${req.ticketCount} tickets has landed in the ${req.labLabel} workspace at ${COMPANY.name} this morning. Triage by priority, then resolve each one using the appropriate console.`,
    coachingQuestion:
      'When faced with many tickets at once, what is the first thing you should do before opening any individual ticket?',
    ticketSubjects: [],
  };
}

/** Identifiers a narrative could get wrong: groups, roles, accounts, apps, addresses. */
const IDENTIFIER =
  /\b(?:grp|role|svc|app)-[a-z0-9-]+\b|\b[a-z]+\.[a-z]+[0-9]*\b|\b\d{1,3}(?:\.\d{1,3}){3}\b/gi;

/** Words with a dot that are not accounts: the company's own domain names. */
const NOT_AN_ACCOUNT = new Set(
  [COMPANY.domain, ...COMPANY.domain.split('.')].map((s) => s.toLowerCase()),
);

/**
 * True when every group, role, account, app and IP address the text names
 * appears in the facts (or is the company's own domain). A narrative that
 * names something else is inventing it.
 */
/** The business apps behind SSO. Naming one the ticket is not about adds work nobody grades. */
const APP_NAMES = [
  'HR Portal',
  'Finance Portal',
  'Help Desk Portal',
  'VPN Portal',
  'Admin Console',
];

export function groundedNarrative(text: string, allowed: string[]): boolean {
  const pool = allowed.join(' ').toLowerCase();
  for (const app of APP_NAMES) {
    if (text.toLowerCase().includes(app.toLowerCase()) && !pool.includes(app.toLowerCase()))
      return false;
  }
  for (const raw of text.match(IDENTIFIER) ?? []) {
    const id = raw.toLowerCase().replace(/[.,;:]+$/, '');
    if (NOT_AN_ACCOUNT.has(id) || id.endsWith(`.${COMPANY.tld}`)) continue;
    if (!pool.includes(id)) return false;
  }
  return true;
}

function isValidFlavor(v: unknown): v is GeneratedFlavor {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o['narrative'] === 'string' &&
    o['narrative'].length > 20 &&
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

async function chat(system: string, user: string): Promise<unknown> {
  const res = await fetch(`${ollamaBaseUrl()}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: ollamaModel(),
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      format: 'json',
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
  return JSON.parse(raw) as unknown;
}

/** At most `n` sentences: a small model runs on, and a ticket is not an essay. */
export function firstSentences(text: string, n = 3): string {
  const parts = text.trim().match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) ?? [text];
  return parts.slice(0, n).join('').trim();
}

/** What the model is told: the person, the requester, the stage and the exact work. */
export function flavorPrompt(req: FlavorRequest): string {
  return [
    `Ticket type: ${req.ticketTypeLabel}`,
    ...(req.lifecycle ? [`IAM lifecycle stage: ${req.lifecycle}`] : []),
    `Person: ${req.targetDisplayName}, ${req.targetTitle}, ${req.targetDept} department.`,
    ...(req.requester ? [`Reported by: ${req.requester}`] : []),
    ...(req.facts?.length
      ? ['Facts (the only names you may use):', ...req.facts.map((f) => `- ${f}`)]
      : []),
  ].join('\n');
}

export async function generateFlavor(req: FlavorRequest): Promise<GeneratedFlavor> {
  if (ollamaDisabled()) return fallbackFlavor(req);
  try {
    const parsed = await chat(SYSTEM_PROMPT, flavorPrompt(req));
    if (!isValidFlavor(parsed)) return fallbackFlavor(req);
    const allowed = [req.targetDisplayName, req.requester ?? '', ...(req.facts ?? [])];
    // An invented group or account would contradict the graded instruction
    // that follows it, so a reply that names one is not used.
    if (!groundedNarrative(parsed.narrative, allowed)) {
      return { ...fallbackFlavor(req), coachingQuestion: parsed.coachingQuestion };
    }
    return { ...parsed, narrative: firstSentences(parsed.narrative) };
  } catch {
    return fallbackFlavor(req);
  }
}

/** Generate a flavor for a batch (multi-ticket) lab. */
export async function generateBatchFlavor(req: BatchFlavorRequest): Promise<BatchFlavor> {
  if (ollamaDisabled()) return fallbackBatchFlavor(req);
  try {
    const userContent = [
      `Queue: ${req.labLabel}`,
      `Team: ${req.zoneId}`,
      `Ticket count: ${req.ticketCount}`,
      'Ticket subjects:',
      ...req.ticketSubjects.map((s) => `- ${s}`),
    ].join('\n');
    const parsed = await chat(BATCH_SYSTEM_PROMPT, userContent);
    if (!isValidBatchFlavor(parsed)) return fallbackBatchFlavor(req);
    if (!groundedNarrative(parsed.narrative, req.ticketSubjects)) {
      return { ...fallbackBatchFlavor(req), coachingQuestion: parsed.coachingQuestion };
    }
    // Always use our pre-defined subjects; ignore whatever the model returned.
    return { ...parsed, ticketSubjects: [] };
  } catch {
    return fallbackBatchFlavor(req);
  }
}
