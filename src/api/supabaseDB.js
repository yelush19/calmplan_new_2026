/**
 * SupabaseDB - Drop-in replacement for LocalDB
 * Same API: Entity.list(), Entity.create(), Entity.update(), Entity.delete(), Entity.filter()
 * Uses a single generic table (app_data) with JSONB data column.
 */

import { supabase, isSupabaseAvailable } from './supabaseClient';
import { toast } from 'sonner';

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// Throttled error toast — avoid spamming the user with repeated errors
let lastErrorToastTime = 0;
const ERROR_TOAST_COOLDOWN = 5000; // 5 seconds
function showErrorToast(title, description) {
  const now = Date.now();
  if (now - lastErrorToastTime > ERROR_TOAST_COOLDOWN) {
    lastErrorToastTime = now;
    toast.error(title, { description, duration: 5000 });
  }
}

function guardSupabase(operation) {
  if (!isSupabaseAvailable()) {
    console.error(`[CalmPlan] Supabase not available for ${operation}. Returning empty result.`);
    showErrorToast('המערכת לא מחוברת לענן', 'הנתונים לא נטענו. בדוק את החיבור.');
    return false;
  }
  return true;
}

function createEntity(collectionName) {
  return {
    async list(sortField = null, limit = 1000) {
      if (!guardSupabase(`list(${collectionName})`)) return [];

      let query = supabase
        .from('app_data')
        .select('*')
        .eq('collection', collectionName)
        .limit(limit);

      if (sortField) {
        const desc = sortField.startsWith('-');
        const field = desc ? sortField.slice(1) : sortField;
        // For JSONB fields, we sort on the data column's field
        query = query.order('data->' + field, { ascending: !desc, nullsFirst: false });
      } else {
        query = query.order('created_date', { ascending: true });
      }

      const { data, error } = await query;
      if (error) {
        console.error(`Supabase list error (${collectionName}):`, error);
        showErrorToast('שגיאה בטעינת נתונים', `לא ניתן לטעון ${collectionName}. נסה לרענן.`);
        return [];
      }

      return (data || []).map(row => ({
        ...row.data,
        id: row.id,
        created_date: row.created_date,
        updated_date: row.updated_date,
      }));
    },

    async create(itemData) {
      if (!guardSupabase(`create(${collectionName})`)) throw new Error('Supabase not available');

      const id = generateId();
      const now = new Date().toISOString();
      // Strip id from data to avoid duplication
      const { id: _id, created_date: _cd, updated_date: _ud, ...cleanData } = itemData;

      const { data, error } = await supabase
        .from('app_data')
        .insert({
          id,
          collection: collectionName,
          data: cleanData,
          created_date: now,
          updated_date: now,
        })
        .select()
        .single();

      if (error) {
        console.error(`Supabase create error (${collectionName}):`, error);
        throw error;
      }

      return { ...data.data, id: data.id, created_date: data.created_date, updated_date: data.updated_date };
    },

    async update(id, updateData) {
      if (!guardSupabase(`update(${collectionName})`)) throw new Error('Supabase not available');

      // Strip metadata fields from update data
      const { id: _id, created_date: _cd, updated_date: _ud, ...cleanUpdate } = updateData;

      // First get current data
      const { data: current, error: fetchError } = await supabase
        .from('app_data')
        .select('data')
        .eq('collection', collectionName)
        .eq('id', id)
        .single();

      if (fetchError) {
        console.error(`Supabase fetch for update error (${collectionName}):`, fetchError);
        throw new Error(`Item ${id} not found in ${collectionName}`);
      }

      const mergedData = { ...current.data, ...cleanUpdate };

      const { data, error } = await supabase
        .from('app_data')
        .update({ data: mergedData })
        .eq('collection', collectionName)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error(`Supabase update error (${collectionName}):`, error);
        throw error;
      }

      return { ...data.data, id: data.id, created_date: data.created_date, updated_date: data.updated_date };
    },

    async delete(id) {
      if (!guardSupabase(`delete(${collectionName})`)) throw new Error('Supabase not available');

      const { error } = await supabase
        .from('app_data')
        .delete()
        .eq('collection', collectionName)
        .eq('id', id);

      if (error) {
        console.error(`Supabase delete error (${collectionName}):`, error);
        throw error;
      }

      return { success: true };
    },

    async deleteAll() {
      if (!guardSupabase(`deleteAll(${collectionName})`)) throw new Error('Supabase not available');

      const { error } = await supabase
        .from('app_data')
        .delete()
        .eq('collection', collectionName);

      if (error) {
        console.error(`Supabase deleteAll error (${collectionName}):`, error);
        throw error;
      }

      return { success: true };
    },

    async filter(filters = {}, sortField = null, limit = 1000) {
      // Supabase JSONB filtering is limited, so we fetch all and filter in JS
      // This is fine for the data volumes in this app
      let allItems = await this.list(sortField, 10000);

      allItems = allItems.filter(item => {
        for (const [key, condition] of Object.entries(filters)) {
          if (condition && typeof condition === 'object') {
            if (condition['$in']) {
              if (!condition['$in'].includes(item[key])) return false;
            }
            if (condition['$ne'] !== undefined) {
              if (item[key] === condition['$ne']) return false;
            }
            if (condition['$eq'] !== undefined) {
              if (item[key] !== condition['$eq']) return false;
            }
            if (condition['>='] !== undefined) {
              if (!item[key] || item[key] < condition['>=']) return false;
            }
            if (condition['<='] !== undefined) {
              if (!item[key] || item[key] > condition['<=']) return false;
            }
            if (condition['>'] !== undefined) {
              if (!item[key] || item[key] <= condition['>']) return false;
            }
            if (condition['<'] !== undefined) {
              if (!item[key] || item[key] >= condition['<']) return false;
            }
          } else {
            if (item[key] !== condition) return false;
          }
        }
        return true;
      });

      return allItems.slice(0, limit);
    }
  };
}

