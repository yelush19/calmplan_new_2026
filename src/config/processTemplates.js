/**
 * Process Templates Configuration
 *
 * Defines all service categories and their process steps.
 * Each service has a template of steps that can be tracked per task.
 *
 * dashboard: 'tax' | 'payroll' - which dashboard this belongs to
 * taskCategories: array of category keys that map to this service (Hebrew + English)
 * steps: ordered array of process steps with key, label, and optional config
 */

// ============================================================
// TAX-RELATED SERVICES
// ============================================================

export const TAX_SERVICES = {
  vat: {
    key: 'vat',
    label: 'מע"מ',
    dashboard: 'tax',
    taskType: 'authority',  // Authority task → gets דיווח + תשלום sub-tasks
    taskCategories: ['מע"מ', 'work_vat_reporting'],
    createCategory: 'מע"מ',
    steps: [
      { key: 'report_prep',    label: 'הפקת דו"ח',     icon: 'file-text', skippable: true, skipWhen: 'client_manages_vat' },
      { key: 'submission',     label: 'שידור',          icon: 'send' },
      { key: 'payment',        label: 'תשלום',          icon: 'landmark' },
      { key: 'record_report',  label: 'רישום דיווח בהנח"ש', icon: 'book-open' },
      { key: 'record_payment', label: 'רישום תשלום בהנח"ש', icon: 'book-open' },
    ],
  },

  tax_advances: {
    key: 'tax_advances',
    label: 'מקדמות מס הכנסה',
    dashboard: 'tax',
    taskType: 'authority',  // Authority task → gets דיווח + תשלום sub-tasks
    taskCategories: ['מקדמות מס', 'work_tax_advances'],
    createCategory: 'מקדמות מס',
    steps: [
      { key: 'report_prep',   label: 'הפקת דו"ח',     icon: 'file-text' },
      { key: 'submission',    label: 'דיווח',          icon: 'send' },
      { key: 'payment',       label: 'תשלום',          icon: 'landmark' },
      { key: 'record_report',  label: 'רישום דיווח בהנח"ש', icon: 'book-open' },
      { key: 'record_payment', label: 'רישום תשלום בהנח"ש', icon: 'book-open' },
    ],
  },

  vat_874: {
    key: 'vat_874',
    label: 'מע"מ 874',
    dashboard: 'tax',
    taskType: 'authority',
    taskCategories: ['מע"מ 874', 'work_vat_874'],
    createCategory: 'מע"מ 874',
    steps: [
      { key: 'report_prep',    label: 'הפקת דו"ח',          icon: 'file-text' },
      { key: 'submission',     label: 'שידור',               icon: 'send' },
      { key: 'payment',        label: 'תשלום',               icon: 'landmark' },
      { key: 'record_report',  label: 'רישום דיווח בהנח"ש',  icon: 'book-open' },
      { key: 'record_payment', label: 'רישום תשלום בהנח"ש',  icon: 'book-open' },
    ],
  },
};

// ============================================================
// PAYROLL-RELATED SERVICES
// ============================================================

export const PAYROLL_SERVICES = {
  payroll: {
    key: 'payroll',
    label: 'שכר',
    dashboard: 'payroll',
    taskType: 'linear',  // Linear task — no דיווח/תשלום sub-tasks
    taskCategories: ['שכר', 'work_payroll'],
    createCategory: 'שכר',
    // שלבי סגירה (קליטת פקודה, רשויות) = P1_closing בעץ — צומת נפרד
    steps: [
      { key: 'receive_data',            label: 'קבלת נתונים',              icon: 'inbox' },
      { key: 'prepare_payslips',        label: 'הכנת תלושים',              icon: 'file-text' },
      { key: 'proofreading',            label: 'הגהה',                     icon: 'eye' },
    ],
  },

  social_security: {
    key: 'social_security',
    label: 'ביטוח לאומי',
    dashboard: 'payroll',
    taskType: 'authority',  // Authority task → gets דיווח + תשלום sub-tasks
    taskCategories: ['ביטוח לאומי', 'work_social_security'],
    createCategory: 'ביטוח לאומי',
    depends_on_nodes: ['P1_payroll'],  // תלוי בייצור שכר
    steps: [
      { key: 'report_prep',    label: 'הפקת דוח',            icon: 'file-text' },
      { key: 'submission',     label: 'דיווח',                icon: 'send' },
      { key: 'payment',        label: 'תשלום',                icon: 'landmark' },
      { key: 'record_report',  label: 'רישום דיווח בהנח"ש',  icon: 'book-open' },
      { key: 'record_payment', label: 'רישום תשלום בהנח"ש',  icon: 'book-open' },
    ],
  },

  deductions: {
    key: 'deductions',
    label: 'ניכויים',
    dashboard: 'payroll',
    taskType: 'authority',  // Authority task → gets דיווח + תשלום sub-tasks
    taskCategories: ['ניכויים', 'work_deductions'],
    createCategory: 'ניכויים',
    depends_on_nodes: ['P1_payroll'],  // תלוי בייצור שכר
    steps: [
      { key: 'report_prep',    label: 'הפקת דוח',            icon: 'file-text' },
      { key: 'submission',     label: 'דיווח',                icon: 'send' },
      { key: 'payment',        label: 'תשלום',                icon: 'landmark' },
      { key: 'record_report',  label: 'רישום דיווח בהנח"ש',  icon: 'book-open' },
      { key: 'record_payment', label: 'רישום תשלום בהנח"ש',  icon: 'book-open' },
    ],
  },

  // דיווח מילואים לביטוח לאומי — לא שגרתי, נוצר ידנית כשיש עובדים במילואים
  reserve_report: {
    key: 'reserve_report',
    label: 'דיווח מילואים לב"ל',
    dashboard: 'payroll',
    taskType: 'linear',
    taskCategories: ['מילואים', 'work_reserve_claims'],
    createCategory: 'מילואים',
    depends_on_nodes: ['P1_social_security'],
    manual_only: true,  // NOT auto-injected — only created manually per month
    steps: [
      { key: 'collect_data',   label: 'קבלת נתוני מילואים מעובד', icon: 'inbox' },
      { key: 'report_bl',      label: 'דיווח לביטוח לאומי',        icon: 'send' },
    ],
  },
};

