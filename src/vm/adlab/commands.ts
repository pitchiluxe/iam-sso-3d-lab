/**
 * vm/adlab/commands.ts — the student's hands.
 *
 * Every change to the Active Directory Enterprise Lab goes through here, and
 * only the student's typed commands reach here. The instructor module does not
 * import this file (tests/adLab.test.ts checks that), so no amount of model
 * output can reconfigure an adapter, unlock an account or join a computer.
 *
 * The commands behave like their Windows counterparts where it teaches
 * something: static DNS beats DHCP-provided DNS, Add-Computer fails when the
 * client cannot find a DC in DNS, AD cmdlets do not exist on a Windows 11 box
 * without RSAT, resetting a password does not unlock an account, an inherited
 * ACE cannot be removed until inheritance is broken. Where Windows would only
 * be tedious, they are simpler.
 */
import {
  DOMAIN_DN,
  DOMAIN_FQDN,
  type AdGroup,
  type AdUser,
  type DhcpScope,
  type EventEntry,
  type Host,
  type HostName,
  type LabFile,
  type LabState,
  type Nic,
  type NtfsAce,
  type ShareAce,
  findGroup,
  findUser,
  intToIp,
  ipToInt,
  isValidIp,
  maskToPrefix,
  prefixToMask,
  sameSubnet,
  internalNic,
  stamp,
} from './state';
import { dnsServersOf, locateDcProblem, ping, resolve } from './network';

export interface CommandResult {
  output: string;
  ok: boolean;
  /** The terminal should clear its screen. */
  clear?: boolean;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

interface Parsed {
  name: string;
  /** Lowercased parameter name → value. Switches are 'true'. */
  params: Record<string, string>;
  positional: string[];
  raw: string;
}

/** Parameters that never take a value, so they cannot swallow the next token. */
const SWITCHES = new Set([
  'restart',
  'force',
  'includemanagementtools',
  'lockedout',
  'accountdisabled',
  'reset',
  'asplaintext',
  'all',
  'passthru',
  'installdns',
  'resetserveraddresses',
  'noreboot',
  'properties-all',
  'accountinactive',
  'usersonly',
  'showmembertimetolive',
  'recurse',
  'append',
  'notypeinformation',
  'nonewline',
  'raw',
]);

function tokenize(line: string): string[] {
  const out: string[] = [];
  let buf = '';
  let quote: string | null = null;
  let depth = 0;
  for (const ch of line) {
    if (quote) {
      if (ch === quote) quote = null;
      else buf += ch;
      continue;
    }
    if (depth > 0) {
      buf += ch;
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '(') {
      depth = 1;
      buf += ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (buf) out.push(buf);
      buf = '';
      continue;
    }
    buf += ch;
  }
  if (buf) out.push(buf);
  // `a, b` is one list argument, however it was spaced.
  const merged: string[] = [];
  for (const t of out) {
    const prev = merged[merged.length - 1];
    if (prev !== undefined && (prev.endsWith(',') || t.startsWith(','))) {
      merged[merged.length - 1] = prev + t;
    } else merged.push(t);
  }
  return merged;
}

function normaliseValue(v: string): string {
  if (/^\$true$/i.test(v)) return 'true';
  if (/^\$false$/i.test(v)) return 'false';
  return v;
}

function parse(segment: string): Parsed {
  const tokens = tokenize(segment.trim());
  const name = tokens.shift() ?? '';
  const params: Record<string, string> = {};
  const positional: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (/^-[A-Za-z]/.test(t)) {
      const colon = t.indexOf(':');
      if (colon > 0) {
        params[t.slice(1, colon).toLowerCase()] = normaliseValue(t.slice(colon + 1));
        continue;
      }
      const key = t.slice(1).toLowerCase();
      // `-Filter*` typed without the space: the intent is `-Filter *`.
      if (key.length > 1 && key.endsWith('*')) {
        params[key.slice(0, -1)] = '*';
        continue;
      }
      const next = tokens[i + 1];
      if (!SWITCHES.has(key) && next !== undefined && !/^-[A-Za-z]/.test(next)) {
        params[key] = normaliseValue(next);
        i++;
      } else params[key] = 'true';
    } else positional.push(normaliseValue(t));
  }
  return { name, params, positional, raw: segment.trim() };
}

/** Split on `|` outside quotes and parentheses. */
function splitPipeline(line: string): string[] {
  const out: string[] = [];
  let buf = '';
  let quote: string | null = null;
  let depth = 0;
  for (const ch of line) {
    if (quote) {
      if (ch === quote) quote = null;
      buf += ch;
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === '|' && depth === 0) {
      out.push(buf);
      buf = '';
      continue;
    }
    buf += ch;
  }
  out.push(buf);
  return out.map((s) => s.trim()).filter(Boolean);
}

function list(v: string | undefined): string[] {
  if (!v) return [];
  return v
    .replace(/^@?\(/, '')
    .replace(/\)$/, '')
    .split(',')
    .map((x) => x.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);
}

/** The plaintext inside (ConvertTo-SecureString "..." -AsPlainText -Force). */
function secureStringText(v: string | undefined): string | null {
  if (!v) return null;
  const m = /ConvertTo-SecureString\s+(?:-String\s+)?["']([^"']*)["']/i.exec(v);
  if (m) return m[1]!;
  if (/Read-Host/i.test(v)) return 'Pa$$w0rd!2024';
  return null;
}

// ---------------------------------------------------------------------------
// Output helpers
// ---------------------------------------------------------------------------

const ok = (output: string): CommandResult => ({ output, ok: true });
const fail = (output: string): CommandResult => ({ output, ok: false });

function notRecognized(name: string): CommandResult {
  return fail(
    `${name} : The term '${name}' is not recognized as the name of a cmdlet, function, script file, ` +
      'or operable program. Check the spelling of the name, or if a path was included, verify that ' +
      'the path is correct and try again.',
  );
}

function table(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length)));
  const line = (cells: string[]): string =>
    cells
      .map((c, i) => c.padEnd(widths[i]!))
      .join(' ')
      .trimEnd();
  return ['', line(headers), line(widths.map((w) => '-'.repeat(w))), ...rows.map(line), ''].join(
    '\n',
  );
}

function props(pairs: [string, string | number | boolean | null][]): string {
  const w = Math.max(...pairs.map(([k]) => k.length));
  return (
    '\n' +
    pairs
      .map(
        ([k, v]) =>
          `${k.padEnd(w)} : ${v === null ? '' : typeof v === 'boolean' ? (v ? 'True' : 'False') : String(v)}`,
      )
      .join('\n') +
    '\n'
  );
}

function event(
  s: LabState,
  host: HostName,
  log: EventEntry['log'],
  id: number,
  level: EventEntry['level'],
  source: string,
  message: string,
  data?: EventEntry['data'],
): void {
  s.events.push({
    host,
    log,
    id,
    level,
    source,
    message,
    at: ++s.tick,
    time: stamp(s),
    ...(data ? { data } : {}),
  });
}

// ---------------------------------------------------------------------------
// Context each handler receives
// ---------------------------------------------------------------------------

interface Ctx {
  s: LabState;
  host: Host;
  p: Parsed;
  /** Objects handed down a pipeline: user sAMAccountNames. */
  input: string[];
  /** The previous pipeline stage's text output ('' for the first stage). */
  prev: string;
  /** Pipeline position: 0 for the first command. */
  stage: number;
}

interface HandlerResult extends CommandResult {
  /** Objects this command emits into a pipeline. */
  objects?: string[];
}

type Handler = (c: Ctx) => HandlerResult;

function arg(c: Ctx, ...names: string[]): string | undefined {
  for (const n of names) {
    const v = c.p.params[n.toLowerCase()];
    if (v !== undefined) return v;
  }
  return undefined;
}

function identityArg(c: Ctx): string | undefined {
  return arg(c, 'Identity') ?? c.p.positional[0];
}

function nicByAlias(h: Host, alias: string | undefined): Nic | undefined {
  if (!alias) return undefined;
  return h.nics.find((n) => n.alias.toLowerCase() === alias.toLowerCase());
}

function noSuchAdapter(alias: string | undefined): CommandResult {
  return fail(
    `No MSFT_NetAdapter objects found with property 'InterfaceAlias' equal to '${alias ?? ''}'. ` +
      'Verify the value of the property and retry. (Get-NetAdapter lists the adapters on this computer.)',
  );
}

/** AD cmdlets exist on DC01 once AD DS is installed, and never on CLIENT01 (no RSAT). */
function adGuard(c: Ctx, name: string): CommandResult | null {
  if (c.host.name === 'CLIENT01') return notRecognized(name);
  if (!c.host.features.includes('AD-Domain-Services')) return notRecognized(name);
  if (!c.s.ad.forest) {
    return fail(
      `${name} : Unable to find a default server with Active Directory Web Services running.`,
    );
  }
  return null;
}

function dhcpGuard(c: Ctx, name: string): CommandResult | null {
  if (c.host.name === 'CLIENT01' || !c.host.features.includes('DHCP')) return notRecognized(name);
  return null;
}

function containerExists(s: LabState, dn: string): boolean {
  const d = dn.toLowerCase();
  if (!s.ad.forest) return false;
  if (d === DOMAIN_DN.toLowerCase()) return true;
  if (d === `cn=users,${DOMAIN_DN}`.toLowerCase()) return true;
  if (d === `cn=computers,${DOMAIN_DN}`.toLowerCase()) return true;
  return s.ad.ous.some((o) => o.toLowerCase() === d);
}

function dnOf(o: { name: string; parent: string }): string {
  return `CN=${o.name},${o.parent}`;
}

function objectNotFound(identity: string): CommandResult {
  return fail(`Cannot find an object with identity: '${identity}' under: '${DOMAIN_DN}'.`);
}

function passwordMeetsPolicy(s: LabState, pw: string): boolean {
  if (pw.length < s.ad.passwordPolicy.minPasswordLength) return false;
  if (!s.ad.passwordPolicy.complexityEnabled) return true;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  return classes >= 3;
}

const PASSWORD_POLICY_ERROR =
  'The password does not meet the length, complexity, or history requirement of the domain.';

// ---------------------------------------------------------------------------
// Networking
// ---------------------------------------------------------------------------

function isApipa(ip: string | null): boolean {
  return !!ip && ip.startsWith('169.254.');
}

function effectiveOptions(
  s: LabState,
  scope: DhcpScope,
): { router: string | null; dns: string[]; dnsDomain: string | null } {
  return {
    router: scope.router ?? s.dhcp.serverOptions.router,
    dns: scope.dns.length > 0 ? scope.dns : s.dhcp.serverOptions.dns,
    dnsDomain: scope.dnsDomain ?? s.dhcp.serverOptions.dnsDomain,
  };
}

/** Why DC01 would not answer a DHCP request on the internal network, or null. */
export function dhcpServerProblem(s: LabState): string | null {
  const dc = s.hosts.DC01;
  if (!dc.features.includes('DHCP')) return 'not-installed';
  if (dc.services.DHCPServer !== 'Running') return 'service-stopped';
  // A DHCP server in a domain stays silent until it is authorised.
  if (s.ad.forest && !s.dhcp.authorized) return 'not-authorized';
  const nic = internalNic(dc);
  if (!nic?.ip || nic.dhcp || isApipa(nic.ip)) return 'server-address';
  const scope = s.dhcp.scopes.find((sc) => sameSubnet(sc.start, nic.ip!, sc.mask));
  if (!scope) return 'no-scope-for-subnet';
  if (!scope.active) return 'scope-inactive';
  return null;
}

function renewInternal(s: LabState, host: Host, nic: Nic): boolean {
  if (dhcpServerProblem(s) !== null) {
    nic.ip = `169.254.${(nic.mac.charCodeAt(15) % 200) + 20}.${(nic.mac.charCodeAt(16) % 200) + 10}`;
    nic.mask = '255.255.0.0';
    nic.gateway = null;
    nic.leaseFrom = null;
    if (!nic.dnsStatic) nic.dns = [];
    nic.connectionSuffix = null;
    return false;
  }
  const dcIp = internalNic(s.hosts.DC01)!.ip!;
  const scope = s.dhcp.scopes.find((sc) => sameSubnet(sc.start, dcIp, sc.mask))!;
  let lease = s.dhcp.leases.find((l) => l.mac === nic.mac && l.scopeId === scope.scopeId);
  if (!lease) {
    const used = new Set<string>([
      ...s.dhcp.leases.map((l) => l.ip),
      ...Object.values(s.hosts).flatMap((h) => h.nics.map((n) => n.ip ?? '')),
    ]);
    const start = ipToInt(scope.start)!;
    const end = ipToInt(scope.end)!;
    let pick: string | null = null;
    for (let n = start; n <= end; n++) {
      const cand = intToIp(n);
      if (!used.has(cand)) {
        pick = cand;
        break;
      }
    }
    if (!pick) return false;
    lease = {
      ip: pick,
      hostname: host.hostname.toLowerCase(),
      mac: nic.mac,
      scopeId: scope.scopeId,
    };
    s.dhcp.leases.push(lease);
  }
  const opts = effectiveOptions(s, scope);
  nic.ip = lease.ip;
  nic.mask = scope.mask;
  nic.gateway = opts.router;
  nic.leaseFrom = dcIp;
  // Static DNS servers win over the scope's option, exactly as on Windows.
  if (!nic.dnsStatic) nic.dns = [...opts.dns];
  nic.connectionSuffix = opts.dnsDomain;
  return true;
}

function renewNic(s: LabState, host: Host, nic: Nic): boolean {
  if (nic.network === 'internet') {
    nic.ip = '192.168.1.50';
    nic.mask = '255.255.255.0';
    nic.gateway = '192.168.1.1';
    if (!nic.dnsStatic) nic.dns = ['192.168.1.1'];
    nic.leaseFrom = '192.168.1.1';
    nic.connectionSuffix = 'home';
    return true;
  }
  return renewInternal(s, host, nic);
}

function ipconfigBlock(host: Host, nic: Nic, all: boolean): string {
  const lines = [`Ethernet adapter ${nic.alias}:`, ''];
  lines.push(`   Connection-specific DNS Suffix  . : ${nic.connectionSuffix ?? ''}`);
  if (all) {
    lines.push(`   Description . . . . . . . . . . . : Microsoft Hyper-V Network Adapter`);
    lines.push(`   Physical Address. . . . . . . . . : ${nic.mac}`);
    lines.push(`   DHCP Enabled. . . . . . . . . . . : ${nic.dhcp ? 'Yes' : 'No'}`);
    lines.push(`   Autoconfiguration Enabled . . . . : Yes`);
  }
  if (!nic.ip) {
    lines.push('   Media State . . . . . . . . . . . : (no IPv4 address)');
  } else {
    const label = isApipa(nic.ip)
      ? 'Autoconfiguration IPv4 Address. . '
      : 'IPv4 Address. . . . . . . . . . . ';
    lines.push(`   ${label}: ${nic.ip}${all ? '(Preferred)' : ''}`);
    lines.push(`   Subnet Mask . . . . . . . . . . . : ${nic.mask ?? ''}`);
  }
  lines.push(`   Default Gateway . . . . . . . . . : ${nic.gateway ?? ''}`);
  if (all) {
    if (nic.dhcp && nic.leaseFrom)
      lines.push(`   DHCP Server . . . . . . . . . . . : ${nic.leaseFrom}`);
    const dns = nic.dns.length ? nic.dns : [];
    lines.push(`   DNS Servers . . . . . . . . . . . : ${dns[0] ?? ''}`);
    for (const d of dns.slice(1)) lines.push(`                                       ${d}`);
  }
  void host;
  return lines.join('\n');
}

