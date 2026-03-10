/**
 * Shared Hebrew category label resolver — "Hebrew First" DNA Law
 *
 * Resolves English keys, custom_XXXX IDs, and unknown categories
 * to their proper Hebrew labels using:
 *   1. Static translation map
 *   2. ALL_SERVICES from processTemplates
 *   3. Custom categories from localStorage
 */

import { ALL_SERVICES } from '@/config/processTemplates';

const CATEGORY_TRANSLATIONS = {
  // Work categories
  work_payroll: 'שכר',
  work_vat_reporting: 'מע"מ',
  work_vat_874: 'מע"מ 874',
  work_tax_advances: 'מקדמות מס',
  work_deductions: 'ניכויים',
  work_social_security: 'ביטוח לאומי',
  work_authorities: 'רשויות',
  work_client_management: 'ניהול לקוח',
  work_reconciliation: 'התאמות חשבונות',
  work_bookkeeping: 'הנהלת חשבונות',
  work_admin: 'אדמיניסטרציה',
  work_annual_reports: 'דוח שנתי',
  work_general: 'כללי',
  work_consulting: 'ייעוץ',
  work_meeting: 'פגישה',
  work_callback: 'לחזור ללקוח',
  work_marketing: 'מעקב שיווק',
  work_masav: 'מס"ב עובדים',
  work_masav_social: 'מס"ב סוציאליות',
  work_masav_authorities: 'מס"ב רשויות',
  work_masav_suppliers: 'מס"ב ספקים',
  work_operator_reporting: 'דיווח למתפעל',
  work_taml_reporting: 'דיווח לטמל',
  work_payslip_sending: 'משלוח תלושים',
  work_authorities_payment: 'תשלום רשויות',
  work_reserve_claims: 'תביעות מילואים',
  work_social_benefits: 'הנחיות מס"ב ממתפעל',
  work_income_collection: 'קליטת הכנסות',
  work_expense_collection: 'קליטת הוצאות',
  work_capital_statement: 'הצהרת הון',
  work_update_reports_folder: 'עדכון דוחות בתיקייה',

  // Home categories
  home_cleaning_kitchen: 'ניקיון מטבח',
  home_cleaning_livingroom: 'ניקיון סלון',
  home_cleaning_bathrooms: 'שירותים ומקלחות',
  home_cleaning_bedrooms: 'חדרי שינה',
  home_cleaning_general: 'ניקיון כללי',
  home_laundry: 'כביסה',
  home_food_planning: 'תכנון תפריט',
  home_shopping: 'קניות',
  home_garden_watering: 'השקיה',
  home_garden_maintenance: 'תחזוקת גינה',
  home_garden_pest_control: 'הדברה',
  home_garden_fertilizing: 'הזנה',
  home_family_time: 'זמן משפחה',
  home_personal_time: 'זמן אישי',
  home_exercise: 'פעילות גופנית',
  home_health: 'בריאות',
  home_weekend_nap: 'מנוחת סוף שבוע',
  home_errands: 'סידורים',
  home_maintenance: 'תחזוקת הבית',
  home_meals: 'ארוחות',
  home_morning: 'שגרת בוקר',
  home_evening: 'שגרת ערב',

  // Generic
  personal: 'אישי',
  home: 'בית',
};

/**
 * Resolve any category key to its Hebrew display label.
 * Supports: static translations, ALL_SERVICES lookup, custom_ categories from localStorage.
 */
export function resolveCategoryLabel(category) {
  if (!category) return '';

  // 1. Static translation
  if (CATEGORY_TRANSLATIONS[category]) return CATEGORY_TRANSLATIONS[category];

  // 2. ALL_SERVICES — check both key and taskCategories
  const svc = ALL_SERVICES[category];
  if (svc?.label) return svc.label;

  // 3. Check if category is already a Hebrew label in ALL_SERVICES taskCategories
  for (const service of Object.values(ALL_SERVICES)) {
    if (service.taskCategories?.includes(category)) return service.label;
  }

  // 4. Custom categories from localStorage
  if (category.startsWith('custom_')) {
    try {
      const customCats = JSON.parse(localStorage.getItem('calmplan_custom_categories') || '{}');
      for (const cats of Object.values(customCats)) {
        const found = (cats || []).find(c => c.key === category);
        if (found) return found.label;
      }
    } catch { /* ignore */ }
  }

  // 5. Return as-is (already Hebrew or unknown)
  return category;
}

/**
 * Shorthand alias for getCategoryLabel used in dashboards
 */
export const getCategoryLabel = resolveCategoryLabel;
