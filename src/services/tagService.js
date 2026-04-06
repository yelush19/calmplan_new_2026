/**
 * Tag Service — Structured tags for cross-cutting entity labeling
 *
 * Stores tags in calmplan_system_config with config_key = 'system_tags'.
 * Uses localStorage as cache and syncs to Supabase DB.
 * Broadcasts changes via custom event 'calmplan:tags-changed'.
 */

// ============================================================
// DB ACCESS — Direct Supabase on calmplan_system_config table
// ============================================================

const TABLE = 'calmplan_system_config';
const CONFIG_KEY = 'system_tags';
const LS_KEY = 'calmplan_system_tags';

export const TAGS_CHANGED_EVENT = 'calmplan:tags-changed';

export const TAG_SCOPES = [
  { key: 'task', label: 'משימה' },
  { key: 'client', label: 'לקוח' },
  { key: 'reconciliation', label: 'התאמה' },
  { key: 'balance', label: 'מאזן' },
  { key: 'file', label: 'קובץ' },
  { key: 'invoice', label: 'חשבונית' },
  { key: 'lead', label: 'ליד' },
];

export const TAG_COLORS = [
  '#EF4444', // red
  '#F97316', // orange
  '#F59E0B', // amber
  '#EAB308', // yellow
  '#84CC16', // lime
  '#22C55E', // green
  '#14B8A6', // teal
  '#06B6D4', // cyan
  '#3B82F6', // blue
  '#6366F1', // indigo
  '#A855F7', // purple
  '#7C3AED', // violet
];

/**
 * Default suggested tags — seeded on first load
 */
export const DEFAULT_TAGS = [
  // task
  { id: 'tag_task_urgent', name: 'דחוף', color: '#EF4444', scope: ['task'] },
  { id: 'tag_task_blocker', name: 'חוסם אחרים', color: '#F97316', scope: ['task'] },
  { id: 'tag_task_pending', name: 'ממתין לבירור', color: '#F59E0B', scope: ['task'] },
  // client
  { id: 'tag_client_vip', name: 'VIP', color: '#6366F1', scope: ['client'] },
  { id: 'tag_client_new', name: 'חדש', color: '#22C55E', scope: ['client'] },
  { id: 'tag_client_problem', name: 'בעייתי', color: '#EF4444', scope: ['client'] },
  // reconciliation
  { id: 'tag_recon_client', name: 'בירור מול לקוח', color: '#3B82F6', scope: ['reconciliation'] },
  { id: 'tag_recon_bank', name: 'ממתין לבנק', color: '#F59E0B', scope: ['reconciliation'] },
  { id: 'tag_recon_anomaly', name: 'חריגה', color: '#EF4444', scope: ['reconciliation'] },
  // balance
  { id: 'tag_bal_accountant', name: 'שאלת רו"ח', color: '#A855F7', scope: ['balance'] },
  { id: 'tag_bal_sign', name: 'ממתין לחתימה', color: '#F97316', scope: ['balance'] },
  { id: 'tag_bal_draft', name: 'טיוטה', color: '#06B6D4', scope: ['balance'] },
  // invoice
  { id: 'tag_inv_reminder', name: 'תזכורת שנייה', color: '#F59E0B', scope: ['invoice'] },
  { id: 'tag_inv_promised', name: 'הבטיח תשלום', color: '#22C55E', scope: ['invoice'] },
  { id: 'tag_inv_missing', name: 'חשבונית חסרה', color: '#EF4444', scope: ['invoice'] },
  // file
  { id: 'tag_file_confidential', name: 'חסוי', color: '#EF4444', scope: ['file'] },
  { id: 'tag_file_audit', name: 'נחוץ לביקורת', color: '#3B82F6', scope: ['file'] },
  // lead
  { id: 'tag_lead_referral', name: 'המלצה', color: '#22C55E', scope: ['lead'] },
  { id: 'tag_lead_realestate', name: 'נדל"ן', color: '#14B8A6', scope: ['lead'] },
  { id: 'tag_lead_hitech', name: 'היי-טק', color: '#6366F1', scope: ['lead'] },
];

// ============================================================
// Supabase lazy import
// ============================================================

let _supabase = null;
async function getSupabase() {
  if (!_supabase) {
    const { supabase, isSupabaseAvailable } = await import('@/api/supabaseClient');
    if (!isSupabaseAvailable()) {
      console.warn('[TagService] Supabase not available — using localStorage only');
      return null;
    }
    _supabase = supabase;
  }
  return _supabase;
}

