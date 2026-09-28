/**
 * tests/portfolioSim.test.ts — the IAM Portfolio VM track on the in-app DC01.
 *
 * For every VM project: the freshly seeded scenario fails the examiner, and
 * the reference work — done with the lab's own commands and files, as a
 * learner would in DC01's PowerShell, ADUC and Notepad — passes every check.
 */
import { describe, it, expect } from 'vitest';
import { runCommand, writeFile } from '@/vm/adlab/commands';
import { DOMAIN_DN, findGroup, findUser, type LabState } from '@/vm/adlab/state';
import { factsFromLabState, portfolioBase, seedScenario } from '@/vm/portfolio/sim';
import { gradeVmProject, VM_PROJECTS, type VmProjectId } from '@/vm/portfolio/vmChecks';

const STAFF = `OU=Tier2_Staff,OU=Enterprise_Root,${DOMAIN_DN}`;
const ROOT = `OU=Enterprise_Root,${DOMAIN_DN}`;
const PW = '(ConvertTo-SecureString "Temp#Passw0rd!2026x" -AsPlainText -Force)';

function sh(s: LabState, ...lines: string[]): void {
  for (const l of lines) {
    const r = runCommand(s, 'DC01', l);
    expect(r.ok, `${l}\n${r.output}`).toBe(true);
  }
}
const file = (s: LabState, path: string, content: string): void => {
  expect(writeFile(s, s.hosts.DC01, path, content, false)).toBeNull();
};
const failing = (s: LabState, p: VmProjectId): string[] =>
  gradeVmProject(p, factsFromLabState(s))
    .filter((r) => !r.pass)
    .map((r) => `${r.id}: ${r.observed}`);

/** A script the least-privilege checker has nothing serious to say about. */
const CLEAN_SCRIPT = (log: string): string =>
  [
    '# Reviewed automation: logs every change and supports a dry run.',
    'param([switch]$WhatIf)',
    `Add-Content -Path ${log} -Value "run started"`,
  ].join('\n');

