/**
 * seed/perLab/lab14.ts — OAuth App Governance & Consent Phishing.
 * Baseline + a legitimate app grant (noise) + a malicious app grant against
 * two separate users, simulating a consent-phishing campaign that hit more
 * than one inbox.
 */
import type { MockDirectory } from '@/services';
import type { MockIdP } from '@/services';
import type { MockAppServer } from '@/services';
import type { MockOAuthGrants } from '@/services';
import { applyBaseline } from '../baseline';

export function applyLab14Seed(
  dir: MockDirectory,
  idp: MockIdP,
  apps: MockAppServer,
  oauthGrants: MockOAuthGrants,
): void {
  const base = applyBaseline(dir, idp, apps);
  const dan = base.userIds['dan.rivera']!;
  const erin = base.userIds['erin.cho']!;
  const cara = base.userIds['cara.patel']!;

  // Legitimate, IT-approved app — noise the learner must recognize and leave
  // alone, not revoke on general suspicion of "a third-party app".
  const DAY = 24 * 60 * 60 * 1000;
  oauthGrants.seedGrant({
    appName: 'TeamSync Meetings',
    publisher: 'Meridian Collab (IT-approved vendor)',
    clientId: 'oauth-teamsync',
    scopes: ['Calendars.Read'],
    grantedByUserId: dan,
    grantedAt: Date.now() - 60 * DAY,
  });
  oauthGrants.seedGrant({
    appName: 'TeamSync Meetings',
    publisher: 'Meridian Collab (IT-approved vendor)',
    clientId: 'oauth-teamsync',
    scopes: ['Calendars.Read'],
    grantedByUserId: cara,
    grantedAt: Date.now() - 45 * DAY,
  });

  // The malicious grant: Dan clicked a phishing link this morning and
  // accepted broad, unrelated scopes from an unverified publisher.
  oauthGrants.seedGrant({
    appName: 'QuickSign Docs',
    publisher: 'Bright Path Solutions (unverified)',
    clientId: 'oauth-quicksign-docs',
    scopes: ['Mail.Read', 'Files.ReadWrite.All', 'Contacts.Read'],
    grantedByUserId: dan,
    grantedAt: Date.now() - 20 * 60 * 1000,
  });
  // Same campaign, a second victim — not visible from Dan's grant alone,
  // which is exactly why the sweep step exists.
  oauthGrants.seedGrant({
    appName: 'QuickSign Docs',
    publisher: 'Bright Path Solutions (unverified)',
    clientId: 'oauth-quicksign-docs',
    scopes: ['Mail.Read', 'Files.ReadWrite.All', 'Contacts.Read'],
    grantedByUserId: erin,
    grantedAt: Date.now() - 35 * 60 * 1000,
  });
}
