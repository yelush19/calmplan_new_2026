// Theme constants for the MindMap "External Brain" cockpit
// Centralizes all category gradients, status colors, board definitions, and complexity tiers

export const CATEGORY_GRADIENTS = {
  payroll: { from: '#a855f7', to: '#ec4899', label: 'שכר' },
  vat_tax: { from: '#06b6d4', to: '#1e3a8a', label: 'מע"מ ומס' },
  annual_reports: { from: '#10b981', to: '#059669', label: 'מאזנים' },
  balance_sheets: { from: '#14b8a6', to: '#0d9488', label: 'דוחות כספיים' },
  reconciliation: { from: '#f97316', to: '#f59e0b', label: 'התאמות' },
  bookkeeping: { from: '#8b5cf6', to: '#6366f1', label: 'הנה"ח' },
  additional_services: { from: '#3b82f6', to: '#0ea5e9', label: 'שירותים נוספים' },
  consulting: { from: '#64748b', to: '#475569', label: 'ייעוץ' },
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
// alwaysVisible: true means the branch shows even if no client subscribes
export const BOARD_CATEGORIES = [
  {
    id: 'payroll',
    label: 'שכר',
    serviceTypes: ['payroll'],
    taskCategories: ['work_payroll', 'work_deductions', 'work_social_security'],
    gradient: CATEGORY_GRADIENTS.payroll,
  },
  {
    id: 'vat_tax',
    label: 'מע"מ ומס',
    serviceTypes: ['vat_reporting', 'tax_advances'],
    taskCategories: ['work_vat_reporting', 'work_tax_advances'],
    gradient: CATEGORY_GRADIENTS.vat_tax,
  },
  {
    id: 'annual_reports',
    label: 'מאזנים',
    serviceTypes: ['annual_reports'],
    taskCategories: ['work_annual_reports'],
    gradient: CATEGORY_GRADIENTS.annual_reports,
  },
  {
    id: 'balance_sheets',
    label: 'דוחות כספיים',
    serviceTypes: ['balance_sheets', 'financial_reports'],
    taskCategories: ['work_balance_sheets', 'work_financial_reports'],
    alwaysVisible: true,
    gradient: CATEGORY_GRADIENTS.balance_sheets,
  },
  {
    id: 'reconciliation',
    label: 'התאמות',
    serviceTypes: ['reconciliation'],
    taskCategories: [],
    usesReconciliationEntity: true,
    gradient: CATEGORY_GRADIENTS.reconciliation,
  },
  {
    id: 'bookkeeping',
    label: 'הנה"ח',
    serviceTypes: ['bookkeeping'],
    taskCategories: ['work_bookkeeping'],
    gradient: CATEGORY_GRADIENTS.bookkeeping,
  },
  {
    id: 'additional_services',
    label: 'שירותים נוספים',
    serviceTypes: ['additional_services', 'extra_services', 'other'],
    taskCategories: ['work_additional', 'work_extra', 'work_other'],
    alwaysVisible: true,
    gradient: CATEGORY_GRADIENTS.additional_services,
  },
  {
    id: 'consulting',
    label: 'ייעוץ',
    serviceTypes: ['consulting'],
    taskCategories: [],
    gradient: CATEGORY_GRADIENTS.consulting,
  },
];

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
