/**
 * ══ Excel Import Engine ══
 * ייבוא בוחן מחשבשבת (Hashavshevet) לחוברת עבודה
 *
 * Hashavshevet trial balance format:
 * Column A (rightmost in RTL): Group header names (bold rows like "רכוש קבוע", "חלויות שוטפות")
 * Column B: Sort code / Group code (12, 13, 14, 15, 90, 100, 200...)
 * Column C: Account number / Card number (1206, 1207, 74361338...)
 * Column D: Account name
 * Column E-H: Debit/Credit amounts
 *
 * Group headers are rows where column A has text but columns C/D are empty.
 * Summary rows contain "סה"כ" or "**".
 */
import * as XLSX from 'xlsx';

/**
 * Parse Excel file from Hashavshevet trial balance export.
 * Uses SORT CODE (column B) as group identifier + reads Hebrew group headers.
 */
export async function parseHashavshevetExcel(file) {
  const errors = [];

  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return { success: false, accounts: [], groups: {}, errors: ['הקובץ ריק — אין גליונות'] };
    }

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (rows.length < 2) {
      return { success: false, accounts: [], groups: {}, errors: ['הקובץ ריק — פחות מ-2 שורות'] };
    }

    // Detect column layout by scanning first rows
    // Hashavshevet exports: A=group header, B=sort code, C=account number, D=account name, E-H=amounts
    // But columns may vary. We detect by finding numeric patterns.

    let sortCodeCol = -1;   // Column with sort/group codes (12, 13, 100, 200...)
    let accountCodeCol = -1; // Column with account/card numbers (1206, 74361338...)
    let accountNameCol = -1; // Column with account names
    let amountCols = [];     // Columns with numeric amounts

    // Scan first 30 data rows to detect column purposes
    for (let i = 0; i < Math.min(30, rows.length); i++) {
      const row = rows[i];
      if (!row || row.length < 3) continue;

      for (let c = 0; c < row.length; c++) {
        const val = String(row[c] || '').trim();
        if (!val) continue;

        // Header detection: Hebrew column names
        const lower = val.toLowerCase();
        if (lower === 'מיון' || lower === 'קוד מיון' || lower === 'מיון מס') { sortCodeCol = c; continue; }
        if (lower === 'כרטיס' || lower === 'מספר כרטיס' || lower === 'חשבון' || lower === 'מס חשבון') { accountCodeCol = c; continue; }
        if (lower === 'שם' || lower === 'שם חשבון' || lower === 'תאור' || lower === 'תיאור') { accountNameCol = c; continue; }
      }
    }

    // If headers not found, use positional heuristic for Hashavshevet:
    // Typically: last col = group header (A in RTL), then sort code, account code, name, amounts
    if (sortCodeCol < 0 || accountCodeCol < 0) {
      // Try to find by data patterns: sort code = small numbers (10-900), account code = larger numbers
      for (let i = 1; i < Math.min(20, rows.length); i++) {
        const row = rows[i];
        if (!row) continue;
        for (let c = 0; c < Math.min(5, row.length); c++) {
          const num = parseInt(row[c]);
          if (isNaN(num)) continue;
          if (num >= 10 && num <= 999 && sortCodeCol < 0) { sortCodeCol = c; }
          else if (num >= 1000 && accountCodeCol < 0 && c !== sortCodeCol) { accountCodeCol = c; }
        }
        if (sortCodeCol >= 0 && accountCodeCol >= 0) break;
      }
    }

    // Find name column: first text column that's not sort/account code
    if (accountNameCol < 0) {
      for (let i = 1; i < Math.min(10, rows.length); i++) {
        const row = rows[i];
        if (!row) continue;
        for (let c = 0; c < row.length; c++) {
          if (c === sortCodeCol || c === accountCodeCol) continue;
          const val = String(row[c] || '').trim();
          if (val && isNaN(parseFloat(val)) && val.length > 2) { accountNameCol = c; break; }
        }
        if (accountNameCol >= 0) break;
      }
    }

    // Find amount columns: numeric columns that aren't sort/account code
    for (let c = 0; c < (rows[1]?.length || 0); c++) {
      if (c === sortCodeCol || c === accountCodeCol || c === accountNameCol) continue;
      let numCount = 0;
      for (let i = 1; i < Math.min(15, rows.length); i++) {
        const val = parseFloat(rows[i]?.[c]);
        if (!isNaN(val) && val !== 0) numCount++;
      }
      if (numCount >= 2) amountCols.push(c);
    }

    if (accountNameCol < 0) {
      return { success: false, accounts: [], groups: {}, errors: ['לא נמצאה עמודת שם חשבון'] };
    }

    // Parse: identify group headers + accounts
    const accounts = [];
    const groupedAccounts = {};
    const groupNames = {}; // sortCode → Hebrew name
    let currentGroupCode = 'other';
    let currentGroupName = 'אחר';

    // First pass: find group header rows (text in rightmost column, no account code)
    const lastCol = rows[0] ? rows[0].length - 1 : 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 2) continue;

      const sortCode = String(row[sortCodeCol] || '').trim();
      const accountCode = String(row[accountCodeCol] || '').trim();
      const accountName = String(row[accountNameCol] || '').trim();

      // Skip summary rows
      if (accountName.includes('סה"כ') || sortCode === '**' || sortCode === '*') continue;

      // Detect group header: has a name in the last/first column but NO account code
      // Group headers in Hashavshevet are bold rows like "רכוש קבוע", "חלויות שוטפות"
      const headerText = String(row[lastCol] || '').trim() || String(row[0] || '').trim();
      if (headerText && !accountCode && !sortCode && headerText.length > 1 && isNaN(parseFloat(headerText))) {
        // This is a group header row
        currentGroupName = headerText;
        continue;
      }

      // If sort code exists, use it as group identifier
      if (sortCode && !isNaN(parseInt(sortCode))) {
        currentGroupCode = sortCode;
        if (!groupNames[sortCode]) {
          groupNames[sortCode] = currentGroupName;
        }
      }

      // Skip rows without account code (empty data rows)
      if (!accountCode || isNaN(parseInt(accountCode))) continue;

      // Parse amounts - take last two amount columns as debit/credit, or first two
      let debit = 0, credit = 0;
      if (amountCols.length >= 2) {
        // Closing balances are usually the last two amount columns
        debit = Math.abs(parseFloat(row[amountCols[amountCols.length - 2]]) || 0);
        credit = Math.abs(parseFloat(row[amountCols[amountCols.length - 1]]) || 0);
      } else if (amountCols.length === 1) {
        const val = parseFloat(row[amountCols[0]]) || 0;
        if (val >= 0) debit = val; else credit = Math.abs(val);
      }

      const groupKey = `group_${currentGroupCode}`;
      const account = {
        id: `imp_${Date.now()}_${i}`,
        account_code: accountCode,
        account_name: accountName,
        group_code: currentGroupCode,
        debit,
        credit,
        difference: debit - credit,
        reference_status: 'not_started',
        reference_note: '',
      };

      accounts.push(account);
      if (!groupedAccounts[groupKey]) groupedAccounts[groupKey] = [];
      groupedAccounts[groupKey].push(account);
    }

    if (accounts.length === 0) {
      return { success: false, accounts: [], groups: {}, errors: ['לא נמצאו חשבונות בקובץ. וודאי שזה ייצוא בוחן מחשבשבת.'] };
    }

    // Build group summary with Hebrew names
    const groupSummary = {};
    for (const [key, accs] of Object.entries(groupedAccounts)) {
      const sortCode = key.replace('group_', '');
      const label = groupNames[sortCode] || `קבוצה ${sortCode}`;
      groupSummary[key] = {
        label,
        sortCode,
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
