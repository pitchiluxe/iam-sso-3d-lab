/**
 * config/scoring.ts — the 100-point rubric constants.
 * These are shared by score.ts and referenced in debrief.ts.
 */
export const SCORING = {
  exec: 25,
  troubleshoot: 20,
  leastPrivilege: 15,
  docs: 15,
  evidence: 15,
  comms: 10,
} as const;

export const POINTS_TOTAL = Object.values(SCORING).reduce((a, b) => a + b, 0);
// 25+20+15+15+15+10 = 100
assert(POINTS_TOTAL === 100, 'Scoring rubric must sum to 100');

/** Penalty per failed validate call (capped). */
export const PENALTY_PER_FAIL = 2;
export const PENALTY_CAP = 10;

/** Minimum score for job-readiness on the capstone. */
export const CAPSTONE_GATE = 85;

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`[scoring] ${message}`);
}
