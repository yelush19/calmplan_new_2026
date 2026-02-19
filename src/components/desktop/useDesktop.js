import { useState, useEffect } from 'react';

/**
 * Hook to detect if running inside Electron desktop app
 * and provide access to desktop APIs.
 */
export function useDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  const [platform, setPlatform] = useState(null);
  const [version, setVersion] = useState(null);

  useEffect(() => {
    const desktop = window.calmplanDesktop;
    if (!desktop) {
      setIsDesktop(false);
      return;
    }

    desktop.app.isDesktop().then(result => {
      setIsDesktop(result);
    }).catch(() => setIsDesktop(false));

    desktop.app.getPlatform().then(p => setPlatform(p)).catch(() => {});
    desktop.app.getVersion().then(v => setVersion(v)).catch(() => {});
  }, []);

  return {
    isDesktop,
    platform,
    version,
    api: isDesktop ? window.calmplanDesktop : null,
  };
}

/**
 * Show a notification - uses native notifications on desktop,
 * falls back to browser notifications on web.
 */
export function useDesktopNotification() {
  const { isDesktop, api } = useDesktop();

  const showNotification = (title, body, urgency = 'normal') => {
    if (isDesktop && api) {
      api.notification.show(title, body, urgency);
    } else if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body });
    } else if ('Notification' in window) {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification(title, { body });
        }
      });
    }
  };

  return showNotification;
}

/**
 * Quick capture from anywhere - on desktop uses global shortcut,
 * on web provides a function to trigger the command palette.
 */
export function useQuickCapture() {
  const { isDesktop, api } = useDesktop();

  const submitQuickCapture = async (text) => {
    if (isDesktop && api) {
      return api.quickCapture.submit(text);
    }
    // On web, this would be handled by the regular task creation flow
    return null;
  };

  return { isDesktop, submitQuickCapture };
}