function ipconfig(c: Ctx): HandlerResult {
  const flag = (c.p.positional[0] ?? '').toLowerCase();
  const { host, s } = c;
  if (flag === '/release') {
    for (const nic of host.nics) {
      if (!nic.dhcp) continue;
      s.dhcp.leases = s.dhcp.leases.filter((l) => l.mac !== nic.mac);
      nic.ip = null;
      nic.mask = null;
      nic.gateway = null;
      if (!nic.dnsStatic) nic.dns = [];
      nic.leaseFrom = null;
    }
    return ok(
      '\nWindows IP Configuration\n\n' +
        host.nics.map((n) => ipconfigBlock(host, n, false)).join('\n\n'),
    );
  }
  if (flag === '/renew') {
    const dhcpNics = host.nics.filter((n) => n.dhcp);
    if (dhcpNics.length === 0) {
      return fail(
        '\nWindows IP Configuration\n\nThe operation failed as no adapter is in the state permissible for this operation.',
      );
    }
    const errors: string[] = [];
    for (const nic of dhcpNics) {
      if (!renewNic(s, host, nic)) {
        errors.push(
          `An error occurred while renewing interface ${nic.alias} : unable to contact your DHCP server. Request has timed out.`,
        );
        event(
          s,
          host.name,
          'System',
          1001,
          'Warning',
          'Dhcp-Client',
          `Your computer was not able to renew its address from the network (from the DHCP Server) for the Network Card with network address 0x${nic.mac.replace(/-/g, '')}.`,
        );
      }
    }
    const body = host.nics.map((n) => ipconfigBlock(host, n, false)).join('\n\n');
    return {
      output:
        '\nWindows IP Configuration\n\n' + (errors.length ? errors.join('\n') + '\n\n' : '') + body,
      ok: errors.length === 0,
    };
  }
  if (flag === '/flushdns') {
    return ok('\nWindows IP Configuration\n\nSuccessfully flushed the DNS Resolver Cache.');
  }
  if (flag === '/registerdns') {
    registerDns(s, host);
    return ok(
      '\nWindows IP Configuration\n\nRegistration of the DNS resource records for all adapters of this computer has been initiated.',
    );
  }
  const all = flag === '/all';
  const head = ['', 'Windows IP Configuration', ''];
  if (all) {
    head.push(`   Host Name . . . . . . . . . . . . : ${host.hostname}`);
    head.push(`   Primary Dns Suffix  . . . . . . . : ${host.domain ?? ''}`);
    head.push(`   Node Type . . . . . . . . . . . . : Hybrid`);
    head.push(
      `   IP Routing Enabled. . . . . . . . : ${host.name === 'DC01' && c.s.routing.configured ? 'Yes' : 'No'}`,
    );
    head.push('');
  }
  return ok(
    head.join('\n') + '\n' + host.nics.map((n) => ipconfigBlock(host, n, all)).join('\n\n'),
  );
}

function registerDns(s: LabState, host: Host): void {
  if (!host.domain || !s.ad.forest) return;
  const nic = internalNic(host);
  if (!nic?.ip || isApipa(nic.ip)) return;
  const dnsOk = resolve(s, host.name, host.domain);
  if (!dnsOk.ok) return;
  const name = host.hostname.toLowerCase();
  s.dns.records = s.dns.records.filter((r) => !(r.zone === s.ad.forest && r.name === name));
  s.dns.records.push({ zone: s.ad.forest, name, ip: nic.ip });
}

function pingCmd(c: Ctx): HandlerResult {
  const target = c.p.positional[0];
  if (!target) return fail('Usage: ping [-n count] target_name');
  let ip = target;
  if (!isValidIp(target)) {
    const r = resolve(c.s, c.host.name, target);
    if (!r.ok) {
      return fail(
        `Ping request could not find host ${target}. Please check the name and try again.`,
      );
    }
    ip = r.ip;
  }
  const res = ping(c.s, c.host.name, ip);
  const head = `\nPinging ${target === ip ? ip : `${target} [${ip}]`} with 32 bytes of data:`;
  if (res === 'ok') {
    const reply = `Reply from ${ip}: bytes=32 time<1ms TTL=128`;
    return ok(
      [
        head,
        reply,
        reply,
        reply,
        reply,
        '',
        `Ping statistics for ${ip}:`,
        '    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss),',
      ].join('\n'),
    );
  }
  const line = res === 'timeout' ? 'Request timed out.' : 'PING: transmit failed. General failure.';
  return fail(
    [
      head,
      line,
      line,
      line,
      line,
      '',
      `Ping statistics for ${ip}:`,
      '    Packets: Sent = 4, Received = 0, Lost = 4 (100% loss),',
    ].join('\n'),
  );
}

function nslookup(c: Ctx): HandlerResult {
  const name = c.p.positional[0];
  const explicitServer = c.p.positional[1];
  if (!name) return fail('Usage: nslookup name [server]');
  const servers = explicitServer ? [explicitServer] : dnsServersOf(c.s, c.host.name);
  const server = servers[0];
  if (!server) {
    return fail(
      "*** Default servers are not available\nServer:  UnKnown\nAddress:  127.0.0.1\n\n*** UnKnown can't find " +
        name +
        ': No response from server',
    );
  }
  // Ask exactly the server nslookup would ask: the explicit one, else the first.
  const saved = c.host.nics.map((n) => n.dns);
  if (explicitServer) for (const n of c.host.nics) n.dns = [explicitServer];
  else for (const n of c.host.nics) n.dns = n.dns.filter((d) => d === server).slice(0, 1);
  const r = resolve(c.s, c.host.name, name);
  c.host.nics.forEach((n, i) => (n.dns = saved[i]!));
  const serverName =
    server === '127.0.0.1'
      ? 'localhost'
      : server === c.s.hosts.DC01.nics.find((n) => n.network === 'internal')?.ip && c.s.ad.forest
        ? `${c.s.hosts.DC01.hostname.toLowerCase()}.${c.s.ad.forest}`
        : 'UnKnown';
  const head = `Server:  ${serverName}\nAddress:  ${server}\n`;
  if (r.ok) return ok(`${head}\nName:    ${name}\nAddress:  ${r.ip}`);
  if (r.reason === 'nxdomain')
    return fail(`${head}\n*** ${serverName} can't find ${name}: Non-existent domain`);
  return fail(
    `DNS request timed out.\n    timeout was 2 seconds.\n${head}\n*** Request to ${serverName} timed-out`,
  );
}

function resolveDnsName(c: Ctx): HandlerResult {
  const name = arg(c, 'Name') ?? c.p.positional[0];
  if (!name)
    return fail(
      'Resolve-DnsName : Cannot process command because of one or more missing mandatory parameters: Name.',
    );
  const r = resolve(c.s, c.host.name, name);
  if (r.ok)
    return ok(
      table(['Name', 'Type', 'TTL', 'Section', 'IPAddress'], [[name, 'A', '3600', 'Answer', r.ip]]),
    );
  if (r.reason === 'nxdomain') return fail(`Resolve-DnsName : ${name} : DNS name does not exist`);
  return fail(
    `Resolve-DnsName : ${name} : This operation returned because the timeout period expired`,
  );
}

function testNetConnection(c: Ctx): HandlerResult {
  const target = arg(c, 'ComputerName') ?? c.p.positional[0];
  if (!target) return fail('Test-NetConnection : ComputerName is required in this lab.');
  let ip = target;
  if (!isValidIp(target)) {
    const r = resolve(c.s, c.host.name, target);
    if (!r.ok)
      return fail(
        `WARNING: Name resolution of ${target} failed\n` +
          props([
            ['ComputerName', target],
            ['RemoteAddress', ''],
            ['PingSucceeded', false],
          ]),
      );
    ip = r.ip;
  }
  const res = ping(c.s, c.host.name, ip);
  const src = internalNic(c.host)?.ip ?? c.host.nics[0]?.ip ?? '';
  return {
    ...ok(
      props([
        ['ComputerName', target],
        ['RemoteAddress', ip],
        ['InterfaceAlias', internalNic(c.host)?.alias ?? ''],
        ['SourceAddress', src],
        ['PingSucceeded', res === 'ok'],
      ]),
    ),
    ok: res === 'ok',
  };
}

function getNetAdapter(c: Ctx): HandlerResult {
  return ok(
    table(
      ['Name', 'InterfaceDescription', 'Status', 'MacAddress', 'LinkSpeed'],
      c.host.nics.map((n) => [
        n.alias,
        'Microsoft Hyper-V Network Adapter',
        'Up',
        n.mac,
        '10 Gbps',
      ]),
    ),
  );
}

function getNetIPConfiguration(c: Ctx): HandlerResult {
  const alias = arg(c, 'InterfaceAlias');
  const nics = alias
    ? c.host.nics.filter((n) => n.alias.toLowerCase() === alias.toLowerCase())
    : c.host.nics;
  if (alias && nics.length === 0) return noSuchAdapter(alias);
  return ok(
    nics
      .map((n) =>
        props([
          ['InterfaceAlias', n.alias],
          ['InterfaceDescription', 'Microsoft Hyper-V Network Adapter'],
          ['IPv4Address', n.ip],
          ['IPv4DefaultGateway', n.gateway],
          ['DNSServer', n.dns.join(', ')],
        ]),
      )
      .join(''),
  );
}

function getNetIPAddress(c: Ctx): HandlerResult {
  return ok(
    table(
      ['IPAddress', 'InterfaceAlias', 'PrefixLength', 'PrefixOrigin'],
      c.host.nics
        .filter((n) => n.ip)
        .map((n) => [
          n.ip!,
          n.alias,
          String(maskToPrefix(n.mask ?? '') ?? ''),
          n.dhcp ? (isApipa(n.ip) ? 'WellKnown' : 'Dhcp') : 'Manual',
        ]),
    ),
  );
}

function setStatic(
  s: LabState,
  host: Host,
  nic: Nic,
  ip: string,
  mask: string,
  gateway: string | null,
): void {
  s.dhcp.leases = s.dhcp.leases.filter((l) => l.mac !== nic.mac);
  nic.dhcp = false;
  nic.ip = ip;
  nic.mask = mask;
  nic.gateway = gateway;
  nic.leaseFrom = null;
  nic.connectionSuffix = null;
  void host;
}

function newNetIPAddress(c: Ctx): HandlerResult {
  const alias = arg(c, 'InterfaceAlias');
  const nic = nicByAlias(c.host, alias);
  if (!nic) return noSuchAdapter(alias);
  const ip = arg(c, 'IPAddress');
  const prefix = Number(arg(c, 'PrefixLength') ?? 'NaN');
  const gw = arg(c, 'DefaultGateway') ?? null;
  if (!ip || !isValidIp(ip))
    return fail(`New-NetIPAddress : Invalid parameter IPAddress '${ip ?? ''}'.`);
  if (!Number.isInteger(prefix) || prefix < 1 || prefix > 32) {
    return fail(
      'New-NetIPAddress : Cannot process command because of one or more missing mandatory parameters: PrefixLength.',
    );
  }
  if (gw !== null && !isValidIp(gw))
    return fail(`New-NetIPAddress : Invalid parameter DefaultGateway '${gw}'.`);
  const conflict = Object.values(c.s.hosts).find(
    (h) => h !== c.host && h.nics.some((n) => n.ip === ip),
  );
  setStatic(c.s, c.host, nic, ip, prefixToMask(prefix), gw);
  if (conflict) {
    event(
      c.s,
      c.host.name,
      'System',
      4199,
      'Error',
      'Tcpip',
      `The system detected an address conflict for IP address ${ip} with the system having network hardware address ${conflict.nics[0]?.mac ?? ''}.`,
    );
  }
  return ok(
    props([
      ['IPAddress', ip],
      ['InterfaceAlias', nic.alias],
      ['AddressFamily', 'IPv4'],
      ['Type', 'Unicast'],
      ['PrefixLength', prefix],
      ['PrefixOrigin', 'Manual'],
      ['AddressState', conflict ? 'Duplicate' : 'Preferred'],
    ]),
  );
}

function removeNetIPAddress(c: Ctx): HandlerResult {
  const alias = arg(c, 'InterfaceAlias');
  const ip = arg(c, 'IPAddress');
  const nic = alias ? nicByAlias(c.host, alias) : c.host.nics.find((n) => n.ip === ip);
  if (!nic) return noSuchAdapter(alias);
  nic.ip = null;
  nic.mask = null;
  return ok('');
}

function removeNetRoute(c: Ctx): HandlerResult {
  const alias = arg(c, 'InterfaceAlias');
  const nic = nicByAlias(c.host, alias);
  if (!nic) return noSuchAdapter(alias);
  nic.gateway = null;
  return ok('');
}

function setNetIPInterface(c: Ctx): HandlerResult {
  const alias = arg(c, 'InterfaceAlias');
  const nic = nicByAlias(c.host, alias);
  if (!nic) return noSuchAdapter(alias);
  const dhcp = (arg(c, 'Dhcp') ?? '').toLowerCase();
  if (dhcp === 'enabled') {
    nic.dhcp = true;
    nic.gateway = null;
    const got = renewNic(c.s, c.host, nic);
    return ok(got ? '' : '');
  }
  if (dhcp === 'disabled') {
    nic.dhcp = false;
    nic.leaseFrom = null;
    return ok('');
  }
  return fail('Set-NetIPInterface : In this lab use -Dhcp Enabled or -Dhcp Disabled.');
}

function setDnsClient(c: Ctx): HandlerResult {
  const alias = arg(c, 'InterfaceAlias', 'InterfaceIndex');
  const nic = nicByAlias(c.host, alias);
  if (!nic) return noSuchAdapter(alias);
  if (arg(c, 'ResetServerAddresses') === 'true') {
    nic.dnsStatic = false;
    const lease = c.s.dhcp.leases.find((l) => l.mac === nic.mac);
    const scope = lease ? c.s.dhcp.scopes.find((sc) => sc.scopeId === lease.scopeId) : undefined;
    nic.dns =
      nic.dhcp && scope
        ? [...effectiveOptions(c.s, scope).dns]
        : nic.network === 'internet' && nic.dhcp
          ? ['192.168.1.1']
          : [];
    return ok('');
  }
  const servers = list(arg(c, 'ServerAddresses'));
  if (servers.length === 0)
    return fail('Set-DnsClientServerAddress : Specify -ServerAddresses or -ResetServerAddresses.');
  const bad = servers.find((x) => !isValidIp(x));
  if (bad) return fail(`Set-DnsClientServerAddress : The IP address '${bad}' is not valid.`);
  nic.dns = servers;
  nic.dnsStatic = true;
  return ok('');
}

function getDnsClient(c: Ctx): HandlerResult {
  return ok(
    table(
      ['InterfaceAlias', 'AddressFamily', 'ServerAddresses'],
      c.host.nics.map((n) => [n.alias, 'IPv4', `{${n.dns.join(', ')}}`]),
    ),
  );
}

/** netsh interface ip set address / set dns, and the RRAS NAT commands. */
function netsh(c: Ctx): HandlerResult {
  const words = c.p.positional.map((w) => w.toLowerCase());
  const kv = (k: string): string | undefined => {
    const hit = c.p.positional.find((w) => w.toLowerCase().startsWith(`${k}=`));
    return hit?.slice(k.length + 1);
  };
  const joined = words.join(' ');
  if (/^interface ipv?4? set address/.test(joined)) {
    const rest = c.p.positional.slice(4);
    const alias = kv('name') ?? rest[0];
    const nic = nicByAlias(c.host, alias);
    if (!nic)
      return fail(
        `The filename, directory name, or volume label syntax is incorrect. (No adapter named "${alias ?? ''}".)`,
      );
    const positional = rest.filter((w) => !w.includes('=')).slice(alias === rest[0] ? 1 : 0);
    const source = (kv('source') ?? positional[0] ?? '').toLowerCase();
    if (source === 'dhcp') {
      nic.dhcp = true;
      nic.gateway = null;
      renewNic(c.s, c.host, nic);
      return ok('');
    }
    const ip = kv('address') ?? positional[1];
    const mask = kv('mask') ?? positional[2];
    const gw = kv('gateway') ?? positional[3] ?? null;
    if (source !== 'static' || !ip || !mask || !isValidIp(ip) || maskToPrefix(mask) === null) {
      return fail(
        'The syntax supplied for this command is not valid. Check help for the correct syntax.\nUsage: netsh interface ip set address "Name" static IP MASK [GATEWAY]',
      );
    }
    setStatic(c.s, c.host, nic, ip, mask, gw && gw.toLowerCase() !== 'none' ? gw : null);
    return ok('');
  }
  if (/^interface ipv?4? set dns/.test(joined)) {
    const rest = c.p.positional.slice(4);
    const alias = kv('name') ?? rest[0];
    const nic = nicByAlias(c.host, alias);
    if (!nic) return fail(`No adapter named "${alias ?? ''}".`);
    const positional = rest.filter((w) => !w.includes('=')).slice(alias === rest[0] ? 1 : 0);
    const source = (kv('source') ?? positional[0] ?? '').toLowerCase();
    if (source === 'dhcp') {
      c.p.params.resetserveraddresses = 'true';
      c.p.params.interfacealias = nic.alias;
      return setDnsClient(c);
    }
    const addr = kv('address') ?? positional[1];
    if (source !== 'static' || !addr || !isValidIp(addr))
      return fail('Usage: netsh interface ip set dns "Name" static ADDRESS');
    nic.dns = [addr];
    nic.dnsStatic = true;
    return ok('');
  }
  if (joined.startsWith('routing ip nat')) {
    if (c.host.name !== 'DC01' || !c.s.routing.configured) {
      return fail(
        'The following command was not found: routing ip nat. (Routing and Remote Access is not configured on this server.)',
      );
    }
    if (joined === 'routing ip nat install') {
      c.s.routing.natInstalled = true;
      return ok('Ok.');
    }
    if (joined.startsWith('routing ip nat add interface')) {
      if (!c.s.routing.natInstalled)
        return fail('The NAT routing protocol is not installed. Run: netsh routing ip nat install');
      const rest = c.p.positional.slice(5);
      const alias = kv('name') ?? rest[0];
      const nic = nicByAlias(c.host, alias);
      if (!nic) return fail(`The interface "${alias ?? ''}" was not found.`);
      const mode = (kv('mode') ?? rest.filter((w) => !w.includes('='))[1] ?? '').toLowerCase();
      if (mode === 'full') c.s.routing.natInterfaces[nic.alias] = 'public';
      else if (mode === 'private') c.s.routing.natInterfaces[nic.alias] = 'private';
      else return fail('Usage: netsh routing ip nat add interface "Name" full|private');
      return ok('Ok.');
    }
    if (joined.startsWith('routing ip nat delete interface')) {
      const alias = kv('name') ?? c.p.positional[5];
      const nic = nicByAlias(c.host, alias);
      if (nic) delete c.s.routing.natInterfaces[nic.alias];
      return ok('Ok.');
    }
    if (joined.startsWith('routing ip nat show interface')) {
      const rows = Object.entries(c.s.routing.natInterfaces);
      if (rows.length === 0) return ok('No NAT interfaces are configured.');
      return ok(
        rows
          .map(
            ([a, m]) =>
              `NAT ${a} Configuration\n---------------------------\nMode              : ${m === 'public' ? 'Public interface with NAT (full)' : 'Private interface'}`,
          )
          .join('\n\n'),
      );
    }
  }
  return fail(`The following command was not found: ${c.p.positional.join(' ')}.`);
}

