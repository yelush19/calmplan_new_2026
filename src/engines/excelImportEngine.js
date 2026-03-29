/**
 * ══ Excel Import Engine ══
 * ייבוא בוחן מחשבשבת (Hashavshevet) לחוברת עבודה
 *
 * Hashavshevet RTL Excel layout (visual order right-to-left):
 * Visual A (rightmost) = Group header names ("רכוש קבוע", "חלויות שוטפות")
 * Visual B = Sort/Group code (12, 13, 14, 15, 90, 100, 200...)
 * Visual C = Account/Card number (1000, 1206, 74361338...)
 * Visual D = Account name ("מחשבים-ר.קבוע", "שיפורים במושכר")
 * Visual E-H = Amounts (debit/credit opening/closing)
 *
 * In XLSX.js parsed data (LTR):
 * These map to the LAST columns (reversed from visual RTL order)
 */
import * as XLSX from 'xlsx';

export async function parseHashavshevetExcel(file) {
  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return { success: false, accounts: [], groups: {}, errors: ['הקובץ ריק'] };

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (rows.length < 3) return { success: false, accounts: [], groups: {}, errors: ['פחות מ-3 שורות'] };

    // Find the max column count
    const maxCols = Math.max(...rows.map(r => (r || []).length));

    // In RTL Excel exported via XLSX.js:
    // The LAST column in array = visual column A (rightmost = group headers)
    // Second to last = visual column B (sort code)
    // Third to last = visual column C (account number)
    // etc.
    // BUT - some exports keep LTR order. We need to auto-detect.

    // Strategy: find the column with sort codes (small numbers 10-999)
    // and the column with account codes (larger numbers 1000+)
    let sortCodeCol = -1;
    let accountCodeCol = -1;
    let nameCol = -1;
    const colScores = {};

    for (let c = 0; c < maxCols; c++) {
      let smallNums = 0, bigNums = 0, texts = 0, empties = 0;
      for (let r = 1; r < Math.min(50, rows.length); r++) {
        const val = rows[r]?.[c];
        if (val === '' || val == null) { empties++; continue; }
        const num = parseFloat(val);
        if (isNaN(num)) { texts++; continue; }
        if (num >= 10 && num <= 999) smallNums++;
        else if (num >= 1000) bigNums++;
      }
      colScores[c] = { smallNums, bigNums, texts, empties };
    }

    // Sort code column = most small numbers (10-999)
    // Account code column = most big numbers (1000+)
    // Name column = most text entries
    let bestSmall = 0, bestBig = 0, bestText = 0;
    for (const [c, scores] of Object.entries(colScores)) {
      const ci = parseInt(c);
      if (scores.smallNums > bestSmall) { bestSmall = scores.smallNums; sortCodeCol = ci; }
      if (scores.bigNums > bestBig) { bestBig = scores.bigNums; accountCodeCol = ci; }
    }
    // Name = column with most text that isn't sort or account
    for (const [c, scores] of Object.entries(colScores)) {
      const ci = parseInt(c);
      if (ci === sortCodeCol || ci === accountCodeCol) continue;
      if (scores.texts > bestText) { bestText = scores.texts; nameCol = ci; }
    }

    // Find amount columns (remaining numeric columns)
    const amountCols = [];
    for (const [c, scores] of Object.entries(colScores)) {
      const ci = parseInt(c);
      if (ci === sortCodeCol || ci === accountCodeCol || ci === nameCol) continue;
      if (scores.smallNums + scores.bigNums > 3) amountCols.push(ci);
    }

    // Group header column = column with text that appears in rows where sort code is empty
    // Usually the column AFTER the last data column, or a column with few entries but long text
    let headerCol = -1;
    for (const [c, scores] of Object.entries(colScores)) {
      const ci = parseInt(c);
      if (ci === sortCodeCol || ci === accountCodeCol || ci === nameCol) continue;
      if (amountCols.includes(ci)) continue;
      if (scores.texts >= 3 && scores.texts < bestText) { headerCol = ci; }
    }
    // If not found, check if it's the last or first column
    if (headerCol < 0) {
      // Try last column
      const lastScores = colScores[maxCols - 1];
      if (lastScores && lastScores.texts >= 3) headerCol = maxCols - 1;
      // Try first column
      else if (colScores[0]?.texts >= 3 && 0 !== nameCol) headerCol = 0;
    }

    if (sortCodeCol < 0 || nameCol < 0) {
      return { success: false, accounts: [], groups: {}, errors: [`לא זוהו עמודות. sortCode=${sortCodeCol} name=${nameCol} account=${accountCodeCol}`] };
    }

    // Parse data
    const accounts = [];
    const groupedAccounts = {};
    const groupNames = {};
    let currentGroupName = 'כללי';
    let currentGroupCode = 'other';

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;

      const sortVal = String(row[sortCodeCol] || '').trim();
      const acctVal = String(row[accountCodeCol] || '').trim();
      const nameVal = String(row[nameCol] || '').trim();
      const headerVal = headerCol >= 0 ? String(row[headerCol] || '').trim() : '';

      // Skip summary rows
      if (nameVal.includes('סה"כ') || headerVal.includes('סה"כ') || sortVal === '**' || sortVal === '*') continue;

      // Group header detection: row with text in header column but no sort code and no account code
      if (headerVal && !sortVal && !acctVal && headerVal.length > 1 && isNaN(parseFloat(headerVal)) && !headerVal.includes('סה"כ')) {
        currentGroupName = headerVal;
        continue;
      }
      // Also check name column for group headers (if no account code)
      if (nameVal && !sortVal && !acctVal && nameVal.length > 1 && isNaN(parseFloat(nameVal)) && !nameVal.includes('סה"כ')) {
        currentGroupName = nameVal;
        continue;
      }

      // Update current group code from sort column
      if (sortVal && !isNaN(parseInt(sortVal))) {
        currentGroupCode = sortVal;
        if (!groupNames[currentGroupCode]) {
          groupNames[currentGroupCode] = currentGroupName;
        }
      }

      // Must have at least a name to be a data row
      if (!nameVal || nameVal.length < 2) continue;
      // Skip if no numbers at all
      const hasAnyNumber = acctVal || amountCols.some(c => parseFloat(row[c]));
      if (!hasAnyNumber) continue;

      // Parse amounts
      let debit = 0, credit = 0;
      if (amountCols.length >= 2) {
        // Try to find the closing balance columns (usually last two with data)
        const amounts = amountCols.map(c => parseFloat(row[c]) || 0);
        // Use first non-zero pair, or last two
        debit = Math.abs(amounts[amounts.length - 2] || amounts[0] || 0);
        credit = Math.abs(amounts[amounts.length - 1] || amounts[1] || 0);
      } else if (amountCols.length === 1) {
        const val = parseFloat(row[amountCols[0]]) || 0;
        if (val >= 0) debit = val; else credit = Math.abs(val);
      }

      const groupKey = `group_${currentGroupCode}`;
      const account = {
        id: `imp_${Date.now()}_${i}`,
        account_code: acctVal || '',
        account_name: nameVal,
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
      return { success: false, accounts: [], groups: {}, errors: ['לא נמצאו חשבונות. וודאי שזה בוחן מחשבשבת.'] };
    }

    const groupSummary = {};
    for (const [key, accs] of Object.entries(groupedAccounts)) {
      const code = key.replace('group_', '');
      groupSummary[key] = {
        label: groupNames[code] || `קבוצה ${code}`,
        sortCode: code,
        count: accs.length,
        totalDebit: accs.reduce((s, a) => s + a.debit, 0),
        totalCredit: accs.reduce((s, a) => s + a.credit, 0),
      };
    }

    return { success: true, accounts, groups: groupedAccounts, groupSummary, totalAccounts: accounts.length, sheetName, errors: [] };
  } catch (err) {
    return { success: false, accounts: [], groups: {}, errors: [`שגיאה: ${err.message}`] };
  }
}
