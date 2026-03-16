// Theme constants for the MindMap "External Brain" cockpit
// Centralizes all category gradients, status colors, board definitions, and complexity tiers

export const CATEGORY_GRADIENTS = {
  // P1 — Payroll
  payroll: { from: '#00A3E0', to: '#0077B6', label: 'שכר', branch: 'P1' },
  // P2 — Bookkeeping
  vat_tax: { from: '#4682B4', to: '#1e3a8a', label: 'מע"מ ומס', branch: 'P2' },
  reconciliation: { from: '#f97316', to: '#f59e0b', label: 'התאמות', branch: 'P2' },
  bookkeeping: { from: '#8b5cf6', to: '#6366f1', label: 'הנה"ח', branch: 'P2' },
  additional_services: { from: '#4682B4', to: '#3B5998', label: 'שירותים נוספים', branch: 'P2' },
  consulting: { from: '#64748b', to: '#475569', label: 'ייעוץ', branch: 'P2' },
  // P4 — Home/Personal
  home_personal: { from: '#FACC15', to: '#EAB308', label: 'בית / אישי', branch: 'P4' },
  meals: { from: '#FFB74D', to: '#FFA726', label: 'ארוחות', branch: 'P4' },
  routines: { from: '#FFD54F', to: '#FFCA28', label: 'שגרות', branch: 'P4' },
  // P5 — Annual Reports
  annual_reports: { from: '#2E7D32', to: '#1B5E20', label: 'דוחות שנתיים', branch: 'P5' },
  personal_reports: { from: '#388E3C', to: '#2E7D32', label: 'דוחות אישיים', branch: 'P5' },
  balance_sheets: { from: '#6D8B74', to: '#4A6741', label: 'דוחות כספיים', branch: 'P5' },
};

// 5 Golden Status visual treatments
export const STATUS_STYLES = {
  waiting_for_materials:  { color: '#f59e0b', glowIntensity: 0.3, animation: 'calm-pulse', label: 'ממתין לחומרים' },
  not_started:            { color: '#94a3b8', glowIntensity: 0,   animation: null,         label: 'לבצע' },
  sent_for_review:        { color: '#a855f7', glowIntensity: 0.5, animation: null,         label: 'הועבר לעיון' },
  needs_corrections:      { color: '#f97316', glowIntensity: 0.7, animation: 'glow-pulse', label: 'לבצע תיקונים' },
  production_completed:   { color: '#22c55e', glowIntensity: 0.2, animation: null,         label: 'הושלם ייצור' },
};

// Status priority for worst-status-wins aggregation (higher = worse)
export const STATUS_PRIORITY = {
  production_completed:   0,
  not_started:            1,
  sent_for_review:        2,
  needs_corrections:      3,
  waiting_for_materials:  4,
};

// Board category definitions for MindMap ring-1 nodes
// Organized by 5-Pillar hierarchy (Law 1)
// alwaysVisible: true means the branch shows even if no client subscribes
export const BOARD_CATEGORIES = [
  // ── P1 | שכר (Payroll) ──
  {
    id: 'payroll',
    label: 'שכר',
    branch: 'P1',
    serviceTypes: ['payroll'],
    taskCategories: ['work_payroll', 'work_deductions', 'work_social_security'],
    gradient: CATEGORY_GRADIENTS.payroll,
  },
  // ── P2 | הנהלת חשבונות (Bookkeeping) ──
  {
    id: 'vat_tax',
    label: 'מע"מ ומס',
    branch: 'P2',
    serviceTypes: ['vat_reporting', 'tax_advances'],
    taskCategories: ['work_vat_reporting', 'work_tax_advances'],
    gradient: CATEGORY_GRADIENTS.vat_tax,
  },
  {
    id: 'reconciliation',
    label: 'התאמות',
    branch: 'P2',
    serviceTypes: ['reconciliation'],
    taskCategories: [],
    usesReconciliationEntity: true,
    gradient: CATEGORY_GRADIENTS.reconciliation,
  },
  {
    id: 'bookkeeping',
    label: 'הנה"ח',
    branch: 'P2',
    serviceTypes: ['bookkeeping'],
    taskCategories: ['work_bookkeeping'],
    gradient: CATEGORY_GRADIENTS.bookkeeping,
  },
  {
    id: 'additional_services',
    label: 'שירותים נוספים',
    branch: 'P2',
    serviceTypes: ['additional_services', 'extra_services', 'other'],
    taskCategories: ['work_additional', 'work_extra', 'work_other'],
    alwaysVisible: true,
    gradient: CATEGORY_GRADIENTS.additional_services,
  },
  {
    id: 'consulting',
    label: 'ייעוץ',
    branch: 'P2',
    serviceTypes: ['consulting'],
    taskCategories: [],
    gradient: CATEGORY_GRADIENTS.consulting,
  },
  // ── P4 | בית / אישי (Home/Personal) ──
  {
    id: 'home_personal',
    label: 'בית / אישי',
    branch: 'P4',
    serviceTypes: ['meals', 'routines', 'morning_routine', 'evening_routine', 'personal'],
    taskCategories: ['personal', 'home', 'meals', 'routines'],
    alwaysVisible: true,
    gradient: CATEGORY_GRADIENTS.home_personal,
  },
  // ── P5 | דוחות שנתיים (Annual Reports) ──
  {
    id: 'annual_reports',
    label: 'דוחות שנתיים',
    branch: 'P5',
    serviceTypes: ['annual_reports'],
    taskCategories: ['work_annual_reports', 'work_capital_statement'],
    gradient: CATEGORY_GRADIENTS.annual_reports,
  },
  {
    id: 'balance_sheets',
    label: 'דוחות כספיים',
    branch: 'P5',
    serviceTypes: ['balance_sheets', 'financial_reports'],
    taskCategories: ['work_balance_sheets', 'work_financial_reports'],
    alwaysVisible: true,
    gradient: CATEGORY_GRADIENTS.balance_sheets,
  },
];

