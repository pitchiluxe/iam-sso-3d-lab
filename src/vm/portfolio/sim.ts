/**
 * vm/portfolio/sim.ts — the IAM Portfolio's DC01, inside the app.
 *
 * IAM Range runs the portfolio's VM track on a real VirtualBox DC01 through
 * three PowerShell scripts. This is the same track on the in-app DC01:
 *
 *   portfolioBase()     Initialize-PortfolioDC.ps1 — a promoted DC01 with the
 *                       enterprise baseline (tiers, GS- groups, password
 *                       policy, C:\IAM, C:\Shares)
 *   seedScenario()      Portfolio.Scenarios.ps1 — one project's starting point
 *   factsFromLabState() Portfolio.Collector.ps1 — the read-only facts the
 *                       examiner (vmChecks.ts) grades
 *
 * Seeding goes through the lab's own commands, so the directory, ACLs, files
 * and audit events behave exactly as they do when the learner types.
 */
import { expireMemberships, recordLogon, runCommand, writeFile } from '@/vm/adlab/commands';
import { AD_LABS, applySolution, startingState } from '@/vm/adlab/labs';
import { DOMAIN_DN, findGroup, findUser, stamp, type LabState } from '@/vm/adlab/state';
import type { PortfolioFacts, VmProjectId } from './vmChecks';

const ROOT = `OU=Enterprise_Root,${DOMAIN_DN}`;
const STAFF = `OU=Tier2_Staff,${ROOT}`;
const SEC_GROUPS = `OU=Security_Groups,OU=Groups,${ROOT}`;

/** Run seeding commands; a failure is a bug in the scenario, so it throws. */
function sh(s: LabState, line: string): void {
  const r = runCommand(s, 'DC01', line);
  if (!r.ok) throw new Error(`Portfolio setup failed on: ${line}\n${r.output}`);
}

/** A random password that meets the baseline policy (14+, complex). Never shown. */
function randomPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!#%*-_+=';
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('') + 'aA7!';
}

function ensureOu(s: LabState, name: string, path: string): void {
  const dn = `OU=${name},${path}`;
  if (!s.ad.ous.some((o) => o.toLowerCase() === dn.toLowerCase()))
    sh(s, `New-ADOrganizationalUnit -Name "${name}" -Path "${path}"`);
}

function ensureGroup(s: LabState, name: string, description = ''): void {
  if (findGroup(s, name)) return;
  sh(
    s,
    `New-ADGroup -Name "${name}" -GroupScope Global -GroupCategory Security -Path "${SEC_GROUPS}"` +
      (description ? ` -Description "${description}"` : ''),
  );
}

function removeGroupIfExists(s: LabState, name: string): void {
  if (findGroup(s, name)) sh(s, `Remove-ADGroup -Identity "${name}" -Confirm:$false`);
}

function removeUserIfExists(s: LabState, sam: string): void {
  if (findUser(s, sam)) sh(s, `Remove-ADUser -Identity ${sam} -Confirm:$false`);
}

interface LabUser {
  sam: string;
  given: string;
  surname: string;
  path: string;
  department?: string;
  groups?: string[];
  description?: string;
  password?: string;
}

function resetUser(s: LabState, u: LabUser): void {
  removeUserIfExists(s, u.sam);
  const pw = u.password ?? randomPassword();
  sh(
    s,
    `New-ADUser -Name "${u.given} ${u.surname}" -GivenName ${u.given} -Surname ${u.surname} -SamAccountName ${u.sam} ` +
      `-Path "${u.path}" -AccountPassword (ConvertTo-SecureString "${pw}" -AsPlainText -Force) -Enabled $true` +
      (u.department ? ` -Department ${u.department}` : '') +
      (u.description ? ` -Description "${u.description}"` : ''),
  );
  for (const g of u.groups ?? []) sh(s, `Add-ADGroupMember -Identity "${g}" -Members ${u.sam}`);
}

function resetFolder(s: LabState, path: string): void {
  if (s.hosts.DC01.folders.includes(path.toLowerCase())) sh(s, `Remove-Item "${path}" -Recurse`);
  sh(s, `mkdir "${path}"`);
}

