/**
 * ui/machines/dc01Apps.ts — the software on DC01 (Windows Server 2022).
 *
 * Server Manager, Active Directory Users and Computers, Network Connections,
 * DHCP, DNS Manager, Windows PowerShell and Command Prompt. Every GUI action is
 * the PowerShell a learner could have typed instead (the *Command functions
 * below, which are tested), run on DC01 through the lab engine.
 */
import { renderActiveDirectoryView } from '@/ui/directory/activeDirectoryView';
import { labStateAdapter } from '@/ui/directory/directoryAdapter';
import { dcIsPromoted, type LabState } from '@/vm/adlab/state';
import { loadWorld } from '@/vm/adlab/world';
import type { MachineApp, MachineContext } from './machineWindow';
import { explorerApp, notepadApp } from './fileApps';
import {
  BTN,
  BTN_PRIMARY,
  INPUT,
  dialog,
  h,
  renderAdapters,
  runAll,
  terminalApp,
} from './sharedApps';

// ---------------------------------------------------------------------------
// GUI → PowerShell (pure, tested)
// ---------------------------------------------------------------------------

/** The roles Server Manager's Add Roles and Features wizard offers, with their feature names. */
export const SERVER_ROLES: readonly { name: string; features: string[]; description: string }[] = [
  {
    name: 'Active Directory Domain Services',
    features: ['AD-Domain-Services'],
    description:
      'Stores information about objects on the network and makes it available to users and administrators.',
  },
  {
    name: 'DNS Server',
    features: ['DNS'],
    description:
      'Name resolution for TCP/IP networks. Installed with AD DS when the server is promoted.',
  },
  {
    name: 'DHCP Server',
    features: ['DHCP'],
    description:
      'Centrally configures, manages and provides temporary IP addresses to client computers.',
  },
  {
    name: 'Remote Access (Routing)',
    features: ['RemoteAccess', 'Routing'],
    description:
      'Routing and NAT, so machines on the internal network reach the internet through this server.',
  },
  {
    name: 'File and Storage Services (File Server)',
    features: ['FS-FileServer'],
    description: 'Shared folders and their permissions.',
  },
];

export function installRolesCommand(features: string[]): string {
  return `Install-WindowsFeature -Name ${features.join(',')} -IncludeManagementTools`;
}

export function promoteCommand(domain: string, netbios: string): string {
  return `Install-ADDSForest -DomainName ${domain.trim().toLowerCase()} -DomainNetbiosName ${netbios.trim().toUpperCase()} -InstallDns -Force`;
}

export interface NewScopeInput {
  name: string;
  start: string;
  end: string;
  mask: string;
  router: string;
  dns: string;
  dnsDomain: string;
}

/** What the DHCP New Scope Wizard does, as commands. */
export function newScopeCommands(i: NewScopeInput): string[] {
  const scopeId = i.start.split('.').slice(0, 3).concat('0').join('.');
  const out = [
    `Add-DhcpServerv4Scope -Name "${i.name}" -StartRange ${i.start} -EndRange ${i.end} -SubnetMask ${i.mask} -State Active`,
  ];
  const opts = [
    i.router ? `-Router ${i.router}` : '',
    i.dns ? `-DnsServer ${i.dns}` : '',
    i.dnsDomain ? `-DnsDomain ${i.dnsDomain}` : '',
  ].filter(Boolean);
  if (opts.length) out.push(`Set-DhcpServerv4OptionValue -ScopeId ${scopeId} ${opts.join(' ')}`);
  return out;
}

export function authorizeDhcpCommand(s: LabState): string {
  const ip = s.hosts.DC01.nics.find((n) => n.network === 'internal')?.ip ?? '172.16.0.1';
  return `Add-DhcpServerInDC -DnsName dc01.${s.ad.forest ?? 'corp.technobiz.local'} -IPAddress ${ip}`;
}

// ---------------------------------------------------------------------------
// Server Manager
// ---------------------------------------------------------------------------

