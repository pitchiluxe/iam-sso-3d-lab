// electron/main.cjs
// Electron main process for the IAM & SSO 3D Lab desktop app.
//
// - Loads the production build from dist/index.html
// - Enables WebGL (the Three.js renderer needs it)
// - Disables nodeIntegration in the renderer (security)
// - Single-instance lock so the user doesn't accidentally launch
//   two copies pointing at the same persisted state
// - IPC bridge for launching the bundled AIHub Browser executable
// - Exposes resources paths (AIHUB_EXE) to the renderer via a preload

const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist');
const INDEX_HTML = path.join(DIST, 'index.html');

// AIHub Browser is bundled as an extra resource at install time
// (see package.json → build.extraResources). In dev, fall back to a
// known local path so the launcher still works during development.
const DEV_AIHUB_EXE = 'C:\\Users\\erick\\Documents\\_My_Digital_Solutions\\AIHub-Browser\\dist\\AIHub-Browser-1.45.1-win-x64.exe';
const PROD_AIHUB_EXE = path.join(process.resourcesPath || '', 'aihub', 'AIHub-Browser-1.45.1-win-x64.exe');

let mainWindow = null;

// --- Single-instance lock --------------------------------------------------
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// --- IPC handlers ----------------------------------------------------------
// Renderers (in sandboxed webview) can request opening an external
// executable. shell.openPath is the safe way to do this.
ipcMain.handle('shell:openPath', async (_event, absPath) => {
  if (typeof absPath !== 'string' || !absPath) {
    return { ok: false, error: 'invalid path' };
  }
  const err = await shell.openPath(absPath);
  if (err) return { ok: false, error: err };
  return { ok: true };
});

ipcMain.handle('env:get', () => {
  // Determine which AIHub Browser path to expose. Prefer bundled resource,
  // fall back to dev path.
  const fs = require('fs');
  const exists = (p) => { try { return p && fs.existsSync(p); } catch { return false; } };
  const aihubExe = exists(PROD_AIHUB_EXE) ? PROD_AIHUB_EXE : DEV_AIHUB_EXE;
  return {
    AIHUB_EXE: aihubExe,
    IS_ELECTRON: true,
  };
});

// --- Window creation -------------------------------------------------------
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#0e1116',
    show: false,                      // show only when ready, avoids white flash
    title: 'IAM & SSO 3D Lab',
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    webPreferences: {
      contextIsolation: true,         // renderer is sandboxed from Node
      nodeIntegration: false,
      sandbox: true,
      webgl: true,                    // Three.js needs this
      experimentalFeatures: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  // Load the production build (file:// URL so relative assets resolve).
  mainWindow.loadFile(INDEX_HTML);

  // Open external links in the user's default browser, not in-app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// --- App lifecycle ----------------------------------------------------------
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    // macOS: re-create a window when the dock icon is clicked and no windows are open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // Quit on all platforms (this is a training app, not a menu-bar app).
  app.quit();
});
