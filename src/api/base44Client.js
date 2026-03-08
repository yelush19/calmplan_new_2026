// Smart data layer - uses Supabase if configured, falls back to localStorage
// ══ RLS AUTO-DETECT: If Supabase has rows but reads return 0, switch to localStorage ══
import { isSupabaseConfigured, supabase, testSupabaseConnection } from './supabaseClient';
import * as localDB from './localDB';
import * as supabaseDB from './supabaseDB';
// supabaseDB exports rlsBlocked flag — probeRls() sets it on module load

const primary = isSupabaseConfigured ? supabaseDB : localDB;
console.log(`[CalmPlan] DATA SOURCE: ${isSupabaseConfigured ? 'SUPABASE (cloud)' : 'localStorage (local)'}`);

function isRlsBlocked() {
  return isSupabaseConfigured && supabaseDB.rlsBlocked;
}

// ── Hybrid entities: Supabase → localStorage fallback ──
// When RLS blocks Supabase, transparently serve data from localStorage.
function createHybridEntity(entityName) {
  const supaEntity = isSupabaseConfigured ? primary.entities[entityName] : null;
  const localEntity = localDB.entities[entityName];

  // If no Supabase, just use localStorage directly
  if (!supaEntity) return localEntity;

  // Track if we already logged the fallback for this entity (don't spam)
  let loggedFallback = false;

  return {
    async list(sortField = null, limit = 1000) {
      // If RLS is known to be blocked, go straight to localStorage
      if (isRlsBlocked()) {
        if (!loggedFallback) {
          loggedFallback = true;
          console.log(`[Hybrid] ${entityName}: RLS blocked, using localStorage`);
        }
        try { return await localEntity.list(sortField, limit); } catch { return []; }
      }

      // Try Supabase first
      try {
        const result = await supaEntity.list(sortField, limit);
        if (result && result.length > 0) {
          // Supabase returned data — cache to localStorage and return
          _cacheToLocal(entityName, result);
          return result;
        }
        // Supabase returned 0 rows — check localStorage before assuming empty.
        // RLS might be silently blocking even if rlsBlocked flag isn't set yet.
        try {
          const localResult = await localEntity.list(sortField, limit);
          if (localResult && localResult.length > 0) {
            // localStorage has data that Supabase doesn't show — possible RLS issue
            if (!loggedFallback) {
              loggedFallback = true;
              console.warn(`[Hybrid] ${entityName}: Supabase returned 0 but localStorage has ${localResult.length} items — possible RLS block`);
            }
            return localResult;
          }
        } catch { /* ignore */ }
        // Both empty — genuinely no data
        return [];
      } catch { /* fall through to localStorage only on network/connection error */ }

      // Supabase network error — try localStorage fallback (log once only)
      if (!loggedFallback) {
        loggedFallback = true;
        console.log(`[Hybrid] ${entityName}: Supabase unreachable, using localStorage fallback`);
      }
      try {
        const fallbackResult = await localEntity.list(sortField, limit);
        if (fallbackResult && fallbackResult.length > 0) return fallbackResult;
      } catch { /* ignore */ }
      return [];
    },

    async create(data) {
      // Write to both if possible
      if (!isRlsBlocked()) {
        try { const r = await supaEntity.create(data); _cacheItemToLocal(entityName, r); return r; } catch { /* fall through */ }
      }
      return localEntity.create(data);
    },

    async update(id, data) {
      if (!isRlsBlocked()) {
        try { return await supaEntity.update(id, data); } catch { /* fall through */ }
      }
      return localEntity.update(id, data);
    },

    async delete(id) {
      // Delete from BOTH layers to prevent ghost resurrection
      if (!isRlsBlocked()) {
        try { await supaEntity.delete(id); } catch { /* fall through */ }
      }
      try { await localEntity.delete(id); } catch { /* ignore */ }
      return { success: true };
    },

    async deleteAll() {
      // CRITICAL: Always clear BOTH layers to prevent ghost data resurrection
      // (localStorage cache can refill Supabase or vice versa)
      const results = [];
      if (!isRlsBlocked()) {
        try { results.push(await supaEntity.deleteAll()); } catch { /* fall through */ }
      }
      try { results.push(await localEntity.deleteAll()); } catch { /* ignore */ }
      return results[0] || { success: true };
    },

    async filter(filters, sortField, limit) {
      if (isRlsBlocked()) {
        try { return await localEntity.filter(filters, sortField, limit); } catch { return []; }
      }

      try {
        const result = await supaEntity.filter(filters, sortField, limit);
        if (result && result.length > 0) return result;
      } catch { /* fall through */ }

      try {
        const fallbackResult = await localEntity.filter(filters, sortField, limit);
        if (fallbackResult && fallbackResult.length > 0) return fallbackResult;
      } catch { /* ignore */ }
      return [];
    },
  };
}

// Cache Supabase results to localStorage for offline resilience
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
      BalanceSheet: 'balance_sheets', StickyNote: 'sticky_notes', Project: 'projects',
      SystemConfig: 'system_config', PeriodicReport: 'periodic_reports',
      FileMetadata: 'file_metadata',
      ServiceCatalog: 'service_catalog',
    };
    const collName = collectionMap[entityName];
    if (collName) {
      // Sync localStorage with Supabase truth — including empty (0 tasks)
      localStorage.setItem('calmplan_' + collName, JSON.stringify(items));
    }
  } catch { /* localStorage full or unavailable */ }
}

function _cacheItemToLocal(entityName, item) {
  // Individual item caching not implemented — full cache happens on list()
}

// Build hybrid entities for all collections
const hybridEntities = {};
for (const name of Object.keys(primary.entities)) {
  hybridEntities[name] = createHybridEntity(name);
}

// ── Cloud Sync Status ────────────────────────────────────────────
export const syncStatus = {
  isCloud: isSupabaseConfigured,
  source: isSupabaseConfigured ? 'supabase' : 'localStorage',
  connectionTested: false,
  connectionOk: false,
  connectionError: null,
  get rlsBlocked() { return rlsBlocked; },
};

// Warn loudly when running in local-only mode
if (!isSupabaseConfigured) {
  console.warn(
    '[CalmPlan] ⚠️ Running in LOCAL-ONLY mode. Data will NOT sync between devices.\n' +
    'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file to enable cloud sync.'
  );
}

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
      console.warn('[CalmPlan] Data will still be read from localStorage cache if available');
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

// Subscribe to Supabase Realtime for instant cross-device sync
let realtimeChannel = null;

export function startRealtimeSync() {
  if (!isSupabaseConfigured || !supabase || realtimeChannel) return;

  realtimeChannel = supabase
    .channel('app_data_changes')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'app_data' },
      (payload) => {
        notifyDataChange({
          type: payload.eventType, // INSERT, UPDATE, DELETE
          collection: payload.new?.collection || payload.old?.collection,
          record: payload.new || payload.old,
        });
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[CalmPlan] Realtime sync active - changes will appear across devices');
      }
    });
}

export function stopRealtimeSync() {
  if (realtimeChannel && supabase) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
}

// Auto-start realtime sync when using cloud
if (isSupabaseConfigured) {
  startRealtimeSync();
}

export const base44 = {
  entities: hybridEntities,
  auth: primary.auth,
  functions: {},
  integrations: { Core: {} }
};

/** Runtime diagnostic: what data source is active? */
export function getDataSourceInfo() {
  return {
    source: isSupabaseConfigured ? 'supabase' : 'localStorage',
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
