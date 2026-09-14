# 8-Week IAM & SSO Job-Readiness Plan

## Week 1 — IAM Foundation (Lab 01)
Active Directory Domain Services, DNS, OUs, users, groups. Read up on LDAP (the protocol AD speaks under the hood) and Kerberos (how a Windows domain actually authenticates a logon, vs. a browser SSO flow) — both come up in interviews even when the day-to-day tool is a GUI.

## Week 2 — Identity Lifecycle & RBAC (Labs 02–03)
Joiner/Mover/Leaver, help-desk ticket workflows, RBAC, least privilege, authorization troubleshooting. Read about SCIM (the standard protocol real HR-to-IdP provisioning pipelines use to automate what Lab 02 does by hand) — you won't implement it here, but you should be able to explain what it replaces.

## Week 3 — SSO Fundamentals (Lab 04)
Keycloak as a reference open-source IdP; SAML and OIDC side by side — trust boundaries, redirect URIs, claims/assertions. Skim Okta's and Microsoft Entra ID's docs for the same concepts under different names — a real job will use one of those, not Keycloak, and the vocabulary drift catches people who only ever learned one vendor's UI.

## Week 4 — MFA & Conditional Access (Lab 05)
MFA methods (TOTP, push, FIDO2/WebAuthn — know why phishing-resistant FIDO2 beats TOTP for privileged accounts), conditional access policy design, scoped exceptions. Read about Zero Trust as the model these controls implement in practice ("never trust, always verify" — a CA policy is Zero Trust, operationalized).

## Week 5 — Governance & Break/Fix (Labs 06–07)
Access reviews, dormant/excessive-access detection, SSO production troubleshooting (config mismatches, clock skew, connectivity). Read about PKI basics — certificate expiry is one of the most common real SSO outages, and Lab 07 includes exactly that failure mode.

## Week 6 — Incident Response & Privileged Access (Labs 08–09)
Identity incident containment, escalation decisions, PIM/PAM concepts (standing privilege vs. time-boxed elevation). Read about commercial PAM tooling (CyberArk, or Entra PIM) and about SIEM platforms (Splunk, Sentinel) — the audit-log searches in Lab 08 are a hand-rolled version of what a SIEM does at scale.

## Week 7 — Conditional Access Deep-Dive & Hybrid Identity (Labs 11–12)
CA policy authoring in depth (legacy-auth blocking, role-based MFA, named-location exceptions), on-prem/cloud identity sync (password hash sync, soft-match conflicts). Read about Microsoft Entra Connect (or equivalent) as the real tool behind Lab 12's sync scenario, and about cloud IAM basics (AWS IAM / Entra ID role assignment) if your target role touches cloud infrastructure.

## Week 8 — Break-Glass, Capstone, and Interviews (Labs 13, 10)
Emergency-access design and recovery, then the full capstone end to end. Finish with mock interviews: walk through each lab's "Interview skills demonstrated" section out loud, unscripted.

## Daily practice
- 60–90 minutes lab work
- 15 minutes documentation
- 15 minutes explaining what you did aloud
- End every lab by answering: What broke? How did I prove the cause? What did I change? How did I verify the fix?
