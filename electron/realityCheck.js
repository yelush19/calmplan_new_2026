import { BrowserWindow, screen } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let realityCheckWindow = null;

export function createRealityCheckWindow(preloadPath, isDev) {
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

export function updateRealityCheck(win, data) {
  const window = win || realityCheckWindow;
  if (!window || window.isDestroyed()) return;

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

export function toggleRealityCheck(win) {
  const window = win || realityCheckWindow;
  if (!window || window.isDestroyed()) return;

  if (window.isVisible()) {
    window.hide();
  } else {
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

export function destroyRealityCheck(win) {
  const window = win || realityCheckWindow;
  if (window && !window.isDestroyed()) {
    window.destroy();
  }
}
