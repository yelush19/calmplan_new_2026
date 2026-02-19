const { BrowserWindow, screen } = require('electron');
const path = require('path');

let realityCheckWindow = null;

function createRealityCheckWindow(preloadPath, isDev) {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  realityCheckWindow = new BrowserWindow({
    width: 320,
    height: 120,
    x: width - 340,
    y: height - 140,
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

  realityCheckWindow.loadFile(path.join(__dirname, 'windows', 'reality-check.html'));

  realityCheckWindow.on('closed', () => {
    realityCheckWindow = null;
  });

  return realityCheckWindow;
}

function updateRealityCheck(win, data) {
  const window = win || realityCheckWindow;
  if (!window || window.isDestroyed()) return;

  // Use executeJavaScript to call the global update function in the window
  const safeData = JSON.stringify(data);
  window.webContents.executeJavaScript(
    `if (window.updateRealityCheckData) window.updateRealityCheckData(${safeData});`
  ).catch(() => {});

  if (data.timeExceeded) {
    window.webContents.executeJavaScript(
      `if (window.flashRealityCheck) window.flashRealityCheck();`
    ).catch(() => {});
  }
}

function toggleRealityCheck(win) {
  const window = win || realityCheckWindow;
  if (!window || window.isDestroyed()) return;

  if (window.isVisible()) {
    window.hide();
  } else {
    // Position at bottom-right of current screen
    const cursorPoint = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(cursorPoint);
    const { x, y, width, height } = display.workArea;

    window.setPosition(
      x + width - 340,
      y + height - 140
    );

    window.show();
  }
}

function destroyRealityCheck(win) {
  const window = win || realityCheckWindow;
  if (window && !window.isDestroyed()) {
    window.destroy();
  }
}

module.exports = {
  createRealityCheckWindow,
  updateRealityCheck,
  toggleRealityCheck,
  destroyRealityCheck,
};
