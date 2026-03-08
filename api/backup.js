/**
 * ── Hourly Backup: Supabase → Compressed JSON → Google Drive ──
 *
 * Vercel Serverless Function triggered by cron (every hour).
 * - Exports all app_data rows from Supabase as compressed JSON
 * - Uploads to Google Drive folder "CalmPlan_Backups"
 * - Deletes backups older than 30 days
 *
 * Required Vercel env vars:
 *   SUPABASE_URL              - Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Service role key (bypasses RLS)
 *   GOOGLE_SERVICE_ACCOUNT    - JSON string of Google service account credentials
 *   GOOGLE_DRIVE_FOLDER_ID    - Google Drive folder ID for backups
 *   CRON_SECRET               - Secret to authenticate cron requests
 */

import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import { gzipSync } from 'node:zlib';
import { Readable } from 'node:stream';

// ── Config ──
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_CREDS = process.env.GOOGLE_SERVICE_ACCOUNT;
const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
const CRON_SECRET = process.env.CRON_SECRET;
const RETENTION_DAYS = 30;

// Collections stored in app_data
const COLLECTIONS = [
  'clients', 'tasks', 'events', 'task_sessions',
  'day_schedules', 'weekly_recommendations', 'dashboards',
  'account_reconciliations', 'invoices', 'service_providers',
  'client_contacts', 'client_service_providers', 'client_accounts',
  'service_companies', 'leads', 'roadmap_items', 'weekly_schedules',
  'family_members', 'daily_mood_checks', 'therapists',
  'tax_reports', 'tax_reports_2025', 'tax_reports_2024',
  'weekly_tasks', 'balance_sheets', 'sticky_notes', 'projects',
  'system_config', 'periodic_reports', 'file_metadata', 'service_catalog',
];

export default async function handler(req, res) {
  const startTime = Date.now();

  // ── Auth: Verify cron secret ──
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // ── Validate env vars ──
  const missing = [];
  if (!SUPABASE_URL) missing.push('SUPABASE_URL');
  if (!SUPABASE_SERVICE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!GOOGLE_CREDS) missing.push('GOOGLE_SERVICE_ACCOUNT');
  if (!FOLDER_ID) missing.push('GOOGLE_DRIVE_FOLDER_ID');
  if (missing.length > 0) {
    return res.status(500).json({ error: `Missing env vars: ${missing.join(', ')}` });
  }

  try {
    // ── 1. Export all data from Supabase ──
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
    });

    const backup = {
      metadata: {
        timestamp: new Date().toISOString(),
        version: '1.0',
        source: 'calmplan-hourly-backup',
        collections: [],
      },
      data: {},
    };

    let totalRows = 0;

    for (const collection of COLLECTIONS) {
      const { data: rows, error } = await supabase
        .from('app_data')
        .select('*')
        .eq('collection', collection)
        .order('created_date', { ascending: false });

      if (error) {
        console.error(`[Backup] Failed to read ${collection}: ${error.message}`);
        backup.data[collection] = { rows: [], error: error.message };
        continue;
      }

      backup.data[collection] = { rows: rows || [], count: (rows || []).length };
      totalRows += (rows || []).length;
      backup.metadata.collections.push({ name: collection, count: (rows || []).length });
    }

    backup.metadata.totalRows = totalRows;

    // ── 2. Compress to gzip JSON ──
    const jsonStr = JSON.stringify(backup);
    const compressed = gzipSync(Buffer.from(jsonStr, 'utf-8'));

    const now = new Date();
    const dateStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `calmplan_backup_${dateStr}.json.gz`;

    // ── 3. Upload to Google Drive ──
    const credentials = JSON.parse(GOOGLE_CREDS);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });
    const drive = google.drive({ version: 'v3', auth });

    const fileMetadata = {
      name: fileName,
      parents: [FOLDER_ID],
      mimeType: 'application/gzip',
    };

    const media = {
      mimeType: 'application/gzip',
      body: Readable.from(compressed),
    };

    const uploaded = await drive.files.create({
      requestBody: fileMetadata,
      media,
      fields: 'id, name, size, createdTime',
    });

    console.log(`[Backup] Uploaded: ${uploaded.data.name} (${(compressed.length / 1024).toFixed(1)} KB, ${totalRows} rows)`);

    // ── 4. Delete backups older than 30 days ──
    const cutoffDate = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const cutoffISO = cutoffDate.toISOString();

    const oldFiles = await drive.files.list({
      q: `'${FOLDER_ID}' in parents and name contains 'calmplan_backup_' and createdTime < '${cutoffISO}' and trashed = false`,
      fields: 'files(id, name, createdTime)',
      orderBy: 'createdTime asc',
    });

    let deletedCount = 0;
    for (const file of (oldFiles.data.files || [])) {
      try {
        await drive.files.delete({ fileId: file.id });
        deletedCount++;
        console.log(`[Backup] Deleted old backup: ${file.name} (${file.createdTime})`);
      } catch (delErr) {
        console.error(`[Backup] Failed to delete ${file.name}: ${delErr.message}`);
      }
    }

    const elapsed = Date.now() - startTime;

    return res.status(200).json({
      success: true,
      backup: {
        fileName,
        sizeKB: (compressed.length / 1024).toFixed(1),
        totalRows,
        collections: backup.metadata.collections.length,
        uploadedFileId: uploaded.data.id,
      },
      retention: {
        deletedCount,
        cutoffDate: cutoffISO,
        retentionDays: RETENTION_DAYS,
      },
      elapsedMs: elapsed,
    });
  } catch (err) {
    console.error('[Backup] Fatal error:', err);
    return res.status(500).json({
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }
}