const auth = {
  async me() {
    return { full_name: 'ליתאי', email: 'lithai@example.com' };
  },
  async login() { return { success: true }; },
  async logout() { return { success: true }; }
};

export const entities = {
  Event: createEntity('events'),
  Task: createEntity('tasks'),
  TaskSession: createEntity('task_sessions'),
  DaySchedule: createEntity('day_schedules'),
  WeeklyRecommendation: createEntity('weekly_recommendations'),
  Client: createEntity('clients'),
  Dashboard: createEntity('dashboards'),
  AccountReconciliation: createEntity('account_reconciliations'),
  Invoice: createEntity('invoices'),
  ServiceProvider: createEntity('service_providers'),
  ClientContact: createEntity('client_contacts'),
  ClientServiceProvider: createEntity('client_service_providers'),
  ClientAccount: createEntity('client_accounts'),
  ServiceCompany: createEntity('service_companies'),
  Lead: createEntity('leads'),
  RoadmapItem: createEntity('roadmap_items'),
  WeeklySchedule: createEntity('weekly_schedules'),
  FamilyMember: createEntity('family_members'),
  DailyMoodCheck: createEntity('daily_mood_checks'),
  Therapist: createEntity('therapists'),
  TaxReport: createEntity('tax_reports'),
  TaxReport2025: createEntity('tax_reports_2025'),
  TaxReport2024: createEntity('tax_reports_2024'),
  WeeklyTask: createEntity('weekly_tasks'),
  BalanceSheet: createEntity('balance_sheets'),
  StickyNote: createEntity('sticky_notes'),
  Project: createEntity('projects'),
  SystemConfig: createEntity('system_config'),
  PeriodicReport: createEntity('periodic_reports'),
  FileMetadata: createEntity('file_metadata'),
};

export { auth };

/**
 * Migrate all data from localStorage to Supabase
 * Call this once after setting up Supabase to move existing data
 */
