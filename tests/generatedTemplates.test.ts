/**
 * tests/generatedTemplates.test.ts
 *
 * Structural tests only — no AI/network involved. Confirms every template
 * produces a valid, startable Lab and that its registered seed function
 * (if any) doesn't throw against a fresh baseline.
 */
import { describe, it, expect } from 'vitest';
import { LAB_TEMPLATES } from '@/labs/generated/templates';
import { MockAuditLog, MockDirectory, MockIdP, MockAppServer, MockTicketQueue } from '@/services';
import { applyBaseline } from '@/seed/baseline';

const FLAVOR = { narrative: 'Test narrative.', coachingQuestion: 'Test question?' };

describe('LAB_TEMPLATES', () => {
  it('has exactly 15 unique templates', () => {
    expect(LAB_TEMPLATES).toHaveLength(15);
    const ids = new Set(LAB_TEMPLATES.map((t) => t.id));
    expect(ids.size).toBe(15);
  });

  it('every template builds a structurally valid Lab', () => {
    for (const t of LAB_TEMPLATES) {
      const lab = t.buildLab(FLAVOR, []);
      expect(lab.id).toBeTruthy();
      expect(lab.startingZone).toBe(t.zoneId);
      expect(lab.zoneIds).toContain(t.zoneId);
      expect(lab.steps.length).toBeGreaterThan(0);
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
