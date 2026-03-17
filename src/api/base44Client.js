// CalmPlan Data Layer — Supabase REQUIRED
// ══ Fails visibly if Supabase is not configured ══
import { isSupabaseConfigured, supabase, testSupabaseConnection } from './supabaseClient';
import * as localDB from './localDB';
import * as supabaseDB from './supabaseDB';
import { _registry } from './entityRegistry';

const primary = isSupabaseConfigured ? supabaseDB : localDB;

// ── STRICT MODE: Supabase must be configured ──
if (!isSupabaseConfigured) {
  console.error(
    '[CalmPlan] ❌ FATAL: Supabase is NOT configured.\n' +
    'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel Environment Variables.\n' +
    'The app will NOT function without a database connection.'
  );
}

function isRlsBlocked() {
  return isSupabaseConfigured && supabaseDB.rlsBlocked;
}

// ── Supabase-first entities (localStorage only as offline read cache) ──
function createEntity(entityName) {
  const supaEntity = isSupabaseConfigured ? primary.entities[entityName] : null;
  const localEntity = localDB.entities[entityName];

  // If Supabase not configured, return graceful no-op entity (prevents White Screen)
  if (!supaEntity) {
    console.warn(`[CalmPlan] Entity "${entityName}" — Supabase not configured, returning empty data`);
    return {
      async list() { return []; },
      async create(data) { return { id: `offline_${Date.now()}`, ...data }; },
      async update(id, data) { return { id, ...data }; },
      async delete() { return { success: true }; },
      async deleteAll() { return { success: true }; },
      async filter() { return []; },
    };
  }

  return {
    async list(sortField = null, limit = 1000) {
      // Try Supabase — the single source of truth
      const result = await supaEntity.list(sortField, limit);
      if (result && result.length > 0) {
        _cacheToLocal(entityName, result);
        return result;
      }
      // Supabase returned 0 — return empty (trust Supabase)
      return [];
    },

    async create(data) {
      return await supaEntity.create(data);
    },

    async update(id, data) {
      return await supaEntity.update(id, data);
    },

    async delete(id) {
      const result = await supaEntity.delete(id);
      // Also clean localStorage cache
      try { await localEntity.delete(id); } catch { /* ignore */ }
      return result;
    },

    async deleteAll() {
      return await supaEntity.deleteAll();
    },

    async filter(filters, sortField, limit) {
      return await supaEntity.filter(filters, sortField, limit);
    },
  };
}

// Cache Supabase results to localStorage for offline reads
function _cacheToLocal(entityName, items) {
  try {
    const collectionMap = {
      Task: 'tasks', Event: 'events', Client: 'clients', TaskSession: 'task_sessions',
      DaySchedule: 'day_schedules', WeeklyRecommendation: 'weekly_recommendations',
      Dashboard: 'dashboards', AccountReconciliation: 'account_reconciliations',
      Invoice: 'invoices', ServiceProvider: 'service_providers',
      ClientContact: 'client_contacts', ClientServiceProvider: 'client_service_providers',
      ClientAccount: 'client_accounts', ServiceCompany: 'service_companies',
      Lead: 'leads', RoadmapItem: 'roadmap_items', WeeklySchedule: 'weekly_schedules',
      FamilyMember: 'family_members', DailyMoodCheck: 'daily_mood_checks',
      Therapist: 'therapists', TaxReport: 'tax_reports', TaxReport2025: 'tax_reports_2025',
      TaxReport2024: 'tax_reports_2024', WeeklyTask: 'weekly_tasks',
      BalanceSheet: 'balance_sheets', BalanceSheetWorkbook: 'balance_sheet_workbooks',
      StickyNote: 'sticky_notes', Project: 'projects',
      SystemConfig: 'system_config', PeriodicReport: 'periodic_reports',
      FileMetadata: 'file_metadata',
      ServiceCatalog: 'service_catalog',
      UserPreferences: 'user_preferences',
      MealPlan: 'meal_plans',
      InspirationItem: 'inspiration_items',
      InventoryItem: 'inventory_items',
      Treatment: 'treatments',
    };
    const collName = collectionMap[entityName];
    if (collName) {
      localStorage.setItem('calmplan_' + collName, JSON.stringify(items));
    }
  } catch { /* localStorage full or unavailable */ }
}

// Build entities for all collections
const entities = {};
for (const name of Object.keys(primary.entities)) {
  entities[name] = createEntity(name);
}

// ── CRITICAL: Register IMMEDIATELY after building, before any export ──
// This must happen before `base44` export so that any module importing
// from entities.js can read from the registry as soon as this module finishes.
_registry.entities = entities;
_registry.auth = primary.auth;

// ── Cloud Sync Status ────────────────────────────────────────────
export const syncStatus = {
  isCloud: isSupabaseConfigured,
  source: isSupabaseConfigured ? 'supabase' : 'NOT_CONFIGURED',
  connectionTested: false,
  connectionOk: false,
  connectionError: null,
  get rlsBlocked() { return isRlsBlocked(); },
};

// Test connection on startup (non-blocking)
if (isSupabaseConfigured) {
  testSupabaseConnection().then((result) => {
    syncStatus.connectionTested = true;
    syncStatus.connectionOk = result.ok;
    syncStatus.connectionError = result.error || null;
    if (result.ok) {
      console.log('[CalmPlan] ✅ Supabase connection verified');
    } else {
      console.error(`[CalmPlan] ❌ Supabase connection failed: ${result.error}`);
    }
  });
}

// ── Realtime Subscriptions (cloud sync between devices) ──────────
const realtimeCallbacks = new Set();

export function onDataChange(callback) {
  realtimeCallbacks.add(callback);
  return () => realtimeCallbacks.delete(callback);
}

function notifyDataChange(payload) {
  for (const cb of realtimeCallbacks) {
    try { cb(payload); } catch { /* ignore */ }
  }
}

let realtimeChannel = null;

export function startRealtimeSync() {
  if (!isSupabaseConfigured || !supabase || realtimeChannel) return;

  realtimeChannel = supabase
    .channel('app_data_changes')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'app_data' },
      (payload) => {
        notifyDataChange({
          type: payload.eventType,
          collection: payload.new?.collection || payload.old?.collection,
          record: payload.new || payload.old,
        });
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[CalmPlan] Realtime sync active');
      }
    });
}

export function stopRealtimeSync() {
  if (realtimeChannel && supabase) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
}

if (isSupabaseConfigured) {
  startRealtimeSync();
}

export const base44 = {
  entities,
  auth: primary.auth,
  functions: {},
  integrations: { Core: {} }
};

/** Runtime diagnostic: what data source is active? */
export function getDataSourceInfo() {
  return {
    source: isSupabaseConfigured ? 'supabase' : 'NOT_CONFIGURED',
    supabaseConfigured: isSupabaseConfigured,
    rlsBlocked: isRlsBlocked(),
    supabaseUrl: isSupabaseConfigured
      ? (import.meta.env.VITE_SUPABASE_URL || '').substring(0, 40) + '...'
      : null,
  };
}

export const exportAllData = primary.exportAllData;
export const importAllData = primary.importAllData;
export const clearAllData = primary.clearAllData;
