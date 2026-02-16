// Smart data layer - uses Supabase if configured, falls back to localStorage
import { isSupabaseConfigured } from './supabaseClient';
import * as localDB from './localDB';
import * as supabaseDB from './supabaseDB';

const source = isSupabaseConfigured ? supabaseDB : localDB;

if (isSupabaseConfigured) {
  console.log('✅ Connected to Supabase');
} else {
  console.warn('⚠️ Supabase not configured - using localStorage. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env');
}

export const base44 = {
  entities: source.entities,
  auth: source.auth,
  functions: {},
  integrations: { Core: {} }
};

export const exportAllData = source.exportAllData;
export const importAllData = source.importAllData;