// ============================================================
// ADDITIONAL SERVICES (can be added to either dashboard)
// ============================================================

export const ADDITIONAL_SERVICES = {
  bookkeeping: {
    key: 'bookkeeping',
    label: 'הנהלת חשבונות',
    dashboard: 'tax',
    taskCategories: ['הנהלת חשבונות', 'work_bookkeeping'],
    createCategory: 'הנהלת חשבונות',
    steps: [
      { key: 'income_input',   label: 'קליטת הכנסות',  icon: 'download' },
      { key: 'expense_input',  label: 'קליטת הוצאות',  icon: 'download', allowMultiple: true },
    ],
  },

  // V4.0 parent grouping nodes
  bookkeeping_production: {
    key: 'bookkeeping_production',
    label: 'ייצור',
    dashboard: 'tax',
    taskCategories: ['ייצור הנה"ח', 'work_bookkeeping_production'],
    createCategory: 'ייצור הנה"ח',
    steps: [],
  },

  bookkeeping_reporting: {
    key: 'bookkeeping_reporting',
    label: 'דיווחים',
    dashboard: 'tax',
    taskCategories: ['דיווחים', 'work_bookkeeping_reporting'],
    createCategory: 'דיווחים',
    steps: [],
  },

  bookkeeping_closing: {
    key: 'bookkeeping_closing',
    label: 'סגירה',
    dashboard: 'tax',
    taskCategories: ['סגירה', 'work_bookkeeping_closing'],
    createCategory: 'סגירה',
    steps: [],
  },

  payroll_ancillary: {
    key: 'payroll_ancillary',
    label: 'שירותים נלווים לשכר',
    dashboard: 'payroll',
    taskType: 'linear',
    // NOTE: 'קליטה להנה"ח' was previously listed here by mistake. It belongs
    // exclusively to payroll_closing — keeping it here would cause
    // getServiceForTask() to route those tasks to payroll_ancillary first,
    // leaving the קליטה להנה"ח column empty in the workbook view.
    taskCategories: ['שירותים נלווים לשכר', 'work_payroll_ancillary'],
    createCategory: 'שירותים נלווים לשכר',
    steps: [
      { key: 'payslip_sending', label: 'משלוח תלושים',     icon: 'send' },
      { key: 'masav_employees', label: 'מס"ב עובדים',      icon: 'upload' },
      { key: 'masav_social',    label: 'מס"ב סוציאליות',   icon: 'upload' },
    ],
  },

  payroll_authorities: {
    key: 'payroll_authorities',
    label: 'רשויות שכר',
    dashboard: 'payroll',
    taskCategories: ['רשויות שכר', 'work_payroll_authorities'],
    createCategory: 'רשויות שכר',
    depends_on_nodes: ['P1_payroll'],
    steps: [],
  },

  payroll_closing: {
    key: 'payroll_closing',
    label: 'קליטה להנה"ח',
    dashboard: 'payroll',
    taskType: 'linear',
    taskCategories: ['קליטה להנה"ח', 'work_payroll_closing'],
    createCategory: 'קליטה להנה"ח',
    depends_on_nodes: ['P1_payslip_sending', 'P1_authorities'],  // תלוי בסיום תלושים + רשויות
    steps: [
      { key: 'salary_entry',           label: 'קליטת פקודת משכורת',                   icon: 'calculator' },
      { key: 'social_security_entry',  label: 'קליטת תשלומי רשויות - ביטוח לאומי',   icon: 'landmark' },
      { key: 'deductions_entry',       label: 'קליטת תשלומי רשויות - ניכויים',        icon: 'landmark' },
    ],
  },

  pnl_reports: {
    key: 'pnl_reports',
    label: 'רווח והפסד',
    dashboard: 'tax',
    taskCategories: ['רווח והפסד', 'רוו"ה', 'דוח רו"ה', 'work_pnl'],
    createCategory: 'רווח והפסד',
    steps: [
      { key: 'report_generation', label: 'הפקת דוח', icon: 'file-text' },
    ],
  },

  office: {
    key: 'office',
    label: 'משרד',
    dashboard: 'admin',
    taskCategories: ['משרד', 'work_office'],
    createCategory: 'משרד',
    steps: [
      { key: 'task', label: 'ביצוע', icon: 'check-circle' },
    ],
  },

  personal_reports: {
    key: 'personal_reports',
    label: 'דוחות אישיים',
    dashboard: 'annual_reports',
    branch: 'P5',
    taskCategories: ['דוחות אישיים', 'work_personal_reports'],
    createCategory: 'דוחות אישיים',
    steps: [
      { key: 'gather_materials',    label: 'איסוף חומרים',     icon: 'inbox' },
      { key: 'data_entry',          label: 'קליטת נתונים',     icon: 'download' },
      { key: 'base_reconciliation', label: 'התאמות יסוד',     icon: 'check-square' },
      { key: 'sanity_check',        label: 'בדיקת סבירות',    icon: 'eye' },
      { key: 'review',              label: 'סקירה',           icon: 'eye' },
      { key: 'final_close',         label: 'סגירה',           icon: 'check-circle' },
      { key: 'submission',          label: 'הגשה',            icon: 'send' },
    ],
  },

  reconciliation: {
    key: 'reconciliation',
    label: 'התאמות חשבונות',
    dashboard: 'tax',
    taskCategories: ['התאמות', 'work_reconciliation'],
    createCategory: 'התאמות',
    supportsComplexity: true,
    steps: [
      { key: 'bank_statements',     label: 'קבלת דפי בנק',          icon: 'file-down' },
      { key: 'bank_reconciliation',  label: 'התאמת בנק',             icon: 'check-square' },
      { key: 'cc_reconciliation',    label: 'התאמת כרטיסי אשראי',   icon: 'check-square' },
      { key: 'differences',          label: 'טיפול בהפרשים',         icon: 'alert-triangle' },
    ],
    // Extended steps for High complexity clients (multiple accounts)
    highComplexitySteps: [
      { key: 'bank_statements',      label: 'קבלת דפי בנק',           icon: 'file-down' },
      { key: 'reconcile_primary',    label: 'התאמה - חשבון ראשי',     icon: 'check-square' },
      { key: 'reconcile_secondary',  label: 'התאמה - חשבונות נוספים', icon: 'check-square' },
      { key: 'cross_check',          label: 'בדיקת סבירות צולבת',     icon: 'eye' },
      { key: 'differences',          label: 'טיפול בהפרשים',          icon: 'alert-triangle' },
      { key: 'final_review',         label: 'סקירה סופית',            icon: 'check-circle' },
    ],
  },

  bank_reconciliation: {
    key: 'bank_reconciliation',
    label: 'התאמת בנק',
    dashboard: 'tax',
    branch: 'P2',
    taskCategories: ['התאמת בנק', 'work_bank_reconciliation'],
    createCategory: 'התאמת בנק',
    steps: [
      { key: 'bank_statements', label: 'קבלת דפי בנק',     icon: 'file-down' },
      { key: 'reconcile',       label: 'ביצוע התאמה',       icon: 'check-square' },
      { key: 'differences',     label: 'טיפול בהפרשים',    icon: 'alert-triangle' },
    ],
  },

  credit_card_reconciliation: {
    key: 'credit_card_reconciliation',
    label: 'התאמת כ"א',
    dashboard: 'tax',
    branch: 'P2',
    taskCategories: ['התאמת כ"א', 'work_credit_card_reconciliation'],
    createCategory: 'התאמת כ"א',
    steps: [
      { key: 'cc_statements',   label: 'קבלת דפי כרטיס',   icon: 'file-down' },
      { key: 'reconcile',       label: 'ביצוע התאמה',       icon: 'check-square' },
      { key: 'differences',     label: 'טיפול בהפרשים',    icon: 'alert-triangle' },
    ],
  },

  annual_reports: {
    key: 'annual_reports',
    label: 'דוחות שנתיים / מאזנים',
    dashboard: 'annual_reports',
    branch: 'P5',
    taskCategories: ['דוח שנתי', 'work_annual_reports'],
    createCategory: 'דוח שנתי',
    steps: [
      { key: 'gather_materials',   label: 'איסוף חומרים',    icon: 'inbox' },
      { key: 'data_entry',         label: 'קליטת נתונים',    icon: 'download' },
      { key: 'base_reconciliation', label: 'התאמות יסוד',    icon: 'check-square' },
      { key: 'sanity_check',       label: 'בדיקת סבירות',   icon: 'eye' },
      { key: 'review',             label: 'סקירה',          icon: 'eye' },
      { key: 'final_close',        label: 'סגירה',          icon: 'check-circle' },
      { key: 'submission',         label: 'הגשה',           icon: 'send' },
    ],
  },

  income_collection: {
    key: 'income_collection',
    label: 'קליטת הכנסות',
    dashboard: 'tax',
    branch: 'P2',
    taskCategories: ['קליטת הכנסות', 'work_income_collection'],
    createCategory: 'קליטת הכנסות',
    supportsSubProcesses: true,  // Multiple income systems per client
    subProcessField: 'income_systems',  // Client field listing systems
    subProcessDefaults: ['חשבונית ירוקה', 'קופה רושמת'],
    steps: [
      { key: 'receive_data',            label: 'קבלת חומרים',      icon: 'download' },
      { key: 'zero_income',             label: 'הכנסות 0',         icon: 'minus-circle', autoSufficient: true },
      { key: 'income_input',            label: 'הזנת הכנסות',      icon: 'file-text', allowMultiple: true },
      { key: 'sufficient_for_reporting', label: 'מספיק לדיווח',    icon: 'unlock', unlocksDependents: true },
      { key: 'check_entries',           label: 'בדיקת רשומות',     icon: 'check-circle' },
    ],
  },

  expense_collection: {
    key: 'expense_collection',
    label: 'קליטת הוצאות',
    dashboard: 'tax',
    branch: 'P2',
    taskCategories: ['קליטת הוצאות', 'work_expense_collection'],
    createCategory: 'קליטת הוצאות',
    supportsSubProcesses: true,
    subProcessField: 'expense_systems',
    subProcessDefaults: ['חשבוניות ספקים', 'הוצאות עובדים'],
    steps: [
      { key: 'receive_data',            label: 'קבלת חומרים',      icon: 'download' },
      { key: 'zero_expenses',           label: 'הוצאות 0',         icon: 'minus-circle', autoSufficient: true },
      { key: 'expense_input',           label: 'הזנת הוצאות',      icon: 'file-text', allowMultiple: true },
      { key: 'sufficient_for_reporting', label: 'מספיק לדיווח',    icon: 'unlock', unlocksDependents: true },
      { key: 'check_entries',           label: 'בדיקת רשומות',     icon: 'check-circle' },
    ],
  },

  authorities_payment: {
    key: 'authorities_payment',
    label: 'תשלום רשויות',
    dashboard: ['payroll', 'tax'],  // מופיע בשני הלוחות
    taskCategories: ['תשלום רשויות', 'מס"ב רשויות', 'work_authorities_payment', 'work_masav_authorities'],
    createCategory: 'תשלום רשויות',
    // הצעדים משתנים לפי אמצעי תשלום הלקוח (authorities_payment_method)
    // מס"ב: הכנת קובץ → העלאה → אישור
    // אחר: הפקת שובר → תשלום → אישור קבלה
    steps: [
      { key: 'file_prep',    label: 'הכנת קובץ / שובר',   icon: 'file-text' },
      { key: 'upload',       label: 'העלאה / ביצוע תשלום', icon: 'upload' },
      { key: 'confirmation', label: 'אישור ביצוע',         icon: 'check-circle' },
    ],
    // Step label overrides by payment method
    stepLabelsByPaymentMethod: {
      masav: { file_prep: 'הכנת קובץ מס"ב', upload: 'העלאת מס"ב', confirmation: 'אישור ביצוע מס"ב' },
      bank_standing_order: { file_prep: 'בדיקת הו"ק', upload: 'אישור חיוב', confirmation: 'אישור ביצוע' },
      credit_card: { file_prep: 'בדיקת חיוב', upload: 'אישור כ.אשראי', confirmation: 'אישור ביצוע' },
      check: { file_prep: 'הכנת המחאה', upload: 'שליחה/מסירה', confirmation: 'אישור קבלה' },
      client_pays: { file_prep: 'שליחת שובר ללקוח', upload: 'אישור תשלום מלקוח', confirmation: 'אישור קבלה ברשות' },
    },
  },

  reserve_claims: {
    key: 'reserve_claims',
    label: 'תביעות מילואים',
    dashboard: 'payroll',
    taskCategories: ['מילואים', 'work_reserve_claims'],
    createCategory: 'מילואים',
    steps: [
      { key: 'claim_prep',     label: 'הכנת תביעה',       icon: 'file-text' },
      { key: 'claim_submit',   label: 'הגשה לביט"ל',      icon: 'send' },
      { key: 'pending_funds',  label: 'ממתין לכספים',     icon: 'clock',  autoStatus: 'pending_external' },
      { key: 'follow_up',      label: 'עדכון בשכר',       icon: 'check-circle' },
    ],
  },

  social_benefits: {
    key: 'social_benefits',
    label: 'הנחיות מס"ב ממתפעל',
    dashboard: 'payroll',
    taskCategories: ['הנחיות מס"ב ממתפעל', 'פנסיות וקרנות', 'work_social_benefits'],
    createCategory: 'הנחיות מס"ב ממתפעל',
    steps: [
      { key: 'receive_instructions', label: 'קבלת הנחיות',  icon: 'inbox' },
      { key: 'execution',            label: 'ביצוע',         icon: 'check-circle' },
    ],
  },

  masav_employees: {
    key: 'masav_employees',
    label: 'מס"ב עובדים',
    dashboard: 'payroll',
    taskType: 'linear',  // Linear task — no דיווח/תשלום sub-tasks
    taskCategories: ['מס"ב עובדים', 'work_masav'],
    createCategory: 'מס"ב עובדים',
    depends_on_nodes: ['P1_payroll'],  // תלוי בייצור שכר
    steps: [
      { key: 'file_prep',    label: 'הכנת קובץ',   icon: 'file-text' },
      { key: 'upload',       label: 'העלאה',        icon: 'upload' },
      { key: 'confirmation', label: 'אישור ביצוע',  icon: 'check-circle' },
    ],
  },

  consulting: {
    key: 'consulting',
    label: 'ייעוץ',
    dashboard: 'tax',
    taskCategories: ['ייעוץ', 'work_consulting'],
    createCategory: 'ייעוץ',
    steps: [
      { key: 'consultation',  label: 'ביצוע ייעוץ',   icon: 'message-square' },
      { key: 'summary',       label: 'סיכום ותיעוד',   icon: 'file-text' },
    ],
  },

  admin: {
    key: 'admin',
    label: 'אדמיניסטרציה',
    dashboard: 'admin',
    taskCategories: ['אדמיניסטרציה', 'work_admin'],
    createCategory: 'אדמיניסטרציה',
    steps: [
      { key: 'task',  label: 'ביצוע',  icon: 'check-circle' },
    ],
  },

  marketing_followup: {
    key: 'marketing_followup',
    label: 'מעקב שיווק',
    dashboard: 'admin',
    taskCategories: ['מעקב שיווק', 'work_marketing'],
    createCategory: 'מעקב שיווק',
    steps: [
      { key: 'contact',   label: 'יצירת קשר',  icon: 'phone' },
      { key: 'follow_up', label: 'מעקב',        icon: 'clock' },
    ],
  },

  client_callback: {
    key: 'client_callback',
    label: 'לחזור ללקוח',
    dashboard: 'admin',
    taskCategories: ['לחזור ללקוח', 'work_callback'],
    createCategory: 'לחזור ללקוח',
    steps: [
      { key: 'call',  label: 'ביצוע שיחה',  icon: 'phone' },
    ],
  },

  meeting: {
    key: 'meeting',
    label: 'פגישה',
    dashboard: 'admin',
    taskCategories: ['פגישה', 'work_meeting'],
    createCategory: 'פגישה',
    steps: [
      { key: 'schedule',  label: 'תיאום',    icon: 'calendar' },
      { key: 'execute',   label: 'ביצוע',    icon: 'check-circle' },
    ],
  },

  general: {
    key: 'general',
    label: 'כללי',
    dashboard: 'admin',
    taskCategories: ['כללי', 'work_general', ''],
    createCategory: 'כללי',
    steps: [
      { key: 'task',  label: 'ביצוע',  icon: 'check-circle' },
    ],
  },

  masav_social: {
    key: 'masav_social',
    label: 'מס"ב סוציאליות',
    dashboard: 'payroll',
    taskType: 'linear',  // Linear task — full chain encoded as steps
    sequentialSteps: true, // ENFORCE: each step requires previous step to be done
    taskCategories: ['מס"ב סוציאליות', 'work_masav_social'],
    createCategory: 'מס"ב סוציאליות',
    depends_on_nodes: ['P1_payroll'],  // תלוי בייצור שכר
    // Social Security Chain (ENFORCED LINEAR):
    // 1. send_to_operator(הושלם) → status: waiting_for_materials (ממתין לקובץ ממתפעל)
    // 2. receive_file(הושלם) → status: not_started (לבצע - הזנת קובץ משנה)
    // 3. file_prep + upload(הושלם) → status: sent_for_review
    // 4. send_receipts(הושלם) → status: production_completed (פותח משלוח אסמכתאות)
    steps: [
      { key: 'send_to_operator', label: 'שליחה למתפעל', icon: 'send' },
      { key: 'receive_file',     label: 'אישור קבלת הנחיות',  icon: 'inbox',       requiresPrev: true },
      { key: 'file_prep',        label: 'הכנת קובץ מס"ב',    icon: 'file-text',   requiresPrev: true },
      { key: 'upload',           label: 'העלאת מס"ב',         icon: 'upload',      requiresPrev: true },
      { key: 'send_receipts',    label: 'שליחת אסמכתאות',     icon: 'check-circle', requiresPrev: true },
    ],
  },

  // masav_authorities merged into authorities_payment above (unified by payment method)

  masav_suppliers: {
    key: 'masav_suppliers',
    label: 'מס"ב ספקים',
    dashboard: 'tax',  // P2 bookkeeping — NOT payroll
    taskCategories: ['מס"ב ספקים', 'work_masav_suppliers'],
    createCategory: 'מס"ב ספקים',
    steps: [
      { key: 'file_prep',    label: 'הכנת קובץ',   icon: 'file-text' },
      { key: 'upload',       label: 'העלאה',        icon: 'upload' },
      { key: 'confirmation', label: 'אישור ביצוע',  icon: 'check-circle' },
    ],
  },

  operator_reporting: {
    key: 'operator_reporting',
    label: 'דיווח למתפעל',
    dashboard: 'additional',
    taskCategories: ['דיווח למתפעל', 'מתפעל', 'work_operator_reporting'],
    createCategory: 'דיווח למתפעל',
    steps: [
      { key: 'report_prep',  label: 'הכנת דו"ח',  icon: 'file-text' },
      { key: 'submission',   label: 'שליחה',       icon: 'send' },
    ],
  },

  taml_reporting: {
    key: 'taml_reporting',
    label: 'דיווח לטמל',
    dashboard: 'additional',
    taskCategories: ['דיווח לטמל', 'טמל + לקוח', 'work_taml_reporting'],
    createCategory: 'דיווח לטמל',
    steps: [
      { key: 'report_prep',  label: 'הכנת דו"ח',  icon: 'file-text' },
      { key: 'submission',   label: 'שליחה',       icon: 'send' },
    ],
  },

  payslip_sending: {
    key: 'payslip_sending',
    label: 'משלוח תלושים',
    dashboard: 'payroll',
    taskType: 'linear',  // Linear task — no דיווח/תשלום sub-tasks
    taskCategories: ['משלוח תלושים', 'work_payslip_sending'],
    createCategory: 'משלוח תלושים',
    depends_on_nodes: ['P1_payroll'],  // תלוי בייצור שכר
    steps: [
      { key: 'generate',  label: 'הפקת תלושים',  icon: 'file-output' },
      { key: 'send',      label: 'שליחה',         icon: 'send' },
    ],
  },

  update_reports_folder: {
    key: 'update_reports_folder',
    label: 'עדכון דוחות בתיקייה',
    dashboard: 'payroll',
    taskType: 'linear',
    taskCategories: ['עדכון דוחות בתיקייה', 'work_update_reports_folder'],
    createCategory: 'עדכון דוחות בתיקייה',
    steps: [
      { key: 'gather_reports', label: 'איסוף דוחות',    icon: 'folder-open' },
      { key: 'update_folder',  label: 'עדכון תיקייה',   icon: 'upload' },
      { key: 'verify',         label: 'אימות ובדיקה',   icon: 'check-circle' },
    ],
  },
};

