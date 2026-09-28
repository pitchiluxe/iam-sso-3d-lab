/**
 * ui/machines/fileApps.ts — Notepad and File Explorer on DC01 and CLIENT01.
 *
 * The IAM Portfolio grades what a learner leaves on DC01's disk (scripts,
 * logs, access matrices, reports in C:\IAM), so the machines need a way to
 * write it. Folders and deletions go through the same commands PowerShell
 * runs (mkdir, New-Item, Remove-Item), so they land in the lab history; a
 * Notepad save writes the file directly, as Notepad does.
 */
import { readFile, writeFile } from '@/vm/adlab/commands';
import type { HostName } from '@/vm/adlab/state';
import { notifyWorldChanged } from '@/vm/adlab/world';
import type { MachineApp, MachineContext } from './machineWindow';
import { BTN, INPUT, dialog, h, runAll } from './sharedApps';

/** A file a caller asked Notepad to open, per machine, picked up when Notepad renders. */
const pending: Partial<Record<HostName, string>> = {};
const OPEN_EVENT = 'mw-notepad-open';

/** Open `path` in this machine's Notepad (starting Notepad if needed). */
export function openInNotepad(ctx: MachineContext, path: string): void {
  pending[ctx.host] = path;
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { host: ctx.host, path } }));
  ctx.open('notepad');
}

/** Folder names for display: the first path a folder was created with is lower-cased, so title-case it. */
function displayPath(p: string): string {
  return p.replace(/^([a-z]):/, (_, d: string) => `${d.toUpperCase()}:`);
}

export function notepadApp(): MachineApp {
  return {
    id: 'notepad',
    title: 'Notepad',
    icon: '📝',
    width: 720,
    height: 480,
    desktop: true,
    render(body, ctx) {
      body.style.cssText += 'display:flex;flex-direction:column;background:#fff;color:#1b1b1b;';
      let path: string | null = null;
      let dirty = false;
      const menu = h(
        'div',
        'display:flex;gap:2px;padding:2px 6px;border-bottom:1px solid #e5e5e5;background:#f9f9f9;font-size:12px;',
      );
      const status = h(
        'div',
        'padding:3px 10px;border-top:1px solid #e5e5e5;background:#f3f3f3;font-size:11px;color:#555;',
      );
      const area = h(
        'textarea',
        "flex:1;border:none;outline:none;resize:none;padding:8px 10px;font:13px/1.45 Consolas,'Cascadia Mono',monospace;color:#1b1b1b;background:#fff;",
      );
      area.spellcheck = false;
      const paintStatus = (msg?: string): void => {
        status.textContent =
          msg ?? `${path ? displayPath(path) : 'Untitled'}${dirty ? ' • unsaved' : ''}`;
      };
      area.addEventListener('input', () => {
        dirty = true;
        paintStatus();
      });

      const load = (p: string): void => {
        const text = readFile(ctx.world().state.hosts[ctx.host], p);
        if (text === null) {
          // Notepad offers to create a file that does not exist yet.
          path = p;
          area.value = '';
          dirty = false;
          paintStatus(`${displayPath(p)} — new file (saved when you press Save)`);
          return;
        }
        path = p;
        area.value = text;
        dirty = false;
        paintStatus();
      };

      const save = (p: string): boolean => {
        const w = ctx.world();
        const err = writeFile(w.state, w.state.hosts[ctx.host], p, area.value, false);
        if (err) {
          dialog(body, 'Notepad', (b) => b.append(h('div', 'max-width:420px;', err)));
          return false;
        }
        notifyWorldChanged(w);
        path = p;
        dirty = false;
        paintStatus(`Saved ${displayPath(p)}`);
        return true;
      };

      const saveAs = (): void => {
        let input: HTMLInputElement;
        dialog(
          body,
          'Save As',
          (b) => {
            b.append(h('div', 'margin-bottom:6px;', 'File name (full path):'));
            input = h('input', `${INPUT}width:360px;`);
            input.value = path ? displayPath(path) : 'C:\\IAM\\notes.txt';
            b.append(
              input,
              h(
                'div',
                'color:#555;margin-top:8px;line-height:1.5;',
                'The folder must exist. Create it in File Explorer or with mkdir.',
              ),
            );
          },
          () => save(input.value.trim()),
        );
      };

      const openDialog = (): void => {
        let input: HTMLInputElement;
        dialog(
          body,
          'Open',
          (b) => {
            b.append(h('div', 'margin-bottom:6px;', 'File name (full path):'));
            input = h('input', `${INPUT}width:360px;`);
            input.value = path ? displayPath(path) : 'C:\\';
            b.append(input);
            const files = ctx.world().state.hosts[ctx.host].files ?? [];
            if (files.length) {
              const list = h(
                'div',
                'margin-top:8px;max-height:180px;overflow:auto;border:1px solid #cfcfcf;background:#fff;',
              );
              for (const f of files) {
                const row = h('div', 'padding:3px 8px;cursor:pointer;', `📄 ${f.path}`);
                row.addEventListener('click', () => (input.value = f.path));
                list.append(row);
              }
              b.append(list);
            }
          },
          () => {
            load(input.value.trim());
            return true;
          },
        );
      };

      const item = (label: string, fn: () => void): void => {
        const b = h(
          'button',
          'padding:3px 10px;border:none;background:transparent;font:inherit;cursor:pointer;',
          label,
        );
        b.addEventListener('mouseenter', () => (b.style.background = '#e5e5e5'));
        b.addEventListener('mouseleave', () => (b.style.background = 'transparent'));
        b.addEventListener('click', fn);
        menu.append(b);
      };
      item('New', () => {
        path = null;
        area.value = '';
        dirty = false;
        paintStatus();
      });
      item('Open…', openDialog);
      item('Save', () => (path ? void save(path) : saveAs()));
      item('Save As…', saveAs);

      area.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key.toLowerCase() === 's') {
          e.preventDefault();
          if (path) save(path);
          else saveAs();
        }
      });

      const onOpen = (e: Event): void => {
        if (!body.isConnected) {
          window.removeEventListener(OPEN_EVENT, onOpen);
          return;
        }
        const d = (e as CustomEvent<{ host: HostName; path: string }>).detail;
        if (d.host === ctx.host) {
          delete pending[ctx.host];
          load(d.path);
        }
      };
      window.addEventListener(OPEN_EVENT, onOpen);

      body.append(menu, area, status);
      const first = pending[ctx.host];
      delete pending[ctx.host];
      if (first) load(first);
      else paintStatus();
      setTimeout(() => area.focus(), 0);
    },
  };
}

