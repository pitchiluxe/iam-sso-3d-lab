/**
 * ui/machines/client01Apps.ts — the software on CLIENT01 (Windows 11).
 *
 * Settings (Network & internet, and System → About with "Rename this PC" and
 * the Domain or workgroup dialog), Windows PowerShell and Command Prompt. The
 * domain join is the same Add-Computer the lab's solution uses.
 */
import { loadWorld } from '@/vm/adlab/world';
import type { MachineApp } from './machineWindow';
import { explorerApp, notepadApp } from './fileApps';
import {
  BTN,
  BTN_PRIMARY,
  INPUT,
  dialog,
  h,
  prefixOf,
  renderAdapters,
  runAll,
  terminalApp,
} from './sharedApps';

/** System Properties → Computer Name/Domain Changes → Member of: Domain. */
export function joinDomainCommand(domain: string): string {
  return `Add-Computer -DomainName ${domain.trim().toLowerCase()} -Credential CORP\\Administrator -Restart`;
}

export function renameCommand(name: string): string {
  return `Rename-Computer -NewName ${name.trim()}`;
}

function settingsApp(): MachineApp {
  return {
    id: 'settings',
    title: 'Settings',
    icon: '⚙️',
    width: 820,
    height: 540,
    render(body, ctx) {
      body.style.cssText += 'display:flex;flex-direction:row;background:#f3f3f3;color:#1b1b1b;';
      const nav = h('div', 'width:210px;flex-shrink:0;padding:14px 8px;');
      const main = h('div', 'flex:1;min-width:0;overflow:auto;padding:18px 22px;');
      body.append(nav, main);
      let page: 'system' | 'network' = 'system';
      const paint = (): void => {
        const s = loadWorld().state;
        const c = s.hosts.CLIENT01;
        nav.innerHTML = '';
        nav.append(h('div', 'display:flex;align-items:center;gap:10px;padding:6px 8px 14px;', ''));
        const who = nav.lastElementChild as HTMLElement;
        who.append(
          h('span', 'font-size:28px;', '👤'),
          h('div', 'line-height:1.3;', `${ctx.account()}`),
        );
        for (const [id, label] of [
          ['system', '🖥️  System'],
          ['network', '🌐  Network & internet'],
        ] as const) {
          const n = h(
            'div',
            `padding:8px 10px;border-radius:4px;cursor:pointer;${page === id ? 'background:#e5e5e5;font-weight:600;' : ''}`,
            label,
          );
          n.addEventListener('click', () => {
            page = id;
            paint();
          });
          nav.append(n);
        }
        main.innerHTML = '';
        if (page === 'system') {
          main.append(
            h('div', 'font-size:22px;font-weight:600;margin-bottom:14px;', 'System › About'),
          );
          const card = h(
            'div',
            'background:#fff;border:1px solid #e0e0e0;border-radius:6px;padding:14px 16px;margin-bottom:12px;display:flex;align-items:center;gap:14px;',
          );
          const name = h('div', 'flex:1;');
          name.append(
            h(
              'div',
              'font-size:16px;font-weight:600;',
              c.pendingHostname
                ? `${c.hostname} → ${c.pendingHostname} (restart required)`
                : c.hostname,
            ),
            h('div', 'color:#555;', c.os),
          );
          const rename = h('button', BTN, 'Rename this PC');
          rename.addEventListener('click', () => {
            let input: HTMLInputElement;
            dialog(
              body,
              'Rename your PC',
              (b) => {
                b.append(
                  h(
                    'div',
                    'margin-bottom:6px;',
                    'You can use a combination of letters, hyphens and numbers.',
                  ),
                );
                input = h('input', INPUT);
                input.value = c.pendingHostname ?? c.hostname;
                b.append(input);
              },
              () => {
                const ok = runAll(ctx, [renameCommand(input.value)], body);
                paint();
                if (ok) {
                  dialog(
                    body,
                    'Restart now?',
                    (b) => b.append(h('div', '', 'Your PC will be renamed after it restarts.')),
                    () => {
                      ctx.run('Restart-Computer');
                      return true;
                    },
                  );
                }
                return ok;
              },
            );
          });
          card.append(name, rename);
          main.append(card);

          const spec = h(
            'div',
            'background:#fff;border:1px solid #e0e0e0;border-radius:6px;padding:14px 16px;margin-bottom:12px;',
          );
          const row = (k: string, v: string): void => {
            const r = h('div', 'display:grid;grid-template-columns:180px 1fr;padding:4px 0;');
            r.append(h('span', 'color:#555;', k), h('span', '', v));
            spec.append(r);
          };
          spec.append(h('div', 'font-weight:600;margin-bottom:6px;', 'Device specifications'));
          row('Device name', c.hostname);
          row(
            'Domain',
            c.domain ?? (c.pendingDomain ? `${c.pendingDomain} (after restart)` : 'WORKGROUP'),
          );
          row('Edition', c.os);
          main.append(spec);

          const link = h(
            'div',
            'color:#005fb8;cursor:pointer;text-decoration:underline;margin-top:4px;',
            'Domain or workgroup',
          );
          link.addEventListener('click', () => {
            let domain: HTMLInputElement;
            let member: 'domain' | 'workgroup' = c.domain ? 'domain' : 'workgroup';
            dialog(
              body,
              'Computer Name/Domain Changes',
              (b) => {
                b.append(h('div', 'margin-bottom:8px;', `Computer name: ${c.hostname}`));
                const fs = h('fieldset', 'border:1px solid #cfcfcf;padding:8px 10px;');
                fs.append(h('legend', '', 'Member of'));
                const radio = (label: string, value: typeof member): HTMLInputElement => {
                  const l = h('label', 'display:flex;gap:6px;align-items:center;margin:4px 0;');
                  const r = h('input');
                  r.type = 'radio';
                  r.name = 'member';
                  r.checked = member === value;
                  r.addEventListener('change', () => (member = value));
                  l.append(r, document.createTextNode(label));
                  fs.append(l);
                  return r;
                };
                radio('Domain:', 'domain');
                domain = h('input', `${INPUT}margin:0 0 6px 22px;width:260px;`);
                domain.value = c.domain ?? 'corp.technobiz.local';
                fs.append(domain);
                radio('Workgroup:', 'workgroup');
                b.append(fs);
                b.append(
                  h(
                    'div',
                    'color:#555;margin-top:8px;line-height:1.5;',
                    'Joining asks for an account allowed to join the domain (CORP\\Administrator here) and restarts the PC. The domain name must resolve: CLIENT01 needs DC01 as its DNS server.',
                  ),
                );
              },
              () => {
                if (member === 'workgroup') return true;
                if (c.domain && c.domain.toLowerCase() === domain.value.trim().toLowerCase())
                  return true;
                return runAll(ctx, [joinDomainCommand(domain.value)], body);
              },
            );
          });
          main.append(link);
        } else {
          main.append(
            h('div', 'font-size:22px;font-weight:600;margin-bottom:14px;', 'Network & internet'),
          );
          const n = c.nics[0];
          const status = h(
            'div',
            'background:#fff;border:1px solid #e0e0e0;border-radius:6px;padding:14px 16px;margin-bottom:12px;',
          );
          if (n) {
            status.append(
              h('div', 'font-weight:600;', `${n.alias} — ${n.ip ? 'Connected' : 'No address'}`),
              h(
                'div',
                'color:#555;margin-top:4px;',
                `IPv4: ${n.ip ?? '—'}${n.mask ? `/${prefixOf(n.mask) ?? ''}` : ''} · Gateway: ${n.gateway ?? '—'} · DNS: ${n.dns.join(', ') || '—'} (${n.dhcp ? 'DHCP' : 'manual'})`,
              ),
            );
            const renew = h(
              'button',
              `${BTN_PRIMARY}margin-top:10px;`,
              'Renew IP address (ipconfig /renew)',
            );
            renew.addEventListener('click', () => {
              runAll(ctx, ['ipconfig /renew'], body);
              paint();
            });
            status.append(renew);
          }
          main.append(status);
          main.append(h('div', 'font-weight:600;margin:10px 0 4px;', 'Advanced network settings'));
          const adapters = h(
            'div',
            'background:#fafafa;border:1px solid #e0e0e0;border-radius:6px;',
          );
          main.append(adapters);
          renderAdapters(adapters, ctx, 'CLIENT01');
        }
      };
      paint();
      ctx.onChange(paint);
    },
  };
}

export function client01Apps(): MachineApp[] {
  return [
    settingsApp(),
    terminalApp('powershell'),
    terminalApp('cmd'),
    explorerApp(),
    notepadApp(),
  ];
}

export const CLIENT01_DEFAULT_APPS: string[] = [];
