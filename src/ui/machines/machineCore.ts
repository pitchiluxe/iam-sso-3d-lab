/**
 * ui/machines/machineCore.ts — what the DC01 and CLIENT01 windows share,
 * without the DOM: signing in, running a command, and knowing when a command
 * restarts the machine. Kept apart from the UI so it can be tested.
 */
import type { CommandResult } from '@/vm/adlab/commands';
import { dcIsPromoted, type HostName, type LabState } from '@/vm/adlab/state';
import { runOn, type LabWorld } from '@/vm/adlab/world';

/** The lab machines' Administrator password. Fictional, for these two simulated machines only. */
export const LAB_ADMIN_PASSWORD = 'TechnoBiz!Lab2026';

export const MACHINE_INFO: Record<HostName, { title: string; os: string; ip: string }> = {
  DC01: {
    title: 'DC01',
    os: 'Windows Server 2022 Standard (Desktop Experience)',
    ip: '172.16.0.1',
  },
  CLIENT01: { title: 'CLIENT01', os: 'Windows 11 Enterprise', ip: 'DHCP (TechnoBiz-LAN)' },
};

export type SignInResult = { ok: true; account: string } | { ok: false; reason: string };

/**
 * Who may sign in to a lab machine.
 *
 * The local Administrator always; CORP\Administrator once the machine belongs
 * to the domain (DC01 after promotion, CLIENT01 after it has joined and
 * restarted). Domain user accounts sign in on CLIENT01 once it is joined: a
 * disabled or locked account is refused with Windows' own wording.
 */
export function signIn(
  s: LabState,
  host: HostName,
  rawUser: string,
  password: string,
): SignInResult {
  const user = rawUser.trim();
  const h = s.hosts[host];
  const inDomain = host === 'DC01' ? dcIsPromoted(s) : Boolean(h.domain);
  const m = /^(?:([^\\@]+)\\)?([^\\@]+)(?:@(.+))?$/.exec(user);
  if (!m) return { ok: false, reason: 'The user name or password is incorrect.' };
  const prefix = (m[1] ?? '').toUpperCase();
  const name = m[2]!;
  const isDomainQualified = prefix === 'CORP' || /corp\.technobiz\.local$/i.test(m[3] ?? '');

  if (name.toLowerCase() === 'administrator') {
    if (isDomainQualified && !inDomain) {
      return {
        ok: false,
        reason: `The security database on ${h.hostname} does not have a trust relationship with CORP. Sign in with the local Administrator (.\\Administrator).`,
      };
    }
    if (password !== LAB_ADMIN_PASSWORD)
      return { ok: false, reason: 'The user name or password is incorrect.' };
    return {
      ok: true,
      account:
        isDomainQualified || (host === 'DC01' && inDomain)
          ? 'CORP\\Administrator'
          : `${h.hostname}\\Administrator`,
    };
  }

  // A domain account.
  if (!inDomain) return { ok: false, reason: 'The user name or password is incorrect.' };
  if (host === 'DC01') {
    return {
      ok: false,
      reason:
        'The sign-in method you are trying to use is not allowed. Only administrators sign in to a domain controller.',
    };
  }
  const u = s.ad.users.find((x) => x.sam.toLowerCase() === name.toLowerCase());
  // Windows checks the state of the account before the password it was given.
  if (u && !u.enabled)
    return {
      ok: false,
      reason: 'Your account has been disabled. Please see your system administrator.',
    };
  if (u && u.lockedOut) {
    return {
      ok: false,
      reason: 'The referenced account is currently locked out and may not be logged on to.',
    };
  }
  // No known password (a seeded account nobody has reset) signs in to nothing.
  if (!u || !u.password || u.password !== password) {
    return { ok: false, reason: 'The user name or password is incorrect.' };
  }
  return { ok: true, account: `CORP\\${u.sam}` };
}

/** Whether a successful command restarts the machine it ran on. */
export function restartsMachine(line: string): boolean {
  return /\bRestart-Computer\b|\bshutdown(\.exe)?\s+\/r\b|\s-Restart\b|\bInstall-ADDSForest\b/i.test(
    line,
  );
}

/** Run a command on a machine; report whether it restarted the machine. */
export function runOnMachine(
  w: LabWorld,
  host: HostName,
  line: string,
): CommandResult & { restarted: boolean } {
  const r = runOn(w, host, line);
  return { ...r, restarted: r.ok && restartsMachine(line) };
}
