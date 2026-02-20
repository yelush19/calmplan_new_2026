// Theme constants for the MindMap "External Brain" cockpit
// Centralizes all category gradients, status colors, board definitions, and complexity tiers

export const CATEGORY_GRADIENTS = {
  payroll: { from: '#a855f7', to: '#ec4899', label: 'שכר' },
  vat_tax: { from: '#06b6d4', to: '#1e3a8a', label: 'מע"מ ומס' },
  annual_reports: { from: '#10b981', to: '#059669', label: 'מאזנים' },
  reconciliation: { from: '#f97316', to: '#f59e0b', label: 'התאמות' },
  bookkeeping: { from: '#8b5cf6', to: '#6366f1', label: 'הנה"ח' },
  consulting: { from: '#64748b', to: '#475569', label: 'ייעוץ' },
};

// Status visual treatments
export const STATUS_STYLES = {
  not_started: { color: '#94a3b8', glowIntensity: 0, animation: null, label: 'ממתין' },
  in_progress: { color: '#3b82f6', glowIntensity: 0.6, animation: null, label: 'בעבודה' },
  waiting_for_materials: { color: '#0ea5e9', glowIntensity: 0.3, animation: 'calm-pulse', label: 'ממתין לחומרים' },
  waiting_for_external: { color: '#0ea5e9', glowIntensity: 0.3, animation: 'calm-pulse', label: 'ממתין לגורם חיצוני' },
  waiting_for_approval: { color: '#0ea5e9', glowIntensity: 0.3, animation: 'calm-pulse', label: 'לבדיקה' },
  ready_for_reporting: { color: '#f59e0b', glowIntensity: 0.8, animation: 'glow-pulse', label: 'מוכן לדיווח' },
  reported_waiting_for_payment: { color: '#f59e0b', glowIntensity: 0.5, animation: null, label: 'ממתין לתשלום' },
  completed: { color: '#22c55e', glowIntensity: 0.2, animation: null, label: 'הושלם' },
  issue: { color: '#ef4444', glowIntensity: 0.9, animation: 'glow-pulse', label: 'בעיה' },
  postponed: { color: '#94a3b8', glowIntensity: 0, animation: null, label: 'נדחה' },
};

// Status priority for worst-status-wins aggregation (higher = worse)
export const STATUS_PRIORITY = {
  completed: 0,
  not_started: 1,
  postponed: 1,
  in_progress: 2,
  reported_waiting_for_payment: 3,
  waiting_for_approval: 4,
  waiting_for_materials: 5,
  waiting_for_external: 5,
  ready_for_reporting: 6,
  issue: 7,
};

// Board category definitions for MindMap ring-1 nodes
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
    id: 'consulting',
    label: 'ייעוץ',
    serviceTypes: ['consulting'],
    taskCategories: [],
    gradient: CATEGORY_GRADIENTS.consulting,
  },
];

// Complexity tiers (for Sprint 2, but defined now for type safety)
export const COMPLEXITY_TIERS = {
  0: { label: 'ננו', icon: '⚡', maxEmployees: 5, maxMinutes: 20, bubbleScale: 0.6 },
  1: { label: 'פשוט', icon: '🟢', maxEmployees: 15, maxMinutes: 30, bubbleScale: 1.0 },
  2: { label: 'בינוני', icon: '🟡', maxEmployees: 50, maxMinutes: 45, bubbleScale: 1.4 },
  3: { label: 'מורכב', icon: '🧗', maxEmployees: Infinity, maxMinutes: 45, bubbleScale: 1.8 },
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
