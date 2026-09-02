/**
 * conductor/conductor.ts — the single module that runs all ten labs.
 *
 * Lifecycle:
 *   1. start(labId) → load the Lab, reset services, apply startingSeed, wire validators.
 *   2. As the learner performs actions, the bus emits events. Validators decide step advance.
 *   3. When all steps are done, build a ScoreBreakdown and a debrief.
 *   4. reset() → teardown, re-seed.
 *
 * The AI supervisor (Ollama) runs alongside the conductor: it scores each
 * completed step and posts coaching into the tutor dialog. The conductor
 * still owns step progression — the supervisor observes and guides.
 */
import type {
  AuditEvent, Lab, LabId, ScoreBreakdown, ScorePoints, ScoreCategory,
  AppId,
} from '@/domain';
import type { EventBus } from '@/util';
import { createEventBus } from '@/util';
import { OllamaSupervisor } from '@/services/ollamaSupervisor';
import {
  MockAuditLog, MockDirectory, MockIdP, MockAppServer,
  MockTicketQueue, MockAccessReviews, MockIncidents, FaultService,
} from '@/services';
import { applyBaseline } from '@/seed/baseline';
import { applyLab01Seed } from '@/seed/perLab/lab01';
import { applyLab02Seed } from '@/seed/perLab/lab02';
import { applyLab03Seed } from '@/seed/perLab/lab03';
import { applyLab04Seed } from '@/seed/perLab/lab04';
import { applyLab05Seed } from '@/seed/perLab/lab05';
import { applyLab06Seed } from '@/seed/perLab/lab06';
import { applyLab07Seed } from '@/seed/perLab/lab07';
import { applyLab08Seed } from '@/seed/perLab/lab08';
import { applyLab09Seed } from '@/seed/perLab/lab09';
import { applyLab10Seed } from '@/seed/perLab/lab10';
import { applyLab11Seed } from '@/seed/perLab/lab11';
import { applyLab12Seed } from '@/seed/perLab/lab12';
import { applyLab13Seed } from '@/seed/perLab/lab13';
import {
  labStore, ticketStore, auditStore, faultStore, tutorStore,
  evidenceStore, scoreStore, progressStore,
} from '@/stores';
import { findLab } from '@/labs/registry';

const SEEDS: Record<string, (ctx: SeedContext) => void> = {
  baseline:   (ctx) => applyBaseline(ctx.dir, ctx.idp, ctx.apps),
  'lab01':    (ctx) => applyLab01Seed(ctx.dir, ctx.idp, ctx.apps),
  'lab02':    (ctx) => applyLab02Seed(ctx.dir, ctx.idp, ctx.apps, ctx.tickets),
  'lab03':    (ctx) => applyLab03Seed(ctx.dir, ctx.idp, ctx.apps, ctx.tickets),
  'lab04':    (ctx) => applyLab04Seed(ctx.dir, ctx.idp, ctx.apps),
  'lab05':    (ctx) => applyLab05Seed(ctx.dir, ctx.idp, ctx.apps, ctx.tickets),
  'lab06':    (ctx) => applyLab06Seed(ctx.dir, ctx.idp, ctx.apps, ctx.reviews),
  'lab07':    (ctx) => applyLab07Seed(ctx.dir, ctx.idp, ctx.apps, ctx.incidents),
  'lab08':    (ctx) => applyLab08Seed(ctx.dir, ctx.idp, ctx.apps, ctx.incidents, ctx.audit),
  'lab09':    (ctx) => applyLab09Seed(ctx.dir, ctx.idp, ctx.apps),
  'lab10':    (ctx) => applyLab10Seed(ctx.dir, ctx.idp, ctx.apps, ctx.tickets),
  'lab11':    (ctx) => applyLab11Seed(ctx.dir, ctx.idp, ctx.apps, ctx.tickets),
  'lab12':    (ctx) => applyLab12Seed(ctx.dir, ctx.idp, ctx.apps, ctx.tickets),
  'lab13':    (ctx) => applyLab13Seed(ctx.dir, ctx.idp, ctx.apps, ctx.tickets),
};

export interface SeedContext {
  dir: MockDirectory;
  idp: MockIdP;
  apps: MockAppServer;
  tickets: MockTicketQueue;
  reviews: MockAccessReviews;
  incidents: MockIncidents;
  audit: MockAuditLog;
}

export class Conductor {
  dir!: MockDirectory;
  idp!: MockIdP;
  apps!: MockAppServer;
  tickets!: MockTicketQueue;
  reviews!: MockAccessReviews;
  incidents!: MockIncidents;
  audit!: MockAuditLog;
  faults!: FaultService;
  bus: EventBus = createEventBus();
  currentLab: Lab | null = null;
  failCount = 0;
  private _unsubscribers: Array<() => void> = [];
  /** AI supervisor (Ollama) — scores each step and coaches the learner. */
  readonly supervisor: OllamaSupervisor = new OllamaSupervisor();

