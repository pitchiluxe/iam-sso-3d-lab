# Recommended Lab Environment

## Core
- VirtualBox or VMware
- Windows Server 2022/2025
- Windows 11
- Ubuntu Server

## Identity
- Active Directory Domain Services (and the LDAP protocol it exposes — install a tool like `ldapsearch` or Apache Directory Studio to query it directly, not just through the AD GUI)
- DNS
- Kerberos (enabled by default in an AD domain — use `klist` on a domain-joined client to inspect real tickets)
- Keycloak
- Optional: Microsoft Entra ID trial, or an Okta developer tenant — either gives you a second vendor's vocabulary for the same SAML/OIDC concepts Keycloak teaches
- PKI basics: OpenSSL for generating and inspecting test certificates (`openssl x509 -in cert.pem -noout -dates` to check expiry — the single most common real SSO outage)
- FIDO2/WebAuthn: a cheap hardware security key (or a platform authenticator like Windows Hello) if you want hands-on phishing-resistant MFA beyond TOTP

## Testing applications
Use fictional/local applications only. Examples:
- HR Portal
- Finance Portal
- Help Desk Portal
- VPN Portal

## Monitoring
- Windows Event Viewer
- PowerShell
- Linux logs
- Keycloak logs
- Application logs
- A SIEM, even a free/community tier (Splunk Free, or Microsoft Sentinel's trial) — correlating logs across sources by hand in this lab is a preview of what a SIEM automates at scale

## Adjacent concepts worth reading, not installing
These come up in interviews and in the labs' scenarios even though this environment doesn't require standing up the real product:
- **SCIM** — the standard protocol real HR-to-IdP provisioning pipelines use to automate the joiner/mover/leaver work done by hand here.
- **Zero Trust** — the model conditional access policies implement in practice.
- **PAM/PIM tooling** (CyberArk, Microsoft Entra PIM) — the commercial version of this lab's time-boxed elevation workflow.
- **Cloud IAM** (AWS IAM, Entra ID role assignment) — relevant if your target role touches cloud infrastructure alongside on-prem AD.

## Documentation
Maintain:
- Change tickets
- Incident tickets
- Access matrices
- Runbooks
- Architecture diagrams
- Screenshots
- Test evidence

## Safety
This is an isolated training environment. Do not connect intentionally vulnerable configurations to production networks or use real credentials.
