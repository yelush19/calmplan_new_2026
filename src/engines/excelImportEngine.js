/**
 * ══ Excel Import Engine ══
 * ייבוא בוחן מחשבשבת (Hashavshevet) לחוברת עבודה
 *
 * Hashavshevet export format (typical):
 * Column A: מספר חשבון (Account Code)
 * Column B: שם חשבון (Account Name)
 * Column C: יתרה פותחת חובה (Opening Debit)
 * Column D: יתרה פותחת זכות (Opening Credit)
 * Column E: תנועות חובה (Debit Movements)
 * Column F: תנועות זכות (Credit Movements)
 * Column G: יתרה סוגרת חובה (Closing Debit)
 * Column H: יתרה סוגרת זכות (Closing Credit)
 */
import * as XLSX from 'xlsx';
import { DEFAULT_ACCOUNT_GROUPS } from '@/config/balanceWorkbookTemplates';

// Hebrew + English column name mapping
const COLUMN_ALIASES = {
  account_code: ['מספר חשבון', 'חשבון', 'מס חשבון', 'קוד חשבון', 'account', 'code', 'account_code', 'מספר'],
  account_name: ['שם חשבון', 'שם', 'תיאור', 'name', 'account_name', 'description'],
  debit: ['יתרה חובה', 'חובה', 'יתרת חובה', 'יתרה סוגרת חובה', 'debit', 'סוגר חובה'],
  credit: ['יתרה זכות', 'זכות', 'יתרת זכות', 'יתרה סוגרת זכות', 'credit', 'סוגר זכות'],
};

// Account code → group mapping (by first digits)
const CODE_TO_GROUP = {
  '10': 'bank_1',      // 100-109: בנקים
  '11': 'bank_2',      // 110-119: בנק נוסף
  '12': 'credit_cards', // 120-129: אשראי
  '13': 'loans_given',  // 130: הלוואות
  '20': 'customers',    // 200-299: לקוחות
  '30': 'fixed_assets', // 300-399: רכוש קבוע
  '40': 'suppliers',    // 400-499: ספקים
  '42': 'authorities',  // 420-429: רשויות
  '50': 'employee_provisions', // 500-599: הפרשות
  '60': 'equity',       // 600-699: הון
  '70': 'income',       // 700-799: הכנסות
  '80': 'expenses',     // 800-899: הוצאות
  '83': 'payroll',      // 830: שכר
};

function matchGroup(accountCode) {
  const code = String(accountCode).trim();
  // Try exact 2-digit prefix match first
  for (const [prefix, groupKey] of Object.entries(CODE_TO_GROUP)) {
    if (code.startsWith(prefix)) return groupKey;
  }
  // Fallback by range
  const num = parseInt(code);
  if (num >= 100 && num < 200) return 'bank_1';
  if (num >= 200 && num < 300) return 'customers';
  if (num >= 300 && num < 400) return 'fixed_assets';
  if (num >= 400 && num < 500) return 'suppliers';
  if (num >= 500 && num < 600) return 'employee_provisions';
  if (num >= 600 && num < 700) return 'equity';
  return 'other';
}

function findColumn(headers, aliases) {
  for (const alias of aliases) {
    const idx = headers.findIndex(h => h && String(h).trim().toLowerCase() === alias.toLowerCase());
    if (idx >= 0) return idx;
  }
  // Partial match
  for (const alias of aliases) {
    const idx = headers.findIndex(h => h && String(h).trim().toLowerCase().includes(alias.toLowerCase()));
    if (idx >= 0) return idx;
  }
  return -1;
}

/**
 * Parse Excel file from Hashavshevet trial balance export.
 *
 * @param {File} file - The uploaded Excel file
 * @returns {Promise<{ success: boolean, accounts: Array, groups: Object, errors: string[] }>}
 */
export async function parseHashavshevetExcel(file) {
  const errors = [];

  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });

    // Use first sheet
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return { success: false, accounts: [], groups: {}, errors: ['הקובץ ריק — אין גליונות'] };
    }

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    if (rows.length < 2) {
      return { success: false, accounts: [], groups: {}, errors: ['הקובץ ריק — פחות מ-2 שורות'] };
    }

    // Find header row (first row with identifiable column names)
    let headerRowIdx = -1;
    let headers = [];
    for (let i = 0; i < Math.min(10, rows.length); i++) {
      const row = rows[i];
      if (!row || row.length < 2) continue;
      const asStrings = row.map(c => String(c || '').trim());
      const codeCol = findColumn(asStrings, COLUMN_ALIASES.account_code);
      const nameCol = findColumn(asStrings, COLUMN_ALIASES.account_name);
      if (codeCol >= 0 && nameCol >= 0) {
        headerRowIdx = i;
        headers = asStrings;
        break;
      }
    }

    if (headerRowIdx < 0) {
      return { success: false, accounts: [], groups: {}, errors: ['לא נמצאה שורת כותרות עם "מספר חשבון" ו"שם חשבון"'] };
    }

    // Map columns
    const colMap = {
      code: findColumn(headers, COLUMN_ALIASES.account_code),
      name: findColumn(headers, COLUMN_ALIASES.account_name),
      debit: findColumn(headers, COLUMN_ALIASES.debit),
      credit: findColumn(headers, COLUMN_ALIASES.credit),
    };

    if (colMap.code < 0 || colMap.name < 0) {
      return { success: false, accounts: [], groups: {}, errors: ['לא נמצאו עמודות חובה: מספר חשבון + שם חשבון'] };
    }

    // Parse data rows
    const accounts = [];
    const groupedAccounts = {};

    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 2) continue;

      const code = String(row[colMap.code] || '').trim();
      const name = String(row[colMap.name] || '').trim();

      // Skip empty rows, header repeats, summary rows
      if (!code || !name) continue;
      if (code === 'סה"כ' || name === 'סה"כ' || code === 'סיכום') continue;

      const debit = parseFloat(row[colMap.debit]) || 0;
      const credit = parseFloat(row[colMap.credit]) || 0;
      const difference = debit - credit;
      const groupKey = matchGroup(code);

      const account = {
        id: `imp_${Date.now()}_${i}`,
        account_code: code,
        account_name: name,
        debit: Math.abs(debit),
        credit: Math.abs(credit),
        difference,
        reference_status: 'not_started',
        reference_note: '',
        _importedGroup: groupKey,
      };

      accounts.push(account);

      if (!groupedAccounts[groupKey]) groupedAccounts[groupKey] = [];
      groupedAccounts[groupKey].push(account);
    }

    if (accounts.length === 0) {
      return { success: false, accounts: [], groups: {}, errors: ['לא נמצאו חשבונות בקובץ'] };
    }

    // Map to group labels
    const groupLabels = {};
    DEFAULT_ACCOUNT_GROUPS.forEach(g => { groupLabels[g.key] = g.label; });

    const groupSummary = {};
    for (const [key, accs] of Object.entries(groupedAccounts)) {
      groupSummary[key] = {
        label: groupLabels[key] || key,
        count: accs.length,
        totalDebit: accs.reduce((s, a) => s + a.debit, 0),
        totalCredit: accs.reduce((s, a) => s + a.credit, 0),
      };
    }

    return {
      success: true,
      accounts,
      groups: groupedAccounts,
      groupSummary,
      totalAccounts: accounts.length,
      sheetName,
      errors,
    };

  } catch (err) {
    return { success: false, accounts: [], groups: {}, errors: [`שגיאה בקריאת הקובץ: ${err.message}`] };
  }
}
