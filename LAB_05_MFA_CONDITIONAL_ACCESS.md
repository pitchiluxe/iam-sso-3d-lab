# Lab 05 — MFA & Conditional Access

## Scenario
Security requires MFA for privileged roles and a conditional access policy to block sign-ins from a foreign ASN. Partway through, Erin Cho — the first privileged user enrolled — hits a genuine MFA prompt loop, and a week later a traveling executive needs a legitimate exception to the new block. Both are real operational aftershocks of turning on a new control, not separate scenarios.

## Objectives
1. Enable MFA enforcement for privileged roles.
2. Enroll Erin Cho in TOTP and complete a clean sign-in.
3. Diagnose and fix an MFA prompt loop.
4. Design and test a conditional access policy blocking a foreign ASN.
5. Add a scoped, time-boxed exception without weakening the block generally.
6. Document the MFA and CA configuration end to end.

## 3D environment
- **IAM Console** (`iam-ops`). Starting zone. MFA Policy toggle, per-user MFA enrollment, and the audit log for diagnosing the prompt loop.
- **SecOps Dashboard** (`sec-ops`). Where the CA policy is written and tested, and where the block/exception events show up in the sign-in log.

## Workflow

> Each numbered step maps 1:1 to a validation checkpoint in the conductor. Evidence bullets and tutor prompts are emitted at the same step.

1. **Enable MFA for privileged roles.** Enforce MFA for `role-iam-admins` and `role-domain-admins`. **Evidence:** IAM Console snapshot. **Tutor:** "Why should MFA be required for privileged accounts, not all accounts?"
2. **Enroll Erin in TOTP.** Complete enrollment and a clean sign-in with MFA. **Evidence:** 3 audit events. **Tutor:** "What happens when a user loses their TOTP device?"
3. **Fix the MFA prompt loop (fault).** Erin reports repeated MFA prompts. Diagnose via sign-in logs and fix it. **Evidence:** 5 audit events. **Tutor:** "What log fields distinguish a genuine failure from a loop caused by misconfiguration?"
4. **Design and test a conditional access policy.** Write a policy blocking sign-ins from a foreign ASN. Simulate one and confirm it's denied. **Evidence:** SecOps Dashboard snapshot. **Tutor:** "Where would you evaluate a CA policy — IdP, app, or proxy? What signal tells you a sign-in is from a foreign ASN?"
5. **Test a policy exception.** A traveling executive needs access from the blocked ASN next week. Add a named-user, time-boxed exception and confirm the block still holds for everyone else. **Evidence:** SecOps Dashboard snapshot. **Tutor:** "If the exception were 'allow this ASN' instead of 'allow this user from this ASN,' who else would slip through?"
6. **Document the configuration.** Write up MFA-required roles, the prompt-loop cause and fix, the CA policy, and the exception with its expiry. **Evidence:** IAM Console snapshot. **Tutor:** "Six months from now, would your document explain why the exception exists, or just that it does?"

## Evidence
- MFA enforcement and Erin's enrollment/sign-in proof (steps 1–2).
- Prompt-loop diagnosis and fix audit trail (step 3).
- CA policy definition and simulated-block proof (step 4).
- Scoped exception and continued-block-for-others proof (step 5).
- MFA/CA configuration write-up (step 6).

## Interview skills demonstrated
- Phased MFA rollout by role rather than a blanket, help-desk-flooding cutover.
- Diagnosing an MFA prompt loop from sign-in logs (clock skew vs. secret mismatch vs. policy misconfiguration).
- Writing a conditional access policy with a specific condition and effect, then proving it blocks the traffic it targets.
- Scoping a policy exception narrowly (user + time-box) instead of broadly (whole ASN), and verifying the narrow scope holds.
- Documenting a security control well enough that an exception's justification survives past the person who granted it.
