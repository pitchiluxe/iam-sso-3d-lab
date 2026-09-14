# IAM & SSO 3D Real-World Lab Program

## Goal
Build hands-on experience that mirrors enterprise Identity and Access Management (IAM) and Single Sign-On (SSO) operations.

The labs are designed as a progressive 3D virtual enterprise environment. The learner acts as an IAM/IT support engineer and performs identity lifecycle, authentication, authorization, SSO, MFA, access reviews, troubleshooting, and incident-response tasks.

## Recommended lab stack
- Hypervisor: VirtualBox or VMware
- Windows Server 2022/2025: Active Directory Domain Services (AD DS), DNS, Group Policy
- Windows 11 client
- Ubuntu Server
- Keycloak (open-source identity provider)
- Optional: Microsoft Entra ID trial for cloud IAM concepts
- Browser-based 3D lab UI representing users, servers, applications, identity systems, tickets, logs, and network zones
- Git for change tracking and documentation

## Enterprise topology
Internet/DMZ
  |
Identity Provider / SSO
  |
Directory Services ---- DNS
  |                      |
Windows Clients       Linux Server
  |
Business Applications
  |-- HR Portal
  |-- Finance Portal
  |-- Help Desk
  |-- VPN Portal
  |-- Admin Console

## Lab rules
1. Use only your isolated lab environment.
2. Create realistic but fictional users and organizations.
3. Never use real credentials or production accounts.
4. Document every privileged change.
5. Prefer least privilege and MFA.
6. Break/fix scenarios should be reversible and documented.
7. The AI tutor may explain concepts and provide hints, but should not simply reveal the answer.