describe('in-app Portfolio DC01', () => {
  it('builds the enterprise baseline on a promoted DC01', () => {
    const s = portfolioBase();
    expect(s.ad.forest).toBe('corp.technobiz.local');
    expect(findGroup(s, 'GS-HR-Onboarding-RO')).toBeTruthy();
    expect(s.ad.passwordPolicy.minPasswordLength).toBe(14);
    expect(s.hosts.DC01.folders).toContain('c:\\iam');
    expect(s.ntfs['c:\\iam']!.map((a) => a.identity)).toEqual([
      'BUILTIN\\Administrators',
      'NT AUTHORITY\\SYSTEM',
    ]);
    expect(s.history).toEqual([]);
  });

  it('grades an un-seeded project as "set it up first"', () => {
    expect(gradeVmProject('p01', factsFromLabState(portfolioBase()))[0]!.id).toBe('p01-setup');
  });

  it('every VM project seeds, fails as seeded, and never leaves the kit in the learner history', () => {
    for (const p of VM_PROJECTS) {
      const s = portfolioBase();
      expect(seedScenario(s, p)).toMatch(/ready/);
      expect(s.history).toEqual([]);
      expect(failing(s, p).length, p).toBeGreaterThan(0);
    }
  });

  it('p01 JML: joiner, mover, leaver, log and script pass', () => {
    const s = portfolioBase();
    seedScenario(s, 'p01');
    sh(
      s,
      `New-ADUser -Name "Priya Nair" -GivenName Priya -Surname Nair -SamAccountName pnair -Path "OU=Engineering,${STAFF}" -EmployeeID 1001 -Department Engineering -AccountPassword ${PW} -ChangePasswordAtLogon $true -Enabled $true`,
      'Add-ADGroupMember GG-Engineering -Members pnair',
      'Set-ADUser mchen -Department Finance',
      `Move-ADObject -Identity "CN=Michael Chen,OU=Sales,${STAFF}" -TargetPath "OU=Finance,${STAFF}"`,
      'Add-ADGroupMember GG-Finance -Members mchen',
      'Remove-ADGroupMember GG-Sales -Members mchen -Confirm:$false',
      'Disable-ADAccount tbrooks',
      `Set-ADAccountPassword tbrooks -Reset -NewPassword ${PW}`,
      'Remove-ADPrincipalGroupMembership -Identity tbrooks -MemberOf GG-HR,GS-HR-Onboarding-RO -Confirm:$false',
      `Move-ADObject -Identity "CN=Taylor Brooks,OU=HR,${STAFF}" -TargetPath "OU=Terminated Users,${ROOT}"`,
      'Set-Content C:\\IAM\\JML\\jml.log -Value "joiner pnair; mover mchen; leaver tbrooks"',
    );
    file(s, 'C:\\IAM\\JML\\Invoke-JmlPipeline.ps1', CLEAN_SCRIPT('C:\\IAM\\JML\\jml.log'));
    expect(failing(s, 'p01')).toEqual([]);
  });

  it('p02 RBAC: role groups nested to resources, read-only analyst, matrix', () => {
    const s = portfolioBase();
    seedScenario(s, 'p02');
    const g = (n: string): string =>
      `New-ADGroup -Name ${n} -GroupScope Global -Path "OU=Security_Groups,OU=Groups,${ROOT}"`;
    sh(
      s,
      g('Role-Finance-Lead'),
      g('Role-Finance-Analyst'),
      g('Role-Engineering-Developer'),
      g('Role-HR-Specialist'),
      g('Res-Finance-RW'),
      g('Res-Finance-RO'),
      g('App-FinanceLedger-Users'),
      'Add-ADGroupMember Res-Finance-RW -Members Role-Finance-Lead',
      'Add-ADGroupMember App-FinanceLedger-Users -Members Role-Finance-Lead',
      'Add-ADGroupMember Res-Finance-RO -Members Role-Finance-Analyst',
      'Add-ADGroupMember Role-Finance-Lead -Members flead',
      'Add-ADGroupMember Role-Finance-Analyst -Members fanalyst',
      'icacls C:\\Shares\\Finance /grant "CORP\\Res-Finance-RW:(OI)(CI)M"',
      'icacls C:\\Shares\\Finance /grant "CORP\\Res-Finance-RO:(OI)(CI)RX"',
    );
    file(
      s,
      'C:\\IAM\\RBAC\\access-matrix.md',
      '| Role | Group | Permission |\n|---|---|---|\n| Finance Lead | Res-Finance-RW | Modify |\n| Engineering Developer | … | … |\n| HR Specialist | … | … |',
    );
    expect(failing(s, 'p02')).toEqual([]);
  });

  it('p03 access review: remove the flaw only, record the evidence', () => {
    const s = portfolioBase();
    seedScenario(s, 'p03');
    file(
      s,
      'C:\\IAM\\UAR\\requests\\mgr.engineering.txt',
      'Review for mgr.engineering: rlopez in GG-Engineering-Restricted',
    );
    file(s, 'C:\\IAM\\UAR\\decision.txt', 'Reviewer mgr.engineering: DENY rlopez');
    sh(
      s,
      'Remove-ADGroupMember GG-Engineering-Restricted -Members rlopez -Confirm:$false',
      'icacls C:\\Shares\\Engineering /remove CORP\\rlopez',
      'Set-Content C:\\IAM\\UAR\\remediation.log -Value "Removed rlopez from GG-Engineering-Restricted and the share"',
    );
    file(s, 'C:\\IAM\\UAR\\report.md', '# Attestation\nBefore: rlopez had M. After: removed.');
    expect(failing(s, 'p03')).toEqual([]);
  });

  it('p04 stale accounts: remediate the dormant three, spare the exclusions', () => {
    const s = portfolioBase();
    seedScenario(s, 'p04');
    sh(
      s,
      'Search-ADAccount -AccountInactive -TimeSpan 90 -UsersOnly | Export-Csv C:\\IAM\\Stale\\stale.csv',
    );
    for (const u of ['old.contractor1', 'old.contractor2', 'legacy.intern']) {
      const groups = s.ad.groups
        .filter((g) => g.members.includes(u) && g.name !== 'Domain Users')
        .map((g) => g.name);
      sh(
        s,
        `Disable-ADAccount ${u}`,
        `Set-ADAccountPassword ${u} -Reset -NewPassword ${PW}`,
        `Remove-ADPrincipalGroupMembership -Identity ${u} -MemberOf ${groups.join(',')} -Confirm:$false`,
        `Set-Content C:\\IAM\\Queue\\${u}.txt -Value "Remediated ${u}"`,
      );
    }
    file(s, 'C:\\IAM\\Stale\\Remove-StaleAccounts.ps1', CLEAN_SCRIPT('C:\\IAM\\Stale\\stale.log'));
    expect(failing(s, 'p04')).toEqual([]);
    expect(findUser(s, 'svc-backup')!.enabled).toBe(true);
  });

  it('p08 JIT: a two-hour elevation with an approved, logged request', () => {
    const s = portfolioBase();
    seedScenario(s, 'p08');
    sh(
      s,
      'Add-ADGroupMember -Identity "Domain Admins" -Members dkim -MemberTimeToLive (New-TimeSpan -Hours 2)',
      'Add-Content C:\\IAM\\PAM\\elevations.log -Value "CHG-1042 dkim Domain Admins approved by sec.lead for 2 hours"',
    );
    expect(failing(s, 'p08')).toEqual([]);
  });

  it('p10 SIEM: saved queries and alerts for the planted indicators', () => {
    const s = portfolioBase();
    seedScenario(s, 'p10');
    const facts = factsFromLabState(s);
    expect(facts.events.filter((e) => e.id === 4625)).toHaveLength(4);
    file(
      s,
      'C:\\IAM\\SIEM\\queries\\bruteforce.txt',
      "Get-WinEvent -FilterHashtable @{LogName='Security';Id=4625,4624}",
    );
    file(
      s,
      'C:\\IAM\\SIEM\\queries\\groups.txt',
      "Get-WinEvent -FilterHashtable @{LogName='Security';Id=4728}",
    );
    file(
      s,
      'C:\\IAM\\SIEM\\queries\\mfa.kql',
      'AuditLogs | where OperationName has "security info"',
    );
    file(
      s,
      'C:\\IAM\\SIEM\\alerts.csv',
      'siem.victim brute force then success\nsiem.temp added to Domain Admins\n1102 audit log cleared',
    );
    expect(failing(s, 'p10')).toEqual([]);
  });
});