function ensureDepartments(s: LabState): void {
  ensureOu(s, 'Tier2_Staff', ROOT);
  for (const d of ['Engineering', 'Sales', 'Finance', 'HR']) {
    ensureOu(s, d, STAFF);
    ensureGroup(s, `GG-${d}`, `${d} department members`);
  }
}

/**
 * The enterprise baseline on a promoted DC01 (Initialize-PortfolioDC.ps1).
 * Idempotent: running it again changes nothing that is already in place.
 */
export function applyBaseline(s: LabState): void {
  ensureOu(s, 'Enterprise_Root', DOMAIN_DN);
  for (const o of ['Tier0_Admins', 'Tier1_Systems', 'Tier2_Staff', 'Groups', 'Disabled_Accounts'])
    ensureOu(s, o, ROOT);
  for (const o of ['Security_Groups', 'Distribution_Groups']) ensureOu(s, o, `OU=Groups,${ROOT}`);
  for (const g of [
    'GS-Finance-Accounting-RW',
    'GS-Engineering-DevOps-Admin',
    'GS-HR-Onboarding-RO',
  ])
    ensureGroup(s, g);
  sh(
    s,
    'Set-ADDefaultDomainPasswordPolicy -Identity corp.technobiz.local -MinPasswordLength 14 -PasswordHistoryCount 24 -MaxPasswordAge "90.00:00:00" -ComplexityEnabled $true -ReversibleEncryptionEnabled $false',
  );
  const fresh = !s.hosts.DC01.folders.includes('c:\\iam');
  for (const p of ['C:\\IAM', 'C:\\IAM\\scenarios', 'C:\\Shares']) sh(s, `mkdir "${p}"`);
  if (fresh) {
    // The learner's work lives in C:\IAM: administrators only.
    sh(s, 'icacls C:\\IAM /inheritance:r');
    sh(s, 'icacls C:\\IAM /grant:r "BUILTIN\\Administrators:(OI)(CI)F"');
    sh(s, 'icacls C:\\IAM /grant:r "NT AUTHORITY\\SYSTEM:(OI)(CI)F"');
  }
}

/**
 * DC01 ready for the portfolio: the AD Enterprise Lab series' finished estate
 * (a promoted DC01 and a joined CLIENT01) plus the baseline. The replay's
 * history is wiped, as a lab's starting point is.
 */
export function portfolioBase(): LabState {
  const last = AD_LABS[AD_LABS.length - 1]!;
  const s = startingState(last.id);
  applySolution(s, last.id);
  applyBaseline(s);
  s.history = [];
  s.events = [];
  return s;
}

const SUMMARY: Record<VmProjectId, string> = {
  p01: 'JML scenario ready: C:\\IAM\\HR\\hr_feed.csv has a joiner (pnair), a mover (mchen) and a leaver (tbrooks).',
  p02: 'RBAC scenario ready: users flead, fanalyst, edev, hspec; folders C:\\Shares\\Finance, Engineering, HR (no grants yet).',
  p03: 'Access review scenario ready: flaw injected (rlopez, Sales, in GG-Engineering-Restricted and on C:\\Shares\\Engineering). Reviewer: mgr.engineering.',
  p04: 'Stale-account scenario ready: dormant old.contractor1, old.contractor2, legacy.intern; active active.user; exclusions svc-backup, bg-admin01.',
  p08: 'JIT scenario ready: PAM feature enabled; dkim (engineer, no admin rights), sec.lead (approver, GG-SecurityLeads).',
  p10: 'SIEM scenario ready: Security log cleared (1102), 4 failed logons then a success for siem.victim, siem.temp added to and removed from Domain Admins.',
};

function writeScenario(s: LabState, id: VmProjectId): void {
  const at = stamp(s);
  (s.scenarios ??= {})[id] = at;
  writeFile(
    s,
    s.hosts.DC01,
    `C:\\IAM\\scenarios\\${id}.json`,
    JSON.stringify({ project: id, seededAt: new Date(at).toISOString() }, null, 2),
    false,
  );
}

/**
 * Set up (or restart) one project's scenario on DC01. Never deletes the
 * learner's files in C:\IAM: grading only counts work done after this.
 * Returns the one-line summary the kit prints.
 */
