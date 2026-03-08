/**
 * SupabaseDB - Drop-in replacement for LocalDB
 * Same API: Entity.list(), Entity.create(), Entity.update(), Entity.delete(), Entity.filter()
 * Uses a single generic table (app_data) with JSONB data column.
 *
 * ══ RLS-AWARE ══
 * After detecting RLS blocks reads, this module sets rlsBlocked=true.
 * The hybrid layer in base44Client reads this flag and routes to localStorage.
 * Supabase queries are SKIPPED once rlsBlocked is set — no more console spam.
 */

import { supabase, isSupabaseAvailable } from './supabaseClient';
import { toast } from 'sonner';

// ── RLS state (exported so base44Client can read it) ──
export let rlsBlocked = false;
let rlsChecked = false;

function mapRows(rows) {
  return (rows || []).map(row => ({
    ...row.data,
    id: row.id,
    created_date: row.created_date,
    updated_date: row.updated_date,
  }));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

let lastErrorToastTime = 0;
function showErrorToast(title, description) {
  const now = Date.now();
  if (now - lastErrorToastTime > 5000) {
    lastErrorToastTime = now;
    toast.error(title, { description, duration: 5000 });
  }
}

function guardSupabase(operation) {
  if (!isSupabaseAvailable()) return false;
  return true;
}

/**
 * One-time RLS probe: check if we can actually read rows.
 * Sets rlsBlocked=true if the table has data but SELECT returns 0.
 * Uses RPC count as a fallback to detect RLS even when count is also blocked.
 */
async function probeRls() {
  if (rlsChecked || !supabase) return;
  rlsChecked = true;
  try {
    // Step 1: Try a normal SELECT
    const { data, error } = await supabase
      .from('app_data')
      .select('id')
      .limit(1);

    if (data && data.length > 0) {
      // Can read — RLS is fine
      console.log('[Supabase] RLS probe: reads OK');
      return;
    }

    // Step 2: SELECT returned 0 rows. Could be empty OR RLS blocking.
    // Try count with exact (head:true bypasses some RLS policies)
    const { count } = await supabase
      .from('app_data')
      .select('id', { count: 'exact', head: true });

    if (count && count > 0) {
      // Table has rows but SELECT returned 0 → RLS is blocking
      rlsBlocked = true;
      console.warn(
        `[Supabase] ⚠️ RLS is blocking reads (${count} rows exist, 0 returned). ` +
        'All reads routed to localStorage. Fix: run fix-rls.sql in Supabase SQL Editor.'
      );
      return;
    }

    // Step 3: Both returned 0. If this is the LitayCalmplan project with data,
    // RLS might be blocking BOTH count and select. Try an RPC or check for
    // specific known error patterns.
    if (!error) {
      // Supabase responded without error but 0 data — could be RLS or genuinely empty.
      // If we get here on a known-populated instance, RLS is the most likely cause.
      // Store this status so the UI can show a diagnostic.
      console.warn(
        '[Supabase] ⚠️ 0 rows returned with no error. If you expect data, ' +
        'RLS may be blocking both COUNT and SELECT. Run fix-rls.sql in SQL Editor.'
      );
    }
  } catch (err) {
    console.error('[Supabase] RLS probe error:', err.message);
  }
}

/** Expose RLS status for diagnostic UI */
export function getConnectionDiagnostic() {
  return {
    rlsBlocked,
    rlsChecked,
    supabaseConfigured: isSupabaseAvailable(),
  };
}

// Kick off probe immediately (non-blocking)
if (isSupabaseAvailable()) {
  probeRls();
}

function createEntity(collectionName) {
  return {
    async list(sortField = null, limit = 1000) {
      if (!guardSupabase(`list(${collectionName})`)) return [];
      // If RLS is known-blocked, don't waste time — return [] so hybrid falls back
      if (rlsBlocked) return [];

      const { data, error } = await supabase
        .from('app_data')
        .select('*')
        .eq('collection', collectionName)
        .limit(limit);

      if (!error && data && data.length > 0) {
        let results = mapRows(data);
        if (sortField) {
          const desc = sortField.startsWith('-');
          const field = desc ? sortField.slice(1) : sortField;
          results.sort((a, b) => {
            const va = a[field] || '';
            const vb = b[field] || '';
            if (desc) return va > vb ? -1 : va < vb ? 1 : 0;
            return va < vb ? -1 : va > vb ? 1 : 0;
          });
        }
        return results;
      }

      // Got 0 rows — mark RLS blocked (probe may not have finished yet)
      if (!rlsBlocked && !error) {
        await probeRls();
      }
      return [];
    },

    async create(itemData) {
      if (!guardSupabase(`create(${collectionName})`)) throw new Error('Supabase not available');
      if (rlsBlocked) throw new Error('RLS blocked');

      const id = generateId();
      const now = new Date().toISOString();
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
      if (rlsBlocked) throw new Error('RLS blocked');

      const { id: _id, created_date: _cd, updated_date: _ud, ...cleanUpdate } = updateData;

      const { data: current, error: fetchError } = await supabase
        .from('app_data')
        .select('data')
        .eq('collection', collectionName)
        .eq('id', id)
        .single();

      if (fetchError) {
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

      if (error) throw error;

      return { ...data.data, id: data.id, created_date: data.created_date, updated_date: data.updated_date };
    },

    async delete(id) {
      if (!guardSupabase(`delete(${collectionName})`)) throw new Error('Supabase not available');
      if (rlsBlocked) throw new Error('RLS blocked');

      const { error } = await supabase
        .from('app_data')
        .delete()
        .eq('collection', collectionName)
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    },

    async deleteAll() {
      if (!guardSupabase(`deleteAll(${collectionName})`)) throw new Error('Supabase not available');
      if (rlsBlocked) throw new Error('RLS blocked');

      const { error } = await supabase
        .from('app_data')
        .delete()
        .eq('collection', collectionName);

      if (error) throw error;
      return { success: true };
    },

    async filter(filters = {}, sortField = null, limit = 1000) {
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
  ServiceCatalog: createEntity('service_catalog'),
};

export { auth };

export async function migrateFromLocalStorage() {
  if (!guardSupabase('migrateFromLocalStorage')) {
    throw new Error('Supabase not available');
  }

  const DB_PREFIX = 'calmplan_';
  const results = { migrated: 0, skipped: 0, errors: 0, collections: [] };

  for (const key of Object.keys(localStorage)) {
    if (!key.startsWith(DB_PREFIX) || key === DB_PREFIX + '_user') continue;

    const collectionName = key.replace(DB_PREFIX, '');
    try {
      const items = JSON.parse(localStorage.getItem(key));
      if (!Array.isArray(items) || items.length === 0) continue;

      const { count } = await supabase
        .from('app_data')
        .select('id', { count: 'exact', head: true })
        .eq('collection', collectionName);

      if (count > 0) {
        results.skipped++;
        results.collections.push({ name: collectionName, status: 'skipped', reason: 'already has data' });
        continue;
      }

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

export async function exportAllData() {
  if (!guardSupabase('exportAllData')) throw new Error('Supabase not available');

  const { data, error } = await supabase
    .from('app_data')
    .select('*')
    .neq('collection', 'backup_snapshots')
    .limit(50000);

  if (error) throw error;

  const grouped = {};
  for (const row of (data || [])) {
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

export async function saveDailyBackupToSupabase() {
  if (!guardSupabase('saveDailyBackupToSupabase')) throw new Error('Supabase not available');

  const today = new Date().toISOString().split('T')[0];

  const { data: existing } = await supabase
    .from('app_data')
    .select('id')
    .eq('collection', 'backup_snapshots')
    .eq('id', `backup_${today}`)
    .maybeSingle();

  if (existing) {
    return { saved: false, date: today, reason: 'already_exists' };
  }

  const allData = await exportAllData();
  const summary = {};
  for (const [collection, items] of Object.entries(allData)) {
    summary[collection] = items.length;
  }

  const { error } = await supabase.from('app_data').upsert({
    id: `backup_${today}`,
    collection: 'backup_snapshots',
    data: { date: today, summary, snapshot: allData, total_records: Object.values(summary).reduce((a, b) => a + b, 0) },
    created_date: new Date().toISOString(),
    updated_date: new Date().toISOString(),
  }, { onConflict: 'collection,id' });

  if (error) throw error;

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

export async function clearAllData() {
  if (!guardSupabase('clearAllData')) throw new Error('Supabase not available');

  const { error } = await supabase
    .from('app_data')
    .delete()
    .neq('collection', 'backup_snapshots');
  if (error) throw error;
}

function cleanZombieFields(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    if (/^\d+$/.test(key)) continue;
    cleaned[key] = value;
  }
  return cleaned;
}

function normalizeCollectionName(key) {
  if (key === 'calmplan__user' || key === '_user') return null;
  if (key.startsWith('calmplan_')) return key.replace('calmplan_', '');
  return key;
}

export async function importAllData(allData) {
  if (!guardSupabase('importAllData')) throw new Error('Supabase not available');

  const rows = [];
  for (const [rawKey, items] of Object.entries(allData)) {
    const collection = normalizeCollectionName(rawKey);
    if (!collection) continue;
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
