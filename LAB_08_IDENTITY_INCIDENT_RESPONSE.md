# Lab 08 — Identity Security Incident

## Scenario
Jane Doe's account shows three failed sign-ins from a foreign ASN followed by one success — a credential-stuffing pattern. The incident is already open when the shift starts; the work is triage, containment, a related-activity sweep, an actual escalation decision (not just "write it down and move on"), the report, and closure.

## Objectives
1. Open and triage the incident.
2. Contain Jane's account.
3. Search for related activity from the same source.
4. Decide whether to escalate, and to whom.
5. Write the incident report.
6. Close the incident.

## 3D environment
- **SecOps Dashboard** (`sec-ops`). Starting zone. The Incidents tab drives the whole lifecycle: Contain → Mark recovered → Close, plus a standing "Write report" action. The audit log is where steps 1 and 3 are worked.
- **IAM Console** (`iam-ops`). Where Jane's account gets disabled and her sessions revoked as part of containment.

## Workflow

> Each numbered step maps 1:1 to a validation checkpoint in the conductor. Evidence bullets and tutor prompts are emitted at the same step.

1. **Triage the suspicious sign-in.** Review the audit events: three failed sign-ins from ASN 203.0.113.42, then one success. Identify the affected account. **Evidence:** 10 audit events. **Tutor:** "What indicators distinguish credential stuffing from a legitimate foreign sign-in?"
2. **Contain Jane's account.** Disable the account and revoke all active sessions. **Evidence:** 5 audit events + IAM Console snapshot. **Tutor:** "What is the difference between containment and eradication here?"
3. **Search for related activity.** Check the audit log for any other accounts touched from the same ASN, and for signs of privilege escalation. **Evidence:** 20 audit events. **Tutor:** "How would you know if the attacker used Jane's account to pivot to other systems?"
4. **Decide whether to escalate.** Using what step 3 found, decide whether this stays a routine containment or gets escalated — and name who. **Evidence:** SecOps Dashboard snapshot. **Tutor:** "What would turn this from 'one contained account' into 'notify the CISO'? If you escalate everything, what happens to signal-to-noise the next time something is actually urgent?"
5. **Write the incident report.** Timeline, indicators, containment actions, the escalation decision, and next steps. **Evidence:** SecOps Dashboard snapshot. **Tutor:** "What would you recommend to prevent this from happening again?"
6. **Close the incident.** Mark it recovered, then close it. **Evidence:** 3 audit events. **Tutor:** "When would you re-enable Jane's account? What conditions must be met?"

## Evidence
- Triage findings (step 1).
- Containment audit trail and snapshot (step 2).
- Related-activity sweep results (step 3).
- Escalation decision and rationale (step 4).
- Incident report (step 5).
- Closure audit trail (step 6).

## Interview skills demonstrated
- Reading a sign-in pattern (rapid fail, then success) as a credential-stuffing indicator, not just a login.
- Executing containment (disable + revoke) as two distinct, both-necessary actions.
- Sweeping for lateral movement before declaring an incident scoped to one account.
- Making — and justifying — an escalation call instead of either escalating everything or nothing.
- Writing an incident report structured for management, legal, and audit review.
- Knowing the closure lifecycle: contained → recovered → closed, not a single "done" button.
