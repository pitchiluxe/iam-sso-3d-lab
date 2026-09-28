/**
 * ui/directory/directoryAdapter.ts — one Active Directory window, two directories.
 *
 * The Active Directory Users and Computers view is IAM Range's, and it is used
 * twice: on the main VM, over the lab's northwind.example directory, and on
 * DC01, over the AD Enterprise Lab's corp.technobiz.local. The two directories
 * are different models, so the view talks to this interface instead of either.
 *
 * Each adapter changes its directory the way that directory's own tools do:
 * the main VM through the capability registry (the same calls the IAM Console
 * and the terminal make), DC01 by running the equivalent PowerShell through the
 * lab engine. On DC01 that means clicking New User in the window leaves the
 * same trail, and is graded the same way, as typing New-ADUser.
 */
import type { Conductor } from '@/conductor/conductor';
import type { Group, User, UserId } from '@/domain';
import { CAPABILITY_BY_ID, type CapabilityContext } from '@/services';
import { COMPANY, DEPARTMENTS } from '@/config';
import { DOMAIN_DN, dcIsPromoted, type AdUser, type AdGroup } from '@/vm/adlab/state';
import { runOn, onWorldChanged, type LabWorld } from '@/vm/adlab/world';

export type Result = { ok: true; message: string } | { ok: false; error: string };

export interface AdContainer {
  id: string;
  name: string;
  kind: 'domain' | 'container' | 'ou';
  children: AdContainer[];
}

export interface AdUserInfo {
  id: string;
  sam: string;
  displayName: string;
  title: string;
  department: string;
  email: string;
  enabled: boolean;
  locked: boolean;
  mustChangePassword: boolean;
  lastSignIn: number | null;
  upn: string;
  memberOf: string[];
}

export interface AdGroupInfo {
  id: string;
  name: string;
  description: string;
  scope: string;
  category: string;
  members: string[];
  builtin: boolean;
}

export interface AdOuInfo {
  id: string;
  name: string;
  description: string;
}

export type AdRow =
  | { kind: 'user'; user: AdUserInfo }
  | { kind: 'group'; group: AdGroupInfo }
  | { kind: 'ou'; ou: AdOuInfo }
  | { kind: 'other'; name: string; type: string; description: string };

export interface NewUserInput {
  first: string;
  last: string;
  logon: string;
  department: string;
  title: string;
  password: string;
  mustChange: boolean;
  containerId: string;
}

export interface DirectoryAdapter {
  /** Shown as the tree's root, e.g. corp.technobiz.local. */
  domain: string;
  /** Why the directory cannot be changed right now (DC01 before promotion), or null. */
  unavailable(): string | null;
  /** Organizational units exist in this directory (false: users and groups only). */
  readonly supportsOus: boolean;
  /** When set, Move offers departments rather than containers (the main VM). */
  readonly departments?: readonly string[];
  tree(): AdContainer;
  rows(containerId: string): AdRow[];
  allGroups(): AdGroupInfo[];
  allContainers(): AdContainer[];

  createUser(i: NewUserInput): Result;
  createGroup(i: {
    name: string;
    description: string;
    scope: string;
    category: string;
    containerId: string;
  }): Result;
  createOu(i: { name: string; description: string; containerId: string }): Result;
  deleteOu(id: string): Result;
  deleteUser(sam: string): Result;
  deleteGroup(name: string): Result;
  setEnabled(sam: string, enabled: boolean): Result;
  unlock(sam: string): Result;
  resetPassword(sam: string, password: string, mustChange: boolean): Result;
  addMember(sam: string, group: string): Result;
  removeMember(sam: string, group: string): Result;
  /** Move a user or group to another container (or department, see `departments`). */
  move(kind: 'user' | 'group', id: string, target: string): Result;
  subscribe(fn: () => void): () => void;
}

const done = (message: string): Result => ({ ok: true, message });
const failed = (error: string): Result => ({ ok: false, error });

// ---------------------------------------------------------------------------
// Main VM: the lab's directory, through the capability registry
// ---------------------------------------------------------------------------

