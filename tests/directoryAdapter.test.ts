/**
 * tests/directoryAdapter.test.ts — the Active Directory window works on both
 * directories: the main VM's (through the capability registry) and DC01's
 * (through the lab engine's own PowerShell, so GUI work is graded like typed work).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Conductor } from '@/conductor/conductor';
import { mkLabId } from '@/domain';
import { conductorAdapter, labStateAdapter } from '@/ui/directory/directoryAdapter';
import { resetWorld, type LabWorld } from '@/vm/adlab/world';
import { applySolution, startingState } from '@/vm/adlab/labs';
import { DOMAIN_DN } from '@/vm/adlab/state';
import { validate } from '@/vm/adlab/validation';

describe('main VM directory', () => {
  let c: Conductor;
  beforeEach(() => {
    c = new Conductor();
    c.start(mkLabId('lab04'));
  });

  it('shows the domain with its standard containers, users and groups in Users', () => {
    const a = conductorAdapter(c);
    expect(a.tree().children.map((x) => x.name)).toEqual(['Builtin', 'Computers', 'Domain Controllers', 'Users']);
    const rows = a.rows('users');
    expect(rows.some((r) => r.kind === 'user')).toBe(true);
    expect(rows.some((r) => r.kind === 'group')).toBe(true);
  });

  it('creates, disables and deletes an account through the registry', () => {
    const a = conductorAdapter(c);
    let notified = 0;
    a.subscribe(() => notified++);
    const r = a.createUser({ first: 'Ada', last: 'Test', logon: 'ada.test', department: 'IT', title: 'Analyst', password: '', mustChange: false, containerId: 'users' });
    expect(r.ok, JSON.stringify(r)).toBe(true);
    expect(c.dir.getUserByUsername('ada.test')).toBeTruthy();
    expect(a.setEnabled('ada.test', false).ok).toBe(true);
    expect(c.dir.getUserByUsername('ada.test')!.status).toBe('disabled');
    expect(a.deleteUser('ada.test').ok).toBe(true);
    expect(c.dir.getUserByUsername('ada.test')).toBeUndefined();
    expect(notified).toBe(3);
  });

  it('says plainly that OUs belong to DC01', () => {
    const r = conductorAdapter(c).createOu({ name: 'Corp', description: '', containerId: 'users' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/DC01/);
  });
});

describe('DC01 directory', () => {
  let world: LabWorld;
  beforeEach(() => {
    world = resetWorld('adl-12');
  });

  it('is empty, with the reason, until DC01 is promoted', () => {
    world.state = startingState('adl-01');
    const a = labStateAdapter(() => world);
    expect(a.unavailable()).toMatch(/not a domain controller/);
    expect(a.tree().children).toEqual([]);
    expect(a.createOu({ name: 'Corp', description: '', containerId: 'none' }).ok).toBe(false);
  });

  it('GUI work runs as PowerShell on DC01 and the lab checks see it', () => {
    const a = labStateAdapter(() => world);
    expect(a.unavailable()).toBeNull();
    const before = world.state.history.length;

    expect(a.createOu({ name: 'Demo', description: 'Demo OU', containerId: DOMAIN_DN }).ok).toBe(true);
    const ouDn = `OU=Demo,${DOMAIN_DN}`;
    expect(a.tree().children.some((x) => x.id === ouDn)).toBe(true);

    const u = a.createUser({ first: 'Priya', last: 'Nair', logon: 'pnair', department: 'Finance', title: 'Analyst', password: 'Correct-Horse-Battery-9!', mustChange: true, containerId: ouDn });
    expect(u.ok, JSON.stringify(u)).toBe(true);
    expect(a.createGroup({ name: 'grp-demo', description: '', scope: 'Global', category: 'Security', containerId: ouDn }).ok).toBe(true);
    expect(a.addMember('pnair', 'grp-demo').ok).toBe(true);

    const rows = a.rows(ouDn);
    expect(rows.find((r) => r.kind === 'user' && r.user.sam === 'pnair')).toBeTruthy();
    expect(rows.find((r) => r.kind === 'group' && r.group.members.includes('pnair'))).toBeTruthy();
    // It is in the shell history, so the instructor and the checks see it as work done.
    expect(world.state.history.length).toBeGreaterThan(before);
    expect(world.state.history.some((h) => /New-ADUser/.test(h.command))).toBe(true);

    expect(a.move('user', 'pnair', `CN=Users,${DOMAIN_DN}`).ok).toBe(true);
    expect(a.rows(`CN=Users,${DOMAIN_DN}`).some((r) => r.kind === 'user' && r.user.sam === 'pnair')).toBe(true);
    expect(a.deleteOu(ouDn).ok).toBe(false); // the group is still inside
    expect(a.deleteGroup('grp-demo').ok).toBe(true);
    expect(a.deleteOu(ouDn).ok).toBe(true);
    expect(a.deleteUser('pnair').ok).toBe(true);
  });

  it('refuses a password the domain policy rejects, with the policy error', () => {
    const a = labStateAdapter(() => world);
    const r = a.createUser({ first: 'Weak', last: 'Pass', logon: 'weak', department: '', title: '', password: 'short', mustChange: false, containerId: `CN=Users,${DOMAIN_DN}` });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/password/i);
  });

  it('the Lab 12 organisation built in the window passes the lab checks', () => {
    const solved = startingState('adl-12');
    applySolution(solved, 'adl-12');
    const report = validate('adl-12', ['org-ou-tree'], { state: solved } as never);
    expect(report.results.every((r) => r.pass)).toBe(true);
  });
});
