# Lab 11 — Conditional Access Deep-Dive (Zero Trust)

## Scenario
The CISO has signed off on a Zero Trust maturity level 2 target. The IAM team must design, deploy, and validate two Conditional Access (CA) policies:

- **CA-001 — Block Legacy Authentication.** No sign-in may use POP, IMAP, SMTP, or LDAP basic. Only modern auth (OAuth 2.0 / OIDC) is permitted.
- **CA-002 — MFA for Privileged Roles.** Every member of `role-iam-admins`, `role-domain-admins`, and `role-sec-ops` must complete an MFA challenge on every interactive sign-in.

The legacy auth vector is the most common enterprise breach path (password-spray, OAuth phishing kits). The privileged-role vector is the highest-impact target. The two policies together close the two most expensive holes in the existing identity posture.

## Objectives
1. Audit current authentication methods and identify which apps still rely on legacy auth.
2. Design CA-001 (block legacy auth) and assign it to all cloud apps.
3. Design CA-002 (MFA for privileged roles) and assign it to the three admin role groups.
4. Exclude the two break-glass accounts from both policies (see Lab 13).
5. Simulate a legacy auth sign-in and verify the block fires in the audit log.
6. Simulate a privileged sign-in and verify the MFA challenge is enforced.
7. Add a named-location exception for a known-good on-prem ASN during the migration window.
8. Document the policy design rationale and review cadence.

## 3D environment
- **Briefing area** (lobby). Slide deck recaps Zero Trust principles and the specific gaps CA-001 and CA-002 close.
- **IAM Console room** (`iam-ops`). Console shows the CA policy editor, app inventory, and the named-locations list. The **Engineer Workstation** terminal on the central desk opens the IAM Console directly into the CA editor.
- **SecOps Dashboard** (`sec-ops`). Console shows the sign-in simulator and live audit log. Used to fire synthetic sign-ins and verify the policy evaluation result.
- **Tickets board** in the help desk. Two incident tickets waiting: "POP3 still allowed on Finance Portal" and "Domain admins signing in without MFA challenge."

## Workflow

> Each numbered step maps 1:1 to a validation checkpoint in the conductor. Evidence bullets and tutor prompts are emitted at the same step.

1. **Inventory legacy auth.** In the IAM Console, list every cloud app and the authentication methods each accepts. Identify at least one app that still permits IMAP or POP3. Capture the inventory as a snapshot. **Evidence:** console snapshot. **Tutor:** "Why would a modern cloud tenant still allow POP/IMAP authentication? Who owns the decision to keep it on?"
2. **Create CA-001.** In the CA policy editor, create *Block Legacy Authentication*. Scope: All users, exclude break-glass. Client apps: Exchange ActiveSync, POP, IMAP, SMTP, Authenticated SMTP. Grant: Block. **Evidence:** policy snapshot + 3 audit events. **Tutor:** "Why do you exclude break-glass from the block? What happens to a legitimate IMAP client the moment this policy activates?"
3. **Create CA-002.** Create *MFA for Privileged Roles*. Scope: members of `role-iam-admins`, `role-domain-admins`, `role-sec-ops`. Cloud apps: All. Grant: Require MFA. Test by signing in as `erin.cho` (IAM Admin) and completing the MFA challenge. **Evidence:** 5 audit log events. **Tutor:** "Is requiring MFA on every sign-in the right balance, or should it be step-up only? How would you test this policy before assigning it to all admins?"
4. **Simulate a legacy auth block.** Use the SecOps sign-in simulator. Fire a synthetic IMAP sign-in as a Finance user. Confirm the result is "blocked" and that the policy recorded is CA-001. (A fault may have caused a misconfiguration — fix it if so.) **Evidence:** SecOps snapshot. **Tutor:** "If the simulation shows 'allowed' instead of 'blocked', what would you check first? What audit event is emitted when CA-001 blocks a sign-in?"
5. **Add a named-location exception.** Engineering needs legacy auth from the on-prem datacenter ASN (`10.0.0.0/8`) while the migration is in flight. Add a named location and scope the exception in CA-001 to that location only. Document the risk acceptance in a one-paragraph note. **Evidence:** policy + named-location snapshot. **Tutor:** "What risk does allowing legacy auth from a corporate ASN introduce? What compensating control would you add alongside this exception?"
6. **Document the design.** Write a short policy document covering: policy names, what each blocks or requires, who is excluded, how exceptions are managed, and the review cadence (quarterly, with a triggered review on any material change). **Evidence:** doc snapshot. **Tutor:** "Who owns the policy review — IAM, SecOps, or the business? How often?"

## Evidence
- Inventory snapshot of legacy auth usage (step 1).
- CA-001 and CA-002 configuration snapshots (steps 2 and 3).
- Sign-in audit excerpts proving MFA challenge and legacy auth block (steps 3 and 4).
- Named-location and exception config (step 5).
- Policy design document (step 6).

## Interview skills demonstrated
- Translating a Zero Trust target into specific CA grant controls.
- Choosing the right scope (users, apps, client apps, locations) for each policy.
- Excluding emergency-access accounts from policies that could lock out recovery.
- Distinguishing "block" from "require MFA" grant controls and knowing when to use each.
- Testing CA policies with synthetic sign-ins before relying on them in production.
- Writing a CA policy design that an auditor can follow.
- Discussing the trade-off between a stricter policy and the operational impact of false positives.
