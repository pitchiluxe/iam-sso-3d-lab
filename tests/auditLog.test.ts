/**
 * tests/auditLog.test.ts
 */
import { describe, it, expect } from 'vitest';
import { MockAuditLog } from '@/services';
import { mkUserId } from '@/domain';

describe('MockAuditLog', () => {
  it('records an event with id and timestamp', () => {
    const log = new MockAuditLog();
    const before = Date.now();
    const ev = log.record({ actorId: mkUserId('u1'), action: 'user.created', targetId: 'u1' });
    const after = Date.now();
    expect(ev.id).toBeDefined();
    expect(ev.at).toBeGreaterThanOrEqual(before);
    expect(ev.at).toBeLessThanOrEqual(after);
  });

  it('emits a bus event on every record', () => {
    const log = new MockAuditLog();
    let received = 0;
    log.bus.on('audit', () => received++);
    log.record({ actorId: mkUserId('u1'), action: 'user.created', targetId: 'u1' });
    log.record({ actorId: mkUserId('u1'), action: 'user.disabled', targetId: 'u1' });
    expect(received).toBe(2);
  });

  it('filters by user (actor/target/subject)', () => {
    const log = new MockAuditLog();
    log.record({ actorId: mkUserId('u1'), action: 'user.created', targetId: 'u2' });
    log.record({ actorId: mkUserId('u3'), action: 'group.add', targetId: 'g1', subjectId: 'u2' });
    const byUser = log.byUser('u2' as never);
    expect(byUser).toHaveLength(2);
  });

  it('filters by action prefix', () => {
    const log = new MockAuditLog();
    log.record({ actorId: mkUserId('u1'), action: 'signin.success', targetId: 'u1' });
    log.record({ actorId: mkUserId('u1'), action: 'signin.failure', targetId: 'u1' });
    log.record({ actorId: mkUserId('u1'), action: 'user.disabled', targetId: 'u1' });
    expect(log.byAction('signin.')).toHaveLength(2);
  });

  it('tail returns the most recent N events in reverse', () => {
    const log = new MockAuditLog();
    for (let i = 0; i < 5; i++) {
      log.record({ actorId: mkUserId('u1'), action: 'user.created', targetId: `u${i}` });
    }
    const t = log.tail(3);
    expect(t).toHaveLength(3);
  });

  it('reset clears the log', () => {
    const log = new MockAuditLog();
    log.record({ actorId: mkUserId('u1'), action: 'user.created', targetId: 'u1' });
    log.reset();
    expect(log.events).toHaveLength(0);
  });
});
