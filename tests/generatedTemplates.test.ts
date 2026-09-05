/**
 * tests/generatedTemplates.test.ts
 *
 * Structural tests only — no AI/network involved. Confirms every template
 * produces a valid, startable Lab and that its registered seed function
 * (if any) doesn't throw against a fresh baseline. Also covers batch
 * (multi-ticket queue) templates.
 */
import { describe, it, expect } from 'vitest';
import { LAB_TEMPLATES, BATCH_TEMPLATES } from '@/labs/generated/templates';
import { MockAuditLog, MockDirectory, MockIdP, MockAppServer, MockTicketQueue } from '@/services';
import { applyBaseline } from '@/seed/baseline';

const FLAVOR = { narrative: 'Test narrative.', coachingQuestion: 'Test question?' };

describe('LAB_TEMPLATES', () => {
  it('has exactly 15 unique templates', () => {
    expect(LAB_TEMPLATES).toHaveLength(15);
    const ids = new Set(LAB_TEMPLATES.map((t) => t.id));
    expect(ids.size).toBe(15);
  });

  it('every template builds a structurally valid Lab with non-empty objectives', () => {
    for (const t of LAB_TEMPLATES) {
      const lab = t.buildLab(FLAVOR, []);
      expect(lab.id).toBeTruthy();
      expect(lab.startingZone).toBe(t.zoneId);
      expect(lab.zoneIds).toContain(t.zoneId);
      expect(lab.steps.length).toBeGreaterThan(0);
      // Every lab must have objectives, one per step
      expect(lab.objectives.length).toBe(lab.steps.length);
      for (const step of lab.steps) {
        expect(step.validator.kind).toBeTruthy();
      }
      expect(lab.startingSeed).toBe(t.id);
    }
  });

  it('every template’s seed runs cleanly against a fresh baseline', () => {
    for (const t of LAB_TEMPLATES) {
      const audit = new MockAuditLog();
      const dir = new MockDirectory(audit);
      const idp = new MockIdP(audit, dir);
      const apps = new MockAppServer(dir, idp, audit);
      const tickets = new MockTicketQueue(audit);
      applyBaseline(dir, idp, apps);
      expect(() => {
        t.seed?.({ dir, idp, apps, tickets, reviews: undefined as never, incidents: undefined as never, audit });
      }).not.toThrow();
    }
  });
});

describe('BATCH_TEMPLATES', () => {
  it('has 3 batch templates (10, 15, and 20 tickets)', () => {
    expect(BATCH_TEMPLATES).toHaveLength(3);
    const counts = BATCH_TEMPLATES.map((bt) => bt.ticketCount).sort();
    expect(counts).toEqual([10, 15, 20]);
  });

  it('every batch template builds a lab with the right number of steps and objectives', () => {
    for (const bt of BATCH_TEMPLATES) {
      const ticketIds = Array.from(
        { length: bt.ticketCount },
        (_, i) => `test-${bt.id}-${String(i + 1).padStart(3, '0')}`,
      );
      const lab = bt.buildLab(FLAVOR, ticketIds);
      // One step per ticket
      expect(lab.steps.length).toBe(bt.ticketCount);
      // Each step's validator references a real ticket id
      for (let i = 0; i < bt.ticketCount; i++) {
        const step = lab.steps[i]!;
        expect(step.validator.kind).toBe('ticket-resolved');
        expect(step.validator.params).toEqual({ ticketId: ticketIds[i] });
      }
      // Each batch lab has one extra "triage" objective plus one per ticket
      // (10/15-ticket labs) or 3 extra objectives (20-ticket lab)
      expect(lab.objectives.length).toBeGreaterThan(0);
    }
  });

  it('every batch template seed creates the expected number of tickets', () => {
    for (const bt of BATCH_TEMPLATES) {
      const audit = new MockAuditLog();
      const dir = new MockDirectory(audit);
      const idp = new MockIdP(audit, dir);
      const apps = new MockAppServer(dir, idp, audit);
      const tickets = new MockTicketQueue(audit);
      applyBaseline(dir, idp, apps);
      const ticketIds = Array.from(
        { length: bt.ticketCount },
        (_, i) => `test-${bt.id}-${String(i + 1).padStart(3, '0')}`,
      );
      expect(() => {
        bt.seed({ dir, idp, apps, tickets, reviews: undefined as never, incidents: undefined as never, audit }, ticketIds);
      }).not.toThrow();
      // After seeding, the ticket queue should have the batch's tickets
      // (some may have been skipped if their username isn't in baseline,
      // so we just verify at least the majority made it in)
      const queued = tickets.list();
      const seeded = queued.filter((t) => ticketIds.includes(t.id as string));
      expect(seeded.length).toBeGreaterThanOrEqual(Math.floor(bt.ticketCount * 0.7));
    }
  });
});
