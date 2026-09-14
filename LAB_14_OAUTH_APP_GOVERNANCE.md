# Lab 14 — OAuth App Governance & Consent Phishing

## Scenario
Twenty minutes ago, Dan Rivera clicked "Accept" on a third-party app's OAuth consent screen — no password was stolen, no MFA was bypassed, he authenticated as himself and granted an app broad mailbox and file access it had no legitimate reason to request. This is consent-phishing: the attack targets the consent screen, not the login. Among the tenant's real, legitimate OAuth grants sits this one malicious grant, and — as consent-phishing campaigns usually do — it didn't stop at one inbox.

## Objectives
1. Identify the suspicious grant among the legitimate ones.
2. Revoke it for the first known victim.
3. Sweep the OAuth consent registry for other users who granted the same app.
4. Revoke the grant for the second victim found in the sweep.
5. Block the app tenant-wide so it cannot be granted again.
6. Document the incident and identify who needs to be notified.

## 3D environment
- **IAM Console** (`iam-ops`). Starting zone. "OAuth App Governance" is a new console section: OAuth Consent Grants (list, filterable by user), Revoke OAuth Grant, and Block OAuth App — the first real capability this environment has had for third-party app consent.
- **SecOps Dashboard** (`sec-ops`, referenced from IAM Console). Where the incident write-up and notification decision get recorded.

## Workflow

> Each numbered step maps 1:1 to a validation checkpoint in the conductor. Evidence bullets and tutor prompts are emitted at the same step.

1. **Identify the suspicious grant.** Open OAuth Consent Grants. Several apps are listed, including a legitimate, IT-approved one (TeamSync Meetings, Calendars.Read only). One app — QuickSign Docs, publisher "Bright Path Solutions (unverified)" — requests Mail.Read, Files.ReadWrite.All, and Contacts.Read, granted 20 minutes ago. **Evidence:** IAM Console snapshot. **Tutor:** "TeamSync Meetings is also a third-party app on this list — why is it not suspicious the same way? What made this grant worth a second look: the scopes, the publisher, the timing, or all three?"
2. **Revoke it for Dan.** Revoke Dan Rivera's grant to `oauth-quicksign-docs`. **Evidence:** 3 audit events. **Tutor:** "Revoking the grant stops future access — does it undo anything the app already read or wrote?"
3. **Sweep for other victims.** A phishing campaign rarely reaches one person. Search the registry for any other active grant to the same client ID. **Evidence:** IAM Console snapshot. **Tutor:** "If you stopped after fixing Dan, what would you be assuming about how the phishing email was sent?"
4. **Revoke the second victim's grant.** Erin Cho holds the same grant — revoke it. **Evidence:** 3 audit events. **Tutor:** "Why sweep before revoking, instead of revoking Dan and calling it resolved?"
5. **Block the app tenant-wide.** Revoking existing grants doesn't stop a third person from accepting the same consent prompt tomorrow. Block `oauth-quicksign-docs`. **Evidence:** 3 audit events. **Tutor:** "What is the difference between revoking a grant and blocking an app — why do you need both?"
6. **Document and notify.** Write up the app, scopes, both affected users, grant/revoke timestamps, and the block. Recommend requiring admin approval for future third-party app consent. **Evidence:** IAM Console snapshot. **Tutor:** "If admin-consent-required had already been policy, would this incident have happened at all?"

## Evidence
- Suspicious-grant identification, distinguishing it from the legitimate app (step 1).
- Revocation audit trail for Dan (step 2).
- Sweep results identifying Erin as a second victim (step 3).
- Revocation audit trail for Erin (step 4).
- App-block audit trail (step 5).
- Incident write-up with notification and policy recommendation (step 6).

## Interview skills demonstrated
- Recognizing consent-phishing as an attack on the OAuth consent screen, distinct from credential theft.
- Distinguishing a malicious grant from a legitimate one by scope breadth, publisher trust, and timing together — not any single signal alone.
- Sweeping for other victims of the same campaign instead of treating the first found account as the whole incident.
- Knowing that revoking an existing grant and blocking the app from being granted again are two separate, both-necessary controls.
- Writing an incident report that names who to notify and what policy change would prevent recurrence — not just what was fixed.
