# Lab 04 — Enterprise SSO with SAML and OIDC

## Scenario
Two applications need single sign-on: the Finance Portal over SAML, the Help Desk Portal over OIDC. Both are registered in the app catalog but arrive unconfigured — this is the first integration, not a patch to something already working. Partway through verification, a live redirect-URI fault hits the Finance Portal, so the learner also has to read a failed sign-in for evidence and fix it without re-doing the whole configuration.

## Objectives
1. Configure Finance Portal as a SAML client (entity ID, redirect URI).
2. Configure Help Desk Portal as an OIDC client (redirect URI, issuer).
3. Map the role claim for Help Desk access.
4. Verify SSO for two users (Dan, Erin) without re-entering credentials.
5. Diagnose and fix an injected redirect-URI fault on the Finance Portal.
6. Document both configurations and the fault.

## 3D environment
- **IAM Console** (`iam-ops`). Starting zone. "Update App Configuration" (Application Configuration section) is where every field gets set and every fault gets fixed — same form for initial setup and for the later break/fix.
- **Application Center** (`app-center`). Where Finance Portal and Help Desk Portal live as fictional SAML/OIDC-enabled apps; sign-in attempts happen here, and a failed one surfaces a "Configuration mismatch" panel naming the exact field and expected value.

## Workflow

> Each numbered step maps 1:1 to a validation checkpoint in the conductor. Evidence bullets and tutor prompts are emitted at the same step.

1. **Configure Finance Portal as SAML.** Set entity ID `urn:finance.northwind.example` and redirect URI `https://finance.northwind.example/callback` via Update App Configuration. **Evidence:** IAM Console snapshot. **Tutor:** "What is the trust boundary in SAML — the browser, the IdP, or the SP? The app started unconfigured, not missing — what does that tell you about where to look?"
2. **Configure Help Desk Portal as OIDC.** Set redirect URI `https://helpdesk.northwind.example/callback` and issuer `https://idp.northwind.example/realms/northwind`. **Evidence:** IAM Console snapshot. **Tutor:** "What does the OIDC issuer URL represent in the trust chain?"
3. **Map the role claim.** Map the role claim to `grp-helpdesk-tier1` for the Help Desk Portal. Test that Dan Rivera can reach it. **Evidence:** 3 audit events. **Tutor:** "What attributes would you need to map to grant Finance access instead?"
4. **Verify SSO for both portals.** Sign in as Erin Cho and reach both portals without re-entering credentials. **Evidence:** 5 audit events. **Tutor:** "What evidence proves SSO is working and not just cached credentials?"
5. **Diagnose a live redirect-URI fault.** Finance Portal sign-ins start failing. Read the "Configuration mismatch" panel on the failed attempt, then fix the named field. **Evidence:** config-diff capture on app-finance. **Tutor:** "What is the first evidence you'd check to confirm this is a redirect-URI mismatch and not an IdP outage? Why does a wrong redirect URI fail closed instead of silently logging in to the wrong place?"
6. **Document the SSO configuration.** Write up both app configs and the fault: cause, fix, and how you'd detect it faster next time. **Evidence:** IAM Console snapshot. **Tutor:** "If a new SSO integration used your document as a template, would it have every field it needs?"

## Evidence
- Finance Portal (SAML) and Help Desk Portal (OIDC) configuration snapshots (steps 1–2).
- Role-claim mapping and Dan's sign-in proof (step 3).
- Erin's dual-portal SSO proof (step 4).
- Redirect-URI fault's config-diff, before and after (step 5).
- SSO configuration + incident write-up (step 6).

## Interview skills demonstrated
- Configuring a SAML SP (entity ID, ACS/redirect URI) and an OIDC RP (redirect URI, issuer) from scratch.
- Mapping an IdP claim to application-side authorization.
- Distinguishing "SSO works" from "the user is cached" with a same-session, two-app proof.
- Reading a configuration-mismatch panel as the first diagnostic step, before touching logs or the console.
- Writing SSO documentation detailed enough for someone else to fix the same fault without re-deriving it.
