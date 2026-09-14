/**
 * tutor/hintLadder.ts — progressive hint ladder.
 * Each step has 3 hints, ordered from gentle to specific. The conductor
 * is told to never give the final answer; the tutor reveals progressively
 * stronger hints only when the learner is stuck.
 */

export type HintLevel = 0 | 1 | 2 | 3;

export interface HintLadder {
  /** A nudge toward the right direction. Does not name the action. */
  nudge: string;
  /** A diagnostic question that steers the learner's reasoning. */
  question: string;
  /** A near-solution: names the action and where to look, but not the values. */
  approach: string;
  /** Reserved for explanation mode only. The actual answer. */
  solution: string;
}

const LADDERS: Record<string, Record<string, HintLadder>> = {
  lab01: {
    s1: {
      nudge:
        'Identities are how the directory knows who a person is. What three things does a directory need to know about every person?',
      question:
        'If you had to introduce a new employee to the system, what fields would you fill in?',
      approach:
        'Use the IAM Console "Provision User" form. Username, display name, and email are the minimum.',
      solution:
        'Open the IAM Console, fill in username/display/email/dept/title, click "Create User".',
    },
    s2: {
      nudge: 'Groups are how the directory organizes people. What attributes do they have?',
      question: 'Why might a directory use groups rather than just listing permissions per user?',
      approach: 'Use the IAM Console "Create Group" form. Give it a name and description.',
      solution:
        'Type a name like "grp-finance-payroll" in the Create Group form and click the button.',
    },
    s3: {
      nudge:
        'Once you have a user and a group, they are not yet related. Where would you connect them?',
      question: 'If a user is in the Finance department, which group should they belong to?',
      approach:
        'Use the "Group Membership" form in the IAM Console. Select a user, select a group, click "Add to group".',
      solution:
        'In the form below the Groups list, pick a user and a group, then click "Add to group".',
    },
    s4: {
      nudge:
        'A policy is a rule the IdP applies before issuing a session. What rule would you want for sensitive accounts?',
      question: 'Should every user be required to use MFA, or only certain roles? Why?',
      approach: 'In the IAM Console "MFA Policy" section, click "Enable MFA enforcement".',
      solution: 'Click the "Enable MFA enforcement" button in the MFA Policy section.',
    },
    s5: {
      nudge: 'How do you know a user can actually sign in?',
      question: 'If you created a user but never signed them in, what would you not know?',
      approach:
        'Use the "Verify Authentication" form at the bottom of the IAM Console. Pick a user and click "Sign in (verify)".',
      solution:
        'Pick a user from the "Verify Authentication" dropdown and click the Sign in button.',
    },
  },
  lab02: {
    s1: {
      nudge: 'The HR system has asked for a new employee. Where would the ticket be waiting?',
      question: 'Who is the requester on the onboarding ticket, and what access do they need?',
      approach:
        'Open the Ticket Console. Resolve the "Onboard Alex Morgan" ticket, then create the user in the IAM Console.',
      solution:
        'Ticket Console → resolve the onboarding ticket → IAM Console → create user "alex.morgan" → add to grp-finance-payroll → verify sign-in.',
    },
    s2: {
      nudge: 'A move is two things: add new access, remove old access.',
      question: 'If you only added Jane to Engineering, what would still be wrong?',
      approach:
        'Open the IAM Console, use Group Membership: remove Jane from grp-finance-payroll, add her to grp-engineering-dev.',
      solution:
        'Remove Jane from grp-finance-payroll (and grp-finance-analysts), add her to grp-engineering-dev.',
    },
    s3: {
      nudge: 'Performing the move and proving the move happened are two different things.',
      question:
        'Doing the transfer emits its own audit events. What would you check that is not already covered by those events?',
      approach:
        "Check Jane's group list in the IAM Console (no finance groups left) and capture that as the evidence for this step.",
      solution:
        'Open the IAM Console, confirm jane.doe has zero finance groups and holds grp-engineering-dev, then capture a snapshot tagged to this step.',
    },
    s4: {
      nudge: 'Termination starts with the account itself. What state should it be in?',
      question: 'What does "disabled" actually block, and what does it not block?',
      approach: 'IAM Console → disable bob.sato, then verify sign-in fails for him.',
      solution: 'Disable bob.sato in the IAM Console. The validator fires on user.disabled.',
    },
    s5: {
      nudge: 'A disabled account can still hold a session it opened before it was disabled.',
      question:
        'If Bob was signed in five minutes before termination, what is still valid right now?',
      approach: 'IAM Console → Active Sessions → revoke every session for bob.sato.',
      solution:
        'Use Revoke-UserSession (or the Active Sessions form) against bob.sato. The validator fires on session.revoked.',
    },
    s6: {
      nudge: 'Three tickets got worked. Nothing yet says who asked for what, or when.',
      question:
        'Six months from now, what would an auditor need to see to trust this was done correctly?',
      approach:
        'Write one note per ticket (or one combined note) naming the requester, the action taken, and the date, then capture it as evidence.',
      solution:
        "Write a change-log note covering Alex's onboarding, Jane's transfer, and Bob's termination — requester, action, date — then capture a snapshot tagged to this step.",
    },
  },
  lab03: {
    s1: {
      nudge:
        'A role names a set of permissions a job needs. Where would you put "payroll write" so it can be granted together?',
      question:
        'If a role is assigned directly to a user instead of a group, what happens to the audit trail when that person changes teams?',
      approach:
        'Open the IAM Console → Roles section → Create Role. Name it role-finance-payroll-writer, add permissions payroll:read and payroll:write.',
      solution:
        'Create role-finance-payroll-writer with permissions [payroll:read, payroll:write]. Do not assign to users — assign via group membership.',
    },
    s2: {
      nudge:
        'Effective roles are what a user can do right now, not what groups they are in. Where would you confirm what Jane can actually do?',
      question:
        'If Jane is in the Finance group, does that alone mean she can write to payroll? What else has to be true?',
      approach:
        'SecOps Dashboard → Roles tab → search for Jane. Her effective role list should include role-finance-payroll-writer through group membership.',
      solution:
        'Open SecOps Dashboard → Roles → search "jane.doe" → confirm role-finance-payroll-writer is listed in her effective roles.',
    },
    s3: {
      nudge:
        'A sign-in proves identity, not permission. What would prove Jane can actually do the job she was granted access for?',
      question:
        'If the role-to-group wiring were subtly wrong, would the sign-in check from the last step have caught it?',
      approach:
        'As Jane, use the Finance Portal to perform a payroll write. Capture the successful result as evidence for this step.',
      solution:
        'Perform a payroll write as jane.doe, confirm it succeeds, then capture a snapshot tagged to this step.',
    },
    s4: {
      nudge:
        'Standing privilege means a permission with no end date. Where would you look to see who has permanent access to dangerous actions?',
      question:
        'If Bob has role-domain-admin forever, what happens the day his laptop gets stolen?',
      approach:
        'SecOps Dashboard → Roles → filter for role-domain-admin → revoke it for Bob. Document the removal in the audit log.',
      solution:
        'SecOps → Roles → find role-domain-admin assigned to Bob → Revoke. Confirm via audit log that role.revoke was recorded.',
    },
    s5: {
      nudge:
        'A denied action is the proof that least privilege is working. Where would you see it recorded?',
      question:
        'If Alex tries to write payroll and is denied, what does that tell you about the access model?',
      approach:
        'Have Alex attempt a payroll write action via the Finance Portal. Then read the audit log for the denied event.',
      solution:
        'Open Finance Portal as Alex, attempt a payroll write, then read the SecOps Dashboard audit log for the denied entry.',
    },
    s6: {
      nudge:
        'Three things happened: a role was wired through a group, a good write succeeded, a bad write was denied. Nothing yet says why in one place.',
      question:
        'If a new hire had to learn this system from a document instead of asking you, what would that document need to cover?',
      approach:
        "Write up the role → group → user chain, why Bob's standing admin was a risk, and what the allow/deny test proved.",
      solution:
        "Write a short authorization-model note: role-finance-payroll-writer flows through grp-finance-payroll to any member; direct role grants (like Bob's) bypass that and are the risk; the Jane/Alex test proves enforcement, not just configuration. Capture it as evidence for this step.",
    },
  },
  lab04: {
    s1: {
      nudge:
        'A SAML client trusts the IdP to assert who a user is. What two things does the SAML config need to exchange first?',
      question:
        'The app started unconfigured, not missing — what does that tell you about where to look?',
      approach:
        'IAM Console → Application Configuration → Update App Configuration. App: app-finance, Field: entityId, then Field: redirectUri. Use the values from the brief.',
      solution:
        'Run Update App Configuration twice against app-finance: Field=entityId Value=urn:finance.northwind.example, then Field=redirectUri Value=https://finance.northwind.example/callback.',
    },
    s2: {
      nudge:
        'OIDC and SAML both end up as fields on the same app record here. Which two does the Help Desk Portal still need?',
      question:
        'If the OIDC issuer is wrong, does the login fail at the app, the IdP, or somewhere in between?',
      approach:
        'IAM Console → Application Configuration → Update App Configuration. App: app-helpdesk-portal, Field: redirectUri, then Field: issuer.',
      solution:
        'Run Update App Configuration twice against app-helpdesk-portal: Field=redirectUri Value=https://helpdesk.northwind.example/callback, then Field=issuer Value=https://idp.northwind.example/realms/northwind.',
    },
    s3: {
      nudge:
        'A claim is what the IdP tells the SP about the user. Where do you decide what gets sent?',
      question:
        'If role is sent as a free-text string, can the SP trust it without a mapping document?',
      approach:
        "IAM Console → Applications → Finance Portal → Claims → map the role claim to the user's effective roles array. Save and publish.",
      solution:
        'Open Finance Portal config → Claims → set role claim to user.effectiveRoles. Save. Repeat for Help Desk Portal.',
    },
    s4: {
      nudge: 'SSO works end-to-end or it does not. Where is the proof of working SSO?',
      question:
        'If the SAML assertion is valid but the role claim is empty, what does the user see?',
      approach:
        'Sign in to both Finance Portal and Help Desk Portal. Confirm role claims are present in the sessions. Capture audit logs.',
      solution:
        'Use Verify Sign-in for both portals. Confirm the audit log shows signin.succeeded with the right portal ID and role claim.',
    },
    s5: {
      nudge:
        'A failed sign-in page is not a dead end — it names the exact field that no longer matches.',
      question:
        'Erin could sign in one step ago and cannot now. What changed on the app, not on Erin?',
      approach:
        'Attempt sign-in on Finance Portal, read the "Configuration mismatch" panel, then Update App Configuration with the Field and Value it names.',
      solution:
        'The mismatch panel names Field=redirectUri and the expected value. Run Update App Configuration: App=app-finance, Field=redirectUri, Value=https://finance.northwind.example/callback.',
    },
    s6: {
      nudge:
        'Two configs and one incident happened. Nothing yet ties the incident back to a cause a future on-call could search for.',
      question:
        'If this exact redirect-URI fault recurred at 2 AM, what would your document need to say for someone else to fix it in five minutes?',
      approach:
        'Write up both app configs (protocol, entity ID/issuer, redirect URI, claim mapping) plus the fault: what broke, how you found it, how you fixed it.',
      solution:
        'Document: Finance Portal (SAML, entityId, redirectUri), Help Desk (OIDC, issuer, redirectUri), role-claim mapping, and the redirect-URI incident (symptom → mismatch panel → fixed field). Capture it as evidence for this step.',
    },
  },
  lab05: {
    s1: {
      nudge:
        'MFA for privileged roles means anyone in those roles must use a second factor. Where do you enforce that?',
      question:
        'If you enable MFA for everyone at once, what happens to your help desk ticket queue?',
      approach:
        'IAM Console → MFA Policy → set requireMfa = true. Start with a group-based rollout: enable for the iam-admins group first.',
      solution:
        'IAM Console → MFA Policy → Enable MFA enforcement → apply only to grp-iam-admins for now (phased rollout).',
    },
    s2: {
      nudge: 'TOTP is a 6-digit code that changes every 30 seconds. How does the user enroll?',
      question: 'If the user loses their phone, what is the recovery path?',
      approach:
        'IAM Console → Users → Erin Cho → MFA → enroll TOTP. Erin scans the QR code with her authenticator app and confirms with a 6-digit code.',
      solution:
        "Open Erin's user record → Enroll TOTP → scan QR → enter 6-digit code → confirm. Test by signing in as Erin.",
    },
    s3: {
      nudge:
        'A prompt loop means the system keeps asking for a factor it cannot verify. Where do you look?',
      question:
        'If the user enters the right code but the system rejects it, what is mismatched — the secret, the clock, or the algorithm?',
      approach:
        'SecOps Dashboard → Audit Log → filter for Erin → look for repeated mfa.challenge.completed with failure. Check the time sync on the IdP.',
      solution:
        "Open audit log for Erin → find the repeating MFA challenge failures → re-sync the IdP clock → re-enroll Erin's TOTP secret.",
    },
    s4: {
      nudge:
        'A conditional access policy adds rules on top of authentication. What condition and what effect does a foreign-ASN block need?',
      question: 'What signal would actually tell you a sign-in came from a foreign ASN?',
      approach:
        'Access & Sessions → Set Conditional Access Policy. Leave Role blank, Block ASN = AS-99999. Then Verify Authentication with ASN set to AS-99999 and confirm it is actually denied.',
      solution:
        'Run Set Conditional Access Policy with BlockForeignAsn=AS-99999 and Role blank. Verify Authentication for any user with ASN=AS-99999 — the sign-in is blocked and logged as signin.failure with a conditional-block reason. Capture a snapshot tagged to this step.',
    },
    s5: {
      nudge:
        'The block from the last step is correct in general and wrong for one specific, known, upcoming case.',
      question:
        'If the exception is "allow this ASN" instead of "allow this user, from this ASN, until this date", who else benefits from it?',
      approach:
        'Add a named-user, time-boxed exception to CA-001 for the traveling executive. Confirm the block still holds for everyone else from that ASN.',
      solution:
        "Add an exception scoped to the executive's user ID and an expiry date, not the ASN itself. Verify a different user from the same ASN is still blocked. Capture it as evidence for this step.",
    },
    s6: {
      nudge:
        'MFA rollout, a fixed prompt loop, a CA block, and an exception all happened. Nothing yet explains the exception to someone who did not watch you add it.',
      question:
        'If the exception outlived its expiry and nobody remembered why it existed, what would your document need to have said?',
      approach:
        'Write up: which roles require MFA, the prompt-loop root cause and fix, the CA block policy, and the exception with its expiry and justification.',
      solution:
        "Document all four pieces: MFA-required roles, the prompt-loop cause (clock/secret mismatch) and fix, CA-001's condition and effect, and the executive exception's scope and expiry. Capture it as evidence for this step.",
    },
  },
  lab06: {
    s1: {
      nudge: 'A dormant account has not signed in for a long time. How do you find them?',
      question: 'If a user has not signed in for 90 days, should they still be active?',
      approach:
        'SecOps Dashboard → Access Reviews → Run dormant-account query (lastSignInAt > 90 days ago). Export the list.',
      solution:
        'SecOps → Access Reviews → Query: lastSignInAt < now-90d → Export. Review each row manually.',
    },
    s2: {
      nudge:
        'Excessive memberships mean a user has more groups than their role needs. How do you find them?',
      question: 'If an engineer is in 12 groups but only needs 3, where did the other 9 come from?',
      approach:
        'SecOps → Users → filter groupCount > 5. Open each user, review their groups, and mark the unnecessary ones for removal.',
      solution:
        'SecOps → Users → sort by group count → for each user over 5 groups, identify which groups do not match their department/title.',
    },
    s3: {
      nudge:
        'Not every group is equal risk. Which of the 8 pending items grant something an attacker would want first?',
      question:
        'If you only had time to carefully review 2 of the 8 items, which 2 would you pick and why?',
      approach:
        'Look through the 8 pending decisions in SecOps Dashboard → Access Reviews. Flag the ones granting grp-iam-admins or grp-helpdesk-tier1 as privileged.',
      solution:
        "Identify Ivy Park's grp-iam-admins and grp-helpdesk-tier1 items as the privileged-access items in this campaign. Capture that as evidence for this step.",
    },
    s4: {
      nudge:
        'A review decision is approve or revoke, one row at a time — not one button for the whole batch.',
      question: "If you click 'approve everything', what happens to Bob's two flagged items?",
      approach:
        'For each of the 8 rows, use its Approve or Revoke button — 6 approve, 2 revoke (Bob\'s dormant and excessive memberships). "Accept all remaining recommendations" only helps once you have actually looked at what each row recommends.',
      solution:
        "Approve the 6 legitimate items (Alex, Cara, Jane, Ivy×3) and Revoke Bob's two (grp-engineering-dev, grp-finance-analysts) using the per-row buttons.",
    },
    s5: {
      nudge: 'A campaign summary is what auditors read. What three things must it contain?',
      question: 'If an auditor asks "who approved this access", where is the answer?',
      approach:
        'Access Reviews → Campaign → Close. Generate summary: total decisions, removals executed, exceptions retained with justifications.',
      solution:
        'Close the campaign → export summary (PDF/JSON). Verify it shows reviewer name, decision count, and removal audit IDs.',
    },
  },
  lab07: {
    s1: {
      nudge: 'An incident is an unplanned disruption. Where do you record the symptoms first?',
      question:
        'If you skip the incident record and go straight to fixing, what can you not reconstruct later?',
      approach:
        'Ticket Console → open new incident → record: time, user impact, error message, scope. Mark severity.',
      solution:
        'Ticket Console → New Incident → "SSO outage: Finance Portal returns 500 on /saml/acs" → severity=high → save.',
    },
    s2: {
      nudge: 'Triage means ruling out the cheap causes first. What is the cheapest?',
      question:
        'If you skip DNS and go straight to certificate rotation, what could you have missed in 30 seconds?',
      approach:
        'SecOps Dashboard → IdP health → DNS lookup → certificate expiry → clock skew. Document each finding in the incident record.',
      solution:
        'Triage order: DNS (dig +short), certificate expiry (openssl s_client), IdP time skew (date vs NTP), recent config diffs.',
    },
    s3: {
      nudge:
        'The fix has to match the root cause, not the symptom. Three tools exist: fix a field, restart a stuck service, or sync a clock — which one this run needs depends on what you saw in triage.',
      question:
        'If the failed sign-in showed a "Configuration mismatch" panel, is this a config problem or a connectivity problem? What if no panel appeared at all?',
      approach:
        'If a mismatch panel named a field (redirectUri, cert.validUntil, clientSecret.match, claim.role, issuer): use Update App Configuration with that exact field. If the app shows offline with no field named: use Restart App Service. If nothing on the app looks wrong but sign-ins fail on timing/assertion validity: use Sync IdP Clock.',
      solution:
        'Match the tool to the symptom: Update App Configuration (field-level SAML/OIDC mismatches), Restart App Service (status: offline, no config diff), Sync IdP Clock (clock skew, no app-side symptom at all). Only one of the three will actually be the fault this run.',
    },
    s4: {
      nudge: 'A retest proves the fix worked. What log entries confirm that?',
      question:
        'If the app returns 200, but the audit log shows no signin.succeeded, what is still wrong?',
      approach:
        'Sign in via the broken portal as a test user. Confirm audit log shows signin.succeeded and the assertion was valid.',
      solution:
        'Re-run Verify Authentication for the test user. Capture the audit log line and attach to the incident as evidence.',
    },
  },
  lab08: {
    s1: {
      nudge:
        'A suspicious sign-in is an alert you cannot ignore. What is the first thing you record?',
      question:
        'If you skip the alert ID and start containing, how do you reference this incident later?',
      approach:
        'Ticket Console → open alert SUP-204 → record: alert ID, time, source IP, geo, user, failed MFA attempts. Mark severity=critical.',
      solution:
        'Open SUP-204 → copy alert ID → record 5 Ws (who/what/when/where/why) → severity=critical → assign to yourself.',
    },
    s2: {
      nudge: 'Containment stops the bleeding. What three actions do you take first?',
      question:
        "If Jane's account is compromised but you only reset her password, what is still open?",
      approach:
        'IAM Console → Jane → Disable. SecOps → Sessions → Revoke all sessions for Jane. Note the time of containment in the incident.',
      solution:
        'Disable Jane, revoke all her active sessions, rotate her password. Capture the audit log entries as evidence.',
    },
    s3: {
      nudge: 'A compromised account usually has siblings. Where do you look for related activity?',
      question:
        "If the attacker used Jane's credentials, what other accounts share her password or device?",
      approach:
        "SecOps → Audit Log → filter by Jane's IP, device, and last 7 days. Flag any other users with the same fingerprint.",
      solution:
        'Audit log query: same source IP OR same device fingerprint, last 7d. Open each result, decide if it is also compromised.',
    },
    s4: {
      nudge:
        'Every containment does not need the same response. What would make this one bigger than "one account, handled"?',
      question:
        'Step 3 found no other accounts touched by that ASN. Does that settle the escalation question, or just answer part of it?',
      approach:
        'Weigh what step 3 found — scope (one account vs. many), whether privilege escalation occurred, whether the pattern matches a known campaign — then record the decision and who you would notify if you escalated.',
      solution:
        'Record: "Not escalated — single account, no privilege escalation, no lateral movement found in step 3" (or the opposite, naming who gets notified and why). Capture it as evidence for this step.',
    },
    s5: {
      nudge:
        'An incident report is read by management, legal, and auditors. What structure do they expect?',
      question: 'If the report omits the timeline, how does legal know what to disclose?',
      approach:
        'Use the incident report template: summary, timeline (UTC), scope (accounts/data affected), containment, escalation decision, lessons learned.',
      solution:
        'Write the report in 6 sections: summary, timeline, scope, containment, escalation decision, lessons learned. Attach audit log excerpts.',
    },
    s6: {
      nudge:
        'Closing an incident means the system is back to normal and the report is filed. What else?',
      question:
        'If you close the incident without scheduling a post-mortem, what improvement never happens?',
      approach: 'SecOps Dashboard → Incidents → once status is "recovered", click Close.',
      solution:
        'Click "Mark recovered" then "Close" in the SecOps Dashboard incidents tab. Capture the closure as evidence.',
    },
  },
  lab09: {
    s1: {
      nudge: 'Standing privilege is a permanent grant. Where is the most dangerous one?',
      question:
        'If Hank has domain admin forever, what is the blast radius of his laptop being stolen?',
      approach:
        'SecOps → Roles → filter for role-domain-admin. The first row should be Hank. Document the risk in the incident record.',
      solution:
        'Open SecOps → Roles → sort by grants → identify Hank with role-domain-admin. Note the grant date and any audit hits.',
    },
    s2: {
      nudge: 'Removing standing privilege is a deliberate act. What do you replace it with?',
      question: 'If you only revoke, what does Hank do when he actually needs admin?',
      approach:
        'IAM Console → Hank → Roles → revoke role-domain-admin. Replace with a workflow-based elevation request (PIM).',
      solution:
        'Revoke role-domain-admin for Hank. Add him to grp-iam-admins-eligible (not the active group) so he can request elevation.',
    },
    s3: {
      nudge: 'Elevation is a request, not a grant. Where do you submit it?',
      question: 'If elevation takes 5 minutes, will Hank still take the shortcut?',
      approach:
        'Ticket Console → new request → type=elevation → role=domain-admin → duration=1h → justification. Submit and wait for approval.',
      solution:
        'Open Ticket Console → New Request → PIM elevation → role=domain-admin → 1h → reason="incident response" → submit.',
    },
    s4: {
      nudge:
        'A time-limited grant is only meaningful once someone actually uses it. What has to exist before it can expire?',
      question:
        'If Hank never signed in during the elevation window, what would revoking his sessions actually accomplish?',
      approach:
        'IAM Console → Verify Authentication → sign in as hank.oneill (this is the session the elevation created). Then use Revoke-UserSession / Active Sessions to end it, simulating the 15-minute auto-expiry.',
      solution:
        'Sign in as hank.oneill via Verify Authentication, then revoke his active session(s). The validator fires on session.revoked — with zero sessions open, revoking accomplishes nothing.',
    },
    s5: {
      nudge: 'A PAM policy is the written rule. Where does it live?',
      question: 'If the policy is in a Slack message, who can enforce it on day 100?',
      approach:
        'Document the PAM policy in a markdown file: scope, eligible users, elevation SLA, max duration, audit requirements, exceptions.',
      solution:
        'Write PAM-policy.md with sections: scope, eligible users, elevation SLA, max 1h, audit required, break-glass exception. Commit to repo.',
    },
  },
  lab10: {
    s1: {
      nudge:
        'Onboarding 5 people at once means you need a repeatable pattern. What is the smallest repeatable unit?',
      question:
        'If you onboard each person with a different set of groups, what does the audit log look like next quarter?',
      approach:
        'Create each user, assign them to a department group by template, do not enable MFA yet. Use the same naming convention for all 5.',
      solution:
        'For each of the 5 new hires: Create User → Add to grp-<dept>-<role> by template → sign-in verify. Same workflow for all 5.',
    },
    s2: {
      nudge: 'A move is two operations: add new access, remove old access. Which do you do first?',
      question: 'If you only add the new group, what old access is still open?',
      approach:
        'For each mover, identify the new group and the old group(s). Remove from old first, then add to new. Verify the audit log shows both.',
      solution:
        'For each mover: remove from old department group(s) → add to new department group → confirm audit log shows group.remove and group.add.',
    },
    s3: {
      nudge: 'Termination is the most-tested step. What three things must happen?',
      question: 'If you only disable the account, what sessions are still open?',
      approach:
        'Disable Bob, revoke all his sessions, remove him from all groups, and verify sign-in fails. Capture every audit entry.',
      solution:
        'IAM Console → Bob → Disable → SecOps → Revoke all sessions → IAM Console → Group Membership → remove from every group → Verify sign-in fails.',
    },
    s4: {
      nudge:
        'Integrating two apps with two different protocols is two problems, not one. Where is the cleanest place to start?',
      question: 'If you configure SAML and OIDC in parallel, which error wins?',
      approach:
        'Configure Finance Portal (SAML) first. Verify end-to-end. Then configure Help Desk Portal (OIDC). Verify separately.',
      solution:
        'SAML Finance Portal: register, set ACS, map role claim, verify sign-in. THEN OIDC Help Desk: register, set client secret, map scope, verify.',
    },
    s5: {
      nudge: 'Enforcing MFA for privileged roles is a phased rollout. Who is first?',
      question: 'If you enable MFA for everyone at once, who calls the help desk?',
      approach:
        'Enable MFA enforcement for grp-iam-admins first. Watch the audit log. Then expand to grp-finance-payroll, grp-engineering-dev, etc.',
      solution:
        'IAM Console → MFA Policy → enable for grp-iam-admins only → monitor 24h → expand to grp-finance-payroll and grp-engineering-dev.',
    },
    s6: {
      nudge:
        'A capstone access review covers all 5 onboarding groups. How do you know nothing is stale?',
      question: 'If you skip the review, what was the point of onboarding the right people?',
      approach:
        'Run dormant-account query (90d) and excessive-membership query (>5 groups). Record keep/remove decisions for 8 items.',
      solution:
        'SecOps → Access Reviews → run both queries → for 8 flagged items, record decision (keep/remove/remediate) with one-sentence justification.',
    },
    s7: {
      nudge: 'The capstone SSO break/fix is a fresh fault. What is the first thing you do?',
      question: 'If you skip triage, what cheap cause might you miss?',
      approach:
        'Open the incident. Triage in order: DNS, certificate, clock skew, config diff. Identify root cause. Apply fix. Retest.',
      solution:
        'Incident → triage (DNS/cert/time/diff) → root cause identified → fix applied → retest with sign-in → attach audit log evidence.',
    },
    s8: {
      nudge:
        'The capstone incident combines alert triage, containment, search, and reporting. What is the order?',
      question: 'If you skip containment and start searching, what is the attacker still doing?',
      approach:
        'Triage the alert → disable the compromised account → revoke sessions → search for related activity → write the report → close.',
      solution:
        'Alert → disable + revoke → audit-log search for related activity → 6-section incident report → close ticket with evidence.',
    },
    s9: {
      nudge:
        'A capstone audit report covers what you did and why. What three sections are mandatory?',
      question: 'If the report is just a screenshot, what is an auditor supposed to do with it?',
      approach:
        'Write the report: executive summary (1 paragraph), detailed findings (per lab), evidence index (audit log IDs and screenshots).',
      solution:
        'audit-report.md: exec summary → findings per lab (objectives, status, evidence IDs) → evidence index → sign-off section.',
    },
  },
  lab11: {
    s1: {
      nudge:
        'Conditional access is rules on top of authentication. What is the inventory of methods you are protecting?',
      question:
        'If you do not know what auth methods exist, how do you write a policy that covers them?',
      approach:
        'SecOps → Authentication Methods → list all enabled methods (password, TOTP, SMS, FIDO2, legacy). Note the gap.',
      solution:
        'Open SecOps → Auth Methods. Document which are enabled, which are legacy, which are MFA, which are FIDO2.',
    },
    s2: {
      nudge:
        'A policy that blocks legacy auth has to know what legacy looks like. Where is the list?',
      question: 'If you block basic auth and your printer relies on it, what breaks?',
      approach:
        'IAM Console → Conditional Access → New Policy → name CA-001 → condition: auth method = basic auth → effect: block. Save.',
      solution:
        'Create CA-001: condition=basic auth, effect=block. Test with a basic-auth client. Confirm the audit log shows block.',
    },
    s3: {
      nudge:
        'MFA for privileged roles is the same rule we set in lab05, but now it is a CA policy, not an IdP setting. Why?',
      question: 'If MFA is enforced in two places, which one wins?',
      approach:
        'IAM Console → CA → New Policy CA-002: condition=role in [domain-admin, security-admin], effect=require MFA. Save. Test as Hank.',
      solution:
        'Create CA-002: condition=role ∈ {domain-admin, security-admin}, effect=require MFA. Sign in as Hank, confirm MFA prompt.',
    },
    s4: {
      nudge: 'A simulation proves the block works. Where do you run it?',
      question: 'If the test is in production, what did you just take down?',
      approach:
        'Use the SecOps test harness: simulate a basic-auth sign-in from a non-named location. Confirm the block in the audit log.',
      solution:
        'SecOps → CA Test → basic-auth + foreign IP → expect block. Confirm audit log entry for the denied event.',
    },
    s5: {
      nudge: 'A named location exception is a hole in a rule. How do you make it auditable?',
      question: 'If a corporate VPN is whitelisted, who watches the watchers?',
      approach:
        'IAM Console → Named Locations → add "HQ office IP range". CA-001 → add exception: if location = HQ, allow legacy.',
      solution:
        'Named Locations → add HQ CIDR. CA-001 → add exception: location=HQ, effect=allow. Document the exception in the CA policy doc.',
    },
    s6: {
      nudge: 'A CA policy design document is what auditors ask for. What four sections?',
      question: 'If the policy lives only in the console, who can read it without an admin login?',
      approach:
        'Write ca-policy.md: scope, policy list (CA-001/002/...), exception list, audit cadence (weekly review of CA hits).',
      solution:
        'ca-policy.md: scope → policy list with conditions/effects → named location exceptions → audit cadence. Commit to docs repo.',
    },
  },
  lab12: {
    s1: {
      nudge: 'A hybrid identity starts with on-prem users. Where do they live before sync?',
      question: 'If on-prem users are not in a known OU, how does the sync agent find them?',
      approach:
        'Open the on-prem AD seed (mock). Confirm users are in OU=Employees. Note the UPN suffix for the cloud domain.',
      solution:
        'On-prem AD → Users container → confirm UPN = user@northwind.onmicrosoft.com. Note the OU for sync scope.',
    },
    s2: {
      nudge: 'A sync agent sits between on-prem and cloud. Where is it installed?',
      question:
        'If the agent is on a domain controller, what does a compromise of the DC compromise?',
      approach:
        'Install the sync agent on a dedicated member server (not a DC). Register it with the cloud tenant. Note the service account.',
      solution:
        'Member server sync-01 → install agent → register with tenant → service account = svc-sync (least privilege).',
    },
    s3: {
      nudge: 'Password hash sync is one of three auth methods. What does it actually sync?',
      question: 'If you enable PHS, do you still need ADFS?',
      approach:
        'Cloud tenant → Hybrid Identity → Password Hash Sync → enable. Wait for initial sync. Test sign-in as a synced user.',
      solution:
        'Enable PHS in the cloud tenant. Wait for first sync cycle. Sign in as a synced user with their on-prem password.',
    },
    s4: {
      nudge: 'The initial sync has to succeed end-to-end. What is the success signal?',
      question:
        'If the agent reports success but the cloud user has no group memberships, what is wrong?',
      approach:
        'Run sync. Check the agent log for the cycle result. Open the cloud user, confirm group memberships are present.',
      solution:
        'Run delta sync. Verify in cloud: user exists, UPN matches, all groups from the on-prem filter are present. Capture the agent log.',
    },
    s5: {
      nudge: 'JML is joiner, mover, leaver. In sync, what does each look like?',
      question: 'If a mover does not sync, where do you look — on-prem, the agent, or the cloud?',
      approach:
        "On the on-prem side, change a user's group membership. Trigger a delta sync. Verify the cloud user reflects the change.",
      solution:
        'On-prem: change group. Cloud: trigger delta. Cloud user: confirm new group. Audit log: confirm group.add on the cloud side.',
    },
    s6: {
      nudge:
        'A soft-match conflict is two users in the cloud with similar attributes. How do you resolve it?',
      question: 'If you merge the wrong pair, what do you just deleted?',
      approach:
        'Identify the on-prem user and the soft-matched cloud user. Use ImmutableID to hard-match. Verify the merge in the audit log.',
      solution:
        'Cloud → soft-matched user → set ImmutableID = on-prem objectGUID. Re-run sync. Confirm one user remains, others archived.',
    },
    s7: {
      nudge: 'A sync topology document is what you hand to ops. What four sections?',
      question: 'If the doc is missing the DR plan, what happens when the agent host fails?',
      approach:
        'hybrid-sync.md: topology diagram, agent hosts, sync schedule, DR plan (standby agent, manual export fallback).',
      solution:
        'hybrid-sync.md: topology, agent hosts, schedule, DR (standby sync-02 + manual CSV export fallback). Commit to docs repo.',
    },
  },
  lab13: {
    s1: {
      nudge:
        'A break-glass account is for emergencies. What does the policy say about who owns it?',
      question: 'If one person knows the break-glass password, what happens when they leave?',
      approach:
        'Write the break-glass policy: 2 accounts, no individual owner, sealed envelope in a safe, alert on any use, quarterly review.',
      solution:
        'break-glass-policy.md: 2 accounts (bg-admin-1, bg-admin-2), no individual owner, sealed in safe, real-time alert on use, quarterly review.',
    },
    s2: {
      nudge: 'Creating break-glass account 1 is just a special user. What is special?',
      question: 'If the account is subject to MFA, what happens if your IdP is down?',
      approach:
        'IAM Console → Create User bg-admin-1 → assign grp-iam-admins → set a 32-char random password → store in sealed envelope.',
      solution:
        'Create bg-admin-1 with grp-iam-admins, very long password, store in sealed envelope in safe A. No MFA on this account.',
    },
    s3: {
      nudge: 'Two break-glass accounts means two independent operators. Why two?',
      question: 'If both accounts use the same password, what is the single point of failure?',
      approach:
        'Create bg-admin-2 with the same group but a different password, stored in safe B (different physical location and custodian).',
      solution:
        'Create bg-admin-2 (different password, different custodian, different safe). Document the two-person rule for any use.',
    },
    s4: {
      nudge: 'Break-glass accounts must bypass CA policies. Why?',
      question: 'If break-glass is blocked by a CA policy, what did you just remove?',
      approach:
        'IAM Console → Conditional Access → each policy → add bg-admin-1 and bg-admin-2 to the exclude list. Save. Test.',
      solution:
        'For each CA policy, add bg-admin-1 and bg-admin-2 to the exclude list. Sign in as bg-admin-1, confirm no CA prompt.',
    },
    s5: {
      nudge:
        'A real-time alert on break-glass use is what wakes the on-call. What does the alert contain?',
      question:
        'If the alert only says "user signed in", what is the on-call supposed to do at 3am?',
      approach:
        'Wire an alert: trigger = bg-admin sign-in, payload = user, source IP, geo, time, runbook link. Send to PagerDuty or email.',
      solution:
        'SecOps → Alerts → New Rule: trigger=break-glass sign-in, payload=user+IP+geo+runbook URL, channel=PagerDuty/email. Test it.',
    },
    s6: {
      nudge: 'A quarterly review on break-glass verifies the accounts still work. How?',
      question:
        'If you test by signing in, you trigger the alert. How do you test without alarming?',
      approach:
        'Run a credential-only test: attempt sign-in from the break-glass IP, fail fast, confirm the alert fires (acknowledge in test mode).',
      solution:
        'Quarterly: read-only test of the credential (no full sign-in). Document test result. Rotate passwords if compromised or >180 days old.',
    },
    s7: {
      nudge: 'A recovery flow test proves the whole chain works. What does it cover?',
      question:
        'If you never test, the first real use is also the first test. What could go wrong?',
      approach:
        'Schedule a planned recovery test: take IdP offline, sign in as bg-admin-1, perform one admin action, restore IdP, audit.',
      solution:
        'Planned test window → disable IdP sign-in for non-bg users → sign in as bg-admin-1 → restore IdP → audit log review → post-mortem.',
    },
  },
  lab14: {
    s1: {
      nudge:
        'Every grant on this list asked for scopes and got a "yes" from some user. What separates a reasonable "yes" from a dangerous one?',
      question:
        'TeamSync Meetings only asks to read calendars. What does the suspicious app ask for, and does that match what it claims to do?',
      approach:
        "Open IAM Console → OAuth App Governance → OAuth Consent Grants. Compare each grant's scopes, publisher, and grant time. One app requests mailbox and file-write access it has no obvious reason to need, from a publisher nobody recognizes, granted minutes ago.",
      solution:
        'QuickSign Docs — publisher "Bright Path Solutions (unverified)" — requests Mail.Read, Files.ReadWrite.All, and Contacts.Read, granted by dan.rivera 20 minutes ago. That is the grant to act on.',
    },
    s2: {
      nudge: 'Detecting the grant and ending it are two different actions. Where do you end it?',
      question: 'What does revoking a grant stop, and what has it already not undone?',
      approach:
        'IAM Console → OAuth App Governance → Revoke OAuth Grant. Identity: dan.rivera. App client ID: oauth-quicksign-docs.',
      solution:
        'Run Revoke OAuth Grant with Identity=dan.rivera, ClientId=oauth-quicksign-docs. This stops future access; anything already read or exfiltrated is a separate, already-done fact.',
    },
    s3: {
      nudge:
        'A phishing email is usually sent to more than one address. What would tell you if it landed on more than one victim?',
      question:
        "If you only look at Dan's grants, how would you ever notice a second person clicked the same link?",
      approach:
        'OAuth App Governance → OAuth Consent Grants (leave Identity blank to see everyone) → look for any other row with client ID oauth-quicksign-docs.',
      solution:
        'A second active grant for oauth-quicksign-docs exists under erin.cho, granted 35 minutes ago — same app, same scopes, a second victim of the same campaign.',
    },
    s4: {
      nudge: 'You found a second victim. What is the same action you just took for the first one?',
      question: 'Why would stopping after Dan have left the incident half-resolved?',
      approach: 'Revoke OAuth Grant with Identity=erin.cho, ClientId=oauth-quicksign-docs.',
      solution: 'Run Revoke OAuth Grant: Identity=erin.cho, ClientId=oauth-quicksign-docs.',
    },
    s5: {
      nudge:
        'Both known grants are gone. Is there anything stopping a third user from clicking "Accept" on the same app tomorrow?',
      question: 'What is the difference between revoking a grant and blocking an app?',
      approach: 'OAuth App Governance → Block OAuth App → ClientId: oauth-quicksign-docs.',
      solution:
        'Run Block OAuth App with ClientId=oauth-quicksign-docs. Revoking ends existing access; blocking prevents the next person from granting it in the first place.',
    },
    s6: {
      nudge:
        'Detection, two revokes, and a block all happened. Nothing yet says what Dan and Erin should be told, or what changes going forward.',
      question:
        'If admin-consent-required had already been enabled tenant-wide, would either user have been able to grant this app at all?',
      approach:
        'Write up: app name, scopes, both affected users, grant and revoke timestamps, the block action, and a recommendation to require admin approval for future third-party app consent.',
      solution:
        'Document QuickSign Docs (client oauth-quicksign-docs): scopes Mail.Read/Files.ReadWrite.All/Contacts.Read; victims dan.rivera and erin.cho; both revoked and the app blocked; recommend enabling admin-consent-required so users cannot self-approve high-risk scopes going forward. Capture it as evidence for this step.',
    },
  },
  lab15: {
    s1: {
      nudge:
        'A certificate has an expiry date whether anyone is watching it or not. Where would you see that date for each app?',
      question:
        'If two apps were issued certificates on the same day, would you expect them to expire close together?',
      approach:
        'IAM Console → Registered Applications. Note protocol and any visible config detail per app; identify which apps rely on certificate-backed trust.',
      solution:
        'Review the Registered Applications panel for Finance Portal (SAML) and Help Desk Portal (OIDC) — both are certificate-backed SSO integrations and candidates for expiry risk. Capture it as evidence for this step.',
    },
    s2: {
      nudge:
        'A failed sign-in page that shows a "Configuration mismatch" panel is telling you exactly what to fix, not just that something is wrong.',
      question: 'What does the mismatch panel name as the expected value, and what field is that?',
      approach:
        'Attempt sign-in on Finance Portal, read the mismatch panel for the cert.validUntil field and expected date, then use Update App Configuration to set it.',
      solution:
        'Update App Configuration: App=app-finance, Field=cert.validUntil, Value=<the expected date shown on the mismatch panel>.',
    },
    s3: {
      nudge: 'A fix on one app does not prove anything about a different app.',
      question: 'Why sign in on Help Desk Portal too, if only Finance Portal was ever broken?',
      approach: 'Sign in as Dan Rivera on Finance Portal, then as Erin Cho on Help Desk Portal.',
      solution:
        'Use Verify Authentication for dan.rivera on Finance Portal and erin.cho on Help Desk Portal — both must succeed.',
    },
    s4: {
      nudge:
        'Step 1 flagged a second app at risk. Nothing is broken there yet — that is exactly the point of doing this now instead of later.',
      question:
        'What is the cost difference between rotating this certificate now versus after it fails?',
      approach:
        'Update App Configuration: App=app-helpdesk-portal, Field=cert.validUntil, Value=a date at least a year out.',
      solution:
        'Run Update App Configuration with App=app-helpdesk-portal, Field=cert.validUntil, Value=<a far-future date, e.g. one year out>.',
    },
    s5: {
      nudge:
        'One reactive fix and one proactive rotation happened. Nothing yet says how the next expiry gets caught before it becomes an outage.',
      question:
        "If every certificate had a 30-day-out expiry alert, would this morning's Finance Portal outage have happened?",
      approach:
        "Write up: alert threshold (e.g. 30 days before expiry), who owns renewal, and the process that would have caught today's expiry in advance.",
      solution:
        'Document: alert 30 days before any cert.validUntil, renewal owned by IAM operations, tracked against the same Registered Applications inventory used in step 1. Capture it as evidence for this step.',
    },
  },
  lab16: {
    s1: {
      nudge:
        'A wrong password fails one person, once. What kind of failure hits several people at the same moment?',
      question:
        'These logons are domain workstations, not the SSO portal — what authentication protocol handles that, and what does it depend on that a password check does not?',
      approach:
        'Review the sign-in failure log for the affected users. Look at the timing and whether it clusters around one moment rather than being spread out.',
      solution:
        'Multiple users failing logon at the same clustered time, on domain-joined machines, points to something systemic in the authentication protocol itself — not individual bad passwords. Capture it as evidence for this step.',
    },
    s2: {
      nudge:
        'Kerberos issues time-stamped tickets and rejects ones that look impossibly old or from the future. What would make every ticket look wrong at once?',
      question:
        'Why would password authentication survive a clock drift that breaks Kerberos completely?',
      approach: 'IAM Console → Application Configuration → Sync IdP Clock.',
      solution:
        "Run Sync IdP Clock. Kerberos tickets carry a timestamp and are rejected outside a narrow tolerance (~5 minutes by default) — resyncing the clock is the actual fix, not resetting any one user's credentials.",
    },
    s3: {
      nudge:
        'A lockout during an outage and a lockout from an attack look the same in the account status field. What tells them apart?',
      question:
        "If Greta's lockout coincides exactly with the clock-skew window, what does that timing tell you about the cause?",
      approach: 'IAM Console → Unlock Account → Identity: greta.olsen.',
      solution:
        'Run Unlock Account for greta.olsen. The lockout timing matching the outage window is what supports "side effect," not "compromise" — document that reasoning in step 5.',
    },
    s4: {
      nudge:
        'Two separate fixes happened. A successful sign-in is the only thing that proves both actually worked together.',
      question:
        'If the clock fix worked but the unlock did not, what would this sign-in attempt show you?',
      approach: 'Use Verify Authentication for greta.olsen.',
      solution:
        'Sign in as greta.olsen and confirm success — this depends on both the clock fix and the unlock.',
    },
    s5: {
      nudge:
        'One clock drifting caused a fleet-wide outage. Nothing yet explains why one bad clock has that much blast radius.',
      question:
        'If NTP had been monitored on the domain controller, would this have become an incident at all?',
      approach:
        "Write up: Kerberos's clock-tolerance mechanism, why it turned one drifting clock into a mass failure, and an NTP-monitoring recommendation.",
      solution:
        'Document: Kerberos rejects tickets outside its clock-skew tolerance (default ~5 min), so every ticket issued by a drifting DC fails at once — that is why it looked systemic rather than like isolated tickets. Recommend NTP monitoring with alerting on drift beyond a few minutes. Capture it as evidence for this step.',
    },
  },
  lab17: {
    s1: {
      nudge:
        'A role has two independent halves: what it can do, and who can become it. A problem in one says nothing about the other.',
      question: 'The role is named "readonly" — does its permission list actually match that name?',
      approach:
        'Open IAM Console → Cloud IAM Roles. List prod-data-readonly and compare its permissions (s3:*, ec2:*, iam:PassRole) and trust policy (nearly every employee) against what a two-person data team actually needs.',
      solution:
        'prod-data-readonly grants far more than read access (ec2:*, iam:PassRole have nothing to do with reading data) and trusts far more people than the data team. Capture both findings as evidence for this step.',
    },
    s2: {
      nudge:
        'A wildcard is not a permission, it is the absence of a decision about which permissions are needed.',
      question:
        'What would iam:PassRole on a "read-only" role let someone do that has nothing to do with reading data?',
      approach:
        'Cloud IAM Roles → Scope Role Permissions. RoleName: prod-data-readonly. Permissions: s3:GetObject, s3:ListBucket.',
      solution:
        'Run Scope Role Permissions with RoleName=prod-data-readonly, Permissions=s3:GetObject, s3:ListBucket — dropping ec2:* and iam:PassRole entirely.',
    },
    s3: {
      nudge:
        'Trust and permission are separate settings on the same object — narrowing one does nothing to the other.',
      question:
        'If nine people were trusted and the role touches production data, what is the realistic blast radius of one compromised laptop?',
      approach:
        'Cloud IAM Roles → Scope Role Trust Policy. RoleName: prod-data-readonly. TrustedUsers: ivy.park, dan.rivera.',
      solution:
        'Run Scope Role Trust Policy with RoleName=prod-data-readonly, TrustedUsers=ivy.park, dan.rivera.',
    },
    s4: {
      nudge: 'A narrowed trust policy should still work for the people it was actually meant for.',
      question:
        'Why test the allow case at all, if you already know Ivy is on the trust list you just wrote?',
      approach:
        'Cloud IAM Roles → Assume Cloud Role. RoleName: prod-data-readonly. Identity: ivy.park.',
      solution:
        'Run Assume Cloud Role with RoleName=prod-data-readonly, Identity=ivy.park — must succeed.',
    },
    s5: {
      nudge:
        'The negative test proves the policy actually excludes someone, not just that it includes the right people.',
      question:
        'If you only tested the allow case, would you actually know the trust policy was scoped correctly?',
      approach:
        'Cloud IAM Roles → Assume Cloud Role. RoleName: prod-data-readonly. Identity: bob.sato.',
      solution:
        'Run Assume Cloud Role with RoleName=prod-data-readonly, Identity=bob.sato — must be denied. A denial is still a recorded, auditable attempt.',
    },
    s6: {
      nudge:
        "Two separate defects got fixed and proven. Nothing yet explains, for someone who wasn't here, why the role looked the way it did and what it looks like now.",
      question:
        'If a new hire joined the data team next month, what would this document need to tell them to do?',
      approach:
        'Write up: the original wildcard permissions and over-broad trust, what each was scoped down to, and the allow/deny proof from steps 4 and 5.',
      solution:
        'Document: prod-data-readonly originally granted s3:*/ec2:*/iam:PassRole to nine users; scoped to s3:GetObject/s3:ListBucket for ivy.park and dan.rivera only; verified ivy.park can still assume it and bob.sato cannot. Capture it as evidence for this step.',
    },
  },
  lab18: {
    s1: {
      nudge:
        'A service account has no manager to notice when something is wrong with it. That is exactly why it needs a heavier audit, not a lighter one.',
      question:
        'None of these three accounts should ever produce an interactive sign-in. Which audit fields would tell you if one just did?',
      approach:
        'Open the IAM Console and look up svc-backup, svc-monitor, and svc-idp-sync one at a time: group memberships, last sign-in, and sign-in source.',
      solution:
        'svc-backup carries standing grp-domain-admins membership, svc-idp-sync has never had its credential rotated since creation, and svc-monitor shows sign-in activity outside its normal pattern. Capture the inventory as evidence for this step.',
    },
    s2: {
      nudge: 'A nightly backup job reads files. It does not administer the domain.',
      question:
        "A backup job needs to read data, not administer the domain. What's the blast radius if this credential leaks?",
      approach: 'IAM Console → find svc-backup → revoke its domain-admin role.',
      solution:
        "Revoke svc-backup's role-domain-admins grant and record the reason (leftover from a migration project, never revoked).",
    },
    s3: {
      nudge:
        'A credential that has never rotated is a credential that has had its entire lifetime to leak.',
      question:
        'Why does an unrotated service-account credential matter more than an unrotated human password?',
      approach: 'IAM Console → svc-idp-sync → Reset Password (Rotate Credential).',
      solution:
        "Reset svc-idp-sync's credential. A human notices a password stopped working; nothing notices a sync connector silently using a leaked one.",
    },
    s4: {
      nudge:
        'A monitoring job authenticates on the same schedule from the same source, every time. Anything else is the anomaly.',
      question:
        "If a person's account showed this pattern, you'd call it a credential-stuffing attempt. Does that change because the account belongs to a service, not a person?",
      approach:
        "Open SecOps Dashboard or the IAM Console audit view and filter svc-monitor's sign-in history for failed attempts followed by an unexpected success.",
      solution:
        'svc-monitor shows three failed sign-ins followed by a success from an external address — the same signature a suspicious human sign-in would show. Capture it as evidence for this step.',
    },
    s5: {
      nudge: 'Disabling nothing yet — first cut off whatever session that sign-in already created.',
      question:
        "Service accounts don't file tickets when something feels wrong — who is supposed to notice this instead?",
      approach: 'IAM Console → svc-monitor → Revoke Sessions.',
      solution: 'Revoke every active session for svc-monitor.',
    },
    s6: {
      nudge:
        'Revoking the session stops what is happening right now. It says nothing about whether the credential itself is still good.',
      question:
        'If this policy had existed before today, would the svc-backup finding or the svc-monitor anomaly have been caught sooner?',
      approach:
        "Reset svc-monitor's credential, then write a short non-human-identity policy: inventory, owner, rotation cadence, and sign-in review responsibility for each service account.",
      solution:
        "Reset svc-monitor's credential. Document: three service accounts (svc-backup, svc-monitor, svc-idp-sync), their purpose and owner, a rotation cadence, and who reviews their sign-in activity going forward. Capture it as evidence for this step.",
    },
  },
  lab19: {
    s1: {
      nudge: 'Five accounts, identical shape. This is exactly what automation is for.',
      question:
        'What is the fastest way to provision five accounts identically, without five separate chances to mistype a field?',
      approach:
        'Open PowerShell → "Bulk onboarding — new hires". Put the five usernames in $names, set the group to grp-analytics-readers, run it.',
      solution:
        'Run the bulk-onboarding script with $names = nina.volkov, theo.marsh, yuki.abe, devon.clarke, ines.rocha and the group set to grp-analytics-readers.',
    },
    s2: {
      nudge:
        'The directory already has an opinion about this username. Ask it before you create anything.',
      question:
        'Lab 12 taught you to join a genuine same-person soft-match instead of deleting one side. What tells you this case is different?',
      approach:
        'Look up the existing sam.oduya — a contractor whose engagement ended eighteen months ago. The new hire is a different person; provision them as sam.oduya2 and leave the old record alone.',
      solution:
        'Create sam.oduya2 for the new hire. Do not touch, merge, or delete the existing sam.oduya record — it belongs to someone else.',
    },
    s3: {
      nudge:
        "HR says one thing. The directory says another. Trust the directory's state, not the story.",
      question:
        'A joiner feed and a leaver feed are two different automated jobs. Why would one silently fail while the other keeps working?',
      approach: "Open the IAM Console and check priya.fernandes's account status directly.",
      solution:
        'priya.fernandes is still active six weeks after HR marked her terminated — the deprovisioning side of the SCIM feed never fired. Capture the finding as evidence for this step.',
    },
    s4: {
      nudge:
        'Every day between the termination date and today was excess access nobody knew about.',
      question:
        'Six weeks of access nobody tracked — what would you check to find out whether any of it was actually used?',
      approach: 'IAM Console → priya.fernandes → Disable Account, then remove grp-engineering-dev.',
      solution: 'Disable priya.fernandes and remove her from grp-engineering-dev.',
    },
    s5: {
      nudge: 'Disabling the account and ending her session are two different actions.',
      question:
        'A termination feed that only disables the account and never checks for a live session — what does that miss?',
      approach: 'IAM Console → priya.fernandes → Revoke Sessions.',
      solution: 'Revoke every active session for priya.fernandes.',
    },
    s6: {
      nudge:
        'The connector failing once is an incident. Nothing yet explains how you would catch the next one.',
      question:
        'If this audit had run weekly, how many days of excess access would Priya have actually had?',
      approach:
        'Write up: what the SCIM deprovisioning feed dropped, how you found it (directory status vs. HR termination date), and a periodic stale-account audit to run going forward.',
      solution:
        "Document: the SCIM feed silently dropped priya.fernandes's termination event; found by comparing HR's termination date against her still-active directory status; recommend a weekly automated comparison between HR termination records and directory status so a dropped event surfaces in days, not weeks. Capture it as evidence for this step.",
    },
  },
  lab20: {
    s1: {
      nudge: 'Three alerts look similar at a glance. They are not similar underneath.',
      question:
        'What in a sign-in event distinguishes an anomaly from an ordinary mistake — the failure count, the source, the timing, or the combination?',
      approach:
        'Open SecOps Dashboard and review the audit trail for dan.rivera, greta.olsen, and finn.muller one at a time.',
      solution:
        'Three sign-in alerts reviewed: Dan (one failed attempt, normal location), Greta (new city, no failures), Finn (three failures then success from a foreign address). Capture the triage as evidence for this step.',
    },
    s2: {
      nudge: 'A single mistyped password from a normal place is not, by itself, an incident.',
      question:
        'One failed sign-in from a normal location — what would have to be true for you to escalate this instead of closing it?',
      approach:
        'Confirm dan.rivera has no privilege change following the sign-in, then record: ruled out, single failed attempt from his usual location.',
      solution:
        "Record that Dan's alert is a false positive: one failed sign-in, normal location, no follow-on privilege change.",
    },
    s3: {
      nudge:
        'A new location is a fact. Whether it is suspicious depends on context you have to go get.',
      question:
        'A new-location sign-in with no failed attempts and a business reason on file — what makes this different from a real impossible-travel case?',
      approach:
        'Confirm greta.olsen has no privilege change following the sign-in, then record: ruled out, travelling for a board meeting this week.',
      solution:
        "Record that Greta's alert is a false positive: new city, no failed attempts, confirmed business travel, no follow-on privilege change.",
    },
    s4: {
      nudge:
        'The sign-in pattern by itself looks like the other two. What happened right after it does not.',
      question:
        'Finn is on your own team. Does that change how you investigate his account, or how you should?',
      approach:
        "Check finn.muller's account for any role granted right after the sign-in burst — compare timestamps.",
      solution:
        'Finn gained standing role-domain-admins moments after three failed sign-ins and a success from a foreign address — nobody requested that grant. That combination, not the sign-in alone, is what makes this real. Capture it as evidence for this step.',
    },
    s5: {
      nudge:
        'The account can still authenticate normally. The privilege it should not have is the active risk.',
      question:
        'Why revoke the privilege before disabling the account, rather than the other way around?',
      approach: 'IAM Console → finn.muller → revoke the role-domain-admins grant.',
      solution: "Revoke finn.muller's role-domain-admins grant.",
    },
    s6: {
      nudge:
        'The privilege is gone. Whatever session that sign-in opened is not, until you close it.',
      question: 'If someone asked why you did not also disable Dan and Greta, what is your answer?',
      approach:
        "Revoke finn.muller's sessions, then write the report: what happened, why Dan and Greta were ruled out, and what evidence made Finn's case real.",
      solution:
        "Revoke finn.muller's sessions. Document: three alerts reviewed, two ruled out with reasons (mistyped password; confirmed travel), one confirmed real because the sign-in was followed by an unrequested privilege grant. Capture it as evidence for this step.",
    },
  },
  lab21: {
    s1: {
      nudge: 'A guest account with no owner and no end date is a permanent guest.',
      question:
        'A guest account with no sponsor and no end date on record — who is accountable for it six months from now?',
      approach:
        'IAM Console → Provision User. Username marcus.webb, department "External — Fabrikam Analytics", title recording sponsor (Ivy Park) and access window (14 days).',
      solution:
        'Create marcus.webb with department "External — Fabrikam Analytics" and title "Guest — sponsored by Ivy Park, access window 14 days".',
    },
    s2: {
      nudge: 'A data-review engagement needs read access to data. Nothing else.',
      question:
        'An external contractor with the same access as a full-time employee — what makes that riskier than the same mistake for an internal hire?',
      approach: 'IAM Console → Group Membership → add marcus.webb to grp-analytics-readers only.',
      solution: 'Add marcus.webb to grp-analytics-readers. No other group.',
    },
    s3: {
      nudge:
        'The directory does not enforce an access window by itself. Only a review catches an expired one.',
      question: 'Nothing technical enforces a guest access window by itself. What does?',
      approach:
        "Run Get-ADUser and read the Title column for every external account — one guest's recorded access window ended months ago.",
      solution:
        "layla.haddad's title records an access window that expired 2026-05-01, four months before this lab. Capture the finding as evidence for this step.",
    },
    s4: {
      nudge: 'The engagement ended. The account did not.',
      question:
        'Four months of access past the intended end date — what would you check to see whether any of it was used?',
      approach: 'IAM Console → layla.haddad → Disable Account.',
      solution: 'Disable layla.haddad.',
    },
    s5: {
      nudge: 'Disabling the account and ending her session are two different actions.',
      question:
        'A guest account with no expiry enforcement and no session review — how long could this have run unnoticed if nobody had looked?',
      approach: 'IAM Console → layla.haddad → Revoke Sessions.',
      solution: 'Revoke every active session for layla.haddad.',
    },
    s6: {
      nudge:
        'Marcus is provisioned the right way today. Nothing yet says what happens when his 14 days are up.',
      question:
        'If this review had run monthly, how many months of unnecessary access would Layla have actually had?',
      approach:
        'Write up: every guest gets a named sponsor, a hard access-window end date, and a periodic review comparing guest accounts against that date.',
      solution:
        "Document: guest-access policy requires a named sponsor, a recorded end date, and a periodic (recommend monthly) review comparing every external account's recorded window against its current status — the review that would have caught Layla in month one instead of month four. Capture it as evidence for this step.",
    },
  },
  lab22: {
    s1: {
      nudge:
        'Nothing today distinguishes an admin signing in from their work laptop from an admin signing in from anywhere else.',
      question:
        'A stolen but otherwise valid admin credential — what stops it from being used today, and what should?',
      approach:
        'Open the IAM Console and confirm role-iam-admins and role-domain-admins have no conditional access policy yet.',
      solution:
        'Confirm no policy currently restricts sign-in by device for either privileged role. Capture it as evidence for this step.',
    },
    s2: {
      nudge:
        'Start with the role that can do the most damage if its device requirement is wrong on day one — the smaller one.',
      question: 'Why scope this to role-iam-admins instead of every employee on day one?',
      approach:
        'IAM Console → Access & Sessions → Set Conditional Access Policy. Role: role-iam-admins. Require compliant device: on.',
      solution:
        'Set Conditional Access Policy with Role=role-iam-admins, RequireCompliantDevice=true.',
    },
    s3: {
      nudge:
        'A policy that has never actually blocked anything has not been tested — only described.',
      question:
        'If this had failed silently instead of logging a blocked sign-in, how would anyone know the policy was working at all?',
      approach:
        'IAM Console → Verify Authentication. Select erin.cho, uncheck "device compliant", click Sign in (verify).',
      solution:
        'Attempt Verify Authentication for erin.cho with device compliant unchecked — the sign-in is blocked and the block is logged.',
    },
    s4: {
      nudge: 'The policy should stop a bad device, not stop Erin.',
      question: 'Why test the allow case at all, if you already confirmed the block works?',
      approach:
        'IAM Console → Verify Authentication. Select erin.cho, check "device compliant", click Sign in (verify).',
      solution:
        'Attempt Verify Authentication for erin.cho with device compliant checked — the sign-in succeeds.',
    },
    s5: {
      nudge: 'Domain admin is at least as sensitive as IAM admin, and currently has the same gap.',
      question:
        'What would you check to make sure this second policy did not accidentally weaken the first one?',
      approach:
        'IAM Console → Access & Sessions → Set Conditional Access Policy. Role: role-domain-admins. Require compliant device: on.',
      solution:
        'Set Conditional Access Policy with Role=role-domain-admins, RequireCompliantDevice=true.',
    },
    s6: {
      nudge:
        'The policy exists now. Nothing yet says what happens when a legitimate admin gets a new, unenrolled laptop.',
      question:
        'An admin is issued a new laptop today and needs to work before MDM enrollment finishes. What is the safe exception, and what is not?',
      approach:
        'Write up: which roles require a compliant device, what "compliant" means, and a time-boxed exception process for a new device pending enrollment.',
      solution:
        'Document: role-iam-admins and role-domain-admins require a compliant device (MDM-enrolled, encrypted, patched); a new device gets a short, named, time-boxed exception during enrollment — never a permanent one. Capture it as evidence for this step.',
    },
  },
  lab23: {
    s1: {
      nudge:
        'Two companies of any size will always share at least one name. That is a coincidence, not a data problem, until you check.',
      question:
        'Two companies of any real size will always share at least one common name. What do you check before assuming a match means the same person?',
      approach:
        'Look up "alex.morgan" in the IAM Console before creating any of the three Fabrikam accounts.',
      solution:
        'Northwind already has an alex.morgan in Finance — a different person from the Fabrikam Alex Morgan on the migration roster. Capture the finding as evidence for this step.',
    },
    s2: {
      nudge:
        'Renaming the existing account to make room for a name that arrived later breaks everything already pointed at it.',
      question:
        'What would break for the existing Alex Morgan if you renamed her account to make room for the new hire?',
      approach: 'IAM Console → Provision User. Username: alex.morgan2.',
      solution:
        'Create alex.morgan2 for the Fabrikam hire. Leave the existing alex.morgan untouched.',
    },
    s3: {
      nudge:
        "Fabrikam's org chart does not exist at Northwind. What Priya actually did with her access does.",
      question:
        "Priya's Fabrikam job title doesn't exist at Northwind. What do you map against instead of the title?",
      approach: 'Create priya.iyer, then add her to grp-analytics-readers.',
      solution: 'Provision priya.iyer and add her to grp-analytics-readers.',
    },
    s4: {
      nudge: 'A title from the acquired company is a claim, not a grant.',
      question:
        'If you had granted grp-sales-executives on the strength of his old title alone, what would you actually be verifying?',
      approach: 'Create tom.reeves, then add him to grp-sales-readonly only.',
      solution:
        'Provision tom.reeves and add him to grp-sales-readonly. Do not add grp-sales-executives.',
    },
    s5: {
      nudge:
        'An account nobody can attribute to one person is an account nobody can hold accountable.',
      question:
        'If this account had a real, encrypted service purpose instead of being shared by people, would your answer change? What would you check to tell the difference?',
      approach: 'IAM Console → fabrikam-shared-login → Disable Account.',
      solution:
        'Disable fabrikam-shared-login. Do not provision a replacement under one name — ask which specific people need access.',
    },
    s6: {
      nudge:
        'Three access decisions and one refusal got made. Nothing yet explains the reasoning to someone who reviews this in six months.',
      question:
        'Six months from now, a Fabrikam manager asks why their team lost the shared login they always used. Does your document answer that?',
      approach:
        'Write up: the alex.morgan collision and how the two people were told apart, the access-mapping rationale for Priya and Tom, and why the shared login was refused.',
      solution:
        'Document: alex.morgan (existing) and alex.morgan2 (new hire) are different people, kept separate; priya.iyer mapped to grp-analytics-readers on actual job function; tom.reeves given grp-sales-readonly only, pending a real review before any executive-level access; fabrikam-shared-login disabled because no single person could be held accountable for it. Capture it as evidence for this step.',
    },
  },
  lab24: {
    s1: {
      nudge:
        'A license group has no idea whether its members still work here or still use the tool. Only you checking does.',
      question:
        "A license group's member count and the number of people actually paying for is not the same fact. What closes that gap?",
      approach:
        "Run Get-ADUser and review grp-vpn-users and grp-analytics-readers membership against each member's enabled status and last sign-in.",
      solution:
        'hank.oneill is disabled but still in grp-vpn-users; cara.patel is active but dormant 90+ days and in grp-analytics-readers. Capture both findings as evidence for this step.',
    },
    s2: {
      nudge:
        'Disabling an account stops the front door. It does nothing to the group memberships already granted.',
      question: 'Disabling an account stops sign-in. What does it not automatically stop?',
      approach: 'IAM Console → Group Membership → remove hank.oneill from grp-vpn-users.',
      solution: 'Remove hank.oneill from grp-vpn-users.',
    },
    s3: {
      nudge: 'An unused seat and a misused seat cost the same amount either way.',
      question:
        'A dormant seat and a departed employee cost the same license fee. Why does one get caught by offboarding and the other does not?',
      approach:
        "Confirm cara.patel's last sign-in is 90+ days old, then remove her from grp-analytics-readers.",
      solution: 'Remove cara.patel from grp-analytics-readers.',
    },
    s4: {
      nudge: 'Finance does not want a story. Finance wants a number and a date.',
      question:
        'If Finance asked "how do we know this won\'t just happen again next quarter", what would your report need to say?',
      approach:
        'Write up: 2 seats reclaimed (1 VPN, 1 analytics), who held each, why, and the effective date.',
      solution:
        'Report to Finance: reclaimed 1 VPN seat (hank.oneill, departed) and 1 analytics seat (cara.patel, 90+ day dormancy), effective today. Capture it as evidence for this step.',
    },
    s5: {
      nudge:
        'This time it was two seats found by hand. Next quarter it should not require anyone to look by hand at all.',
      question:
        'Whose job should this recurring check be: IAM, Finance, or the app owner — and why?',
      approach:
        'Document a monthly recurring reconciliation: cross-reference every license group against account status and last-sign-in.',
      solution:
        'Document: a monthly automated reconciliation comparing every license-bearing group against account status (enabled/disabled) and last-sign-in, owned by IAM with Finance notified of every reclamation. Capture it as evidence for this step.',
    },
  },
  lab25: {
    s1: {
      nudge:
        'SMS, TOTP, and FIDO2 all say "MFA enabled" on the same dashboard. They do not all mean the same thing.',
      question:
        'SMS, TOTP, and FIDO2 are all "MFA". What specific attack does each one fail to stop that FIDO2 does?',
      approach: 'Check MFA status for erin.cho, greta.olsen, and finn.muller in the IAM Console.',
      solution:
        'erin.cho: no MFA. greta.olsen: SMS. finn.muller: TOTP. None are phishing-resistant. Capture it as evidence for this step.',
    },
    s2: {
      nudge:
        'A brand-new privileged enrollment has no legacy method to migrate away from — start it at the destination.',
      question:
        'Why enroll a new privileged account straight into FIDO2 instead of TOTP first and upgrading later?',
      approach: 'IAM Console → Enrol MFA. Identity: erin.cho. Method: fido2.',
      solution: 'Enrol erin.cho with Method=fido2.',
    },
    s3: {
      nudge: 'SMS can be intercepted by a SIM swap without the victim doing anything wrong at all.',
      question:
        'What specifically about SMS makes it the weakest of the three methods this lab covers?',
      approach: 'IAM Console → Enrol MFA. Identity: greta.olsen. Method: fido2.',
      solution: 'Enrol greta.olsen with Method=fido2.',
    },
    s4: {
      nudge:
        'A real-time phishing proxy relays a TOTP code the instant the victim types it. It cannot relay a FIDO2 signature.',
      question:
        'TOTP codes are typically considered stronger than SMS. What attack still works against TOTP that does not work against FIDO2?',
      approach: 'IAM Console → Enrol MFA. Identity: finn.muller. Method: fido2.',
      solution: 'Enrol finn.muller with Method=fido2.',
    },
    s5: {
      nudge:
        'Three accounts are migrated. Nothing yet says what happens to the fourth account that has not received its key yet.',
      question:
        'If the fallback process is "just use TOTP until your key arrives", what stops that from quietly becoming permanent?',
      approach:
        'Write up: all three accounts now on FIDO2, a retirement date for SMS/TOTP, and a time-boxed fallback exception for anyone still waiting on a hardware key.',
      solution:
        'Document: erin.cho, greta.olsen, and finn.muller are on FIDO2; SMS and TOTP retire in 90 days; anyone without a key gets a named, dated fallback exception, not an indefinite one. Capture it as evidence for this step.',
    },
  },
  lab26: {
    s1: {
      nudge:
        "A group membership is one kind of edge in this graph. A capability over someone else's account is another.",
      question:
        'Dan holds no admin group membership at all. Why does that not mean he has no path to admin?',
      approach:
        'Check who can reset passwords (help-desk tier 1) and cross-reference against who holds standing domain-admin (hank.oneill).',
      solution:
        "dan.rivera (Help Desk Tier 1, password-reset rights) -> resets hank.oneill's password -> hank.oneill holds standing role-domain-admins. One hop. Capture the path as evidence for this step.",
    },
    s2: {
      nudge:
        'The permission existing on paper and the permission actually working are two different claims.',
      question:
        'You just did, with permission, exactly what a compromised help-desk account could do without it. What does that tell you about where the real privilege boundary sits?',
      approach: 'IAM Console → hank.oneill → Reset Password.',
      solution: "Reset hank.oneill's password to prove the path is exercisable, not theoretical.",
    },
    s3: {
      nudge:
        'Taking password-reset away from help desk breaks their entire job. Taking standing admin away from Hank does not break his.',
      question:
        'Why does removing standing privilege close this path more effectively than trying to restrict what help desk can reset?',
      approach: 'IAM Console → hank.oneill → revoke role-domain-admins.',
      solution: "Revoke hank.oneill's role-domain-admins grant.",
    },
    s4: {
      nudge: 'One path closed. The question is whether it was the only one.',
      question:
        'If you only fixed the one path you were shown, what would still be true about every other standing admin in the tenant?',
      approach: 'Review every other privileged group for the same one-hop password-reset exposure.',
      solution:
        'Confirm whether any other standing-privilege account is reachable in one hop from a password-reset-capable role. Capture the review as evidence for this step.',
    },
    s5: {
      nudge:
        'This review found one path today by hand. Nothing yet says how the next one gets found.',
      question:
        'A one-time fix closes this path. What closes the next one that shows up after the org chart changes?',
      approach:
        'Write up: the path found, the proof, the fix, and a recommendation for PAM/JIT elevation on all standing privilege plus a recurring path review.',
      solution:
        "Document: dan.rivera -> password reset -> hank.oneill -> standing domain-admin was a real, one-hop path; fixed by revoking Hank's standing privilege; recommend PAM/JIT elevation (lab09) for every standing admin and a recurring, not one-time, attack-path review. Capture it as evidence for this step.",
    },
  },
};

/** Get the hint ladder for a given step in a given lab. Falls back to a generic one. */
export function getHintLadder(labId: string, stepId: string): HintLadder {
  const lab = LADDERS[labId];
  if (lab) {
    const ladder = lab[stepId];
    if (ladder) return ladder;
  }
  return {
    nudge: 'Take a step back. What is the smallest verifiable change you can make right now?',
    question: 'What evidence would tell you the change worked?',
    approach:
      'Look at the objectives for this step. Each one tells you what the system is checking.',
    solution:
      'Walk through the objectives in order. Each one corresponds to a validator that the conductor is watching.',
  };
}

/** Get the hint text for a given level. */
export function getHint(labId: string, stepId: string, level: HintLevel): string {
  const ladder = getHintLadder(labId, stepId);
  switch (level) {
    case 0:
      return ladder.nudge;
    case 1:
      return ladder.question;
    case 2:
      return ladder.approach;
    case 3:
      return ladder.solution;
  }
}
