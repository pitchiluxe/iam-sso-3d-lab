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
