// תבניות ברירת מחדל לחוברת עבודה — מאזן לביקורת
// Default templates for Balance Sheet Workbook

// ── גליונות עבודה ברירת מחדל ──
export const DEFAULT_WORKSHEETS = [
  {
    key: 'trial_balance',
    title: 'מאזן בוחן',
    type: 'schedule',
    account_code: '',
    columns: [
      { key: 'account_code', label: 'קוד חשבון', type: 'text' },
      { key: 'account_name', label: 'שם חשבון', type: 'text' },
      { key: 'debit', label: 'חובה', type: 'number' },
      { key: 'credit', label: 'זכות', type: 'number' },
      { key: 'balance', label: 'יתרה', type: 'number' },
    ],
  },
  {
    key: 'bank_reconciliation',
    title: 'התאמת בנק',
    type: 'reconciliation',
    account_code: '100',
    columns: [
      { key: 'date', label: 'תאריך', type: 'date' },
      { key: 'reference', label: 'אסמכתה', type: 'text' },
      { key: 'description', label: 'פירוט', type: 'text' },
      { key: 'debit', label: 'חובה', type: 'number' },
      { key: 'credit', label: 'זכות', type: 'number' },
      { key: 'notes', label: 'הערות', type: 'text' },
    ],
  },
  {
    key: 'credit_cards',
    title: 'התאמת כרטיסי אשראי',
    type: 'reconciliation',
    account_code: '110',
    columns: [
      { key: 'date', label: 'תאריך', type: 'date' },
      { key: 'reference', label: 'אסמכתה', type: 'text' },
      { key: 'description', label: 'פירוט', type: 'text' },
      { key: 'debit', label: 'חובה', type: 'number' },
      { key: 'credit', label: 'זכות', type: 'number' },
      { key: 'notes', label: 'הערות', type: 'text' },
    ],
  },
  {
    key: 'customers',
    title: 'לקוחות — פירוט יתרות',
    type: 'schedule',
    account_code: '120',
    columns: [
      { key: 'account_code', label: 'קוד', type: 'text' },
      { key: 'customer_name', label: 'שם לקוח', type: 'text' },
      { key: 'opening_balance', label: 'יתרת פתיחה', type: 'number' },
      { key: 'debit', label: 'חובה', type: 'number' },
      { key: 'credit', label: 'זכות', type: 'number' },
      { key: 'closing_balance', label: 'יתרת סגירה', type: 'number' },
      { key: 'notes', label: 'הערות', type: 'text' },
    ],
  },
  {
    key: 'suppliers',
    title: 'ספקים — פירוט יתרות',
    type: 'schedule',
    account_code: '400',
    columns: [
      { key: 'account_code', label: 'קוד', type: 'text' },
      { key: 'supplier_name', label: 'שם ספק', type: 'text' },
      { key: 'opening_balance', label: 'יתרת פתיחה', type: 'number' },
      { key: 'debit', label: 'חובה', type: 'number' },
      { key: 'credit', label: 'זכות', type: 'number' },
      { key: 'closing_balance', label: 'יתרת סגירה', type: 'number' },
      { key: 'notes', label: 'הערות', type: 'text' },
    ],
  },
  {
    key: 'inventory',
    title: 'מלאי',
    type: 'schedule',
    account_code: '130',
    columns: [
      { key: 'item', label: 'פריט', type: 'text' },
      { key: 'quantity', label: 'כמות', type: 'number' },
      { key: 'unit_price', label: 'מחיר יחידה', type: 'number' },
      { key: 'total', label: 'סה"כ', type: 'number' },
      { key: 'notes', label: 'הערות', type: 'text' },
    ],
  },
  {
    key: 'fixed_assets',
    title: 'רכוש קבוע ופחת',
    type: 'schedule',
    account_code: '200',
    columns: [
      { key: 'asset_name', label: 'שם נכס', type: 'text' },
      { key: 'purchase_date', label: 'תאריך רכישה', type: 'date' },
      { key: 'original_cost', label: 'עלות מקורית', type: 'number' },
      { key: 'accumulated_depreciation', label: 'פחת נצבר', type: 'number' },
      { key: 'annual_depreciation', label: 'פחת שנתי', type: 'number' },
      { key: 'net_value', label: 'ערך נטו', type: 'number' },
      { key: 'depreciation_rate', label: 'שיעור פחת %', type: 'number' },
    ],
  },
  {
    key: 'provisions',
    title: 'הפרשות (חופשה, הבראה, פיצויים)',
    type: 'schedule',
    account_code: '500',
    columns: [
      { key: 'employee_name', label: 'שם עובד', type: 'text' },
      { key: 'vacation', label: 'חופשה', type: 'number' },
      { key: 'recreation', label: 'הבראה', type: 'number' },
      { key: 'severance', label: 'פיצויים', type: 'number' },
      { key: 'total', label: 'סה"כ', type: 'number' },
    ],
  },
  {
    key: 'loans',
    title: 'הלוואות',
    type: 'schedule',
    account_code: '450',
    columns: [
      { key: 'lender', label: 'גורם מלווה', type: 'text' },
      { key: 'original_amount', label: 'סכום מקורי', type: 'number' },
      { key: 'opening_balance', label: 'יתרת פתיחה', type: 'number' },
      { key: 'payments', label: 'תשלומים בשנה', type: 'number' },
      { key: 'interest', label: 'ריבית', type: 'number' },
      { key: 'closing_balance', label: 'יתרת סגירה', type: 'number' },
      { key: 'short_term', label: 'חלות שוטפת', type: 'number' },
    ],
  },
  {
    key: 'equity',
    title: 'הון ועודפים',
    type: 'schedule',
    account_code: '600',
    columns: [
      { key: 'item', label: 'פריט', type: 'text' },
      { key: 'opening_balance', label: 'יתרת פתיחה', type: 'number' },
      { key: 'additions', label: 'תוספות', type: 'number' },
      { key: 'deductions', label: 'הפחתות', type: 'number' },
      { key: 'closing_balance', label: 'יתרת סגירה', type: 'number' },
    ],
  },
];