// ---------------------------------------------------------------------------
// Computer identity, features, restart
// ---------------------------------------------------------------------------

function renameComputer(c: Ctx): HandlerResult {
  const name = arg(c, 'NewName') ?? c.p.positional[0];
  if (!name)
    return fail(
      'Rename-Computer : Cannot process command because of one or more missing mandatory parameters: NewName.',
    );
  if (!/^[A-Za-z0-9-]{1,15}$/.test(name))
    return fail(
      `Rename-Computer : The new name '${name}' is not a valid computer name (15 characters, letters, digits and hyphens).`,
    );
  if (c.host.name === 'DC01' && c.s.ad.forest) {
    return fail(
      'Rename-Computer : Renaming a domain controller is out of scope for this lab. Rename servers before promoting them.',
    );
  }
  c.host.pendingHostname = name.toUpperCase();
  c.host.restartPending = true;
  if (arg(c, 'Restart') === 'true') return restart(c, `Renamed. `);
  return ok(
    `WARNING: The changes will take effect after you restart the computer ${c.host.hostname}.`,
  );
}

function restart(c: Ctx, prefix = ''): HandlerResult {
  const h = c.host;
  const s = c.s;
  if (h.pendingHostname) {
    h.hostname = h.pendingHostname;
    h.pendingHostname = null;
    for (const l of s.dhcp.leases)
      if (h.nics.some((n) => n.mac === l.mac)) l.hostname = h.hostname.toLowerCase();
  }
  if (h.pendingDomain) {
    h.domain = h.pendingDomain;
    h.pendingDomain = null;
    h.services.Netlogon = 'Running';
  }
  h.restartPending = false;
  for (const nic of h.nics) if (nic.dhcp && nic.network === 'internal') renewInternal(s, h, nic);
  if (h.domain) {
    registerDns(s, h);
    applyGpos(s, h);
  }
  event(s, h.name, 'System', 6005, 'Information', 'EventLog', 'The Event log service was started.');
  return ok(`${prefix}${h.hostname} restarted. You are signed back in.`);
}

const FEATURES: Record<string, string> = {
  'ad-domain-services': 'AD-Domain-Services',
  dns: 'DNS',
  dhcp: 'DHCP',
  remoteaccess: 'RemoteAccess',
  routing: 'Routing',
  'directaccess-vpn': 'DirectAccess-VPN',
  'rsat-ad-tools': 'RSAT-AD-Tools',
  gpmc: 'GPMC',
  'fs-fileserver': 'FS-FileServer',
};

const FEATURE_DISPLAY: Record<string, string> = {
  'AD-Domain-Services': 'Active Directory Domain Services',
  DNS: 'DNS Server',
  DHCP: 'DHCP Server',
  RemoteAccess: 'Remote Access',
  Routing: 'Routing',
  'DirectAccess-VPN': 'DirectAccess and VPN (RAS)',
  'RSAT-AD-Tools': 'AD DS and AD LDS Tools',
  GPMC: 'Group Policy Management',
  'FS-FileServer': 'File Server',
};

function getWindowsFeature(c: Ctx): HandlerResult {
  if (c.host.name === 'CLIENT01') {
    return fail(
      'Get-WindowsFeature : The target of the specified cmdlet cannot be a Windows client-based operating system.',
    );
  }
  const filter = (arg(c, 'Name') ?? c.p.positional[0] ?? '').toLowerCase().replace(/\*/g, '');
  const rows = Object.values(FEATURES)
    .filter((f) => !filter || f.toLowerCase().includes(filter))
    .map((f) => [
      `[${c.host.features.includes(f) ? 'X' : ' '}] ${FEATURE_DISPLAY[f]}`,
      f,
      c.host.features.includes(f) ? 'Installed' : 'Available',
    ]);
  return ok(table(['Display Name', 'Name', 'Install State'], rows));
}

function installWindowsFeature(c: Ctx): HandlerResult {
  if (c.host.name === 'CLIENT01') {
    return fail(
      'Install-WindowsFeature : The target of the specified cmdlet cannot be a Windows client-based operating system.',
    );
  }
  const names = list(arg(c, 'Name') ?? c.p.positional.join(','));
  if (names.length === 0)
    return fail(
      'Install-WindowsFeature : Cannot process command because of one or more missing mandatory parameters: Name.',
    );
  const installed: string[] = [];
  for (const raw of names) {
    const f = FEATURES[raw.toLowerCase()];
    if (!f)
      return fail(
        `Install-WindowsFeature : ArgumentNotValid: The role, role service, or feature name is not valid: '${raw}'. The name was not found.`,
      );
    if (f === 'Routing' && !c.host.features.includes('RemoteAccess'))
      c.host.features.push('RemoteAccess');
    if (!c.host.features.includes(f)) {
      c.host.features.push(f);
      installed.push(FEATURE_DISPLAY[f] ?? f);
    }
    if (f === 'DHCP') c.host.services.DHCPServer = 'Running';
    if (f === 'DNS') c.host.services.DNS = c.host.services.DNS ?? 'Running';
    if (f === 'RemoteAccess' || f === 'Routing')
      c.host.services.RemoteAccess = c.host.services.RemoteAccess ?? 'Stopped';
  }
  if (
    arg(c, 'IncludeManagementTools') === 'true' &&
    !c.host.features.includes('RSAT-AD-Tools') &&
    names.some((n) => /ad-domain/i.test(n))
  ) {
    c.host.features.push('RSAT-AD-Tools', 'GPMC');
  }
  return ok(
    table(
      ['Success', 'Restart Needed', 'Exit Code', 'Feature Result'],
      [
        [
          'True',
          'No',
          installed.length ? 'Success' : 'NoChangeNeeded',
          `{${installed.join(', ')}}`,
        ],
      ],
    ),
  );
}

function installRemoteAccess(c: Ctx): HandlerResult {
  if (c.host.name !== 'DC01' || !c.host.features.includes('RemoteAccess'))
    return notRecognized('Install-RemoteAccess');
  const type = (arg(c, 'VpnType') ?? '').toLowerCase();
  if (type !== 'routingonly') {
    return fail(
      'Install-RemoteAccess : This lab uses routing and NAT only. Use -VpnType RoutingOnly.',
    );
  }
  if (!c.host.features.includes('Routing')) {
    return fail(
      'Install-RemoteAccess : The Routing role service is not installed. Install-WindowsFeature Routing first.',
    );
  }
  c.s.routing.configured = true;
  c.host.services.RemoteAccess = 'Running';
  return ok(
    'Routing and Remote Access is configured for routing only. The RemoteAccess service is running.',
  );
}

function getRemoteAccess(c: Ctx): HandlerResult {
  if (c.host.name !== 'DC01' || !c.host.features.includes('RemoteAccess'))
    return notRecognized('Get-RemoteAccess');
  const r = c.s.routing;
  return ok(
    props([
      ['RoutingStatus', r.configured ? 'Installed' : 'Uninstalled'],
      ['NatInstalled', r.natInstalled],
      [
        'NatPublic',
        Object.entries(r.natInterfaces)
          .filter(([, m]) => m === 'public')
          .map(([a]) => a)
          .join(', '),
      ],
      [
        'NatPrivate',
        Object.entries(r.natInterfaces)
          .filter(([, m]) => m === 'private')
          .map(([a]) => a)
          .join(', '),
      ],
      ['ServiceStatus', c.host.services.RemoteAccess ?? 'Not installed'],
    ]),
  );
}

// ---------------------------------------------------------------------------
// AD DS promotion and domain join
// ---------------------------------------------------------------------------

function installADDSForest(c: Ctx): HandlerResult {
  if (c.host.name === 'CLIENT01' || !c.host.features.includes('AD-Domain-Services'))
    return notRecognized('Install-ADDSForest');
  const s = c.s;
  if (s.ad.forest)
    return fail('Install-ADDSForest : This computer is already a domain controller.');
  const fqdn = (arg(c, 'DomainName') ?? '').toLowerCase();
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(fqdn)) {
    return fail(
      'Install-ADDSForest : Verification of prerequisites for Domain Controller promotion failed. The specified domain name is not a valid fully qualified DNS name.',
    );
  }
  const netbios = (arg(c, 'DomainNetbiosName') ?? fqdn.split('.')[0]!).toUpperCase();
  const warnings: string[] = [];
  const nic = internalNic(c.host)!;
  if (nic.dhcp || !nic.ip || isApipa(nic.ip)) {
    warnings.push(
      'WARNING: This computer has at least one physical network adapter that does not have static IP address(es) assigned to its IP Properties.',
    );
  }
  const dn = fqdn
    .split('.')
    .map((p) => `DC=${p}`)
    .join(',');
  s.ad.forest = fqdn;
  s.ad.netbios = netbios;
  s.ad.ous = [`OU=Domain Controllers,${dn}`];
  s.ad.users = [
    mkUser('Administrator', 'Administrator', '', '', `CN=Users,${dn}`),
    { ...mkUser('krbtgt', 'krbtgt', '', '', `CN=Users,${dn}`), enabled: false },
  ];
  s.ad.groups = [
    {
      name: 'Domain Admins',
      parent: `CN=Users,${dn}`,
      scope: 'Global',
      category: 'Security',
      members: ['Administrator'],
      builtin: true,
    },
    {
      name: 'Domain Users',
      parent: `CN=Users,${dn}`,
      scope: 'Global',
      category: 'Security',
      members: [],
      builtin: true,
    },
    {
      name: 'Domain Computers',
      parent: `CN=Users,${dn}`,
      scope: 'Global',
      category: 'Security',
      members: [],
      builtin: true,
    },
    {
      name: 'Enterprise Admins',
      parent: `CN=Users,${dn}`,
      scope: 'Universal',
      category: 'Security',
      members: ['Administrator'],
      builtin: true,
    },
  ];
  s.ad.computers = [{ name: c.host.hostname, parent: `OU=Domain Controllers,${dn}` }];
  s.ad.gpos = [
    { name: 'Default Domain Policy', links: [dn] },
    { name: 'Default Domain Controllers Policy', links: [`OU=Domain Controllers,${dn}`] },
  ];
  if (!c.host.features.includes('DNS')) c.host.features.push('DNS');
  Object.assign(c.host.services, {
    NTDS: 'Running',
    DNS: 'Running',
    Netlogon: 'Running',
    Kdc: 'Running',
    ADWS: 'Running',
  });
  c.host.domain = fqdn;
  s.dns.zones = [fqdn, `_msdcs.${fqdn}`];
  // A DC registers every adapter it has — the internal one is the one that matters.
  const regIp =
    nic.ip && !isApipa(nic.ip)
      ? nic.ip
      : (c.host.nics.find((n) => n.network === 'internet')?.ip ?? '');
  s.dns.records = [
    { zone: fqdn, name: '@', ip: regIp },
    { zone: fqdn, name: c.host.hostname.toLowerCase(), ip: regIp },
  ];
  event(
    s,
    'DC01',
    'Directory Service',
    1000,
    'Information',
    'ActiveDirectory_DomainService',
    `Microsoft Active Directory Domain Services startup complete. Forest root: ${fqdn}.`,
  );
  const r = restart(c);
  return ok(
    [
      ...warnings,
      `Validating environment and user input... All tests completed successfully.`,
      `Installing new forest ${fqdn} (NetBIOS ${netbios}) with DNS Server...`,
      'The target server will be configured as a domain controller and restarted.',
      r.output,
    ].join('\n'),
  );
}

function mkUser(sam: string, name: string, given: string, surname: string, parent: string): AdUser {
  return {
    sam,
    name,
    givenName: given,
    surname,
    parent,
    enabled: true,
    lockedOut: false,
    badPwdCount: 0,
    passwordSet: true,
    changePasswordAtLogon: false,
    passwordLastResetByAdmin: null,
    department: null,
  };
}

function getADDomain(c: Ctx): HandlerResult {
  const g = adGuard(c, c.p.name);
  if (g) return g;
  const s = c.s;
  return ok(
    props([
      ['DNSRoot', s.ad.forest],
      ['NetBIOSName', s.ad.netbios],
      ['DistinguishedName', DOMAIN_DN_FOR(s)],
      ['DomainMode', 'Windows2016Domain'],
      ['PDCEmulator', `${c.s.hosts.DC01.hostname}.${s.ad.forest}`],
      ['UsersContainer', `CN=Users,${DOMAIN_DN_FOR(s)}`],
      ['ComputersContainer', `CN=Computers,${DOMAIN_DN_FOR(s)}`],
    ]),
  );
}

function DOMAIN_DN_FOR(s: LabState): string {
  return (s.ad.forest ?? DOMAIN_FQDN)
    .split('.')
    .map((p) => `DC=${p}`)
    .join(',');
}

function addComputer(c: Ctx): HandlerResult {
  const s = c.s;
  const h = c.host;
  const domain = (arg(c, 'DomainName') ?? c.p.positional[0] ?? '').toLowerCase();
  if (!domain)
    return fail(
      'Add-Computer : Cannot process command because of one or more missing mandatory parameters: DomainName.',
    );
  if (h.name === 'DC01')
    return fail('Add-Computer : DC01 is the domain controller; it is already part of its domain.');
  if (h.domain)
    return fail(
      `Add-Computer : Cannot add computer '${h.hostname}' to domain '${domain}' because it is already in that domain.`,
    );
  const failMsg = `Add-Computer : Computer '${h.hostname}' failed to join domain '${domain}' from its current workgroup 'WORKGROUP' with following error message: The specified domain either does not exist or could not be contacted.`;
  const problem = s.ad.forest === domain ? locateDcProblem(s, h.name) : 'no-forest';
  if (problem) {
    event(
      s,
      h.name,
      'System',
      4097,
      'Error',
      'NetSetup',
      `The machine ${h.hostname} attempted to join the domain ${domain} but failed. The error code was 1355 (ERROR_NO_SUCH_DOMAIN).`,
    );
    return fail(failMsg);
  }
  const ouPath = arg(c, 'OUPath');
  if (ouPath && !containerExists(s, ouPath)) {
    return fail(
      `Add-Computer : Computer '${h.hostname}' failed to join domain '${domain}': The OU path '${ouPath}' does not exist.`,
    );
  }
  h.pendingDomain = domain;
  h.restartPending = true;
  s.ad.computers = s.ad.computers.filter((x) => x.name.toLowerCase() !== h.hostname.toLowerCase());
  s.ad.computers.push({ name: h.hostname, parent: ouPath ?? `CN=Computers,${DOMAIN_DN_FOR(s)}` });
  const cred = arg(c, 'Credential');
  const note = cred ? '' : `(Credential prompt: ${s.ad.netbios}\\Administrator — accepted.)\n`;
  if (arg(c, 'Restart') === 'true') return ok(note + restart(c, `Joined ${domain}. `).output);
  return ok(
    note + `WARNING: The changes will take effect after you restart the computer ${h.hostname}.`,
  );
}

function testSecureChannel(c: Ctx): HandlerResult {
  if (!c.host.domain)
    return fail(
      'Test-ComputerSecureChannel : Cannot verify the secure channel password for the local computer. The computer is not joined to a domain.',
    );
  const good = locateDcProblem(c.s, c.host.name) === null;
  return { output: good ? 'True' : 'False', ok: good };
}