  /** Wire all services fresh and return them. */
  private bootstrap() {
    this.bus = createEventBus();
    this.audit  = new MockAuditLog(this.bus);
    this.dir    = new MockDirectory(this.audit);
    this.idp    = new MockIdP(this.audit, this.dir);
    this.apps   = new MockAppServer(this.dir, this.idp, this.audit);
    this.tickets   = new MockTicketQueue(this.audit);
    this.reviews   = new MockAccessReviews();
    this.incidents = new MockIncidents();
    this.faults = new FaultService({
      dir: this.dir, idp: this.idp, apps: this.apps, audit: this.audit,
    });
  }

  /** Start a lab. */
  start(labId: LabId): void {
    this.stop();
    this.bootstrap();
    this.currentLab = findLab(labId) ?? null;
    if (!this.currentLab) throw new Error(`[conductor] unknown lab: ${labId}`);

    // Apply the lab's starting seed
    const seedFn = SEEDS[this.currentLab.startingSeed] ?? SEEDS['baseline']!;
    seedFn({
      dir: this.dir, idp: this.idp, apps: this.apps,
      tickets: this.tickets, reviews: this.reviews,
      incidents: this.incidents, audit: this.audit,
    });

    // Push state to stores
    labStore.getState().load(this.currentLab);
    labStore.getState().start();
    ticketStore.getState().setTickets(this.tickets.list());
    auditStore.getState().reset();
    for (const e of this.audit.events) auditStore.getState().append(e);
    faultStore.getState().reset();
    evidenceStore.getState().reset();
    scoreStore.getState().reset();
    tutorStore.getState().reset();

    // Wire validators
    this._unsubscribers = [
      this.bus.on('audit', (e) => this.handleEvent(e as AuditEvent)),
      this.bus.on('lab.advance', () => this.advanceStep()),
    ];

    // Apply any faults scheduled for the first step
    this.applyFaultsFor(this.currentLab.steps[0]!.id);

    progressStore.getState().markStarted(labId);
  }

  /** Stop the current lab and tear down listeners. */
  stop(): void {
    for (const off of this._unsubscribers) off();
    this._unsubscribers = [];
  }

  /** Reset the current lab from the same seed. */
  reset(): void {
    if (!this.currentLab) return;
    const id = this.currentLab.id;
    this.failCount = 0;
    this.start(id);
  }

  /** Force advance (e.g. UI skip button — only used by tests). */
  forceAdvance(): void {
    this.advanceStep();
  }

  /** Get the current set of services. */
  getServices() {
    return {
      dir: this.dir, idp: this.idp, apps: this.apps,
      tickets: this.tickets, reviews: this.reviews,
      incidents: this.incidents, audit: this.audit, faults: this.faults,
    };
  }

  // -----------------------------------------------------------------------
  // Internals
  // -----------------------------------------------------------------------

  private handleEvent(e: AuditEvent) {
    auditStore.getState().append(e);
    const lab = this.currentLab;
    if (!lab) return;
    const step = lab.steps[labStore.getState().stepIndex];
    if (!step) return;

    if (this.eventMatchesValidator(e, step.validator)) {
      this.bus.emit('lab.advance');
    }
  }

  private eventMatchesValidator(e: AuditEvent, v: Lab['steps'][number]['validator']): boolean {
    const p = v.params as Record<string, string>;
    switch (v.kind) {
      case 'ticket-resolved':
        return e.action === 'ticket.resolved' && e.targetId === p.ticketId;
      case 'user-disabled':
        return e.action === 'user.disabled' && e.targetId === p.userId;
      case 'user-enabled':
        return e.action === 'user.unlocked' && e.targetId === p.userId;
      case 'user-created':
        return e.action === 'user.created' && e.targetId === p.userId;
      case 'group-added':
        return e.action === 'group.add' && e.subjectId === p.userId && e.targetId === p.groupId;
      case 'group-removed':
        return e.action === 'group.remove' && e.subjectId === p.userId && e.targetId === p.groupId;
      case 'role-granted':
        return e.action === 'role.grant' && e.subjectId === p.userId;
      case 'role-revoked':
        return e.action === 'role.revoke' && e.subjectId === p.userId;
      case 'app-config-fixed':
        return this.apps.getApp(p.appId as AppId)?.status === 'configured';
      case 'signin-succeeded':
        return e.action === 'signin.success' && e.targetId === p.userId;
      case 'mfa-challenge-completed':
        return e.action === 'mfa.challenge' && e.targetId === p.userId;
      case 'session-revoked':
        return e.action === 'session.revoked' && e.subjectId === p.userId;
      case 'fault-cleared':
        return !faultStore.getState().active.includes(p.kind as never);
      case 'evidence-collected':
        return evidenceStore.getState().items.some((i) => i.stepId === p.stepId);
      case 'audit-note-written':
        return false; // not used in thin slice
      case 'user-moved':
        return e.action === 'group.remove' && e.subjectId === p.userId;
      default:
        return false;
    }
  }

