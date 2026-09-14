# Lab 02 — Joiner / Mover / Leaver Identity Lifecycle

## Scenario
HR submits three tickets on the same morning: Alex Morgan is starting in Finance, Jane Doe is transferring from Finance to Engineering, and Bob Sato's last day was yesterday. Each ticket type carries its own failure mode — over-provisioning a joiner, leaving stale access on a mover, or leaving a live session under a leaver — and this lab is built to make the learner prove each one didn't happen, not just perform the action.

## Objectives
1. Onboard Alex Morgan with least-privilege access (Finance payroll group only).
2. Transfer Jane Doe: add Engineering access, remove both Finance groups.
3. Verify Jane's old Finance access is actually gone — not just assume the move worked.
4. Disable Bob Sato's account on termination.
5. Revoke Bob's active sessions and capture the audit trail as proof.
6. Write a change-log note that names the requester, action, and date for all three tickets.

## 3D environment
- **Briefing area** (lobby). Slide: "Three tickets, three failure modes — over-provisioning, stale access, live session." A ticket-queue counter shows all three open.
- **Help Desk** (`help-desk`). The Ticket Console holds the three HR tickets (onboarding, transfer, termination), each with requester, priority, and payload.
- **HR zone** (`hr`). Where the requesters (Cara, Ivy) sit — flavor context for who is asking and why.
- **IAM Console** (`iam-ops`). User creation, group membership, account disable, and Active Sessions all live here. The learner does the actual identity work in this room.

## Workflow

> Each numbered step maps 1:1 to a validation checkpoint in the conductor. Evidence bullets and tutor prompts are emitted at the same step.

1. **Resolve the onboarding ticket.** Open "Onboard Alex Morgan" in the Help Desk console. Create the account, add it to `grp-finance-payroll` only, and verify sign-in to the Finance Portal. **Evidence:** ticket snapshot + 5 audit events. **Tutor:** "What is the smallest set of permissions Alex needs to do their job? How do you verify a new user was actually provisioned correctly, not just created?"
2. **Transfer Jane Doe.** Open the transfer ticket. Remove Jane from `grp-finance-payroll` and `grp-finance-analysts`. Add her to `grp-engineering-dev`. **Evidence:** 5 audit events. **Tutor:** "A transfer is two operations, not one — which comes first, add or remove, and does the order matter?"
3. **Verify Jane's old access is gone.** Performing the move and proving the move happened are two different things. Confirm Jane holds zero Finance groups and can no longer reach the Finance Portal. Capture the check as evidence. **Evidence:** IAM Console snapshot. **Tutor:** "What is the smallest set of actions that would have left Jane with stale Finance access? If you only checked her group list, what could you still be missing?"
4. **Terminate Bob Sato — disable the account.** Open the termination ticket. Disable `bob.sato`. Verify sign-in fails. **Evidence:** IAM Console snapshot. **Tutor:** "Is disabling the account sufficient on its own, or is a session still live underneath it?"
5. **Revoke Bob's active sessions.** Disabling blocks new sign-ins; it does not kill a session Bob already holds. Revoke every active session for `bob.sato`. **Evidence:** 5 audit events. **Tutor:** "What audit evidence proves Bob can no longer act, not just no longer log in fresh? What is the blast radius of skipping this step?"
6. **Write the change-log note.** One note (or three) covering all three tickets: requester, action taken, date. This is the record an auditor pulls six months from now. **Evidence:** ticket-console snapshot. **Tutor:** "If an auditor asked 'who authorized Jane's transfer' six months from now, would your note answer it?"

## Evidence
- Onboarding ticket resolution + sign-in proof (step 1).
- Transfer audit trail (step 2) and post-transfer access snapshot (step 3).
- Termination disable snapshot (step 4) and session-revocation audit trail (step 5).
- Change-log note covering all three tickets (step 6).

## Interview skills demonstrated
- Provisioning a joiner with least privilege from day one, not "add and trim later."
- Treating a transfer as two operations (grant + revoke) and verifying the revoke side, not just the grant.
- Knowing that account-disable and session-revocation are separate controls with separate blast radii.
- Producing an audit-ready change-log note that answers "who asked for this, and when" without re-deriving it from raw logs.
- Handling three concurrent HR tickets without cross-contaminating one user's access with another's.
