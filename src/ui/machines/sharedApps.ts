/**
 * ui/machines/sharedApps.ts — the apps both lab machines have: Windows
 * PowerShell, Command Prompt, and the network adapter IPv4 settings.
 *
 * GUI settings are turned into the same commands a learner would type
 * (ipv4Commands below), run through the machine, so the lab's history and
 * checks see clicked and typed work identically.
 */
import type { HostName, Nic } from '@/vm/adlab/state';
import type { MachineApp, MachineContext } from './machineWindow';
import { openInNotepad } from './fileApps';

// ---------------------------------------------------------------------------
// IPv4 settings → commands (pure, tested)
// ---------------------------------------------------------------------------

export interface Ipv4Settings {
  alias: string;
  mode: 'dhcp' | 'static';
  ip?: string;
  prefix?: number;
  gateway?: string;
  dnsMode: 'auto' | 'static';
  dns?: string[];
}

/** The commands that make an adapter look like the Internet Protocol Version 4 dialog says. */
export function ipv4Commands(current: Pick<Nic, 'dhcp' | 'ip'>, want: Ipv4Settings): string[] {
  const a = /\s/.test(want.alias) ? `"${want.alias}"` : want.alias;
  const out: string[] = [];
  if (want.mode === 'dhcp') {
    if (!current.dhcp) out.push(`Set-NetIPInterface -InterfaceAlias ${a} -Dhcp Enabled`);
  } else {
    if (!want.ip || !want.prefix)
      throw new Error('Enter an IP address and a subnet prefix length.');
    if (!current.dhcp && current.ip && current.ip !== want.ip) {
      out.push(`Remove-NetIPAddress -InterfaceAlias ${a} -IPAddress ${current.ip} -Confirm:$false`);
    }
    if (current.dhcp || current.ip !== want.ip) {
      out.push(
        `New-NetIPAddress -InterfaceAlias ${a} -IPAddress ${want.ip} -PrefixLength ${want.prefix}` +
          (want.gateway ? ` -DefaultGateway ${want.gateway}` : ''),
      );
    }
  }
  if (want.dnsMode === 'auto')
    out.push(`Set-DnsClientServerAddress -InterfaceAlias ${a} -ResetServerAddresses`);
  else {
    const servers = (want.dns ?? []).map((d) => d.trim()).filter(Boolean);
    if (servers.length === 0)
      throw new Error('Enter a preferred DNS server, or choose to obtain DNS automatically.');
    out.push(
      `Set-DnsClientServerAddress -InterfaceAlias ${a} -ServerAddresses ${servers.join(',')}`,
    );
  }
  if (want.mode === 'dhcp') out.push('ipconfig /renew');
  return out;
}

export const maskOf = (prefix: number): string => {
  const bits = (0xffffffff << (32 - prefix)) >>> 0;
  return [24, 16, 8, 0].map((s) => (bits >>> s) & 255).join('.');
};
export const prefixOf = (mask: string | null): number | undefined => {
  if (!mask) return undefined;
  const n = mask
    .split('.')
    .reduce((acc, o) => acc + (Number(o) >>> 0).toString(2).replace(/0/g, '').length, 0);
  return n || undefined;
};

// ---------------------------------------------------------------------------
// Small DOM helpers for the light Windows look inside the machines
// ---------------------------------------------------------------------------

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  css = '',
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (css) e.style.cssText = css;
  if (text !== undefined) e.textContent = text;
  return e;
}

export const BTN =
  'padding:5px 16px;border:1px solid #adadad;border-radius:3px;background:#e1e1e1;color:#1b1b1b;font:inherit;cursor:pointer;';
export const BTN_PRIMARY =
  'padding:5px 16px;border:1px solid #0063b1;border-radius:3px;background:#0063b1;color:#fff;font:inherit;cursor:pointer;';
export const INPUT =
  'padding:4px 6px;border:1px solid #9aa4ae;border-radius:2px;background:#fff;color:#1b1b1b;font:inherit;';