// ============================================================
// P4: HOME / PERSONAL SERVICES
// ============================================================

export const HOME_SERVICES = {
  meal_planning: {
    key: 'meal_planning',
    label: 'תכנון ארוחות',
    dashboard: 'home',
    branch: 'P4',
    taskCategories: ['ארוחות', 'home_meals', 'תכנון ארוחות'],
    createCategory: 'ארוחות',
    steps: [
      { key: 'plan_menu',    label: 'תכנון תפריט',   icon: 'clipboard' },
      { key: 'shopping',     label: 'רשימת קניות',    icon: 'shopping-cart' },
      { key: 'preparation',  label: 'הכנה',           icon: 'check-circle' },
    ],
  },

  morning_routine: {
    key: 'morning_routine',
    label: 'שגרת בוקר',
    dashboard: 'home',
    branch: 'P4',
    taskCategories: ['שגרת בוקר', 'home_morning', 'בוקר'],
    createCategory: 'שגרת בוקר',
    steps: [
      { key: 'wake_up',   label: 'קימה',       icon: 'sun' },
      { key: 'exercise',  label: 'פעילות גופנית', icon: 'heart' },
      { key: 'planning',  label: 'תכנון יום',   icon: 'calendar' },
    ],
  },

  evening_routine: {
    key: 'evening_routine',
    label: 'שגרת ערב',
    dashboard: 'home',
    branch: 'P4',
    taskCategories: ['שגרת ערב', 'home_evening', 'ערב'],
    createCategory: 'שגרת ערב',
    steps: [
      { key: 'review',    label: 'סיכום יום',    icon: 'book' },
      { key: 'prep_next', label: 'הכנה למחר',    icon: 'check-circle' },
    ],
  },

  personal_errands: {
    key: 'personal_errands',
    label: 'סידורים אישיים',
    dashboard: 'home',
    branch: 'P4',
    taskCategories: ['סידורים', 'home_errands', 'אישי'],
    createCategory: 'סידורים',
    steps: [
      { key: 'task',  label: 'ביצוע',  icon: 'check-circle' },
    ],
  },

  home_maintenance: {
    key: 'home_maintenance',
    label: 'תחזוקת בית',
    dashboard: 'home',
    branch: 'P4',
    taskCategories: ['תחזוקה', 'home_maintenance', 'בית'],
    createCategory: 'תחזוקה',
    steps: [
      { key: 'identify',  label: 'זיהוי משימה',  icon: 'alert-triangle' },
      { key: 'execute',   label: 'ביצוע',         icon: 'check-circle' },
    ],
  },
};