export function seedScenario(s: LabState, project: VmProjectId): string {
  const historyLength = s.history.length;
  applyBaseline(s);
  switch (project) {
    case 'p01':
      ensureDepartments(s);
      ensureOu(s, 'Terminated Users', ROOT);
      removeUserIfExists(s, 'pnair');
      resetUser(s, {
        sam: 'mchen',
        given: 'Michael',
        surname: 'Chen',
        path: `OU=Sales,${STAFF}`,
        department: 'Sales',
        groups: ['GG-Sales'],
      });
      resetUser(s, {
        sam: 'tbrooks',
        given: 'Taylor',
        surname: 'Brooks',
        path: `OU=HR,${STAFF}`,
        department: 'HR',
        groups: ['GG-HR', 'GS-HR-Onboarding-RO'],
      });
      sh(s, 'mkdir C:\\IAM\\HR');
      sh(s, 'mkdir C:\\IAM\\JML');
      writeFile(
        s,
        s.hosts.DC01,
        'C:\\IAM\\HR\\hr_feed.csv',
        [
          'EmployeeId,FirstName,LastName,Username,Department,Title,Status,Manager',
          '1001,Priya,Nair,pnair,Engineering,Software Engineer,Active,',
          '1002,Michael,Chen,mchen,Finance,Financial Analyst,Active,',
          '1003,Taylor,Brooks,tbrooks,HR,HR Specialist,Terminated,',
        ].join('\n'),
        false,
      );
      break;
    case 'p02':
      ensureDepartments(s);
      for (const g of [...s.ad.groups])
        if (/^(Role-|Res-)/i.test(g.name) || g.name.toLowerCase() === 'app-financeledger-users')
          removeGroupIfExists(s, g.name);
      resetUser(s, {
        sam: 'flead',
        given: 'Farah',
        surname: 'Lead',
        path: `OU=Finance,${STAFF}`,
        department: 'Finance',
      });
      resetUser(s, {
        sam: 'fanalyst',
        given: 'Felix',
        surname: 'Analyst',
        path: `OU=Finance,${STAFF}`,
        department: 'Finance',
      });
      resetUser(s, {
        sam: 'edev',
        given: 'Elena',
        surname: 'Dev',
        path: `OU=Engineering,${STAFF}`,
        department: 'Engineering',
      });
      resetUser(s, {
        sam: 'hspec',
        given: 'Hana',
        surname: 'Spec',
        path: `OU=HR,${STAFF}`,
        department: 'HR',
      });
      for (const f of ['Finance', 'Engineering', 'HR']) resetFolder(s, `C:\\Shares\\${f}`);
      sh(s, 'mkdir C:\\IAM\\RBAC');
      break;
    case 'p03':
      ensureDepartments(s);
      resetUser(s, {
        sam: 'mgr.engineering',
        given: 'Morgan',
        surname: 'Engineering',
        path: `OU=Engineering,${STAFF}`,
        department: 'Engineering',
        description: 'Engineering manager (access reviewer)',
      });
      resetUser(s, {
        sam: 'aeng',
        given: 'Aiden',
        surname: 'Eng',
        path: `OU=Engineering,${STAFF}`,
        department: 'Engineering',
      });
      resetUser(s, {
        sam: 'bdev',
        given: 'Bianca',
        surname: 'Dev',
        path: `OU=Engineering,${STAFF}`,
        department: 'Engineering',
      });
      resetUser(s, {
        sam: 'rlopez',
        given: 'Rosa',
        surname: 'Lopez',
        path: `OU=Sales,${STAFF}`,
        department: 'Sales',
        groups: ['GG-Sales'],
      });
      removeGroupIfExists(s, 'GG-Engineering-Restricted');
      ensureGroup(
        s,
        'GG-Engineering-Restricted',
        'HIGH RISK: restricted Engineering source and designs',
      );
      sh(s, 'Set-ADGroup GG-Engineering-Restricted -ManagedBy mgr.engineering');
      sh(s, 'Add-ADGroupMember GG-Engineering-Restricted -Members aeng, bdev');
      resetFolder(s, 'C:\\Shares\\Engineering');
      sh(s, 'icacls C:\\Shares\\Engineering /grant "CORP\\GG-Engineering-Restricted:(OI)(CI)M"');
      // The injected flaw: a Sales user with restricted Engineering access, twice over.
      sh(s, 'Add-ADGroupMember GG-Engineering-Restricted -Members rlopez');
      sh(s, 'icacls C:\\Shares\\Engineering /grant "CORP\\rlopez:(OI)(CI)M"');
      sh(s, 'mkdir C:\\IAM\\UAR\\requests');
      break;
    case 'p04': {
      ensureDepartments(s);
      ensureOu(s, 'Tier0_Admins', ROOT);
      ensureOu(s, 'Tier1_Systems', ROOT);
      resetUser(s, {
        sam: 'old.contractor1',
        given: 'Old',
        surname: 'Contractor1',
        path: `OU=Sales,${STAFF}`,
        department: 'Sales',
        groups: ['GG-Sales'],
      });
      resetUser(s, {
        sam: 'old.contractor2',
        given: 'Old',
        surname: 'Contractor2',
        path: `OU=Finance,${STAFF}`,
        department: 'Finance',
        groups: ['GG-Finance', 'GS-Finance-Accounting-RW'],
      });
      resetUser(s, {
        sam: 'legacy.intern',
        given: 'Legacy',
        surname: 'Intern',
        path: `OU=HR,${STAFF}`,
        department: 'HR',
        groups: ['GG-HR'],
      });
      resetUser(s, {
        sam: 'svc-backup',
        given: 'Svc',
        surname: 'Backup',
        path: `OU=Tier1_Systems,${ROOT}`,
        description: 'Service account - backup agent (exclude from stale remediation)',
      });
      resetUser(s, {
        sam: 'bg-admin01',
        given: 'BreakGlass',
        surname: 'Admin01',
        path: `OU=Tier0_Admins,${ROOT}`,
        description: 'Break-glass emergency account (exclude; monitor instead)',
      });
      resetUser(s, {
        sam: 'active.user',
        given: 'Active',
        surname: 'User',
        path: `OU=Engineering,${STAFF}`,
        department: 'Engineering',
        groups: ['GG-Engineering'],
      });
      // A real network sign-in, so active.user has a last logon.
      recordLogon(s, 'active.user', true, '3');
      sh(s, 'mkdir C:\\IAM\\Stale');
      sh(s, 'mkdir C:\\IAM\\Queue');
      break;
    }
    case 'p08':
      ensureDepartments(s);
      ensureOu(s, 'Tier0_Admins', ROOT);
      if (!s.ad.pamEnabled)
        sh(
          s,
          "Enable-ADOptionalFeature 'Privileged Access Management Feature' -Scope ForestOrConfigurationSet -Target corp.technobiz.local",
        );
      ensureGroup(s, 'GG-SecurityLeads', 'Security leads who approve privileged elevation');
      resetUser(s, {
        sam: 'dkim',
        given: 'Daniel',
        surname: 'Kim',
        path: `OU=Engineering,${STAFF}`,
        department: 'Engineering',
        groups: ['GG-Engineering'],
      });
      resetUser(s, {
        sam: 'sec.lead',
        given: 'Sasha',
        surname: 'Lead',
        path: `OU=Tier0_Admins,${ROOT}`,
        department: 'Security',
        groups: ['GG-SecurityLeads'],
      });
      sh(s, 'mkdir C:\\IAM\\PAM');
      break;
    case 'p10': {
      resetUser(s, {
        sam: 'siem.temp',
        given: 'Siem',
        surname: 'Temp',
        path: `CN=Users,${DOMAIN_DN}`,
      });
      resetUser(s, {
        sam: 'siem.victim',
        given: 'Siem',
        surname: 'Victim',
        path: `CN=Users,${DOMAIN_DN}`,
      });
      sh(s, 'mkdir C:\\IAM\\SIEM\\queries');
      writeScenario(s, 'p10');
      sh(s, 'wevtutil cl Security'); // -> 1102
      for (let i = 0; i < 4; i++) recordLogon(s, 'siem.victim', false, '3'); // -> 4625 x4
      recordLogon(s, 'siem.victim', true, '3'); // -> 4624
      sh(s, 'Add-ADGroupMember -Identity "Domain Admins" -Members siem.temp'); // -> 4728
      sh(s, 'Remove-ADGroupMember -Identity "Domain Admins" -Members siem.temp -Confirm:$false'); // -> 4729
      s.history.length = historyLength;
      return SUMMARY.p10;
    }
  }
  writeScenario(s, project);
  // The kit's commands are not the learner's: keep their lab memory clean.
  s.history.length = historyLength;
  return SUMMARY[project];
}

