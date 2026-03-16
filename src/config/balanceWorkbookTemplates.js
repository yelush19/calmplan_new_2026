// ══════════════════════════════════════════════════════════════
// חוברת עבודה להכנת מאזן — מבנה הכנה אמיתי
// גליון ראשי: מאזן בוחן + הפניות + סטטוס
// גליונות עבודה: טאב נפרד לכל נושא שדורש פירוט
// קבצים: PDF מוטמע ליד כל קבוצה
// ══════════════════════════════════════════════════════════════

/**
 * ═══ גליון ראשי: בוחן והפניות ═══
 * כל שורה = חשבון בהנה"ח
 * מקובץ לפי קבוצות (בנקים, לקוחות, רכוש קבוע...)
 * כל קבוצה: שורת סיכום + סטטוס הפניה + קבצים מצורפים
 */
export const TRIAL_BALANCE_COLUMNS = [
  { key: 'account_group', label: 'מיון', type: 'text' },        // 100, 101, 200...
  { key: 'account_code', label: 'חשבון', type: 'text' },         // 1000, 10015, 1200...
  { key: 'account_name', label: 'שם חשבון', type: 'text' },
  { key: 'debit', label: 'חובה', type: 'number' },
  { key: 'credit', label: 'זכות', type: 'number' },
  { key: 'difference', label: 'הפרש', type: 'number' },
  { key: 'reference_status', label: 'סטטוס', type: 'status' },   // תואם / ראה נספחים / לבדוק / לחשב...
  { key: 'reference_note', label: 'הפניה', type: 'text' },       // "ראה חוצר הרכב+התפתחות שקלפ"
];

/**
 * סטטוסי הפניה לכל שורה בבוחן
 */
export const REFERENCE_STATUSES = [
  { key: 'matched', label: 'תואם', color: '#4ade80' },
  { key: 'matched_see_appendix', label: 'תואם אישור ראה נספחים', color: '#86efac' },
  { key: 'see_worksheet', label: 'ראה גליון עבודה', color: '#93c5fd' },
  { key: 'to_check', label: 'לבדוק', color: '#fbbf24' },
  { key: 'to_calculate', label: 'לחשב', color: '#fb923c' },
  { key: 'not_started', label: 'טרם טופל', color: '#d1d5db' },
];

/**
 * ═══ קבוצות ברירת מחדל לבוחן ═══
 * כל קבוצה = header בגליון הבוחן עם שורת סיכום כחולה
 * ניתן להוסיף/למחוק קבוצות לפי הלקוח
 */
export const DEFAULT_ACCOUNT_GROUPS = [
  // ─── בנקים ───
  { key: 'bank_1', label: 'בנק ראשי', group_code: '100', category: 'banks',
    has_worksheet: true, worksheet_type: 'bank_reconciliation' },
  { key: 'bank_2', label: 'בנק נוסף', group_code: '101', category: 'banks',
    has_worksheet: true, worksheet_type: 'bank_reconciliation', optional: true },
  { key: 'bank_fund', label: 'קרן בערבות מדינה', group_code: '101', category: 'banks',
    has_worksheet: false, optional: true },

  // ─── כרטיסי אשראי ───
  { key: 'credit_cards', label: 'כרטיסי אשראי', group_code: '105', category: 'credit_cards',
    has_worksheet: true, worksheet_type: 'credit_card_detail' },

  // ─── הלוואות (נכס — פיקדונות שניתנו) ───
  { key: 'loans_given', label: 'הלוואות', group_code: '106', category: 'loans',
    has_worksheet: false },

  // ─── לקוחות ───
  { key: 'customers', label: 'לקוחות', group_code: '200', category: 'customers',
    has_worksheet: false },

  // ─── רכוש קבוע ───
  { key: 'fixed_assets', label: 'רכוש קבוע', group_code: '300', category: 'fixed_assets',
    has_worksheet: true, worksheet_type: 'fixed_assets_schedule' },

  // ─── ספקים וזכאים ───
  { key: 'suppliers', label: 'ספקים', group_code: '400', category: 'suppliers',
    has_worksheet: false },

  // ─── רשויות ───
  { key: 'authorities', label: 'רשויות (מע"מ, מס הכנסה, ביט"ל)', group_code: '420', category: 'authorities',
    has_worksheet: false },

  // ─── הפרשות עובדים ───
  { key: 'employee_provisions', label: 'הפרשות עובדים', group_code: '500', category: 'provisions',
    has_worksheet: true, worksheet_type: 'provisions_calc' },

  // ─── הון ───
  { key: 'equity', label: 'הון ועודפים', group_code: '600', category: 'equity',
    has_worksheet: false },

  // ─── התאמת שכר ───
  { key: 'payroll', label: 'התאמת שכ"ע ל-126', group_code: '830', category: 'payroll',
    has_worksheet: true, worksheet_type: 'payroll_reconciliation' },
];

