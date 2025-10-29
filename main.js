const { app, BrowserWindow, session, ipcMain, Tray, Menu } = require('electron')
const path = require('path')
const fs = require('fs')
const https = require('https')
const DiscordRPC = require('discord-rpc')
const { autoUpdater } = require('electron-updater')

// Auto-updater configuration
autoUpdater.autoDownload = false; // Don't auto-download, ask user first
autoUpdater.autoInstallOnAppQuit = true;

// Enable logging for debugging (optional, only if electron-log is available)
try {
  autoUpdater.logger = require('electron-log');
  autoUpdater.logger.transports.file.level = 'info';
} catch (e) {
  // electron-log not available, use console
  console.log('electron-log not available, using console logging');
}

console.log('Auto-updater initialized');
console.log('App version:', app.getVersion());

// Track whether we're doing a silent auto-check (on launch)
let silentUpdateCheck = false;
// Auto-updater IPC handlers
ipcMain.on('check-for-updates', () => {
  debugLog('Manual update check triggered', 'info');
  // Ensure this is treated as a non-silent check
  autoUpdater.checkForUpdates().catch(error => {
    console.error('Update check error:', error);
    debugLog('Update check failed: ' + error.message, 'error');
    if (mainWindow) {
      mainWindow.webContents.send('update-status', { status: 'error', message: error.message });
    }
  });
});

ipcMain.on('download-update', () => {
  autoUpdater.downloadUpdate();
});

ipcMain.on('install-update', () => {
  autoUpdater.quitAndInstall();
});

// Auto-updater events
autoUpdater.on('checking-for-update', () => {
  debugLog('Checking for updates...', 'info');
  // During silent checks, don't notify the renderer
  if (!silentUpdateCheck && mainWindow) {
    mainWindow.webContents.send('update-status', { status: 'checking' });
  }
});

autoUpdater.on('update-available', (info) => {
  debugLog('Update available: v' + info.version, 'info');
  if (mainWindow) {
    mainWindow.webContents.send('update-status', {
      status: 'available',
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes
    });
  }
});

autoUpdater.on('update-not-available', (info) => {
  debugLog('App is up to date (v' + info.version + ')', 'info');
  // Don't bother the user during silent checks
  if (!silentUpdateCheck && mainWindow) {
    mainWindow.webContents.send('update-status', { status: 'not-available' });
  }
});

autoUpdater.on('error', (err) => {
  debugLog('Update error: ' + err.message, 'error');
  // Suppress error popups during silent checks
  if (!silentUpdateCheck && mainWindow) {
    mainWindow.webContents.send('update-status', { status: 'error', message: err.message });
  }
});

autoUpdater.on('download-progress', (progressObj) => {
  debugLog('Download progress: ' + Math.round(progressObj.percent) + '%', 'info');
  if (mainWindow) {
    mainWindow.webContents.send('update-status', {
      status: 'downloading',
      percent: progressObj.percent,
      transferred: progressObj.transferred,
      total: progressObj.total
    });
  }
});

autoUpdater.on('update-downloaded', (info) => {
  debugLog('Update downloaded. Will install on quit.', 'info');
  if (mainWindow) {
    mainWindow.webContents.send('update-status', { status: 'downloaded', version: info.version });
  }
});

// Discord RPC setup
const clientId = '1430189312678559764'; // You can replace with your own Discord App ID
let rpc = null;
let rpcConnected = false;
let isConnecting = false; // Prevent duplicate connection attempts
let discordEnabled = false; // Respect renderer preference; don't connect until enabled
let pendingActivity = null; // Activity to set once RPC becomes ready

