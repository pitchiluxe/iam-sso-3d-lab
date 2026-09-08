/**
 * tests/labValidatorSense.test.ts — a step must be completable by doing what
 * it says.
 *
 * lab02's "Terminate Bob Sato" ended with "Verify Bob cannot sign in" and
 * validated `signin-succeeded` for bob.sato. So the step advanced only if the
 * termination had failed: a learner who disabled the account, revoked the
 * sessions and removed the groups — exactly as instructed — could never
 * finish the lab, and one who somehow did advance had proved the opposite of
 * the lesson.
 *
 * Nothing caught it because every test checked that validators *fire on their
 * event*, which this one did. The defect was the pairing of a validator with
 * a brief that asks for the opposite outcome, and that is a property of the
 * lab definition rather than of any one function.
 *
 * So this reads all thirteen labs and asserts the pairing makes sense. It is a
 * blunt instrument — it works on the wording of the brief — but the failure it
 * prevents is a lab that cannot be completed, which is worth a blunt
 * instrument.
 */
import { describe, it, expect } from 'vitest';
import { LAB_REGISTRY } from '@/labs/registry';
import type { ValidatorKind } from '@/domain';

/** Validators that fire when something *worked*. */
const SUCCESS_KINDS = new Set<ValidatorKind>([
  'signin-succeeded',
  'user-created',
  'user-enabled',
  'group-added',
  'role-granted',
  'mfa-challenge-completed',
  'users-provisioned',
]);

/** Wording that means "prove this no longer works". */
const PROVES_A_NEGATIVE =
  /\b(cannot|can no longer|no longer|is denied|denied|refused|blocked|unable to)\b/i;

/** Validators that need an event only produced by prior state. */
const NEEDS_EXISTING_STATE = new Set<ValidatorKind>(['session-revoked']);

describe('every lab step can be completed by following its brief', () => {
  it('never asks you to prove a negative while validating a success', () => {
    const offenders: string[] = [];
    for (const lab of LAB_REGISTRY) {
      for (const step of lab.steps) {
        const negative = PROVES_A_NEGATIVE.test(step.brief);
        if (negative && SUCCESS_KINDS.has(step.validator.kind)) {
          offenders.push(
            `${lab.id}/${step.id} "${step.title}": brief asks to prove a negative but ` +
              `validates ${step.validator.kind}`,
          );
        }
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('does not validate a session revocation nobody has a session for', () => {
    // The trap next to the one above: session-revoked only emits when the
    // account already has a live session, so on a seed that opens none the
    // step is unreachable for exactly the same reason.
    const risky = LAB_REGISTRY.flatMap((lab) =>
      lab.steps
        .filter((s) => NEEDS_EXISTING_STATE.has(s.validator.kind))
        .map((s) => `${lab.id}/${s.id} validates ${s.validator.kind}`),
    );
    // Recorded rather than banned: a lab that seeds a session may use it. If
    // this list grows, check the seed opens a session for that account.
    expect(risky.length).toBeLessThanOrEqual(1);
  });

  it('gives a termination step a validator that a termination produces', () => {
    // Disabling always emits. A successful sign-in, by definition, does not
    // happen to an account you have just disabled.
    for (const lab of LAB_REGISTRY) {
      for (const step of lab.steps) {
        if (!/terminat|offboard/i.test(step.title)) continue;
        expect(
          step.validator.kind,
          `${lab.id}/${step.id} "${step.title}"`,
        ).not.toBe('signin-succeeded');
      }
    }
  });
});

describe('the labs are internally consistent', () => {
  it('has a validator on every step', () => {
    for (const lab of LAB_REGISTRY) {
      for (const step of lab.steps) {
        expect(step.validator?.kind, `${lab.id}/${step.id}`).toBeTruthy();
      }
    }
  });

  it('has unique step ids inside each lab', () => {
    for (const lab of LAB_REGISTRY) {
      const ids = lab.steps.map((s) => s.id);
      expect(new Set(ids).size, String(lab.id)).toBe(ids.length);
    }
  });

  it('states a brief long enough to act on', () => {
    // A step whose brief is a title is a step nobody can follow.
    for (const lab of LAB_REGISTRY) {
      for (const step of lab.steps) {
        expect(step.brief.trim().length, `${lab.id}/${step.id}`).toBeGreaterThan(30);
      }
    }
  });
});