  private applyFaultsFor(stepId: string): void {
    const lab = this.currentLab;
    if (!lab) return;
    for (const f of lab.faults) {
      if (f.applyAtStep === stepId) {
        this.faults.apply(f.kind, { targetAppId: f.targetAppId, targetUserId: f.targetUserId });
        faultStore.getState().apply(f.kind, stepId);
      }
    }
  }

  private advanceStep(): void {
    const lab = this.currentLab;
    if (!lab) return;
    const completedIndex = labStore.getState().stepIndex;
    const completedStep = lab.steps[completedIndex];
    const recentEvents = (auditStore.getState().events as AuditEvent[]).slice(-25);
    labStore.getState().advance();
    const next = labStore.getState().stepIndex;
    if (next >= lab.steps.length) {
      // Score the just-completed step before completing the lab
      if (completedStep) {
        void this.supervisor.scoreStep(lab, completedStep, completedIndex, recentEvents);
      }
      this.complete();
      return;
    }
    // Apply faults scheduled for the next step
    this.applyFaultsFor(lab.steps[next]!.id);
    // Asynchronously score the step the learner just finished
    if (completedStep) {
      void this.supervisor.scoreStep(lab, completedStep, completedIndex, recentEvents);
    }
  }

  private complete(): void {
    const lab = this.currentLab!;
    const score = computeScore(lab, evidenceStore.getState().items, this.dir, this.failCount);
    scoreStore.getState().set(score);
    progressStore.getState().markComplete(lab.id, score);
    tutorStore.getState().addDialog({
      from: 'tutor',
      body: `Lab complete. Total: ${score.total}/100. Open the debrief to review.`,
    });
    // AI supervisor generates a final debrief message
    const allEvents = auditStore.getState().events as AuditEvent[];
    void this.supervisor.generateDebrief(lab, allEvents).then((msg) => {
      tutorStore.getState().addDialog({ from: 'tutor', body: `Supervisor: ${msg}` });
    });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Compute the 100-point score breakdown. */
function computeScore(
  lab: Lab,
  evidence: ReturnType<typeof evidenceStore.getState>['items'],
  dir: MockDirectory,
  failCount: number,
): ScoreBreakdown {
  const earned: Record<ScoreCategory, number> = {
    exec: 0, troubleshoot: 0, 'least-privilege': 0, docs: 0, evidence: 0, comms: 0,
  };
  // Sum per-step points for passed steps
  const statuses = labStore.getState().stepStatuses;
  for (const step of lab.steps) {
    if (statuses[step.id] !== 'done') continue;
    const pts = step.points ?? {};
    for (const k of Object.keys(pts) as ScoreCategory[]) {
      earned[k] += (pts as ScorePoints)[k] ?? 0;
    }
  }
  // Penalty for failed validate calls
  const penalty = Math.min(failCount * 2, 10);
  earned.troubleshoot = Math.max(0, earned.troubleshoot - penalty);

  // Bonus/penalty: 0 on least-privilege if any user has an obviously excessive role
  if (dir.listRoles().some((r) => r.name === 'role-domain-admin' && dir.getUserByUsername('bob.sato'))) {
    earned['least-privilege'] = Math.min(earned['least-privilege'], 5);
  }
  // 0 on evidence if any required evidence is missing
  const requiredByStep = new Map<string, number>();
  for (const step of lab.steps) requiredByStep.set(step.id, step.evidence.length);
  const collectedByStep = new Map<string, number>();
  for (const e of evidence) collectedByStep.set(e.stepId, (collectedByStep.get(e.stepId) ?? 0) + 1);
  for (const [stepId, needed] of requiredByStep) {
    if ((collectedByStep.get(stepId) ?? 0) < needed) {
      earned.evidence = Math.min(earned.evidence, 5);
      break;
    }
  }

  const total = earned.exec + earned.troubleshoot + earned['least-privilege'] + earned.docs + earned.evidence + earned.comms;
  return {
    labId: lab.id,
    exec: earned.exec, troubleshoot: earned.troubleshoot,
    'least-privilege': earned['least-privilege'], docs: earned.docs,
    evidence: earned.evidence, comms: earned.comms,
    total,
    notes: failCount > 0 ? [`Penalty: -${penalty} from ${failCount} failed validate calls`] : [],
  };
}

export const conductor = new Conductor();
