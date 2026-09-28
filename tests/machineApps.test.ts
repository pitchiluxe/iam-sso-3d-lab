/**
 * tests/machineApps.test.ts — the machines' GUI tools issue the same commands a
 * learner would type, so a lab done by clicking is graded like a lab done by typing.
 */
import { describe, it, expect } from 'vitest';
import { ipv4Commands, maskOf, prefixOf } from '@/ui/machines/sharedApps';
import {
  installRolesCommand,
  newScopeCommands,
  promoteCommand,
  authorizeDhcpCommand,
} from '@/ui/machines/dc01Apps';
import { joinDomainCommand, renameCommand } from '@/ui/machines/client01Apps';
import { runOnMachine } from '@/ui/machines/machineCore';
import { AD_LABS, startingState } from '@/vm/adlab/labs';
import { validate } from '@/vm/adlab/validation';
import type { LabWorld } from '@/vm/adlab/world';

const world = (labId: string): LabWorld => ({
  state: startingState(labId),
  labId,
  signedIn: { DC01: true, CLIENT01: true },
});
const checksOf = (labId: string): string[] => AD_LABS.find((l) => l.id === labId)!.checks;

describe('IPv4 dialog → commands', () => {
  it('static address and DNS, from DHCP', () => {
    expect(
      ipv4Commands(
        { dhcp: true, ip: '169.254.1.1' },
        {
          alias: 'Internal',
          mode: 'static',
          ip: '172.16.0.1',
          prefix: 24,
          dnsMode: 'static',
          dns: ['127.0.0.1', ''],
        },
      ),
    ).toEqual([
      'New-NetIPAddress -InterfaceAlias Internal -IPAddress 172.16.0.1 -PrefixLength 24',
      'Set-DnsClientServerAddress -InterfaceAlias Internal -ServerAddresses 127.0.0.1',
    ]);
  });

  it('back to automatic', () => {
    expect(
      ipv4Commands(
        { dhcp: false, ip: '172.16.0.50' },
        { alias: 'Ethernet', mode: 'dhcp', dnsMode: 'auto' },
      ),
    ).toEqual([
      'Set-NetIPInterface -InterfaceAlias Ethernet -Dhcp Enabled',
      'Set-DnsClientServerAddress -InterfaceAlias Ethernet -ResetServerAddresses',
      'ipconfig /renew',
    ]);
  });

  it('changing a static address removes the old one first', () => {
    expect(
      ipv4Commands(
        { dhcp: false, ip: '172.16.0.9' },
        {
          alias: 'Internal',
          mode: 'static',
          ip: '172.16.0.1',
          prefix: 24,
          dnsMode: 'static',
          dns: ['127.0.0.1'],
        },
      )[0],
    ).toBe('Remove-NetIPAddress -InterfaceAlias Internal -IPAddress 172.16.0.9 -Confirm:$false');
  });

  it('refuses an incomplete static address', () => {
    expect(() =>
      ipv4Commands(
        { dhcp: true, ip: null },
        { alias: 'Internal', mode: 'static', dnsMode: 'static', dns: ['1.1.1.1'] },
      ),
    ).toThrow(/IP address/);
  });

  it('mask and prefix convert both ways', () => {
    expect(maskOf(24)).toBe('255.255.255.0');
    expect(prefixOf('255.255.255.0')).toBe(24);
    expect(prefixOf('255.255.0.0')).toBe(16);
  });
});

describe('Server Manager, DHCP and System Properties → commands', () => {
  it('matches the lab solutions', () => {
    expect(installRolesCommand(['AD-Domain-Services'])).toBe(
      'Install-WindowsFeature -Name AD-Domain-Services -IncludeManagementTools',
    );
    expect(promoteCommand('Corp.TechnoBiz.Local', 'corp')).toBe(
      'Install-ADDSForest -DomainName corp.technobiz.local -DomainNetbiosName CORP -InstallDns -Force',
    );
    expect(joinDomainCommand('corp.technobiz.local')).toBe(
      'Add-Computer -DomainName corp.technobiz.local -Credential CORP\\Administrator -Restart',
    );
    expect(renameCommand(' DC01 ')).toBe('Rename-Computer -NewName DC01');
    expect(
      newScopeCommands({
        name: 'TechnoBiz LAN',
        start: '172.16.0.100',
        end: '172.16.0.200',
        mask: '255.255.255.0',
        router: '172.16.0.1',
        dns: '172.16.0.1',
        dnsDomain: 'corp.technobiz.local',
      }),
    ).toEqual([
      'Add-DhcpServerv4Scope -Name "TechnoBiz LAN" -StartRange 172.16.0.100 -EndRange 172.16.0.200 -SubnetMask 255.255.255.0 -State Active',
      'Set-DhcpServerv4OptionValue -ScopeId 172.16.0.0 -Router 172.16.0.1 -DnsServer 172.16.0.1 -DnsDomain corp.technobiz.local',
    ]);
  });
});

describe('labs done through the GUI pass the grader', () => {
  it('Lab 01 — rename DC01, restart, static internal address and DNS', () => {
    const w = world('adl-01');
    const nic = w.state.hosts.DC01.nics.find((n) => n.alias === 'Internal')!;
    const lines = [
      renameCommand('DC01'),
      'Restart-Computer',
      ...ipv4Commands(nic, {
        alias: 'Internal',
        mode: 'static',
        ip: '172.16.0.1',
        prefix: 24,
        dnsMode: 'static',
        dns: ['127.0.0.1'],
      }),
    ];
    for (const l of lines) expect(runOnMachine(w, 'DC01', l).ok, l).toBe(true);
    const report = validate('adl-01', checksOf('adl-01'), { state: w.state });
    expect(report.results.filter((r) => !r.pass).map((r) => r.id)).toEqual([]);
  });

  it('Lab 02 — add AD DS in Server Manager and promote', () => {
    const w = world('adl-02');
    for (const l of [
      installRolesCommand(['AD-Domain-Services']),
      promoteCommand('corp.technobiz.local', 'CORP'),
    ]) {
      expect(runOnMachine(w, 'DC01', l).ok, l).toBe(true);
    }
    const report = validate('adl-02', checksOf('adl-02'), { state: w.state });
    expect(report.results.filter((r) => !r.pass).map((r) => r.id)).toEqual([]);
  });

  it('the DHCP console authorises with the DC’s own name and address', () => {
    const s = startingState('adl-05');
    expect(authorizeDhcpCommand(s)).toBe(
      'Add-DhcpServerInDC -DnsName dc01.corp.technobiz.local -IPAddress 172.16.0.1',
    );
  });
});
