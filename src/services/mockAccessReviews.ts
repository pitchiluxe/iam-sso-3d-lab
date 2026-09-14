/**
 * services/mockAccessReviews.ts — periodic access review campaigns.
 * Each campaign has a list of decisions per (userId, groupId[, roleId]).
 *
 * recordDecision() and close() emit real audit events. They used not to —
 * this class had no audit dependency at all — so the 'review-decisions-recorded'
 * validator, which only fires on an incoming audit event, had nothing to react
 * to: clicking through a whole campaign never advanced the step on its own,
 * only an unrelated event happening to fire afterward could trigger the
 * re-check.
 */
import { nanoid } from 'nanoid';
import type { AccessReview, AccessReviewDecision, ReviewId, UserId } from '@/domain';
import { mkReviewId } from '@/domain';
import type { MockAuditLog } from './mockAuditLog';

export class MockAccessReviews {
  private reviews = new Map<ReviewId, AccessReview>();

  constructor(private readonly audit?: MockAuditLog) {}

  openCampaign(c: { campaign: string; openedAt: number; dueAt: number }): AccessReview {
    const id = mkReviewId(nanoid(10));
    const review: AccessReview = {
      id,
      campaign: c.campaign,
      openedAt: c.openedAt,
      dueAt: c.dueAt,
      status: 'open',
      decisions: [],
    };
    this.reviews.set(id, review);
    return review;
  }

  /** Seed a review with pre-existing pending decisions. */
  seedDecisions(
    id: ReviewId,
    decisions: Omit<AccessReviewDecision, 'decidedBy' | 'decidedAt'>[],
  ): void {
    const r = this.reviews.get(id);
    if (!r) throw new Error(`[reviews] seedDecisions: review ${id} not found`);
    // Decisions are added by the manager; we keep placeholders here for the UI.
    r.decisions = decisions.map((d) => ({ ...d, decidedBy: 'pending' as UserId, decidedAt: 0 }));
  }

  recordDecision(reviewId: ReviewId, d: Omit<AccessReviewDecision, 'decidedAt'>): void {
    const r = this.reviews.get(reviewId);
    if (!r) throw new Error(`[reviews] recordDecision: review not found`);
    const existing = r.decisions.findIndex(
      (e) => e.userId === d.userId && e.groupId === d.groupId && e.roleId === d.roleId,
    );
    if (existing >= 0) {
      r.decisions[existing] = { ...d, decidedAt: Date.now() };
    } else {
      r.decisions.push({ ...d, decidedAt: Date.now() });
    }
    r.status = 'in-progress';
    this.audit?.record({
      actorId: d.decidedBy,
      action: 'review.decision',
      targetId: d.groupId ?? d.roleId,
      subjectId: d.userId,
      diff: { campaign: r.campaign, decision: d.decision },
    });
  }

  close(id: ReviewId): void {
    const r = this.reviews.get(id);
    if (!r) return;
    r.status = 'closed';
    this.audit?.record({
      actorId: 'system' as UserId,
      action: 'review.closed',
      targetId: id,
      diff: { campaign: r.campaign, decisions: r.decisions.length },
    });
  }

  list(): AccessReview[] {
    return Array.from(this.reviews.values());
  }

  get(id: ReviewId): AccessReview | undefined {
    return this.reviews.get(id);
  }

  /** Decisions that still need a manager's call. */
  pending(reviewId: ReviewId): AccessReviewDecision[] {
    const r = this.reviews.get(reviewId);
    if (!r) return [];
    return r.decisions.filter((d) => d.decidedBy === 'pending');
  }

  reset(): void {
    this.reviews.clear();
  }
}