// Function to connect to Discord (auto-detects Stable, PTB, Canary, Development)
async function connectDiscord() {
  // Prevent duplicate connection attempts
  if (isConnecting || rpcConnected) {
    debugLog('Already connecting or connected to Discord RPC, skipping duplicate attempt', 'info');
    return;
  }
  
  isConnecting = true;
  
  try {
    debugLog('Attempting to connect to Discord RPC...', 'info');
    debugLog('Discord enabled state: ' + discordEnabled, 'info');
    
    // Clean up any existing connection first
    if (rpc) {
      try {
        if (rpc.transport && rpc.transport.socket) {
          rpc.destroy();
        }
      } catch (e) {
        debugLog('RPC cleanup warning: ' + e.message, 'warning');
      }
      rpc = null;
      rpcConnected = false;
    }
    
    // Register for multiple Discord client types (Stable, PTB, Canary, Development)
    DiscordRPC.register(clientId);
    debugLog('Discord RPC client registered', 'info');
    
    rpc = new DiscordRPC.Client({ 
      transport: 'ipc'
    });

    rpc.on('ready', () => {
      rpcConnected = true;
      isConnecting = false; // Connection successful
      debugLog('Discord Rich Presence initialized successfully!', 'info');
      debugLog('-----------------------------------------------------------', 'info');
      debugLog('Connected to Discord client', 'info');
      debugLog('If RPC doesn\'t show up, check these Discord settings:', 'info');
      debugLog('1. Settings > Activity Privacy > "Display current activity" = ON', 'info');
      debugLog('2. Settings > Activity Privacy > "Share detected activities" = ON', 'info');
      debugLog('3. Make sure you\'re looking at your own profile/status', 'info');
      debugLog('4. Supported: Discord Stable, PTB, Canary, and Development', 'info');
      debugLog('-----------------------------------------------------------', 'info');

      // If we were asked to set an activity before ready, do it now (only if enabled)
      if (discordEnabled && pendingActivity) {
        const activity = buildActivityFromData(pendingActivity);
        debugLog('Setting pending Discord RPC activity after connect', 'info');
        rpc.setActivity(activity).catch(err => {
          debugLog('Failed to set pending Discord RPC: ' + err.message, 'error');
          rpcConnected = false;
        });
        pendingActivity = null;
      }
    });

    rpc.on('error', (err) => {
      debugLog('Discord RPC error: ' + err.message, 'error');
      rpcConnected = false;
      isConnecting = false; // Reset on error
    });

    debugLog('Attempting Discord login (timeout: 20s)...', 'info');
    
    // Retry login with longer timeout
    const loginPromise = rpc.login({ clientId });
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Connection timeout - retrying...')), 20000)
    );
    
    await Promise.race([loginPromise, timeoutPromise]).catch(async err => {
      if (err.message.includes('timeout') || err.message.includes('RPC_CONNECTION_TIMEOUT')) {
        debugLog('First attempt timed out, retrying in 2 seconds...', 'warning');
        
        // Clean up and retry once
        if (rpc) {
          try {
            if (rpc.transport && rpc.transport.socket) {
              rpc.destroy();
            }
          } catch (e) {
            debugLog('RPC cleanup warning during retry: ' + e.message, 'warning');
          }
        }
        
        rpc = new DiscordRPC.Client({ transport: 'ipc' });
        
        // Re-attach event handlers
        rpc.on('ready', () => {
          rpcConnected = true;
          isConnecting = false; // Connection successful on retry
          debugLog('Discord Rich Presence connected on retry!', 'info');
          if (discordEnabled && pendingActivity) {
            const activity = buildActivityFromData(pendingActivity);
            rpc.setActivity(activity).catch(() => {});
            pendingActivity = null;
          }
        });
        
        rpc.on('error', (e) => {
          debugLog('Discord RPC error: ' + e.message, 'error');
          rpcConnected = false;
          isConnecting = false; // Reset on error
        });
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        await rpc.login({ clientId }).catch(retryErr => {
          debugLog('Discord connection failed after retry. Discord may not be running or RPC may be blocked.', 'warning');
          debugLog('Error: ' + retryErr.message, 'warning');
          debugLog('Try: 1) Restart Discord, 2) Disable antivirus/firewall, 3) Run Discord as admin', 'info');
          rpc = null;
          rpcConnected = false;
          isConnecting = false; // Reset on failure
        });
      } else {
        debugLog('Discord not detected. Make sure Discord (Stable/PTB/Canary) is running.', 'warning');
        debugLog('Error: ' + err.message, 'warning');
        rpc = null;
        rpcConnected = false;
        isConnecting = false; // Reset on failure
      }
    });

  } catch (err) {
    debugLog('Discord connection error: ' + err.message, 'warning');
    rpc = null;
    rpcConnected = false;
    isConnecting = false; // Reset on exception
  }
}

// Helper to normalize activity payloads
function buildActivityFromData(data) {
  return {
    details: (data?.details && data.details.trim() !== '') ? data.details : 'Browsing music',
    state: (data?.state && data.state.trim() !== '') ? data.state : 'In main menu',
    largeImageKey: 'music_icon',
    largeImageText: 'Flowify Player - Beta',
    smallImageKey: 'github',
    smallImageText: 'github.com/naplon74/flowify-music-player',
    buttons: [
      { label: 'Download App', url: 'https://github.com/naplon74/flowify-music-player' }
    ],
    instance: false,
    ...(data?.startTimestamp ? { startTimestamp: data.startTimestamp } : { startTimestamp: Date.now() })
  };
}

