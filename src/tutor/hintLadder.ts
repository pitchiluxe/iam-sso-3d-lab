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
      nudge: 'Identities are how the directory knows who a person is. What three things does a directory need to know about every person?',
      question: 'If you had to introduce a new employee to the system, what fields would you fill in?',
      approach: 'Use the IAM Console "Provision User" form. Username, display name, and email are the minimum.',
      solution: 'Open the IAM Console, fill in username/display/email/dept/title, click "Create User".',
    },
    s2: {
      nudge: 'Groups are how the directory organizes people. What attributes do they have?',
      question: 'Why might a directory use groups rather than just listing permissions per user?',
      approach: 'Use the IAM Console "Create Group" form. Give it a name and description.',
      solution: 'Type a name like "grp-finance-payroll" in the Create Group form and click the button.',
    },
    s3: {
      nudge: 'Once you have a user and a group, they are not yet related. Where would you connect them?',
      question: 'If a user is in the Finance department, which group should they belong to?',
      approach: 'Use the "Group Membership" form in the IAM Console. Select a user, select a group, click "Add to group".',
      solution: 'In the form below the Groups list, pick a user and a group, then click "Add to group".',
    },
    s4: {
      nudge: 'A policy is a rule the IdP applies before issuing a session. What rule would you want for sensitive accounts?',
      question: 'Should every user be required to use MFA, or only certain roles? Why?',
      approach: 'In the IAM Console "MFA Policy" section, click "Enable MFA enforcement".',
      solution: 'Click the "Enable MFA enforcement" button in the MFA Policy section.',
    },
    s5: {
      nudge: 'How do you know a user can actually sign in?',
      question: 'If you created a user but never signed them in, what would you not know?',
      approach: 'Use the "Verify Authentication" form at the bottom of the IAM Console. Pick a user and click "Sign in (verify)".',
      solution: 'Pick a user from the "Verify Authentication" dropdown and click the Sign in button.',
    },
  },
  lab02: {
    s1: {
      nudge: 'The HR system has asked for a new employee. Where would the ticket be waiting?',
      question: 'Who is the requester on the onboarding ticket, and what access do they need?',
      approach: 'Open the Ticket Console. Resolve the "Onboard Alex Morgan" ticket, then create the user in the IAM Console.',
      solution: 'Ticket Console → resolve the onboarding ticket → IAM Console → create user "alex.morgan" → add to grp-finance-payroll → verify sign-in.',
    },
    s2: {
      nudge: 'A move is two things: add new access, remove old access.',
      question: 'If you only added Jane to Engineering, what would still be wrong?',
      approach: 'Open the IAM Console, use Group Membership: remove Jane from grp-finance-payroll, add her to grp-engineering-dev.',
      solution: 'Remove Jane from grp-finance-payroll (and grp-finance-analysts), add her to grp-engineering-dev.',
    },
    s3: {
      nudge: 'Termination has three parts: disable, revoke, remove.',
      question: 'Why is disabling the account not enough? What else could Bob still do?',
      approach: 'IAM Console → use Group Membership to remove Bob from all groups, then verify sign-in fails.',
      solution: 'Remove Bob from every group. The validator requires sign-in.succeeded for him — once he is out of all groups, sign-in fails.',
    },
  },
  lab03: {
    s1: {
      nudge: 'A role names a set of permissions a job needs. Where would you put "payroll write" so it can be granted together?',
      question: 'If a role is assigned directly to a user instead of a group, what happens to the audit trail when that person changes teams?',
      approach: 'Open the IAM Console → Roles section → Create Role. Name it role-finance-payroll-writer, add permissions payroll:read and payroll:write.',
      solution: 'Create role-finance-payroll-writer with permissions [payroll:read, payroll:write]. Do not assign to users — assign via group membership.',
    },
    s2: {
      nudge: 'Effective roles are what a user can do right now, not what groups they are in. Where would you confirm what Jane can actually do?',
      question: 'If Jane is in the Finance group, does that alone mean she can write to payroll? What else has to be true?',
      approach: 'SecOps Dashboard → Roles tab → search for Jane. Her effective role list should include role-finance-payroll-writer through group membership.',
      solution: 'Open SecOps Dashboard → Roles → search "jane.doe" → confirm role-finance-payroll-writer is listed in her effective roles.',
    },
    s3: {
      nudge: 'Standing privilege means a permission with no end date. Where would you look to see who has permanent access to dangerous actions?',
      question: 'If Bob has role-domain-admin forever, what happens the day his laptop gets stolen?',
      approach: 'SecOps Dashboard → Roles → filter for role-domain-admin → revoke it for Bob. Document the removal in the audit log.',
      solution: 'SecOps → Roles → find role-domain-admin assigned to Bob → Revoke. Confirm via audit log that role.revoke was recorded.',
    },
    s4: {
      nudge: 'A denied action is the proof that least privilege is working. Where would you see it recorded?',
      question: 'If Alex tries to write payroll and is denied, what does that tell you about the access model?',
      approach: 'Have Alex attempt a payroll write action via the Finance Portal. Then read the audit log for the denied event.',
      solution: 'Open Finance Portal as Alex, attempt a payroll write, then read the SecOps Dashboard audit log for the denied entry.',
    },
  },
  lab04: {
    s1: {
      nudge: 'A SAML client trusts the IdP to assert who a user is. What two things does the SAML config need to exchange first?',
      question: 'If the IdP and SP cannot agree on a signing certificate, what happens to the assertion?',
      approach: 'IAM Console → Applications → register Finance Portal as SAML. Set the ACS URL, entity ID, and download the IdP metadata.',
      solution: 'Register Finance Portal as a SAML SP: set ACS URL, entity ID, claim mapping (email + role). Download IdP metadata for the SP team.',
    },
    s2: {
      nudge: 'OIDC is JSON over HTTPS, not XML over browser redirect. Where does the client secret live?',
      question: 'If the OIDC client secret is in source control, who else can impersonate your app?',
      approach: 'IAM Console → Applications → register Help Desk Portal as OIDC. Configure client ID, client secret, redirect URI, and scopes (openid, email, profile).',
      solution: 'Register Help Desk Portal as OIDC: client_id, client_secret (store in vault), redirect_uri, scopes openid+email+profile.',
    },
    s3: {
      nudge: 'A claim is what the IdP tells the SP about the user. Where do you decide what gets sent?',
      question: 'If role is sent as a free-text string, can the SP trust it without a mapping document?',
      approach: 'IAM Console → Applications → Finance Portal → Claims → map the role claim to the user\'s effective roles array. Save and publish.',
      solution: 'Open Finance Portal config → Claims → set role claim to user.effectiveRoles. Save. Repeat for Help Desk Portal.',
    },
    s4: {
      nudge: 'SSO works end-to-end or it does not. Where is the proof of working SSO?',
      question: 'If the SAML assertion is valid but the role claim is empty, what does the user see?',
      approach: 'Sign in to both Finance Portal and Help Desk Portal. Confirm role claims are present in the sessions. Capture audit logs.',
      solution: 'Use Verify Sign-in for both portals. Confirm the audit log shows signin.succeeded with the right portal ID and role claim.',
    },
  },
  lab05: {
    s1: {
      nudge: 'MFA for privileged roles means anyone in those roles must use a second factor. Where do you enforce that?',
      question: 'If you enable MFA for everyone at once, what happens to your help desk ticket queue?',
      approach: 'IAM Console → MFA Policy → set requireMfa = true. Start with a group-based rollout: enable for the iam-admins group first.',
      solution: 'IAM Console → MFA Policy → Enable MFA enforcement → apply only to grp-iam-admins for now (phased rollout).',
    },
    s2: {
      nudge: 'TOTP is a 6-digit code that changes every 30 seconds. How does the user enroll?',
      question: 'If the user loses their phone, what is the recovery path?',
      approach: 'IAM Console → Users → Erin Cho → MFA → enroll TOTP. Erin scans the QR code with her authenticator app and confirms with a 6-digit code.',
      solution: 'Open Erin\'s user record → Enroll TOTP → scan QR → enter 6-digit code → confirm. Test by signing in as Erin.',
    },
    s3: {
      nudge: 'A prompt loop means the system keeps asking for a factor it cannot verify. Where do you look?',
      question: 'If the user enters the right code but the system rejects it, what is mismatched — the secret, the clock, or the algorithm?',
      approach: 'SecOps Dashboard → Audit Log → filter for Erin → look for repeated mfa.challenge.completed with failure. Check the time sync on the IdP.',
      solution: 'Open audit log for Erin → find the repeating MFA challenge failures → re-sync the IdP clock → re-enroll Erin\'s TOTP secret.',
    },
    s4: {
      nudge: 'A conditional access policy adds rules on top of authentication. Where do those rules live?',
      question: 'If you block all foreign sign-ins, what about a user who is traveling?',
      approach: 'IAM Console → Conditional Access → New Policy → "Block foreign sign-ins" → save. Test with a simulated foreign IP.',
      solution: 'IAM Console → Conditional Access → Create Policy CA-001: condition = country != US, effect = block. Test with a foreign IP mock.',
    },
  },
  lab06: {
    s1: {
      nudge: 'A dormant account has not signed in for a long time. How do you find them?',
      question: 'If a user has not signed in for 90 days, should they still be active?',
      approach: 'SecOps Dashboard → Access Reviews → Run dormant-account query (lastSignInAt > 90 days ago). Export the list.',
      solution: 'SecOps → Access Reviews → Query: lastSignInAt < now-90d → Export. Review each row manually.',
    },
    s2: {
      nudge: 'Excessive memberships mean a user has more groups than their role needs. How do you find them?',
      question: 'If an engineer is in 12 groups but only needs 3, where did the other 9 come from?',
      approach: 'SecOps → Users → filter groupCount > 5. Open each user, review their groups, and mark the unnecessary ones for removal.',
      solution: 'SecOps → Users → sort by group count → for each user over 5 groups, identify which groups do not match their department/title.',
    },
    s3: {
      nudge: 'A review decision is keep, remove, or remediate. What evidence do you record?',
      question: 'If you keep a permission, can you explain why in one sentence?',
      approach: 'For each flagged user/group, open the review record and pick one of: keep (justified), remove (action), or remediate (with note). Save the decision.',
      solution: 'For each row in the access review queue, pick an action (keep/remove/remediate), write one sentence, save. Aim for 8 decisions.',
    },
    s4: {
      nudge: 'A campaign summary is what auditors read. What three things must it contain?',
      question: 'If an auditor asks "who approved this access", where is the answer?',
      approach: 'Access Reviews → Campaign → Close. Generate summary: total decisions, removals executed, exceptions retained with justifications.',
      solution: 'Close the campaign → export summary (PDF/JSON). Verify it shows reviewer name, decision count, and removal audit IDs.',
    },
  },
  lab07: {
    s1: {
      nudge: 'An incident is an unplanned disruption. Where do you record the symptoms first?',
      question: 'If you skip the incident record and go straight to fixing, what can you not reconstruct later?',
      approach: 'Ticket Console → open new incident → record: time, user impact, error message, scope. Mark severity.',
      solution: 'Ticket Console → New Incident → "SSO outage: Finance Portal returns 500 on /saml/acs" → severity=high → save.',
    },
    s2: {
      nudge: 'Triage means ruling out the cheap causes first. What is the cheapest?',
      question: 'If you skip DNS and go straight to certificate rotation, what could you have missed in 30 seconds?',
      approach: 'SecOps Dashboard → IdP health → DNS lookup → certificate expiry → clock skew. Document each finding in the incident record.',
      solution: 'Triage order: DNS (dig +short), certificate expiry (openssl s_client), IdP time skew (date vs NTP), recent config diffs.',
    },
    s3: {
      nudge: 'The fix has to match the root cause, not the symptom. Where do you confirm the root cause?',
      question: 'If users get 500 on /saml/acs, is the SAML config the cause, or is the IdP signing the wrong key?',
      approach: 'Open the failing app\'s SAML config in the IAM Console. Compare the certificate fingerprint against the IdP\'s current signing cert.',
      solution: 'IAM Console → Applications → Finance Portal → SAML → re-upload the correct IdP signing certificate. Save.',
    },
    s4: {
      nudge: 'A retest proves the fix worked. What log entries confirm that?',
      question: 'If the app returns 200, but the audit log shows no signin.succeeded, what is still wrong?',
      approach: 'Sign in via the broken portal as a test user. Confirm audit log shows signin.succeeded and the assertion was valid.',
      solution: 'Re-run Verify Authentication for the test user. Capture the audit log line and attach to the incident as evidence.',
    },
  },
  lab08: {
    s1: {
      nudge: 'A suspicious sign-in is an alert you cannot ignore. What is the first thing you record?',
      question: 'If you skip the alert ID and start containing, how do you reference this incident later?',
      approach: 'Ticket Console → open alert SUP-204 → record: alert ID, time, source IP, geo, user, failed MFA attempts. Mark severity=critical.',
      solution: 'Open SUP-204 → copy alert ID → record 5 Ws (who/what/when/where/why) → severity=critical → assign to yourself.',
    },
    s2: {
      nudge: 'Containment stops the bleeding. What three actions do you take first?',
      question: 'If Jane\'s account is compromised but you only reset her password, what is still open?',
      approach: 'IAM Console → Jane → Disable. SecOps → Sessions → Revoke all sessions for Jane. Note the time of containment in the incident.',
      solution: 'Disable Jane, revoke all her active sessions, rotate her password. Capture the audit log entries as evidence.',
    },
    s3: {
      nudge: 'A compromised account usually has siblings. Where do you look for related activity?',
      question: 'If the attacker used Jane\'s credentials, what other accounts share her password or device?',
      approach: 'SecOps → Audit Log → filter by Jane\'s IP, device, and last 7 days. Flag any other users with the same fingerprint.',
      solution: 'Audit log query: same source IP OR same device fingerprint, last 7d. Open each result, decide if it is also compromised.',
    },
    s4: {
      nudge: 'An incident report is read by management, legal, and auditors. What structure do they expect?',
      question: 'If the report omits the timeline, how does legal know what to disclose?',
      approach: 'Use the incident report template: summary, timeline (UTC), scope (accounts/data affected), containment, eradication, recovery, lessons learned.',
      solution: 'Write the report in 6 sections: summary, timeline, scope, containment, eradication, lessons learned. Attach audit log excerpts.',
    },
    s5: {
      nudge: 'Closing an incident means the system is back to normal and the report is filed. What else?',
      question: 'If you close the incident without scheduling a post-mortem, what improvement never happens?',
      approach: 'Ticket Console → close incident → schedule post-mortem (calendar invite) → file report in the incident archive.',
      solution: 'Close the ticket, attach the report, set status=resolved, schedule a 30-min post-mortem with the on-call team.',
    },
  },
  lab09: {
    s1: {
      nudge: 'Standing privilege is a permanent grant. Where is the most dangerous one?',
      question: 'If Hank has domain admin forever, what is the blast radius of his laptop being stolen?',
      approach: 'SecOps → Roles → filter for role-domain-admin. The first row should be Hank. Document the risk in the incident record.',
      solution: 'Open SecOps → Roles → sort by grants → identify Hank with role-domain-admin. Note the grant date and any audit hits.',
    },
    s2: {
      nudge: 'Removing standing privilege is a deliberate act. What do you replace it with?',
      question: 'If you only revoke, what does Hank do when he actually needs admin?',
      approach: 'IAM Console → Hank → Roles → revoke role-domain-admin. Replace with a workflow-based elevation request (PIM).',
      solution: 'Revoke role-domain-admin for Hank. Add him to grp-iam-admins-eligible (not the active group) so he can request elevation.',
    },
    s3: {
      nudge: 'Elevation is a request, not a grant. Where do you submit it?',
      question: 'If elevation takes 5 minutes, will Hank still take the shortcut?',
      approach: 'Ticket Console → new request → type=elevation → role=domain-admin → duration=1h → justification. Submit and wait for approval.',
      solution: 'Open Ticket Console → New Request → PIM elevation → role=domain-admin → 1h → reason="incident response" → submit.',
    },
    s4: {
      nudge: 'An elevated role must auto-revoke. Where do you confirm the timer ran?',
      question: 'If the timer does not run, what happens the next day?',
      approach: 'After performing the admin action, wait for the timer. Check the audit log for role.revoke at the expected time.',
      solution: 'Watch the audit log. At the 1-hour mark, confirm role.revoke for Hank. If it does not appear, file a fault.',
    },
    s5: {
      nudge: 'A PAM policy is the written rule. Where does it live?',
      question: 'If the policy is in a Slack message, who can enforce it on day 100?',
      approach: 'Document the PAM policy in a markdown file: scope, eligible users, elevation SLA, max duration, audit requirements, exceptions.',
      solution: 'Write PAM-policy.md with sections: scope, eligible users, elevation SLA, max 1h, audit required, break-glass exception. Commit to repo.',
    },
  },
  lab10: {
    s1: {
      nudge: 'Onboarding 5 people at once means you need a repeatable pattern. What is the smallest repeatable unit?',
      question: 'If you onboard each person with a different set of groups, what does the audit log look like next quarter?',
      approach: 'Create each user, assign them to a department group by template, do not enable MFA yet. Use the same naming convention for all 5.',
      solution: 'For each of the 5 new hires: Create User → Add to grp-<dept>-<role> by template → sign-in verify. Same workflow for all 5.',
    },
    s2: {
      nudge: 'A move is two operations: add new access, remove old access. Which do you do first?',
      question: 'If you only add the new group, what old access is still open?',
      approach: 'For each mover, identify the new group and the old group(s). Remove from old first, then add to new. Verify the audit log shows both.',
      solution: 'For each mover: remove from old department group(s) → add to new department group → confirm audit log shows group.remove and group.add.',
    },
    s3: {
      nudge: 'Termination is the most-tested step. What three things must happen?',
      question: 'If you only disable the account, what sessions are still open?',
      approach: 'Disable Bob, revoke all his sessions, remove him from all groups, and verify sign-in fails. Capture every audit entry.',
      solution: 'IAM Console → Bob → Disable → SecOps → Revoke all sessions → IAM Console → Group Membership → remove from every group → Verify sign-in fails.',
    },
    s4: {
      nudge: 'Integrating two apps with two different protocols is two problems, not one. Where is the cleanest place to start?',
      question: 'If you configure SAML and OIDC in parallel, which error wins?',
      approach: 'Configure Finance Portal (SAML) first. Verify end-to-end. Then configure Help Desk Portal (OIDC). Verify separately.',
      solution: 'SAML Finance Portal: register, set ACS, map role claim, verify sign-in. THEN OIDC Help Desk: register, set client secret, map scope, verify.',
    },
    s5: {
      nudge: 'Enforcing MFA for privileged roles is a phased rollout. Who is first?',
      question: 'If you enable MFA for everyone at once, who calls the help desk?',
      approach: 'Enable MFA enforcement for grp-iam-admins first. Watch the audit log. Then expand to grp-finance-payroll, grp-engineering-dev, etc.',
      solution: 'IAM Console → MFA Policy → enable for grp-iam-admins only → monitor 24h → expand to grp-finance-payroll and grp-engineering-dev.',
    },
    s6: {
      nudge: 'A capstone access review covers all 5 onboarding groups. How do you know nothing is stale?',
      question: 'If you skip the review, what was the point of onboarding the right people?',
      approach: 'Run dormant-account query (90d) and excessive-membership query (>5 groups). Record keep/remove decisions for 8 items.',
      solution: 'SecOps → Access Reviews → run both queries → for 8 flagged items, record decision (keep/remove/remediate) with one-sentence justification.',
    },
    s7: {
      nudge: 'The capstone SSO break/fix is a fresh fault. What is the first thing you do?',
      question: 'If you skip triage, what cheap cause might you miss?',
      approach: 'Open the incident. Triage in order: DNS, certificate, clock skew, config diff. Identify root cause. Apply fix. Retest.',
      solution: 'Incident → triage (DNS/cert/time/diff) → root cause identified → fix applied → retest with sign-in → attach audit log evidence.',
    },
    s8: {
      nudge: 'The capstone incident combines alert triage, containment, search, and reporting. What is the order?',
      question: 'If you skip containment and start searching, what is the attacker still doing?',
      approach: 'Triage the alert → disable the compromised account → revoke sessions → search for related activity → write the report → close.',
      solution: 'Alert → disable + revoke → audit-log search for related activity → 6-section incident report → close ticket with evidence.',
    },
    s9: {
      nudge: 'A capstone audit report covers what you did and why. What three sections are mandatory?',
      question: 'If the report is just a screenshot, what is an auditor supposed to do with it?',
      approach: 'Write the report: executive summary (1 paragraph), detailed findings (per lab), evidence index (audit log IDs and screenshots).',
      solution: 'audit-report.md: exec summary → findings per lab (objectives, status, evidence IDs) → evidence index → sign-off section.',
    },
  },
  lab11: {
    s1: {
      nudge: 'Conditional access is rules on top of authentication. What is the inventory of methods you are protecting?',
      question: 'If you do not know what auth methods exist, how do you write a policy that covers them?',
      approach: 'SecOps → Authentication Methods → list all enabled methods (password, TOTP, SMS, FIDO2, legacy). Note the gap.',
      solution: 'Open SecOps → Auth Methods. Document which are enabled, which are legacy, which are MFA, which are FIDO2.',
    },
    s2: {
      nudge: 'A policy that blocks legacy auth has to know what legacy looks like. Where is the list?',
      question: 'If you block basic auth and your printer relies on it, what breaks?',
      approach: 'IAM Console → Conditional Access → New Policy → name CA-001 → condition: auth method = basic auth → effect: block. Save.',
      solution: 'Create CA-001: condition=basic auth, effect=block. Test with a basic-auth client. Confirm the audit log shows block.',
    },
    s3: {
      nudge: 'MFA for privileged roles is the same rule we set in lab05, but now it is a CA policy, not an IdP setting. Why?',
      question: 'If MFA is enforced in two places, which one wins?',
      approach: 'IAM Console → CA → New Policy CA-002: condition=role in [domain-admin, security-admin], effect=require MFA. Save. Test as Hank.',
      solution: 'Create CA-002: condition=role ∈ {domain-admin, security-admin}, effect=require MFA. Sign in as Hank, confirm MFA prompt.',
    },
    s4: {
      nudge: 'A simulation proves the block works. Where do you run it?',
      question: 'If the test is in production, what did you just take down?',
      approach: 'Use the SecOps test harness: simulate a basic-auth sign-in from a non-named location. Confirm the block in the audit log.',
      solution: 'SecOps → CA Test → basic-auth + foreign IP → expect block. Confirm audit log entry for the denied event.',
    },
    s5: {
      nudge: 'A named location exception is a hole in a rule. How do you make it auditable?',
      question: 'If a corporate VPN is whitelisted, who watches the watchers?',
      approach: 'IAM Console → Named Locations → add "HQ office IP range". CA-001 → add exception: if location = HQ, allow legacy.',
      solution: 'Named Locations → add HQ CIDR. CA-001 → add exception: location=HQ, effect=allow. Document the exception in the CA policy doc.',
    },
    s6: {
      nudge: 'A CA policy design document is what auditors ask for. What four sections?',
      question: 'If the policy lives only in the console, who can read it without an admin login?',
      approach: 'Write ca-policy.md: scope, policy list (CA-001/002/...), exception list, audit cadence (weekly review of CA hits).',
      solution: 'ca-policy.md: scope → policy list with conditions/effects → named location exceptions → audit cadence. Commit to docs repo.',
    },
  },
  lab12: {
    s1: {
      nudge: 'A hybrid identity starts with on-prem users. Where do they live before sync?',
      question: 'If on-prem users are not in a known OU, how does the sync agent find them?',
      approach: 'Open the on-prem AD seed (mock). Confirm users are in OU=Employees. Note the UPN suffix for the cloud domain.',
      solution: 'On-prem AD → Users container → confirm UPN = user@northwind.onmicrosoft.com. Note the OU for sync scope.',
    },
    s2: {
      nudge: 'A sync agent sits between on-prem and cloud. Where is it installed?',
      question: 'If the agent is on a domain controller, what does a compromise of the DC compromise?',
      approach: 'Install the sync agent on a dedicated member server (not a DC). Register it with the cloud tenant. Note the service account.',
      solution: 'Member server sync-01 → install agent → register with tenant → service account = svc-sync (least privilege).',
    },
    s3: {
      nudge: 'Password hash sync is one of three auth methods. What does it actually sync?',
      question: 'If you enable PHS, do you still need ADFS?',
      approach: 'Cloud tenant → Hybrid Identity → Password Hash Sync → enable. Wait for initial sync. Test sign-in as a synced user.',
      solution: 'Enable PHS in the cloud tenant. Wait for first sync cycle. Sign in as a synced user with their on-prem password.',
    },
    s4: {
      nudge: 'The initial sync has to succeed end-to-end. What is the success signal?',
      question: 'If the agent reports success but the cloud user has no group memberships, what is wrong?',
      approach: 'Run sync. Check the agent log for the cycle result. Open the cloud user, confirm group memberships are present.',
      solution: 'Run delta sync. Verify in cloud: user exists, UPN matches, all groups from the on-prem filter are present. Capture the agent log.',
    },
    s5: {
      nudge: 'JML is joiner, mover, leaver. In sync, what does each look like?',
      question: 'If a mover does not sync, where do you look — on-prem, the agent, or the cloud?',
      approach: 'On the on-prem side, change a user\'s group membership. Trigger a delta sync. Verify the cloud user reflects the change.',
      solution: 'On-prem: change group. Cloud: trigger delta. Cloud user: confirm new group. Audit log: confirm group.add on the cloud side.',
    },
    s6: {
      nudge: 'A soft-match conflict is two users in the cloud with similar attributes. How do you resolve it?',
      question: 'If you merge the wrong pair, what do you just deleted?',
      approach: 'Identify the on-prem user and the soft-matched cloud user. Use ImmutableID to hard-match. Verify the merge in the audit log.',
      solution: 'Cloud → soft-matched user → set ImmutableID = on-prem objectGUID. Re-run sync. Confirm one user remains, others archived.',
    },
    s7: {
      nudge: 'A sync topology document is what you hand to ops. What four sections?',
      question: 'If the doc is missing the DR plan, what happens when the agent host fails?',
      approach: 'hybrid-sync.md: topology diagram, agent hosts, sync schedule, DR plan (standby agent, manual export fallback).',
      solution: 'hybrid-sync.md: topology, agent hosts, schedule, DR (standby sync-02 + manual CSV export fallback). Commit to docs repo.',
    },
  },
  lab13: {
    s1: {
      nudge: 'A break-glass account is for emergencies. What does the policy say about who owns it?',
      question: 'If one person knows the break-glass password, what happens when they leave?',
      approach: 'Write the break-glass policy: 2 accounts, no individual owner, sealed envelope in a safe, alert on any use, quarterly review.',
      solution: 'break-glass-policy.md: 2 accounts (bg-admin-1, bg-admin-2), no individual owner, sealed in safe, real-time alert on use, quarterly review.',
    },
    s2: {
      nudge: 'Creating break-glass account 1 is just a special user. What is special?',
      question: 'If the account is subject to MFA, what happens if your IdP is down?',
      approach: 'IAM Console → Create User bg-admin-1 → assign grp-iam-admins → set a 32-char random password → store in sealed envelope.',
      solution: 'Create bg-admin-1 with grp-iam-admins, very long password, store in sealed envelope in safe A. No MFA on this account.',
    },
    s3: {
      nudge: 'Two break-glass accounts means two independent operators. Why two?',
      question: 'If both accounts use the same password, what is the single point of failure?',
      approach: 'Create bg-admin-2 with the same group but a different password, stored in safe B (different physical location and custodian).',
      solution: 'Create bg-admin-2 (different password, different custodian, different safe). Document the two-person rule for any use.',
    },
    s4: {
      nudge: 'Break-glass accounts must bypass CA policies. Why?',
      question: 'If break-glass is blocked by a CA policy, what did you just remove?',
      approach: 'IAM Console → Conditional Access → each policy → add bg-admin-1 and bg-admin-2 to the exclude list. Save. Test.',
      solution: 'For each CA policy, add bg-admin-1 and bg-admin-2 to the exclude list. Sign in as bg-admin-1, confirm no CA prompt.',
    },
    s5: {
      nudge: 'A real-time alert on break-glass use is what wakes the on-call. What does the alert contain?',
      question: 'If the alert only says "user signed in", what is the on-call supposed to do at 3am?',
      approach: 'Wire an alert: trigger = bg-admin sign-in, payload = user, source IP, geo, time, runbook link. Send to PagerDuty or email.',
      solution: 'SecOps → Alerts → New Rule: trigger=break-glass sign-in, payload=user+IP+geo+runbook URL, channel=PagerDuty/email. Test it.',
    },
    s6: {
      nudge: 'A quarterly review on break-glass verifies the accounts still work. How?',
      question: 'If you test by signing in, you trigger the alert. How do you test without alarming?',
      approach: 'Run a credential-only test: attempt sign-in from the break-glass IP, fail fast, confirm the alert fires (acknowledge in test mode).',
      solution: 'Quarterly: read-only test of the credential (no full sign-in). Document test result. Rotate passwords if compromised or >180 days old.',
    },
    s7: {
      nudge: 'A recovery flow test proves the whole chain works. What does it cover?',
      question: 'If you never test, the first real use is also the first test. What could go wrong?',
      approach: 'Schedule a planned recovery test: take IdP offline, sign in as bg-admin-1, perform one admin action, restore IdP, audit.',
      solution: 'Planned test window → disable IdP sign-in for non-bg users → sign in as bg-admin-1 → restore IdP → audit log review → post-mortem.',
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
    approach: 'Look at the objectives for this step. Each one tells you what the system is checking.',
    solution: 'Walk through the objectives in order. Each one corresponds to a validator that the conductor is watching.',
  };
}

/** Get the hint text for a given level. */
export function getHint(labId: string, stepId: string, level: HintLevel): string {
  const ladder = getHintLadder(labId, stepId);
  switch (level) {
    case 0: return ladder.nudge;
    case 1: return ladder.question;
    case 2: return ladder.approach;
    case 3: return ladder.solution;
  }
}
