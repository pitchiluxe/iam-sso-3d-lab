# Lab 16 — LDAP & Kerberos Authentication Troubleshooting

## Scenario
Several users start failing Windows logon on domain-joined workstations at the same moment — not the SSO portal, not a VPN, straight domain authentication. A wrong password explains one failure; it doesn't explain several at once. The actual cause is a domain controller clock that's drifted out of Kerberos's tolerance window, and one user got locked out from the repeated failures it caused along the way.

## Objectives
1. Triage the logon failure pattern across multiple workstations.
2. Diagnose and fix the underlying clock skew.
3. Unlock the account locked out during the incident.
4. Verify sign-in succeeds post-fix.
5. Document the Kerberos-specific root cause and prevention.

## 3D environment
- **SecOps Dashboard** (`sec-ops`). Starting zone. The audit log is where the clustered failure pattern shows up.
- **IAM Console** (`iam-ops`). "Sync IdP Clock" (Application Configuration section) fixes the drift; "Unlock Account" (Credentials & Recovery) recovers the locked-out user; Verify Authentication confirms the fix.

## Workflow

> Each numbered step maps 1:1 to a validation checkpoint in the conductor. Evidence bullets and tutor prompts are emitted at the same step.

1. **Triage the failure pattern.** Review sign-in logs. Multiple users, clustered timing, domain-joined machines — not a bad-password shape. **Evidence:** 10 audit events. **Tutor:** "If this were a bad-password problem, would you expect it to hit multiple users at the same moment? What is different about a Kerberos ticket failure versus a simple wrong-credential failure?"
2. **Diagnose and fix the clock skew.** Kerberos tickets are valid only within a tight window (~5 minutes by default) between client and domain controller. Resync the clock. **Evidence:** 5 audit events. **Tutor:** "Why does Kerberos care about clock accuracy when password authentication does not?"
3. **Unlock the locked-out account.** Greta Olsen's account locked from repeated failures during the outage — a side effect, not a compromise. Unlock it. **Evidence:** IAM Console snapshot. **Tutor:** "How would you tell the difference between a lockout caused by this outage and one caused by an actual credential-stuffing attempt?"
4. **Verify sign-in succeeds.** Confirm Greta can sign in now that both fixes are in place. **Evidence:** 3 audit events. **Tutor:** "If the sign-in still failed here, which of the two fixes would you suspect first?"
5. **Document root cause and prevention.** Kerberos's clock-tolerance mechanism, why it turned one drifting clock into a mass failure, and an NTP-monitoring recommendation. **Evidence:** IAM Console snapshot. **Tutor:** "Why did this incident affect many users at once instead of looking like isolated help-desk tickets?"

## Evidence
- Clustered failure-pattern findings (step 1).
- Clock-sync audit trail (step 2).
- Account-unlock snapshot (step 3).
- Successful post-fix sign-in (step 4).
- Root-cause and NTP-monitoring write-up (step 5).

## Interview skills demonstrated
- Recognizing a systemic authentication failure by its shape (multiple users, clustered timing) rather than treating each report as an isolated ticket.
- Understanding why Kerberos depends on clock synchronization in a way password authentication does not.
- Distinguishing an incident-caused lockout from an attack-caused one by timing correlation, before treating the account as compromised.
- Verifying a fix that depends on two independent prior actions, not just one.
- Explaining LDAP (the directory protocol) and Kerberos (the authentication protocol) as the two halves of domain sign-in, and why a monitoring gap in one caused a fleet-wide outage.
