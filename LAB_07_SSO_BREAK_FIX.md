# Lab 07 — SSO Production-Style Break/Fix

## Scenario
At 9:05 AM, employees start reporting authentication errors on the Finance Portal. One of seven possible faults is live — randomized per run — and the fix has to match the actual root cause: a config-field mismatch, an offline service, or a skewed clock all look different in triage and require a different tool to resolve.

## Injected faults
Chosen at random, one per run:
- Incorrect redirect URI
- Expired/invalid certificate
- Wrong client secret
- Incorrect claim mapping
- Clock skew
- DNS resolution / connectivity problem (app goes offline)

(An "incorrect issuer" fault is deliberately not in this lab's pool — `issuer` is an OIDC concept and the Finance Portal is SAML, so that fault would have nothing to corrupt.)

## Objectives
1. Open an incident ticket and record the symptoms.
2. Triage: check app config, IdP logs, DNS, and clock — in that order.
3. Identify the fault and apply the matching fix.
4. Retest with two users and document root cause, impact, and remediation.

## 3D environment
- **IAM Console** (`iam-ops`). Starting zone. "Update App Configuration" fixes field-level mismatches (redirect URI, entity ID, issuer, client secret, claim mapping); "Restart App Service" recovers an app stuck offline; "Sync IdP Clock" fixes clock skew — three different tools for three different failure shapes.
- **Application Center** (`app-center`). Where the Finance Portal sign-in is attempted and where a "Configuration mismatch" panel appears on failure, naming the exact broken field when the fault is config-shaped.
- **SecOps Dashboard** (`sec-ops`). Incident ticket, audit log, and the config-diff evidence capture.

## Workflow

> Each numbered step maps 1:1 to a validation checkpoint in the conductor. Evidence bullets and tutor prompts are emitted at the same step.

1. **Open the incident.** Record time, user impact, error, and scope. **Evidence:** ticket snapshot. **Tutor:** "What is the first log you would check when SSO fails?"
2. **Triage.** Compare the Finance Portal config against baseline, check IdP logs, verify DNS resolution and clock skew — in that order, cheapest check first. **Evidence:** config-diff + 10 audit events. **Tutor:** "Why did you check DNS before certificates?"
3. **Identify and apply the fix.** Match the tool to the symptom: a mismatch panel naming a field means Update App Configuration; an offline app with no field named means Restart App Service; no app-side symptom at all, only assertion/timing failures, means Sync IdP Clock. **Evidence:** config-diff capture. **Tutor:** "What is the difference between the wrong issuer and a wrong redirect URI as failure modes? If no configuration mismatch panel appears at all, what does that tell you about where the fault actually lives?"
4. **Retest and document.** Sign in as Dan Rivera (normal) and Erin Cho (privileged) — both must succeed. Document root cause and remediation. **Evidence:** 5 audit events. **Tutor:** "What would you add to a runbook to prevent this fault from recurring?"

## Evidence
- Incident ticket (step 1).
- Config-diff and triage log excerpts (step 2).
- Fix confirmation — config-diff before/after (step 3).
- Dual-user retest proof and root-cause writeup (step 4).

## Interview skills demonstrated
- Running a fixed triage order (config → IdP logs → DNS → clock) instead of guessing.
- Distinguishing a configuration fault from a connectivity fault from a clock fault by their symptoms, not by trying fixes at random.
- Applying the correct remediation for each failure shape rather than one generic "fix it" action.
- Retesting with both a normal and a privileged user before declaring an incident resolved.
- Writing an incident report that explains root cause, impact, and prevention — the shape an on-call handoff or postmortem expects.
