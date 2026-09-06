/**
 * tests/labIntegrity.test.ts
 *
 * The thirteen hand-written labs, checked against the world their own seed
 * builds. A step naming an account, group or app that never exists cannot be
 * completed — the learner is told to act on something that is not there, which
 * is the failure mode originally reported for the generated labs.
 *
 * An account counts as available if any of these hold by the time the step is
 * reached:
 *   - the lab's seed created it
 *   - an earlier step's `user-created` validator covers it (lab01 provisions
 *     `admin` at s3 and signs in as them at s5)
 *   - the step's own brief instructs the learner to create it (lab12 s5 says
 *     "Joiner: add nina.patel", then validates on her sign-in)
 */
import { describe, it, expect } from 'vitest';
import { Conductor } from '@/conductor/conductor';
import { mkLabId, type Lab, type LabStep } from '@/domain';
import { findLab } from '@/labs/registry';

const LAB_IDS = [
  'lab01',
  'lab02',
  'lab03',
  'lab04',
  'lab05',
  'lab06',
  'lab07',
  'lab08',
  'lab09',
  'lab10',
  'lab11',
  'lab12',
  'lab13',
];

/** Validators whose subject must exist by the time the step runs. */
const NEEDS_EXISTING_USER = new Set([
  'user-disabled',
  'user-enabled',
  'user-moved',
  'user-deleted',
  'group-added',
  'group-removed',
  'role-granted',
  'role-revoked',
  'signin-succeeded',
  'mfa-challenge-completed',
  'session-revoked',
  'password-reset',
  'mfa-reset',
  'account-unlocked',
]);

const CREATES_USER = new Set(['user-created']);

function startLab(id: string): { conductor: Conductor; lab: Lab } {
  const conductor = new Conductor();
  conductor.start(mkLabId(id));
  return { conductor, lab: conductor.currentLab! };
}

const param = (s: LabStep, key: string): string | undefined =>
  s.validator.params[key] as string | undefined;

/** True when this step's own instructions tell the learner to create `user`. */
function briefIntroduces(step: LabStep, user: string): boolean {
  if (!step.brief.includes(user)) return false;
  return /(add|create|provision|onboard|joiner)/i.test(step.brief);
}

describe.each(LAB_IDS)('%s integrity', (id) => {
  it('is registered and starts with at least one step', () => {
    expect(findLab(mkLabId(id))).toBeDefined();
    expect(startLab(id).lab.steps.length).toBeGreaterThan(0);
  });

  it('every step names an account that exists by the time the step runs', () => {
    const { conductor, lab } = startLab(id);
    const available = new Set<string>();
    const missing: string[] = [];

    for (const step of lab.steps) {
      const user = param(step, 'userId');
      if (!user) continue;

      const introducedHere = briefIntroduces(step, user);

      if (NEEDS_EXISTING_USER.has(step.validator.kind)) {
        const ok = !!conductor.dir.getUserByUsername(user) || available.has(user) || introducedHere;
        if (!ok) missing.push(`${step.id} (${step.validator.kind}) -> ${user}`);
      }

      if (CREATES_USER.has(step.validator.kind) || introducedHere) available.add(user);
    }

    expect(missing).toEqual([]);
  });

  it('accounts the learner must create are not already in the seed', () => {
    const { conductor, lab } = startLab(id);
    // Seeded already means the step is green on arrival and teaches nothing —
    // and since createUser now rejects duplicates, creating it would fail.
    const preexisting = lab.steps
      .filter((s) => CREATES_USER.has(s.validator.kind))
      .map((s) => param(s, 'userId'))
      .filter((u): u is string => !!u && !!conductor.dir.getUserByUsername(u));

    expect(preexisting).toEqual([]);
  });

  it('every step naming a group refers to one that exists, unless it creates it', () => {
    const { conductor, lab } = startLab(id);
    const missing = lab.steps
      .filter((s) => !['group-created', 'users-provisioned'].includes(s.validator.kind))
      .map((s) => ({ step: s.id, kind: s.validator.kind, group: param(s, 'groupId') }))
      .filter((x) => x.group && !conductor.dir.getGroupByName(x.group))
      .map((x) => `${x.step} (${x.kind}) -> ${x.group}`);

    expect(missing).toEqual([]);
  });

  it('every step naming an application refers to a registered one', () => {
    const { conductor, lab } = startLab(id);
    const missing = lab.steps
      .map((s) => ({ step: s.id, app: param(s, 'appId') }))
      .filter((x) => x.app && !conductor.apps.getApp(x.app as never))
      .map((x) => `${x.step} -> ${x.app}`);

    expect(missing).toEqual([]);
  });

  it('every seeded ticket points at accounts that exist', () => {
    const { conductor } = startLab(id);
    // A ticket whose subject is not in the directory cannot be actioned: the
    // console has nothing to select and the terminal cannot find the identity.
    const dangling = conductor.tickets
      .list()
      .flatMap((t) =>
        t.relatedUserIds
          .filter((uid) => !conductor.dir.getUser(uid))
          .map((uid) => `${t.subject} -> ${uid}`),
      );

    expect(dangling).toEqual([]);
  });

  it('every seeded ticket names an account in prose that the directory has', () => {
    const { conductor } = startLab(id);
    const known = new Set(conductor.dir.listUsers().map((u) => u.username.toLowerCase()));

    const dangling: string[] = [];
    for (const t of conductor.tickets.list()) {
      // Onboarding names the account to be CREATED, so absence is the point.
      if (t.kind === 'onboarding') continue;
      const text = `${t.subject} ${t.body}`;
      const tokens = new Set<string>();
      for (const m of text.matchAll(/svc-[a-z0-9-]+/g)) tokens.add(m[0]);
      for (const m of text.matchAll(/[a-z]+\.[a-z]+/g)) {
        if (!/\.(example|com|net|org)$/.test(m[0])) tokens.add(m[0]);
      }
      for (const tok of tokens) {
        if (!known.has(tok)) dangling.push(`${t.subject} -> ${tok}`);
      }
    }

    expect(dangling).toEqual([]);
  });

  it('has scoreable objectives', () => {
    const { lab } = startLab(id);
    expect(lab.objectives.length).toBeGreaterThan(0);
    expect(lab.objectives.filter((o) => !o.points || o.points <= 0).map((o) => o.id)).toEqual([]);
  });

  it('has a briefing and at least one debrief question', () => {
    const { lab } = startLab(id);
    expect(lab.brief.trim().length).toBeGreaterThan(0);
    expect(lab.debriefQuestions.length).toBeGreaterThan(0);
  });
});
