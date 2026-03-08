/**
 * ── resolveItem: Universal Data Field Resolver ──
 *
 * Makes AYOA views DATA-AGNOSTIC. Given any object, it extracts
 * the best available values for label, category, sub-label, status, etc.
 *
 * Field detection order (first non-empty wins):
 *   label:    title → name → label → client_name → accountName → subject
 *   category: category → type → stage → service → dashboard → kind
 *   sub:      client_name → name → clientName → description → period
 *   status:   status → state → phase → pnlStatus → productionStatus
 *   date:     due_date → deadline → date → next_reconciliation_due → created_date
 *   id:       id → _id → key → index (fallback: random)
 */

const LABEL_KEYS   = ['title', 'name', 'label', 'client_name', 'accountName', 'subject'];
const CAT_KEYS     = ['category', 'type', 'stage', 'service', 'dashboard', 'kind'];
const SUB_KEYS     = ['client_name', 'name', 'clientName', 'description', 'period'];
const STATUS_KEYS  = ['status', 'state', 'phase', 'pnlStatus', 'productionStatus'];
const DATE_KEYS    = ['due_date', 'deadline', 'date', 'next_reconciliation_due', 'created_date'];
const ID_KEYS      = ['id', '_id', 'key'];

function pickFirst(obj, keys) {
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && v !== '') return String(v);
  }
  return '';
}

export function resolveItem(item, index = 0) {
  if (!item || typeof item !== 'object') {
    return { id: `item-${index}`, label: '', category: 'כללי', sub: '', status: 'not_started', date: '', raw: item };
  }

  const label = pickFirst(item, LABEL_KEYS);
  const category = pickFirst(item, CAT_KEYS) || 'כללי';

  // For sub-label, skip the field already used for label
  const usedForLabel = LABEL_KEYS.find(k => item[k] && String(item[k]) === label);
  const subKeys = SUB_KEYS.filter(k => k !== usedForLabel);
  const sub = pickFirst(item, subKeys);

  const status = pickFirst(item, STATUS_KEYS) || 'not_started';
  const date = pickFirst(item, DATE_KEYS);
  const id = pickFirst(item, ID_KEYS) || `item-${index}`;

  // Cognitive load: try direct field, then fall back to 0
  const cognitiveLoad = typeof item.cognitive_load === 'number' ? item.cognitive_load : 0;

  return { id, label, category, sub, status, date, cognitiveLoad, raw: item };
}

/**
 * Resolve an entire array of items into normalized objects.
 */
export function resolveItems(items) {
  return (items || []).map((item, i) => resolveItem(item, i));
}
