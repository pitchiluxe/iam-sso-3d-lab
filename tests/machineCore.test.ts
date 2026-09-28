/**
 * tests/machineCore.test.ts — signing in to DC01 and CLIENT01, and knowing
 * which commands restart them.
 */
import { describe, it, expect } from 'vitest';
import { LAB_ADMIN_PASSWORD, restartsMachine, runOnMachine, signIn } from '@/ui/machines/machineCore';
import { applySolution, startingState } from '@/vm/adlab/labs';
import { runCommand } from '@/vm/adlab/commands';
import type { LabWorld } from '@/vm/adlab/world';

const world = (labId: string): LabWorld => ({
  state: startingState(labId),
  labId,
  signedIn: { DC01: false, CLIENT01: false },
});

describe('signing in to the lab machines', () => {
  it('the local Administrator signs in with the lab password, and nothing else does', () => {
    const s = startingState('adl-01');
    expect(signIn(s, 'DC01', 'Administrator', LAB_ADMIN_PASSWORD)).toMatchObject({ ok: true });
    expect(signIn(s, 'DC01', 'Administrator', 'wrong')).toEqual({ ok: false, reason: 'The user name or password is incorrect.' });
    expect(signIn(s, 'DC01', 'jdoe', LAB_ADMIN_PASSWORD).ok).toBe(false);
  });

  it('CORP\\Administrator only works once the machine is in the domain', () => {
    const before = startingState('adl-01');
    const r = signIn(before, 'DC01', 'CORP\\Administrator', LAB_ADMIN_PASSWORD);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/trust relationship/);
    const after = startingState('adl-03');
    expect(signIn(after, 'DC01', 'CORP\\Administrator', LAB_ADMIN_PASSWORD)).toEqual({ ok: true, account: 'CORP\\Administrator' });
  });

  it('a domain user signs in to a joined CLIENT01 with the password an admin gave them', () => {
    const s = startingState('adl-12');
    applySolution(s, 'adl-06');
    if (!s.hosts.CLIENT01.domain) {
      runCommand(s, 'CLIENT01', 'Add-Computer -DomainName corp.technobiz.local -Credential CORP\\Administrator -Restart');
    }
    expect(s.hosts.CLIENT01.domain).toBe('corp.technobiz.local');
    const pw = 'Correct-Horse-Battery-9!';
    expect(runCommand(s, 'DC01', `New-ADUser -Name "Priya Nair" -SamAccountName pnair -AccountPassword (ConvertTo-SecureString "${pw}" -AsPlainText -Force) -Enabled $true`).ok).toBe(true);
    expect(signIn(s, 'CLIENT01', 'CORP\\pnair', pw)).toEqual({ ok: true, account: 'CORP\\pnair' });
    expect(signIn(s, 'CLIENT01', 'pnair', 'nope').ok).toBe(false);
    runCommand(s, 'DC01', 'Disable-ADAccount -Identity pnair');
    const disabled = signIn(s, 'CLIENT01', 'CORP\\pnair', pw);
    expect(disabled.ok).toBe(false);
    if (!disabled.ok) expect(disabled.reason).toMatch(/disabled/);
    expect(signIn(s, 'DC01', 'CORP\\pnair', pw).ok).toBe(false); // users do not sign in to a DC
  });
});

describe('restarts', () => {
  it('knows the commands that restart a machine', () => {
    for (const l of ['Restart-Computer', 'shutdown /r /t 0', 'Add-Computer -DomainName corp.technobiz.local -Restart', 'Install-ADDSForest -DomainName corp.technobiz.local']) {
      expect(restartsMachine(l), l).toBe(true);
    }
    for (const l of ['Rename-Computer -NewName DC01', 'ipconfig /all', 'Get-Service']) expect(restartsMachine(l), l).toBe(false);
  });

  it('a failed command never restarts the machine', () => {
    const w = world('adl-01');
    expect(runOnMachine(w, 'DC01', 'Restart-Computer').restarted).toBe(true);
    expect(runOnMachine(w, 'CLIENT01', 'Add-Computer -DomainName nowhere.local -Restart').restarted).toBe(false);
  });
});