export function conductorAdapter(conductor: Conductor): DirectoryAdapter {
  const ctx = (): CapabilityContext => ({
    dir: conductor.dir,
    idp: conductor.idp,
    tickets: conductor.tickets,
    audit: conductor.audit,
    apps: conductor.apps,
    oauthGrants: conductor.oauthGrants,
    cloudRoles: conductor.cloudRoles,
    actor: 'system' as UserId,
  });
  const cap = (id: string, args: Record<string, string>): Result => {
    const c = CAPABILITY_BY_ID[id];
    if (!c) return failed(`This directory cannot do that (${id}).`);
    const r = c.run(ctx(), args);
    return r.ok ? done(r.message) : failed(r.error);
  };
  const listeners = new Set<() => void>();
  const changed = (r: Result): Result => {
    if (r.ok) for (const fn of [...listeners]) fn();
    return r;
  };

  const userInfo = (u: User): AdUserInfo => ({
    id: u.id,
    sam: u.username,
    displayName: u.displayName,
    title: u.title,
    department: u.department,
    email: u.email,
    enabled: u.status !== 'disabled',
    locked: u.status === 'locked',
    mustChangePassword: Boolean((u as User & { mustChangePassword?: boolean }).mustChangePassword),
    lastSignIn: u.lastSignInAt ?? null,
    upn: `${u.username}@${COMPANY.domain}`,
    memberOf: conductor.dir
      .listGroups()
      .filter((g) => g.memberIds.includes(u.id))
      .map((g) => g.name),
  });
  const groupInfo = (g: Group): AdGroupInfo => ({
    id: g.id,
    name: g.name,
    description: g.description,
    scope: 'Global',
    category: 'Security',
    members: g.memberIds.map((id) => conductor.dir.getUser(id)?.username ?? id),
    builtin: false,
  });

  const tree = (): AdContainer => ({
    id: 'domain',
    name: COMPANY.domain,
    kind: 'domain',
    children: [
      { id: 'builtin', name: 'Builtin', kind: 'container', children: [] },
      { id: 'computers', name: 'Computers', kind: 'container', children: [] },
      { id: 'domain-controllers', name: 'Domain Controllers', kind: 'ou', children: [] },
      { id: 'users', name: 'Users', kind: 'container', children: [] },
    ],
  });

  const user = (sam: string): User | undefined => conductor.dir.getUserByUsername(sam);
  const group = (name: string): Group | undefined => conductor.dir.getGroupByName(name);

  return {
    domain: COMPANY.domain,
    unavailable: () => (conductor.dir ? null : 'No lab is running.'),
    supportsOus: false,
    departments: DEPARTMENTS,
    tree,
    allContainers: () => tree().children,
    rows(containerId) {
      if (containerId === 'users') {
        return [
          ...conductor.dir.listUsers().map((u): AdRow => ({ kind: 'user', user: userInfo(u) })),
          ...conductor.dir.listGroups().map((g): AdRow => ({ kind: 'group', group: groupInfo(g) })),
        ];
      }
      if (containerId === 'builtin') {
        return [
          {
            kind: 'other',
            name: 'Administrators',
            type: 'Security Group',
            description: 'Built-in administrators',
          },
          {
            kind: 'other',
            name: 'Domain Users',
            type: 'Security Group',
            description: 'All domain users',
          },
          {
            kind: 'other',
            name: 'Remote Desktop Users',
            type: 'Security Group',
            description: 'RDP access',
          },
        ];
      }
      if (containerId === 'domain-controllers') {
        return [
          { kind: 'other', name: 'NW-DC01', type: 'Computer', description: 'Domain Controller' },
        ];
      }
      if (containerId === 'computers') {
        return [
          { kind: 'other', name: 'NW-IT-WS01', type: 'Computer', description: 'Workstation — IT' },
          {
            kind: 'other',
            name: 'NW-FIN-WS04',
            type: 'Computer',
            description: 'Workstation — Finance',
          },
        ];
      }
      return [];
    },
    allGroups: () => conductor.dir.listGroups().map(groupInfo),

    createUser(i) {
      const name = `${i.first} ${i.last}`.trim();
      const r = cap('user.create', {
        SamAccountName: i.logon,
        Name: name,
        Department: i.department,
        Title: i.title,
      });
      if (!r.ok) return r;
      if (i.password) {
        const p = cap('password.reset', {
          Identity: i.logon,
          NewPassword: i.password,
          ChangePasswordAtLogon: i.mustChange ? 'true' : 'false',
        });
        if (!p.ok) return changed(failed(`${r.message} But the password was not set: ${p.error}`));
      }
      return changed(r);
    },
    createGroup: (i) => changed(cap('group.create', { Name: i.name, Description: i.description })),
    createOu: () =>
      failed(
        `${COMPANY.domain} has no organizational units. Build OUs on DC01 (corp.technobiz.local) in the AD Enterprise Lab.`,
      ),
    deleteOu: () => failed('This directory has no organizational units.'),
    deleteUser: (sam) => changed(cap('user.delete', { Identity: sam })),
    deleteGroup(name) {
      const g = group(name);
      if (!g) return failed(`Cannot find a group named '${name}'.`);
      conductor.dir.deleteGroup(g.id, 'system' as UserId);
      return changed(done(`Deleted group ${name}.`));
    },
    setEnabled: (sam, enabled) =>
      changed(cap(enabled ? 'user.enable' : 'user.disable', { Identity: sam })),
    unlock: (sam) => changed(cap('account.unlock', { Identity: sam })),
    resetPassword: (sam, password, mustChange) =>
      changed(
        cap('password.reset', {
          Identity: sam,
          NewPassword: password,
          ChangePasswordAtLogon: mustChange ? 'true' : 'false',
        }),
      ),
    addMember(sam, name) {
      const u = user(sam);
      const g = group(name);
      if (!u || !g) return failed(`Cannot find ${!u ? `user '${sam}'` : `group '${name}'`}.`);
      if (g.memberIds.includes(u.id)) return failed(`${sam} is already a member of ${name}.`);
      conductor.dir.addToGroup(u.id, g.id, 'system' as UserId);
      return changed(done(`Added ${sam} to ${name}.`));
    },
    removeMember(sam, name) {
      const u = user(sam);
      const g = group(name);
      if (!u || !g) return failed(`Cannot find ${!u ? `user '${sam}'` : `group '${name}'`}.`);
      conductor.dir.removeFromGroup(u.id, g.id, 'system' as UserId);
      return changed(done(`Removed ${sam} from ${name}.`));
    },
    move(kind, id, target) {
      if (kind !== 'user') return failed('Groups in this directory are not placed in containers.');
      return changed(cap('user.move', { Identity: id, TargetDepartment: target }));
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

// ---------------------------------------------------------------------------
// DC01: the AD Enterprise Lab's directory, through its own PowerShell
// ---------------------------------------------------------------------------

/** Quote a value for the lab shell. Double quotes inside are refused rather than escaped. */
function q(v: string): string {
  return `"${v}"`;
}

const hasQuote = (...vals: string[]): boolean => vals.some((v) => v.includes('"'));

function rdnName(dn: string): string {
  const first = dn.split(',')[0] ?? dn;
  return first.replace(/^(OU|CN|DC)=/i, '');
}

function parentDn(dn: string): string {
  return dn.slice(dn.indexOf(',') + 1);
}

export function labStateAdapter(getWorld: () => LabWorld): DirectoryAdapter {
  const st = () => getWorld().state;
  const domainDn = DOMAIN_DN;
  const usersDn = `CN=Users,${domainDn}`;
  const builtinDn = `CN=Builtin,${domainDn}`;
  const computersDn = `CN=Computers,${domainDn}`;
  const dcsDn = `OU=Domain Controllers,${domainDn}`;

  const exec = (line: string): Result => {
    const r = runOn(getWorld(), 'DC01', line);
    if (!r.ok)
      return failed(r.output.replace(/^[A-Za-z-]+ : /, '').trim() || 'The command failed.');
    return done(r.output.trim() || 'Done.');
  };
  const run = (...lines: string[]): Result => {
    let last: Result = done('Done.');
    for (const l of lines) {
      last = exec(l);
      if (!last.ok) return last;
    }
    return last;
  };

  const userInfo = (u: AdUser): AdUserInfo => ({
    id: u.sam,
    sam: u.sam,
    displayName: u.name,
    title: (u as AdUser & { title?: string }).title ?? '',
    department: u.department ?? '',
    email: '',
    enabled: u.enabled,
    locked: u.lockedOut,
    mustChangePassword: u.changePasswordAtLogon,
    lastSignIn: null,
    upn: `${u.sam}@${st().ad.forest ?? ''}`,
    memberOf: st()
      .ad.groups.filter((g) => g.members.some((m) => m.toLowerCase() === u.sam.toLowerCase()))
      .map((g) => g.name),
  });
  const groupInfo = (g: AdGroup): AdGroupInfo => ({
    id: g.name,
    name: g.name,
    description: (g as AdGroup & { description?: string }).description ?? '',
    scope: g.scope,
    category: g.category,
    members: [...g.members],
    builtin: g.builtin,
  });

  const ouNode = (dn: string): AdContainer => ({
    id: dn,
    name: rdnName(dn),
    kind: 'ou',
    children: st()
      .ad.ous.filter((o) => parentDn(o).toLowerCase() === dn.toLowerCase())
      .sort((a, b) => rdnName(a).localeCompare(rdnName(b)))
      .map(ouNode),
  });

  const tree = (): AdContainer => {
    const s = st();
    if (!dcIsPromoted(s))
      return { id: 'none', name: 'Active Directory', kind: 'domain', children: [] };
    return {
      id: domainDn,
      name: s.ad.forest ?? 'corp.technobiz.local',
      kind: 'domain',
      children: [
        { id: builtinDn, name: 'Builtin', kind: 'container', children: [] },
        { id: computersDn, name: 'Computers', kind: 'container', children: [] },
        { id: dcsDn, name: 'Domain Controllers', kind: 'ou', children: [] },
        { id: usersDn, name: 'Users', kind: 'container', children: [] },
        ...s.ad.ous
          .filter(
            (o) =>
              parentDn(o).toLowerCase() === domainDn.toLowerCase() &&
              o.toLowerCase() !== dcsDn.toLowerCase(),
          )
          .sort((a, b) => rdnName(a).localeCompare(rdnName(b)))
          .map(ouNode),
      ],
    };
  };

  const flatten = (c: AdContainer): AdContainer[] => [c, ...c.children.flatMap(flatten)];
  const userDn = (u: AdUser): string => `CN=${u.name},${u.parent}`;
  const groupDn = (g: AdGroup): string => `CN=${g.name},${g.parent}`;
  const containerFor = (id: string): string => (id === 'none' || id === domainDn ? usersDn : id);

  return {
    domain: 'corp.technobiz.local',
    unavailable: () =>
      dcIsPromoted(st())
        ? null
        : 'DC01 is not a domain controller yet. Add the AD DS role and promote it (Server Manager, or Install-ADDSForest), then Active Directory appears here.',
    supportsOus: true,
    tree,
    allContainers: () => flatten(tree()).filter((c) => c.kind !== 'domain'),
    rows(containerId) {
      const s = st();
      if (!dcIsPromoted(s)) return [];
      const id = containerId.toLowerCase();
      if (id === domainDn.toLowerCase()) return [];
      const inHere = (parent: string): boolean => parent.toLowerCase() === id;
      const rows: AdRow[] = [
        ...s.ad.ous
          .filter((o) => parentDn(o).toLowerCase() === id)
          .map((o): AdRow => ({ kind: 'ou', ou: { id: o, name: rdnName(o), description: '' } })),
        ...s.ad.users
          .filter((u) => inHere(u.parent))
          .map((u): AdRow => ({ kind: 'user', user: userInfo(u) })),
        ...s.ad.groups
          .filter((g) => inHere(g.parent))
          .map((g): AdRow => ({ kind: 'group', group: groupInfo(g) })),
        ...s.ad.computers
          .filter((c) => inHere(c.parent))
          .map((c): AdRow => ({ kind: 'other', name: c.name, type: 'Computer', description: '' })),
      ];
      return rows;
    },
    allGroups: () => st().ad.groups.map(groupInfo),

    createUser(i) {
      const name = `${i.first} ${i.last}`.trim();
      if (hasQuote(name, i.logon, i.department, i.title, i.password))
        return failed('Remove the double quote (") from the values.');
      const parts = [
        `New-ADUser -Name ${q(name)}`,
        i.first ? `-GivenName ${q(i.first)}` : '',
        i.last ? `-Surname ${q(i.last)}` : '',
        `-SamAccountName ${q(i.logon)}`,
        `-UserPrincipalName ${q(`${i.logon}@corp.technobiz.local`)}`,
        i.department ? `-Department ${q(i.department)}` : '',
        i.title ? `-Title ${q(i.title)}` : '',
        `-Path ${q(containerFor(i.containerId))}`,
        i.password
          ? `-AccountPassword (ConvertTo-SecureString ${q(i.password)} -AsPlainText -Force) -Enabled $true`
          : '',
        i.mustChange ? '-ChangePasswordAtLogon $true' : '',
      ];
      const r = run(parts.filter(Boolean).join(' '));
      return r.ok ? done(`Created ${name} (${i.logon}).`) : r;
    },
    createGroup(i) {
      if (hasQuote(i.name, i.description))
        return failed('Remove the double quote (") from the values.');
      const r = run(
        `New-ADGroup -Name ${q(i.name)} -GroupScope ${i.scope} -GroupCategory ${i.category} -Path ${q(containerFor(i.containerId))}` +
          (i.description ? ` -Description ${q(i.description)}` : ''),
      );
      return r.ok ? done(`Created group ${i.name}.`) : r;
    },
    createOu(i) {
      if (hasQuote(i.name, i.description))
        return failed('Remove the double quote (") from the values.');
      const path = i.containerId === 'none' ? domainDn : i.containerId;
      const r = run(
        `New-ADOrganizationalUnit -Name ${q(i.name)} -Path ${q(path)}` +
          (i.description ? ` -Description ${q(i.description)}` : ''),
      );
      return r.ok ? done(`Created OU ${i.name}.`) : r;
    },
    deleteOu: (id) => run(`Remove-ADOrganizationalUnit -Identity ${q(id)} -Confirm:$false`),
    deleteUser: (sam) => run(`Remove-ADUser -Identity ${q(sam)} -Confirm:$false`),
    deleteGroup: (name) => run(`Remove-ADGroup -Identity ${q(name)} -Confirm:$false`),
    setEnabled: (sam, enabled) =>
      run(`${enabled ? 'Enable' : 'Disable'}-ADAccount -Identity ${q(sam)}`),
    unlock: (sam) => run(`Unlock-ADAccount -Identity ${q(sam)}`),
    resetPassword(sam, password, mustChange) {
      if (hasQuote(password)) return failed('Remove the double quote (") from the password.');
      return run(
        `Set-ADAccountPassword -Identity ${q(sam)} -Reset -NewPassword (ConvertTo-SecureString ${q(password)} -AsPlainText -Force)`,
        ...(mustChange ? [`Set-ADUser -Identity ${q(sam)} -ChangePasswordAtLogon $true`] : []),
      );
    },
    addMember: (sam, group) => run(`Add-ADGroupMember -Identity ${q(group)} -Members ${q(sam)}`),
    removeMember: (sam, group) =>
      run(`Remove-ADGroupMember -Identity ${q(group)} -Members ${q(sam)} -Confirm:$false`),
    move(kind, id, target) {
      const s = st();
      const dn =
        kind === 'user'
          ? (() => {
              const u = s.ad.users.find((x) => x.sam.toLowerCase() === id.toLowerCase());
              return u ? userDn(u) : null;
            })()
          : (() => {
              const g = s.ad.groups.find((x) => x.name.toLowerCase() === id.toLowerCase());
              return g ? groupDn(g) : null;
            })();
      if (!dn) return failed(`Cannot find '${id}'.`);
      return run(`Move-ADObject -Identity ${q(dn)} -TargetPath ${q(containerFor(target))}`);
    },
    subscribe: (fn) => onWorldChanged(fn),
  };
}
