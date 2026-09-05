// electron/main.cjs
// Electron main process for the IAM & SSO 3D Lab desktop app.
//
// - Loads the production build from dist/index.html
// - Enables WebGL (the Three.js renderer needs it)
// - Disables nodeIntegration in the renderer (security)
// - Single-instance lock so the user doesn't accidentally launch
//   two copies pointing at the same persisted state
// - Auto-update via electron-updater + GitHub Releases

const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');

// Auto-update via electron-updater
let autoUpdater = null;
try {
  ({ autoUpdater } = require('electron-updater'));
} catch {
  // electron-updater is only available in packaged builds (not in dev), so
  // this try/catch safely makes dev-mode launches continue without it.
  autoUpdater = null;
}

// Keep a reference so the renderer can query the current state at any time.
// Values: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded'
let updateState = 'idle';
let updateInfo = null; // { version, releaseNotes? }

function getEnvPayload() {
  return { IS_ELECTRON: true };
}

const DIST = path.join(__dirname, '..', 'dist');
const INDEX_HTML = path.join(DIST, 'index.html');

let mainWindow = null;

// --- Auto-update -----------------------------------------------------------
function setupAutoUpdater() {
  if (!autoUpdater) return;

  autoUpdater.logger = {
    info: (...args) => console.log('[auto-updater]', ...args),
    warn: (...args) => console.warn('[auto-updater]', ...args),
    error: (...args) => console.error('[auto-updater]', ...args),
  };

  // Auto-download when an update is found (don't wait for user to click)
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    updateState = 'checking';
    broadcastUpdateStatus();
  });

  autoUpdater.on('update-available', (info) => {
    updateState = 'available';
    updateInfo = { version: info.version, releaseNotes: info.releaseNotes ?? null };
    broadcastUpdateStatus();
  });

  autoUpdater.on('update-not-available', () => {
    updateState = 'idle';
    updateInfo = null;
    broadcastUpdateStatus();
  });

  autoUpdater.on('download-progress', (progress) => {
    updateState = 'downloading';
    updateInfo = { ...updateInfo, progress: progress.percent };
    broadcastUpdateStatus();
  });

  autoUpdater.on('update-downloaded', (info) => {
    updateState = 'downloaded';
    updateInfo = { version: info.version, releaseNotes: info.releaseNotes ?? null };
    broadcastUpdateStatus();
  });

  autoUpdater.on('error', (err) => {
    console.error('[auto-updater] error:', err.message);
    updateState = 'idle';
    updateInfo = null;
    broadcastUpdateStatus();
  });

  // Check for updates on startup (with a small delay so the window has time
  // to load first — the splash feels cleaner this way).
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.warn('[auto-updater] initial check failed:', err.message);
    });
  }, 3000);
}

function broadcastUpdateStatus() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('update:status', { state: updateState, info: updateInfo });
}

// --- IPC handlers ----------------------------------------------------------
ipcMain.handle('env:get', () => getEnvPayload());

ipcMain.on('env:get:sync', (event) => {
  event.returnValue = getEnvPayload();
});

ipcMain.handle('update:check', async () => {
  if (!autoUpdater) return { state: 'idle', info: null };
  updateState = 'checking';
  broadcastUpdateStatus();
  try {
    await autoUpdater.checkForUpdates();
    return { state: updateState, info: updateInfo };
  } catch (err) {
    updateState = 'idle';
    return { state: 'idle', info: null, error: err.message };
  }
});

ipcMain.handle('update:download', async () => {
  if (!autoUpdater) return { state: updateState, info: updateInfo };
  try {
    await autoUpdater.downloadUpdate();
    return { state: updateState, info: updateInfo };
  } catch (err) {
    return { state: updateState, info: updateInfo, error: err.message };
  }
});

ipcMain.handle('update:install', () => {
  if (!autoUpdater) return;
  autoUpdater.quitAndInstall(false, true);
});

ipcMain.handle('update:getStatus', () => {
  return { state: updateState, info: updateInfo };
});

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
  setupAutoUpdater();

  app.on('activate', () => {
    // macOS: re-create a window when the dock icon is clicked and no windows are open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // Quit on all platforms (this is a training app, not a menu-bar app).
  app.quit();
});
