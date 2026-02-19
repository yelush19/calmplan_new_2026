const { BrowserWindow, screen } = require('electron');
const path = require('path');

let quickCaptureWindow = null;

function createQuickCaptureWindow(preloadPath) {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  quickCaptureWindow = new BrowserWindow({
    width: 620,
    height: 90,
    x: Math.round((width - 620) / 2),
    y: Math.round(height * 0.3),
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    focusable: true,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  quickCaptureWindow.loadFile(path.join(__dirname, 'windows', 'quick-capture.html'));

  quickCaptureWindow.on('blur', () => {
    if (quickCaptureWindow && !quickCaptureWindow.isDestroyed()) {
      quickCaptureWindow.hide();
    }
  });

  quickCaptureWindow.on('closed', () => {
    quickCaptureWindow = null;
  });

  return quickCaptureWindow;
}

function toggleQuickCapture(win, mainWindow) {
  const window = win || quickCaptureWindow;
  if (!window || window.isDestroyed()) return;

  if (window.isVisible()) {
    window.hide();
  } else {
    // Center on current screen
    const cursorPoint = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(cursorPoint);
    const { x, y, width, height } = display.workArea;

    window.setPosition(
      Math.round(x + (width - 620) / 2),
      Math.round(y + height * 0.3)
    );

    window.show();
    window.focus();
    window.webContents.send('quick-capture:focus');
  }
}

module.exports = { createQuickCaptureWindow, toggleQuickCapture };
