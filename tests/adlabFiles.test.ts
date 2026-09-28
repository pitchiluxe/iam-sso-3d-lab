/**
 * tests/adlabFiles.test.ts — the engine surface the IAM Portfolio needs:
 * files and scripts on DC01, time-bound (PAM) membership, audit events,
 * user attributes and inactive-account search.
 */
import { describe, it, expect } from 'vitest';
import { expireMemberships, readFile, recordLogon, runCommand } from '@/vm/adlab/commands';
import { startingState } from '@/vm/adlab/labs';
import { findGroup, findUser, type LabState } from '@/vm/adlab/state';

const dc = (): LabState => startingState('adl-11');
const run = (s: LabState, line: string): { output: string; ok: boolean } => runCommand(s, 'DC01', line);

describe('files', () => {
  it('Set-Content, Add-Content, Get-Content and Out-File', () => {
    const s = dc();
    expect(run(s, 'Set-Content -Path C:\\IAM\\a.txt -Value one').ok).toBe(false); // no folder yet
    expect(run(s, 'New-Item -ItemType Directory -Path C:\\IAM').ok).toBe(true);
    expect(run(s, 'Set-Content -Path C:\\IAM\\a.txt -Value one').ok).toBe(true);
    expect(run(s, 'Add-Content C:\\IAM\\a.txt "two words"').ok).toBe(true);
    expect(run(s, 'Get-Content C:\\IAM\\a.txt').output).toBe('one\ntwo words');
    expect(run(s, 'hostname | Out-File C:\\IAM\\host.txt').ok).toBe(true);
    expect(readFile(s.hosts.DC01, 'c:\\iam\\HOST.txt')).toBe(s.hosts.DC01.hostname);
    expect(run(s, 'Get-ChildItem C:\\IAM').output).toMatch(/a\.txt[\s\S]*host\.txt/);
    expect(run(s, 'Test-Path C:\\IAM\\a.txt').output).toBe('True');
    expect(run(s, 'Remove-Item C:\\IAM').ok).toBe(false);
    expect(run(s, 'Remove-Item C:\\IAM -Recurse').ok).toBe(true);
    expect(run(s, 'Test-Path C:\\IAM\\a.txt').output).toBe('False');
  });

  it('Export-Csv writes the users handed down the pipeline', () => {
    const s = dc();
    run(s, 'mkdir C:\\IAM');
    expect(run(s, 'Get-ADUser -Filter * | Export-Csv C:\\IAM\\users.csv -NoTypeInformation').ok).toBe(true);
    const csv = readFile(s.hosts.DC01, 'C:\\IAM\\users.csv')!;
    expect(csv.split('\n')[0]).toContain('"SamAccountName"');
    expect(csv.split('\n').length).toBe(s.ad.users.length + 1);
  });

  it('runs a saved script one cmdlet per line and stops at the first failure', () => {
    const s = dc();
    run(s, 'mkdir C:\\IAM');
    s.hosts.DC01.files = [
      {
        path: 'C:\\IAM\\go.ps1',
        modified: 1,
        content: "<# header #>\nparam([switch]$WhatIf)\n[CmdletBinding(SupportsShouldProcess)]\n$ErrorActionPreference = 'Stop'\n# comment\nmkdir C:\\IAM\\Out\nSet-Content C:\\IAM\\Out\\x.txt -Value hi\nWrite-Host done",
      },
    ];
    const r = run(s, "& 'C:\\IAM\\go.ps1'");
    expect(r.ok).toBe(true);
    expect(r.output).toContain('done');
    expect(readFile(s.hosts.DC01, 'C:\\IAM\\Out\\x.txt')).toBe('hi');
    s.hosts.DC01.files.push({ path: 'C:\\IAM\\loop.ps1', modified: 1, content: 'foreach ($u in $users) { }' });
    expect(run(s, 'powershell -File C:\\IAM\\loop.ps1').output).toMatch(/one cmdlet per line/);
  });
});

describe('PAM and audit', () => {
  it('time-bound membership needs the PAM feature and expires by itself', () => {
    const s = dc();
    const user = s.ad.users.find((u) => u.parent.startsWith('OU='))!.sam;
    const add = `Add-ADGroupMember -Identity "Domain Admins" -Members ${user} -MemberTimeToLive (New-TimeSpan -Hours 2)`;
    expect(run(s, add).output).toMatch(/Privileged Access Management/);
    expect(run(s, `Enable-ADOptionalFeature 'Privileged Access Management Feature' -Scope ForestOrConfigurationSet -Target ${s.ad.forest}`).ok).toBe(true);
    expect(run(s, add).ok).toBe(true);
    const da = findGroup(s, 'Domain Admins')!;
    const exp = da.ttl![user.toLowerCase()]!;
    expect(exp - Date.now()).toBeGreaterThan(7190_000);
    expect(s.events.some((e) => e.id === 4728 && e.data?.memberName === user)).toBe(true);
    expect(run(s, 'Get-ADGroup "Domain Admins" -Properties member -ShowMemberTimeToLive').output).toMatch(/<TTL=\d+>/);
    expireMemberships(s, exp + 1);
    expect(da.members).not.toContain(user);
    expect(s.events.some((e) => e.id === 4729 && e.data?.memberName === user)).toBe(true);
  });

  it('clearing the Security log leaves one 1102; sign-ins log 4624/4625', () => {
    const s = dc();
    const user = s.ad.users.find((u) => u.parent.startsWith('OU='))!;
    recordLogon(s, user.sam, false, '3');
    expect(run(s, 'wevtutil cl Security').ok).toBe(true);
    const sec = s.events.filter((e) => e.host === 'DC01' && e.log === 'Security');
    expect(sec.map((e) => e.id)).toEqual([1102]);
    recordLogon(s, user.sam, true, '3');
    expect(findUser(s, user.sam)!.lastLogon).toBeGreaterThan(0);
    expect(run(s, "Get-WinEvent -FilterHashtable @{LogName='Security';Id=4624,1102}").output).toMatch(/4624[\s\S]*1102/);
  });

  it('user attributes, ManagedBy, principal group removal and inactive search', () => {
    const s = dc();
    run(s, 'New-ADGroup -Name GG-Test -GroupScope Global -Path "CN=Users,DC=corp,DC=technobiz,DC=local"');
    const u = s.ad.users.find((x) => x.parent.startsWith('OU='))!;
    expect(run(s, `Set-ADUser ${u.sam} -EmployeeID 1001 -Description "hello"`).ok).toBe(true);
    expect(u.employeeId).toBe('1001');
    expect(run(s, `Set-ADGroup GG-Test -ManagedBy ${u.sam}`).ok).toBe(true);
    expect(findGroup(s, 'GG-Test')!.managedBy).toBe(u.sam);
    run(s, `Add-ADGroupMember GG-Test -Members ${u.sam}`);
    expect(run(s, `Remove-ADPrincipalGroupMembership -Identity ${u.sam} -MemberOf GG-Test -Confirm:$false`).ok).toBe(true);
    expect(findGroup(s, 'GG-Test')!.members).not.toContain(u.sam);
    expect(run(s, 'Search-ADAccount -AccountInactive -TimeSpan 90 -UsersOnly').output).toContain(u.sam);
    recordLogon(s, u.sam, true);
    expect(run(s, 'Search-ADAccount -AccountInactive -TimeSpan 90 -UsersOnly').output).not.toContain(` ${u.sam} `);
  });
});
