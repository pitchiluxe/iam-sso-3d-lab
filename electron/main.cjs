// electron/main.cjs
// Electron main process for the IAM & SSO 3D Lab desktop app.
//
// - Loads the production build from dist/index.html
// - Enables WebGL (the Three.js renderer needs it)
// - Disables nodeIntegration in the renderer (security)
// - Single-instance lock so the user doesn't accidentally launch
//   two copies pointing at the same persisted state

const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist');
const INDEX_HTML = path.join(DIST, 'index.html');

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
function getEnvPayload() {
  return { IS_ELECTRON: true };
}

// Async variant (kept for any future caller that doesn't need it at preload
// startup — the renderer itself uses the synchronous one below).
ipcMain.handle('env:get', () => getEnvPayload());

// Synchronous variant — the preload script needs env values before it calls
// contextBridge.exposeInMainWorld('env', ...), which happens synchronously
// during preload evaluation. An async invoke() there would resolve too late:
// exposeInMainWorld clones whatever value it's given at call time, so a
// promise resolving afterward can't retroactively update what was exposed.
ipcMain.on('env:get:sync', (event) => {
  event.returnValue = getEnvPayload();
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