// ─── Functional Load Colors (Iron Rule — cognitive load visualization) ──────
// Used by Dashboard Feed, KPI Bar, and MindMap branch coloring
export const LOAD_COLORS = {
  3: { color: '#800000', label: 'מורכב',  bg: 'bg-[#800000]', border: 'border-l-4 border-l-[#800000]', textClass: 'text-[#800000]' },  // בורדו
  2: { color: '#4682B4', label: 'בינוני', bg: 'bg-[#4682B4]', border: 'border-l-4 border-l-[#4682B4]', textClass: 'text-[#4682B4]' },  // טורקיז
  1: { color: '#ADD8E6', label: 'פשוט',  bg: 'bg-[#ADD8E6]', border: 'border-l-4 border-l-[#ADD8E6]', textClass: 'text-[#5B99A8]' },  // תכלת
  0: { color: '#8FBC8F', label: 'ננו',   bg: 'bg-[#8FBC8F]', border: 'border-l-4 border-l-[#8FBC8F]', textClass: 'text-[#5A8A5A]' },  // ירוק מרווה
};

// ─── Production Flow Status Colors (progressive branch coloring) ──────
export const PRODUCTION_FLOW_COLORS = {
  waiting_for_materials: { color: '#FF8F00', progress: 0,    label: 'ממתין לחומרים' },
  not_started:           { color: '#1565C0', progress: 0.1,  label: 'לבצע' },
  in_production:         { color: '#4682B4', progress: 0.5,  label: 'בייצור' },
  sent_for_review:       { color: '#AB47BC', progress: 0.75, label: 'הועבר לעיון' },
  needs_corrections:     { color: '#F97316', progress: 0.6,  label: 'לבצע תיקונים' },
  production_completed:  { color: '#2E7D32', progress: 1.0,  label: 'הושלם ייצור' },
};

// ─── P-Branch Path Colors (hierarchical — from root to leaves) ──────
// Keyed by both canonical and short forms for flexible lookup
export const BRANCH_PATH_COLORS = {
  'P1':                  { color: '#00A3E0', light: '#B3E5FC', label: 'P1 שכר' },
  'P1 שכר':             { color: '#00A3E0', light: '#B3E5FC', label: 'P1 שכר' },
  'P1 חשבות שכר':       { color: '#00A3E0', light: '#B3E5FC', label: 'P1 שכר' },
  'P2':                  { color: '#4682B4', light: '#B2C8DF', label: 'P2 הנה"ח' },
  'P2 הנהלת חשבונות':   { color: '#4682B4', light: '#B2C8DF', label: 'P2 הנה"ח' },
  'P3':                  { color: '#F59E0B', light: '#FDE68A', label: 'P3 ניהול' },
  'P3 ניהול ותכנון':    { color: '#F59E0B', light: '#FDE68A', label: 'P3 ניהול' },
  'P3 ניהול משרד':      { color: '#F59E0B', light: '#FDE68A', label: 'P3 ניהול' },
  'P4':                  { color: '#FACC15', light: '#FEF9C3', label: 'P4 בית' },
  'P4 בית':             { color: '#FACC15', light: '#FEF9C3', label: 'P4 בית' },
  'P4 בית / אישי':     { color: '#FACC15', light: '#FEF9C3', label: 'P4 בית' },
  'P5':                  { color: '#2E7D32', light: '#C8E6C9', label: 'P5 דוחות' },
  'P5 דוחות שנתיים':    { color: '#2E7D32', light: '#C8E6C9', label: 'P5 דוחות' },
};

// Complexity tiers - Enterprise (tier 3) is 3x the size of Nano (tier 0)
export const COMPLEXITY_TIERS = {
  0: { label: 'ננו', icon: '⚡', maxEmployees: 5, maxMinutes: 15, bubbleScale: 0.55 },
  1: { label: 'פשוט', icon: '🟢', maxEmployees: 15, maxMinutes: 30, bubbleScale: 0.85 },
  2: { label: 'בינוני', icon: '🟡', maxEmployees: 50, maxMinutes: 30, bubbleScale: 1.25 },
  3: { label: 'מורכב', icon: '🧗', maxEmployees: Infinity, maxMinutes: 45, bubbleScale: 1.65 },
};

// Get the worst status from an array of status strings
export function getWorstStatus(statuses) {
  if (!statuses || statuses.length === 0) return 'not_started';
  return statuses.reduce((worst, current) => {
    const worstPriority = STATUS_PRIORITY[worst] ?? 1;
    const currentPriority = STATUS_PRIORITY[current] ?? 1;
    return currentPriority > worstPriority ? current : worst;
  }, 'completed');
}

// Determine which category a client primarily belongs to (first service type match)
export function getPrimaryCategoryForClient(client) {
  const serviceTypes = client.service_types || [];
  for (const cat of BOARD_CATEGORIES) {
    if (cat.serviceTypes.some(st => serviceTypes.includes(st))) {
      return cat.id;
    }
  }
  return BOARD_CATEGORIES[0].id; // default to payroll
}

// Get all matching categories for a client
export function getCategoriesForClient(client) {
  const serviceTypes = client.service_types || [];
  return BOARD_CATEGORIES.filter(cat =>
    cat.serviceTypes.some(st => serviceTypes.includes(st))
  ).map(cat => cat.id);
}
