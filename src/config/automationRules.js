import { SystemConfig } from '@/api/entities';

const CONFIG_KEY = 'automation_rules';

// All available service type keys (matching ClientForm.jsx)
export const ALL_SERVICES = {
  bookkeeping: 'הנהלת חשבונות',
  bookkeeping_full: 'הנהלת חשבונות מלאה',
  vat_reporting: 'דיווחי מע״מ',
  tax_advances: 'מקדמות מס',
  payroll: 'שכר',
  social_security: 'ביטוח לאומי',
  deductions: 'מ״ה ניכויים',
  masav_employees: 'מס״ב עובדים',
  masav_social: 'מס״ב סוציאליות',
  masav_suppliers: 'מס״ב ספקים',
  authorities_payment: 'תשלום רשויות',
  pnl_reports: 'דוחות רווח והפסד',
  annual_reports: 'מאזנים / דוחות שנתיים',
  reconciliation: 'התאמות חשבונות',
  operator_reporting: 'דיווח למתפעל',
  taml_reporting: 'דיווח לטמל',
  payslip_sending: 'משלוח תלושים',
  reserve_claims: 'תביעות מילואים',
  admin: 'אדמיניסטרציה',
};

export const BUSINESS_TYPES = {
  exempt_dealer: 'עוסק פטור',
  licensed_dealer: 'עוסק מורשה',
  company: 'חברה בע"מ',
  partnership: 'שותפות',
  nonprofit: 'עמותה/מלכ"ר',
  cooperative: 'אגודה שיתופית',
};

export const REPORT_ENTITIES = {
  PeriodicReport: 'דיווחים מרכזים תקופתיים',
  BalanceSheet: 'מאזנים שנתיים',
  AccountReconciliation: 'התאמות חשבונות',
  Task_monthly_reports: 'ריכוז דיווחים חודשיים',
  Task_tax_reports: 'דיווחי מיסים חודשיים',
  Task_payroll: 'שכר ודיווחי רשויות',
};

// Task categories per board (for Task-based boards)
export const TASK_BOARD_CATEGORIES = {
  Task_monthly_reports: [
    { key: 'מע"מ', label: 'מע"מ', service: 'vat_reporting' },
    { key: 'מקדמות מס', label: 'מקדמות מס', service: 'tax_advances' },
    { key: 'שכר', label: 'שכר', service: 'payroll' },
    { key: 'ביטוח לאומי', label: 'ביטוח לאומי', service: 'social_security' },
    { key: 'ניכויים', label: 'ניכויים', service: 'deductions' },
  ],
  Task_tax_reports: [
    { key: 'מע"מ', label: 'מע"מ', service: 'vat_reporting' },
    { key: 'מקדמות מס', label: 'מקדמות מס', service: 'tax_advances' },
  ],
  Task_payroll: [
    { key: 'שכר', label: 'שכר', service: 'payroll' },
    { key: 'ביטוח לאומי', label: 'ביטוח לאומי', service: 'social_security' },
    { key: 'ניכויים', label: 'ניכויים', service: 'deductions' },
  ],
};

// Reconciliation types
export const RECONCILIATION_TYPES = {
  bank_credit: 'בנקים/אשראי',
  internal: 'פנימי',
};

export const PERIODIC_REPORT_TYPES = {
  bituach_leumi_126: 'ביטוח לאומי 126',
  deductions_126_wage: 'ניכויים 126 שכר',
};

export const PERIODIC_REPORT_PERIODS = {
  h1: 'מחצית ראשונה',
  h2: 'מחצית שנייה',
  annual: 'שנתי',
};

