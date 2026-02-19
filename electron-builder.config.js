/**
 * CalmPlan Desktop - Electron Builder Configuration
 *
 * Build commands:
 *   npm run electron:build:win    → Windows (.exe installer)
 *   npm run electron:build:mac    → macOS (.dmg)
 *   npm run electron:build:linux  → Linux (.AppImage, .deb)
 */

module.exports = {
  appId: 'com.calmplan.desktop',
  productName: 'CalmPlan',
  copyright: 'Copyright © 2026 CalmPlan',

  directories: {
    output: 'release',
    buildResources: 'electron/icons',
  },

  files: [
    'dist/**/*',
    'electron/**/*',
    '!electron/icons/raw/**',
  ],

  // ── Windows ──
  win: {
    target: [
      {
        target: 'nsis',
        arch: ['x64'],
      },
    ],
    icon: 'electron/icons/icon.png',
    artifactName: 'CalmPlan-Setup-${version}.${ext}',
  },

  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    installerIcon: 'electron/icons/icon.png',
    uninstallerIcon: 'electron/icons/icon.png',
    installerHeaderIcon: 'electron/icons/icon.png',
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'CalmPlan',
    // Hebrew installer
    language: 1037,
  },

  // ── macOS ──
  mac: {
    target: [
      {
        target: 'dmg',
        arch: ['x64', 'arm64'],
      },
    ],
    icon: 'electron/icons/icon.png',
    category: 'public.app-category.productivity',
    artifactName: 'CalmPlan-${version}-${arch}.${ext}',
    darkModeSupport: true,
  },

  dmg: {
    contents: [
      { x: 130, y: 220 },
      { x: 410, y: 220, type: 'link', path: '/Applications' },
    ],
    window: {
      width: 540,
      height: 380,
    },
  },

  // ── Linux ──
  linux: {
    target: [
      { target: 'AppImage', arch: ['x64'] },
      { target: 'deb', arch: ['x64'] },
    ],
    icon: 'electron/icons/icon.png',
    category: 'Office',
    artifactName: 'CalmPlan-${version}.${ext}',
    desktop: {
      StartupNotify: 'true',
      Terminal: 'false',
      Type: 'Application',
      Categories: 'Office;ProjectManagement;',
    },
  },

  // ── Auto-start on login ──
  // This is handled programmatically in autoStart.js

  // ── File associations (for drag & drop) ──
  fileAssociations: [
    {
      ext: 'pdf',
      name: 'PDF Document',
      role: 'Viewer',
      mimeType: 'application/pdf',
    },
    {
      ext: 'xlsx',
      name: 'Excel Spreadsheet',
      role: 'Viewer',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
    {
      ext: 'csv',
      name: 'CSV File',
      role: 'Viewer',
      mimeType: 'text/csv',
    },
  ],
};
