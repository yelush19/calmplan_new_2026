// Smart data layer - uses Supabase if configured, falls back to localStorage
import { isSupabaseConfigured, supabase, testSupabaseConnection } from './supabaseClient';
import * as localDB from './localDB';
import * as supabaseDB from './supabaseDB';

const primary = isSupabaseConfigured ? supabaseDB : localDB;
const fallback = isSupabaseConfigured ? localDB : null;
console.log(`[CalmPlan] DATA SOURCE: ${isSupabaseConfigured ? 'SUPABASE (cloud) + localStorage fallback' : 'localStorage (local)'}`);

// ── Hybrid entities: try primary, fall back to other source if empty ──
function createHybridEntity(entityName) {
  const primaryEntity = primary.entities[entityName];
  const fallbackEntity = fallback?.entities?.[entityName];

  if (!fallbackEntity) return primaryEntity; // No fallback available

  return {
    async list(sortField = null, limit = 1000) {
      try {
        const result = await primaryEntity.list(sortField, limit);
        if (result && result.length > 0) return result;
      } catch (err) {
        console.warn(`[Hybrid] ${entityName}.list primary failed:`, err.message);
      }
      // Primary returned [] or failed — try fallback
      console.warn(`[Hybrid] ${entityName}.list: primary returned 0, trying localStorage fallback`);
      try {
        const fallbackResult = await fallbackEntity.list(sortField, limit);
        if (fallbackResult && fallbackResult.length > 0) {
          console.log(`[Hybrid] ${entityName}: found ${fallbackResult.length} items in localStorage fallback`);
          return fallbackResult;
        }
      } catch { /* ignore */ }
      return [];
    },
    async create(data) { return primaryEntity.create(data); },
    async update(id, data) { return primaryEntity.update(id, data); },
    async delete(id) { return primaryEntity.delete(id); },
    async deleteAll() { return primaryEntity.deleteAll(); },
    async filter(filters, sortField, limit) {
      try {
        const result = await primaryEntity.filter(filters, sortField, limit);
        if (result && result.length > 0) return result;
      } catch (err) {
        console.warn(`[Hybrid] ${entityName}.filter primary failed:`, err.message);
      }
      console.warn(`[Hybrid] ${entityName}.filter: primary returned 0, trying localStorage fallback`);
      try {
        const fallbackResult = await fallbackEntity.filter(filters, sortField, limit);
        if (fallbackResult && fallbackResult.length > 0) return fallbackResult;
      } catch { /* ignore */ }
      return [];
    },
  };
}

// Build hybrid entities for all collections
const hybridEntities = {};
for (const name of Object.keys(primary.entities)) {
  hybridEntities[name] = createHybridEntity(name);
}

const source = { entities: hybridEntities, auth: primary.auth, exportAllData: primary.exportAllData, importAllData: primary.importAllData, clearAllData: primary.clearAllData };

// ── Cloud Sync Status ────────────────────────────────────────────
export const syncStatus = {
  isCloud: isSupabaseConfigured,
  source: isSupabaseConfigured ? 'supabase' : 'localStorage',
  connectionTested: false,
  connectionOk: false,
  connectionError: null,
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

export const exportAllData = primary.exportAllData;
export const importAllData = primary.importAllData;
export const clearAllData = primary.clearAllData;