// Default rules matching the existing hardcoded automations
export const DEFAULT_RULES = [
  {
    id: 'payroll_auto_link',
    name: 'שכר → ביטוח לאומי + ניכויים',
    description: 'בחירת שכר מוסיפה אוטומטית ביטוח לאומי וניכויים',
    type: 'service_auto_link',
    enabled: true,
    trigger_service: 'payroll',
    auto_add_services: ['social_security', 'deductions'],
    condition: null,
  },
  {
    id: 'bookkeeping_annual',
    name: 'הנהלת חשבונות → דוחות שנתיים',
    description: 'בחירת הנה"ח מוסיפה אוטומטית דוחות שנתיים/מאזנים',
    type: 'service_auto_link',
    enabled: true,
    trigger_service: 'bookkeeping',
    auto_add_services: ['annual_reports'],
    condition: null,
  },
  {
    id: 'bookkeeping_full_annual',
    name: 'הנה"ח מלאה → דוחות שנתיים',
    description: 'בחירת הנה"ח מלאה מוסיפה אוטומטית דוחות שנתיים/מאזנים',
    type: 'service_auto_link',
    enabled: true,
    trigger_service: 'bookkeeping_full',
    auto_add_services: ['annual_reports'],
    condition: null,
  },
  {
    id: 'company_bookkeeping_reconciliation',
    name: 'הנה"ח + חברה → התאמות',
    description: 'אם הלקוח חברה ונבחרה הנה"ח, מוסיפה התאמות חשבונות',
    type: 'service_auto_link',
    enabled: true,
    trigger_service: 'bookkeeping',
    auto_add_services: ['reconciliation'],
    condition: { field: 'business_type', value: 'company' },
  },
  {
    id: 'company_bookkeeping_full_reconciliation',
    name: 'הנה"ח מלאה + חברה → התאמות',
    description: 'אם הלקוח חברה ונבחרה הנה"ח מלאה, מוסיפה התאמות חשבונות',
    type: 'service_auto_link',
    enabled: true,
    trigger_service: 'bookkeeping_full',
    auto_add_services: ['reconciliation'],
    condition: { field: 'business_type', value: 'company' },
  },
  {
    id: 'payroll_periodic_reports',
    name: 'שכר → דיווחים מרכזים 126',
    description: 'שמירת לקוח עם שכר → יצירת שורות דיווח 126 אוטומטית',
    type: 'report_auto_create',
    enabled: true,
    trigger_services: ['payroll', 'deductions', 'social_security'],
    target_entity: 'PeriodicReport',
    report_types: {
      bituach_leumi_126: ['h1', 'h2', 'annual'],
      deductions_126_wage: ['annual'],
    },
  },
  {
    id: 'bookkeeping_balance_sheet',
    name: 'הנה"ח → מאזן שנתי',
    description: 'שמירת לקוח עם הנה"ח → יצירת שורת מאזן אוטומטית',
    type: 'report_auto_create',
    enabled: true,
    trigger_services: ['bookkeeping', 'bookkeeping_full'],
    target_entity: 'BalanceSheet',
    report_types: null,
  },
  {
    id: 'bookkeeping_reconciliation',
    name: 'הנה"ח + חברה → שורות התאמה',
    description: 'שמירת לקוח חברה עם הנה"ח → יצירת שורות התאמות חשבונות',
    type: 'report_auto_create',
    enabled: true,
    trigger_services: ['bookkeeping', 'bookkeeping_full'],
    target_entity: 'AccountReconciliation',
    report_types: null,
    condition: { field: 'business_type', value: 'company' },
  },
  {
    id: 'vat_monthly_task',
    name: 'מע"מ → משימת דיווח חודשי',
    description: 'שמירת לקוח עם מע"מ → יצירת משימת דיווח חודשי',
    type: 'report_auto_create',
    enabled: true,
    trigger_services: ['vat_reporting'],
    target_entity: 'Task_monthly_reports',
    task_categories: ['מע"מ'],
    report_types: null,
  },
  {
    id: 'tax_advances_monthly_task',
    name: 'מקדמות מס → משימת דיווח חודשי',
    description: 'שמירת לקוח עם מקדמות מס → יצירת משימת דיווח חודשי',
    type: 'report_auto_create',
    enabled: true,
    trigger_services: ['tax_advances'],
    target_entity: 'Task_monthly_reports',
    task_categories: ['מקדמות מס'],
    report_types: null,
  },
  {
    id: 'payroll_monthly_task',
    name: 'שכר → משימות דיווח חודשי',
    description: 'שמירת לקוח עם שכר → יצירת משימות שכר, ביט"ל, ניכויים',
    type: 'report_auto_create',
    enabled: true,
    trigger_services: ['payroll', 'social_security', 'deductions'],
    target_entity: 'Task_monthly_reports',
    task_categories: ['שכר', 'ביטוח לאומי', 'ניכויים'],
    report_types: null,
  },
];

// Load rules from SystemConfig (or return defaults)
export async function loadAutomationRules() {
  try {
    const configs = await SystemConfig.list(null, 50);
    const config = configs.find(c => c.config_key === CONFIG_KEY);
    if (config && config.data?.rules) {
      return { rules: config.data.rules, configId: config.id };
    }
    // Initialize with defaults
    const newConfig = await SystemConfig.create({
      config_key: CONFIG_KEY,
      data: { rules: DEFAULT_RULES },
    });
    return { rules: DEFAULT_RULES, configId: newConfig.id };
  } catch (err) {
    console.error('Error loading automation rules:', err);
    return { rules: DEFAULT_RULES, configId: null };
  }
}

// Save rules to SystemConfig
export async function saveAutomationRules(configId, rules) {
  try {
    if (configId) {
      await SystemConfig.update(configId, { data: { rules } });
    } else {
      const newConfig = await SystemConfig.create({
        config_key: CONFIG_KEY,
        data: { rules },
      });
      return newConfig.id;
    }
    return configId;
  } catch (err) {
    console.error('Error saving automation rules:', err);
    throw err;
  }
}

/**
 * Apply service auto-link rules when a service is toggled on.
 * Returns array of services to auto-add.
 */
export function getAutoLinkedServices(rules, triggerService, clientData) {
  if (!rules || !Array.isArray(rules)) return [];

  const businessType = clientData?.business_info?.business_type || clientData?.business_type || '';
  const autoAdd = [];

  for (const rule of rules) {
    if (!rule.enabled || rule.type !== 'service_auto_link') continue;
    if (rule.trigger_service !== triggerService) continue;

    // Check condition
    if (rule.condition) {
      if (rule.condition.field === 'business_type' && businessType !== rule.condition.value) {
        continue;
      }
    }

    autoAdd.push(...(rule.auto_add_services || []));
  }

  return [...new Set(autoAdd)];
}

/**
 * Get report auto-create rules that match the client's services and conditions.
 * Returns matching rules with target entity and config.
 */
export function getReportAutoCreateRules(rules, clientServices, clientData) {
  if (!rules || !Array.isArray(rules) || !clientServices?.length) return [];

  const businessType = clientData?.business_info?.business_type || clientData?.business_type || '';

  return rules.filter(rule => {
    if (!rule.enabled || rule.type !== 'report_auto_create') return false;
    if (!(rule.trigger_services || []).some(s => clientServices.includes(s))) return false;
    // Check condition
    if (rule.condition) {
      if (rule.condition.field === 'business_type' && businessType !== rule.condition.value) {
        return false;
      }
    }
    return true;
  });
}
