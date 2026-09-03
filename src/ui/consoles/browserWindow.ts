/**
 * ui/consoles/browserWindow.ts — simulated web browser inside the VM.
 *
 * Shows a realistic browser UI with a URL bar, bookmarks, and renders
 * the target application's login/OAuth page when applicable.
 * The browser is a simulation: it shows mock pages rather than loading real URLs.
 */
import { labStore } from '@/stores';

export function renderBrowserWindow(body: HTMLElement): void {
  // Fixed URL bar state
  let currentUrl = 'https://apps.northwind.example/myapps';

  function render(): void {
    body.innerHTML = '';
    body.id = 'browser-body';

    const container = document.createElement('div');
    container.style.cssText = `
      display: flex; flex-direction: column; height: 100%;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI Variable', 'Segoe UI', sans-serif;
      font-size: 12px; color: #c8cdd3; overflow: hidden;
      background: #1a1d22;
    `;

    // ── Browser chrome ───────────────────────────────────────────────────────
    const chrome = document.createElement('div');
    chrome.style.cssText = `
      display: flex; align-items: center; gap: 6px;
      padding: 6px 8px; background: #232830;
      border-bottom: 1px solid #2d343d; flex-shrink: 0;
    `;

    // Nav buttons
    for (const [icon, label] of [
      ['←', 'Back'],
      ['→', 'Forward'],
      ['↺', 'Reload'],
    ] as [string, string][]) {
      const btn = document.createElement('button');
      btn.style.cssText = `
        width: 28px; height: 28px; border-radius: 4px; border: none;
        background: transparent; color: #8b95a1; font-size: 14px;
        cursor: pointer; display: flex; align-items: center; justify-content: center;
      `;
      btn.textContent = icon;
      btn.title = label;
      btn.addEventListener('click', () => {
        /* simulated — no-op */
      });
      btn.addEventListener('mouseenter', () => {
        btn.style.background = '#2d343d';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = 'transparent';
      });
      chrome.appendChild(btn);
    }

    // URL bar
    const urlBar = document.createElement('input');
    urlBar.type = 'text';
    urlBar.value = currentUrl;
    urlBar.style.cssText = `
      flex: 1; background: #0e1116; color: #e6e6e6; border: 1px solid #2d343d;
      border-radius: 4px; padding: 4px 10px; font-size: 12px; font-family: monospace;
      outline: none;
    `;
    urlBar.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter') {
        currentUrl = urlBar.value;
        render();
      }
    });

    // Bookmark buttons
    const bmContainer = document.createElement('div');
    bmContainer.style.cssText = 'display:flex;gap:4px;';
    for (const [label, url] of [
      ['My Apps', 'https://apps.northwind.example/myapps'],
      ['IAM Admin', 'https://admin.northwind.example/iam'],
      ['Ollama', 'http://localhost:11434'],
    ] as [string, string][]) {
      const bm = document.createElement('button');
      bm.style.cssText = `
        padding: 4px 8px; border-radius: 4px; border: 1px solid #2d343d;
        background: transparent; color: #8b95a1; font-size: 11px; cursor: pointer;
      `;
      bm.textContent = label;
      bm.addEventListener('click', () => {
        currentUrl = url;
        urlBar.value = url;
        render();
      });
      bm.addEventListener('mouseenter', () => {
        bm.style.background = '#2d343d';
        bm.style.color = '#e6e6e6';
      });
      bm.addEventListener('mouseleave', () => {
        bm.style.background = 'transparent';
        bm.style.color = '#8b95a1';
      });
      bmContainer.appendChild(bm);
    }
    chrome.appendChild(bmContainer);
    chrome.appendChild(urlBar);

    container.appendChild(chrome);

    // ── Content area ─────────────────────────────────────────────────────────
    const content = document.createElement('div');
    content.style.cssText = 'flex:1;overflow-y:auto;background:#0e1116;';

    if (currentUrl.includes('apps.northwind.example/myapps')) {
      renderMyAppsPage(content);
    } else if (currentUrl.includes('admin.northwind.example/iam')) {
      renderAdminPage(content);
    } else if (currentUrl.includes('localhost:11434')) {
      renderOllamaPage(content);
    } else {
      renderGenericPage(content, currentUrl);
    }

    container.appendChild(content);
    body.appendChild(container);
  }

  render();

  // Re-render when the lab changes (e.g., new apps are configured)
  labStore.subscribe(render);
}

