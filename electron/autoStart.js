export function setupAutoStart(appRef) {
  if (process.platform === 'linux') {
    return;
  }

  const loginSettings = {
    openAtLogin: true,
    openAsHidden: false,
    args: process.platform === 'win32' ? ['--start-minimized'] : [],
  };

  try {
    appRef.setLoginItemSettings(loginSettings);
  } catch (error) {
    console.warn('Could not set auto-start:', error.message);
  }
}

export function isAutoStartEnabled(appRef) {
  try {
    const settings = appRef.getLoginItemSettings();
    return settings.openAtLogin;
  } catch {
    return false;
  }
}

export function toggleAutoStart(appRef, enabled) {
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
