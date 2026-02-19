const { contextBridge, ipcRenderer } = require('electron');

// ─── CalmPlan Desktop API ───────────────────────────────────────
// Exposed securely to the renderer process via contextBridge

contextBridge.exposeInMainWorld('calmplanDesktop', {
  // ── Quick Capture ──
  quickCapture: {
    submit: (taskText) => ipcRenderer.invoke('quick-capture:submit', taskText),
    close: () => ipcRenderer.invoke('quick-capture:close'),
    onNewTask: (callback) => {
      const handler = (event, taskText) => callback(taskText);
      ipcRenderer.on('quick-capture:new-task', handler);
      return () => ipcRenderer.removeListener('quick-capture:new-task', handler);
    },
  },

  // ── Reality Check ──
  realityCheck: {
    update: (data) => ipcRenderer.invoke('reality-check:update', data),
    toggle: () => ipcRenderer.invoke('reality-check:toggle'),
    respond: (response) => ipcRenderer.invoke('reality-check:respond', response),
    onResponse: (callback) => {
      const handler = (event, response) => callback(response);
      ipcRenderer.on('reality-check:response', handler);
      return () => ipcRenderer.removeListener('reality-check:response', handler);
    },
  },

  // ── System Tray ──
  tray: {
    updatePressure: (level) => ipcRenderer.invoke('tray:update-pressure', level),
    updateTasks: (tasks) => ipcRenderer.invoke('tray:update-tasks', tasks),
  },

  // ── Notifications ──
  notification: {
    show: (title, body, urgency = 'normal') =>
      ipcRenderer.invoke('notification:show', { title, body, urgency }),
  },

  // ── Window Controls ──
  window: {
    setFocusMode: (enabled) => ipcRenderer.invoke('window:focus-mode', enabled),
    showMain: () => ipcRenderer.invoke('window:show-main'),
    onFocusModeChanged: (callback) => {
      const handler = (event, enabled) => callback(enabled);
      ipcRenderer.on('focus-mode:changed', handler);
      return () => ipcRenderer.removeListener('focus-mode:changed', handler);
    },
  },

  // ── File Handling ──
  file: {
    onReceived: (callback) => {
      const handler = (event, filePaths) => callback(filePaths);
      ipcRenderer.on('file:received', handler);
      return () => ipcRenderer.removeListener('file:received', handler);
    },
  },

  // ── App Info ──
  app: {
    isDesktop: () => ipcRenderer.invoke('app:is-desktop'),
    getVersion: () => ipcRenderer.invoke('app:get-version'),
    getPlatform: () => ipcRenderer.invoke('app:get-platform'),
  },

  // ── Tray Menu Actions ──
  onTrayAction: (callback) => {
    const handler = (event, action) => callback(action);
    ipcRenderer.on('tray:action', handler);
    return () => ipcRenderer.removeListener('tray:action', handler);
  },
});