export function explorerApp(): MachineApp {
  return {
    id: 'explorer',
    title: 'File Explorer',
    icon: '📁',
    width: 820,
    height: 500,
    desktop: true,
    render(body, ctx) {
      body.style.cssText += 'display:flex;flex-direction:column;background:#fff;color:#1b1b1b;';
      let cwd = 'c:';
      const bar = h(
        'div',
        'display:flex;gap:6px;align-items:center;padding:6px 8px;border-bottom:1px solid #e5e5e5;background:#f9f9f9;',
      );
      const up = h('button', BTN, '↑');
      up.title = 'Up';
      const addr = h('input', `${INPUT}flex:1;`);
      const newFolder = h('button', BTN, '📁 New folder');
      const newFile = h('button', BTN, '📄 New text file');
      bar.append(up, addr, newFolder, newFile);
      const main = h('div', 'flex:1;min-height:0;display:flex;');
      const tree = h(
        'div',
        'width:200px;flex-shrink:0;overflow:auto;border-right:1px solid #e5e5e5;padding:6px 0;font-size:12px;',
      );
      const list = h('div', 'flex:1;overflow:auto;font-size:12px;');
      main.append(tree, list);
      const status = h(
        'div',
        'padding:3px 10px;border-top:1px solid #e5e5e5;background:#f3f3f3;font-size:11px;color:#555;',
      );
      body.append(bar, main, status);

      const host = (): ReturnType<MachineContext['world']>['state']['hosts'][HostName] =>
        ctx.world().state.hosts[ctx.host];
      const parent = (p: string): string => (p.includes('\\') ? p.replace(/\\[^\\]*$/, '') : p);
      const name = (p: string): string => p.split('\\').pop() ?? p;

      const menuFor = (e: MouseEvent, target: string, isFile: boolean): void => {
        e.preventDefault();
        body.querySelector('[data-exp-menu]')?.remove();
        const m = h(
          'div',
          `position:absolute;left:${e.offsetX + 10}px;top:${e.offsetY + 40}px;background:#fff;border:1px solid #bbb;box-shadow:0 4px 14px rgba(0,0,0,.2);z-index:50;font-size:12px;min-width:160px;`,
        );
        m.dataset.expMenu = '1';
        const opt = (label: string, fn: () => void): void => {
          const o = h('div', 'padding:6px 12px;cursor:pointer;', label);
          o.addEventListener('mouseenter', () => (o.style.background = '#e5f1fb'));
          o.addEventListener('mouseleave', () => (o.style.background = ''));
          o.addEventListener('click', () => {
            m.remove();
            fn();
          });
          m.append(o);
        };
        if (isFile) opt('Edit in Notepad', () => openInNotepad(ctx, target));
        else opt('Open', () => go(target));
        if (!isFile)
          opt('Properties › Security (icacls)', () => {
            const r = ctx.run(`icacls "${displayPath(target)}"`);
            dialog(body, `${name(displayPath(target))} Properties — Security`, (b) =>
              b.append(
                h(
                  'div',
                  'white-space:pre-wrap;font-family:Consolas,monospace;font-size:11.5px;max-width:480px;',
                  r.output,
                ),
              ),
            );
          });
        opt('Delete', () =>
          dialog(
            body,
            'Delete',
            (b) =>
              b.append(
                h(
                  'div',
                  '',
                  `Delete ${displayPath(target)}${isFile ? '' : ' and everything in it'}?`,
                ),
              ),
            () => {
              const ok = runAll(
                ctx,
                [`Remove-Item "${displayPath(target)}"${isFile ? '' : ' -Recurse'}`],
                body,
              );
              paint();
              return ok;
            },
          ),
        );
        body.style.position = 'relative';
        body.append(m);
        const off = (): void => {
          m.remove();
          document.removeEventListener('click', off);
        };
        setTimeout(() => document.addEventListener('click', off), 0);
      };

      const go = (p: string): void => {
        cwd = p.toLowerCase().replace(/\\+$/, '');
        paint();
      };

      function paint(): void {
        const hs = host();
        const folders = [...hs.folders].sort();
        const files = hs.files ?? [];
        const label = (p: string): string => hs.folderCase?.[p] ?? displayPath(p);
        addr.value = cwd.length === 2 ? `${displayPath(cwd)}\\` : label(cwd);

        tree.innerHTML = '';
        const node = (p: string, depth: number): void => {
          const row = h(
            'div',
            `padding:3px 8px 3px ${8 + depth * 14}px;cursor:pointer;white-space:nowrap;${p === cwd ? 'background:#cce8ff;' : ''}`,
            `${depth === 0 ? '💽' : '📁'} ${depth === 0 ? `Local Disk (${displayPath(p)})` : name(label(p))}`,
          );
          row.addEventListener('click', () => go(p));
          tree.append(row);
          for (const f of folders.filter((x) => parent(x) === p)) node(f, depth + 1);
        };
        node('c:', 0);

        list.innerHTML = '';
        const head = h(
          'div',
          'display:grid;grid-template-columns:1fr 170px 80px;padding:5px 12px;border-bottom:1px solid #e5e5e5;color:#555;',
        );
        head.append(h('span', '', 'Name'), h('span', '', 'Date modified'), h('span', '', 'Size'));
        list.append(head);
        const row = (icon: string, label: string, date: string, size: string): HTMLElement => {
          const r = h(
            'div',
            'display:grid;grid-template-columns:1fr 170px 80px;padding:4px 12px;cursor:default;',
          );
          r.append(
            h('span', '', `${icon} ${label}`),
            h('span', 'color:#555;', date),
            h('span', 'color:#555;', size),
          );
          r.addEventListener('mouseenter', () => (r.style.background = '#e5f1fb'));
          r.addEventListener('mouseleave', () => (r.style.background = ''));
          list.append(r);
          return r;
        };
        const subs = folders.filter((x) => parent(x) === cwd);
        const here = files.filter((f) => parent(f.path.toLowerCase()) === cwd);
        for (const d of subs) {
          const r = row('📁', name(label(d)), '', '');
          r.addEventListener('dblclick', () => go(d));
          r.addEventListener('contextmenu', (e) => menuFor(e, d, false));
        }
        for (const f of here) {
          const r = row(
            /\.ps1$/i.test(f.path) ? '📜' : '📄',
            name(f.path),
            new Date(f.modified).toLocaleString('en-US'),
            `${Math.max(1, Math.ceil(f.content.length / 1024))} KB`,
          );
          r.addEventListener('dblclick', () => openInNotepad(ctx, f.path));
          r.addEventListener('contextmenu', (e) => menuFor(e, f.path, true));
        }
        if (subs.length === 0 && here.length === 0)
          list.append(h('div', 'padding:18px;color:#777;', 'This folder is empty.'));
        status.textContent = `${subs.length + here.length} item(s) — double-click a file to edit it; right-click for more`;
      }

      up.addEventListener('click', () => go(parent(cwd)));
      addr.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        const p = addr.value.trim().toLowerCase().replace(/\\+$/, '');
        if (p.length === 2 || host().folders.includes(p)) go(p);
        else
          dialog(body, 'File Explorer', (b) =>
            b.append(h('div', '', `Windows can't find '${addr.value}'.`)),
          );
      });
      newFolder.addEventListener('click', () => {
        let input: HTMLInputElement;
        dialog(
          body,
          'New folder',
          (b) => {
            input = h('input', `${INPUT}width:300px;`);
            input.value = 'New folder';
            b.append(input);
          },
          () => {
            const ok = runAll(ctx, [`mkdir "${displayPath(cwd)}\\${input.value.trim()}"`], body);
            paint();
            return ok;
          },
        );
      });
      newFile.addEventListener('click', () => {
        let input: HTMLInputElement;
        dialog(
          body,
          'New text file',
          (b) => {
            input = h('input', `${INPUT}width:300px;`);
            input.value = 'New Text Document.txt';
            b.append(input);
          },
          () => {
            const p = `${displayPath(cwd)}\\${input.value.trim()}`;
            const ok = runAll(ctx, [`New-Item -ItemType File -Path "${p}"`], body);
            paint();
            if (ok) openInNotepad(ctx, p);
            return ok;
          },
        );
      });
      paint();
      ctx.onChange(paint);
    },
  };
}