// ============================================================
// COMBINED & HELPERS
// ============================================================

export const ALL_SERVICES = {
  ...TAX_SERVICES,
  ...PAYROLL_SERVICES,
  ...ADDITIONAL_SERVICES,
  ...HOME_SERVICES,
};

/**
 * Get all services that belong to a specific dashboard
 */
export function getServicesByDashboard(dashboardType) {
  return Object.values(ALL_SERVICES).filter(s =>
    Array.isArray(s.dashboard) ? s.dashboard.includes(dashboardType) : s.dashboard === dashboardType
  );
}

/**
 * Find which service a task belongs to, based on its category
 */
export function getServiceForTask(task) {
  if (!task?.category) return null;
  return Object.values(ALL_SERVICES).find(service =>
    service.taskCategories.includes(task.category)
  );
}

/**
 * Check if a task is an "authority" task (gets דיווח + תשלום sub-tasks).
 * Authority tasks: מע"מ, מקדמות מס, ביטוח לאומי, ניכויים.
 * All others (שכר, מס"ב, תלושים) are linear — no sub-tasks.
 */
export function isAuthorityTask(task) {
  const service = getServiceForTask(task);
  return service?.taskType === 'authority';
}

/**
 * Get the "דיווח" + "תשלום" sub-steps for authority tasks only.
 * Returns empty array for linear/non-authority tasks.
 */
