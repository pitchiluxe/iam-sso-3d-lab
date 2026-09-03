/**
 * seed/perLab/lab01.ts — Lab 01 starts from an empty world (no baseline).
 * The learner creates the directory, users, and groups.
 *
 * After the conductor verifies all 5 steps, the baseline is applied so
 * later labs have something to mutate.
 */
import type { MockDirectory } from '@/services';
import type { MockIdP } from '@/services';
import type { MockAppServer } from '@/services';

export function applyLab01Seed(_dir: MockDirectory, idp: MockIdP, _apps: MockAppServer): void {
  // Lab 01 starts with an empty directory: no users, no groups, no apps.
  // The conductor guides the learner to call dir.createGroup, dir.createUser, etc.
  //
  // Step 3 explicitly asks the learner to create the admin user themselves —
  // pre-seeding an 'admin' account here would collide with that: usernames
  // aren't unique in MockDirectory, and getUserByUsername() always resolves
  // to the first match, so the learner's own admin.created event would never
  // match the step validator (it'd keep resolving back to this seeded one).
  // Only the password is pre-set, ready for whichever admin account the
  // learner ends up creating.
  idp.seedPasswords({ admin: 'admin123' });
}
