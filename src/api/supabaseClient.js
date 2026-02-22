import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check that credentials are real (not placeholder values)
const isPlaceholder = (val) =>
  !val ||
  val === 'your-anon-key' ||
  val === 'your-project.supabase.co' ||
  val.includes('your-project') ||
  val.includes('your-anon');

export const isSupabaseConfigured = !!(
  supabaseUrl &&
  supabaseAnonKey &&
  !isPlaceholder(supabaseUrl) &&
  !isPlaceholder(supabaseAnonKey)
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

/**
 * Runtime check: is Supabase client available and configured?
 * Use this in async code paths that need to guard against null client.
 */
export function isSupabaseAvailable() {
  return isSupabaseConfigured && supabase !== null;
}

/**
 * Test actual connectivity to Supabase.
 * Returns { ok: true } or { ok: false, error: string }.
 */
export async function testSupabaseConnection() {
  if (!isSupabaseAvailable()) {
    return { ok: false, error: 'Supabase not configured' };
  }
  try {
    const { error } = await supabase
      .from('app_data')
      .select('id', { count: 'exact', head: true })
      .limit(1);
    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
