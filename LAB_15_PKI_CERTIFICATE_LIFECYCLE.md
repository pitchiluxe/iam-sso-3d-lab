# Lab 15 — PKI & Certificate Lifecycle

## Scenario
Finance Portal's signing certificate expired overnight — one of the most common real SSO outages, and one that has nothing to do with passwords, redirect URIs, or claims. While fixing it, the inventory taken along the way flags Help Desk Portal's certificate as the next one due to expire. This lab is both halves of certificate hygiene: fixing the one that already failed, and rotating the one that hasn't yet.

## Objectives
1. Inventory application certificates and identify expiry risk.
2. Diagnose and fix Finance Portal's expired certificate.
3. Verify sign-in for two users post-fix.
4. Proactively rotate Help Desk Portal's certificate before it expires.
5. Document a certificate monitoring and renewal policy.

## 3D environment
- **IAM Console** (`iam-ops`). Starting zone. Registered Applications for the inventory; "Update App Configuration" (Application Configuration section) both fixes the expired certificate and performs the proactive rotation — the same tool, two different triggers.
- **Application Center** (`app-center`). Where the Finance Portal sign-in fails and shows a "Configuration mismatch" panel naming the expired field and expected renewal date.

## Workflow

> Each numbered step maps 1:1 to a validation checkpoint in the conductor. Evidence bullets and tutor prompts are emitted at the same step.

1. **Inventory application certificates.** Review Registered Applications. Note which apps rely on certificate-backed trust. **Evidence:** IAM Console snapshot. **Tutor:** "What breaks first when a signing certificate expires — authentication, or the trust the assertion relies on?"
2. **Fix Finance Portal's expired certificate.** Read the "Configuration mismatch" panel — it names the field and expected renewal date — then correct it. **Evidence:** config-diff capture. **Tutor:** "What is the practical difference between an expired certificate and a wrong redirect URI, from the end user's point of view? Who owns certificate renewal in a real organization?"
3. **Verify both portals authenticate.** Sign in as Dan Rivera on Finance Portal and Erin Cho on Help Desk Portal. **Evidence:** 5 audit events. **Tutor:** "Why verify a second, unaffected app instead of only the one you just fixed?"
4. **Rotate Help Desk Portal's certificate proactively.** The inventory flagged it as next to expire — rotate it now, before it fails the same way. **Evidence:** config-diff capture. **Tutor:** "What is the advantage of rotating this certificate now versus waiting for it to fail like Finance Portal's did?"
5. **Document a monitoring policy.** Alert threshold, ownership, and how you'd have caught today's expiry in advance. **Evidence:** IAM Console snapshot. **Tutor:** "If every certificate were monitored with a 30-day-out alert, would today's incident have happened?"

## Evidence
- Certificate inventory and expiry-risk assessment (step 1).
- Finance Portal fix — config-diff before/after (step 2).
- Dual-portal sign-in proof (step 3).
- Help Desk Portal rotation — config-diff before/after (step 4).
- Certificate monitoring policy (step 5).

## Interview skills demonstrated
- Diagnosing a certificate-expiry outage from a configuration-mismatch panel rather than guessing at redirect URIs or claims.
- Distinguishing reactive fix (something already failed) from proactive rotation (nothing has failed yet) as two different postures with the same tool.
- Verifying an unrelated app after a fix, to confirm the fix was scoped correctly and didn't mask a wider issue.
- Writing a certificate monitoring policy with a concrete alert threshold and named ownership, not just "watch expiry dates."
