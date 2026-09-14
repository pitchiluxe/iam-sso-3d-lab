# Lab 17 — Cloud IAM: Cross-Account Role & Least Privilege

## Scenario
A cross-account cloud IAM role, `prod-data-readonly`, was set up months ago for the two-person data team and never revisited. Its permissions grant `s3:*`, `ec2:*`, and `iam:PassRole` — far more than "read-only" implies — and its trust policy names nearly every employee in the company, not just the two people it was meant for. A cloud IAM role has two independently-misconfigurable settings — what it can do, and who can become it — and this lab treats them as two separate defects requiring two separate fixes and two separate proofs.

## Objectives
1. Review the role and identify both defects: permissions and trust.
2. Scope the role's permissions to remove wildcard access.
3. Scope the trust policy to the intended data team.
4. Prove the trusted user can still assume the role.
5. Prove a previously-trusted, now-excluded user is denied.
6. Document the least-privilege cloud IAM policy.

## 3D environment
- **IAM Console** (`iam-ops`). Starting zone. "Cloud IAM Roles" (a new console section) lists roles with their permissions and trust policy; "Scope Role Permissions," "Scope Role Trust Policy," and "Assume Cloud Role" are the three operator actions.
- **SecOps Dashboard** (`sec-ops`, referenced from IAM Console). Where the allow/deny audit trail from steps 4 and 5 shows up.

## Workflow

> Each numbered step maps 1:1 to a validation checkpoint in the conductor. Evidence bullets and tutor prompts are emitted at the same step.

1. **Review the role.** `prod-data-readonly` grants `s3:*`, `ec2:*`, `iam:PassRole`, and trusts nearly every employee. Identify both problems. **Evidence:** IAM Console snapshot. **Tutor:** "The role is named 'readonly' — does its permission list actually match that name? Fixing the permissions and fixing the trust policy are two different changes — why can't one fix cover both?"
2. **Scope the permissions.** Replace the wildcard grants with `s3:GetObject` and `s3:ListBucket` — drop `ec2:*` and `iam:PassRole` entirely. **Evidence:** 3 audit events. **Tutor:** "What would `iam:PassRole` on a 'read-only' role let someone do that has nothing to do with reading data?"
3. **Scope the trust policy.** Replace it with just Ivy Park and Dan Rivera — the actual data team. **Evidence:** 3 audit events. **Tutor:** "If nine people were trusted and the role touches production data, what is the realistic blast radius of one compromised laptop?"
4. **Prove the trusted user still works.** Assume the role as Ivy Park — must succeed. **Evidence:** 3 audit events. **Tutor:** "Why test the allow case at all, if you already know Ivy is on the trust list you just wrote?"
5. **Prove the excluded user is denied.** Attempt the same as Bob Sato, who was trusted under the old policy — must be denied. **Evidence:** 3 audit events. **Tutor:** "If you only tested the allow case, would you actually know the trust policy was scoped correctly?"
6. **Document the policy.** The original overprivilege, what it was scoped down to, and the allow/deny proof. **Evidence:** IAM Console snapshot. **Tutor:** "If a new hire joined the data team next month, what would this document need to tell them?"

## Evidence
- Role review identifying both defects (step 1).
- Permissions-scoping audit trail (step 2).
- Trust-policy-scoping audit trail (step 3).
- Successful assume-role proof for the trusted user (step 4).
- Denied assume-role proof for the excluded user (step 5).
- Least-privilege cloud IAM policy write-up (step 6).

## Interview skills demonstrated
- Recognizing that a cloud IAM role's permissions and trust policy are separate attack surfaces requiring separate remediation.
- Replacing wildcard permissions with the specific actions a workload actually needs.
- Scoping a trust policy to named principals instead of leaving it broad "to be safe."
- Producing both a positive and a negative access-control proof for the same control — the same allow/deny discipline as on-prem RBAC, applied to cloud IAM.
- Writing a cloud IAM policy document a new team member could onboard from.