function serverManager(): MachineApp {
  return {
    id: 'server-manager',
    title: 'Server Manager',
    icon: '🗄️',
    width: 860,
    height: 560,
    render(body, ctx) {
      body.style.cssText += 'display:flex;flex-direction:row;background:#fff;';
      const nav = h(
        'div',
        'width:190px;flex-shrink:0;background:#1f2d3d;color:#dfe7ef;padding:10px 0;',
      );
      const main = h('div', 'flex:1;min-width:0;overflow:auto;padding:16px 20px;color:#1b1b1b;');
      body.append(nav, main);
      let page: 'dashboard' | 'local' | 'roles' = 'dashboard';
      const navItem = (id: typeof page, label: string): HTMLElement => {
        const n = h(
          'div',
          `padding:8px 16px;cursor:pointer;${page === id ? 'background:#2f4a66;border-left:3px solid #5ab4ff;' : 'border-left:3px solid transparent;'}`,
          label,
        );
        n.addEventListener('click', () => {
          page = id;
          paint();
        });
        return n;
      };
      const paint = (): void => {
        const s = loadWorld().state;
        const dc = s.hosts.DC01;
        nav.innerHTML = '';
        nav.append(
          navItem('dashboard', '▦  Dashboard'),
          navItem('local', '▣  Local Server'),
          navItem('roles', '▤  Roles and Features'),
        );
        main.innerHTML = '';
        const promoted = dcIsPromoted(s);
        const needsPromotion = dc.features.includes('AD-Domain-Services') && !promoted;
        if (needsPromotion) {
          const flag = h(
            'div',
            'display:flex;align-items:center;gap:10px;background:#fff4ce;border:1px solid #f0d78c;padding:9px 12px;margin-bottom:14px;',
          );
          flag.append(
            h('span', 'font-size:16px;', '⚑'),
            h(
              'span',
              'flex:1;',
              'Post-deployment configuration: Active Directory Domain Services is installed, but this server is not a domain controller yet.',
            ),
          );
          const b = h('button', BTN_PRIMARY, 'Promote this server to a domain controller');
          b.addEventListener('click', () => promoteWizard());
          flag.append(b);
          main.append(flag);
        }
        if (dc.pendingHostname || dc.restartPending) {
          main.append(
            h(
              'div',
              'background:#fde7e9;border:1px solid #f1aeb5;padding:9px 12px;margin-bottom:14px;',
              'A restart is required to finish a change (for example the new computer name). Restart from Start → Restart, or run Restart-Computer.',
            ),
          );
        }
        if (page === 'dashboard') {
          main.append(
            h(
              'div',
              'font-size:20px;font-weight:300;margin-bottom:12px;',
              'WELCOME TO SERVER MANAGER',
            ),
          );
          const steps: [string, string, () => void][] = [
            [
              '1',
              'Configure this local server',
              () => {
                page = 'local';
                paint();
              },
            ],
            ['2', 'Add roles and features', () => addRolesWizard()],
            [
              '3',
              promoted
                ? `Domain: ${s.ad.forest}`
                : 'Promote to a domain controller (after adding AD DS)',
              () => (needsPromotion ? promoteWizard() : undefined),
            ],
          ];
          for (const [n, label, go] of steps) {
            const row = h(
              'div',
              'display:flex;align-items:center;gap:12px;padding:8px 0;cursor:pointer;color:#0063b1;',
            );
            row.append(
              h(
                'span',
                'width:26px;height:26px;border-radius:50%;background:#0063b1;color:#fff;display:flex;align-items:center;justify-content:center;',
                n,
              ),
              h('span', 'font-size:14px;', label),
            );
            row.addEventListener('click', go);
            main.append(row);
          }
          main.append(h('div', 'margin:18px 0 6px;font-weight:600;', 'ROLES AND SERVER GROUPS'));
          const roles = h('div', 'display:flex;flex-wrap:wrap;gap:10px;');
          const installed = SERVER_ROLES.filter((r) =>
            r.features.every((f) => dc.features.includes(f)),
          );
          if (installed.length === 0)
            roles.append(h('div', 'color:#666;', 'No roles are installed yet.'));
          for (const r of installed) {
            const card = h(
              'div',
              'width:180px;border-top:4px solid #2e8b57;background:#f4f6f8;padding:8px 10px;',
            );
            card.append(
              h('div', 'font-weight:600;', r.name),
              h('div', 'color:#2e8b57;margin-top:4px;', 'Installed'),
            );
            roles.append(card);
          }
          main.append(roles);
        } else if (page === 'local') {
          main.append(
            h(
              'div',
              'font-size:18px;font-weight:300;margin-bottom:12px;',
              'PROPERTIES — For ' + dc.hostname,
            ),
          );
          const grid = h('div', 'display:grid;grid-template-columns:200px 1fr;gap:6px 14px;');
          const link = (text: string, onClick: () => void): HTMLElement => {
            const a = h('span', 'color:#0063b1;cursor:pointer;text-decoration:underline;', text);
            a.addEventListener('click', onClick);
            return a;
          };
          grid.append(
            h('span', 'color:#555;', 'Computer name'),
            link(
              dc.pendingHostname
                ? `${dc.hostname} (restart to become ${dc.pendingHostname})`
                : dc.hostname,
              () => renameDialog(),
            ),
          );
          grid.append(
            h('span', 'color:#555;', promoted ? 'Domain' : 'Workgroup'),
            h('span', '', promoted ? (s.ad.forest ?? '') : 'WORKGROUP'),
          );
          for (const n of dc.nics) {
            grid.append(
              h('span', 'color:#555;', n.alias),
              link(
                `${n.dhcp ? 'IPv4 address assigned by DHCP' : 'Static'} — ${n.ip ?? 'no address'}`,
                () => ctx.open('ncpa'),
              ),
            );
          }
          grid.append(h('span', 'color:#555;', 'Operating system'), h('span', '', dc.os));
          main.append(grid);
        } else {
          main.append(
            h('div', 'font-size:18px;font-weight:300;margin-bottom:12px;', 'ROLES AND FEATURES'),
          );
          for (const r of SERVER_ROLES) {
            const on = r.features.every((f) => dc.features.includes(f));
            const row = h(
              'div',
              'display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee;',
            );
            row.append(
              h('span', '', r.name),
              h('span', on ? 'color:#2e8b57;' : 'color:#888;', on ? 'Installed' : 'Available'),
            );
            main.append(row);
          }
          const b = h('button', `${BTN_PRIMARY}margin-top:14px;`, 'Add Roles and Features');
          b.addEventListener('click', () => addRolesWizard());
          main.append(b);
        }
      };

      const addRolesWizard = (): void => {
        const dc = loadWorld().state.hosts.DC01;
        const picks = new Set<string>();
        dialog(
          body,
          'Add Roles and Features Wizard — Select server roles',
          (b) => {
            b.append(
              h(
                'div',
                'margin-bottom:8px;color:#333;',
                `Select one or more roles to install on ${dc.hostname}.`,
              ),
            );
            for (const r of SERVER_ROLES) {
              const on = r.features.every((f) => dc.features.includes(f));
              const row = h('label', 'display:flex;gap:8px;align-items:flex-start;padding:5px 0;');
              const cb = h('input');
              cb.type = 'checkbox';
              cb.checked = on;
              cb.disabled = on;
              cb.addEventListener('change', () =>
                cb.checked ? picks.add(r.name) : picks.delete(r.name),
              );
              const t = h('div');
              t.append(
                h('div', 'font-weight:600;', `${r.name}${on ? ' (Installed)' : ''}`),
                h('div', 'color:#555;', r.description),
              );
              row.append(cb, t);
              b.append(row);
            }
          },
          () => {
            const features = SERVER_ROLES.filter((r) => picks.has(r.name)).flatMap(
              (r) => r.features,
            );
            if (features.length === 0) return true;
            const ok = runAll(ctx, [installRolesCommand(features)], body);
            paint();
            return ok;
          },
        );
      };

      const promoteWizard = (): void => {
        let domain: HTMLInputElement;
        let netbios: HTMLInputElement;
        dialog(
          body,
          'Active Directory Domain Services Configuration Wizard',
          (b) => {
            b.append(
              h(
                'div',
                'margin-bottom:10px;color:#333;',
                'Deployment configuration: Add a new forest.',
              ),
            );
            const row = (label: string, value: string): HTMLInputElement => {
              const r = h(
                'div',
                'display:grid;grid-template-columns:150px 1fr;gap:8px;align-items:center;margin:6px 0;',
              );
              const i = h('input', INPUT);
              i.value = value;
              r.append(h('span', '', label), i);
              b.append(r);
              return i;
            };
            domain = row('Root domain name:', 'corp.technobiz.local');
            netbios = row('NetBIOS domain name:', 'CORP');
            b.append(
              h(
                'div',
                'color:#555;margin-top:8px;line-height:1.5;',
                'The DNS server role is installed with the domain. The server restarts automatically when promotion completes.',
              ),
            );
          },
          () => {
            const ok = runAll(ctx, [promoteCommand(domain.value, netbios.value)], body);
            paint();
            return ok;
          },
        );
      };

      const renameDialog = (): void => {
        let name: HTMLInputElement;
        dialog(
          body,
          'Computer Name/Domain Changes',
          (b) => {
            b.append(
              h(
                'div',
                'margin-bottom:8px;color:#333;',
                'You can change the name of this computer. Changes might affect access to network resources.',
              ),
            );
            name = h('input', INPUT);
            name.value =
              loadWorld().state.hosts.DC01.pendingHostname ?? loadWorld().state.hosts.DC01.hostname;
            b.append(h('div', 'margin-bottom:4px;', 'Computer name:'), name);
          },
          () => {
            const ok = runAll(ctx, [`Rename-Computer -NewName ${name.value.trim()}`], body);
            paint();
            if (ok) {
              dialog(
                body,
                'Computer Name/Domain Changes',
                (b) =>
                  b.append(h('div', '', 'You must restart your computer to apply these changes.')),
                () => {
                  ctx.run('Restart-Computer');
                  return true;
                },
              );
            }
            return ok;
          },
        );
      };

      paint();
      ctx.onChange(paint);
    },
  };
}