// ---------------------------------------------------------------------------
// DHCP
// ---------------------------------------------------------------------------

function addDhcpServerInDC(c: Ctx): HandlerResult {
  const g = dhcpGuard(c, 'Add-DhcpServerInDC');
  if (g) return g;
  if (!c.s.ad.forest) {
    return fail(
      'Add-DhcpServerInDC : Failed to initialize directory service for DHCP authorization. This computer is not in a domain.',
    );
  }
  c.s.dhcp.authorized = true;
  event(
    c.s,
    'DC01',
    'System',
    1044,
    'Information',
    'Microsoft-Windows-DHCP-Server',
    `The DHCP/BINL service on the local machine, belonging to the Windows Administrative domain ${c.s.ad.forest}, has determined that it is authorized to start.`,
  );
  return ok('');
}

function getDhcpServerInDC(c: Ctx): HandlerResult {
  const g = dhcpGuard(c, 'Get-DhcpServerInDC');
  if (g) return g;
  if (!c.s.dhcp.authorized) return ok('');
  return ok(
    table(
      ['IPAddress', 'DnsName'],
      [[internalNic(c.host)?.ip ?? '', `${c.host.hostname.toLowerCase()}.${c.s.ad.forest ?? ''}`]],
    ),
  );
}

function addDhcpScope(c: Ctx): HandlerResult {
  const g = dhcpGuard(c, 'Add-DhcpServerv4Scope');
  if (g) return g;
  const start = arg(c, 'StartRange');
  const end = arg(c, 'EndRange');
  const mask = arg(c, 'SubnetMask');
  const name = arg(c, 'Name') ?? 'Scope';
  if (!start || !end || !mask) {
    return fail(
      'Add-DhcpServerv4Scope : Cannot process command because of one or more missing mandatory parameters: StartRange EndRange SubnetMask.',
    );
  }
  if (!isValidIp(start) || !isValidIp(end) || maskToPrefix(mask) === null) {
    return fail('Add-DhcpServerv4Scope : One of the IP addresses or the subnet mask is not valid.');
  }
  if (!sameSubnet(start, end, mask) || ipToInt(start)! > ipToInt(end)!) {
    return fail(
      `Add-DhcpServerv4Scope : Failed to add scope. The start range ${start} and end range ${end} are not in the same subnet or the range is reversed.`,
    );
  }
  const scopeId = intToIp((ipToInt(start)! & ipToInt(mask)!) >>> 0);
  if (c.s.dhcp.scopes.some((sc) => sc.scopeId === scopeId)) {
    return fail(
      `Add-DhcpServerv4Scope : Failed to add scope ${scopeId} on DHCP server. The specified IPv4 subnet already exists.`,
    );
  }
  const state = (arg(c, 'State') ?? 'Active').toLowerCase();
  c.s.dhcp.scopes.push({
    scopeId,
    name,
    start,
    end,
    mask,
    active: state !== 'inactive',
    router: null,
    dns: [],
    dnsDomain: null,
  });
  return ok('');
}

function scopeById(c: Ctx): DhcpScope | undefined {
  const id = arg(c, 'ScopeId') ?? c.p.positional[0];
  return c.s.dhcp.scopes.find((sc) => sc.scopeId === id);
}

function setDhcpScope(c: Ctx): HandlerResult {
  const g = dhcpGuard(c, 'Set-DhcpServerv4Scope');
  if (g) return g;
  const sc = scopeById(c);
  if (!sc)
    return fail(
      `Set-DhcpServerv4Scope : Failed to get scope ${arg(c, 'ScopeId') ?? ''} on DHCP server. The specified IPv4 subnet does not exist.`,
    );
  const state = arg(c, 'State');
  if (state) sc.active = state.toLowerCase() === 'active';
  const start = arg(c, 'StartRange');
  const end = arg(c, 'EndRange');
  if (start && isValidIp(start)) sc.start = start;
  if (end && isValidIp(end)) sc.end = end;
  const name = arg(c, 'Name');
  if (name) sc.name = name;
  return ok('');
}

function removeDhcpScope(c: Ctx): HandlerResult {
  const g = dhcpGuard(c, 'Remove-DhcpServerv4Scope');
  if (g) return g;
  const sc = scopeById(c);
  if (!sc) return fail('Remove-DhcpServerv4Scope : The specified IPv4 subnet does not exist.');
  c.s.dhcp.scopes = c.s.dhcp.scopes.filter((x) => x !== sc);
  c.s.dhcp.leases = c.s.dhcp.leases.filter((l) => l.scopeId !== sc.scopeId);
  return ok('');
}

function getDhcpScope(c: Ctx): HandlerResult {
  const g = dhcpGuard(c, 'Get-DhcpServerv4Scope');
  if (g) return g;
  return ok(
    table(
      ['ScopeId', 'SubnetMask', 'Name', 'State', 'StartRange', 'EndRange'],
      c.s.dhcp.scopes.map((sc) => [
        sc.scopeId,
        sc.mask,
        sc.name,
        sc.active ? 'Active' : 'Inactive',
        sc.start,
        sc.end,
      ]),
    ),
  );
}

function setDhcpOption(c: Ctx): HandlerResult {
  const g = dhcpGuard(c, 'Set-DhcpServerv4OptionValue');
  if (g) return g;
  const hasScope = arg(c, 'ScopeId') !== undefined;
  const sc = hasScope ? scopeById(c) : undefined;
  if (hasScope && !sc)
    return fail('Set-DhcpServerv4OptionValue : The specified IPv4 subnet does not exist.');
  const target = sc ?? c.s.dhcp.serverOptions;
  const router = arg(c, 'Router');
  const dns = arg(c, 'DnsServer');
  const domain = arg(c, 'DnsDomain');
  for (const v of [router, ...list(dns)]) {
    if (v && !isValidIp(v))
      return fail(`Set-DhcpServerv4OptionValue : '${v}' is not a valid IPv4 address.`);
  }
  if (router !== undefined) target.router = list(router)[0] ?? null;
  if (dns !== undefined) target.dns = list(dns);
  if (domain !== undefined) target.dnsDomain = domain;
  if (router === undefined && dns === undefined && domain === undefined) {
    return fail(
      'Set-DhcpServerv4OptionValue : Specify at least one of -Router, -DnsServer or -DnsDomain.',
    );
  }
  return ok('');
}

function getDhcpOption(c: Ctx): HandlerResult {
  const g = dhcpGuard(c, 'Get-DhcpServerv4OptionValue');
  if (g) return g;
  const hasScope = arg(c, 'ScopeId') !== undefined;
  const sc = hasScope ? scopeById(c) : undefined;
  if (hasScope && !sc)
    return fail('Get-DhcpServerv4OptionValue : The specified IPv4 subnet does not exist.');
  const o = sc ?? c.s.dhcp.serverOptions;
  const rows: string[][] = [];
  if (o.router) rows.push(['3', 'Router', `{${o.router}}`]);
  if (o.dns.length) rows.push(['6', 'DNS Servers', `{${o.dns.join(', ')}}`]);
  if (o.dnsDomain) rows.push(['15', 'DNS Domain Name', `{${o.dnsDomain}}`]);
  return ok(table(['OptionId', 'Name', 'Value'], rows));
}

function getDhcpLease(c: Ctx): HandlerResult {
  const g = dhcpGuard(c, 'Get-DhcpServerv4Lease');
  if (g) return g;
  const id = arg(c, 'ScopeId');
  const leases = c.s.dhcp.leases.filter((l) => !id || l.scopeId === id);
  return ok(
    table(
      ['IPAddress', 'ScopeId', 'ClientId', 'HostName', 'AddressState'],
      leases.map((l) => [l.ip, l.scopeId, l.mac.toLowerCase(), l.hostname, 'Active']),
    ),
  );
}

// ---------------------------------------------------------------------------
// Directory objects
// ---------------------------------------------------------------------------

function newOU(c: Ctx): HandlerResult {
  const g = adGuard(c, 'New-ADOrganizationalUnit');
  if (g) return g;
  const name = arg(c, 'Name') ?? c.p.positional[0];
  if (!name)
    return fail(
      'New-ADOrganizationalUnit : Cannot process command because of one or more missing mandatory parameters: Name.',
    );
  const path = arg(c, 'Path') ?? DOMAIN_DN_FOR(c.s);
  if (!containerExists(c.s, path))
    return fail(`New-ADOrganizationalUnit : Directory object not found: '${path}'.`);
  const dn = `OU=${name},${path}`;
  if (c.s.ad.ous.some((o) => o.toLowerCase() === dn.toLowerCase())) {
    return fail(
      'New-ADOrganizationalUnit : An attempt was made to add an object to the directory with a name that is already in use.',
    );
  }
  c.s.ad.ous.push(dn);
  return ok('');
}

function getOU(c: Ctx): HandlerResult {
  const g = adGuard(c, 'Get-ADOrganizationalUnit');
  if (g) return g;
  return ok(
    table(
      ['Name', 'DistinguishedName'],
      c.s.ad.ous.map((o) => [/^OU=([^,]+)/.exec(o)?.[1] ?? o, o]),
    ),
  );
}

function removeOU(c: Ctx): HandlerResult {
  const g = adGuard(c, 'Remove-ADOrganizationalUnit');
  if (g) return g;
  const id = identityArg(c) ?? '';
  const dn = c.s.ad.ous.find((o) => o.toLowerCase() === id.toLowerCase());
  if (!dn) return objectNotFound(id);
  const d = dn.toLowerCase();
  const inUse =
    c.s.ad.ous.some((o) => o.toLowerCase().endsWith(`,${d}`)) ||
    [...c.s.ad.users, ...c.s.ad.groups, ...c.s.ad.computers].some(
      (o) => o.parent.toLowerCase() === d,
    );
  if (inUse)
    return fail(
      'Remove-ADOrganizationalUnit : The operation cannot be performed because the OU is not empty.',
    );
  c.s.ad.ous = c.s.ad.ous.filter((o) => o !== dn);
  return ok('');
}

/** Remove-ADUser: the account goes, and with it every group membership. */
function removeUser(c: Ctx): HandlerResult {
  const g = adGuard(c, 'Remove-ADUser');
  if (g) return g;
  const id = identityArg(c) ?? '';
  const u = findUser(c.s, id);
  if (!u) return objectNotFound(id);
  c.s.ad.users = c.s.ad.users.filter((x) => x !== u);
  for (const grp of c.s.ad.groups)
    grp.members = grp.members.filter((m) => m.toLowerCase() !== u.sam.toLowerCase());
  return ok('');
}

/** Remove-ADGroup: built-in groups are part of the domain and cannot be deleted. */
function removeGroup(c: Ctx): HandlerResult {
  const g = adGuard(c, 'Remove-ADGroup');
  if (g) return g;
  const id = identityArg(c) ?? '';
  const grp = findGroup(c.s, id);
  if (!grp) return objectNotFound(id);
  if (grp.builtin)
    return fail(`Remove-ADGroup : Access is denied. '${grp.name}' is a built-in group.`);
  c.s.ad.groups = c.s.ad.groups.filter((x) => x !== grp);
  for (const other of c.s.ad.groups)
    other.members = other.members.filter((m) => m.toLowerCase() !== grp.name.toLowerCase());
  return ok('');
}

function newUser(c: Ctx): HandlerResult {
  const g = adGuard(c, 'New-ADUser');
  if (g) return g;
  const s = c.s;
  const name = arg(c, 'Name') ?? c.p.positional[0];
  if (!name)
    return fail(
      'New-ADUser : Cannot process command because of one or more missing mandatory parameters: Name.',
    );
  const sam = arg(c, 'SamAccountName') ?? name;
  if (findUser(s, sam) || findGroup(s, sam))
    return fail('New-ADUser : The specified account already exists.');
  const path = arg(c, 'Path') ?? `CN=Users,${DOMAIN_DN_FOR(s)}`;
  if (!containerExists(s, path)) return fail(`New-ADUser : Directory object not found: '${path}'.`);
  const enabled = arg(c, 'Enabled') === 'true';
  const pwRaw = arg(c, 'AccountPassword');
  const pw = secureStringText(pwRaw);
  if (enabled && (!pw || !passwordMeetsPolicy(s, pw)))
    return fail(`New-ADUser : ${PASSWORD_POLICY_ERROR}`);
  if (pw && !passwordMeetsPolicy(s, pw)) return fail(`New-ADUser : ${PASSWORD_POLICY_ERROR}`);
  s.ad.users.push({
    sam,
    name,
    givenName: arg(c, 'GivenName') ?? '',
    surname: arg(c, 'Surname') ?? '',
    parent: path,
    enabled,
    lockedOut: false,
    badPwdCount: 0,
    passwordSet: !!pw,
    ...(pw ? { password: pw } : {}),
    changePasswordAtLogon: arg(c, 'ChangePasswordAtLogon') === 'true',
    passwordLastResetByAdmin: null,
    department: arg(c, 'Department') ?? null,
    ...optionalUserAttrs(c),
    pwdLastSet: pw ? stamp(s) : null,
    lastLogon: null,
  });
  const du = findGroup(s, 'Domain Users');
  if (du && !du.members.includes(sam)) du.members.push(sam);
  return ok('');
}

const when = (ms: number | null | undefined): string =>
  ms ? new Date(ms).toLocaleString('en-US') : '';

const USER_PROPS: Record<string, (u: AdUser) => string | number | boolean | null> = {
  Department: (u) => u.department,
  EmployeeID: (u) => u.employeeId ?? '',
  Title: (u) => u.title ?? '',
  Description: (u) => u.description ?? '',
  LastLogonDate: (u) => when(u.lastLogon),
  LastLogonTimestamp: (u) => when(u.lastLogon),
  LockedOut: (u) => u.lockedOut,
  BadLogonCount: (u) => u.badPwdCount,
  PasswordExpired: (u) => u.changePasswordAtLogon,
  PasswordNeverExpires: () => false,
  PasswordLastSet: (u) =>
    u.pwdLastSet
      ? when(u.pwdLastSet)
      : u.passwordSet
        ? u.passwordLastResetByAdmin
          ? 'just now (reset by admin)'
          : '3/2/2026 8:14:07 AM'
        : '',
  LastBadPasswordAttempt: (u) => (u.badPwdCount > 0 ? 'today 7:52:31 AM' : ''),
  MemberOf: () => '',
};

function userCard(s: LabState, u: AdUser, requested: string[]): string {
  const pairs: [string, string | number | boolean | null][] = [
    ['DistinguishedName', `CN=${u.name},${u.parent}`],
    ['Enabled', u.enabled],
    ['GivenName', u.givenName],
    ['Name', u.name],
    ['ObjectClass', 'user'],
    ['SamAccountName', u.sam],
    ['Surname', u.surname],
    ['UserPrincipalName', `${u.sam}@${s.ad.forest ?? ''}`],
  ];
  const all = requested.some((r) => r === '*');
  for (const [k, f] of Object.entries(USER_PROPS)) {
    if (!all && !requested.some((r) => r.toLowerCase() === k.toLowerCase())) continue;
    if (k === 'MemberOf') {
      pairs.push([
        k,
        `{${s.ad.groups
          .filter((g) => g.members.includes(u.sam))
          .map((g) => `CN=${g.name},${g.parent}`)
          .join('; ')}}`,
      ]);
    } else pairs.push([k, f(u)]);
  }
  return props(pairs);
}

function getUser(c: Ctx): HandlerResult {
  const g = adGuard(c, 'Get-ADUser');
  if (g) return g;
  const requested = list(arg(c, 'Properties'));
  const id = identityArg(c);
  if (id) {
    const u = findUser(c.s, id);
    if (!u) return objectNotFound(id);
    return { ...ok(userCard(c.s, u, requested)), objects: [u.sam] };
  }
  const filter = arg(c, 'Filter');
  if (!filter) return fail('Get-ADUser : Specify -Identity or -Filter (for example -Filter *).');
  let users = c.s.ad.users;
  const base = arg(c, 'SearchBase');
  if (base) users = users.filter((u) => u.parent.toLowerCase().endsWith(base.toLowerCase()));
  const eq = /(\w+)\s+-(?:eq|like)\s+["']?([^"']+)["']?/i.exec(filter);
  if (eq) {
    const [, field, val] = eq;
    const re = new RegExp(
      '^' + val!.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$',
      'i',
    );
    users = users.filter((u) => {
      const f = field!.toLowerCase();
      const v =
        f === 'samaccountname'
          ? u.sam
          : f === 'department'
            ? (u.department ?? '')
            : f === 'enabled'
              ? String(u.enabled)
              : f === 'employeeid'
                ? (u.employeeId ?? '')
                : f === 'title'
                  ? (u.title ?? '')
                  : f === 'description'
                    ? (u.description ?? '')
                    : u.name;
      return re.test(v);
    });
  }
  // One property list per account, as Get-ADUser prints on a real domain controller.
  return {
    ...ok(users.map((u) => userCard(c.s, u, requested)).join('')),
    objects: users.map((u) => u.sam),
  };
}

