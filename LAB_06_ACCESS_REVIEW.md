# Lab 06 — Access Reviews & Governance

## Scenario
The Q3-2026 quarterly access review is open: 8 pending items across 5 users, due to Ivy Park as the reviewing manager. Two of the items are legitimate flags — a dormant account and a stale group membership, both Bob Sato's — and the review tool only lets the manager approve or revoke one row at a time, on purpose: a manager who wants to approve everything in one click, or revoke everything in one click, has to actually choose to do that, not fall into it as the only option.

## Objectives
1. Identify dormant accounts (Bob Sato, 200 days since last sign-in).
2. Identify excessive group memberships (Bob's stale Engineering access).
3. Identify which of the 8 pending items touch privileged access.
4. Record all 8 review decisions correctly — 6 approve, 2 revoke.
5. Close the campaign and produce the summary.

## 3D environment
- **SecOps Dashboard** (`sec-ops`). Starting zone. The Access Reviews tab lists the open campaign, all 8 pending items with their flagged recommendation, and per-row Approve/Revoke controls plus a "close campaign" action.
- **IAM Console** (`iam-ops`). Where the learner cross-checks Bob's last-sign-in date and full group list before marking anything.

## Workflow

> Each numbered step maps 1:1 to a validation checkpoint in the conductor. Evidence bullets and tutor prompts are emitted at the same step.

1. **Identify dormant accounts.** Bob Sato hasn't signed in for 200 days. Confirm it in the IAM Console. **Evidence:** IAM Console snapshot. **Tutor:** "What signals make an account 'dormant'? Is dormancy alone enough to revoke access?"
2. **Identify excessive memberships.** Bob also holds `grp-engineering-dev` despite being in Finance. **Evidence:** IAM Console snapshot. **Tutor:** "What signals would tell you a review campaign is being rubber-stamped?"
3. **Identify privileged accounts in scope.** Two of the 8 items grant `grp-iam-admins` or `grp-helpdesk-tier1` to Ivy Park — flag them as deserving closer scrutiny than a routine department group. **Evidence:** SecOps Dashboard snapshot. **Tutor:** "If you only had time to carefully review 2 of the 8 items, which 2 would you pick and why?"
4. **Record all 8 decisions.** As Ivy Park, use the per-row Approve/Revoke controls: 6 approve, 2 revoke (Bob's two flagged items). **Evidence:** 8 audit events. **Tutor:** "What would you do if a manager approved every item without reading it?"
5. **Close the campaign and produce the summary.** Close Q3-2026 and export the summary. **Evidence:** SecOps Dashboard snapshot. **Tutor:** "What should an access review summary contain for a compliance auditor?"

## Evidence
- Dormant-account and excessive-membership findings (steps 1–2).
- Privileged-access flag on the in-scope items (step 3).
- 8 recorded decisions with reviewer identity and timestamp (step 4).
- Closed-campaign summary (step 5).

## Interview skills demonstrated
- Distinguishing a dormant account from a merely-quiet one, and excessive access from role-appropriate access.
- Triaging a review queue by risk (privileged access first) instead of working top-to-bottom.
- Making per-item governance decisions instead of batch-approving or batch-denying a mixed queue.
- Producing a review summary an auditor can act on without re-deriving the campaign from raw logs.
