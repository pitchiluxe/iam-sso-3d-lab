/**
 * ui/consoles/fileExplorerWindow.ts — VM File Explorer window.
 *
 * Mimics Windows Explorer. Left sidebar has Quick Access + This PC.
 * Right pane shows folder contents as icons. Double-clicking AIHub Browser
 * icon launches the bundled .exe via Electron IPC.
 *
 * Shell operations use window.electron.invoke('shell:openPath', path)
 * which is set up in electron/main.cjs. Falls back gracefully if not available.
 */
export function renderFileExplorerWindow(body: HTMLElement): void {
  body.style.cssText = 'display:flex;flex-direction:column;height:100%;background:#0e1116;font-family:"Segoe UI Variable","Segoe UI",sans-serif;font-size:12px;color:#c8cdd3;';

  // Path to the AIHub Browser exe — passed via window.env from electron/main.cjs
  // In dev: falls back to a known local path. In prod: set by electron builder extraResources.
  const AIHUB_EXE = (window as unknown as { env?: { AIHUB_EXE?: string } }).env?.AIHUB_EXE
    ?? 'C:\\Users\\erick\\Documents\\_My_Digital_Solutions\\AIHub-Browser\\dist\\AIHub-Browser-1.45.1-win-x64.exe';

  // Current path state
  let currentPath = 'C:\\';
  const history: string[] = ['C:\\'];
  let histIdx = 0;

  const sidebarItems = [
    { id: 'qa', label: 'Quick Access', children: [
        { id: 'documents', label: '📁 Documents', path: 'C:\\Users\\Public\\Documents' },
        { id: 'pictures', label: '🖼️ Pictures', path: 'C:\\Users\\Public\\Pictures' },
        { id: 'downloads', label: '⬇️ Downloads', path: 'C:\\Users\\Public\\Downloads' },
      ]},
    { id: 'thispc', label: 'This PC', children: [
        { id: 'c_drive', label: '💾 OS (C:)', path: 'C:\\' },
      ]},
    ];

  // ── Layout ──────────────────────────────────────────────────────────────
  const main = document.createElement('div');
  main.style.cssText = 'display:flex;flex:1;min-height:0;overflow:hidden;';
  body.appendChild(main);

  // Sidebar
  const sidebar = document.createElement('div');
  sidebar.style.cssText = `
    width:180px;flex-shrink:0;background:#1b1f24;border-right:1px solid #2d343d;
    overflow-y:auto;padding:8px 0;
  `;
  main.appendChild(sidebar);

  for (const group of sidebarItems) {
    const groupEl = document.createElement('div');
    groupEl.style.cssText = 'margin-bottom:4px;';
    const label = document.createElement('div');
    label.style.cssText = 'font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#8b95a1;padding:6px 14px 4px;cursor:pointer;';
    label.textContent = group.label;
    groupEl.appendChild(label);
    for (const item of group.children) {
      const itemBtn = document.createElement('button');
      itemBtn.style.cssText = `
        display:block;width:100%;text-align:left;padding:6px 14px;
        background:transparent;border:none;cursor:pointer;font-size:12px;
        color:#c8cdd3;transition:background 0.1s;
      `;
      itemBtn.textContent = item.label;
      itemBtn.addEventListener('mouseenter', () => { itemBtn.style.background = '#232830'; });
      itemBtn.addEventListener('mouseleave', () => { itemBtn.style.background = 'transparent'; });
      itemBtn.addEventListener('click', () => navigateTo(item.path));
      groupEl.appendChild(itemBtn);
    }
    sidebar.appendChild(groupEl);
  }

  // Content area
  const content = document.createElement('div');
  content.style.cssText = 'flex:1;display:flex;flex-direction:column;min-width:0;';
  main.appendChild(content);

  // Breadcrumb
  const breadcrumb = document.createElement('div');
  breadcrumb.id = 'fe-breadcrumb';
  breadcrumb.style.cssText = `
    height:34px;display:flex;align-items:center;gap:4px;
    padding:0 12px;border-bottom:1px solid #2d343d;background:#1b1f24;
    font-size:12px;flex-shrink:0;overflow-x:auto;
  `;
  content.appendChild(breadcrumb);

  // Icon grid
  const grid = document.createElement('div');
  grid.id = 'fe-grid';
  grid.style.cssText = 'flex:1;padding:12px;display:grid;grid-template-columns:repeat(auto-fill,80px);grid-auto-rows:90px;gap:8px;overflow-y:auto;align-content:start;';
  content.appendChild(grid);

  // ── Render helpers ──────────────────────────────────────────────────────

  function renderBreadcrumb(path: string): void {
    const parts = path.split('\\').filter(Boolean);
    breadcrumb.innerHTML = '';
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      const seg = document.createElement('span');
      seg.style.cssText = 'cursor:pointer;color:#4ec9b0;white-space:nowrap;';
      seg.textContent = part;
      seg.addEventListener('click', () => {
        const newPath = parts.slice(0, i + 1).join('\\') + '\\';
        navigateTo(newPath);
      });
      breadcrumb.appendChild(seg);
      if (i < parts.length - 1) {
        const arrow = document.createElement('span');
        arrow.style.cssText = 'color:#4a5568;pointer-events:none;';
        arrow.textContent = ' › ';
        breadcrumb.appendChild(arrow);
      }
    }
  }

  function renderFolderContents(path: string): void {
    renderBreadcrumb(path);
    grid.innerHTML = '';

    // Define the "contents" of each simulated folder
    const folderContents: Record<string, Array<{ icon: string; name: string; type: 'folder'|'file'|'app'; path?: string; launch?: string }>> = {
      'C:\\': [
        { icon: '📁', name: 'Program Files', type: 'folder', path: 'C:\\Program Files' },
        { icon: '📁', name: 'Program Files (x86)', type: 'folder', path: 'C:\\Program Files (x86)' },
        { icon: '📁', name: 'Users', type: 'folder', path: 'C:\\Users' },
        { icon: '📁', name: 'Windows', type: 'folder', path: 'C:\\Windows' },
        { icon: '🖥️', name: 'AIHub Browser', type: 'app', launch: 'aihub-browser' },
      ],
      'C:\\Program Files': [
        { icon: '📁', name: 'Apex Identity', type: 'folder', path: 'C:\\Program Files\\Apex Identity' },
      ],
      'C:\\Program Files (x86)': [
        { icon: '📁', name: 'Apex Identity', type: 'folder', path: 'C:\\Program Files (x86)\\Apex Identity' },
      ],
      'C:\\Users': [
        { icon: '📁', name: 'Public', type: 'folder', path: 'C:\\Users\\Public' },
      ],
      'C:\\Users\\Public': [
        { icon: '📁', name: 'Documents', type: 'folder', path: 'C:\\Users\\Public\\Documents' },
        { icon: '📁', name: 'Pictures', type: 'folder', path: 'C:\\Users\\Public\\Pictures' },
        { icon: '📁', name: 'Downloads', type: 'folder', path: 'C:\\Users\\Public\\Downloads' },
      ],
      'C:\\Users\\Public\\Documents': [
        { icon: '📄', name: 'policy.docx', type: 'file' },
        { icon: '📄', name: 'onboarding_checklist.pdf', type: 'file' },
        { icon: '📄', name: 'rbac_guide.docx', type: 'file' },
      ],
      'C:\\Users\\Public\\Pictures': [
        { icon: '🖼️', name: 'banner.png', type: 'file' },
        { icon: '🖼️', name: 'screenshots', type: 'folder', path: 'C:\\Users\\Public\\Pictures\\Screenshots' },
      ],
      'C:\\Users\\Public\\Downloads': [
        { icon: '📦', name: 'agent_install.zip', type: 'file' },
        { icon: '📄', name: 'readme.txt', type: 'file' },
      ],
      'C:\\Program Files\\Apex Identity': [
        { icon: '🔐', name: 'IAM Console.exe', type: 'app', launch: 'iam-console' },
        { icon: '🎫', name: 'Ticket Queue.exe', type: 'app', launch: 'ticket-console' },
        { icon: '🛡️', name: 'SecOps Dashboard.exe', type: 'app', launch: 'secops-dashboard' },
      ],
    };

    const items = folderContents[path] ?? [];
    if (items.length === 0) {
      grid.innerHTML = `<div style="grid-column:1/-1;padding:20px;color:#8b95a1;text-align:center;">This folder is empty.</div>`;
      return;
    }

    for (const item of items) {
      const cell = document.createElement('button');
      cell.style.cssText = `
        display:flex;flex-direction:column;align-items:center;gap:4px;
        padding:8px 4px;border-radius:6px;border:none;cursor:pointer;
        background:transparent;transition:background 0.1s;
        font-size:11px;color:#c8cdd3;width:80px;
      `;
      cell.innerHTML = `
        <span style="font-size:28px;">${item.icon}</span>
        <span style="text-align:center;line-height:1.3;word-break:break-all;">${item.name}</span>
      `;
      cell.addEventListener('dblclick', () => {
        if (item.type === 'folder' && item.path) {
          navigateTo(item.path);
        } else if (item.type === 'app' && item.launch === 'aihub-browser') {
          launchAIHub();
        } else if (item.type === 'app' && item.launch) {
          // Launch the VM console app
          const __lab = (window as unknown as { __lab?: {
            desktop?: { openWindow(id: string, c: unknown): void };
            conductor?: unknown;
          } }).__lab;
          if (__lab?.desktop && __lab.conductor) {
            __lab.desktop.openWindow(item.launch, __lab.conductor);
          }
        }
      });
      cell.addEventListener('mouseenter', () => { cell.style.background = '#232830'; });
      cell.addEventListener('mouseleave', () => { cell.style.background = 'transparent'; });
      grid.appendChild(cell);
    }
  }

  function navigateTo(path: string): void {
    currentPath = path;
    histIdx = history.length;
    history.length = histIdx;
    history.push(path);
    renderFolderContents(path);
  }

  async function launchAIHub(): Promise<void> {
    const msg = document.createElement('div');
    msg.style.cssText = `
      position:absolute;bottom:8px;left:50%;transform:translateX(-50%);
      background:#232830;border:1px solid #4ec9b0;border-radius:6px;
      padding:6px 14px;font-size:11px;color:#4ec9b0;z-index:10;white-space:nowrap;
    `;
    msg.textContent = '🚀 Launching AIHub Browser…';
    body.appendChild(msg);

    try {
      // Use Electron IPC if available (set up in electron/main.cjs)
      const electron = (window as unknown as { electron?: { invoke(cmd: string, path: string): Promise<unknown> } }).electron;
      if (electron) {
        await electron.invoke('shell:openPath', AIHUB_EXE);
      } else {
        // Fallback: open via URL (only works in Electron with shell.openPath)
        console.warn('[fileExplorer] Electron bridge not available — cannot launch AIHub Browser');
      }
      msg.style.color = '#4ec9b0';
      msg.textContent = '✅ AIHub Browser launched!';
      setTimeout(() => msg.remove(), 2000);
    } catch (err) {
      msg.style.color = '#f48771';
      msg.textContent = `❌ Failed to launch: ${err instanceof Error ? err.message : String(err)}`;
      setTimeout(() => msg.remove(), 3000);
    }
  }

  // Initial render
  renderFolderContents(currentPath);
}