function targetUsers(c: Ctx, cmd: string): AdUser[] | CommandResult {
  const id = identityArg(c);
  if (id) {
    const u = findUser(c.s, id);
    return u ? [u] : objectNotFound(id);
  }
  if (c.input.length > 0)
    return c.input.map((x) => findUser(c.s, x)).filter((u): u is AdUser => !!u);
  return fail(
    `${cmd} : Cannot process command because of one or more missing mandatory parameters: Identity.`,
  );
}

function unlockAccount(c: Ctx): HandlerResult {
  const g = adGuard(c, 'Unlock-ADAccount');
  if (g) return g;
  const users = targetUsers(c, 'Unlock-ADAccount');
  if (!Array.isArray(users)) return users;
  for (const u of users) {
    u.lockedOut = false;
    u.badPwdCount = 0;
    event(
      c.s,
      'DC01',
      'Security',
      4767,
      'Audit Success',
      'Microsoft-Windows-Security-Auditing',
      `A user account was unlocked. Target Account: ${c.s.ad.netbios}\\${u.sam}. Subject: ${c.s.ad.netbios}\\Administrator.`,
    );
  }
  return ok('');
}

function setEnabled(c: Ctx, enabled: boolean): HandlerResult {
  const cmd = enabled ? 'Enable-ADAccount' : 'Disable-ADAccount';
  const g = adGuard(c, cmd);
  if (g) return g;
  const users = targetUsers(c, cmd);
  if (!Array.isArray(users)) return users;
  for (const u of users) {
    if (enabled && !u.passwordSet) return fail(`${cmd} : ${PASSWORD_POLICY_ERROR}`);
    u.enabled = enabled;
  }
  return ok('');
}

function setAccountPassword(c: Ctx): HandlerResult {
  const g = adGuard(c, 'Set-ADAccountPassword');
  if (g) return g;
  const users = targetUsers(c, 'Set-ADAccountPassword');
  if (!Array.isArray(users)) return users;
  const pw = secureStringText(arg(c, 'NewPassword'));
  if (arg(c, 'Reset') !== 'true')
    return fail('Set-ADAccountPassword : As an administrator, use -Reset with -NewPassword.');
  if (!pw || !passwordMeetsPolicy(c.s, pw))
    return fail(`Set-ADAccountPassword : ${PASSWORD_POLICY_ERROR}`);
  for (const u of users) {
    u.passwordSet = true;
    u.password = pw;
    u.passwordLastResetByAdmin = ++c.s.tick;
    u.pwdLastSet = stamp(c.s);
    event(
      c.s,
      'DC01',
      'Security',
      4724,
      'Audit Success',
      'Microsoft-Windows-Security-Auditing',
      `An attempt was made to reset an account's password. Target Account: ${c.s.ad.netbios}\\${u.sam}.`,
    );
  }
  return ok('');
}

function setUser(c: Ctx): HandlerResult {
  const g = adGuard(c, 'Set-ADUser');
  if (g) return g;
  const users = targetUsers(c, 'Set-ADUser');
  if (!Array.isArray(users)) return users;
  for (const u of users) {
    const cpl = arg(c, 'ChangePasswordAtLogon');
    if (cpl !== undefined) u.changePasswordAtLogon = cpl === 'true';
    const dept = arg(c, 'Department');
    if (dept !== undefined) u.department = dept;
    const en = arg(c, 'Enabled');
    if (en !== undefined) u.enabled = en === 'true';
    const gn = arg(c, 'GivenName');
    if (gn !== undefined) u.givenName = gn;
    const sn = arg(c, 'Surname');
    if (sn !== undefined) u.surname = sn;
    Object.assign(u, optionalUserAttrs(c));
  }
  return ok('');
}

/** -EmployeeID, -Title and -Description, when given. */
function optionalUserAttrs(c: Ctx): Partial<AdUser> {
  const out: Partial<AdUser> = {};
  const emp = arg(c, 'EmployeeID');
  if (emp !== undefined) out.employeeId = emp;
  const title = arg(c, 'Title');
  if (title !== undefined) out.title = title;
  const desc = arg(c, 'Description');
  if (desc !== undefined) out.description = desc;
  return out;
}

function searchAccount(c: Ctx): HandlerResult {
  const g = adGuard(c, 'Search-ADAccount');
  if (g) return g;
  let users: AdUser[];
  if (arg(c, 'LockedOut') === 'true') users = c.s.ad.users.filter((u) => u.lockedOut);
  else if (arg(c, 'AccountInactive') === 'true') {
    // -TimeSpan 90 (days) or -TimeSpan 90.00:00:00; never-used accounts count as inactive.
    const span = arg(c, 'TimeSpan') ?? '90';
    const days = /^\d+$/.test(span) ? +span : (timeSpanMs(span) ?? 90 * 86400000) / 86400000;
    const cutoff = Date.now() - days * 86400000;
    users = c.s.ad.users.filter(
      (u) =>
        !['administrator', 'guest', 'krbtgt'].includes(u.sam.toLowerCase()) &&
        (!u.lastLogon || u.lastLogon < cutoff),
    );
  } else if (arg(c, 'AccountDisabled') === 'true') users = c.s.ad.users.filter((u) => !u.enabled);
  else return fail('Search-ADAccount : Specify -LockedOut, -AccountDisabled or -AccountInactive.');
  return {
    ...ok(
      table(
        ['Name', 'SamAccountName', 'Enabled', 'LockedOut', 'DistinguishedName'],
        users.map((u) => [
          u.name,
          u.sam,
          String(u.enabled),
          String(u.lockedOut),
          `CN=${u.name},${u.parent}`,
        ]),
      ),
    ),
    objects: users.map((u) => u.sam),
  };
}

function newGroup(c: Ctx): HandlerResult {
  const g = adGuard(c, 'New-ADGroup');
  if (g) return g;
  const name = arg(c, 'Name') ?? c.p.positional[0];
  if (!name)
    return fail(
      'New-ADGroup : Cannot process command because of one or more missing mandatory parameters: Name.',
    );
  // -GroupScope is the second positional parameter: New-ADGroup grp-x Global.
  const scopeGiven =
    arg(c, 'GroupScope') ?? (arg(c, 'Name') ? c.p.positional[0] : c.p.positional[1]);
  const scopeRaw = (scopeGiven ?? '').toLowerCase();
  const scope =
    scopeRaw === 'global' || scopeRaw === '1'
      ? 'Global'
      : scopeRaw === 'domainlocal' || scopeRaw === '0'
        ? 'DomainLocal'
        : scopeRaw === 'universal' || scopeRaw === '2'
          ? 'Universal'
          : null;
  if (!scope && scopeGiven) {
    return fail(
      `New-ADGroup : Cannot bind parameter 'GroupScope'. Cannot convert value "${scopeGiven}" to type "Microsoft.ActiveDirectory.Management.ADGroupScope". Specify one of the following enumerator names and try again: DomainLocal, Global, Universal`,
    );
  }
  // PowerShell prompts for a missing -GroupScope; this terminal cannot prompt,
  // so it takes the answer nearly everyone gives: Global.
  const finalScope = scope ?? 'Global';
  const catRaw = (arg(c, 'GroupCategory') ?? 'Security').toLowerCase();
  const category = catRaw === 'distribution' ? 'Distribution' : 'Security';
  if (findGroup(c.s, name) || findUser(c.s, name))
    return fail('New-ADGroup : The specified group already exists.');
  const path = arg(c, 'Path') ?? `CN=Users,${DOMAIN_DN_FOR(c.s)}`;
  if (!containerExists(c.s, path))
    return fail(`New-ADGroup : Directory object not found: '${path}'.`);
  c.s.ad.groups.push({
    name,
    parent: path,
    scope: finalScope,
    category,
    members: [],
    builtin: false,
  });
  return ok('');
}

function getGroup(c: Ctx): HandlerResult {
  const g = adGuard(c, 'Get-ADGroup');
  if (g) return g;
  const id = identityArg(c);
  let groups: AdGroup[] = id
    ? [findGroup(c.s, id)].filter((x): x is AdGroup => !!x)
    : c.s.ad.groups;
  const gf = /Name\s+-(?:eq|like)\s+["']?([^"']+)["']?/i.exec(arg(c, 'Filter') ?? '');
  if (!id && gf) {
    const re = new RegExp(
      '^' + gf[1]!.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$',
      'i',
    );
    groups = groups.filter((x) => re.test(x.name));
  }
  const requested = list(arg(c, 'Properties')).map((x) => x.toLowerCase());
  const showTtl = arg(c, 'ShowMemberTimeToLive') === 'true';
  const extra = (x: AdGroup): [string, string][] => {
    const out: [string, string][] = [];
    const all = requested.includes('*');
    if (all || requested.includes('description')) out.push(['Description', x.description ?? '']);
    if (all || requested.includes('managedby'))
      out.push(['ManagedBy', x.managedBy ? memberDn(c.s, x.managedBy) : '']);
    if (all || requested.includes('member') || requested.includes('members')) {
      const now = Date.now();
      out.push([
        'Members',
        `{${x.members
          .map((m) => {
            const exp = x.ttl?.[m.toLowerCase()];
            const ttl =
              showTtl && exp ? `<TTL=${Math.max(0, Math.round((exp - now) / 1000))}>,` : '';
            return ttl + memberDn(c.s, m);
          })
          .join('; ')}}`,
      ]);
    }
    return out;
  };
  if (id && groups.length === 0) return objectNotFound(id);
  if (!id && !arg(c, 'Filter') && !arg(c, 'LDAPFilter')) {
    return fail(
      'Get-ADGroup : Cannot process command because of one or more missing mandatory parameters: Filter.',
    );
  }
  // One property list per group, as on a real domain controller.
  return ok(
    groups
      .map((x) =>
        props([
          ['DistinguishedName', dnOf(x)],
          ['GroupCategory', x.category],
          ['GroupScope', x.scope],
          ['Name', x.name],
          ['ObjectClass', 'group'],
          ['SamAccountName', x.name],
          ...extra(x),
        ]),
      )
      .join(''),
  );
}

function groupMember(c: Ctx, add: boolean): HandlerResult {
  const cmd = add ? 'Add-ADGroupMember' : 'Remove-ADGroupMember';
  const g = adGuard(c, cmd);
  if (g) return g;
  const gid = identityArg(c);
  const grp = gid ? findGroup(c.s, gid) : undefined;
  if (!grp) return objectNotFound(gid ?? '');
  const members = list(arg(c, 'Members') ?? c.p.positional.slice(1).join(','));
  if (members.length === 0)
    return fail(
      `${cmd} : Cannot process command because of one or more missing mandatory parameters: Members.`,
    );
  const ttlRaw = add ? arg(c, 'MemberTimeToLive') : undefined;
  let ttlMs: number | null = null;
  if (ttlRaw !== undefined) {
    if (!c.s.ad.pamEnabled)
      return fail(
        `${cmd} : The requested operation requires the Privileged Access Management optional feature. ` +
          "Enable it first: Enable-ADOptionalFeature 'Privileged Access Management Feature' -Scope ForestOrConfigurationSet -Target " +
          (c.s.ad.forest ?? '<forest>'),
      );
    ttlMs = timeSpanMs(ttlRaw);
    if (!ttlMs)
      return fail(
        `${cmd} : Cannot convert '${ttlRaw}' to a TimeSpan. Use (New-TimeSpan -Hours 2) or 02:00:00.`,
      );
  }
  for (const m of members) {
    const u = findUser(c.s, m);
    const mg = findGroup(c.s, m);
    const sam = u?.sam ?? mg?.name;
    if (!sam) return objectNotFound(m);
    const had = grp.members.includes(sam);
    if (add && !had) grp.members.push(sam);
    if (!add) grp.members = grp.members.filter((x) => x !== sam);
    if (grp.ttl) delete grp.ttl[sam.toLowerCase()];
    if (add && ttlMs) (grp.ttl ??= {})[sam.toLowerCase()] = stamp(c.s) + ttlMs;
    if (add !== had) membershipEvent(c.s, grp, sam, add);
  }
  return ok('');
}

/** 4728/4729 (global), 4732/4733 (domain local), 4756/4757 (universal) — security groups only. */
export function membershipEvent(s: LabState, grp: AdGroup, member: string, added: boolean): void {
  if (grp.category !== 'Security') return;
  const base = grp.scope === 'Global' ? 4728 : grp.scope === 'DomainLocal' ? 4732 : 4756;
  const kind =
    grp.scope === 'Global' ? 'global' : grp.scope === 'DomainLocal' ? 'local' : 'universal';
  event(
    s,
    'DC01',
    'Security',
    added ? base : base + 1,
    'Audit Success',
    'Microsoft-Windows-Security-Auditing',
    `A member was ${added ? 'added to' : 'removed from'} a security-enabled ${kind} group. Member: ${member}. Group: ${grp.name}. Subject: ${s.ad.netbios ?? ''}\\Administrator.`,
    { targetUser: grp.name, memberName: member, subjectUser: 'Administrator' },
  );
}

