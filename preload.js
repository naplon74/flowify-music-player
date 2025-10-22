const { ipcRenderer } = require('electron');

// Expose IPC functions to window object
window.electronAPI = {
  downloadFile: (url, filename) => ipcRenderer.invoke('download-file', { url, filename }),
  updateDiscordRPC: (data) => ipcRenderer.send('update-discord-rpc', data),
  getDownloadsDir: () => ipcRenderer.invoke('get-downloads-dir'),
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
  onDebugLog: (callback) => ipcRenderer.on('debug-log', callback),
  checkForUpdates: () => ipcRenderer.send('check-for-updates'),
  downloadUpdate: () => ipcRenderer.send('download-update'),
  installUpdate: () => ipcRenderer.send('install-update'),
  onUpdateStatus: (callback) => ipcRenderer.on('update-status', callback)
};
