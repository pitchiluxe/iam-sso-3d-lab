# Lab 09 — Privileged Identity Management Simulation

## Scenario
Hank O'Neill has held standing Domain Admin since before anyone on the current team started — exactly the kind of permanent grant this lab exists to eliminate. The fix isn't just "revoke it": Hank still needs a legitimate path to admin work, so the lab replaces the standing grant with a time-boxed, approved elevation, then proves the time-box actually ends.

## Objectives
1. Identify Hank's standing domain-admin privilege.
2. Remove the standing privilege.
3. Request time-limited elevation through an approval workflow.
4. Exercise the elevated access and end it — proving the grant is not standing.
5. Document the PAM policy.

## 3D environment
- **IAM Console** (`iam-ops`). Starting zone. Role revocation, Verify Authentication (used to actually create the session the elevation grants), and Active Sessions (used to end it) all live here.
- **SecOps Dashboard** (`sec-ops`, referenced from IAM Console). Where the elevation request and approval are recorded.

## Workflow

> Each numbered step maps 1:1 to a validation checkpoint in the conductor. Evidence bullets and tutor prompts are emitted at the same step.

1. **Identify the standing privilege.** Hank holds `role-domain-admin` via `grp-domain-admins`, granted with no expiry. **Evidence:** IAM Console snapshot. **Tutor:** "What is wrong with an administrator using a privileged account for daily email?"
2. **Remove the standing privilege.** Revoke it, with a documented reason. **Evidence:** 3 audit events. **Tutor:** "What is a break-glass account, and when is it appropriate?"
3. **Request elevation.** Submit a time-limited elevation request for Hank. Wait for Ivy Park's approval and record it. **Evidence:** ticket-console snapshot. **Tutor:** "What guardrails should a break-glass workflow still have?"
4. **Exercise the access, then end it.** Sign Hank in (Verify Authentication) — this is the session the elevation actually grants. Complete the admin task, then revoke that session yourself to simulate the 15-minute auto-expiry. **Evidence:** 5 audit events. **Tutor:** "How does a time-limited grant differ from a standing privilege in an audit trail? If nobody signed Hank in, what would revoking his sessions actually do?"
5. **Document the PAM policy.** Who can request, who approves, duration, audit requirements. **Evidence:** IAM Console snapshot. **Tutor:** "What guardrails does a break-glass account still need?"

## Evidence
- Standing-privilege discovery (step 1).
- Revocation audit trail (step 2).
- Elevation request and approval (step 3).
- Exercise-and-revoke audit trail (step 4).
- PAM policy document (step 5).

## Interview skills demonstrated
- Finding and removing a standing privileged grant that predates the current review cycle.
- Replacing standing access with a time-boxed, approved elevation instead of just deleting the access outright.
- Understanding that a time-limited grant only means something once it is actually used and actually ends — not just requested and approved.
- Distinguishing an audit trail for time-limited access (grant → session → revoke) from one for standing access (grant, full stop).
- Writing a PAM policy that names who can request, who approves, and how long access lasts.
