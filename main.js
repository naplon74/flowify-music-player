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

// Function to connect to Discord (auto-detects Stable, PTB, Canary)
async function connectDiscord() {
  try {
    rpc = new DiscordRPC.Client({ transport: 'ipc' });

    rpc.on('ready', () => {
      rpcConnected = true;
      debugLog('Discord Rich Presence initialized', 'info');
      debugLog('-----------------------------------------------------------', 'info');
      debugLog('If RPC doesn\'t show up, check these Discord settings:', 'info');
      debugLog('1. Settings > Activity Privacy > "Display current activity" = ON', 'info');
      debugLog('2. Settings > Activity Privacy > "Share detected activities" = ON', 'info');
      debugLog('3. Make sure you\'re looking at your own profile/status', 'info');
      debugLog('-----------------------------------------------------------', 'info');

      // Set initial presence
      rpc.setActivity({
        details: 'Browsing music',
        state: 'In main menu',
        startTimestamp: Date.now(),
        largeImageKey: 'music_icon',
        largeImageText: 'Flowify Player - Beta',
        smallImageKey: 'github',
        smallImageText: 'github.com/naplon74/flowify-music-player',
        instance: false,
      }).then(() => {
        debugLog('✓ Discord Rich Presence is now active!', 'info');
        debugLog('✓ Check your Discord profile to see "Browsing music"', 'info');
      }).catch(err => {
        debugLog('Could not set Discord presence: ' + err.message, 'error');
      });
    });

    rpc.on('error', (err) => {
      debugLog('Discord RPC error: ' + err.message, 'error');
      rpcConnected = false;
    });

    await rpc.login({ clientId }).catch(err => {
      debugLog('Discord not detected. Rich Presence will be disabled.', 'warning');
      rpc = null;
      rpcConnected = false;
    });

  } catch (err) {
    debugLog('Discord connection error: ' + err.message, 'warning');
    rpc = null;
    rpcConnected = false;
  }
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
      devTools: false, // Disable DevTools
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
  
  // Remove menu bar completely and disable DevTools
  mainWindow.setMenuBarVisibility(false)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    // Block all DevTools shortcuts
    if (input.key === 'F12' || 
        (input.control && input.shift && input.key === 'I') ||
        (input.control && input.shift && input.key === 'J') ||
        (input.control && input.shift && input.key === 'C')) {
      event.preventDefault()
    }
  })

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

// Handle Discord RPC updates
ipcMain.on('update-discord-rpc', (event, data) => {
  // If data is empty/null, set default idle state instead of clearing
  if (!data || (data.details === '' && data.state === '')) {
    if (rpc && rpcConnected) {
      debugLog('Setting Discord RPC to idle state...', 'info');
      rpc.setActivity({
        details: 'Browsing music',
        state: 'Idle in main menu',
        largeImageKey: 'music_icon',
        largeImageText: 'Flowify Player - Beta',
        smallImageKey: 'github',
        smallImageText: 'github.com/naplon74/flowify-music-player',
        instance: false,
      }).then(() => {
        debugLog('Discord RPC set to idle state', 'info');
      }).catch(err => {
        debugLog('Failed to set Discord RPC idle state: ' + err.message, 'error');
        rpcConnected = false;
      });
    }
    return;
  }
  
  if (rpc && rpcConnected && data) {
    const activity = {
      details: (data.details && data.details.trim() !== '') ? data.details : 'Browsing music',
      state: (data.state && data.state.trim() !== '') ? data.state : 'In main menu',
      largeImageKey: 'music_icon',
      largeImageText: 'Flowify Player - Beta',
      smallImageKey: 'github',
      smallImageText: 'github.com/naplon74/flowify-music-player',
      instance: false,
    };
    
    if (data.startTimestamp) {
      activity.startTimestamp = data.startTimestamp;
    } else {
      activity.startTimestamp = Date.now();
    }
    
    debugLog('Updating Discord RPC: ' + activity.details + ' - ' + activity.state, 'info');
    rpc.setActivity(activity).catch(err => {
      debugLog('Failed to update Discord RPC: ' + err.message, 'error');
      rpcConnected = false;
    });
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
  
  // Try to connect to Discord after window is created
  setTimeout(connectDiscord, 1000) // Small delay to ensure Discord is ready

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