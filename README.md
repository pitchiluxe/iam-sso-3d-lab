# IAM & SSO 3D Lab

A 3D identity-operations office. Walk to a desk, press **E**, and work on the
Northwind workstation VM: tickets, Active Directory, SSO apps, SecOps.

## Inside the main VM

| Desktop icon | What it is |
| --- | --- |
| Active Directory Users and Computers | The directory you work tickets in: Windows-style tree, context menus, property sheets, and the identity snap-ins (credentials, sessions, SSO apps, OAuth, cloud roles, MFA policy, audit log). |
| DC01 — Windows Server 2022 | A lab domain controller opened like a Remote Desktop session: connect, sign in, then its own desktop with Server Manager, Active Directory, DHCP, DNS, Network Connections, PowerShell, Command Prompt, File Explorer and Notepad. |
| CLIENT01 — Windows 11 | The lab workstation: Settings (rename, join the domain, network), PowerShell, Command Prompt, File Explorer and Notepad. Domain users sign in once it has joined. |
| AD Enterprise Lab Series | Eleven labs, from naming DC01 to an enterprise OU/GPO design, graded on DC01 and CLIENT01 with an Ollama instructor (Guided, Coach, Interview, Real-World). |
| IAM Portfolio | Ten IGA / AM / PAM projects with a least-privilege checker and an instructor. The six on-premises projects (JML, RBAC, access review, stale accounts, JIT admin, SIEM) are set up on and graded from DC01. |

Everything runs inside the app — no VirtualBox. DC01 and CLIENT01 share one
lab world: work typed in PowerShell, clicked in Server Manager or saved in
Notepad is the same work everywhere, and survives closing the app. Each AD lab
and the Portfolio keep their own machines; switching sets the current ones
aside and brings them back later, like snapshots.

The lab machines' Administrator password is shown on the Remote Desktop
screen. It is fictional and only opens these simulated machines.

## Development

```bash
npm install
npm run dev        # Vite on http://localhost:5173
npx vitest run     # unit tests
npm run build && npx playwright test   # e2e against vite preview
```
