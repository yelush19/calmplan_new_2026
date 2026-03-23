/**
 * Global reconciliation status configuration
 * Single source of truth — used by: Reconciliations page, ReconciliationForm, ClientAccountsManager
 */

// ─── Reconciliation Process Statuses ────────────────────────────
export const RECONCILIATION_STATUSES = {
  not_started: { label: 'לא התחיל',  icon: 'Clock' },
  in_progress: { label: 'בתהליך',    icon: 'Clock' },
  completed:   { label: 'הושלם',     icon: 'CheckCircle' },
  issues:      { label: 'בעיות',     icon: 'AlertCircle' },
};

// Pill styles for badges / buttons
export const RECONCILIATION_STATUS_PILLS = {
  not_started: 'bg-white text-slate-700 border border-[#E0E0E0]',
  in_progress: 'bg-[#4682B4]/10 text-[#4682B4] border border-[#4682B4]',
  completed:   'bg-teal-100 text-teal-800 border border-teal-200',
  issues:      'bg-amber-100 text-amber-800 border border-amber-200',
};

// AYOA Kanban column colors
export const RECONCILIATION_AYOA_COLORS = {
  not_started: { bg: 'bg-gradient-to-br from-slate-50 to-slate-100', border: 'border-slate-300', header: 'bg-slate-200 text-slate-700', accent: '#94A3B8' },
  in_progress: { bg: 'bg-gradient-to-br from-blue-50 to-indigo-50',  border: 'border-blue-300',  header: 'bg-blue-200 text-blue-800',  accent: '#3B82F6' },
  completed:   { bg: 'bg-gradient-to-br from-emerald-50 to-teal-50', border: 'border-emerald-300', header: 'bg-emerald-200 text-emerald-800', accent: '#10B981' },
  issues:      { bg: 'bg-gradient-to-br from-orange-50 to-red-50',   border: 'border-orange-300', header: 'bg-orange-200 text-orange-800', accent: '#F97316' },
};

// Status cycle for click-to-advance button
export const RECONCILIATION_STATUS_CYCLE = ['not_started', 'in_progress', 'completed'];

// ─── Account-Level Statuses (active/inactive) ───────────────────
export const ACCOUNT_STATUSES = {
  active:    { label: 'פעיל',     badge: 'bg-green-100 text-green-800 border-green-200' },
  inactive:  { label: 'לא פעיל',  badge: 'bg-gray-100 text-gray-600 border-gray-200' },
  in_review: { label: 'בבדיקה',   badge: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  problem:   { label: 'בעיה',     badge: 'bg-amber-100 text-amber-800 border-amber-200' },
};

// ─── Frequency Labels ────────────────────────────────────────────
export const FREQUENCY_LABELS = {
  monthly: 'חודשי', bimonthly: 'דו-חודשי', quarterly: 'רבעוני',
  semi_annual: 'חצי שנתי', yearly: 'שנתי',
};

export const FREQUENCY_MONTHS = {
  monthly: 1, bimonthly: 2, quarterly: 3, semi_annual: 6, yearly: 12,
};
