import { app, BrowserWindow, globalShortcut, ipcMain, nativeImage, screen } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { createTray, updateTrayPressure, destroyTray } from './tray.js';
import { createQuickCaptureWindow, toggleQuickCapture } from './quickCapture.js';
import { createRealityCheckWindow, updateRealityCheck, toggleRealityCheck, destroyRealityCheck } from './realityCheck.js';
import { setupAutoStart } from './autoStart.js';
import { setupDragDrop } from './dragDrop.js';
import { showNativeNotification } from './notifications.js';

// Use app.getAppPath() for reliable ASAR path resolution.
// import.meta.url + fileURLToPath can break inside ASAR on Windows.
const appRoot = app.getAppPath();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const DEV_SERVER_URL = 'http://localhost:5173';

let mainWindow = null;
let quickCaptureWindow = null;
let realityCheckWindow = null;

function getPreloadPath() {
  return path.join(appRoot, 'electron', 'preload.cjs');
}

function createMainWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: Math.min(1400, width),
    height: Math.min(900, height),
    minWidth: 900,
    minHeight: 600,
    title: 'CalmPlan',
    icon: path.join(appRoot, 'electron', 'icons', 'icon.png'),
    webPreferences: {
      preload: getPreloadPath(),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    autoHideMenuBar: true,
    frame: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#f8f9fa',
      symbolColor: '#6b7280',
      height: 40,
    },
    show: false,
    backgroundColor: '#f8f9fa',
  });

  if (isDev) {
    mainWindow.loadURL(DEV_SERVER_URL + '#/Home');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    // appRoot = project root (or app.asar root in packaged build)
    const indexPath = path.join(appRoot, 'dist', 'index.html');
    console.log('[CalmPlan] Loading:', indexPath);
    // loadFile with hash option sets the URL to file:///...index.html#/Home
    mainWindow.loadFile(indexPath, { hash: '/Home' });
  }

  // Log load failures for debugging
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('[CalmPlan] Failed to load:', errorCode, errorDescription, validatedURL);
  });

  mainWindow.webContents.on('console-message', (event, level, message) => {
    if (level >= 2) console.error('[Renderer]', message);
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  return mainWindow;
}

function registerGlobalShortcuts() {
  const shortcut = process.platform === 'darwin' ? 'CommandOrControl+K' : 'Alt+Space';

  globalShortcut.register(shortcut, () => {
    toggleQuickCapture(quickCaptureWindow, mainWindow);
  });

  if (process.platform !== 'darwin') {
    globalShortcut.register('CommandOrControl+K', () => {
      toggleQuickCapture(quickCaptureWindow, mainWindow);
    });
  }
}

// ─── IPC Handlers ───────────────────────────────────────────────

function setupIPC() {
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

  ipcMain.handle('tray:update-pressure', (event, level) => {
    updateTrayPressure(level);
  });

  ipcMain.handle('tray:update-tasks', (event, tasks) => {
    app.nextTasks = tasks;
  });

  ipcMain.handle('notification:show', (event, { title, body, urgency }) => {
    showNativeNotification(title, body, urgency, mainWindow);
  });

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

  ipcMain.handle('file:dropped', (event, filePaths) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('file:received', filePaths);
    }
  });

  ipcMain.handle('app:is-desktop', () => true);
  ipcMain.handle('app:get-version', () => app.getVersion());
  ipcMain.handle('app:get-platform', () => process.platform);
}

// ─── App Lifecycle ──────────────────────────────────────────────

app.whenReady().then(() => {
  setupIPC();

  mainWindow = createMainWindow();

  quickCaptureWindow = createQuickCaptureWindow(getPreloadPath());
  realityCheckWindow = createRealityCheckWindow(getPreloadPath(), isDev);

  createTray(mainWindow, app);
  registerGlobalShortcuts();
  setupAutoStart(app);
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
