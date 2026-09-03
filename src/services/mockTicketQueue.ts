/**
 * services/mockTicketQueue.ts — in-memory queue of tickets.
 */
import { nanoid } from 'nanoid';
import type { Ticket, TicketId, TicketKind, UserId } from '@/domain';
import { mkTicketId } from '@/domain';
import type { MockAuditLog } from './mockAuditLog';

export type NewTicket =
  | {
      kind: 'onboarding';
      requesterId: UserId;
      subject: string;
      body: string;
      priority?: Ticket['priority'];
      payload: Extract<Ticket, { kind: 'onboarding' }>['payload'];
      relatedUserIds?: UserId[];
    }
  | {
      kind: 'mover';
      requesterId: UserId;
      subject: string;
      body: string;
      priority?: Ticket['priority'];
      payload: Extract<Ticket, { kind: 'mover' }>['payload'];
      relatedUserIds?: UserId[];
    }
  | {
      kind: 'leaver';
      requesterId: UserId;
      subject: string;
      body: string;
      priority?: Ticket['priority'];
      payload: Extract<Ticket, { kind: 'leaver' }>['payload'];
      relatedUserIds?: UserId[];
    }
  | {
      kind: 'transfer';
      requesterId: UserId;
      subject: string;
      body: string;
      priority?: Ticket['priority'];
      payload: Extract<Ticket, { kind: 'transfer' }>['payload'];
      relatedUserIds?: UserId[];
    }
  | {
      kind: 'termination';
      requesterId: UserId;
      subject: string;
      body: string;
      priority?: Ticket['priority'];
      payload: Extract<Ticket, { kind: 'termination' }>['payload'];
      relatedUserIds?: UserId[];
    }
  | {
      kind: 'access-request';
      requesterId: UserId;
      subject: string;
      body: string;
      priority?: Ticket['priority'];
      payload: Extract<Ticket, { kind: 'access-request' }>['payload'];
      relatedUserIds?: UserId[];
    }
  | {
      kind: 'password-reset';
      requesterId: UserId;
      subject: string;
      body: string;
      priority?: Ticket['priority'];
      payload: Extract<Ticket, { kind: 'password-reset' }>['payload'];
      relatedUserIds?: UserId[];
    }
  | {
      kind: 'mfa-issue';
      requesterId: UserId;
      subject: string;
      body: string;
      priority?: Ticket['priority'];
      payload: Extract<Ticket, { kind: 'mfa-issue' }>['payload'];
      relatedUserIds?: UserId[];
    }
  | {
      kind: 'incident';
      requesterId: UserId;
      subject: string;
      body: string;
      priority?: Ticket['priority'];
      payload: Extract<Ticket, { kind: 'incident' }>['payload'];
      relatedUserIds?: UserId[];
    };

export class MockTicketQueue {
  private tickets = new Map<TicketId, Ticket>();

  constructor(private readonly audit: MockAuditLog) {}

  list(filter?: { kind?: TicketKind; status?: Ticket['status'] }): Ticket[] {
    const all = Array.from(this.tickets.values());
    if (!filter) return all;
    return all.filter((t) => {
      if (filter.kind && t.kind !== filter.kind) return false;
      if (filter.status && t.status !== filter.status) return false;
      return true;
    });
  }

  get(id: TicketId): Ticket | undefined {
    return this.tickets.get(id);
  }

  create(t: NewTicket): Ticket {
    const id = mkTicketId(nanoid(10));
    const now = Date.now();
    const base = {
      id,
      status: 'open' as Ticket['status'],
      priority: (t.priority ?? 'normal') as Ticket['priority'],
      requesterId: t.requesterId,
      subject: t.subject,
      body: t.body,
      createdAt: now,
      updatedAt: now,
      approvals: [],
      comments: [],
      relatedUserIds: t.relatedUserIds ?? [],
    };
    const ticket = { kind: t.kind, ...base, payload: t.payload } as Ticket;
    this.tickets.set(id, ticket);
    this.audit.record({ actorId: t.requesterId, action: 'ticket.created', targetId: id });
    return ticket;
  }

  assign(id: TicketId, by: UserId): void {
    const t = this.tickets.get(id);
    if (!t) return;
    t.assigneeId = by;
    t.status = 'in-progress';
    t.updatedAt = Date.now();
  }

  comment(id: TicketId, by: UserId, body: string): void {
    const t = this.tickets.get(id);
    if (!t) return;
    t.comments.push({ authorId: by, at: Date.now(), body });
    t.updatedAt = Date.now();
  }

  resolve(id: TicketId, by: UserId): void {
    const t = this.tickets.get(id);
    if (!t) return;
    t.status = 'resolved';
    t.updatedAt = Date.now();
    this.audit.record({ actorId: by, action: 'ticket.resolved', targetId: id });
  }

  escalate(id: TicketId, by: UserId): void {
    const t = this.tickets.get(id);
    if (!t) return;
    t.priority = 'urgent';
    t.updatedAt = Date.now();
    this.audit.record({ actorId: by, action: 'ticket.escalated', targetId: id });
  }

  reset(): void {
    this.tickets.clear();
  }
}
