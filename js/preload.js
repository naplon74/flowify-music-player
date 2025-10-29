const { ipcRenderer } = require('electron');

// Expose IPC functions to window object
window.electronAPI = {
  downloadFile: (url, filename) => ipcRenderer.invoke('download-file', { url, filename }),
  updateDiscordRPC: (data) => ipcRenderer.send('update-discord-rpc', data),
  setDiscordEnabled: (enabled) => ipcRenderer.send('set-discord-enabled', !!enabled),
  // Mini player IPC
  openMiniPlayer: () => ipcRenderer.send('open-mini-player'),
  setMiniPin: (pinned) => ipcRenderer.send('set-mini-pin', !!pinned),
  miniControl: (payload) => ipcRenderer.send('mini-control', payload),
  broadcastPlayerState: (state) => ipcRenderer.send('player-state', state),
  requestPlayerState: () => ipcRenderer.send('request-player-state'),
  onPlayerState: (callback) => ipcRenderer.on('player-state', (_e, data) => callback(data)),
  onPlayerControl: (callback) => ipcRenderer.on('player-control', (_e, data) => callback(data)),
  getDownloadsDir: () => ipcRenderer.invoke('get-downloads-dir'),
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
  onDebugLog: (callback) => ipcRenderer.on('debug-log', callback),
  checkForUpdates: () => ipcRenderer.send('check-for-updates'),
  downloadUpdate: () => ipcRenderer.send('download-update'),
  installUpdate: () => ipcRenderer.send('install-update'),
  onUpdateStatus: (callback) => ipcRenderer.on('update-status', callback),
  restartApp: () => ipcRenderer.send('restart-app')
};