// Disable security features for audio streaming
app.commandLine.appendSwitch('disable-web-security');
app.commandLine.appendSwitch('disable-features', 'VizDisplayCompositor');
app.commandLine.appendSwitch('ignore-certificate-errors');
app.commandLine.appendSwitch('allow-running-insecure-content');

// Create downloads directory
const downloadsDir = path.join(app.getPath('userData'), 'downloads');
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

let mainWindow;
let tray = null;
let miniWindow = null;
let cachedPlayerState = null; // Store last known player state for mini window

// Helper function to send logs to renderer
function debugLog(message, type = 'info') {
  console.log(message);
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('debug-log', { message, type });
  }
}

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 700,
    autoHideMenuBar: true,
    frame: false,
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      devTools: true, // Enable DevTools for debugging
      webSecurity: false,
      allowRunningInsecureContent: true,
      experimentalFeatures: true,
      preload: path.join(__dirname, 'js', 'preload.js')
    }
  })

  // Disable CORS for all requests
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    // Add specific headers for YouTube/Google domains
    if (details.url.includes('googlevideo.com') || details.url.includes('youtube.com')) {
      details.requestHeaders['User-Agent'] = 'com.google.android.apps.youtube.vr.oculus/1.61.48 (Linux; U; Android 11) gzip';
      
      // Remove problematic headers
      delete details.requestHeaders['Range'];
      
      console.log('[YouTube Request] URL:', details.url.substring(0, 150));
    } else {
      details.requestHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
    }
    
    callback({ cancel: false, requestHeaders: details.requestHeaders });
  });

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Access-Control-Allow-Origin': ['*'],
        'Access-Control-Allow-Methods': ['GET, POST, PUT, DELETE, OPTIONS'],
        'Access-Control-Allow-Headers': ['*'],
        'Access-Control-Allow-Credentials': ['true'],
      },
    });
  });

  mainWindow.loadFile('index.html')
  
  // Remove menu bar completely
  mainWindow.setMenuBarVisibility(false)
  
  // TEMPORARILY ALLOW DEVTOOLS FOR DEBUGGING
  // mainWindow.webContents.on('before-input-event', (event, input) => {
  //   // Block all DevTools shortcuts
  //   if (input.key === 'F12' || 
  //       (input.control && input.shift && input.key === 'I') ||
  //       (input.control && input.shift && input.key === 'J') ||
  //       (input.control && input.shift && input.key === 'C')) {
  //     event.preventDefault()
  //   }
  // })

  // Prevent window from closing, minimize to tray instead
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

// Create system tray icon
function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  tray = new Tray(iconPath);
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Flowify',
      click: () => {
        mainWindow.show();
      }
    },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);
  
  tray.setToolTip('Flowify Music Player');
  tray.setContextMenu(contextMenu);
  
  // Show window on tray icon click
  tray.on('click', () => {
    mainWindow.show();
  });
}

// =====================
// Single-instance lock
// =====================
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  // Another instance is already running – exit this one
  app.quit();
} else {
  app.on('second-instance', (_event, _argv, _cwd) => {
    // Someone tried to run a second instance; focus the existing window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    } else if (app.isReady()) {
      // If for some reason the window doesn't exist yet
      createWindow();
    }
  });
}

// Window control handlers
ipcMain.on('minimize-window', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('maximize-window', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('close-window', () => {
  if (mainWindow) {
    mainWindow.hide(); // Minimize to tray instead of closing
  }
});

// Handle app restart
ipcMain.on('restart-app', () => {
  app.relaunch();
  app.exit(0);
});

// Handle file download
ipcMain.handle('download-file', async (event, { url, filename }) => {
  return new Promise((resolve, reject) => {
    const filePath = path.join(downloadsDir, filename);
    const file = fs.createWriteStream(filePath);
    
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(filePath);
      });
    }).on('error', (err) => {
      fs.unlink(filePath, () => {});
      reject(err);
    });
  });
});

// Mini player window create/show
function createMiniWindow() {
  if (miniWindow && !miniWindow.isDestroyed()) return miniWindow;
  miniWindow = new BrowserWindow({
    width: 340,
    height: 480,
    resizable: false,
    frame: false,
    transparent: false,
    alwaysOnTop: false,
    skipTaskbar: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'js', 'preload.js')
    }
  });
  miniWindow.loadFile('mini.html');
  miniWindow.on('closed', () => { miniWindow = null; });
  return miniWindow;
}