/** A Windows-style modal inside the machine window. Returns a close function. */
export function dialog(
  anchor: HTMLElement,
  title: string,
  build: (body: HTMLElement) => void,
  onOk?: () => boolean,
): () => void {
  const host = anchor.closest<HTMLElement>('[data-mw-desk]') ?? anchor;
  const overlay = h(
    'div',
    'position:absolute;inset:0;background:rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;z-index:99999;',
  );
  const box = h(
    'div',
    'min-width:380px;max-width:520px;background:#f0f0f0;color:#1b1b1b;border:1px solid #8a8a8a;box-shadow:0 8px 28px rgba(0,0,0,.35);font-size:12px;',
  );
  const bar = h(
    'div',
    'padding:7px 10px;background:#fff;border-bottom:1px solid #d0d0d0;font-weight:600;',
    title,
  );
  const body = h('div', 'padding:12px 14px;max-height:65vh;overflow:auto;');
  build(body);
  const foot = h(
    'div',
    'display:flex;justify-content:flex-end;gap:8px;padding:10px 14px;border-top:1px solid #d0d0d0;',
  );
  const close = (): void => overlay.remove();
  if (onOk) {
    const ok = h('button', BTN_PRIMARY, 'OK');
    ok.addEventListener('click', () => {
      if (onOk()) close();
    });
    const cancel = h('button', BTN, 'Cancel');
    cancel.addEventListener('click', close);
    foot.append(ok, cancel);
  } else {
    const c = h('button', BTN_PRIMARY, 'Close');
    c.addEventListener('click', close);
    foot.append(c);
  }
  box.append(bar, body, foot);
  overlay.append(box);
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    }
  });
  host.append(overlay);
  body.querySelector<HTMLElement>('input,select')?.focus();
  return close;
}