const iso = (ms: number | null | undefined): string | null =>
  ms ? new Date(ms).toISOString() : null;

const SKIP_USERS = new Set(['administrator', 'guest', 'krbtgt', 'defaultaccount']);
const INTERESTING = new Set(['siem.victim', 'siem.temp', 'dkim']);
const EVENT_IDS = new Set([1102, 4624, 4625, 4728, 4729, 4732, 4733, 4756, 4757]);
const MEMBERSHIP_IDS = new Set([4728, 4729, 4732, 4733, 4756, 4757]);

/**
 * What Portfolio.Collector.ps1 reads from DC01, from the lab state. Read-only
 * apart from expiring time-bound memberships whose time is up, which the DC
 * would have done anyway.
 */
export function factsFromLabState(s: LabState, now = Date.now()): PortfolioFacts {
  expireMemberships(s, now);
  const dc = s.hosts.DC01;
  const groupNames = new Set(s.ad.groups.map((g) => g.name.toLowerCase()));
  const memberOf = (sam: string): string[] =>
    s.ad.groups
      .filter((g) => g.name.toLowerCase() !== 'domain users' && g.members.includes(sam))
      .map((g) => g.name);

  const acls: PortfolioFacts['acls'] = {};
  for (const f of dc.folders) {
    if (!f.startsWith('c:\\shares\\') || f.slice('c:\\shares\\'.length).includes('\\')) continue;
    acls[f] = (s.ntfs[f] ?? []).map((a) => ({ ...a }));
  }

  return {
    collectedAt: new Date(now).toISOString(),
    domain: s.ad.forest ?? '',
    netbios: s.ad.netbios ?? '',
    scenarios: Object.fromEntries(
      Object.entries(s.scenarios ?? {}).map(([k, v]) => [k, new Date(v).toISOString()]),
    ),
    pamEnabled: !!s.ad.pamEnabled,
    users: s.ad.users
      .filter((u) => !SKIP_USERS.has(u.sam.toLowerCase()))
      .map((u) => ({
        sam: u.sam,
        name: u.name,
        enabled: u.enabled,
        parent: u.parent,
        department: u.department ?? '',
        employeeId: u.employeeId ?? '',
        pwdLastSet: iso(u.pwdLastSet),
        mustChangePassword: u.changePasswordAtLogon,
        lastLogon: iso(u.lastLogon),
        description: u.description ?? '',
        memberOf: memberOf(u.sam),
      })),
    groups: s.ad.groups.map((g) => ({
      name: g.name,
      parent: g.parent,
      scope: g.scope,
      category: g.category,
      managedBy: g.managedBy ?? null,
      members: g.members.map((m) => {
        const exp = g.ttl?.[m.toLowerCase()];
        return {
          name: m,
          type: findUser(s, m)
            ? ('user' as const)
            : groupNames.has(m.toLowerCase())
              ? ('group' as const)
              : ('user' as const),
          ttl: exp ? Math.max(0, Math.round((exp - now) / 1000)) : null,
        };
      }),
    })),
    acls,
    files: (dc.files ?? [])
      .filter((f) => {
        const p = f.path.toLowerCase();
        return p.startsWith('c:\\iam\\') && !p.startsWith('c:\\iam\\scenarios\\');
      })
      .slice(0, 400)
      .map((f) => ({
        path: f.path.toLowerCase(),
        size: f.content.length,
        modified: new Date(f.modified).toISOString(),
        content: f.content,
      })),
    events: s.events
      .filter((e) => e.host === 'DC01' && e.log === 'Security' && EVENT_IDS.has(e.id) && e.time)
      .filter((e) => {
        const who = (e.data?.targetUser ?? '').toLowerCase();
        const member = (e.data?.memberName ?? '').toLowerCase();
        return e.id === 1102 || INTERESTING.has(who) || INTERESTING.has(member);
      })
      .map((e) => ({
        id: e.id,
        time: new Date(e.time!).toISOString(),
        targetUser: e.data?.targetUser ?? '',
        memberName: e.data?.memberName ?? '',
        subjectUser: e.data?.subjectUser ?? '',
        logonType: e.data?.logonType ?? '',
        group: MEMBERSHIP_IDS.has(e.id) ? (e.data?.targetUser ?? null) : null,
      })),
  };
}
