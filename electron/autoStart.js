const { app } = require('electron');

function setupAutoStart(appRef) {
  // Configure auto-start on login
  // Works on Windows and macOS
  if (process.platform === 'linux') {
    // On Linux, auto-start requires .desktop file in ~/.config/autostart/
    // This is handled by electron-builder's linux config
    return;
  }

  const loginSettings = {
    openAtLogin: true,
    openAsHidden: false,
    // On macOS, open directly to the main window
    // On Windows, start with the system tray
    args: process.platform === 'win32' ? ['--start-minimized'] : [],
  };

  try {
    appRef.setLoginItemSettings(loginSettings);
  } catch (error) {
    console.warn('Could not set auto-start:', error.message);
  }
}

function isAutoStartEnabled(appRef) {
  try {
    const settings = appRef.getLoginItemSettings();
    return settings.openAtLogin;
  } catch {
    return false;
  }
}

function toggleAutoStart(appRef, enabled) {
  try {
    appRef.setLoginItemSettings({
      openAtLogin: enabled,
      openAsHidden: false,
    });
    return true;
  } catch (error) {
    console.warn('Could not toggle auto-start:', error.message);
    return false;
  }
}

module.exports = {
  setupAutoStart,
  isAutoStartEnabled,
  toggleAutoStart,
};
