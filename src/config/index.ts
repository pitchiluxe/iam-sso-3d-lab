/**
 * config/index.ts — public re-exports.
 */
export { COMPANY, OU_NAMES, DEPARTMENTS, GROUP_NAMES, SERVICE_ACCOUNT_NAMES, PRIVILEGED_ROLES } from './company';
export { SEED_USERS, SEED_ADMINS, seedEmail } from './credentials';
export type { SeedUser } from './credentials';
export { SCORING, POINTS_TOTAL, PENALTY_PER_FAIL, PENALTY_CAP, CAPSTONE_GATE } from './scoring';
