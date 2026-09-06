/**
 * terminal/dispatcher.ts — turn a typed line into a capability invocation.
 *
 * The terminal owns no actions of its own: every cmdlet is a capability from
 * the registry, so a command run here fires exactly the same service calls,
 * audit events and lab-step validators as the equivalent console click. That
 * is the point — the learner can resolve a ticket by clicking or by typing,
 * and the lab validates either way.
 */
import { CAPABILITY_BY_CMDLET, CAPABILITIES, type CapabilityContext } from '@/services';
import { tokenize } from './tokenizer';
import { formatTable } from './format';

export interface DispatchResult {
  ok: boolean;
  output: string;
  /** Intrinsics the shell itself handles rather than a capability. */
  control?: 'clear' | 'exit';
  /** Set when a capability actually mutated state, so the caller can record
   *  evidence and refresh other windows. */
  ranCapabilityId?: string;
}

const ok = (output: string, extra: Partial<DispatchResult> = {}): DispatchResult => ({
  ok: true,
  output,
  ...extra,
});
const fail = (output: string): DispatchResult => ({ ok: false, output });

function helpForAll(): string {
  const rows = CAPABILITIES.map((c) => ({ Cmdlet: c.cmdlet, Synopsis: c.synopsis }));
  return [
    'Available commands:',
    '',
    formatTable(rows),
    '',
    'Get-Help <cmdlet>   Show parameters for one command',
    'Clear-Host / cls    Clear the screen',
    'exit                Close the terminal',
  ].join('\n');
}

function helpForOne(cmdletName: string): DispatchResult {
  const cap = CAPABILITY_BY_CMDLET[cmdletName.toLowerCase()];
  if (!cap) return fail(`Get-Help: no command named '${cmdletName}'.`);

  const lines = [
    `NAME`,
    `    ${cap.cmdlet}`,
    ``,
    `SYNOPSIS`,
    `    ${cap.synopsis}`,
    ``,
    `PARAMETERS`,
  ];
  if (cap.params.length === 0) {
    lines.push('    (none)');
  } else {
    for (const p of cap.params) {
      const opts = p.options ? ` {${p.options.join(' | ')}}` : '';
      lines.push(`    -${p.name}${opts}${p.required ? '  (required)' : ''}`);
      lines.push(`        ${p.label}`);
    }
  }
  return ok(lines.join('\n'));
}

export function dispatch(line: string, ctx: CapabilityContext): DispatchResult {
  const { cmdlet, args, positional } = tokenize(line);
  if (!cmdlet) return ok('');

  const name = cmdlet.toLowerCase();

  if (name === 'cls' || name === 'clear-host' || name === 'clear') {
    return ok('', { control: 'clear' });
  }
  if (name === 'exit' || name === 'quit') {
    return ok('', { control: 'exit' });
  }
  if (name === 'get-help' || name === 'help') {
    const target = positional[0] ?? args.Name;
    return target ? helpForOne(target) : ok(helpForAll());
  }

  const cap = CAPABILITY_BY_CMDLET[name];
  if (!cap) {
    return fail(
      `The term '${cmdlet}' is not recognized as the name of a cmdlet. ` +
        `Run Get-Help to list available commands.`,
    );
  }

  // Check required parameters before running, so the learner is told which one
  // is missing instead of getting a generic failure from inside the capability.
  const missing = cap.params.filter((p) => p.required && !args[p.name]?.trim());
  if (missing.length > 0) {
    return fail(
      `${cap.cmdlet}: missing required parameter -${missing[0]!.name} (${missing[0]!.label}).`,
    );
  }

  const res = cap.run(ctx, args);
  if (!res.ok) return fail(res.error);

  const table = res.rows && res.rows.length > 0 ? formatTable(res.rows) : '';
  const output = table ? `${table}\n\n${res.message}` : res.message;
  return ok(output, cap.readOnly ? {} : { ranCapabilityId: cap.id });
}