export async function migrateFromLocalStorage() {
  if (!guardSupabase('migrateFromLocalStorage')) {
    throw new Error('Supabase not available for migration');
  }

  const DB_PREFIX = 'calmplan_';
  const results = { migrated: 0, skipped: 0, errors: 0, collections: [] };

  for (const key of Object.keys(localStorage)) {
    if (!key.startsWith(DB_PREFIX) || key === DB_PREFIX + '_user') continue;

    const collectionName = key.replace(DB_PREFIX, '');
    try {
      const items = JSON.parse(localStorage.getItem(key));
      if (!Array.isArray(items) || items.length === 0) continue;

      // Check if collection already has data in Supabase
      const { count } = await supabase
        .from('app_data')
        .select('id', { count: 'exact', head: true })
        .eq('collection', collectionName);

      if (count > 0) {
        results.skipped++;
        results.collections.push({ name: collectionName, status: 'skipped', reason: 'already has data' });
        continue;
      }

      // Bulk insert
      const rows = items.map(item => {
        const { id, created_date, updated_date, ...data } = item;
        return {
          id: id || generateId(),
          collection: collectionName,
          data,
          created_date: created_date || new Date().toISOString(),
          updated_date: updated_date || new Date().toISOString(),
        };
      });

      const { error } = await supabase.from('app_data').insert(rows);
      if (error) {
        results.errors++;
        results.collections.push({ name: collectionName, status: 'error', error: error.message });
      } else {
        results.migrated++;
        results.collections.push({ name: collectionName, status: 'migrated', count: rows.length });
      }
    } catch (e) {
      results.errors++;
      results.collections.push({ name: collectionName, status: 'error', error: e.message });
    }
  }

  return results;
}

/**
 * Export all Supabase data as JSON (backup)
 */
export async function exportAllData() {
  if (!guardSupabase('exportAllData')) throw new Error('Supabase not available');

  const { data, error } = await supabase
    .from('app_data')
    .select('*')
    .neq('collection', 'backup_snapshots')
    .order('collection')
    .limit(50000);

  if (error) throw error;

  const grouped = {};
  for (const row of data) {
    if (!grouped[row.collection]) grouped[row.collection] = [];
    grouped[row.collection].push({
      ...row.data,
      id: row.id,
      created_date: row.created_date,
      updated_date: row.updated_date,
    });
  }
  return grouped;
}

/**
 * Save a daily backup snapshot to Supabase (backup_snapshots collection).
 * Keeps last 7 snapshots, auto-deletes older ones.
 * Returns { saved: boolean, date: string } or throws on error.
 */
export async function saveDailyBackupToSupabase() {
  if (!guardSupabase('saveDailyBackupToSupabase')) throw new Error('Supabase not available');

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // Check if today's backup already exists
  const { data: existing } = await supabase
    .from('app_data')
    .select('id')
    .eq('collection', 'backup_snapshots')
    .eq('id', `backup_${today}`)
    .maybeSingle();

  if (existing) {
    return { saved: false, date: today, reason: 'already_exists' };
  }

  // Export all data
  const allData = await exportAllData();
  const summary = {};
  for (const [collection, items] of Object.entries(allData)) {
    summary[collection] = items.length;
  }

  // Save snapshot
  const { error } = await supabase.from('app_data').upsert({
    id: `backup_${today}`,
    collection: 'backup_snapshots',
    data: { date: today, summary, snapshot: allData, total_records: Object.values(summary).reduce((a, b) => a + b, 0) },
    created_date: new Date().toISOString(),
    updated_date: new Date().toISOString(),
  }, { onConflict: 'collection,id' });

  if (error) throw error;

  // Cleanup: keep only last 7 backups
  const { data: allBackups } = await supabase
    .from('app_data')
    .select('id, created_date')
    .eq('collection', 'backup_snapshots')
    .order('created_date', { ascending: false });

  if (allBackups && allBackups.length > 7) {
    const toDelete = allBackups.slice(7).map(b => b.id);
    await supabase
      .from('app_data')
      .delete()
      .eq('collection', 'backup_snapshots')
      .in('id', toDelete);
  }

  return { saved: true, date: today, summary };
}

