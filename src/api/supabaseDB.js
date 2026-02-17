/**
 * SupabaseDB - Drop-in replacement for LocalDB
 * Same API: Entity.list(), Entity.create(), Entity.update(), Entity.delete(), Entity.filter()
 * Uses a single generic table (app_data) with JSONB data column.
 */

import { supabase } from './supabaseClient';

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function createEntity(collectionName) {
  return {
    async list(sortField = null, limit = 1000) {
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
};

export { auth };

/**
 * Migrate all data from localStorage to Supabase
 * Call this once after setting up Supabase to move existing data
 */
export async function migrateFromLocalStorage() {
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
  const { data, error } = await supabase
    .from('app_data')
    .select('*')
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
 * Import data from JSON backup to Supabase
 */
export async function importAllData(allData) {
  const rows = [];
  for (const [collection, items] of Object.entries(allData)) {
    for (const item of items) {
      const { id, created_date, updated_date, ...data } = item;
      rows.push({
        id: id || generateId(),
        collection,
        data,
        created_date: created_date || new Date().toISOString(),
        updated_date: updated_date || new Date().toISOString(),
      });
    }
  }

  // Upsert in batches of 500
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const { error } = await supabase.from('app_data').upsert(batch, { onConflict: 'collection,id' });
    if (error) throw error;
  }
}
