/**
 * labs/generated/namePool.ts — a small pool of fresh, fictional-but-realistic
 * full names for the new-hire/contractor generated-lab templates. Never
 * AI-invented — picked deterministically and tracked in the same persisted
 * dedup ledger as generated-lab templates (see stores/generatedLabsStore.ts).
 */
export interface PoolName {
  displayName: string;
  username: string;
}

function toUsername(displayName: string): string {
  return displayName
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((part) => part.replace(/[^a-z]/g, ''))
    .join('.');
}

const FULL_NAMES = [
  'Maria Gonzalez',
  'James Chen',
  'Priya Sharma',
  "Liam O'Brien",
  'Fatima Al-Sayed',
  'Noah Kim',
  'Olivia Nguyen',
  'Ethan Rossi',
  'Amara Okafor',
  'Lucas Silva',
  'Sofia Kowalski',
  'Ravi Patel',
  'Chloe Dubois',
  'Tariq Hassan',
  'Emma Larsson',
  'Diego Fernandez',
  'Yuki Tanaka',
  'Grace Osei',
  'Mateus Costa',
  'Anya Petrov',
];

export const NAME_POOL: PoolName[] = FULL_NAMES.map((displayName) => ({
  displayName,
  username: toUsername(displayName),
}));

/** Pick a name not in `usedNames`, or the least-recently-used one once the
 * whole pool has been used at least once. */
export function pickUnusedName(usedNames: string[]): PoolName {
  const unused = NAME_POOL.find((n) => !usedNames.includes(n.displayName));
  if (unused) return unused;
  // Pool exhausted — reuse the one used longest ago (first in usedNames
  // that still matches a pool entry, in pool order for determinism).
  const oldestUsed = usedNames.find((name) => NAME_POOL.some((n) => n.displayName === name));
  return NAME_POOL.find((n) => n.displayName === oldestUsed) ?? NAME_POOL[0]!;
}