function renderMyAppsPage(content: HTMLElement): void {
  content.innerHTML = `
    <div style="padding:16px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
        <div style="width:36px;height:36px;background:#4ec9b0;border-radius:8px;display:flex;align-items:center;justify-content:center;">
          <span style="font-size:20px;color:#0e1116;font-weight:bold;">A</span>
        </div>
        <div>
          <div style="font-size:14px;font-weight:600;color:#e6e6e6;">Northwind App Portal</div>
          <div style="font-size:11px;color:#8b95a1;">My Applications</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin-bottom:16px;">
        ${[
          'HR Connect',
          'Finance Dashboard',
          'Jira SSO',
          'Confluence',
          'AWS Console',
          'Azure Portal',
        ]
          .map(
            (app, i) => `
          <div style="background:#1b1f24;border:1px solid #2d343d;border-radius:8px;padding:14px;cursor:pointer;">
            <div style="width:36px;height:36px;background:#2d343d;border-radius:6px;margin-bottom:8px;display:flex;align-items:center;justify-content:center;font-size:20px;">
              ${['🏢', '💰', '📋', '📚', '☁️', '🔷'][i]}
            </div>
            <div style="font-size:12px;color:#e6e6e6;font-weight:500;">${app}</div>
            <div style="font-size:10px;color:#4ec9b0;margin-top:2px;">SSO: SAML 2.0</div>
          </div>
        `,
          )
          .join('')}
      </div>

      <div style="padding:12px;background:#232830;border-radius:6px;border:1px solid #2d343d;">
        <div style="font-size:11px;color:#8b95a1;margin-bottom:6px;">Sign-in events</div>
        ${[
          'jsmith signed in via SSO (MFA: TOTP)',
          'b.chen signed in via SSO',
          'a.kumar failed sign-in (wrong password)',
        ]
          .map(
            (ev) => `
          <div style="font-size:11px;color:#c8cdd3;padding:3px 0;border-bottom:1px solid #2d343d;font-family:monospace;">
            ${new Date().toLocaleTimeString()} — ${ev}
          </div>
        `,
          )
          .join('')}
      </div>
    </div>
  `;
}

function renderAdminPage(content: HTMLElement): void {
  content.innerHTML = `
    <div style="padding:16px;">
      <div style="margin-bottom:16px;">
        <div style="font-size:14px;font-weight:600;color:#e6e6e6;margin-bottom:4px;">IAM Administration</div>
        <div style="font-size:11px;color:#8b95a1;">Configure identity providers, MFA policies, and application access.</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        ${[
          'Identity Providers',
          'MFA Policies',
          'Application Registry',
          'Conditional Access',
          'Audit Log',
          'Access Reviews',
        ]
          .map(
            (section) => `
          <div style="background:#1b1f24;border:1px solid #2d343d;border-radius:6px;padding:12px;cursor:pointer;">
            <div style="font-size:12px;color:#e6e6e6;font-weight:500;">${section}</div>
            <div style="font-size:10px;color:#8b95a1;margin-top:4px;">Configure settings →</div>
          </div>
        `,
          )
          .join('')}
      </div>
    </div>
  `;
}

function renderOllamaPage(content: HTMLElement): void {
  content.innerHTML = `
    <div style="padding:16px;text-align:center;">
      <div style="font-size:48px;margin-bottom:12px;">🦙</div>
      <div style="font-size:16px;font-weight:600;color:#e6e6e6;margin-bottom:8px;">Ollama is running</div>
      <div style="font-size:12px;color:#8b95a1;line-height:1.6;max-width:400px;margin:0 auto 16px;">
        The AI Supervisor is connected to Ollama (llama3.2 model).<br/>
        Open the <strong style="color:#4ec9b0;">AI Supervisor</strong> console to interact with the tutor.
      </div>
      <div style="background:#1b1f24;border:1px solid #2d343d;border-radius:6px;padding:12px;display:inline-block;text-align:left;font-family:monospace;font-size:11px;">
        <div style="color:#4ec9b0;">$ ollama list</div>
        <div style="color:#c8cdd3;">NAME          SIZE   MODIFIED</div>
        <div style="color:#c8cdd3;">llama3.2      2.0GB  2 hours ago</div>
        <div style="color:#4ec9b0;margin-top:8px;">$</div>
      </div>
    </div>
  `;
}

function renderGenericPage(content: HTMLElement, url: string): void {
  content.innerHTML = `
    <div style="padding:24px;text-align:center;">
      <div style="font-size:32px;margin-bottom:8px;">🌐</div>
      <div style="font-size:14px;font-weight:600;color:#e6e6e6;margin-bottom:4px;">Browser Simulation</div>
      <div style="font-size:12px;color:#8b95a1;font-family:monospace;margin-bottom:16px;">${url}</div>
      <div style="font-size:12px;color:#8b95a1;line-height:1.6;max-width:400px;margin:0 auto;">
        This is a simulated browser for training purposes.<br/>
        In a real lab, this would load the actual application portal.
      </div>
    </div>
  `;
}