// ============================================================
// localStorage helpers
// ============================================================

function readCache() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('[TagService] Failed to read localStorage cache:', e.message);
  }
  return null;
}

function writeCache(tags) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(tags));
  } catch (e) {
    console.warn('[TagService] Failed to write localStorage cache:', e.message);
  }
}

// ============================================================
// DB helpers (mirror processTreeService pattern)
// ============================================================

async function loadTagsFromDb() {
  const supabase = await getSupabase();
  if (!supabase) return null;
  try {
    const { data: rows, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('config_key', CONFIG_KEY)
      .limit(1);
    if (error) throw error;
    if (rows && rows.length > 0) {
      return rows[0].data ?? rows[0].config_value ?? null;
    }
    return null;
  } catch (err) {
    console.warn('[TagService] Failed to load tags from DB:', err.message);
    return null;
  }
}

async function syncTagsToDb(tags) {
  const supabase = await getSupabase();
  if (!supabase) return;
  try {
    const now = new Date().toISOString();
    const { data: rows } = await supabase
      .from(TABLE)
      .select('id')
      .eq('config_key', CONFIG_KEY)
      .limit(1);
    if (rows && rows.length > 0) {
      const { error } = await supabase.from(TABLE)
        .update({ data: tags, updated_date: now })
        .eq('id', rows[0].id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from(TABLE)
        .insert({ id: crypto.randomUUID(), config_key: CONFIG_KEY, data: tags, created_date: now, updated_date: now });
      if (error) throw error;
    }
    console.log('[TagService] Tags synced to DB');
  } catch (err) {
    console.warn('[TagService] Failed to sync tags to DB:', err.message);
  }
}

// ============================================================
// Broadcast
// ============================================================

function broadcastChange(tags) {
  window.dispatchEvent(new CustomEvent(TAGS_CHANGED_EVENT, { detail: { tags } }));
}

// ============================================================
// Public API
// ============================================================

/**
 * Load all tags. Reads from localStorage cache first, then DB.
 * Seeds defaults if nothing found anywhere.
 * @returns {Promise<Array>} array of tag objects
 */
export async function loadTags() {
  // 1. Try localStorage cache
  let tags = readCache();
  if (tags && tags.length > 0) return tags;

  // 2. Try DB
  tags = await loadTagsFromDb();
  if (tags && tags.length > 0) {
    writeCache(tags);
    return tags;
  }

  // 3. Seed defaults
  tags = [...DEFAULT_TAGS];
  writeCache(tags);
  await syncTagsToDb(tags);
  console.log('[TagService] Seeded default tags');
  return tags;
}

/**
 * Save (create or update) a single tag.
 * @param {object} tag - { id?, name, color, scope[] }
 * @returns {Promise<Array>} updated tags array
 */
export async function saveTag(tag) {
  let tags = await loadTags();
  const idx = tags.findIndex(t => t.id === tag.id);
  if (idx >= 0) {
    tags[idx] = { ...tags[idx], ...tag };
  } else {
    tags.push({
      ...tag,
      id: tag.id || `tag_${crypto.randomUUID().slice(0, 8)}`,
    });
  }
  writeCache(tags);
  await syncTagsToDb(tags);
  broadcastChange(tags);
  return tags;
}

/**
 * Delete a tag by ID.
 * @param {string} id
 * @returns {Promise<Array>} updated tags array
 */
export async function deleteTag(id) {
  let tags = await loadTags();
  tags = tags.filter(t => t.id !== id);
  writeCache(tags);
  await syncTagsToDb(tags);
  broadcastChange(tags);
  return tags;
}

/**
 * Save the entire tags array at once (for bulk operations).
 * @param {Array} tags
 * @returns {Promise<Array>}
 */
export async function saveAllTags(tags) {
  writeCache(tags);
  await syncTagsToDb(tags);
  broadcastChange(tags);
  return tags;
}

/**
 * Get tags filtered by a specific scope.
 * @param {string} scope - e.g. 'task', 'client'
 * @returns {Promise<Array>}
 */
export async function getTagsByScope(scope) {
  const tags = await loadTags();
  return tags.filter(t => t.scope && t.scope.includes(scope));
}
