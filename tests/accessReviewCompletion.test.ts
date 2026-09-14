/**
 * tests/accessReviewCompletion.test.ts
 *
 * Two independent bugs used to make lab06's "record 8 decisions" step
 * permanently unreachable:
 *
 *  1. MockAccessReviews had no audit dependency at all, so recordDecision()
 *     and close() never emitted an event. The 'review-decisions-recorded'
 *     validator only re-checks on an incoming audit event — with none ever
 *     fired, the step advanced only by luck, if some unrelated event
 *     happened to fire afterward.
 *  2. The seed's 8 "pending decisions" contained a literal duplicate row
 *     (Ivy Park + grp-helpdesk-tier1, twice). recordDecision() matches an
 *     existing entry by (userId, groupId, roleId), so both copies always
 *     resolved to the same array slot — the second one could never be
 *     independently decided and stayed 'pending' forever, so the campaign
 *     could never reach zero pending items regardless of what the learner did.
 *
 * This locks in both fixes together, since either one alone still leaves
 * the step unreachable.
 */
import { describe, it, expect } from 'vitest';
import { Conductor } from '@/conductor/conductor';
import { mkLabId } from '@/domain';
import { labStore } from '@/stores';

describe('lab06 access-review decisions are actually recordable and completable', () => {
  it('seeds 8 pending decisions with no duplicate (userId, groupId) pair', () => {
    const conductor = new Conductor();
    conductor.start(mkLabId('lab06'));
    const { reviews } = conductor.getServices();
    const review = reviews.list()[0]!;
    expect(review.decisions).toHaveLength(8);
    const keys = review.decisions.map((d) => `${d.userId}:${d.groupId ?? d.roleId}`);
    expect(new Set(keys).size).toBe(8);
  });

  it('recordDecision emits a real audit event that the conductor observes', () => {
    const conductor = new Conductor();
    conductor.start(mkLabId('lab06'));
    const { reviews, audit } = conductor.getServices();
    const review = reviews.list()[0]!;
    const before = audit.byAction('review.').length;
    const d = reviews.pending(review.id)[0]!;
    reviews.recordDecision(review.id, { ...d, decidedBy: 'ivy.park' as never });
    expect(audit.byAction('review.').length).toBe(before + 1);
  });

  it('recording all 8 decisions individually completes the step', async () => {
    const conductor = new Conductor();
    conductor.start(mkLabId('lab06'));
    conductor.forceAdvance();
    conductor.forceAdvance();
    conductor.forceAdvance();
    expect(labStore.getState().stepIndex).toBe(3); // s4: record 8 decisions

    const { reviews } = conductor.getServices();
    const review = reviews.list()[0]!;
    for (const d of reviews.pending(review.id)) {
      reviews.recordDecision(review.id, { ...d, decidedBy: 'ivy.park' as never });
    }

    expect(reviews.pending(review.id)).toHaveLength(0);
    expect(labStore.getState().stepStatuses['s4']).toBe('done');

    const final = reviews.get(review.id)!;
    expect(final.decisions.filter((d) => d.decision === 'approve')).toHaveLength(6);
    expect(final.decisions.filter((d) => d.decision === 'revoke')).toHaveLength(2);
  });
});
