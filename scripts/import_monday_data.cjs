/**
 * Import script: reads Monday Excel files and generates localStorage-compatible JSON
 * for clients and bank accounts.
 *
 * Run: node scripts/import_monday_data.cjs
 * Output: scripts/import_data.json - to be loaded into the browser
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// ─── Parse Clients Excel ─────────────────────────────────────────
const clientsWb = XLSX.readFile(path.join(__dirname, '..', 'export_1770887033.xlsx'));
const clientsWs = clientsWb.Sheets[clientsWb.SheetNames[0]];
const clientsRaw = XLSX.utils.sheet_to_json(clientsWs, { defval: '' });

// Skip header rows and filter out section headers/empty
const clientRows = clientsRaw.slice(1).filter(r => {
  const name = r['לקוחות'];
  return name && name !== 'Name' && name.length > 1 && name !== 'לקוחות 2024';
});

function parseFrequency(freq) {
  if (!freq) return 'not_applicable';
  const f = freq.trim();
  if (f === 'חודשי') return 'monthly';
  if (f === 'דו-חודשי' || f === 'דו חודשי') return 'bimonthly';
  if (f === 'חצי שנתי') return 'semi_annual';
  if (f === 'לא רלוונטי' || f === 'לבדוק קיום') return 'not_applicable';
  return 'monthly';
}

function parseVatDeadline(deadline) {
  if (!deadline) return { type: 'periodic', day: 19 };
  if (deadline.includes('874')) return { type: '874', day: 23 };
  if (deadline.includes('19') || deadline.includes('דיגיטלי')) return { type: 'periodic', day: 19 };
  if (deadline.includes('15') || deadline.includes('רגיל')) return { type: 'periodic', day: 15 };
  if (deadline.includes('לא רלוונטי')) return { type: 'not_applicable', day: 0 };
  return { type: 'periodic', day: 19 };
}

function parseStatus(status) {
  if (!status) return 'active';
  if (status === 'פעיל') return 'active';
  if (status === 'עבר') return 'inactive';
  if (status === 'פיתוח') return 'inactive';
  return 'active';
}

function parseServiceTypes(serviceType, extraServices) {
  const types = [];
  if (!serviceType) return types;
  if (serviceType.includes('הנה"ח') || serviceType.includes('הנה\"ח')) types.push('bookkeeping');
  if (serviceType.includes('שכר')) types.push('payroll');
  // Parse extra services
  if (extraServices) {
    if (extraServices.includes('משלוח תלושים')) types.push('payslip_sending');
    if (extraServices.includes('דיווח למתפעל')) types.push('operator_reporting');
    if (extraServices.includes('דיווח לטמל')) types.push('tamal_reporting');
    if (extraServices.includes('מס"ב')) types.push('masav');
  }
  return types;
}

const clients = clientRows.map(r => {
  const vatDeadline = parseVatDeadline(r['__EMPTY_17']);
  const isDevProject = ['פיתוח'].includes(r['__EMPTY_16']);

  // Skip pure dev/project items (not real clients)
  if (isDevProject || r['לקוחות'].includes('ליתאי -') || r['לקוחות'].includes('ליתאי פיתוח')) {
    return null;
  }

  return {
    name: r['לקוחות'],
    monday_id: r['__EMPTY_1'] || null,
    entity_number: r['__EMPTY_3'] || '',
    status: parseStatus(r['__EMPTY_16']),
    service_types: parseServiceTypes(r['__EMPTY_9'], r['__EMPTY_8']),
    tax_info: {
      tax_id: r['__EMPTY_3'] || '',
      vat_file_number: '',
      tax_deduction_file_number: r['__EMPTY_5'] || '',
      social_security_file_number: '',
      direct_transmission: false,
      // Current year IDs are the same (until new year IDs come)
      annual_tax_ids: {
        current_year: '2026',
        tax_advances_id: r['__EMPTY_4'] || '',
        tax_advances_percentage: '',
        social_security_id: r['__EMPTY_6'] || '',
        deductions_id: r['__EMPTY_7'] || '',
        last_updated: new Date().toISOString(),
        updated_by: 'Monday Import'
      },
      // User said: "מזהים בלוח לקוחות שייכים לשנת 2025"
      prev_year_ids: {
        tax_advances_id: r['__EMPTY_4'] || '',
        tax_advances_percentage: '',
        social_security_id: r['__EMPTY_6'] || '',
        deductions_id: r['__EMPTY_7'] || '',
      }
    },
    reporting_info: {
      vat_reporting_frequency: parseFrequency(r['__EMPTY_14']),
      tax_advances_frequency: parseFrequency(r['__EMPTY_13']),
      deductions_frequency: parseFrequency(r['__EMPTY_12']),
      social_security_frequency: parseFrequency(r['__EMPTY_11']),
      payroll_frequency: r['__EMPTY_9']?.includes('שכר') ? 'monthly' : 'not_applicable',
      vat_report_type: vatDeadline.type === '874' ? '874' : 'periodic',
    },
    business_info: {
      business_size: 'small',
      business_type: r['__EMPTY_3']?.length >= 9 ? 'company' : 'sole_proprietor',
      estimated_monthly_hours: {}
    },
    integration_info: {
      monday_board_id: '',
      monday_item_id: '',
    },
    communication_preferences: {
      preferred_method: 'whatsapp'
    },
    billing_info: {},
    contacts: r['__EMPTY_22'] ? [{ name: r['__EMPTY_22'], is_primary: true }] : [],
    notes: r['__EMPTY_21'] || '',
    accountant: r['__EMPTY_10'] || '',
    extra_services: r['__EMPTY_8'] || '',
    deadlines: {
      vat: r['__EMPTY_17'] || '',
      advances: r['__EMPTY_18'] || '',
      deductions: r['__EMPTY_19'] || '',
      social_security: r['__EMPTY_20'] || '',
    }
  };
}).filter(Boolean);

console.log(`Parsed ${clients.length} clients (${clients.filter(c=>c.status==='active').length} active, ${clients.filter(c=>c.status==='inactive').length} inactive)`);

// ─── Parse Bank Accounts Excel ─────────────────────────────────────
const banksWb = XLSX.readFile(path.join(__dirname, '..', 'export_1770887159 חשבונות בנק וסליקה.xlsx'));
const banksWs = banksWb.Sheets[banksWb.SheetNames[0]];
const banksRaw = XLSX.utils.sheet_to_json(banksWs, { defval: '' });

const accountRows = banksRaw.slice(2).filter(r => {
  const n = r[Object.keys(r)[0]];
  return n && n !== 'Name' && n.length > 2;
});

function excelDateToISO(val) {
  if (!val) return null;
  if (typeof val === 'number') {
    // Excel date serial number
    const date = new Date((val - 25569) * 86400 * 1000);
    return date.toISOString().split('T')[0];
  }
  return String(val);
}

const bankAccounts = accountRows.map(r => ({
  name: r[Object.keys(r)[0]],
  client_name: r['__EMPTY_1'] || '',
  calmplan_client_id: r['__EMPTY_2'] || '',
  account_type: r['__EMPTY_5'] || '',
  account_number: r['__EMPTY_6'] || '',
  bank_name: r['__EMPTY_7'] || '',
  reconciliation_system: r['__EMPTY_8'] || '',
  bookkeeping_card_number: r['__EMPTY_9'] || '',
  reconciliation_frequency: r['__EMPTY_10'] || '',
  last_reconciliation_date: excelDateToISO(r['__EMPTY_11']),
  next_target_date: excelDateToISO(r['__EMPTY_12']),
  status: r['__EMPTY_13'] || 'פעיל',
  notes: r['__EMPTY_14'] || '',
}));

console.log(`Parsed ${bankAccounts.length} bank accounts`);

// ─── Generate import data JSON ─────────────────────────────────────
const importData = {
  clients,
  bankAccounts,
  generated: new Date().toISOString(),
};

fs.writeFileSync(
  path.join(__dirname, 'import_data.json'),
  JSON.stringify(importData, null, 2),
  'utf8'
);

console.log('Wrote scripts/import_data.json');
console.log('\nClient breakdown:');
clients.forEach(c => {
  const vatType = c.reporting_info.vat_report_type === '874' ? '874' : 'תקופתי';
  console.log(`  ${c.status === 'active' ? '✓' : '✗'} ${c.name} | ${vatType} | ${c.service_types.join(',')}`);
});
