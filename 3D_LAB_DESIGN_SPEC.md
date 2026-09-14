# 3D Lab Design Specification

## Purpose
Turn each workflow into an interactive enterprise simulation rather than a static tutorial.

## 3D zones
- Reception
- HR
- Help Desk
- IAM/Security Operations
- Server Room
- Network Operations
- Finance
- Engineering
- Application Center
- Executive/Management area

## Interactive stations
### IAM Console
Shows identities, groups, roles, status, MFA, and audit history.

### Ticket Console
Generates realistic requests such as onboarding, access requests, password/MFA issues, transfers, and terminations.

### Server Room
Contains Domain Controller, DNS, IdP, database, and application servers.

### Application Center
Contains SAML/OIDC-enabled fictional business applications.

### Security Operations
Displays authentication logs, alerts, access-review queues, and incident tickets.

## Gamification
Each lab should include:
- Mission briefing
- Objectives
- Starting state
- Interactive tasks
- Randomized incidents
- Validation checkpoints
- Evidence collection
- Score
- Hints
- Debrief

## AI tutor behavior
The AI tutor should:
- Ask diagnostic questions.
- Explain concepts when requested.
- Give progressively stronger hints.
- Never immediately provide the final fix.
- Evaluate the learner's reasoning.
- Generate new incident variations.
- Conduct mock interview questions.

## Scoring
100 points:
- 25 technical execution
- 20 troubleshooting
- 15 security/least privilege
- 15 documentation
- 15 evidence/verification
- 10 communication

A score of 85+ with successful capstone completion is the target for job-readiness.
