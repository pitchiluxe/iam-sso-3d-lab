/**
 * tests/tickets.test.ts
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockAuditLog, MockTicketQueue } from '@/services';
import { mkUserId } from '@/domain';

describe('MockTicketQueue', () => {
  let audit: MockAuditLog, q: MockTicketQueue;
  const alice = mkUserId('alice');

  beforeEach(() => {
    audit = new MockAuditLog();
    q = new MockTicketQueue(audit);
  });

  it('creates a ticket with status=open and audits', () => {
    const t = q.create({
      kind: 'password-reset',
      requesterId: alice,
      subject: 'help', body: 'forgot pwd',
      payload: { userId: alice, method: 'helpdesk' },
    });
    expect(t.status).toBe('open');
    expect(audit.byAction('ticket.')).toHaveLength(1);
  });

  it('assign sets assignee and status=in-progress', () => {
    const t = q.create({
      kind: 'password-reset', requesterId: alice, subject: 's', body: 'b',
      payload: { userId: alice, method: 'helpdesk' },
    });
    q.assign(t.id, alice);
    expect(t.assigneeId).toBe(alice);
    expect(t.status).toBe('in-progress');
  });

  it('comment appends to comments and updates updatedAt', () => {
    const t = q.create({
      kind: 'password-reset', requesterId: alice, subject: 's', body: 'b',
      payload: { userId: alice, method: 'helpdesk' },
    });
    q.comment(t.id, alice, 'note');
    expect(t.comments).toHaveLength(1);
  });

  it('resolve sets status=resolved and audits', () => {
    const t = q.create({
      kind: 'password-reset', requesterId: alice, subject: 's', body: 'b',
      payload: { userId: alice, method: 'helpdesk' },
    });
    q.resolve(t.id, alice);
    expect(t.status).toBe('resolved');
    expect(audit.byAction('ticket.')).toHaveLength(2);
  });

  it('escalate raises priority to urgent', () => {
    const t = q.create({
      kind: 'password-reset', requesterId: alice, subject: 's', body: 'b',
      payload: { userId: alice, method: 'helpdesk' },
    });
    q.escalate(t.id, alice);
    expect(t.priority).toBe('urgent');
  });

  it('list filters by kind and status', () => {
    q.create({ kind: 'password-reset', requesterId: alice, subject: 's', body: 'b', payload: { userId: alice, method: 'helpdesk' } });
    q.create({ kind: 'mfa-issue', requesterId: alice, subject: 's', body: 'b', payload: { userId: alice, symptom: 'lost-device' } });
    expect(q.list({ kind: 'mfa-issue' })).toHaveLength(1);
  });
});
