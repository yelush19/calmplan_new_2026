import { Notification } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function showNativeNotification(title, body, urgency = 'normal', mainWindow) {
  if (!Notification.isSupported()) {
    console.warn('Native notifications not supported on this platform');
    return;
  }

  const notification = new Notification({
    title,
    body,
    icon: path.join(__dirname, 'icons', 'icon.png'),
    silent: urgency === 'low',
    urgency,
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