export function getAuthoritySubSteps(task) {
  const service = getServiceForTask(task);
  if (service?.taskType !== 'authority') return [];
  return (service.steps || []).filter(s => s.key === 'submission' || s.key === 'payment');
}

/**
 * Get the default steps for a given service key
 */
export function getStepsForService(serviceKey) {
  return ALL_SERVICES[serviceKey]?.steps || [];
}

/**
 * Get all task categories that belong to a dashboard type
 */
export function getCategoriesForDashboard(dashboardType) {
  const services = getServicesByDashboard(dashboardType);
  return services.flatMap(s => s.taskCategories);
}

/**
 * Initialize process_steps for a task based on its service template.
 * Returns existing steps if already set, or empty defaults from template.
 * For services with supportsComplexity, uses highComplexitySteps when task.complexity === 'high'.
 */
export function getTaskProcessSteps(task) {
  const service = getServiceForTask(task);
  if (!service) return {};

  // Choose steps based on task complexity
  const useHighComplexity = service.supportsComplexity && task?.complexity === 'high' && service.highComplexitySteps;
  const templateSteps = useHighComplexity ? service.highComplexitySteps : service.steps;

  const existingSteps = task.process_steps || {};
  const result = {};

  for (const step of templateSteps) {
    result[step.key] = existingSteps[step.key] || { done: false, date: null, notes: '' };
  }

  return result;
}