/** (New-TimeSpan -Hours 2), New-TimeSpan -Minutes 120, 02:00:00, 1.00:00:00 → milliseconds. */
export function timeSpanMs(raw: string): number | null {
  const t = raw.trim();
  const clock = /^['"]?(?:(\d+)\.)?(\d{1,2}):(\d{2})(?::(\d{2}))?['"]?$/.exec(t);
  if (clock) {
    const [, d, h, m, sec] = clock;
    return ((+(d ?? 0) * 24 + +h!) * 60 + +m!) * 60000 + +(sec ?? 0) * 1000 || null;
  }
  let ms = 0;
  for (const [unit, f] of [
    ['Days', 86400000],
    ['Hours', 3600000],
    ['Minutes', 60000],
    ['Seconds', 1000],
  ] as const) {
    const m = new RegExp(`-${unit}\\s+(\\d+)`, 'i').exec(t);
    if (m) ms += +m[1]! * f;
  }
  return ms || null;
}

/** The DN a member name stands for (user or group). */
function memberDn(s: LabState, name: string): string {
  const u = findUser(s, name);
  if (u) return `CN=${u.name},${u.parent}`;
  const g = findGroup(s, name);
  return g ? dnOf(g) : name;
}

function getGroupMember(c: Ctx): HandlerResult {
  const g = adGuard(c, 'Get-ADGroupMember');
  if (g) return g;
  const id = identityArg(c);
  const grp = id ? findGroup(c.s, id) : undefined;
  if (!grp) return objectNotFound(id ?? '');
  return ok(
    table(
      ['name', 'SamAccountName', 'objectClass'],
      grp.members.map((m) => {
        const u = findUser(c.s, m);
        return [u?.name ?? m, m, u ? 'user' : 'group'];
      }),
    ),
  );
}

function getPrincipalGroups(c: Ctx): HandlerResult {
  const g = adGuard(c, 'Get-ADPrincipalGroupMembership');
  if (g) return g;
  const id = identityArg(c);
  const u = id ? findUser(c.s, id) : undefined;
  if (!u) return objectNotFound(id ?? '');
  return ok(
    table(
      ['name', 'GroupScope'],
      c.s.ad.groups.filter((x) => x.members.includes(u.sam)).map((x) => [x.name, x.scope]),
    ),
  );
}

function getComputer(c: Ctx): HandlerResult {
  const g = adGuard(c, 'Get-ADComputer');
  if (g) return g;
  const id = identityArg(c);
  const comps = id
    ? c.s.ad.computers.filter((x) => x.name.toLowerCase() === id.toLowerCase())
    : c.s.ad.computers;
  if (id && comps.length === 0) return objectNotFound(id);
  return ok(
    table(
      ['Name', 'DNSHostName', 'Enabled', 'DistinguishedName'],
      comps.map((x) => [x.name, `${x.name.toLowerCase()}.${c.s.ad.forest ?? ''}`, 'True', dnOf(x)]),
    ),
  );
}

function moveObject(c: Ctx): HandlerResult {
  const g = adGuard(c, 'Move-ADObject');
  if (g) return g;
  const id = (identityArg(c) ?? '').toLowerCase();
  const target = arg(c, 'TargetPath');
  if (!target)
    return fail(
      'Move-ADObject : Cannot process command because of one or more missing mandatory parameters: TargetPath.',
    );
  if (!containerExists(c.s, target))
    return fail(`Move-ADObject : Directory object not found: '${target}'.`);
  const all: { name: string; parent: string }[] = [
    ...c.s.ad.users,
    ...c.s.ad.groups,
    ...c.s.ad.computers,
  ];
  const obj = all.find((o) => dnOf(o).toLowerCase() === id);
  if (!obj) return objectNotFound(identityArg(c) ?? '');
  obj.parent = target;
  return ok('');
}

function setPasswordPolicy(c: Ctx): HandlerResult {
  const g = adGuard(c, 'Set-ADDefaultDomainPasswordPolicy');
  if (g) return g;
  const pol = c.s.ad.passwordPolicy;
  const min = arg(c, 'MinPasswordLength');
  const thr = arg(c, 'LockoutThreshold');
  const cx = arg(c, 'ComplexityEnabled');
  if (min !== undefined) pol.minPasswordLength = Number(min) || pol.minPasswordLength;
  if (thr !== undefined) pol.lockoutThreshold = Number(thr) || 0;
  if (cx !== undefined) pol.complexityEnabled = cx === 'true';
  const hist = arg(c, 'PasswordHistoryCount');
  if (hist !== undefined) pol.historyCount = Math.max(0, Math.min(24, Number(hist) || 0));
  const maxAge = arg(c, 'MaxPasswordAge');
  if (maxAge !== undefined) {
    // "90.00:00:00", "90", or (New-TimeSpan -Days 90)
    const m = /-Days\s+(\d+)/i.exec(maxAge) ?? /^(\d+)/.exec(maxAge);
    if (!m)
      return fail(
        'Set-ADDefaultDomainPasswordPolicy : Cannot convert value to type "System.TimeSpan". Use "90.00:00:00" or (New-TimeSpan -Days 90).',
      );
    pol.maxAgeDays = Number(m[1]);
  }
  const rev = arg(c, 'ReversibleEncryptionEnabled');
  if (rev !== undefined) pol.reversibleEncryption = rev === 'true';
  return ok('');
}

function getPasswordPolicy(c: Ctx): HandlerResult {
  const g = adGuard(c, 'Get-ADDefaultDomainPasswordPolicy');
  if (g) return g;
  const pol = c.s.ad.passwordPolicy;
  return ok(
    props([
      ['ComplexityEnabled', pol.complexityEnabled],
      ['LockoutThreshold', pol.lockoutThreshold],
      ['MinPasswordLength', pol.minPasswordLength],
      ['PasswordHistoryCount', pol.historyCount],
      ['LockoutDuration', '00:30:00'],
      ['MaxPasswordAge', `${pol.maxAgeDays}.00:00:00`],
      ['ReversibleEncryptionEnabled', pol.reversibleEncryption],
    ]),
  );
}

// ---------------------------------------------------------------------------
// Group Policy
// ---------------------------------------------------------------------------

function gpoGuard(c: Ctx, name: string): CommandResult | null {
  return adGuard(c, name);
}

function newGpo(c: Ctx): HandlerResult {
  const g = gpoGuard(c, 'New-GPO');
  if (g) return g;
  const name = arg(c, 'Name') ?? c.p.positional[0];
  if (!name)
    return fail(
      'New-GPO : Cannot process command because of one or more missing mandatory parameters: Name.',
    );
  if (c.s.ad.gpos.some((x) => x.name.toLowerCase() === name.toLowerCase())) {
    return fail(
      `New-GPO : A GPO with the name "${name}" already exists in the ${c.s.ad.forest} domain.`,
    );
  }
  c.s.ad.gpos.push({ name, links: [] });
  return ok(
    props([
      ['DisplayName', name],
      ['DomainName', c.s.ad.forest],
      ['GpoStatus', 'AllSettingsEnabled'],
    ]),
  );
}

function newGpLink(c: Ctx): HandlerResult {
  const g = gpoGuard(c, 'New-GPLink');
  if (g) return g;
  const name = arg(c, 'Name') ?? c.p.positional[0] ?? '';
  const target = arg(c, 'Target');
  const gpo = c.s.ad.gpos.find((x) => x.name.toLowerCase() === name.toLowerCase());
  if (!gpo)
    return fail(`New-GPLink : The GPO "${name}" was not found in the ${c.s.ad.forest} domain.`);
  if (!target || !containerExists(c.s, target) || /^cn=/i.test(target)) {
    return fail(
      `New-GPLink : The Scope of Management "${target ?? ''}" was not found. (GPOs link to OUs or the domain, not to CN= containers.)`,
    );
  }
  if (gpo.links.some((l) => l.toLowerCase() === target.toLowerCase()))
    return fail('New-GPLink : The GPO is already linked to this target.');
  gpo.links.push(target);
  return ok(
    props([
      ['GpoId', '{8F3C…}'],
      ['DisplayName', gpo.name],
      ['Enabled', true],
      ['Target', target],
    ]),
  );
}

function removeGpLink(c: Ctx): HandlerResult {
  const g = gpoGuard(c, 'Remove-GPLink');
  if (g) return g;
  const name = arg(c, 'Name') ?? '';
  const target = (arg(c, 'Target') ?? '').toLowerCase();
  const gpo = c.s.ad.gpos.find((x) => x.name.toLowerCase() === name.toLowerCase());
  if (!gpo) return fail(`Remove-GPLink : The GPO "${name}" was not found.`);
  gpo.links = gpo.links.filter((l) => l.toLowerCase() !== target);
  return ok('');
}

function getGpo(c: Ctx): HandlerResult {
  const g = gpoGuard(c, 'Get-GPO');
  if (g) return g;
  return ok(
    table(
      ['DisplayName', 'LinkedTo'],
      c.s.ad.gpos.map((x) => [x.name, x.links.join('; ')]),
    ),
  );
}

/** GPOs that reach a computer: linked to the domain or to any OU above it. */
export function gposFor(s: LabState, computer: string): string[] {
  const obj = s.ad.computers.find((x) => x.name.toLowerCase() === computer.toLowerCase());
  if (!obj) return [];
  const chain = obj.parent.toLowerCase();
  return s.ad.gpos
    .filter((g) =>
      g.links.some((l) => chain === l.toLowerCase() || chain.endsWith(`,${l.toLowerCase()}`)),
    )
    .map((g) => g.name);
}

function applyGpos(s: LabState, h: Host): boolean {
  if (!h.domain || locateDcProblem(s, h.name) !== null) return false;
  h.appliedGpos = gposFor(s, h.hostname);
  return true;
}

function gpupdate(c: Ctx): HandlerResult {
  if (!c.host.domain)
    return ok(
      'Updating policy...\n\nComputer Policy update has completed successfully.\nUser Policy update has completed successfully.\n(This computer is not in a domain: only local policy applied.)',
    );
  if (!applyGpos(c.s, c.host)) {
    event(
      c.s,
      c.host.name,
      'System',
      1129,
      'Error',
      'GroupPolicy',
      'The processing of Group Policy failed because of lack of network connectivity to a domain controller.',
    );
    return fail(
      'Updating policy...\n\nComputer policy could not be updated successfully. The following errors were encountered:\n\nThe processing of Group Policy failed because of lack of network connectivity to a domain controller.',
    );
  }
  return ok(
    'Updating policy...\n\nComputer Policy update has completed successfully.\nUser Policy update has completed successfully.',
  );
}

function gpresult(c: Ctx): HandlerResult {
  const h = c.host;
  const lines = [
    '',
    'COMPUTER SETTINGS',
    '------------------',
    `    CN=${h.hostname},${c.s.ad.computers.find((x) => x.name === h.hostname)?.parent ?? '(not in a domain)'}`,
    `    Domain Name:                 ${h.domain ? c.s.ad.netbios : 'WORKGROUP'}`,
    '',
    '    Applied Group Policy Objects',
    '    -----------------------------',
    ...(h.appliedGpos.length
      ? h.appliedGpos.map((g) => `        ${g}`)
      : ['        Local Group Policy']),
  ];
  return ok(lines.join('\n'));
}

// ---------------------------------------------------------------------------
// Folders, shares, NTFS
// ---------------------------------------------------------------------------

function normPath(p: string): string {
  return p.replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase();
}

function defaultNtfs(): NtfsAce[] {
  return [
    { identity: 'NT AUTHORITY\\SYSTEM', rights: 'F', inherited: true },
    { identity: 'BUILTIN\\Administrators', rights: 'F', inherited: true },
    { identity: 'BUILTIN\\Users', rights: 'RX', inherited: true },
    { identity: 'CREATOR OWNER', rights: 'F', inherited: true },
  ];
}

function mkdir(c: Ctx, path: string | undefined): HandlerResult {
  if (!path) return fail('The syntax of the command is incorrect.');
  const p = normPath(path);
  if (!/^[a-z]:\\/.test(p)) return fail('Use a full path, for example C:\\Shares\\Finance.');
  const parts = p.split('\\');
  for (let i = 2; i <= parts.length; i++) {
    const sub = parts.slice(0, i).join('\\');
    if (!c.host.folders.includes(sub)) {
      c.host.folders.push(sub);
      (c.host.folderCase ??= {})[sub] = path
        .replace(/\//g, '\\')
        .split('\\')
        .slice(0, i)
        .join('\\');
      if (c.host.name === 'DC01') c.s.ntfs[sub] = defaultNtfs();
    }
  }
  return ok(
    `\n    Directory: ${path.replace(/\\[^\\]+\\?$/, '')}\n\nMode   Name\n----   ----\nd----- ${parts[parts.length - 1]}`,
  );
}

function newItem(c: Ctx): HandlerResult {
  const type = (arg(c, 'ItemType') ?? '').toLowerCase();
  const path = arg(c, 'Path') ?? c.p.positional[0];
  if (type === 'file') {
    if (!path) return fail('New-Item : Specify -Path.');
    if (fileAt(c.host, normPath(path)) && arg(c, 'Force') !== 'true')
      return fail(`New-Item : The file '${path}' already exists.`);
    const err = writeFile(c.s, c.host, path, arg(c, 'Value') ?? '', false);
    return err ? fail(`New-Item : ${err}`) : ok('');
  }
  if (type !== 'directory')
    return fail('New-Item : Use -ItemType Directory (a folder) or -ItemType File.');
  return mkdir(c, path);
}

function testPath(c: Ctx): HandlerResult {
  const p = arg(c, 'Path') ?? c.p.positional[0] ?? '';
  const key = normPath(p);
  return ok(c.host.folders.includes(key) || !!fileAt(c.host, key) ? 'True' : 'False');
}

function knownIdentity(s: LabState, raw: string): string | null {
  const id = raw.trim();
  const lower = id.toLowerCase();
  const wellKnown: Record<string, string> = {
    everyone: 'Everyone',
    'authenticated users': 'NT AUTHORITY\\Authenticated Users',
    'nt authority\\authenticated users': 'NT AUTHORITY\\Authenticated Users',
    'builtin\\users': 'BUILTIN\\Users',
    users: 'BUILTIN\\Users',
    'builtin\\administrators': 'BUILTIN\\Administrators',
    administrators: 'BUILTIN\\Administrators',
    'nt authority\\system': 'NT AUTHORITY\\SYSTEM',
    system: 'NT AUTHORITY\\SYSTEM',
    'creator owner': 'CREATOR OWNER',
  };
  if (wellKnown[lower]) return wellKnown[lower]!;
  const bare = id.includes('\\') ? id.split('\\')[1]! : id;
  const domainPart = id.includes('\\') ? id.split('\\')[0]!.toUpperCase() : null;
  if (domainPart && domainPart !== s.ad.netbios) return null;
  const g = findGroup(s, bare);
  if (g) return `${s.ad.netbios}\\${g.name}`;
  const u = findUser(s, bare);
  if (u) return `${s.ad.netbios}\\${u.sam}`;
  return null;
}

const NO_MAPPING = 'No mapping between account names and security IDs was done.';

function newSmbShare(c: Ctx): HandlerResult {
  if (c.host.name !== 'DC01')
    return fail('New-SmbShare : Shares for this lab are created on DC01.');
  const name = arg(c, 'Name');
  const path = arg(c, 'Path');
  if (!name || !path)
    return fail(
      'New-SmbShare : Cannot process command because of one or more missing mandatory parameters: Name Path.',
    );
  if (!c.host.folders.includes(normPath(path)))
    return fail('New-SmbShare : The system cannot find the file specified.');
  if (c.s.shares.some((x) => x.name.toLowerCase() === name.toLowerCase()))
    return fail('New-SmbShare : The name has already been shared.');
  const access: ShareAce[] = [];
  for (const [param, rights] of [
    ['FullAccess', 'Full'],
    ['ChangeAccess', 'Change'],
    ['ReadAccess', 'Read'],
  ] as const) {
    for (const who of list(arg(c, param))) {
      const id = knownIdentity(c.s, who);
      if (!id) return fail(`New-SmbShare : ${NO_MAPPING} ('${who}')`);
      access.push({ identity: id, rights });
    }
  }
  if (access.length === 0) access.push({ identity: 'Everyone', rights: 'Read' });
  c.s.shares.push({ name, path, access });
  return ok(table(['Name', 'ScopeName', 'Path', 'Description'], [[name, '*', path, '']]));
}

function shareByName(c: Ctx): { share?: LabState['shares'][number]; name: string } {
  const name = arg(c, 'Name') ?? c.p.positional[0] ?? '';
  return { share: c.s.shares.find((x) => x.name.toLowerCase() === name.toLowerCase()), name };
}

function grantShare(c: Ctx): HandlerResult {
  const { share, name } = shareByName(c);
  if (!share)
    return fail(
      `Grant-SmbShareAccess : No MSFT_SMBShare objects found with property 'Name' equal to '${name}'.`,
    );
  const who = arg(c, 'AccountName') ?? '';
  const id = knownIdentity(c.s, who);
  if (!id) return fail(`Grant-SmbShareAccess : ${NO_MAPPING}`);
  const r = (arg(c, 'AccessRight') ?? '').toLowerCase();
  const rights = r === 'full' ? 'Full' : r === 'change' ? 'Change' : r === 'read' ? 'Read' : null;
  if (!rights) return fail('Grant-SmbShareAccess : -AccessRight must be Full, Change or Read.');
  share.access = share.access.filter((a) => a.identity !== id);
  share.access.push({ identity: id, rights });
  return ok(shareAccessTable(share));
}

function revokeShare(c: Ctx): HandlerResult {
  const { share, name } = shareByName(c);
  if (!share)
    return fail(
      `Revoke-SmbShareAccess : No MSFT_SMBShare objects found with property 'Name' equal to '${name}'.`,
    );
  const id = knownIdentity(c.s, arg(c, 'AccountName') ?? '');
  if (!id) return fail(`Revoke-SmbShareAccess : ${NO_MAPPING}`);
  share.access = share.access.filter((a) => a.identity !== id);
  return ok(shareAccessTable(share));
}

function shareAccessTable(share: LabState['shares'][number]): string {
  return table(
    ['Name', 'AccountName', 'AccessControlType', 'AccessRight'],
    share.access.map((a) => [share.name, a.identity, 'Allow', a.rights]),
  );
}

function getSmbShare(c: Ctx): HandlerResult {
  return ok(
    table(
      ['Name', 'Path'],
      [
        ['ADMIN$', 'C:\\Windows'],
        ['C$', 'C:\\'],
        ...(c.host.name === 'DC01' ? c.s.shares.map((x) => [x.name, x.path]) : []),
      ],
    ),
  );
}

function getSmbShareAccess(c: Ctx): HandlerResult {
  const { share, name } = shareByName(c);
  if (!share)
    return fail(
      `Get-SmbShareAccess : No MSFT_SMBShare objects found with property 'Name' equal to '${name}'.`,
    );
  return ok(shareAccessTable(share));
}

const RIGHTS_TEXT: Record<NtfsAce['rights'], string> = { F: 'F', M: 'M', RX: 'RX', R: 'R', W: 'W' };

function icacls(c: Ctx): HandlerResult {
  const path = c.p.positional[0];
  if (!path) return fail('The syntax of the command is incorrect.');
  const key = normPath(path);
  const acl = c.s.ntfs[key];
  if (!acl || !c.host.folders.includes(key))
    return fail(
      `${path}: The system cannot find the file specified.\nSuccessfully processed 0 files; Failed processing 1 files`,
    );
  const rest = c.p.positional.slice(1);
  const show = (): string =>
    acl
      .map(
        (a, i) =>
          `${i === 0 ? path : ' '.repeat(path.length)} ${a.identity}:${a.inherited ? '(I)' : ''}(OI)(CI)(${RIGHTS_TEXT[a.rights]})`,
      )
      .join('\n') + '\n\nSuccessfully processed 1 files; Failed processing 0 files';
  if (rest.length === 0) return ok(show());
  const flag = rest[0]!.toLowerCase();
  if (flag.startsWith('/inheritance:')) {
    const mode = flag.split(':')[1];
    if (mode === 'd') for (const a of acl) a.inherited = false;
    else if (mode === 'r') c.s.ntfs[key] = acl.filter((a) => !a.inherited);
    else if (mode === 'e') {
      /* re-enable: nothing to add in this lab */
    } else return fail('Invalid parameter "' + rest[0] + '"');
    return ok(`processed file: ${path}\nSuccessfully processed 1 files; Failed processing 0 files`);
  }
  if (flag === '/grant' || flag === '/grant:r') {
    const spec = rest[1] ?? '';
    const m = /^(.+?):(?:\((?:OI|CI|IO|NP)\))*\(?(F|M|RX|R|W)\)?$/i.exec(spec);
    if (!m) return fail('Invalid parameter "' + spec + '"');
    const id = knownIdentity(c.s, m[1]!);
    if (!id)
      return fail(
        `${m[1]}: ${NO_MAPPING}\nSuccessfully processed 0 files; Failed processing 1 files`,
      );
    const rights = m[2]!.toUpperCase() as NtfsAce['rights'];
    const list2 = c.s.ntfs[key]!;
    const existing = list2.find((a) => a.identity === id && !a.inherited);
    if (existing) existing.rights = rights;
    else list2.push({ identity: id, rights, inherited: false });
    return ok(`processed file: ${path}\nSuccessfully processed 1 files; Failed processing 0 files`);
  }
  if (flag === '/remove' || flag === '/remove:g') {
    const id = knownIdentity(c.s, rest[1] ?? '');
    if (!id) return fail(`${rest[1] ?? ''}: ${NO_MAPPING}`);
    // Inherited entries stay: they belong to the parent until inheritance is broken.
    c.s.ntfs[key] = c.s.ntfs[key]!.filter((a) => a.identity !== id || a.inherited);
    return ok(`processed file: ${path}\nSuccessfully processed 1 files; Failed processing 0 files`);
  }
  return fail('Invalid parameter "' + rest[0] + '"');
}

// ---------------------------------------------------------------------------
// Services, events, misc
// ---------------------------------------------------------------------------

function serviceName(h: Host, raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  return Object.keys(h.services).find((k) => k.toLowerCase() === raw.toLowerCase());
}

const SERVICE_DISPLAY: Record<string, string> = {
  DHCPServer: 'DHCP Server',
  DNS: 'DNS Server',
  NTDS: 'Active Directory Domain Services',
  Netlogon: 'Netlogon',
  Kdc: 'Kerberos Key Distribution Center',
  ADWS: 'Active Directory Web Services',
  RemoteAccess: 'Routing and Remote Access',
  Dnscache: 'DNS Client',
  Dhcp: 'DHCP Client',
  gpsvc: 'Group Policy Client',
  LanmanServer: 'Server',
  W32Time: 'Windows Time',
  WinRM: 'Windows Remote Management',
};

function getService(c: Ctx): HandlerResult {
  const want = arg(c, 'Name') ?? c.p.positional[0];
  const names = want
    ? [serviceName(c.host, want)].filter((x): x is string => !!x)
    : Object.keys(c.host.services);
  if (want && names.length === 0)
    return fail(`Get-Service : Cannot find any service with service name '${want}'.`);
  return ok(
    table(
      ['Status', 'Name', 'DisplayName'],
      names.map((n) => [c.host.services[n]!, n, SERVICE_DISPLAY[n] ?? n]),
    ),
  );
}

function setService(c: Ctx, status: 'Running' | 'Stopped' | 'restart'): HandlerResult {
  const want = arg(c, 'Name') ?? c.p.positional[0];
  const n = serviceName(c.host, want);
  if (!n) return fail(`Cannot find any service with service name '${want ?? ''}'.`);
  if (n === 'RemoteAccess' && status !== 'Stopped' && !c.s.routing.configured) {
    return fail(
      "Start-Service : Service 'Routing and Remote Access (RemoteAccess)' cannot be started: it has not been configured. Run Install-RemoteAccess first.",
    );
  }
  c.host.services[n] = status === 'Stopped' ? 'Stopped' : 'Running';
  event(
    c.s,
    c.host.name,
    'System',
    7036,
    'Information',
    'Service Control Manager',
    `The ${SERVICE_DISPLAY[n] ?? n} service entered the ${status === 'Stopped' ? 'stopped' : 'running'} state.`,
  );
  return ok('');
}

function getEvents(c: Ctx): HandlerResult {
  const logRaw = (arg(c, 'LogName') ?? c.p.positional[0] ?? '').toLowerCase();
  const fh = arg(c, 'FilterHashtable') ?? '';
  const fhLog = /LogName\s*=\s*['"]?([\w ]+?)['"]?\s*[;}]/i.exec(fh)?.[1]?.toLowerCase();
  const fhIds = (/\bId\s*=\s*([\d,\s]+)/i.exec(fh)?.[1] ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  const log = fhLog ?? logRaw;
  const max = Number(arg(c, 'MaxEvents', 'Newest') ?? '20') || 20;
  const type = (arg(c, 'EntryType') ?? '').toLowerCase();
  const evs = c.s.events
    .filter((e) => e.host === c.host.name)
    .filter((e) => !log || e.log.toLowerCase() === log)
    .filter((e) => fhIds.length === 0 || fhIds.includes(String(e.id)))
    .filter((e) => !type || e.level.toLowerCase().includes(type))
    .slice(-max)
    .reverse();
  if (!log)
    return fail(
      'Specify -LogName System, Security, Application, "Directory Service" or "DNS Server".',
    );
  if (evs.length === 0)
    return ok('No events were found that match the specified selection criteria.');
  return ok(
    table(
      ['TimeCreated', 'Id', 'LevelDisplayName', 'Message'],
      evs.map((e) => [when(e.time), String(e.id), e.level, e.message]),
    ),
  );
}

function history(c: Ctx): HandlerResult {
  const mine = c.s.history.filter((h) => h.host === c.host.name).slice(-20);
  return ok(
    table(
      ['Id', 'CommandLine'],
      mine.map((h, i) => [String(i + 1), h.command]),
    ),
  );
}

function systeminfo(c: Ctx): HandlerResult {
  const h = c.host;
  return ok(
    props([
      ['Host Name', h.hostname],
      ['OS Name', `Microsoft ${h.os}`],
      ['Domain', h.domain ?? 'WORKGROUP'],
      ['Logon Server', h.domain ? `\\\\${c.s.hosts.DC01.hostname}` : `\\\\${h.hostname}`],
    ]),
  );
}

function whoami(c: Ctx): HandlerResult {
  const h = c.host;
  if (h.domain && c.s.ad.netbios) return ok(`${c.s.ad.netbios.toLowerCase()}\\administrator`);
  return ok(`${h.hostname.toLowerCase()}\\administrator`);
}

// ---------------------------------------------------------------------------
// Files, scripts, PAM, audit — what the IAM Portfolio projects need
// ---------------------------------------------------------------------------

function fileAt(h: Host, key: string): LabFile | undefined {
  return (h.files ?? []).find((f) => f.path.toLowerCase() === key);
}

function parentOf(key: string): string {
  return key.replace(/\\[^\\]*$/, '');
}

/**
 * Write (or append to) a file on a machine. The folder must exist, as on
 * Windows. Returns an error message, or null when written.
 */
export function writeFile(
  s: LabState,
  h: Host,
  path: string,
  content: string,
  append: boolean,
): string | null {
  const key = normPath(path);
  if (!/^[a-z]:\\[^\\]/.test(key)) return `Use a full path, for example C:\\IAM\\notes.txt.`;
  if (h.folders.includes(key)) return `Access to the path '${path}' is denied (it is a folder).`;
  const dir = parentOf(key);
  if (!/^[a-z]:$/.test(dir) && !h.folders.includes(dir))
    return `Could not find a part of the path '${path}'. Create the folder first (New-Item -ItemType Directory).`;
  const files = (h.files ??= []);
  const existing = fileAt(h, key);
  const text = content.replace(/\r\n/g, '\n');
  if (existing) {
    existing.content = append
      ? existing.content + (existing.content && !existing.content.endsWith('\n') ? '\n' : '') + text
      : text;
    existing.modified = stamp(s);
  } else files.push({ path: path.replace(/\//g, '\\'), content: text, modified: stamp(s) });
  return null;
}

/** Read a file's text, or null when there is no such file. */
export function readFile(h: Host, path: string): string | null {
  return fileAt(h, normPath(path))?.content ?? null;
}

/** Text given to Set-Content / Add-Content: -Value, the second positional, or the pipeline. */
function contentArg(c: Ctx): string {
  const v = arg(c, 'Value') ?? c.p.positional[1];
  if (v !== undefined) return v.replace(/`n/g, '\n');
  return c.stage > 0 ? c.prev.replace(/^\n+|\n+$/g, '') : '';
}

function setContent(c: Ctx, append: boolean): HandlerResult {
  const cmd = append ? 'Add-Content' : 'Set-Content';
  const path = arg(c, 'Path', 'LiteralPath') ?? c.p.positional[0];
  if (!path) return fail(`${cmd} : Specify -Path.`);
  const err = writeFile(c.s, c.host, path, contentArg(c), append);
  return err ? fail(`${cmd} : ${err}`) : ok('');
}

function outFile(c: Ctx): HandlerResult {
  const path = arg(c, 'FilePath', 'Path', 'LiteralPath') ?? c.p.positional[0];
  if (!path) return fail('Out-File : Specify -FilePath.');
  const err = writeFile(
    c.s,
    c.host,
    path,
    c.prev.replace(/^\n+|\n+$/g, ''),
    arg(c, 'Append') === 'true',
  );
  return err ? fail(`Out-File : ${err}`) : ok('');
}

function csvCell(v: string | number | boolean | null | undefined): string {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

/** Export-Csv of the AD users handed down the pipeline (Get-ADUser, Search-ADAccount). */
function exportCsv(c: Ctx): HandlerResult {
  const path = arg(c, 'Path', 'LiteralPath') ?? c.p.positional[0];
  if (!path) return fail('Export-Csv : Specify -Path.');
  const cols = [
    'SamAccountName',
    'Name',
    'Enabled',
    'Department',
    'EmployeeID',
    'LastLogonDate',
    'DistinguishedName',
  ];
  const rows = c.input
    .map((sam) => findUser(c.s, sam))
    .filter((u): u is AdUser => !!u)
    .map((u) =>
      [
        u.sam,
        u.name,
        u.enabled ? 'True' : 'False',
        u.department ?? '',
        u.employeeId ?? '',
        when(u.lastLogon),
        `CN=${u.name},${u.parent}`,
      ]
        .map(csvCell)
        .join(','),
    );
  const append = arg(c, 'Append') === 'true' && !!readFile(c.host, path);
  const text = [...(append ? [] : [cols.map(csvCell).join(',')]), ...rows].join('\n');
  const err = writeFile(c.s, c.host, path, text, append);
  return err ? fail(`Export-Csv : ${err}`) : ok('');
}

function getContent(c: Ctx): HandlerResult {
  const path = arg(c, 'Path', 'LiteralPath') ?? c.p.positional[0];
  if (!path) return fail('Get-Content : Specify -Path.');
  const text = readFile(c.host, path);
  if (text === null)
    return fail(`Get-Content : Cannot find path '${path}' because it does not exist.`);
  return ok(text);
}

function getChildItem(c: Ctx): HandlerResult {
  const path = arg(c, 'Path', 'LiteralPath') ?? c.p.positional[0] ?? 'C:\\';
  const key = normPath(path);
  if (!/^[a-z]:$/.test(key) && !c.host.folders.includes(key))
    return fail(`Get-ChildItem : Cannot find path '${path}' because it does not exist.`);
  const recurse = arg(c, 'Recurse') === 'true';
  const under = (p: string): boolean =>
    p.startsWith(key + '\\') && (recurse || parentOf(p) === key);
  const dirs = c.host.folders.filter(under).sort();
  const files = (c.host.files ?? []).filter((f) => under(f.path.toLowerCase()));
  if (dirs.length === 0 && files.length === 0) return ok('');
  const rows: string[][] = [
    ...dirs.map((d) => {
      const shown = c.host.folderCase?.[d] ?? d;
      return ['d-----', '', '', recurse ? shown : shown.slice(key.length + 1)];
    }),
    ...files
      .sort((a, b) => a.path.localeCompare(b.path))
      .map((f) => [
        '-a----',
        when(f.modified),
        String(f.content.length),
        recurse ? f.path : f.path.slice(key.length + 1),
      ]),
  ];
  return ok(
    `\n    Directory: ${path}\n` + table(['Mode', 'LastWriteTime', 'Length', 'Name'], rows),
  );
}

function removeItem(c: Ctx): HandlerResult {
  const path = arg(c, 'Path', 'LiteralPath') ?? c.p.positional[0];
  if (!path) return fail('Remove-Item : Specify -Path.');
  const key = normPath(path);
  if (fileAt(c.host, key)) {
    c.host.files = (c.host.files ?? []).filter((f) => f.path.toLowerCase() !== key);
    return ok('');
  }
  if (!c.host.folders.includes(key))
    return fail(`Remove-Item : Cannot find path '${path}' because it does not exist.`);
  const inside = (p: string): boolean => p.startsWith(key + '\\');
  const hasChildren =
    c.host.folders.some(inside) || (c.host.files ?? []).some((f) => inside(f.path.toLowerCase()));
  if (hasChildren && arg(c, 'Recurse') !== 'true')
    return fail(
      `Remove-Item : The item at ${path} has children and the Recurse parameter was not specified.`,
    );
  c.host.folders = c.host.folders.filter((p) => p !== key && !inside(p));
  c.host.files = (c.host.files ?? []).filter((f) => !inside(f.path.toLowerCase()));
  for (const k of Object.keys(c.s.ntfs)) if (k === key || inside(k)) delete c.s.ntfs[k];
  c.s.shares = c.s.shares.filter((sh) => {
    const sp = normPath(sh.path);
    return sp !== key && !inside(sp);
  });
  return ok('');
}

function writeHost(c: Ctx): HandlerResult {
  const text = arg(c, 'Object', 'InputObject') ?? c.p.positional.join(' ') ?? '';
  return ok(text.replace(/`n/g, '\n'));
}

function setGroup(c: Ctx): HandlerResult {
  const g = adGuard(c, 'Set-ADGroup');
  if (g) return g;
  const id = identityArg(c) ?? '';
  const grp = findGroup(c.s, id);
  if (!grp) return objectNotFound(id);
  const mb = arg(c, 'ManagedBy');
  if (mb !== undefined) {
    const owner = findUser(c.s, mb) ?? findGroup(c.s, mb);
    if (!owner) return objectNotFound(mb);
    grp.managedBy = 'sam' in owner ? owner.sam : owner.name;
  }
  const desc = arg(c, 'Description');
  if (desc !== undefined) grp.description = desc;
  return ok('');
}

function removePrincipalGroups(c: Ctx): HandlerResult {
  const g = adGuard(c, 'Remove-ADPrincipalGroupMembership');
  if (g) return g;
  const users = targetUsers(c, 'Remove-ADPrincipalGroupMembership');
  if (!Array.isArray(users)) return users;
  const groups = list(arg(c, 'MemberOf'));
  if (groups.length === 0)
    return fail(
      'Remove-ADPrincipalGroupMembership : Cannot process command because of one or more missing mandatory parameters: MemberOf.',
    );
  for (const name of groups) {
    const grp = findGroup(c.s, name);
    if (!grp) return objectNotFound(name);
    if (grp.name.toLowerCase() === 'domain users')
      return fail(
        "Remove-ADPrincipalGroupMembership : The user cannot be removed from a group because the group is currently the user's primary group.",
      );
    for (const u of users) {
      if (!grp.members.includes(u.sam)) continue;
      grp.members = grp.members.filter((m) => m !== u.sam);
      if (grp.ttl) delete grp.ttl[u.sam.toLowerCase()];
      membershipEvent(c.s, grp, u.sam, false);
    }
  }
  return ok('');
}

const PAM_FEATURE = 'Privileged Access Management Feature';

function enableOptionalFeature(c: Ctx): HandlerResult {
  const g = adGuard(c, 'Enable-ADOptionalFeature');
  if (g) return g;
  const id = arg(c, 'Identity') ?? c.p.positional[0] ?? '';
  if (!/privileged access management/i.test(id))
    return fail(
      `Enable-ADOptionalFeature : Cannot find an optional feature with identity '${id}'.`,
    );
  if (!arg(c, 'Scope') || !arg(c, 'Target'))
    return fail(
      'Enable-ADOptionalFeature : Specify -Scope ForestOrConfigurationSet -Target <forest name>.',
    );
  c.s.ad.pamEnabled = true;
  return ok(
    "WARNING: Enabling 'Privileged Access Management Feature' on the forest is irreversible.",
  );
}

function getOptionalFeature(c: Ctx): HandlerResult {
  const g = adGuard(c, 'Get-ADOptionalFeature');
  if (g) return g;
  const forest = c.s.ad.forest ?? '';
  const row = (name: string, on: boolean): [string, string | boolean | null][] => [
    ['Name', name],
    ['EnabledScopes', on ? `{CN=Partitions,CN=Configuration,${DOMAIN_DN_FOR(c.s)}}` : '{}'],
    ['FeatureScope', '{ForestOrConfigurationSet}'],
    ['RequiredForestMode', name === PAM_FEATURE ? 'Windows2016Forest' : 'Windows2008R2Forest'],
  ];
  void forest;
  return ok(
    props(row('Recycle Bin Feature', false)) + props(row(PAM_FEATURE, !!c.s.ad.pamEnabled)),
  );
}

/** wevtutil cl Security / Clear-EventLog -LogName Security: leaves exactly one event, 1102. */
function clearLog(c: Ctx, logName: string | undefined): HandlerResult {
  const log = (logName ?? '').toLowerCase();
  const names: Record<string, EventEntry['log']> = {
    security: 'Security',
    system: 'System',
    application: 'Application',
  };
  const which = names[log];
  if (!which) return fail('Specify the log to clear: Security, System or Application.');
  c.s.events = c.s.events.filter((e) => !(e.host === c.host.name && e.log === which));
  if (which === 'Security')
    event(
      c.s,
      c.host.name,
      'Security',
      1102,
      'Audit Success',
      'Microsoft-Windows-Eventlog',
      `The audit log was cleared. Subject: ${c.s.ad.netbios ?? c.host.hostname}\\Administrator.`,
      { subjectUser: 'Administrator' },
    );
  return ok('');
}

function wevtutil(c: Ctx): HandlerResult {
  const [verb, log] = c.p.positional;
  if ((verb ?? '').toLowerCase() === 'cl' || (verb ?? '').toLowerCase() === 'clear-log')
    return clearLog(c, log);
  return fail('This lab supports wevtutil cl <LogName>.');
}

/**
 * A sign-in to the domain: 4624 (success) or 4625 (failure) on DC01, with the
 * target account and logon type a SIEM correlates on. Success stamps lastLogon.
 */
export function recordLogon(
  s: LabState,
  sam: string,
  success: boolean,
  logonType: '2' | '3' | '10' = '2',
): void {
  const u = findUser(s, sam);
  if (success && u) u.lastLogon = stamp(s);
  event(
    s,
    'DC01',
    'Security',
    success ? 4624 : 4625,
    success ? 'Audit Success' : 'Audit Failure',
    'Microsoft-Windows-Security-Auditing',
    success
      ? `An account was successfully logged on. Account Name: ${u?.sam ?? sam}. Logon Type: ${logonType}.`
      : `An account failed to log on. Account Name: ${u?.sam ?? sam}. Logon Type: ${logonType}. Failure Reason: Unknown user name or bad password.`,
    { targetUser: u?.sam ?? sam, logonType },
  );
}

/** Time-bound memberships whose time is up are gone, as the KDC and DC enforce. */
export function expireMemberships(s: LabState, now = Date.now()): void {
  for (const g of s.ad.groups) {
    if (!g.ttl) continue;
    for (const [m, exp] of Object.entries(g.ttl)) {
      if (exp > now) continue;
      delete g.ttl[m];
      const had = g.members.find((x) => x.toLowerCase() === m);
      if (had) {
        g.members = g.members.filter((x) => x !== had);
        membershipEvent(s, g, had, false);
      }
    }
  }
}

/** Lines PowerShell scripts often start with that change nothing here. */
const SCRIPT_NOOPS =
  /^(\$ErrorActionPreference\s*=|Set-StrictMode\b|Import-Module\b|#Requires\b|param\s*\(.*\)\s*$|\[CmdletBinding\([^)]*\)\])/i;

/**
 * Run a .ps1 saved on this machine: one cmdlet per line, as the lab's
 * PowerShell understands them. Stops at the first failing line, as with
 * $ErrorActionPreference = 'Stop'.
 */
function runScript(s: LabState, host: HostName, path: string, depth: number): CommandResult {
  const text = readFile(s.hosts[host], path);
  if (text === null)
    return fail(
      `${path} : The term '${path}' is not recognized as the name of a cmdlet, function, script file, or operable program.`,
    );
  if (depth > 3) return fail('Scripts can call scripts only a few levels deep in this lab.');
  const lines: string[] = [];
  let inBlock = false;
  let carry = '';
  for (const raw of text.split('\n')) {
    let line = raw.trim();
    if (inBlock) {
      if (line.includes('#>')) inBlock = false;
      continue;
    }
    if (line.startsWith('<#')) {
      if (!line.includes('#>')) inBlock = true;
      continue;
    }
    if (!line || line.startsWith('#')) continue;
    if (line.endsWith('`')) {
      carry += line.slice(0, -1) + ' ';
      continue;
    }
    line = carry + line;
    carry = '';
    lines.push(line);
  }
  const out: string[] = [];
  for (const [i, line] of lines.entries()) {
    if (SCRIPT_NOOPS.test(line)) continue;
    if (/^\$\w+\s*=|^(foreach|for|if|while|function|try|switch)\b|^[{}]/i.test(line))
      return fail(
        [
          ...out,
          `${path}:${i + 1} ${line}`,
          'This lab runs scripts one cmdlet per line with literal values; variables, loops and functions are for your real DC01. ' +
            'The script is still saved, and the IAM Portfolio reviews its content.',
        ].join('\n'),
      );
    const r = runCommand(s, host, line, depth + 1);
    if (r.output) out.push(r.output);
    if (!r.ok) return fail(out.join('\n'));
  }
  return ok(out.join('\n'));
}

/** `& 'C:\x.ps1'`, `C:\x.ps1`, `powershell -File C:\x.ps1` → the script path. */
function scriptPath(line: string): string | null {
  const m =
    /^(?:&\s*)?["']?([a-z]:\\[^"']+?\.ps1)["']?$/i.exec(line) ??
    /^(?:powershell|pwsh)(?:\.exe)?\s+(?:-ExecutionPolicy\s+\w+\s+)?-File\s+["']?([a-z]:\\[^"']+?\.ps1)["']?$/i.exec(
      line,
    );
  return m ? m[1]! : null;
}

export const HELP_TEXT = `Commands available in this lab (PowerShell and cmd both work here):

 Network     ipconfig [/all|/renew|/release|/flushdns|/registerdns]   ping   nslookup   Test-NetConnection
             Resolve-DnsName   Get-NetAdapter   Get-NetIPConfiguration   Get-NetIPAddress
             New-NetIPAddress   Remove-NetIPAddress   Remove-NetRoute   Set-NetIPInterface -Dhcp
             Set-DnsClientServerAddress   Get-DnsClientServerAddress   netsh interface ip set address|dns
 Computer    hostname   Rename-Computer   Restart-Computer   systeminfo   whoami
             Get-WindowsFeature   Install-WindowsFeature   Get-Service   Start/Stop/Restart-Service
             Get-WinEvent / Get-EventLog   Get-History
 AD DS       Install-ADDSForest   Get-ADDomain   Add-Computer   Test-ComputerSecureChannel
             New/Get/Remove-ADOrganizationalUnit   New/Get/Set/Remove-ADUser   Search-ADAccount
             Unlock-ADAccount   Enable/Disable-ADAccount   Set-ADAccountPassword   Move-ADObject
             New/Get/Remove-ADGroup   Add/Remove/Get-ADGroupMember   Get-ADPrincipalGroupMembership   Get-ADComputer
             Get/Set-ADDefaultDomainPasswordPolicy
 DHCP        Add-DhcpServerInDC   Get-DhcpServerInDC   Add/Get/Set/Remove-DhcpServerv4Scope
             Set/Get-DhcpServerv4OptionValue   Get-DhcpServerv4Lease
 RAS / NAT   Install-RemoteAccess -VpnType RoutingOnly   Get-RemoteAccess
             netsh routing ip nat install | add interface "Name" full|private | show interface
 GPO         New-GPO   New-GPLink   Remove-GPLink   Get-GPO   gpupdate /force   gpresult /r
 Files       New-Item -ItemType Directory|File   mkdir   Test-Path   Get-ChildItem   Remove-Item
             Set-Content   Add-Content   Get-Content   Out-File   Export-Csv   icacls
             & C:\\path\\script.ps1 (one cmdlet per line)   Write-Host
 IAM         Set-ADGroup -ManagedBy   Remove-ADPrincipalGroupMembership   Search-ADAccount -AccountInactive
             Enable/Get-ADOptionalFeature   Add-ADGroupMember -MemberTimeToLive (New-TimeSpan -Hours 2)
             Get-ADGroup -Properties member -ShowMemberTimeToLive   wevtutil cl Security
             New-SmbShare   Get-SmbShare   Get-SmbShareAccess   Grant/Revoke-SmbShareAccess
 Shell       cls   help`;

const HANDLERS: Record<string, Handler> = {
  help: () => ok(HELP_TEXT),
  'get-help': () => ok(HELP_TEXT),
  hostname: (c) => ok(c.host.hostname),
  whoami,
  systeminfo,
  ipconfig,
  ping: pingCmd,
  nslookup,
  'resolve-dnsname': resolveDnsName,
  'test-netconnection': testNetConnection,
  tnc: testNetConnection,
  'get-netadapter': getNetAdapter,
  'get-netipconfiguration': getNetIPConfiguration,
  gip: getNetIPConfiguration,
  'get-netipaddress': getNetIPAddress,
  'new-netipaddress': newNetIPAddress,
  'remove-netipaddress': removeNetIPAddress,
  'remove-netroute': removeNetRoute,
  'set-netipinterface': setNetIPInterface,
  'set-dnsclientserveraddress': setDnsClient,
  'get-dnsclientserveraddress': getDnsClient,
  netsh,
  'rename-computer': renameComputer,
  'restart-computer': (c) => restart(c),
  shutdown: (c) =>
    c.p.positional.some((x) => x.toLowerCase() === '/r')
      ? restart(c)
      : fail('This lab only supports shutdown /r (restart).'),
  'get-windowsfeature': getWindowsFeature,
  'install-windowsfeature': installWindowsFeature,
  'add-windowsfeature': installWindowsFeature,
  'install-remoteaccess': installRemoteAccess,
  'get-remoteaccess': getRemoteAccess,
  'install-addsforest': installADDSForest,
  'get-addomain': getADDomain,
  'get-adforest': getADDomain,
  'add-computer': addComputer,
  'test-computersecurechannel': testSecureChannel,
  'add-dhcpserverindc': addDhcpServerInDC,
  'get-dhcpserverindc': getDhcpServerInDC,
  'add-dhcpserverv4scope': addDhcpScope,
  'set-dhcpserverv4scope': setDhcpScope,
  'remove-dhcpserverv4scope': removeDhcpScope,
  'get-dhcpserverv4scope': getDhcpScope,
  'set-dhcpserverv4optionvalue': setDhcpOption,
  'get-dhcpserverv4optionvalue': getDhcpOption,
  'get-dhcpserverv4lease': getDhcpLease,
  'new-adorganizationalunit': newOU,
  'get-adorganizationalunit': getOU,
  'remove-adorganizationalunit': removeOU,
  'new-aduser': newUser,
  'remove-aduser': removeUser,
  'remove-adgroup': removeGroup,
  'get-aduser': getUser,
  'set-aduser': setUser,
  'unlock-adaccount': unlockAccount,
  'enable-adaccount': (c) => setEnabled(c, true),
  'disable-adaccount': (c) => setEnabled(c, false),
  'set-adaccountpassword': setAccountPassword,
  'search-adaccount': searchAccount,
  'new-adgroup': newGroup,
  'get-adgroup': getGroup,
  'add-adgroupmember': (c) => groupMember(c, true),
  'remove-adgroupmember': (c) => groupMember(c, false),
  'get-adgroupmember': getGroupMember,
  'get-adprincipalgroupmembership': getPrincipalGroups,
  'get-adcomputer': getComputer,
  'move-adobject': moveObject,
  'set-addefaultdomainpasswordpolicy': setPasswordPolicy,
  'get-addefaultdomainpasswordpolicy': getPasswordPolicy,
  'new-gpo': newGpo,
  'new-gplink': newGpLink,
  'remove-gplink': removeGpLink,
  'get-gpo': getGpo,
  gpupdate,
  gpresult,
  'new-item': newItem,
  mkdir: (c) => mkdir(c, c.p.positional[0] ?? arg(c, 'Path')),
  md: (c) => mkdir(c, c.p.positional[0]),
  'test-path': testPath,
  'new-smbshare': newSmbShare,
  'get-smbshare': getSmbShare,
  'get-smbshareaccess': getSmbShareAccess,
  'grant-smbshareaccess': grantShare,
  'revoke-smbshareaccess': revokeShare,
  icacls,
  'get-acl': (c) => {
    c.p.positional = [arg(c, 'Path') ?? c.p.positional[0] ?? ''];
    return icacls(c);
  },
  'get-service': getService,
  gsv: getService,
  'start-service': (c) => setService(c, 'Running'),
  'stop-service': (c) => setService(c, 'Stopped'),
  'restart-service': (c) => setService(c, 'restart'),
  'get-winevent': getEvents,
  'set-content': (c) => setContent(c, false),
  'add-content': (c) => setContent(c, true),
  'get-content': getContent,
  gc: getContent,
  type: getContent,
  cat: getContent,
  'out-file': outFile,
  'export-csv': exportCsv,
  'get-childitem': getChildItem,
  gci: getChildItem,
  dir: getChildItem,
  ls: getChildItem,
  'remove-item': removeItem,
  del: removeItem,
  rm: removeItem,
  'write-host': writeHost,
  'write-output': writeHost,
  echo: writeHost,
  'set-adgroup': setGroup,
  'remove-adprincipalgroupmembership': removePrincipalGroups,
  'enable-adoptionalfeature': enableOptionalFeature,
  'get-adoptionalfeature': getOptionalFeature,
  wevtutil,
  'clear-eventlog': (c) => clearLog(c, arg(c, 'LogName') ?? c.p.positional[0]),
  'get-eventlog': getEvents,
  'get-history': history,
  history,
  h: history,
};

/** Pipeline stages that only change how output looks. */
const FORMATTERS = new Set([
  'format-list',
  'fl',
  'format-table',
  'ft',
  'select-object',
  'select',
  'out-host',
  'out-string',
  'sort-object',
  'sort',
]);

/** The names the terminal can complete. */
export const COMMAND_NAMES: readonly string[] = Object.keys(HANDLERS);

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Run one command line typed by the student on `host`. Mutates `s` and
 * records the attempt in `s.history` — the instructor's lab memory.
 */
export function runCommand(s: LabState, host: HostName, line: string, depth = 0): CommandResult {
  const trimmed = line.trim();
  if (!trimmed) return ok('');
  const lower = trimmed.toLowerCase();
  if (lower === 'cls' || lower === 'clear' || lower === 'clear-host')
    return { output: '', ok: true, clear: true };
  expireMemberships(s);

  const script = scriptPath(trimmed);
  if (script) {
    const r = runScript(s, host, script, depth);
    if (depth === 0) recordHistory(s, host, trimmed, r);
    return r;
  }

  const stages = splitPipeline(trimmed);
  let objects: string[] = [];
  let result: HandlerResult = ok('');
  for (let i = 0; i < stages.length; i++) {
    const p = parse(stages[i]!);
    const key = p.name.toLowerCase();
    if (i > 0 && FORMATTERS.has(key)) continue;
    if (i > 0 && (key === 'where-object' || key === '?' || key === 'findstr')) continue;
    const handler = HANDLERS[key];
    result = handler
      ? handler({ s, host: s.hosts[host], p, input: objects, prev: result.output, stage: i })
      : notRecognized(p.name);
    if (!result.ok) break;
    objects = result.objects ?? [];
  }
  recordHistory(s, host, trimmed, result);
  return { output: result.output, ok: result.ok, ...(result.clear ? { clear: true } : {}) };
}

function recordHistory(s: LabState, host: HostName, trimmed: string, result: CommandResult): void {
  s.history.push({
    host,
    shell: 'powershell',
    command: trimmed,
    output: result.output.trim().split('\n').slice(0, 12).join('\n').slice(0, 900),
    ok: result.ok,
    at: ++s.tick,
  });
  // Keep lab memory bounded.
  if (s.history.length > 300) s.history.splice(0, s.history.length - 300);
}
