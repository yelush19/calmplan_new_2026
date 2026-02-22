// Smart data layer - uses Supabase if configured, falls back to localStorage
import { isSupabaseConfigured, supabase } from './supabaseClient';
import * as localDB from './localDB';
import * as supabaseDB from './supabaseDB';

const source = isSupabaseConfigured ? supabaseDB : localDB;

// ── Cloud Sync Status ────────────────────────────────────────────
export const syncStatus = {
  isCloud: isSupabaseConfigured,
  source: isSupabaseConfigured ? 'supabase' : 'localStorage',
};

// Warn loudly when running in local-only mode
if (!isSupabaseConfigured) {
  console.warn(
    '[CalmPlan] ⚠️ Running in LOCAL-ONLY mode. Data will NOT sync between devices.\n' +
    'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file to enable cloud sync.'
  );
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
  entities: source.entities,
  auth: source.auth,
  functions: {},
  integrations: { Core: {} }
};

export const exportAllData = source.exportAllData;
export const importAllData = source.importAllData;
export const clearAllData = source.clearAllData;
