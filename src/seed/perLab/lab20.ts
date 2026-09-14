/**
 * seed/perLab/lab20.ts — Identity Threat Detection (ITDR).
 *
 * Three accounts show overnight sign-in activity. Two are false positives
 * with a mundane explanation; one is real. The tell for the real one is not
 * the sign-in alone — it's the sign-in followed by a privilege change nobody
 * requested. Deliberately makes the real threat the SecOps analyst's own
 * account: an alert reviewer has to be willing to investigate a colleague as
 * impartially as a stranger.
 */
import type { MockDirectory } from '@/services';
import type { MockIdP } from '@/services';
import type { MockAppServer } from '@/services';
import type { MockAuditLog } from '@/services';
import type { SessionId } from '@/domain';
import { applyBaseline } from '../baseline';

export function applyLab20Seed(
  dir: MockDirectory,
  idp: MockIdP,
  apps: MockAppServer,
  audit: MockAuditLog,
): void {
  const base = applyBaseline(dir, idp, apps);
  const finn = base.userIds['finn.muller']!;
  const dan = base.userIds['dan.rivera']!;
  const greta = base.userIds['greta.olsen']!;

  // Decoy: Dan mistypes his password once, then signs in normally from his
  // usual location. No follow-on action. A false positive.
  audit.record({
    actorId: dan,
    action: 'signin.failure',
    targetId: dan,
    sessionId: 'decoy-dan' as SessionId,
    ip: '198.51.100.10',
  });
  audit.record({
    actorId: dan,
    action: 'signin.success',
    targetId: dan,
    sessionId: 'decoy-dan' as SessionId,
    ip: '198.51.100.10',
  });

  // Decoy: Greta signs in from a new city — she is travelling for a board
  // meeting this week. New location, no failed attempts first, no follow-on
  // privilege change. A false positive with a mundane explanation.
  audit.record({
    actorId: greta,
    action: 'signin.success',
    targetId: greta,
    sessionId: 'decoy-greta' as SessionId,
    ip: '192.0.2.88',
  });

  // Real threat: Finn — three failed sign-ins, then success, from a foreign
  // address, immediately followed by granting himself standing domain-admin.
  // Nothing about the sign-in alone proves compromise; the unrequested
  // privilege change right after it does.
  for (let i = 0; i < 3; i++) {
    audit.record({
      actorId: finn,
      action: 'signin.failure',
      targetId: finn,
      sessionId: 'incident-finn' as SessionId,
      ip: '203.0.113.77',
    });
  }
  audit.record({
    actorId: finn,
    action: 'signin.success',
    targetId: finn,
    sessionId: 'incident-finn' as SessionId,
    ip: '203.0.113.77',
  });
  const role = dir.createRole('role-domain-admins', 'Domain Administrators', ['domain:*']);
  dir.grantRoleDirect(finn, role.id, finn);

  // finn.muller already has a baseline password (finn.muller123) seeded by
  // applyBaseline — reuse it rather than overwrite it, so "Verify
  // Authentication"'s ${username}123 convention still works for him.
  idp.signIn('finn.muller', 'finn.muller123');
}