/**
 * ═══ טאבים / גליונות עבודה ═══
 * כל טאב = פירוט עבודה לנושא ספציפי
 * מקושר לקבוצה בבוחן (או עומד בפני עצמו)
 */
export const WORKSHEET_TYPES = {
  bank_reconciliation: {
    label: 'הרכב + התפתחות',
    description: 'התאמת בנק — שיק בשיק, יתרת פתיחה עד סגירה',
    columns: [
      { key: 'date', label: 'תאריך', type: 'date' },
      { key: 'reference', label: 'אסמכתה', type: 'text' },
      { key: 'check_number', label: 'מס\' שיק', type: 'text' },
      { key: 'details', label: 'פרטים', type: 'text' },
      { key: 'debit', label: 'חובה', type: 'number' },
      { key: 'credit', label: 'זכות', type: 'number' },
      { key: 'balance', label: 'יתרה (שקל)', type: 'number' },
      { key: 'status', label: 'סטטוס', type: 'text' },       // מבוטל, פרעון שיק...
    ],
    summary_rows: [
      { key: 'opening_balance', label: 'יתרת פתיחה' },
      { key: 'total_debit', label: 'חובה' },
      { key: 'total_credit', label: 'זכות' },
      { key: 'closing_balance', label: 'הפרש' },
      { key: 'bank_statement', label: 'שקל"פ מזרחי' },       // יתרה בדף בנק
    ],
  },

  credit_card_detail: {
    label: 'חבות כ.אשראי',
    description: 'פירוט עסקאות לכל כרטיס — רגילות + תשלומים',
    columns: [
      { key: 'card_id', label: 'מס\' כרטיס', type: 'text' },
      { key: 'card_type', label: 'כינוי כרטיס', type: 'text' },   // מאסטרכא, ויזה...
      { key: 'account_code', label: 'מס\' חשבון', type: 'text' },
      { key: 'regular_transactions', label: 'עסקאות רגילות', type: 'number' },
      { key: 'installment_transactions', label: 'עסקאות בתשלומים', type: 'number' },
      { key: 'total', label: 'סה"כ לחיוב', type: 'number' },
    ],
    // כל כרטיס → תת-קבוצה עם פירוט + שורת "פרטים נוספים" + סכום עסקה
    supports_subgroups: true,
  },

  fixed_assets_schedule: {
    label: 'רכוש קבוע + פחת',
    description: 'פנקס רכוש קבוע — רכישות, מכירות, פחת',
    columns: [
      { key: 'asset_name', label: 'נכס', type: 'text' },
      { key: 'purchase_date', label: 'תאריך רכישה', type: 'date' },
      { key: 'original_cost', label: 'עלות מקורית', type: 'number' },
      { key: 'accum_depreciation', label: 'פחת נצבר', type: 'number' },
      { key: 'annual_depreciation', label: 'פחת שנתי', type: 'number' },
      { key: 'net_book_value', label: 'יתרה נטו', type: 'number' },
      { key: 'rate', label: '% פחת', type: 'number' },
    ],
  },

  provisions_calc: {
    label: 'הפרשות עובדים',
    description: 'חישוב חופשה, הבראה, פיצויים',
    columns: [
      { key: 'employee_name', label: 'שם עובד', type: 'text' },
      { key: 'vacation_days', label: 'ימי חופשה', type: 'number' },
      { key: 'vacation_amount', label: 'חופשה ₪', type: 'number' },
      { key: 'recreation', label: 'הבראה', type: 'number' },
      { key: 'severance', label: 'פיצויים', type: 'number' },
      { key: 'total', label: 'סה"כ', type: 'number' },
    ],
  },

  payroll_reconciliation: {
    label: 'התאמת שכ"ע ל-126',
    description: 'התאמת מערכת שכר מול הנה"ח + טופס 126',
    columns: [
      { key: 'item', label: 'פריט', type: 'text' },
      { key: 'payroll_system', label: 'מערכת שכר', type: 'number' },
      { key: 'book_balance', label: 'הנה"ח', type: 'number' },
      { key: 'form_126', label: 'טופס 126', type: 'number' },
      { key: 'difference', label: 'הפרש', type: 'number' },
      { key: 'notes', label: 'הערות', type: 'text' },
    ],
  },
};