/**
 * Get the step template for a task, accounting for complexity.
 */
export function getStepsForTask(task) {
  const service = getServiceForTask(task);
  if (!service) return [];

  if (service.supportsComplexity && task?.complexity === 'high' && service.highComplexitySteps) {
    return service.highComplexitySteps;
  }
  return service.steps;
}

/**
 * Check if a step is locked (cannot be toggled) due to sequential enforcement.
 * For services with sequentialSteps=true, a step is locked unless all previous steps are done.
 *
 * @param {Object} task - Task entity
 * @param {string} stepKey - The step key to check
 * @returns {boolean} true if the step is locked
 */
export function isStepLocked(task, stepKey) {
  const service = getServiceForTask(task);
  if (!service?.sequentialSteps) return false;

  const steps = service.steps || [];
  const currentSteps = task.process_steps || {};
  const stepIndex = steps.findIndex(s => s.key === stepKey);
  if (stepIndex <= 0) return false; // First step is never locked

  // Check if ALL previous steps are complete (done or skipped)
  for (let i = 0; i < stepIndex; i++) {
    if (!isStepComplete(currentSteps[steps[i].key])) return true;
  }
  return false;
}

/**
 * Toggle a step's done state and auto-set date.
 * Also supports sub-step keys in the format "parentKey.subKey".
 */