// ---------------------------------------------------------------------------
// DHCP and DNS consoles
// ---------------------------------------------------------------------------

function dhcpConsole(): MachineApp {
  return {
    id: 'dhcp',
    title: 'DHCP',
    icon: '🌐',
    width: 760,
    height: 480,
    render(body, ctx) {
      body.style.cssText += 'background:#fff;color:#1b1b1b;overflow:auto;';
      const paint = (): void => {
        body.innerHTML = '';
        const s = loadWorld().state;
        const dc = s.hosts.DC01;
        const wrap = h('div', 'padding:14px 16px;');
        if (!dc.features.includes('DHCP')) {
          wrap.append(
            h(
              'div',
              'color:#555;',
              'The DHCP Server role is not installed on this server. Add it in Server Manager → Add Roles and Features.',
            ),
          );
          body.append(wrap);
          return;
        }
        const head = h('div', 'display:flex;align-items:center;gap:10px;margin-bottom:10px;');
        head.append(
          h(
            'div',
            'font-size:16px;font-weight:600;flex:1;',
            `dc01.${s.ad.forest ?? 'local'} — IPv4`,
          ),
        );
        const auth = h(
          'span',
          s.dhcp.authorized ? 'color:#2e8b57;' : 'color:#c0392b;',
          s.dhcp.authorized ? '● Authorized' : '● Not authorized in AD',
        );
        head.append(auth);
        if (!s.dhcp.authorized) {
          const a = h('button', BTN, 'Authorize');
          a.addEventListener('click', () => {
            runAll(ctx, [authorizeDhcpCommand(loadWorld().state)], body);
            paint();
          });
          head.append(a);
        }
        const ns = h('button', BTN_PRIMARY, 'New Scope…');
        ns.addEventListener('click', () => newScopeWizard());
        head.append(ns);
        wrap.append(head);
        const table = (rows: string[][], header: string[]): HTMLElement => {
          const t = h('table', 'width:100%;border-collapse:collapse;margin-bottom:14px;');
          const tr = h('tr');
          for (const c of header)
            tr.append(
              h(
                'th',
                'text-align:left;padding:5px 8px;border-bottom:1px solid #ccc;background:#f4f6f8;',
                c,
              ),
            );
          t.append(tr);
          for (const r of rows) {
            const row = h('tr');
            for (const c of r)
              row.append(h('td', 'padding:4px 8px;border-bottom:1px solid #eee;', c));
            t.append(row);
          }
          if (rows.length === 0) {
            const row = h('tr');
            const td = h('td', 'padding:6px 8px;color:#777;', 'None');
            td.colSpan = header.length;
            row.append(td);
            t.append(row);
          }
          return t;
        };
        wrap.append(h('div', 'font-weight:600;margin:6px 0;', 'Scopes'));
        wrap.append(
          table(
            s.dhcp.scopes.map((sc) => [
              `[${sc.scopeId}] ${sc.name}`,
              `${sc.start} – ${sc.end}`,
              sc.mask,
              sc.active ? 'Active' : 'Inactive',
              sc.router ?? '(server)',
              sc.dns.join(', ') || '(server)',
            ]),
            ['Scope', 'Range', 'Mask', 'State', 'Router (003)', 'DNS (006)'],
          ),
        );
        wrap.append(h('div', 'font-weight:600;margin:6px 0;', 'Address Leases'));
        wrap.append(
          table(
            s.dhcp.leases.map((l) => [l.ip, l.hostname, l.mac, l.scopeId]),
            ['Client IP', 'Name', 'Unique ID', 'Scope'],
          ),
        );
        body.append(wrap);
      };
      const newScopeWizard = (): void => {
        const f: Record<string, HTMLInputElement> = {};
        dialog(
          body,
          'New Scope Wizard',
          (b) => {
            const row = (key: string, label: string, value: string): void => {
              const r = h(
                'div',
                'display:grid;grid-template-columns:170px 1fr;gap:8px;align-items:center;margin:5px 0;',
              );
              const i = h('input', INPUT);
              i.value = value;
              f[key] = i;
              r.append(h('span', '', label), i);
              b.append(r);
            };
            row('name', 'Scope name:', 'TechnoBiz LAN');
            row('start', 'Start IP address:', '172.16.0.100');
            row('end', 'End IP address:', '172.16.0.200');
            row('mask', 'Subnet mask:', '255.255.255.0');
            row('router', 'Router (default gateway):', '');
            row('dns', 'DNS server:', '');
            row('dnsDomain', 'Parent domain:', loadWorld().state.ad.forest ?? '');
          },
          () => {
            const ok = runAll(
              ctx,
              newScopeCommands({
                name: f.name!.value.trim(),
                start: f.start!.value.trim(),
                end: f.end!.value.trim(),
                mask: f.mask!.value.trim(),
                router: f.router!.value.trim(),
                dns: f.dns!.value.trim(),
                dnsDomain: f.dnsDomain!.value.trim(),
              }),
              body,
            );
            paint();
            return ok;
          },
        );
      };
      paint();
      ctx.onChange(paint);
    },
  };
}

