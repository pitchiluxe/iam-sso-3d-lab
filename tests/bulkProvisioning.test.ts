/**
 * tests/bulkProvisioning.test.ts
 *
 * End-to-end for the automation labs: the lab's seed, the shipped template
 * script, the directory state and the audit log must all agree. If any link is
 * broken the learner cannot do the job — the ticket asks for something the
 * script cannot achieve, or the work happens but the step never completes.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  MockAuditLog,
  MockDirectory,
  MockIdP,
  MockAppServer,
  MockTicketQueue,
  MockAccessReviews,
  MockIncidents,
} from '@/services';
import type { CapabilityContext } from '@/services';
import { getSeed } from '@/conductor/seedRegistry';
import { LAB_TEMPLATES, BULK_INTAKE_GROUP } from '@/labs/generated/templates';
import { SCRIPT_TEMPLATES } from '@/config/scriptTemplates';
import { runScript } from '@/terminal/script';

const FLAVOR = { narrative: 'Q3 intake.', coachingQuestion: 'Why automate this?' };

function bootstrap() {
  const audit = new MockAuditLog();
  const dir = new MockDirectory(audit);
  const idp = new MockIdP(audit, dir);
  const apps = new MockAppServer(dir, idp, audit);
  const tickets = new MockTicketQueue(audit);
  const seedCtx = {
    dir,
    idp,
    apps,
    tickets,
    audit,
    reviews: new MockAccessReviews(),
    incidents: new MockIncidents(),
  };
  return { seedCtx, dir, idp, tickets, audit };
}

/** The script a learner would write from the shipped template for N names. */
function intakeScript(names: string[]): string {
  return (
    `$names = @(${names.map((n) => `'${n}'`).join(',')})\n` +
    `foreach ($n in $names) {\n` +
    `  New-ADUser -SamAccountName $n -Name $n -Department Finance -Title Analyst\n` +
    `  Add-ADGroupMember -Identity $n -Group ${BULK_INTAKE_GROUP}\n` +
    `}\n`
  );
}

describe.each([5, 10, 20])('bulk-provision-%i', (count) => {
  let ctx: CapabilityContext;
  let dir: MockDirectory;
  let audit: MockAuditLog;

  beforeEach(() => {
    const b = bootstrap();
    dir = b.dir;
    audit = b.audit;
    getSeed(`bulk-provision-${count}`)(b.seedCtx as never);
    ctx = { dir: b.dir, idp: b.idp, tickets: b.tickets, audit: b.audit, actor: 'system' as never };
  });

  it('seeds the target group empty, so the step cannot start satisfied', () => {
    const g = dir.getGroupByName(BULK_INTAKE_GROUP);
    expect(g).toBeDefined();
    expect(g!.memberIds).toHaveLength(0);
  });

  it('the shipped script provisions exactly the requested accounts', () => {
    const names = Array.from({ length: count }, (_, i) => `intake.user${i + 1}`);
    const res = runScript(intakeScript(names), ctx);

    expect(res.parseError).toBeUndefined();
    expect(res.failed).toBe(0);
    for (const n of names) expect(dir.getUserByUsername(n)).toBeDefined();
  });

  it('satisfies the validator: group membership reaches the required count', () => {
    const names = Array.from({ length: count }, (_, i) => `intake.user${i + 1}`);
    runScript(intakeScript(names), ctx);

    // This is exactly what the conductor's `users-provisioned` case checks.
    const g = dir.getGroupByName(BULK_INTAKE_GROUP)!;
    expect(g.memberIds.length).toBeGreaterThanOrEqual(count);
  });

  it('writes one audit event per account, so the log matches the work', () => {
    const names = Array.from({ length: count }, (_, i) => `intake.user${i + 1}`);
    const before = audit.byAction('user.created').length;
    runScript(intakeScript(names), ctx);

    expect(audit.byAction('user.created').length - before).toBe(count);
    expect(audit.byAction('group.add').length).toBeGreaterThanOrEqual(count);
  });

  it("the lab's step asks for the same group and count the script targets", () => {
    const template = LAB_TEMPLATES.find((t) => t.id === `bulk-provision-${count}`)!;
    const lab = template.buildLab(FLAVOR, []);
    const step = lab.steps[0]!;

    expect(step.validator.kind).toBe('users-provisioned');
    expect(step.validator.params['groupId']).toBe(BULK_INTAKE_GROUP);
    expect(step.validator.params['count']).toBe(count);
    // The brief must name the group the validator counts, or the learner is
    // told to fill a different group than the one being checked.
    expect(step.brief).toContain(BULK_INTAKE_GROUP);
  });
});

describe('shipped script templates are runnable as-is', () => {
  it('every template parses and every cmdlet in it exists', () => {
    const b = bootstrap();
    getSeed('baseline')(b.seedCtx as never);
    const ctx: CapabilityContext = {
      dir: b.dir,
      idp: b.idp,
      tickets: b.tickets,
      audit: b.audit,
      actor: 'system' as never,
    };

    for (const t of SCRIPT_TEMPLATES) {
      const res = runScript(t.body, ctx);
      expect(res.parseError, `${t.id} failed to parse`).toBeUndefined();
      // An unknown cmdlet is a template bug — it would greet the learner with
      // "is not recognized" the first time they click it.
      const unknown = res.results.filter((r) => /is not recognized/.test(r.result.output));
      expect(unknown.map((u) => u.command), `${t.id} has unknown cmdlets`).toEqual([]);
    }
  });
});
