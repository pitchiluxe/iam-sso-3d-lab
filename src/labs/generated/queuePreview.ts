/**
 * labs/generated/queuePreview.ts — what a batch queue will contain, before
 * anybody starts it.
 *
 * The AI writes the scene for a queue from the queue's real ticket subjects,
 * so it needs them at generation time. The subjects live in the batch seed,
 * so this runs the seed once against a scratch estate and reads them back.
 */
import { MockAuditLog } from '@/services/mockAuditLog';
import { MockDirectory } from '@/services/mockDirectory';
import { MockIdP } from '@/services/mockIdP';
import { MockAppServer } from '@/services/mockAppServer';
import { MockTicketQueue } from '@/services/mockTicketQueue';
import { MockAccessReviews } from '@/services/mockAccessReviews';
import { MockIncidents } from '@/services/mockIncidents';
import { createEventBus } from '@/util/events';
import type { SeedContext } from '@/conductor/seedRegistry';
import type { BatchTemplate } from './templates';

export function batchTicketSubjects(bt: BatchTemplate, ticketIds: string[]): string[] {
  const audit = new MockAuditLog(createEventBus());
  const dir = new MockDirectory(audit);
  const idp = new MockIdP(audit, dir);
  const apps = new MockAppServer(dir, idp, audit);
  const tickets = new MockTicketQueue(audit);
  const ctx = {
    audit,
    dir,
    idp,
    apps,
    tickets,
    reviews: new MockAccessReviews(audit),
    incidents: new MockIncidents(),
  } as unknown as SeedContext;
  try {
    bt.seed(ctx, ticketIds);
    return tickets.list().map((t) => t.subject);
  } catch {
    return [];
  }
}