// ── ביאורים סטנדרטיים ──
export const DEFAULT_BIAURIM = [
  { number: 1, title: 'כללי — פעילות החברה', content: '' },
  { number: 2, title: 'מדיניות חשבונאית עיקרית', content: '' },
  { number: 3, title: 'מזומנים ושווי מזומנים', content: '' },
  { number: 4, title: 'לקוחות', content: '' },
  { number: 5, title: 'מלאי', content: '' },
  { number: 6, title: 'רכוש קבוע, נטו', content: '' },
  { number: 7, title: 'ספקים ונותני שירותים', content: '' },
  { number: 8, title: 'הלוואות לזמן קצר', content: '' },
  { number: 9, title: 'הלוואות לזמן ארוך', content: '' },
  { number: 10, title: 'זכויות עובדים', content: '' },
  { number: 11, title: 'הון מניות', content: '' },
  { number: 12, title: 'הכנסות', content: '' },
  { number: 13, title: 'עלות המכירות', content: '' },
  { number: 14, title: 'הוצאות הנהלה וכלליות', content: '' },
  { number: 15, title: 'הוצאות מימון', content: '' },
  { number: 16, title: 'מיסים על הכנסה', content: '' },
  { number: 17, title: 'אירועים לאחר תאריך המאזן', content: '' },
];

// ── נספחים ברירת מחדל ──
export const DEFAULT_APPENDICES = [
  {
    code: 'א',
    title: 'נספח א\' — פירוט רכוש קבוע',
    content_type: 'table',
    columns: [
      { key: 'asset', label: 'נכס', type: 'text' },
      { key: 'original_cost', label: 'עלות', type: 'number' },
      { key: 'depreciation', label: 'פחת', type: 'number' },
      { key: 'net', label: 'נטו', type: 'number' },
    ],
  },
  {
    code: 'ב',
    title: 'נספח ב\' — פירוט הלוואות',
    content_type: 'table',
    columns: [
      { key: 'lender', label: 'מלווה', type: 'text' },
      { key: 'amount', label: 'סכום', type: 'number' },
      { key: 'rate', label: 'ריבית %', type: 'number' },
      { key: 'maturity', label: 'מועד פירעון', type: 'date' },
    ],
  },
  {
    code: 'ג',
    title: 'נספח ג\' — התאמה למס',
    content_type: 'table',
    columns: [
      { key: 'item', label: 'פריט', type: 'text' },
      { key: 'accounting', label: 'חשבונאי', type: 'number' },
      { key: 'tax', label: 'מס', type: 'number' },
      { key: 'difference', label: 'הפרש', type: 'number' },
    ],
  },
];

// ── Factory: יצירת חוברת עבודה חדשה מתבנית ──
export function createWorkbookFromTemplate({ clientId, clientName, taxYear, balanceSheetId }) {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  return {
    client_id: clientId,
    client_name: clientName,
    tax_year: taxYear,
    balance_sheet_id: balanceSheetId,

    worksheets: DEFAULT_WORKSHEETS.map((ws, idx) => ({
      id: `ws_${id}_${idx}`,
      ...ws,
      opening_balance: 0,
      closing_balance: 0,
      book_balance: 0,
      audit_balance: 0,
      difference: 0,
      rows: [],
      status: 'draft',
      reviewed_by: null,
      review_date: null,
      attachments: [],
      notes: '',
      sort_order: idx,
    })),

    appendices: DEFAULT_APPENDICES.map((app, idx) => ({
      id: `app_${id}_${idx}`,
      ...app,
      rows: [],
      attachments: [],
      sort_order: idx,
    })),

    notes_biaurim: DEFAULT_BIAURIM.map((biur, idx) => ({
      id: `biur_${id}_${idx}`,
      ...biur,
      linked_worksheet_id: null,
      tables: [],
      prior_year_values: {},
      current_year_values: {},
      status: 'draft',
      sort_order: idx,
    })),

    adjustments: [],

    total_assets: 0,
    total_liabilities: 0,
    equity: 0,
    net_income: 0,

    template_id: null,
    created_from_prior: null,
    status: 'active',
  };
}
