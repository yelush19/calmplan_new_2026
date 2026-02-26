import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

// Check that credentials are real (not placeholder values) and URL is valid
const isPlaceholder = (val) =>
  !val ||
  val === 'your-anon-key' ||
  val === 'your-project.supabase.co' ||
  val.includes('your-project') ||
  val.includes('your-anon');

const isValidUrl = (val) => {
  try {
    const u = new URL(val);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};

export const isSupabaseConfigured = !!(
  supabaseUrl &&
  supabaseAnonKey &&
  !isPlaceholder(supabaseUrl) &&
  !isPlaceholder(supabaseAnonKey) &&
  isValidUrl(supabaseUrl)
);

// Debug: log config state on load (helps diagnose Vercel env issues)
console.log('[CalmPlan] Supabase config:', {
  configured: isSupabaseConfigured,
  hasUrl: !!supabaseUrl,
  hasKey: !!supabaseAnonKey,
  urlStart: supabaseUrl ? supabaseUrl.substring(0, 25) + '...' : '(empty)',
});

// Safely create client — catch SDK validation errors so the app never crashes
let _supabase = null;
if (isSupabaseConfigured) {
  try {
    _supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          'X-Client-Info': 'calmplan-web',
        },
      },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  } catch (e) {
    console.error('[CalmPlan] Failed to create Supabase client:', e.message);
    console.warn('[CalmPlan] Falling back to localStorage mode.');
    _supabase = null;
  }
}
export const supabase = _supabase;

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
