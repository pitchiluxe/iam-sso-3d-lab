/**
 * ui/directory/activeDirectoryView.ts — Active Directory Users and Computers.
 *
 * IAM Range's snap-in, laid out the way the real MMC console is: a domain tree
 * on the left, an object list on the right, a menu bar and toolbar, right-click
 * menus and a tabbed Properties dialog. "Where do I click to reset a password"
 * is an interview question, and muscle memory built here transfers.
 *
 * It renders through a DirectoryAdapter, so the same window serves the main
 * VM's directory and DC01's corp.technobiz.local. What each directory can do
 * (organizational units, moving by container or by department) comes from the
 * adapter; the look does not change.
 */
import { showToast } from '@/ui/toast';
import type {
  AdContainer,
  AdGroupInfo,
  AdOuInfo,
  AdRow,
  AdUserInfo,
  DirectoryAdapter,
  Result,
} from './directoryAdapter';

const PANEL_ALT = 'var(--panel-alt, var(--panel-2))';
const ON_ACCENT = 'var(--on-accent, #06231d)';

type MenuItem = { label: string; disabled?: boolean; onClick?: () => void } | { separator: true };

const ICON: Record<AdContainer['kind'], string> = { domain: '🌐', container: '📁', ou: '🗂️' };

export function renderActiveDirectoryView(body: HTMLElement, dir: DirectoryAdapter): () => void {
  body.innerHTML = '';
  Object.assign(body.style, {
    overflow: 'hidden',
    background: 'var(--panel)',
    flex: '1',
    minHeight: '0',
  });

  const firstUsers = (): string =>
    dir.tree().children.find((c) => c.name === 'Users')?.id ?? dir.tree().id;
  let selectedNodeId = firstUsers();
  let selectedRow: AdRow | null = null;
  const expanded = new Set<string>([dir.tree().id]);

  /** Show the outcome the way the snap-in does, and redraw on success. */
  const report = (r: Result): boolean => {
    showToast(r.ok ? r.message : r.error, { kind: r.ok ? 'success' : 'error' });
    if (r.ok) refresh();
    return r.ok;
  };

  const root = document.createElement('div');
  root.style.cssText =
    'display:flex;flex-direction:column;height:100%;min-height:0;' +
    "font-family:'Segoe UI',-apple-system,sans-serif;font-size:12px;color:var(--fg);";
  body.appendChild(root);

  const selectedUser = (): AdUserInfo | null =>
    selectedRow?.kind === 'user' ? selectedRow.user : null;
  const selectedGroup = (): AdGroupInfo | null =>
    selectedRow?.kind === 'group' ? selectedRow.group : null;

  // ── Menu bar ─────────────────────────────────────────────────────────────
  const menubar = document.createElement('div');
  menubar.style.cssText =
    `display:flex;gap:2px;padding:3px 6px;background:${PANEL_ALT};border-bottom:1px solid var(--border);` +
    'flex-shrink:0;font-size:11.5px;';
  const MENUS: Record<string, () => MenuItem[]> = {
    File: () => [
      { label: 'New  ▸  User', onClick: () => newUserDialog() },
      { label: 'New  ▸  Group', onClick: () => newGroupDialog() },
      {
        label: 'New  ▸  Organizational Unit',
        disabled: !dir.supportsOus,
        onClick: () => newOuDialog(),
      },
      { separator: true },
      {
        label: 'Properties',
        disabled: !selectedUser(),
        onClick: () => {
          const u = selectedUser();
          if (u) propertiesDialog(u);
        },
      },
    ],
    Action: () => {
      const user = selectedUser();
      const group = selectedGroup();
      return [
        { label: 'New  ▸  User', onClick: () => newUserDialog() },
        { label: 'New  ▸  Group', onClick: () => newGroupDialog() },
        {
          label: 'New  ▸  Organizational Unit',
          disabled: !dir.supportsOus,
          onClick: () => newOuDialog(),
        },
        { separator: true },
        {
          label: 'Reset Password…',
          disabled: !user,
          onClick: () => user && resetPasswordDialog(user),
        },
        { label: 'Add to Group…', disabled: !user, onClick: () => user && addToGroupDialog(user) },
        {
          label: 'Remove from Group…',
          disabled: !user,
          onClick: () => user && removeFromGroupDialog(user),
        },
        {
          label: 'Move…',
          disabled: !user && !group,
          onClick: () => {
            if (user) moveDialog('user', user.sam, user.displayName);
            else if (group) moveDialog('group', group.name, group.name);
          },
        },
        { separator: true },
        {
          label: user && !user.enabled ? 'Enable Account' : 'Disable Account',
          disabled: !user,
          onClick: () => user && report(dir.setEnabled(user.sam, !user.enabled)),
        },
        {
          label: 'Unlock Account',
          disabled: !user,
          onClick: () => user && report(dir.unlock(user.sam)),
        },
      ];
    },
    View: () => [
      { label: 'Refresh', onClick: () => refresh() },
      { separator: true },
      {
        label: 'Expand all',
        onClick: () => {
          for (const c of [dir.tree(), ...dir.allContainers()]) expanded.add(c.id);
          refresh();
        },
      },
      {
        label: 'Collapse all',
        onClick: () => {
          expanded.clear();
          expanded.add(dir.tree().id);
          refresh();
        },
      },
    ],
    Help: () => [
      {
        label: 'About Active Directory Users and Computers',
        onClick: () =>
          modal('About', (b) => {
            const p = document.createElement('div');
            p.style.cssText = 'font-size:12px;line-height:1.7;color:var(--fg);';
            p.textContent =
              `The directory console for ${dir.domain}. Everything it does is also a PowerShell ` +
              'cmdlet. The tree shows what exists, not a scaffold, so an empty domain looks empty.';
            b.appendChild(p);
          }),
      },
    ],
  };
  for (const label of ['File', 'Action', 'View', 'Help']) {
    const m = document.createElement('span');
    m.textContent = label;
    m.style.cssText = 'padding:2px 8px;border-radius:3px;cursor:pointer;color:var(--fg);';
    m.addEventListener('mouseenter', () => (m.style.background = 'var(--border)'));
    m.addEventListener('mouseleave', () => (m.style.background = 'transparent'));
    m.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = m.getBoundingClientRect();
      contextMenu({ clientX: rect.left, clientY: rect.bottom + 2 }, MENUS[label]!());
    });
    menubar.appendChild(m);
  }
  root.appendChild(menubar);

  // ── Toolbar ──────────────────────────────────────────────────────────────
  const toolbar = document.createElement('div');
  toolbar.style.cssText =
    `display:flex;align-items:center;gap:4px;padding:4px 6px;background:${PANEL_ALT};` +
    'border-bottom:1px solid var(--border);flex-shrink:0;flex-wrap:wrap;';
  const toolBtn = (label: string, title: string, onClick: () => void): HTMLButtonElement => {
    const b = document.createElement('button');
    b.textContent = label;
    b.title = title;
    b.style.cssText =
      'background:transparent;border:1px solid transparent;border-radius:3px;color:var(--fg);' +
      'padding:3px 8px;font-size:12px;cursor:pointer;';
    b.addEventListener('mouseenter', () => {
      b.style.background = 'var(--border)';
      b.style.borderColor = 'var(--border)';
    });
    b.addEventListener('mouseleave', () => {
      b.style.background = 'transparent';
      b.style.borderColor = 'transparent';
    });
    b.addEventListener('click', onClick);
    return b;
  };
  const ouBtn = toolBtn('🗂️ New OU', 'Create an organisational unit here', () => newOuDialog());
  if (!dir.supportsOus) ouBtn.style.display = 'none';
  toolbar.append(
    toolBtn('👤 New User', 'Create a user in this container', () => newUserDialog()),
    toolBtn('👥 New Group', 'Create a security group', () => newGroupDialog()),
    ouBtn,
    toolBtn('🔄 Refresh', 'Refresh the object list', () => refresh()),
    toolBtn('📋 Properties', 'Open the selected object', () => {
      const u = selectedUser();
      if (u) propertiesDialog(u);
      else showToast('Select a user first.', { kind: 'info' });
    }),
  );
  root.appendChild(toolbar);

  // ── Banner when the directory is not there yet (DC01 before promotion) ───
  const banner = document.createElement('div');
  banner.style.cssText =
    'display:none;padding:8px 12px;background:rgba(215,186,125,.12);border-bottom:1px solid var(--border);' +
    'color:var(--warn, #d7ba7d);font-size:12px;line-height:1.5;flex-shrink:0;';
  root.appendChild(banner);

  // ── Panes ────────────────────────────────────────────────────────────────
  const panes = document.createElement('div');
  panes.style.cssText = 'flex:1;display:flex;min-height:0;';
  root.appendChild(panes);
  const treePane = document.createElement('div');
  treePane.style.cssText =
    `width:240px;flex-shrink:0;background:${PANEL_ALT};border-right:1px solid var(--border);` +
    'overflow:auto;padding:6px 0;';
  const listPane = document.createElement('div');
  listPane.style.cssText = 'flex:1;min-width:0;overflow:auto;background:var(--panel);';
  panes.append(treePane, listPane);

  const status = document.createElement('div');
  status.style.cssText =
    `padding:4px 10px;background:${PANEL_ALT};border-top:1px solid var(--border);font-size:11px;` +
    'color:var(--muted);flex-shrink:0;';
  root.appendChild(status);

  // ── Tree ─────────────────────────────────────────────────────────────────
  function renderTree(): void {
    treePane.innerHTML = '';
    const drawNode = (node: AdContainer, depth: number): void => {
      const row = document.createElement('div');
      const isSelected = node.id === selectedNodeId;
      row.style.cssText =
        `display:flex;align-items:center;gap:4px;padding:3px 6px 3px ${6 + depth * 14}px;` +
        'cursor:pointer;font-size:12px;white-space:nowrap;' +
        (isSelected ? `background:var(--accent);color:${ON_ACCENT};` : 'color:var(--fg);');
      const hasKids = node.children.length > 0;
      const twisty = document.createElement('span');
      twisty.textContent = hasKids ? (expanded.has(node.id) ? '▾' : '▸') : ' ';
      twisty.style.cssText = 'width:10px;flex-shrink:0;color:var(--muted);font-size:9px;';
      if (hasKids) {
        twisty.addEventListener('click', (e) => {
          e.stopPropagation();
          if (expanded.has(node.id)) expanded.delete(node.id);
          else expanded.add(node.id);
          renderTree();
        });
      }
      const icon = document.createElement('span');
      icon.textContent = ICON[node.kind];
      const label = document.createElement('span');
      label.textContent = node.name;
      row.append(twisty, icon, label);
      row.addEventListener('click', () => {
        selectedNodeId = node.id;
        selectedRow = null;
        if (hasKids) expanded.add(node.id);
        renderTree();
        renderList();
      });
      row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        selectedNodeId = node.id;
        renderTree();
        renderList();
        const isOu = node.kind === 'ou' && node.name !== 'Domain Controllers';
        contextMenu(e, [
          {
            label: 'New  ▸  Organizational Unit',
            disabled: !dir.supportsOus,
            onClick: () => newOuDialog(),
          },
          { label: 'New  ▸  User', onClick: () => newUserDialog() },
          { label: 'New  ▸  Group', onClick: () => newGroupDialog() },
          { label: 'Refresh', onClick: () => refresh() },
          ...(isOu
            ? [
                { separator: true } as MenuItem,
                {
                  label: 'Delete',
                  onClick: () => confirmDeleteOu({ id: node.id, name: node.name, description: '' }),
                },
              ]
            : []),
        ]);
      });
      treePane.appendChild(row);
      if (hasKids && expanded.has(node.id))
        for (const child of node.children) drawNode(child, depth + 1);
    };
    drawNode(dir.tree(), 0);
  }

  // ── Object list ──────────────────────────────────────────────────────────
  const rowName = (r: AdRow): string =>
    r.kind === 'user'
      ? r.user.displayName
      : r.kind === 'group'
        ? r.group.name
        : r.kind === 'ou'
          ? r.ou.name
          : r.name;
  const rowType = (r: AdRow): string =>
    r.kind === 'user'
      ? 'User'
      : r.kind === 'group'
        ? `${r.group.category} Group - ${r.group.scope}`
        : r.kind === 'ou'
          ? 'Organizational Unit'
          : r.type;
  const rowDesc = (r: AdRow): string => {
    if (r.kind === 'user') {
      const base = r.user.title || r.user.department;
      const state = !r.user.enabled ? 'account disabled' : r.user.locked ? 'account locked' : '';
      return state ? `${base ? `${base} — ` : ''}${state}` : base;
    }
    if (r.kind === 'group') return r.group.description || `${r.group.members.length} member(s)`;
    if (r.kind === 'ou') return r.ou.description;
    return r.description;
  };
  const rowIcon = (r: AdRow): string =>
    r.kind === 'user'
      ? r.user.enabled
        ? '👤'
        : '🚫'
      : r.kind === 'group'
        ? '👥'
        : r.kind === 'ou'
          ? '🗂️'
          : r.type === 'Computer'
            ? '💻'
            : '👥';
  const sameRow = (a: AdRow | null, b: AdRow): boolean =>
    !!a && a.kind === b.kind && rowName(a) === rowName(b);

  function renderList(): void {
    listPane.innerHTML = '';
    const unavailable = dir.unavailable();
    banner.style.display = unavailable ? 'block' : 'none';
    banner.textContent = unavailable ?? '';
    const rows = dir.rows(selectedNodeId);

    const table = document.createElement('div');
    table.style.cssText = 'display:table;width:100%;';
    const header = document.createElement('div');
    header.style.cssText = `display:table-row;position:sticky;top:0;background:${PANEL_ALT};font-weight:600;`;
    for (const [col, width] of [
      ['Name', '34%'],
      ['Type', '24%'],
      ['Description', '42%'],
    ] as const) {
      const th = document.createElement('div');
      th.textContent = col;
      th.style.cssText =
        'display:table-cell;padding:5px 10px;border-bottom:1px solid var(--border);' +
        `border-right:1px solid var(--border);width:${width};font-size:11.5px;color:var(--fg);`;
      header.appendChild(th);
    }
    table.appendChild(header);

    for (const r of rows) {
      const tr = document.createElement('div');
      const isSel = sameRow(selectedRow, r);
      tr.style.cssText =
        'display:table-row;cursor:default;' + (isSel ? 'background:var(--accent);' : '');
      for (const [text, isName] of [
        [`${rowIcon(r)}  ${rowName(r)}`, true],
        [rowType(r), false],
        [rowDesc(r), false],
      ] as const) {
        const td = document.createElement('div');
        td.textContent = text;
        td.style.cssText =
          'display:table-cell;padding:4px 10px;border-bottom:1px solid var(--border);font-size:12px;' +
          (isSel ? `color:${ON_ACCENT};` : isName ? 'color:var(--fg);' : 'color:var(--muted);');
        tr.appendChild(td);
      }
      tr.addEventListener('click', () => {
        selectedRow = r;
        renderList();
      });
      tr.addEventListener('dblclick', () => {
        if (r.kind === 'user') propertiesDialog(r.user);
        else if (r.kind === 'group') membersDialog(r.group);
        else if (r.kind === 'ou') {
          selectedNodeId = r.ou.id;
          expanded.add(r.ou.id);
          refresh();
        }
      });
      tr.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        selectedRow = r;
        renderList();
        if (r.kind === 'user') userContextMenu(e, r.user);
        else if (r.kind === 'group') groupContextMenu(e, r.group);
        else if (r.kind === 'ou') ouContextMenu(e, r.ou);
      });
      table.appendChild(tr);
    }
    listPane.appendChild(table);

    if (rows.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = 'There are no items to show in this view.';
      empty.style.cssText = 'padding:20px;color:var(--muted);font-size:12px;';
      listPane.appendChild(empty);
    }
    status.textContent = `${rows.length} object(s)`;
  }

  // ── Context menus ────────────────────────────────────────────────────────
  function contextMenu(e: { clientX: number; clientY: number }, items: MenuItem[]): void {
    document.querySelectorAll('.aduc-menu').forEach((m) => m.remove());
    const menu = document.createElement('div');
    menu.className = 'aduc-menu';
    menu.style.cssText =
      `position:fixed;left:${e.clientX}px;top:${e.clientY}px;z-index:99999;` +
      `background:${PANEL_ALT};border:1px solid var(--border);border-radius:3px;padding:3px 0;` +
      'min-width:190px;box-shadow:0 4px 14px rgba(0,0,0,0.5);font-size:12px;';
    for (const item of items) {
      if ('separator' in item) {
        const hr = document.createElement('div');
        hr.style.cssText = 'height:1px;background:var(--border);margin:3px 0;';
        menu.appendChild(hr);
        continue;
      }
      const row = document.createElement('div');
      row.textContent = item.label;
      row.style.cssText =
        'padding:5px 14px;' +
        (item.disabled ? 'color:var(--muted);cursor:default;' : 'cursor:pointer;color:var(--fg);');
      if (!item.disabled) {
        row.addEventListener('mouseenter', () => {
          row.style.background = 'var(--accent)';
          row.style.color = ON_ACCENT;
        });
        row.addEventListener('mouseleave', () => {
          row.style.background = 'transparent';
          row.style.color = 'var(--fg)';
        });
        row.addEventListener('click', () => {
          menu.remove();
          item.onClick?.();
        });
      }
      menu.appendChild(row);
    }
    document.body.appendChild(menu);
    const close = (ev: MouseEvent): void => {
      if (!menu.contains(ev.target as Node)) {
        menu.remove();
        document.removeEventListener('mousedown', close);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', close), 0);
  }

  function userContextMenu(e: MouseEvent, u: AdUserInfo): void {
    contextMenu(e, [
      { label: 'Properties', onClick: () => propertiesDialog(u) },
      { separator: true },
      { label: 'Reset Password…', onClick: () => resetPasswordDialog(u) },
      { label: 'Unlock Account', onClick: () => report(dir.unlock(u.sam)) },
      { separator: true },
      {
        label: u.enabled ? 'Disable Account' : 'Enable Account',
        onClick: () => report(dir.setEnabled(u.sam, !u.enabled)),
      },
      { label: 'Add to Group…', onClick: () => addToGroupDialog(u) },
      { label: 'Remove from Group…', onClick: () => removeFromGroupDialog(u) },
      { label: 'Move…', onClick: () => moveDialog('user', u.sam, u.displayName) },
      { separator: true },
      {
        label: 'Delete',
        onClick: () => {
          if (window.confirm(`Delete "${u.displayName}"? This cannot be undone.`)) {
            if (report(dir.deleteUser(u.sam))) selectedRow = null;
          }
        },
      },
    ]);
  }

  function groupContextMenu(e: MouseEvent, g: AdGroupInfo): void {
    contextMenu(e, [
      { label: 'Members…', onClick: () => membersDialog(g) },
      {
        label: 'Move…',
        disabled: !dir.supportsOus,
        onClick: () => moveDialog('group', g.name, g.name),
      },
      { separator: true },
      {
        label: 'Delete',
        disabled: g.builtin,
        onClick: () => {
          if (window.confirm(`Delete group "${g.name}"? This cannot be undone.`)) {
            if (report(dir.deleteGroup(g.name))) selectedRow = null;
          }
        },
      },
    ]);
  }

  function ouContextMenu(e: MouseEvent, ou: AdOuInfo): void {
    contextMenu(e, [
      {
        label: 'Open',
        onClick: () => {
          selectedNodeId = ou.id;
          expanded.add(ou.id);
          refresh();
        },
      },
      { label: 'New  ▸  Organizational Unit', onClick: () => newOuDialog() },
      { separator: true },
      { label: 'Delete', onClick: () => confirmDeleteOu(ou) },
    ]);
  }

  function confirmDeleteOu(ou: AdOuInfo): void {
    if (!window.confirm(`Delete "${ou.name}"? The OU must be empty.`)) return;
    if (report(dir.deleteOu(ou.id)) && selectedNodeId === ou.id) {
      selectedNodeId = dir.tree().id;
      refresh();
    }
  }

  // ── Dialogs ──────────────────────────────────────────────────────────────
  function modal(title: string, build: (bodyEl: HTMLElement) => void, onOk?: () => boolean): void {
    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:99998;' +
      'display:flex;align-items:center;justify-content:center;';
    const dialog = document.createElement('div');
    dialog.style.cssText =
      `background:${PANEL_ALT};border:1px solid var(--border);border-radius:4px;min-width:400px;` +
      "max-width:560px;box-shadow:0 10px 40px rgba(0,0,0,0.6);font-family:'Segoe UI',sans-serif;";
    const bar = document.createElement('div');
    bar.textContent = title;
    bar.style.cssText =
      `padding:8px 12px;background:${PANEL_ALT};border-bottom:1px solid var(--border);font-size:12.5px;` +
      'font-weight:600;color:var(--fg);';
    const content = document.createElement('div');
    content.style.cssText = 'padding:14px;max-height:60vh;overflow:auto;';
    build(content);
    const footer = document.createElement('div');
    footer.style.cssText =
      'display:flex;justify-content:flex-end;gap:8px;padding:10px 12px;border-top:1px solid var(--border);';
    const close = (): void => overlay.remove();
    const mkBtn = (label: string, primary: boolean, onClick: () => void): HTMLElement => {
      const b = document.createElement('button');
      b.textContent = label;
      b.style.cssText =
        'padding:5px 18px;border-radius:3px;font-size:12px;cursor:pointer;' +
        (primary
          ? `background:var(--accent);border:1px solid var(--accent);color:${ON_ACCENT};`
          : 'background:var(--border);border:1px solid var(--border);color:var(--fg);');
      b.addEventListener('click', onClick);
      return b;
    };
    if (onOk) {
      footer.append(
        mkBtn('OK', true, () => {
          if (onOk()) close();
        }),
        mkBtn('Cancel', false, close),
      );
    } else footer.appendChild(mkBtn('Close', true, close));
    dialog.append(bar, content, footer);
    overlay.appendChild(dialog);
    // Enter commits and Escape cancels, as in the Windows dialog it imitates.
    overlay.addEventListener('keydown', (e) => {
      const typingMultiline = (e.target as HTMLElement | null)?.tagName === 'TEXTAREA';
      if (e.key === 'Enter' && !typingMultiline) {
        e.preventDefault();
        if (!onOk) close();
        else if (onOk()) close();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    });
    document.body.appendChild(overlay);
    const first = content.querySelector<HTMLElement>(
      'input:not([type=checkbox]), textarea, select',
    );
    if (first) {
      first.focus();
      if (first instanceof HTMLInputElement && first.value) first.select();
    }
  }

  const fieldCss =
    'flex:1;background:var(--panel);color:var(--fg);border:1px solid var(--border);border-radius:2px;' +
    'padding:4px 7px;font-size:12px;outline:none;';

  function field(
    parent: HTMLElement,
    label: string,
    opts: { type?: string; value?: string; options?: string[] } = {},
  ): () => string {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:9px;';
    const lab = document.createElement('label');
    lab.textContent = label;
    lab.style.cssText =
      'width:132px;flex-shrink:0;font-size:12px;color:var(--fg);text-align:right;';
    let read: () => string;
    if (opts.options) {
      const sel = document.createElement('select');
      sel.style.cssText = fieldCss;
      for (const o of opts.options) sel.appendChild(new Option(o, o));
      if (opts.value) sel.value = opts.value;
      row.append(lab, sel);
      read = () => sel.value;
    } else {
      const input = document.createElement('input');
      input.type = opts.type ?? 'text';
      input.value = opts.value ?? '';
      input.style.cssText = fieldCss;
      row.append(lab, input);
      read = () => input.value;
    }
    parent.appendChild(row);
    return read;
  }

  function checkbox(parent: HTMLElement, label: string, checked: boolean): () => boolean {
    const row = document.createElement('div');
    row.style.cssText =
      'display:flex;align-items:center;gap:8px;margin-left:142px;margin-bottom:6px;';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = checked;
    const lab = document.createElement('label');
    lab.textContent = label;
    lab.style.cssText = 'font-size:12px;color:var(--fg);';
    row.append(cb, lab);
    parent.appendChild(row);
    return () => cb.checked;
  }

  function hint(parent: HTMLElement, text: string): void {
    const h = document.createElement('div');
    h.textContent = text;
    h.style.cssText = 'font-size:11px;color:var(--muted);margin-top:10px;line-height:1.5;';
    parent.appendChild(h);
  }

  /** The container a new object goes into: the selected one, or Users. */
  const targetContainer = (): { id: string; name: string } => {
    const all = [dir.tree(), ...dir.allContainers()];
    const c = all.find((x) => x.id === selectedNodeId);
    if (
      !c ||
      c.kind === 'domain' ||
      c.name === 'Builtin' ||
      c.name === 'Computers' ||
      c.name === 'Domain Controllers'
    ) {
      const users = all.find((x) => x.name === 'Users');
      return { id: users?.id ?? selectedNodeId, name: 'Users' };
    }
    return { id: c.id, name: c.name };
  };

  function newUserDialog(): void {
    const where = targetContainer();
    let readFirst = (): string => '';
    let readLast = (): string => '';
    let readLogon = (): string => '';
    let readDept = (): string => '';
    let readTitle = (): string => '';
    let readPwd = (): string => '';
    let readChange = (): boolean => true;
    modal(
      `New Object — User (in ${where.name})`,
      (b) => {
        readFirst = field(b, 'First name:');
        readLast = field(b, 'Last name:');
        readLogon = field(b, 'User logon name:');
        readDept = dir.departments
          ? field(b, 'Department:', { options: [...dir.departments] })
          : field(b, 'Department:');
        readTitle = field(b, 'Job title:');
        readPwd = field(b, 'Password:', { type: 'password' });
        readChange = checkbox(b, 'User must change password at next logon', true);
        hint(b, `Created in ${where.name}. The password must meet the domain's password policy.`);
      },
      () => {
        const first = readFirst().trim();
        const last = readLast().trim();
        if (!first && !last) {
          showToast('A first or last name is required.', { kind: 'error' });
          return false;
        }
        const logon =
          readLogon().trim() || `${first}.${last}`.toLowerCase().replace(/[^a-z0-9.]/g, '');
        return report(
          dir.createUser({
            first,
            last,
            logon,
            department: readDept().trim(),
            title: readTitle().trim(),
            password: readPwd(),
            mustChange: readChange(),
            containerId: where.id,
          }),
        );
      },
    );
  }

  function newGroupDialog(): void {
    const where = targetContainer();
    let readName = (): string => '';
    let readDesc = (): string => '';
    let readScope = (): string => 'Global';
    let readCat = (): string => 'Security';
    modal(
      `New Object — Group (in ${where.name})`,
      (b) => {
        readName = field(b, 'Group name:');
        readDesc = field(b, 'Description:');
        readScope = field(b, 'Group scope:', {
          options: ['Global', 'DomainLocal', 'Universal'],
          value: 'Global',
        });
        readCat = field(b, 'Group type:', {
          options: ['Security', 'Distribution'],
          value: 'Security',
        });
      },
      () => {
        const name = readName().trim();
        if (!name) {
          showToast('A group name is required.', { kind: 'error' });
          return false;
        }
        return report(
          dir.createGroup({
            name,
            description: readDesc().trim(),
            scope: readScope(),
            category: readCat(),
            containerId: where.id,
          }),
        );
      },
    );
  }

  function newOuDialog(): void {
    if (!dir.supportsOus) {
      report(dir.createOu({ name: '', description: '', containerId: selectedNodeId }));
      return;
    }
    const all = [dir.tree(), ...dir.allContainers()];
    const sel = all.find((x) => x.id === selectedNodeId);
    const parent =
      sel && (sel.kind === 'ou' || sel.kind === 'domain') && sel.name !== 'Domain Controllers'
        ? sel
        : dir.tree();
    let readName = (): string => '';
    let readDesc = (): string => '';
    modal(
      `New Object — Organizational Unit (in ${parent.name})`,
      (b) => {
        readName = field(b, 'Name:');
        readDesc = field(b, 'Description:');
      },
      () => {
        const name = readName().trim();
        if (!name) {
          showToast('A name is required.', { kind: 'error' });
          return false;
        }
        const ok = report(
          dir.createOu({ name, description: readDesc().trim(), containerId: parent.id }),
        );
        if (ok) expanded.add(parent.id);
        return ok;
      },
    );
  }

  function resetPasswordDialog(u: AdUserInfo): void {
    let readPwd = (): string => '';
    let readConfirm = (): string => '';
    let readChange = (): boolean => true;
    let readUnlock = (): boolean => false;
    modal(
      `Reset Password — ${u.displayName}`,
      (b) => {
        readPwd = field(b, 'New password:', { type: 'password' });
        readConfirm = field(b, 'Confirm password:', { type: 'password' });
        readChange = checkbox(b, 'User must change password at next logon', true);
        readUnlock = checkbox(b, "Unlock the user's account", u.locked);
      },
      () => {
        if (readPwd() !== readConfirm()) {
          showToast('The passwords do not match.', { kind: 'error' });
          return false;
        }
        const ok = report(dir.resetPassword(u.sam, readPwd(), readChange()));
        if (ok && readUnlock()) report(dir.unlock(u.sam));
        return ok;
      },
    );
  }

  function addToGroupDialog(u: AdUserInfo): void {
    const groups = dir
      .allGroups()
      .filter((g) => !u.memberOf.includes(g.name))
      .map((g) => g.name);
    if (groups.length === 0) {
      showToast(`${u.displayName} is already in every group.`, { kind: 'info' });
      return;
    }
    let readGroup = (): string => '';
    modal(
      `Add ${u.displayName} to Group`,
      (b) => {
        readGroup = field(b, 'Group:', { options: groups });
      },
      () => report(dir.addMember(u.sam, readGroup())),
    );
  }

  function removeFromGroupDialog(u: AdUserInfo): void {
    if (u.memberOf.length === 0) {
      showToast(`${u.displayName} is not a member of any group.`, { kind: 'info' });
      return;
    }
    let readGroup = (): string => '';
    modal(
      `Remove ${u.displayName} from Group`,
      (b) => {
        readGroup = field(b, 'Group:', { options: u.memberOf });
      },
      () => report(dir.removeMember(u.sam, readGroup())),
    );
  }

  function moveDialog(kind: 'user' | 'group', id: string, label: string): void {
    let read = (): string => '';
    if (dir.departments) {
      modal(
        `Move — ${label}`,
        (b) => {
          read = field(b, 'Move to department:', { options: [...dir.departments!] });
        },
        () => report(dir.move(kind, id, read())),
      );
      return;
    }
    const targets = dir
      .allContainers()
      .filter(
        (c) => c.name !== 'Builtin' && c.name !== 'Computers' && c.name !== 'Domain Controllers',
      );
    modal(
      `Move — ${label}`,
      (b) => {
        const names = targets.map((t) => t.id);
        read = field(b, 'Move object into:', { options: names });
      },
      () => report(dir.move(kind, id, read())),
    );
  }

  function membersDialog(g: AdGroupInfo): void {
    modal(`${g.name} Properties`, (b) => {
      const info = document.createElement('div');
      info.style.cssText = 'font-size:12px;color:var(--muted);margin-bottom:8px;';
      info.textContent = `${g.category} group · ${g.scope} scope${g.description ? ` · ${g.description}` : ''}`;
      const pre = document.createElement('pre');
      pre.textContent = g.members.length ? g.members.join('\n') : '(no members)';
      pre.style.cssText = 'margin:0;font-size:12px;color:var(--fg);';
      b.append(info, pre);
    });
  }

  /** The tabbed Properties sheet, which is where ADUC muscle memory lives. */
  function propertiesDialog(u: AdUserInfo): void {
    modal(`${u.displayName} Properties`, (b) => {
      const tabs = ['General', 'Account', 'Organization', 'Member Of'];
      let active = 'General';
      const tabBar = document.createElement('div');
      tabBar.style.cssText =
        'display:flex;gap:2px;border-bottom:1px solid var(--border);margin-bottom:12px;';
      const panel = document.createElement('div');
      const paint = (): void => {
        tabBar.innerHTML = '';
        for (const t of tabs) {
          const tab = document.createElement('div');
          tab.textContent = t;
          tab.style.cssText =
            'padding:5px 14px;font-size:12px;cursor:pointer;border:1px solid transparent;border-bottom:none;' +
            'border-radius:3px 3px 0 0;' +
            (t === active
              ? `background:${PANEL_ALT};border-color:var(--border);color:var(--fg);margin-bottom:-1px;`
              : 'color:var(--muted);');
          tab.addEventListener('click', () => {
            active = t;
            paint();
          });
          tabBar.appendChild(tab);
        }
        panel.innerHTML = '';
        const info = (k: string, v: string): void => {
          const row = document.createElement('div');
          row.style.cssText = 'display:flex;gap:10px;margin-bottom:7px;font-size:12px;';
          const key = document.createElement('span');
          key.textContent = k;
          key.style.cssText = 'width:150px;flex-shrink:0;color:var(--muted);text-align:right;';
          const val = document.createElement('span');
          val.textContent = v;
          val.style.cssText = 'color:var(--fg);';
          row.append(key, val);
          panel.appendChild(row);
        };
        if (active === 'General') {
          info('Display name:', u.displayName);
          info('Description:', u.title || '—');
          info('E-mail:', u.email || '—');
        } else if (active === 'Account') {
          info('User logon name:', u.upn);
          info('pre-Windows 2000:', u.sam);
          info('Account:', u.enabled ? 'Enabled' : 'Disabled');
          info('Locked out:', u.locked ? 'Yes' : 'No');
          info('Must change password:', u.mustChangePassword ? 'Yes — at next logon' : 'No');
          info('Last sign-in:', u.lastSignIn ? new Date(u.lastSignIn).toLocaleString() : 'never');
        } else if (active === 'Organization') {
          info('Job title:', u.title || '—');
          info('Department:', u.department || '—');
        } else {
          if (u.memberOf.length === 0) info('Member of:', '(none)');
          for (const g of u.memberOf) info('', g);
        }
      };
      paint();
      b.append(tabBar, panel);
    });
  }

  function refresh(): void {
    const all = [dir.tree(), ...dir.allContainers()];
    if (!all.some((c) => c.id === selectedNodeId)) selectedNodeId = firstUsers();
    renderTree();
    renderList();
  }

  // A closed window unsubscribes itself the next time the directory changes.
  const off = dir.subscribe(() => {
    if (root.isConnected) refresh();
    else off();
  });
  refresh();
  return off;
}
