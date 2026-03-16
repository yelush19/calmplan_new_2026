/**
 * ══ Workbook Export Engine ══
 * ייצוא חוברת עבודה לאקסל / PDF
 * משתמש ב-SheetJS (xlsx) שכבר מותקן בפרויקט
 */
import * as XLSX from 'xlsx';

// ── פורמט מספרים ──
const fmtNum = (val) => {
  if (val == null || val === '') return '';
  const n = typeof val === 'string' ? parseFloat(val) : val;
  return isNaN(n) ? '' : n;
};

/**
 * ייצוא חוברת עבודה לקובץ אקסל (.xlsx)
 * @param {Object} workbook — אובייקט חוברת העבודה מהמערכת
 * @returns {void} — מוריד קובץ לדפדפן
 */
export function exportToExcel(workbook) {
  const wb = XLSX.utils.book_new();

  // ═══ טאב 1: בוחן והפניות ═══
  buildTrialBalanceSheet(wb, workbook);

  // ═══ טאבים: גליונות עבודה ═══
  (workbook.worksheets || []).forEach(ws => {
    buildWorksheetTab(wb, ws);
  });

  // ═══ טאב אחרון: פקודות יומן ═══
  if (workbook.adjustments?.length > 0) {
    buildAdjustmentsSheet(wb, workbook.adjustments);
  }

  // ── הורדה ──
  const fileName = `חוברת_עבודה_${workbook.client_name}_${workbook.tax_year}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

/**
 * בניית גליון בוחן והפניות
 */
function buildTrialBalanceSheet(wb, workbook) {
  const rows = [];

  // כותרת
  rows.push([workbook.client_name, '', '', '', '', '', '']);
  rows.push([`מאזן בוחן — שנת מס ${workbook.tax_year}`, '', '', '', '', '', '']);
  rows.push([]); // שורה ריקה
  rows.push(['מיון', 'חשבון', 'שם חשבון', 'חובה', 'זכות', 'הפרש', 'סטטוס', 'הפניה']);

  const groups = workbook.trial_balance?.groups || [];
  groups.forEach(group => {
    // כותרת קבוצה
    rows.push([group.group_code, '', group.label, '', '', '', group.status || '', '']);

    // שורות חשבונות
    (group.accounts || []).forEach(acc => {
      rows.push([
        acc.account_group || group.group_code,
        acc.account_code || '',
        acc.account_name || '',
        fmtNum(acc.debit),
        fmtNum(acc.credit),
        fmtNum(acc.difference),
        acc.reference_status || '',
        acc.reference_note || '',
      ]);
    });

    // שורת סיכום
    const s = group.summary || {};
    rows.push([
      '',
      '',
      `סה"כ ${group.label}`,
      fmtNum(s.debit),
      fmtNum(s.credit),
      fmtNum(s.difference),
      '',
      '',
    ]);
    rows.push([]); // רווח בין קבוצות
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // עיצוב עמודות
  ws['!cols'] = [
    { wch: 8 },   // מיון
    { wch: 10 },  // חשבון
    { wch: 30 },  // שם חשבון
    { wch: 14 },  // חובה
    { wch: 14 },  // זכות
    { wch: 14 },  // הפרש
    { wch: 18 },  // סטטוס
    { wch: 30 },  // הפניה
  ];

  // RTL
  ws['!sheetViews'] = [{ rightToLeft: true }];

  XLSX.utils.book_append_sheet(wb, ws, 'בוחן והפניות');
}

/**
 * בניית טאב גליון עבודה
 */
function buildWorksheetTab(wb, worksheet) {
  const rows = [];

  // כותרת
  rows.push([worksheet.label || worksheet.key]);
  rows.push([]); // רווח

  // כותרות עמודות
  const cols = worksheet.columns || [];
  rows.push(cols.map(c => c.label));

  // שורות נתונים
  (worksheet.rows || []).forEach(row => {
    rows.push(cols.map(c => {
      const val = row[c.key];
      return c.type === 'number' ? fmtNum(val) : (val || '');
    }));
  });

  // שורת סיכום
  if ((worksheet.rows || []).length > 0) {
    const totalsRow = cols.map(c => {
      if (c.type !== 'number') return c === cols[0] ? 'סה"כ' : '';
      return fmtNum(
        (worksheet.rows || []).reduce((sum, r) => sum + (parseFloat(r[c.key]) || 0), 0)
      );
    });
    rows.push(totalsRow);
  }

  // הערות
  if (worksheet.notes) {
    rows.push([]);
    rows.push(['הערות:', worksheet.notes]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = cols.map(() => ({ wch: 16 }));
  ws['!sheetViews'] = [{ rightToLeft: true }];

  // שם טאב — מקסימום 31 תווים (מגבלת אקסל)
  const tabName = (worksheet.label || worksheet.key).slice(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, tabName);
}

/**
 * בניית טאב פקודות יומן
 */
function buildAdjustmentsSheet(wb, adjustments) {
  const rows = [];
  rows.push(['פקודות יומן — תיקוני מאזן']);
  rows.push([]);
  rows.push(['#', 'חשבון חובה', 'חשבון זכות', 'סכום', 'תיאור', 'תאריך']);

  adjustments.forEach((adj, idx) => {
    rows.push([
      idx + 1,
      adj.debit_account || '',
      adj.credit_account || '',
      fmtNum(adj.amount),
      adj.description || '',
      adj.date || '',
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 5 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 30 }, { wch: 12 },
  ];
  ws['!sheetViews'] = [{ rightToLeft: true }];
  XLSX.utils.book_append_sheet(wb, ws, 'פקודות יומן');
}

/**
 * ייצוא מהיר ל-CSV (לייבוא למערכות אחרות)
 * @param {Object} workbook
 * @returns {string} CSV content
 */
export function exportTrialBalanceCSV(workbook) {
  const rows = [['מיון', 'חשבון', 'שם חשבון', 'חובה', 'זכות', 'הפרש']];

  const groups = workbook.trial_balance?.groups || [];
  groups.forEach(group => {
    (group.accounts || []).forEach(acc => {
      rows.push([
        acc.account_group || group.group_code,
        acc.account_code || '',
        acc.account_name || '',
        fmtNum(acc.debit),
        fmtNum(acc.credit),
        fmtNum(acc.difference),
      ]);
    });
  });

  return rows.map(r => r.join(',')).join('\n');
}

/**
 * הורדת CSV כקובץ
 */
export function downloadCSV(workbook) {
  const csv = exportTrialBalanceCSV(workbook);
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM for Hebrew
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `בוחן_${workbook.client_name}_${workbook.tax_year}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
