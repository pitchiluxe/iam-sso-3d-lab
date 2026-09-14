/**
 * services/mockOAuthGrants.ts — third-party OAuth app consent registry.
 *
 * Models the thing a consent-phishing attack actually abuses: a user grants
 * a malicious app delegated access via the normal OAuth consent screen, no
 * password ever changes hands. Revoking the grant and blocking the app are
 * both real, auditable actions — this class takes an audit dependency from
 * the start (mockAccessReviews.ts and mockIncidents.ts didn't, and the
 * former shipped a step that could never complete as a result).
 */
import type { OAuthGrant, OAuthGrantId, UserId } from '@/domain';
import { mkOAuthGrantId } from '@/domain';
import type { MockAuditLog } from './mockAuditLog';

export class MockOAuthGrants {
  private grants = new Map<OAuthGrantId, OAuthGrant>();
  private blockedClientIds = new Set<string>();

  constructor(private readonly audit?: MockAuditLog) {}

  seedGrant(g: Omit<OAuthGrant, 'id' | 'status'> & { status?: OAuthGrant['status'] }): OAuthGrant {
    const id = mkOAuthGrantId();
    const grant: OAuthGrant = { ...g, id, status: g.status ?? 'active' };
    this.grants.set(id, grant);
    return grant;
  }

  list(): OAuthGrant[] {
    return Array.from(this.grants.values());
  }

  get(id: OAuthGrantId): OAuthGrant | undefined {
    return this.grants.get(id);
  }

  /** Every active grant for a given app, across every user who consented to
   *  it — the sweep a consent-phishing response has to run. */
  byClientId(clientId: string): OAuthGrant[] {
    return this.list().filter((g) => g.clientId === clientId);
  }

  revoke(id: OAuthGrantId, by: UserId): void {
    const g = this.grants.get(id);
    if (!g) throw new Error(`[oauth-grants] revoke: grant ${id} not found`);
    g.status = 'revoked';
    this.audit?.record({
      actorId: by,
      action: 'oauth.grant.revoked',
      targetId: g.id,
      subjectId: g.grantedByUserId,
      diff: { appName: g.appName, clientId: g.clientId, scopes: g.scopes },
    });
  }

  isBlocked(clientId: string): boolean {
    return this.blockedClientIds.has(clientId);
  }

  blockApp(clientId: string, by: UserId): void {
    this.blockedClientIds.add(clientId);
    this.audit?.record({
      actorId: by,
      action: 'oauth.app.blocked',
      targetId: clientId,
    });
  }

  reset(): void {
    this.grants.clear();
    this.blockedClientIds.clear();
  }
}
