const { Notification } = require('electron');
const path = require('path');

function showNativeNotification(title, body, urgency = 'normal', mainWindow) {
  if (!Notification.isSupported()) {
    console.warn('Native notifications not supported on this platform');
    return;
  }

  const notification = new Notification({
    title,
    body,
    icon: path.join(__dirname, 'icons', 'icon.png'),
    silent: urgency === 'low',
    urgency, // 'low', 'normal', 'critical' (Linux only)
    timeoutType: urgency === 'critical' ? 'never' : 'default',
  });

  notification.on('click', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  notification.show();
  return notification;
}

module.exports = { showNativeNotification };
