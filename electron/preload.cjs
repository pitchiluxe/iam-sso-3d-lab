// electron/preload.cjs
// Exposes a safe IPC bridge from the renderer to the main process.
//
// Exposes:
//   window.electron.invoke(cmd, ...args)  — call a main-process handler and wait for result
//   window.electron.onUpdateStatus(fn)   — subscribe to auto-update status changes
//   window.env                            — static env values fetched at startup
//
// Never expose direct Node/Electron APIs — renderer stays sandboxed.

const { contextBridge, ipcRenderer } = require('electron');

// Expose the bridge
contextBridge.exposeInMainWorld('electron', {
  /**
   * Call a main-process handler and resolve with its return value.
   * @param {string} cmd  — the IPC channel name (e.g. 'shell:openPath')
   * @param {...any} args — passed to the handler
   * @returns {Promise<unknown>}
   */
  invoke: (cmd, ...args) => ipcRenderer.invoke(cmd, ...args),

  /**
   * Subscribe to auto-update status broadcasts from the main process.
   * Calls the provided function whenever the update state changes.
   * @param {(status: { state: string, info: object | null }) => void} fn
   * @returns {() => void} unsubscribe function
   */
  onUpdateStatus: (fn) => {
    const handler = (_event, status) => fn(status);
    ipcRenderer.on('update:status', handler);
    return () => ipcRenderer.removeListener('update:status', handler);
  },
});

// Fetch env synchronously — exposeInMainWorld clones its value at call time,
// so an async ipcRenderer.invoke() here would resolve too late to matter
// (the renderer would only ever see the pre-resolution placeholder). This
// blocking round-trip is a single fast main-process computation, done once
// at preload time.
let envPayload = {};
try {
  envPayload = ipcRenderer.sendSync('env:get:sync') ?? {};
} catch { /* main process not ready to answer yet — fall back to {} */ }
contextBridge.exposeInMainWorld('env', envPayload);
