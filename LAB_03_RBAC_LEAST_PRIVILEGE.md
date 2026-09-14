# Lab 03 — RBAC & Least Privilege

## Scenario
Finance requests payroll access for Jane Doe. The request has to be filled without direct user permissions — role through group, not role-to-person. In the background, Bob Sato has held standing domain-admin rights since before anyone in the current team started. Both threads converge on the same lesson: authorization should be provable, not assumed — for the access that was granted correctly, and for the access that should never have existed.

## Objectives
1. Create `role-finance-payroll-writer` with `payroll:read`/`payroll:write`.
2. Grant Jane the role via `grp-finance-payroll` membership, not a direct assignment.
3. Prove Jane can actually perform the allowed action — not just sign in.
4. Discover and revoke Bob's standing `role-domain-admin`.
5. Prove the denial path works: a read-only user attempting a write is blocked.
6. Document the authorization model end to end.

## 3D environment
- **Finance zone** (`finance`). Starting zone. The Finance Portal terminal is where Jane's write and Alex's denied write both get attempted.
- **IAM Console** (`iam-ops`). Role creation, group membership, and role-revoke live here.
- **SecOps Dashboard** (`sec-ops`, referenced from IAM Console). Effective-role lookup and the audit log that proves both the grant and the denial.

## Workflow

> Each numbered step maps 1:1 to a validation checkpoint in the conductor. Evidence bullets and tutor prompts are emitted at the same step.

1. **Create the role.** Create `role-finance-payroll-writer` with `payroll:read` and `payroll:write`. Do not assign it directly to a user. **Evidence:** IAM Console snapshot. **Tutor:** "Why should roles be granted via group membership, not directly to users?"
2. **Grant Jane the role via group membership.** Add Jane to `grp-finance-payroll`. Verify her effective roles include the new role, and that she can sign in to the Finance Portal. **Evidence:** 3 audit events. **Tutor:** "If a group membership can grant a role, where does authorization actually happen?"
3. **Prove the allowed action works.** A sign-in proves authentication, not authorization. As Jane, perform a payroll write in the Finance Portal and confirm it succeeds. **Evidence:** IAM Console snapshot. **Tutor:** "What is the difference between 'Jane can sign in' and 'Jane is authorized to write payroll'? If the role wiring were subtly wrong, would the sign-in check alone have caught it?"
4. **Discover and remove Bob's standing admin.** Bob holds `role-domain-admin` with no expiry, granted directly rather than through a group. Find it, revoke it, document the removal. **Evidence:** 3 audit events + IAM Console snapshot. **Tutor:** "What is the risk of a standing privileged account? How would an attacker use it?"
5. **Prove the denial path works.** Attempt a payroll write as Alex Morgan, who holds read-only access. Confirm it is denied and capture the audit trail. **Evidence:** 5 audit events. **Tutor:** "Jane's write succeeded and Alex's was denied on the same portal, same action. What single difference explains both outcomes?"
6. **Document the authorization model.** Write up the role → group → user chain, why Bob's direct grant was a risk, and how the allow/deny test in steps 3 and 5 proves the model is enforced, not just configured. **Evidence:** IAM Console snapshot. **Tutor:** "If a new hire had to learn this system from your document instead of asking you, would it be enough?"

## Evidence
- Role creation and group-grant snapshot (steps 1–2).
- Jane's successful payroll-write proof (step 3).
- Bob's role-revocation audit trail and snapshot (step 4).
- Alex's denied-write audit trail (step 5).
- Authorization-model write-up (step 6).

## Interview skills demonstrated
- Wiring RBAC through groups instead of direct-to-user grants, and explaining why that matters for audit and offboarding.
- Distinguishing authentication (can sign in) from authorization (can perform the specific action) as two separate checks with two separate proofs.
- Finding and removing standing privileged access that predates the current review cycle.
- Producing both a positive and a negative access-control proof for the same control, not just one.
- Writing an authorization-model document a new hire could learn the system from.
