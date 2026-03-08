/**
 * ── Backup Status: Check latest backups in Google Drive ──
 *
 * Returns the 10 most recent backup files with timestamps and sizes.
 * Used by the SystemOverview UI to show backup health.
 */

import { google } from 'googleapis';

const GOOGLE_CREDS = process.env.GOOGLE_SERVICE_ACCOUNT;
const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
const CRON_SECRET = process.env.CRON_SECRET;

export default async function handler(req, res) {
  // Auth check
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!GOOGLE_CREDS || !FOLDER_ID) {
    return res.status(500).json({ error: 'Google Drive not configured' });
  }

  try {
    const credentials = JSON.parse(GOOGLE_CREDS);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });
    const drive = google.drive({ version: 'v3', auth });

    const result = await drive.files.list({
      q: `'${FOLDER_ID}' in parents and name contains 'calmplan_backup_' and trashed = false`,
      fields: 'files(id, name, size, createdTime)',
      orderBy: 'createdTime desc',
      pageSize: 10,
    });

    const files = (result.data.files || []).map(f => ({
      name: f.name,
      sizeKB: f.size ? (parseInt(f.size) / 1024).toFixed(1) : null,
      createdTime: f.createdTime,
    }));

    const totalFiles = await drive.files.list({
      q: `'${FOLDER_ID}' in parents and name contains 'calmplan_backup_' and trashed = false`,
      fields: 'files(id)',
      pageSize: 1000,
    });

    return res.status(200).json({
      configured: true,
      latestBackup: files[0] || null,
      recentBackups: files,
      totalBackupCount: (totalFiles.data.files || []).length,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