function dnsManager(): MachineApp {
  return {
    id: 'dns',
    title: 'DNS Manager',
    icon: '📇',
    width: 700,
    height: 460,
    render(body, ctx) {
      body.style.cssText += 'background:#fff;color:#1b1b1b;overflow:auto;';
      const paint = (): void => {
        body.innerHTML = '';
        const s = loadWorld().state;
        const wrap = h('div', 'padding:14px 16px;');
        if (!s.hosts.DC01.features.includes('DNS') && s.dns.zones.length === 0) {
          wrap.append(
            h(
              'div',
              'color:#555;',
              'The DNS Server role is not installed. It is installed with Active Directory when the server is promoted.',
            ),
          );
          body.append(wrap);
          return;
        }
        wrap.append(
          h(
            'div',
            'font-size:16px;font-weight:600;margin-bottom:10px;',
            'DNS — Forward Lookup Zones',
          ),
        );
        for (const z of s.dns.zones) {
          wrap.append(h('div', 'font-weight:600;margin:10px 0 4px;', `📁 ${z}`));
          const recs = s.dns.records.filter((r) => r.zone === z);
          const t = h('table', 'width:100%;border-collapse:collapse;');
          const tr = h('tr');
          for (const c of ['Name', 'Type', 'Data'])
            tr.append(
              h(
                'th',
                'text-align:left;padding:4px 8px;border-bottom:1px solid #ccc;background:#f4f6f8;',
                c,
              ),
            );
          t.append(tr);
          for (const r of recs) {
            const row = h('tr');
            for (const c of [r.name === '@' ? '(same as parent folder)' : r.name, 'Host (A)', r.ip])
              row.append(h('td', 'padding:4px 8px;border-bottom:1px solid #eee;', c));
            t.append(row);
          }
          wrap.append(t);
        }
        body.append(wrap);
      };
      paint();
      ctx.onChange(paint);
    },
  };
}

function activeDirectoryApp(): MachineApp {
  return {
    id: 'aduc',
    title: 'Active Directory Users and Computers',
    icon: '🗃️',
    width: 900,
    height: 560,
    render(body) {
      // The same IAM Range snap-in as the main VM, over corp.technobiz.local.
      const wrap = h('div', 'flex:1;min-height:0;display:flex;background:#1b1f24;');
      body.append(wrap);
      renderActiveDirectoryView(
        wrap,
        labStateAdapter(() => loadWorld()),
      );
    },
  };
}

function networkApp(): MachineApp {
  return {
    id: 'ncpa',
    title: 'Network Connections',
    icon: '🖧',
    width: 560,
    height: 360,
    render: (body, ctx) => renderAdapters(body, ctx, 'DC01'),
  };
}

export function dc01Apps(): MachineApp[] {
  return [
    serverManager(),
    activeDirectoryApp(),
    terminalApp('powershell'),
    terminalApp('cmd'),
    networkApp(),
    dhcpConsole(),
    dnsManager(),
    explorerApp(),
    notepadApp(),
  ];
}

/** Server Manager opens at sign-in, as it does on Windows Server. */
export const DC01_DEFAULT_APPS = ['server-manager'];

export type { MachineContext };
