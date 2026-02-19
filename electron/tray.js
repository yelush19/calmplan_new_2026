const { Tray, Menu, nativeImage, app } = require('electron');
const path = require('path');

let tray = null;
let currentPressure = 'green';

// Create colored tray icons programmatically
function createTrayIcon(color) {
  const size = 16;
  const canvas = nativeImage.createEmpty();

  // Create a simple colored circle icon using data URL
  const colors = {
    green: '#10b981',   // הכל תחת שליטה
    orange: '#f59e0b',  // דברים דחופים להיום
    purple: '#8b5cf6',  // פיגור שדורש התייחסות
  };

  const hex = colors[color] || colors.green;

  // SVG-based icon
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 1}" fill="${hex}" />
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 3}" fill="white" opacity="0.3" />
    </svg>
  `;

  return nativeImage.createFromBuffer(
    Buffer.from(svg),
    { width: size, height: size }
  );
}

function buildTrayMenu(mainWindow, appRef) {
  const nextTasks = appRef.nextTasks || [];

  const taskItems = nextTasks.length > 0
    ? nextTasks.slice(0, 3).map((task, i) => ({
        label: `${i + 1}. ${task.title || task.name || 'משימה'}`,
        enabled: false,
        icon: task.size === 'L' ? undefined : undefined,
      }))
    : [{ label: 'אין משימות קרובות', enabled: false }];

  const pressureLabels = {
    green: '🟢 הכל תחת שליטה',
    orange: '🟠 יש דברים דחופים',
    purple: '🟣 יש פיגור',
  };

  return Menu.buildFromTemplate([
    {
      label: 'CalmPlan',
      enabled: false,
    },
    { type: 'separator' },
    {
      label: pressureLabels[currentPressure] || pressureLabels.green,
      enabled: false,
    },
    { type: 'separator' },
    {
      label: '📋 המשימות הבאות:',
      enabled: false,
    },
    ...taskItems,
    { type: 'separator' },
    {
      label: '🎯 מצב ריכוז',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('tray:action', 'focus-mode');
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: '👥 מרכז לקוחות',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('tray:action', 'open-clients');
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: '⏱️ Reality Check',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('tray:action', 'toggle-reality-check');
        }
      },
    },
    { type: 'separator' },
    {
      label: '🏠 פתח CalmPlan',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: '❌ יציאה',
      click: () => {
        appRef.isQuitting = true;
        appRef.quit();
      },
    },
  ]);
}

function createTray(mainWindow, appRef) {
  const icon = createTrayIcon('green');
  tray = new Tray(icon);
  tray.setToolTip('CalmPlan - מרכז השליטה השקט');

  const contextMenu = buildTrayMenu(mainWindow, appRef);
  tray.setContextMenu(contextMenu);

  // Double-click to open main window
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  return tray;
}

function updateTrayPressure(level) {
  if (!tray || tray.isDestroyed()) return;
  currentPressure = level;

  const icon = createTrayIcon(level);
  tray.setImage(icon);

  const tooltips = {
    green: 'CalmPlan - הכל תחת שליטה ✓',
    orange: 'CalmPlan - יש דברים דחופים להיום',
    purple: 'CalmPlan - יש פיגור שדורש התייחסות',
  };
  tray.setToolTip(tooltips[level] || tooltips.green);
}

function refreshTrayMenu(mainWindow, appRef) {
  if (!tray || tray.isDestroyed()) return;
  const contextMenu = buildTrayMenu(mainWindow, appRef);
  tray.setContextMenu(contextMenu);
}

function destroyTray() {
  if (tray && !tray.isDestroyed()) {
    tray.destroy();
  }
  tray = null;
}

module.exports = {
  createTray,
  updateTrayPressure,
  refreshTrayMenu,
  destroyTray,
};
