# Lab 12 — Hybrid Identity (Cloud Sync)

## Scenario
Northwind Holdings has finished its cloud migration assessment and is moving from a fully on-prem Active Directory to a hybrid identity model. The chosen design is **Microsoft Entra Cloud Sync with Password Hash Sync (PHS)** — the lightest-weight hybrid model, with no AD FS and no pass-through auth agent.

The first wave moves Finance, HR, and Engineering (about 600 users) to a hybrid sync. After the initial sync, three deltas must flow on the same day: a joiner (new intern), a mover (Jane Doe transfers from Finance to Engineering), and a leaver (Bob Sato's contract ends). One soft-match conflict must be resolved before the leaver flow can complete.

## Objectives
1. Confirm the on-prem AD has the seed user set and add one new test user.
2. Install the cloud sync agent on the on-prem connector and confirm it registers healthy.
3. Enable Password Hash Sync (PHS) and document the security model.
4. Run the initial sync and verify all 6 users (5 seeded + 1 new) appear in the cloud directory.
5. Process a joiner / mover / leaver delta and verify each appears in the cloud within the SLA.
6. Diagnose and resolve a soft-match conflict without deleting the cloud object.
7. Document the sync topology, alert thresholds, and the disaster-recovery runbook.

## 3D environment
- **Briefing area** (lobby). Whiteboard shows the on-prem AD, the connector, and the cloud directory as three boxes with arrows.
- **IAM Console** (`iam-ops`). The Cloud Sync panel shows connector status, sync health, and the sync error queue. The **Engineer Workstation** terminal in this room opens directly into the Cloud Sync page.
- **Help Desk** (`help-desk`). The Help Desk console shows the on-prem user list and the JML tickets for the day. Used to process the joiner / mover / leaver tickets.
- **SecOps Dashboard** (`sec-ops`). Console shows the sign-in and sync audit log. Used to verify the deltas propagated.

## Workflow

> Each numbered step maps 1:1 to a validation checkpoint in the conductor. Evidence bullets and tutor prompts are emitted at the same step.

1. **Provision on-prem AD users.** In the Help Desk, confirm the seeded users (`alex.morgan`, `jane.doe`, `bob.sato`, `erin.cho`, `hank.oneill`) exist. Add `mel.tan` as a new on-prem user to test sync. **Evidence:** directory snapshot. **Tutor:** "What attribute in on-prem AD is the source of truth for UPN? Why does the UPN suffix matter for cloud sign-in?"
2. **Install the cloud sync agent.** In the IAM Console Cloud Sync page, install the agent on the staged connector. Use the staged service account. Verify the agent shows as healthy. **Evidence:** connector status snapshot. **Tutor:** "What ports must be open from the on-prem connector to the cloud? What happens if the service account password expires?"
3. **Enable PHS.** Configure sync to include Password Hash Sync. The on-prem AD remains the source of truth. **Evidence:** sync config snapshot. **Tutor:** "What does PHS transmit — the cleartext password, the hash, or a derived value? How does the cloud validate the PHS value at sign-in? What is the risk of an attacker stealing the PHS blob, and how do you mitigate it?"
4. **Run the initial sync.** Trigger initial sync. Wait for completion. Verify all 6 users appear in the cloud directory with the correct UPN and group membership. **Evidence:** 10 audit events. **Tutor:** "How long does initial sync typically take for 1,000 / 10,000 / 100,000 users? What is a delta sync, and how often does it run by default?"
5. **Process the JML deltas.** In the on-prem AD: add `nina.patel` (Engineering Intern), move `jane.doe` (Finance → Engineering), disable `bob.sato`. Trigger a delta. Verify each change appears in the cloud. Sign in as `nina.patel` to confirm. **Evidence:** 8 audit events. **Tutor:** "How long does a delta sync take to propagate to the cloud? If a leaver is disabled in on-prem, how long until the cloud refuses sign-in?"
6. **Resolve a soft-match conflict.** A new on-prem "Alex Morgan" has been provisioned with a different UPN than the existing cloud account. The sync engine reports a soft-match conflict. Resolve it by joining the two accounts (NOT by deleting one) and write a one-line justification. **Evidence:** resolution snapshot. **Tutor:** "What is the difference between a soft match and a hard match? What is the most important attribute for hard-matching? If you accidentally delete the cloud object during conflict resolution, what is the blast radius?"
7. **Document the sync topology and DR plan.** One-page document covering: source of truth, sync direction, schedule, alert thresholds, fallback (how would you sign in if the connector is down?), and the runbook for the conflict you just resolved. **Evidence:** doc snapshot. **Tutor:** "If the cloud sync agent fails for 24 hours, what compensating control keeps you safe? What KPI would you track to know sync is healthy?"

## Evidence
- On-prem user list before and after sync (steps 1 and 4).
- Cloud sync agent health snapshot (step 2).
- PHS configuration (step 3).
- Sign-in confirmation for `nina.patel` (step 5).
- Soft-match conflict resolution (step 6).
- Sync topology and DR document (step 7).

## Interview skills demonstrated
- Choosing between Azure AD Connect and Cloud Sync based on scale and operational complexity.
- Explaining the security model of PHS and the attack surface it introduces.
- Operating the JML delta cycle end to end (joiner, mover, leaver).
- Diagnosing and resolving soft-match conflicts without data loss.
- Writing a sync topology and DR document an on-call engineer can execute at 2 a.m.
- Knowing the alert thresholds that mean sync is healthy versus degraded.
