const { app, BrowserWindow, globalShortcut, ipcMain, nativeImage, screen } = require('electron');
const path = require('path');
const { createTray, updateTrayPressure, destroyTray } = require('./tray');
const { createQuickCaptureWindow, toggleQuickCapture } = require('./quickCapture');
const { createRealityCheckWindow, updateRealityCheck, toggleRealityCheck, destroyRealityCheck } = require('./realityCheck');
const { setupAutoStart } = require('./autoStart');
const { setupDragDrop } = require('./dragDrop');
const { showNativeNotification } = require('./notifications');

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const DEV_SERVER_URL = 'http://localhost:5173';

let mainWindow = null;
let quickCaptureWindow = null;
let realityCheckWindow = null;

function getPreloadPath() {
  return path.join(__dirname, 'preload.js');
}

function createMainWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: Math.min(1400, width),
    height: Math.min(900, height),
    minWidth: 900,
    minHeight: 600,
    title: 'CalmPlan',
    icon: path.join(__dirname, 'icons', 'icon.png'),
    webPreferences: {
      preload: getPreloadPath(),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    // Sterile mode - hide browser chrome
    autoHideMenuBar: true,
    frame: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#f8f9fa',
      symbolColor: '#6b7280',
      height: 40,
    },
    show: false, // Show when ready
    backgroundColor: '#f8f9fa',
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL(DEV_SERVER_URL);
    // Open DevTools in development
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  // Show when ready to prevent flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // Navigate to Home (Mind Map) on startup
    mainWindow.webContents.executeJavaScript(`
      if (window.location.pathname === '/') {
        window.history.pushState({}, '', '/Home');
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    `).catch(() => {});
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Minimize to tray instead of closing
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  return mainWindow;
}

function registerGlobalShortcuts() {
  // Global Command Bar: Alt+Space (Windows/Linux) or Cmd+K (Mac)
  const shortcut = process.platform === 'darwin' ? 'CommandOrControl+K' : 'Alt+Space';

  globalShortcut.register(shortcut, () => {
    toggleQuickCapture(quickCaptureWindow, mainWindow);
  });

  // Also register Ctrl+K as alternative on all platforms
  if (process.platform !== 'darwin') {
    globalShortcut.register('CommandOrControl+K', () => {
      toggleQuickCapture(quickCaptureWindow, mainWindow);
    });
  }
}

// ─── IPC Handlers ───────────────────────────────────────────────

function setupIPC() {
  // Quick Capture
  ipcMain.handle('quick-capture:submit', async (event, taskText) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('quick-capture:new-task', taskText);
    }
    return { success: true };
  });

  ipcMain.handle('quick-capture:close', () => {
    if (quickCaptureWindow && !quickCaptureWindow.isDestroyed()) {
      quickCaptureWindow.hide();
    }
  });

  // Reality Check
  ipcMain.handle('reality-check:update', (event, data) => {
    updateRealityCheck(realityCheckWindow, data);
  });

  ipcMain.handle('reality-check:toggle', () => {
    toggleRealityCheck(realityCheckWindow);
  });

  ipcMain.handle('reality-check:respond', (event, response) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('reality-check:response', response);
    }
  });

  // System Tray
  ipcMain.handle('tray:update-pressure', (event, level) => {
    updateTrayPressure(level);
  });

  ipcMain.handle('tray:update-tasks', (event, tasks) => {
    // Store tasks for tray menu
    app.nextTasks = tasks;
  });

  // Native Notifications
  ipcMain.handle('notification:show', (event, { title, body, urgency }) => {
    showNativeNotification(title, body, urgency, mainWindow);
  });

  // Window controls
  ipcMain.handle('window:focus-mode', (event, enabled) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setAlwaysOnTop(enabled);
      mainWindow.webContents.send('focus-mode:changed', enabled);
    }
  });

  ipcMain.handle('window:show-main', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // File drop
  ipcMain.handle('file:dropped', (event, filePaths) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('file:received', filePaths);
    }
  });

  // App info
  ipcMain.handle('app:is-desktop', () => true);
  ipcMain.handle('app:get-version', () => app.getVersion());
  ipcMain.handle('app:get-platform', () => process.platform);
}

// ─── App Lifecycle ──────────────────────────────────────────────

app.whenReady().then(() => {
  // Setup IPC handlers first
  setupIPC();

  // Create main window
  mainWindow = createMainWindow();

  // Create secondary windows
  quickCaptureWindow = createQuickCaptureWindow(getPreloadPath());
  realityCheckWindow = createRealityCheckWindow(getPreloadPath(), isDev);

  // Setup system tray
  createTray(mainWindow, app);

  // Register global shortcuts
  registerGlobalShortcuts();

  // Setup auto-start
  setupAutoStart(app);

  // Setup drag & drop
  setupDragDrop(mainWindow);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    } else if (mainWindow) {
      mainWindow.show();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  destroyTray();
  destroyRealityCheck(realityCheckWindow);
});

app.on('before-quit', () => {
  app.isQuitting = true;
});