/** Show a command's outcome the way Windows would: nothing on success, the error otherwise. */
export function runAll(ctx: MachineContext, lines: string[], anchor: HTMLElement): boolean {
  for (const l of lines) {
    const r = ctx.run(l);
    if (!r.ok) {
      dialog(anchor, 'Error', (b) => {
        b.append(
          h(
            'div',
            'white-space:pre-wrap;font-family:Consolas,monospace;font-size:11.5px;max-width:460px;',
            r.output,
          ),
        );
      });
      return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Terminal: Windows PowerShell and Command Prompt
// ---------------------------------------------------------------------------

export function terminalApp(kind: 'powershell' | 'cmd'): MachineApp {
  const ps = kind === 'powershell';
  return {
    id: ps ? 'powershell' : 'cmd',
    title: ps ? 'Windows PowerShell' : 'Command Prompt',
    icon: ps ? '🟦' : '⬛',
    width: 760,
    height: 460,
    render(body, ctx) {
      body.style.background = ps ? '#012456' : '#0c0c0c';
      const out = h(
        'div',
        `flex:1;overflow:auto;padding:8px 10px;white-space:pre-wrap;font:12.5px/1.45 Consolas,'Cascadia Mono',monospace;color:${ps ? '#eeedf0' : '#cccccc'};`,
      );
      body.append(out);
      const home = ctx.account().toLowerCase().includes('administrator')
        ? 'Administrator'
        : (ctx.account().split('\\').pop() ?? 'user');
      const prompt = (): string => (ps ? `PS C:\\Users\\${home}> ` : `C:\\Users\\${home}>`);
      const banner = ps
        ? 'Windows PowerShell\nCopyright (C) Microsoft Corporation. All rights reserved.\n\nType Get-Help (or help) for the commands this lab machine knows.\n\n'
        : 'Microsoft Windows [Version 10.0.20348.2340]\n(c) Microsoft Corporation. All rights reserved.\n\n';
      out.textContent = banner;
      const history: string[] = [];
      let hi = 0;
      const line = h('div', 'display:flex;');
      const p = h('span', '', prompt());
      const input = h(
        'input',
        `flex:1;background:transparent;border:none;outline:none;color:inherit;font:inherit;padding:0;`,
      );
      input.spellcheck = false;
      line.append(p, input);
      out.append(line);
      const write = (text: string): void => {
        out.insertBefore(document.createTextNode(text), line);
      };
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const cmd = input.value;
          input.value = '';
          write(`${prompt()}${cmd}\n`);
          if (cmd.trim()) {
            history.push(cmd);
            hi = history.length;
            if (/^(exit|logoff)$/i.test(cmd.trim())) {
              body
                .closest<HTMLElement>('div[style*="position:absolute"]')
                ?.querySelector<HTMLElement>('div[style*="width:40px"]:last-child')
                ?.click();
              return;
            }
            // GUI programs started from the prompt open on this machine's desktop.
            const gui =
              /^(notepad|explorer|ii|invoke-item)(?:\.exe)?(?:\s+["']?(.+?)["']?)?\s*$/i.exec(
                cmd.trim(),
              );
            if (gui) {
              const target = gui[2];
              if (/^notepad/i.test(gui[1]!)) {
                if (target) openInNotepad(ctx, target);
                else ctx.open('notepad');
              } else ctx.open('explorer');
              write('\n');
              out.scrollTop = out.scrollHeight;
              return;
            }
            const r = ctx.run(cmd);
            if (r.clear) {
              while (out.firstChild && out.firstChild !== line) out.removeChild(out.firstChild);
            } else if (r.output) write(`${r.output.replace(/\n+$/, '')}\n`);
          }
          write('\n');
          out.scrollTop = out.scrollHeight;
        } else if (e.key === 'ArrowUp') {
          if (hi > 0) input.value = history[--hi] ?? '';
          e.preventDefault();
        } else if (e.key === 'ArrowDown') {
          if (hi < history.length) input.value = history[++hi] ?? '';
          e.preventDefault();
        }
      });
      body.addEventListener('mouseup', () => {
        if (!window.getSelection()?.toString()) input.focus();
      });
      setTimeout(() => input.focus(), 0);
    },
  };
}

// ---------------------------------------------------------------------------
// Network adapters (ncpa.cpl on DC01, Settings → Network on CLIENT01)
// ---------------------------------------------------------------------------

/** The Internet Protocol Version 4 (TCP/IPv4) Properties dialog for one adapter. */
export function ipv4Dialog(
  anchor: HTMLElement,
  ctx: MachineContext,
  host: HostName,
  alias: string,
  after: () => void,
): void {
  const nic = ctx.world().state.hosts[host].nics.find((n) => n.alias === alias);
  if (!nic) return;
  let mode: 'dhcp' | 'static' = nic.dhcp ? 'dhcp' : 'static';
  let dnsMode: 'auto' | 'static' = nic.dnsStatic ? 'static' : 'auto';
  const f: Record<string, HTMLInputElement> = {};
  dialog(
    anchor,
    `Internet Protocol Version 4 (TCP/IPv4) Properties — ${alias}`,
    (b) => {
      b.append(
        h(
          'div',
          'color:#333;margin-bottom:10px;line-height:1.5;',
          'You can get IP settings assigned automatically if your network supports this capability. Otherwise, ask your network administrator for the appropriate IP settings.',
        ),
      );
      const radios: Record<string, HTMLInputElement> = {};
      const radio = (
        name: string,
        label: string,
        checked: boolean,
        onPick: () => void,
      ): HTMLElement => {
        const row = h('label', 'display:flex;align-items:center;gap:6px;margin:4px 0;');
        const r = h('input');
        r.type = 'radio';
        r.name = `${name}-${alias}`;
        r.checked = checked;
        radios[label] = r;
        r.addEventListener('change', () => {
          onPick();
          sync();
        });
        row.append(r, document.createTextNode(label));
        return row;
      };
      const fieldRow = (key: string, label: string, value: string): HTMLElement => {
        const row = h(
          'div',
          'display:grid;grid-template-columns:170px 1fr;align-items:center;gap:8px;margin:4px 0 4px 20px;',
        );
        const inp = h('input', INPUT);
        inp.value = value;
        f[key] = inp;
        row.append(h('span', '', label), inp);
        return row;
      };
      const box1 = h('fieldset', 'border:1px solid #cfcfcf;padding:6px 10px;margin:0 0 10px;');
      box1.append(
        radio('ip', 'Obtain an IP address automatically', mode === 'dhcp', () => (mode = 'dhcp')),
        radio('ip', 'Use the following IP address:', mode === 'static', () => (mode = 'static')),
        fieldRow('ip', 'IP address:', nic.dhcp ? '' : (nic.ip ?? '')),
        fieldRow(
          'mask',
          'Subnet mask:',
          nic.dhcp ? '255.255.255.0' : (nic.mask ?? '255.255.255.0'),
        ),
        fieldRow('gw', 'Default gateway:', nic.dhcp ? '' : (nic.gateway ?? '')),
      );
      const box2 = h('fieldset', 'border:1px solid #cfcfcf;padding:6px 10px;margin:0;');
      box2.append(
        radio(
          'dns',
          'Obtain DNS server address automatically',
          dnsMode === 'auto',
          () => (dnsMode = 'auto'),
        ),
        radio(
          'dns',
          'Use the following DNS server addresses:',
          dnsMode === 'static',
          () => (dnsMode = 'static'),
        ),
        fieldRow('dns1', 'Preferred DNS server:', nic.dnsStatic ? (nic.dns[0] ?? '') : ''),
        fieldRow('dns2', 'Alternate DNS server:', nic.dnsStatic ? (nic.dns[1] ?? '') : ''),
      );
      b.append(box1, box2);
      const DNS_AUTO = 'Obtain DNS server address automatically';
      const DNS_STATIC = 'Use the following DNS server addresses:';
      const sync = (): void => {
        for (const k of ['ip', 'mask', 'gw']) f[k]!.disabled = mode === 'dhcp';
        // Windows forces static DNS when the address is static, and greys out
        // "Obtain DNS server address automatically".
        if (mode === 'static') dnsMode = 'static';
        radios[DNS_AUTO]!.disabled = mode === 'static';
        radios[DNS_AUTO]!.checked = dnsMode === 'auto';
        radios[DNS_STATIC]!.checked = dnsMode === 'static';
        for (const k of ['dns1', 'dns2']) f[k]!.disabled = dnsMode === 'auto';
      };
      sync();
    },
    () => {
      try {
        const lines = ipv4Commands(nic, {
          alias,
          mode,
          ip: f.ip!.value.trim(),
          prefix: prefixOf(f.mask!.value.trim()),
          gateway: f.gw!.value.trim() || undefined,
          dnsMode,
          dns: [f.dns1!.value, f.dns2!.value],
        });
        const ok = runAll(ctx, lines, anchor);
        after();
        return ok;
      } catch (e) {
        dialog(anchor, 'Microsoft TCP/IP', (b) =>
          b.append(h('div', '', e instanceof Error ? e.message : String(e))),
        );
        return false;
      }
    },
  );
}

/** Network Connections: one card per adapter, with status and IPv4 at a glance. */
export function renderAdapters(body: HTMLElement, ctx: MachineContext, host: HostName): void {
  const paint = (): void => {
    body.innerHTML = '';
    const s = ctx.world().state.hosts[host];
    const grid = h('div', 'display:flex;flex-wrap:wrap;gap:14px;padding:14px;');
    for (const n of s.nics) {
      const card = h(
        'div',
        'width:230px;border:1px solid #d6d6d6;border-radius:4px;background:#fff;padding:10px;display:flex;gap:10px;cursor:default;',
      );
      card.title = 'Double-click to open Internet Protocol Version 4 (TCP/IPv4) Properties';
      card.append(h('div', 'font-size:30px;', '🖧'));
      const t = h('div', 'line-height:1.5;');
      t.append(
        h('div', 'font-weight:600;', n.alias),
        h('div', 'color:#555;', n.network === 'internet' ? 'Network (NAT)' : 'TechnoBiz-LAN'),
        h(
          'div',
          'color:#555;',
          `${n.dhcp ? 'DHCP' : 'Static'} · ${n.ip ?? 'no address'}${n.mask ? `/${prefixOf(n.mask) ?? ''}` : ''}`,
        ),
        h('div', 'color:#555;', `DNS: ${n.dns.join(', ') || '—'}`),
      );
      const props = h('button', `${BTN}margin-top:6px;padding:3px 10px;`, 'Properties…');
      props.addEventListener('click', () => ipv4Dialog(body, ctx, host, n.alias, paint));
      t.append(props);
      card.append(t);
      card.addEventListener('dblclick', () => ipv4Dialog(body, ctx, host, n.alias, paint));
      grid.append(card);
    }
    body.append(grid);
  };
  body.style.background = '#fafafa';
  body.style.overflow = 'auto';
  paint();
  ctx.onChange(paint);
}