/**
 * ═══ טאבים קבועים (תמיד קיימים) ═══
 */
export const FIXED_TABS = [
  { key: 'trial_balance', label: 'בוחן והפניות', type: 'main', icon: 'table' },
  { key: 'pdf_appendices', label: 'נספחי PDF', type: 'documents', icon: 'file-text' },
];

/**
 * ═══ Factory: יצירת חוברת עבודה חדשה מתבנית ═══
 */
export function createWorkbookFromTemplate({ clientId, clientName, taxYear, balanceSheetId }) {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  return {
    client_id: clientId,
    client_name: clientName,
    tax_year: taxYear,
    balance_sheet_id: balanceSheetId,

    // ─── גליון ראשי: בוחן והפניות ───
    trial_balance: {
      columns: TRIAL_BALANCE_COLUMNS,
      // קבוצות חשבונות — כל קבוצה = header + שורות + שורת סיכום
      groups: DEFAULT_ACCOUNT_GROUPS.filter(g => !g.optional).map((group, idx) => ({
        id: `grp_${id}_${idx}`,
        ...group,
        // שורות חשבונות (ריקות — נמלאות מהנה"ח או ידנית)
        accounts: [],
        // סיכום קבוצה (חובה, זכות, הפרש)
        summary: { debit: 0, credit: 0, difference: 0 },
        // קבצים מוטמעים ליד הקבוצה (PDFs)
        attachments: [],
        // סטטוס קבוצתי
        status: 'not_started',
        sort_order: idx,
      })),
    },

    // ─── גליונות עבודה (טאבים) ───
    worksheets: DEFAULT_ACCOUNT_GROUPS
      .filter(g => g.has_worksheet && !g.optional)
      .map((group, idx) => {
        const wsType = WORKSHEET_TYPES[group.worksheet_type];
        return {
          id: `ws_${id}_${idx}`,
          key: group.key,
          label: `${group.label} — ${wsType.label}`,
          type: group.worksheet_type,
          linked_group: group.key,
          columns: wsType.columns,
          rows: [],
          summary: {},
          attachments: [],    // PDFs מוטמעים בגליון
          notes: '',
          sort_order: idx,
        };
      }),

    // ─── נספחי PDF (טאב נפרד) ───
    pdf_appendices: [],

    // ─── פקודות יומן / תיקונים ───
    adjustments: [],

    // ─── סיכומים (מחושבים מהבוחן) ───
    totals: {
      total_assets: 0,
      total_liabilities: 0,
      equity: 0,
      net_income: 0,
    },

    // ─── פלט לשליחה לרו"ח ───
    output: {
      status: 'not_ready',  // not_ready → ready → sent
      sent_date: null,
      sent_to: null,
      // חבילת שליחה — מה נשלח
      package: {
        trial_balance: true,         // מאזן בוחן סופי
        financial_statements: true,  // דוחות כספיים (מאזן + רוו"ה)
        tax_reconciliation: true,    // דוח התאמה למס
        worksheets: true,            // גליונות עבודה
        appendices: true,            // נספחים + PDFs
        adjustments_journal: true,   // פקודות יומן
      },
      // מעקב סבבים
      rounds: [],  // [{ date, type: 'sent'|'questions'|'answers', notes, attachments }]
    },

    status: 'active',
    template_id: null,
    created_from_prior: null,
  };
}
