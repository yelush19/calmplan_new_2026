import { ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';

export function setupDragDrop(mainWindow) {
  if (!mainWindow) return;

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('file://')) {
      event.preventDefault();
      const filePath = decodeURIComponent(url.replace('file://', ''));
      handleDroppedFile(mainWindow, filePath);
    }
  });

  ipcMain.handle('file:process-drop', async (event, { filePaths, clientId, targetType }) => {
    const results = [];

    for (const filePath of filePaths) {
      try {
        const stat = fs.statSync(filePath);
        const ext = path.extname(filePath).toLowerCase();
        const name = path.basename(filePath);

        results.push({
          path: filePath,
          name,
          size: stat.size,
          ext,
          type: getFileType(ext),
          clientId: clientId || null,
          targetType: targetType || 'inbox',
        });
      } catch (error) {
        console.warn(`Could not process file: ${filePath}`, error.message);
      }
    }

    return results;
  });

  ipcMain.handle('file:read', async (event, filePath) => {
    try {
      const buffer = fs.readFileSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const name = path.basename(filePath);

      return {
        name,
        ext,
        buffer: buffer.toString('base64'),
        size: buffer.length,
        type: getFileType(ext),
      };
    } catch (error) {
      return { error: error.message };
    }
  });
}

function handleDroppedFile(mainWindow, filePath) {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const ext = path.extname(filePath).toLowerCase();
  const name = path.basename(filePath);

  mainWindow.webContents.send('file:received', [{
    path: filePath,
    name,
    ext,
    type: getFileType(ext),
  }]);
}

function getFileType(ext) {
  const types = {
    '.pdf': 'document',
    '.doc': 'document',
    '.docx': 'document',
    '.xls': 'spreadsheet',
    '.xlsx': 'spreadsheet',
    '.csv': 'spreadsheet',
    '.jpg': 'image',
    '.jpeg': 'image',
    '.png': 'image',
    '.gif': 'image',
    '.txt': 'text',
    '.zip': 'archive',
    '.rar': 'archive',
  };
  return types[ext] || 'other';
}