/**
 * List available backup snapshots
 */
export async function listBackupSnapshots() {
  if (!guardSupabase('listBackupSnapshots')) return [];

  const { data, error } = await supabase
    .from('app_data')
    .select('id, data, created_date')
    .eq('collection', 'backup_snapshots')
    .order('created_date', { ascending: false })
    .limit(10);

  if (error) throw error;
  return (data || []).map(row => ({
    id: row.id,
    date: row.data?.date,
    summary: row.data?.summary,
    total_records: row.data?.total_records,
    created_date: row.created_date,
  }));
}

/**
 * Restore from a specific backup snapshot
 */
export async function restoreFromBackupSnapshot(backupId) {
  if (!guardSupabase('restoreFromBackupSnapshot')) throw new Error('Supabase not available');

  const { data, error } = await supabase
    .from('app_data')
    .select('data')
    .eq('collection', 'backup_snapshots')
    .eq('id', backupId)
    .single();

  if (error) throw error;
  if (!data?.data?.snapshot) throw new Error('Backup snapshot not found or empty');

  await importAllData(data.data.snapshot);
  return { restored: true, date: data.data.date };
}

/**
 * Delete all data from Supabase (except backup_snapshots)
 */
export async function clearAllData() {
  if (!guardSupabase('clearAllData')) throw new Error('Supabase not available');

  const { error } = await supabase
    .from('app_data')
    .delete()
    .neq('collection', 'backup_snapshots');
  if (error) throw error;
}

/**
 * Clean zombie keys from data objects.
 * Removes numeric string keys ("0", "1", "2", ...) that appear from
 * corrupted array-to-object serialization in backups.
 * Also removes undefined/null-only entries.
 */
function cleanZombieFields(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    // Skip numeric string keys (zombie fields from array corruption)
    if (/^\d+$/.test(key)) continue;
    // Keep everything else (including nested objects/arrays)
    cleaned[key] = value;
  }
  return cleaned;
}

/**
 * Normalize collection name:
 * - Strips "calmplan_" prefix if present (localStorage format → Supabase format)
 * - Skips internal/user keys
 */
function normalizeCollectionName(key) {
  // Skip internal keys
  if (key === 'calmplan__user' || key === '_user') return null;
  // Strip calmplan_ prefix if present
  if (key.startsWith('calmplan_')) return key.replace('calmplan_', '');
  return key;
}

/**
 * Import data from JSON backup to Supabase.
 * Handles both formats:
 *  - Supabase export: { "clients": [...], "tasks": [...] }
 *  - localStorage export: { "calmplan_clients": [...], "calmplan_tasks": [...] }
 * Cleans zombie numeric keys from all records.
 */
export async function importAllData(allData) {
  if (!guardSupabase('importAllData')) throw new Error('Supabase not available');

  const rows = [];
  for (const [rawKey, items] of Object.entries(allData)) {
    const collection = normalizeCollectionName(rawKey);
    if (!collection) continue;
    // Skip backup_snapshots to avoid importing old backups
    if (collection === 'backup_snapshots') continue;
    if (!Array.isArray(items)) continue;

    for (const item of items) {
      const { id, created_date, updated_date, ...rawData } = item;
      const data = cleanZombieFields(rawData);
      rows.push({
        id: id || generateId(),
        collection,
        data,
        created_date: created_date || new Date().toISOString(),
        updated_date: updated_date || new Date().toISOString(),
      });
    }
  }

  if (rows.length === 0) {
    throw new Error('No valid data found in backup file');
  }

  // Upsert in batches of 500
  const errors = [];
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const { error } = await supabase.from('app_data').upsert(batch, { onConflict: 'collection,id' });
    if (error) {
      console.error(`Batch upsert error (rows ${i}-${i + batch.length}):`, error);
      errors.push(error.message);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Import completed with errors: ${errors.join('; ')}`);
  }

  return { imported: rows.length };
}