export function toggleStep(currentSteps, stepKey) {
  const step = currentSteps[stepKey] || { done: false, date: null, notes: '' };
  const now = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  return {
    ...currentSteps,
    [stepKey]: {
      ...step,
      done: !step.done,
      skipped: false, // un-skip when toggling done
      date: !step.done ? now : null, // set date when marking done, clear when unmarking
    },
  };
}

/**
 * Toggle a sub-step's done state.
 * Sub-step key format: "parentStepKey.subStepKey"
 */
export function toggleSubStep(currentSteps, parentKey, subKey) {
  const fullKey = `${parentKey}.${subKey}`;
  return toggleStep(currentSteps, fullKey);
}

/**
 * Check if a sub-step is complete
 */
export function isSubStepComplete(processSteps, parentKey, subKey) {
  const fullKey = `${parentKey}.${subKey}`;
  return isStepComplete(processSteps?.[fullKey]);
}

/**
 * Get sub-step completion count for a parent step
 */
export function getSubStepProgress(processSteps, parentKey, subSteps = []) {
  if (!subSteps.length) return { done: 0, total: 0 };
  const done = subSteps.filter(sub => isSubStepComplete(processSteps, parentKey, sub.key)).length;
  return { done, total: subSteps.length };
}

/**
 * Skip a step — marks it as "not relevant" for this task.
 * Skipped steps count as complete for chain progression.
 * Calling again un-skips the step.
 */
export function skipStep(currentSteps, stepKey) {
  const step = currentSteps[stepKey] || { done: false, date: null, notes: '' };
  const now = new Date().toISOString().split('T')[0];
  const wasSkipped = !!step.skipped;

  return {
    ...currentSteps,
    [stepKey]: {
      ...step,
      skipped: !wasSkipped,
      done: false, // skipped is a separate state from done
      date: !wasSkipped ? now : null,
    },
  };
}

/**
 * Check if a step is effectively complete (done OR skipped).
 * Used for chain progression and completion calculations.
 */
export function isStepComplete(stepData) {
  return !!(stepData?.done || stepData?.skipped);
}

/**
 * Calculate completion percentage for a task's process steps.
 * Skipped steps count as complete.
 * Sub-steps are counted individually when present.
 */
export function getStepCompletionPercent(task) {
  const templateSteps = getStepsForTask(task);
  if (!templateSteps.length) return 0;

  const steps = task.process_steps || {};
  let totalItems = 0;
  let completedItems = 0;

  for (const s of templateSteps) {
    const subs = s.sub_steps || [];
    if (subs.length > 0) {
      totalItems += subs.length;
      completedItems += subs.filter(sub => isStepComplete(steps[`${s.key}.${sub.key}`])).length;
    } else {
      totalItems += 1;
      if (isStepComplete(steps[s.key])) completedItems += 1;
    }
  }

  return totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
}

// ============================================================
// BIMONTHLY HELPERS
// ============================================================

// Map service/column keys to client reporting_info frequency fields
const FREQUENCY_FIELD_MAP = {
  vat: 'vat_reporting_frequency',
  tax_advances: 'tax_advances_frequency',
  deductions: 'deductions_frequency',
  social_security: 'social_security_frequency',
};

/**
 * Check if a given month is an off-month for bimonthly reporting.
 * Bimonthly reports cover pairs: Jan-Feb, Mar-Apr, May-Jun, etc.
 * Reports are filed on even months (Feb, Apr, Jun, Aug, Oct, Dec).
 * Odd months (Jan, Mar, May, Jul, Sep, Nov) are off-months → "לא רלוונטי".
 *
 * @param {Object} client - Client entity with reporting_info
 * @param {string} serviceKey - Service key (vat, tax_advances, deductions)
 * @param {Date|number} month - Date object or 0-indexed month number
 * @returns {boolean} true if this is an off-month for the client's bimonthly reporting
 */
export function isBimonthlyOffMonth(client, serviceKey, month) {
  const field = FREQUENCY_FIELD_MAP[serviceKey];
  if (!field) return false;

  const frequency = client?.reporting_info?.[field];
  if (frequency !== 'bimonthly') return false;

  const monthIndex = month instanceof Date ? month.getMonth() : month;
  // Off months: Jan(0), Mar(2), May(4), Jul(6), Sep(8), Nov(10) = even 0-indexed
  return monthIndex % 2 === 0;
}

/**
 * Mark ALL steps as done for a task (used when status → completed)
 * Returns the updated process_steps object
 */
