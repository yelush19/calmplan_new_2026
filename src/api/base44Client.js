// Smart data layer - uses Supabase if configured, falls back to localStorage
import { isSupabaseConfigured } from './supabaseClient';
import * as localDB from './localDB';
import * as supabaseDB from './supabaseDB';

const source = isSupabaseConfigured ? supabaseDB : localDB;

// Data source info available via: isSupabaseConfigured ? 'supabase' : 'localStorage'

export const base44 = {
  entities: source.entities,
  auth: source.auth,
  functions: {},
  integrations: { Core: {} }
};

export const exportAllData = source.exportAllData;
export const importAllData = source.importAllData;
export const clearAllData = source.clearAllData;
