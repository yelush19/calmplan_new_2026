const XLSX = require('xlsx');

// Parse bank accounts
const wb = XLSX.readFile('/home/user/calmplan_new_2026/export_1770887159 חשבונות בנק וסליקה.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const raw = XLSX.utils.sheet_to_json(ws, {defval: ''});
const data = raw.slice(2).filter(r => {
  const n = r[Object.keys(r)[0]];
  return n && n !== 'Name' && n.length > 2;
});
console.log('=== Total accounts:', data.length);

const byClient = {};
data.forEach(r => {
  const c = r['__EMPTY_1'] || 'unknown';
  if (!byClient[c]) byClient[c] = [];
  byClient[c].push({
    name: r[Object.keys(r)[0]],
    type: r['__EMPTY_5'],
    account_number: r['__EMPTY_6'],
    bank: r['__EMPTY_7'],
    system: r['__EMPTY_8'],
    card_number: r['__EMPTY_9'],
    frequency: r['__EMPTY_10'],
    last_reconcile: r['__EMPTY_11'],
    next_target: r['__EMPTY_12'],
    status: r['__EMPTY_13'],
    notes: r['__EMPTY_14'],
  });
});

Object.entries(byClient).forEach(([client, accs]) => {
  console.log(client + ': ' + accs.length + ' accounts');
  accs.forEach(a => console.log('  - ' + a.type + ': ' + a.name + ' (' + a.status + ')'));
});