export function markAllStepsDone(task) {
  const templateSteps = getStepsForTask(task);
  if (!templateSteps.length) return task.process_steps || {};

  const now = new Date().toISOString().split('T')[0];
  const existingSteps = task.process_steps || {};
  const result = {};

  for (const step of templateSteps) {
    const existing = existingSteps[step.key] || {};
    result[step.key] = {
      done: true,
      date: existing.date || now,
      notes: existing.notes || '',
    };
  }

  return result;
}

/**
 * Mark ALL steps as undone for a task (used when reverting from completed)
 * Returns the updated process_steps object
 */
export function markAllStepsUndone(task) {
  const templateSteps = getStepsForTask(task);
  if (!templateSteps.length) return task.process_steps || {};

  const existingSteps = task.process_steps || {};
  const result = {};

  for (const step of templateSteps) {
    const existing = existingSteps[step.key] || {};
    result[step.key] = {
      done: false,
      date: null,
      notes: existing.notes || '',
    };
  }

  return result;
}

/**
 * Check if ALL steps are done for a task
 */
export function areAllStepsDone(task) {
  const templateSteps = getStepsForTask(task);
  if (!templateSteps.length) return false;

  const steps = task.process_steps || {};
  return templateSteps.every(s => steps[s.key]?.done);
}

// ============================================================
// THE GOLDEN LIST — 7 exclusive workflow statuses
// ============================================================
// Safe migration: old statuses are mapped (not deleted) to preserve data.
// The trigger: "הושלם ייצור" is the ONLY status that fires cascade creation.

export const STATUS_CONFIG = {
  waiting_for_materials:      { label: 'ממתין לחומרים',        bg: 'bg-amber-100',   text: 'text-amber-800',   border: 'border-amber-200',   priority: 1 },
  not_started:                { label: 'לבצע',                 bg: 'bg-slate-200',   text: 'text-slate-800',   border: 'border-slate-300',   priority: 2 },
  sent_for_review:            { label: 'הועבר לעיון',          bg: 'bg-purple-200',  text: 'text-purple-800',  border: 'border-purple-300',  priority: 3 },
  review_after_corrections:   { label: 'הועבר לעיון לאחר תיקונים', bg: 'bg-violet-200', text: 'text-violet-800', border: 'border-violet-300', priority: 3.2 },
  ready_to_broadcast:         { label: 'מוכן לשידור',          bg: 'bg-teal-200',    text: 'text-teal-800',    border: 'border-teal-300',    priority: 3.5 },
  reported_pending_payment:   { label: 'שודר, ממתין לתשלום',   bg: 'bg-indigo-200',  text: 'text-indigo-800',  border: 'border-indigo-300',  priority: 4 },
  needs_corrections:          { label: 'לבצע תיקונים',         bg: 'bg-orange-200',  text: 'text-orange-800',  border: 'border-orange-300',  priority: 3 },
  production_completed:       { label: 'הושלם ייצור',          bg: 'bg-emerald-400', text: 'text-white',       border: 'border-emerald-500', priority: 5 },
};

export const TASK_STATUS_CONFIG = {
  waiting_for_materials:      { text: 'ממתין לחומרים',        color: 'bg-amber-100 text-amber-700',     dot: 'bg-amber-500' },
  not_started:                { text: 'לבצע',                 color: 'bg-slate-100 text-slate-700',     dot: 'bg-slate-400' },
  sent_for_review:            { text: 'הועבר לעיון',          color: 'bg-purple-100 text-purple-700',   dot: 'bg-purple-500' },
  ready_to_broadcast:         { text: 'מוכן לשידור',          color: 'bg-teal-100 text-teal-700',       dot: 'bg-teal-500' },
  reported_pending_payment:   { text: 'שודר, ממתין לתשלום',   color: 'bg-indigo-100 text-indigo-700',   dot: 'bg-indigo-500' },
  needs_corrections:          { text: 'לבצע תיקונים',         color: 'bg-orange-100 text-orange-700',   dot: 'bg-orange-500' },
  production_completed:       { text: 'הושלם ייצור',          color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
};

// ============================================================
// SAFE STATUS MIGRATION MAP — old status → new status
// No data is deleted. Existing tasks with legacy statuses get remapped.
// ============================================================
export const STATUS_MIGRATION_MAP = {
  // Direct mappings
  waiting_for_materials:         'waiting_for_materials',
  not_started:                   'not_started',
  production_completed:          'production_completed',
  ready_to_broadcast:            'ready_to_broadcast',
  reported_pending_payment:      'reported_pending_payment',
  // "בעבודה" / active → "לבצע"
  in_progress:                   'not_started',
  remaining_completions:         'not_started',
  // "הושלם" / 100% → "הושלם ייצור"
  completed:                     'production_completed',
  // "לבדיקה" → "הועבר לעיון"
  waiting_for_approval:          'sent_for_review',
  // Legacy "reported_waiting_for_payment" → new formal status
  reported_waiting_for_payment:  'reported_pending_payment',
  // "מוכן לדיווח" → "מוכן לשידור"
  ready_for_reporting:           'ready_to_broadcast',
  // All others → "לבצע"
  postponed:                     'not_started',
  issue:                         'needs_corrections',
  pending_external:              'not_started',
  waiting_on_client:             'waiting_for_materials',
  not_relevant:                  'production_completed',
};

/**
 * Normalize any legacy status to one of the 7 golden statuses.
 * Safe: returns the status as-is if already valid.
 */
export function migrateStatus(status) {
  if (STATUS_CONFIG[status]) return status;
  return STATUS_MIGRATION_MAP[status] || 'not_started';
}
