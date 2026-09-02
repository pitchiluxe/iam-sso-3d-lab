/**
 * seed/perLab/lab08.ts — Identity Incident Response.
 * Baseline + inject suspicious sign-ins for Jane; pre-open an incident.
 */
import type { MockDirectory } from '@/services';
import type { MockIdP } from '@/services';
import type { MockAppServer } from '@/services';
import type { MockIncidents } from '@/services';
import type { MockAuditLog } from '@/services';
import { applyBaseline } from '../baseline';

export function applyLab08Seed(
  dir: MockDirectory,
  idp: MockIdP,
  apps: MockAppServer,
  incidents: MockIncidents,
  audit: MockAuditLog,
): void {
  const base = applyBaseline(dir, idp, apps);
  const jane = base.userIds['jane.doe']!;

  // Pre-open incident
  incidents.open({
    title: 'Suspicious sign-in activity for jane.doe',
    severity: 'high',
    affectedUserIds: [jane],
    affectedAppIds: [],
    summary: 'Three failed sign-ins from foreign ASN (203.0.113.42) followed by one success. Possibly credential-stuffing.',
    indicators: ['geo:foreign', 'asn:AS-12345', 'rapid-fail-then-success'],
  });

  // Add suspicious audit events directly via audit log
  for (let i = 0; i < 3; i++) {
    audit.record({
      actorId: jane, action: 'signin.failure', targetId: jane,
      sessionId: 'suspicious' as import('@/domain').SessionId,
      ip: '203.0.113.42',
    });
  }
  audit.record({
    actorId: jane, action: 'signin.success', targetId: jane,
    sessionId: 'suspicious' as import('@/domain').SessionId,
    ip: '203.0.113.42',
  });
}
