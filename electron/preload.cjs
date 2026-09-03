// electron/preload.cjs
// Exposes a safe IPC bridge from the renderer to the main process.
//
// Exposes:
//   window.electron.invoke(cmd, ...args)  — call a main-process handler and wait for result
//   window.env                            — static env values fetched at startup
//
// Never expose direct Node/Electron APIs — renderer stays sandboxed.

const { contextBridge, ipcRenderer } = require('electron');

// Fetch static env once at startup
let cachedEnv = {};
ipcRenderer.invoke('env:get').then((env) => {
  cachedEnv = env ?? {};
});

// Expose the bridge
contextBridge.exposeInMainWorld('electron', {
  /**
   * Call a main-process handler and resolve with its return value.
   * @param {string} cmd  — the IPC channel name (e.g. 'shell:openPath')
   * @param {...any} args — passed to the handler
   * @returns {Promise<unknown>}
   */
  invoke: (cmd, ...args) => ipcRenderer.invoke(cmd, ...args),
});

// Expose env synchronously (values are set after first invoke resolves,
// but we also attach to window so renderers can read it once available).
contextBridge.exposeInMainWorld('env', cachedEnv);
