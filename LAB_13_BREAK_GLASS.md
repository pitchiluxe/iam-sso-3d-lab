# Lab 13 — Break-Glass Account (Emergency Access)

## Scenario
A tenant-wide IdP fault has just been detected: every MFA challenge is failing, and the standard admin accounts are locked out. The only way in is a break-glass account. The catch — there isn't a usable one. The team has 30 minutes to design and stand up two break-glass accounts, store the credentials in the vault, alert on any sign-in, and run an access review on the new accounts before the recovery can be declared complete.

A break-glass account is an emergency-access identity that is **always** excluded from MFA enforcement and from CA policies that could block it. It is the last line of defense when normal admin paths fail. It is also the highest-value target for an attacker who has compromised the cloud control plane — so it must be guarded with the strongest auth, the tightest alerting, and the most rigorous review cycle.

## Objectives
1. Write a break-glass policy before creating any accounts (who, where, alerts, shelf life).
2. Create two break-glass accounts (`bg-emergency-1`, `bg-emergency-2`) with Global Admin role and FIDO2 auth.
3. Exclude both accounts from CA-001 and CA-002 (the policies from Lab 11).
4. Store the credentials in the vault with a documented handoff procedure.
5. Configure a real-time P0 alert on any sign-in by either account.
6. Run a quarterly access review on the break-glass accounts themselves.
7. Use the break-glass account to recover from a simulated IdP MFA outage.

## 3D environment
- **Briefing area** (lobby). One slide: "If the IdP is down, how do you get back in?" Below it, a diagram of two break-glass accounts, two vault handoff locations, two alerting channels.
- **IAM Console** (`iam-ops`). The CA policy editor, the role assignment page, and the access review scheduler. The **Engineer Workstation** terminal on the central desk opens directly into the role + CA pages.
- **SecOps Dashboard** (`sec-ops`). The alert rule editor, the sign-in log, and the incident console. Used to fire the alert and to drive the recovery scenario.
- **Tickets board** in the help desk. Two tickets: "Build break-glass accounts (P0, due today)" and "Run quarterly access review on break-glass (P1, due this week)."

## Workflow

> Each numbered step maps 1:1 to a validation checkpoint in the conductor. Evidence bullets and tutor prompts are emitted at the same step.

1. **Write the policy first.** Before any account is created, write a one-paragraph break-glass policy covering: how many accounts, who owns them, where credentials are stored, who is alerted, and the maximum credential age. **Evidence:** policy doc snapshot. **Tutor:** "Why two break-glass accounts, not one? Who should own the break-glass credentials — IT, SecOps, or the CISO?"
2. **Create `bg-emergency-1`.** Create the user in the on-prem AD (it will sync). Assign Global Admin. Configure FIDO2 as the auth method. Do not enable MFA enforcement for this account yet — that comes at step 4. **Evidence:** account + role snapshot. **Tutor:** "Should a break-glass account use the same UPN suffix as regular users? Why is FIDO2 preferred over TOTP for break-glass?"
3. **Create `bg-emergency-2`.** Same role and auth profile. Confirm the two accounts have different FIDO2 keys, different device registrations, and different vault handoff locations. **Evidence:** account + role snapshot. **Tutor:** "If both break-glass accounts were stored in the same vault, what is the single point of failure? How would two staff members each hold a half of a FIDO2 secret?"
4. **Exclude from CA policies.** Edit CA-001 (Block Legacy Auth) and CA-002 (MFA for Privileged). Add both break-glass accounts to the *Exclude* list. Document the risk acceptance — a sign-in failure of either CA must not lock out the recovery path. **Evidence:** policy snapshots + 3 audit events. **Tutor:** "What is the blast radius if an attacker compromises a break-glass account? How do you detect that compromise quickly?"
5. **Configure real-time alerting.** In the SecOps Dashboard, create an alert rule: any sign-in by `bg-emergency-1` or `bg-emergency-2` fires a P0 alert to the on-call channel. Verify the rule by performing a synthetic sign-in. **Evidence:** 5 audit events. **Tutor:** "What should the on-call do when the alert fires — page the CISO immediately, or investigate first? What is the expected MTTR on a break-glass alert?"
6. **Run a quarterly access review on the accounts themselves.** The break-glass accounts are now in scope for a review. Run the review: confirm both accounts still exist, still hold Global Admin, and the credentials are still in the vault. Approve or revoke. **Evidence:** review snapshot. **Tutor:** "Who is the appropriate reviewer for break-glass accounts — the same people who can use them? What evidence proves the credentials were actually rotated this quarter?"
7. **Test the recovery flow (fault).** A fault has been applied: the IdP is rejecting all MFA challenges. Use the break-glass account to recover. Sign in, disable the failing CA policy, reset MFA. Document the recovery in a post-incident note. **Evidence:** 5 audit events. **Tutor:** "What is the first action a recovered admin should take — change the CA policy or rotate the break-glass credentials? How quickly must the break-glass credentials be rotated after a recovery?"

## Evidence
- Break-glass policy document (step 1).
- Account, role, and CA-exclusion snapshots (steps 2, 3, and 4).
- Alert rule and synthetic sign-in proof (step 5).
- Quarterly access review (step 6).
- Recovery flow audit log and post-incident note (step 7).

## Interview skills demonstrated
- Designing emergency access so that no single person can sign in as Global Admin unilaterally.
- Knowing when a break-glass account is appropriate, and what guardrails it still requires.
- Excluding emergency accounts from CA policies without leaving them unauthenticated.
- Writing a real-time alert on a low-volume, high-severity event.
- Reviewing the break-glass accounts themselves, not just the regular estate.
- Operating a recovery: diagnosing an IdP failure, choosing the right recovery path, rotating the credentials afterward.
- Writing a post-incident note that an auditor can follow end to end.