ipcMain.on('open-mini-player', () => {
  const win = createMiniWindow();
  win.show();
  win.focus();
  // If we have cached state, send it immediately
  if (cachedPlayerState) {
    win.webContents.send('player-state', cachedPlayerState);
  }
});

ipcMain.on('set-mini-pin', (_e, pinned) => {
  if (miniWindow && !miniWindow.isDestroyed()) {
    miniWindow.setAlwaysOnTop(!!pinned, 'screen-saver');
  }
});

// Relay controls from mini to main renderer
ipcMain.on('mini-control', (_e, payload) => {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('player-control', payload || {});
  }
});

// Receive state from main renderer and forward to mini
ipcMain.on('player-state', (_e, state) => {
  cachedPlayerState = state;
  if (miniWindow && !miniWindow.isDestroyed()) {
    miniWindow.webContents.send('player-state', state);
  }
});

// Mini requests initial state
ipcMain.on('request-player-state', () => {
  if (cachedPlayerState && miniWindow && !miniWindow.isDestroyed()) {
    miniWindow.webContents.send('player-state', cachedPlayerState);
  }
});

// Handle Discord RPC updates
ipcMain.on('update-discord-rpc', (event, data) => {
  // Ignore all updates if RPC is disabled
  if (!discordEnabled) {
    debugLog('Discord RPC update ignored (disabled)', 'info');
    return;
  }

  // If not connected yet, connect and set when ready
  if (!rpc || !rpcConnected) {
    pendingActivity = data || { details: 'Browsing music', state: 'In main menu' };
    connectDiscord();
    return;
  }

  // Connected: set/update activity
  const activity = buildActivityFromData(data || {});
  debugLog('Updating Discord RPC: ' + activity.details + ' - ' + activity.state, 'info');
  rpc.setActivity(activity).catch(err => {
    debugLog('Failed to update Discord RPC: ' + err.message, 'error');
    rpcConnected = false;
  });
});

// Handle Discord RPC enable/disable state from renderer
ipcMain.on('set-discord-enabled', (event, enabled) => {
  discordEnabled = !!enabled;
  debugLog('Discord RPC enabled set to: ' + discordEnabled, 'info');

  if (!discordEnabled) {
    // Clear presence and disconnect
    if (rpc) {
      try {
        if (typeof rpc.clearActivity === 'function') {
          rpc.clearActivity();
        } else {
          // Fallback: set an empty/idle activity to effectively clear
          rpc.setActivity({ details: '', state: '' }).catch(() => {});
        }
      } catch (e) {
        debugLog('Error clearing Discord RPC activity: ' + e.message, 'warning');
      }
      try {
        if (typeof rpc.disconnect === 'function') {
          rpc.disconnect();
        } else if (typeof rpc.destroy === 'function') {
          rpc.destroy();
        }
        debugLog('Discord RPC disconnected due to disable', 'info');
      } catch (err) {
        debugLog('Error disconnecting Discord RPC: ' + err.message, 'error');
      }
    }
    rpc = null;
    rpcConnected = false;
    pendingActivity = null;
  } else {
    // Enabled: connect if not already
    debugLog('Discord RPC enabled - attempting connection...', 'info');
    if (!rpc || !rpcConnected) {
      connectDiscord();
    }
  }
});

// Get downloads directory path
ipcMain.handle('get-downloads-dir', () => {
  return downloadsDir;
});

// (Deduplicated) auto-updater handlers defined earlier

app.whenReady().then(() => {
  createWindow()
  createTray()
  
  // Check for updates after 3 seconds
  setTimeout(() => {
    // Perform a silent auto-check on startup; only notify if update exists
    silentUpdateCheck = true;
    autoUpdater.checkForUpdates()
      .finally(() => { silentUpdateCheck = false; });
  }, 3000);
  
  // Do not auto-connect Discord; wait for renderer to opt-in via set-discord-enabled

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  // Don't quit the app, keep it running in the tray
  // User must explicitly quit from tray menu
})

app.on('before-quit', () => {
  app.isQuitting = true;
  
  // Disconnect Discord RPC
  if (rpc && rpcConnected) {
    try {
      rpc.disconnect();
      debugLog('Discord RPC disconnected', 'info');
    } catch (err) {
      debugLog('Error disconnecting Discord RPC: ' + err.message, 'error');
    }
  }
})

