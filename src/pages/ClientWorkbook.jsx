import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Client } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableFooter
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Search, ArrowUpDown, Users, CheckCircle } from 'lucide-react';
import { computeComplexityTier, getTierInfo } from '@/lib/complexity';

// ── Status config ──
const STATUS_OPTIONS = [
  { value: 'active', label: 'פעיל', color: 'bg-green-100 text-green-800' },
  { value: 'inactive', label: 'לא פעיל', color: 'bg-gray-100 text-gray-700' },
  { value: 'potential', label: 'פוטנציאלי', color: 'bg-blue-100 text-blue-800' },
  { value: 'former', label: 'לשעבר', color: 'bg-red-100 text-red-700' },
];

const PAYMENT_METHOD_OPTIONS = [
  { value: 'masav', label: 'מס״ב' },
  { value: 'credit_card', label: 'כרטיס אשראי' },
  { value: 'bank_standing_order', label: 'הו״ק בנקאית' },
  { value: 'standing_order', label: 'כתב אישור (כ״א)' },
  { value: 'check', label: 'המחאה' },
  { value: 'client_pays', label: 'לקוח' },
  { value: 'payment_plan', label: 'הסדר' },
];

const BUSINESS_TYPE_OPTIONS = [
  { value: 'company', label: 'חברה' },
  { value: 'freelancer', label: 'עוסק' },
  { value: 'nonprofit', label: 'עמותה' },
  { value: 'partnership', label: 'שותפות' },
];

const BUSINESS_SIZE_OPTIONS = [
  { value: 'small', label: 'קטן' },
  { value: 'medium', label: 'בינוני' },
  { value: 'large', label: 'גדול' },
];

const COMPLEXITY_OPTIONS = [
  { value: '', label: 'אוטומטי' },
  { value: '0', label: '0 - ננו' },
  { value: '1', label: '1 - פשוט' },
  { value: '2', label: '2 - בינוני' },
  { value: '3', label: '3 - מורכב' },
];

const CONTACT_METHOD_OPTIONS = [
  { value: 'email', label: 'אימייל' },
  { value: 'phone', label: 'טלפון' },
  { value: 'whatsapp', label: 'וואטסאפ' },
  { value: 'in_person', label: 'פגישה' },
];

// ── Helper: deep get/set ──
function deepGet(obj, path) {
  return path.split('.').reduce((o, k) => (o != null ? o[k] : undefined), obj);
}

function deepSet(obj, path, value) {
  const copy = JSON.parse(JSON.stringify(obj));
  const keys = path.split('.');
  let cur = copy;
  for (let i = 0; i < keys.length - 1; i++) {
    if (cur[keys[i]] == null) cur[keys[i]] = {};
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
  return copy;
}

// ── Editable Cell ──
function EditableCell({ value, onChange, type = 'text', step, className = '' }) {
  const [local, setLocal] = useState(value);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null); // 'saved' | 'error'

  useEffect(() => setLocal(value), [value]);

  const handleBlur = async () => {
    const parsed = type === 'number' ? (parseFloat(local) || 0) : (local || '');
    const original = value ?? (type === 'number' ? 0 : '');
    if (parsed === original) return;
    setSaving(true);
    try {
      await onChange(parsed);
      setStatus('saved');
      setTimeout(() => setStatus(null), 1500);
    } catch {
      setStatus('error');
      setTimeout(() => setStatus(null), 2000);
    }
    setSaving(false);
  };

  return (
    <input
      type={type}
      step={step}
      value={local ?? ''}
      onChange={e => setLocal(type === 'number' ? (e.target.value === '' ? '' : parseFloat(e.target.value) || 0) : e.target.value)}
      onBlur={handleBlur}
      className={`w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-300
        ${status === 'saved' ? 'border-green-400 bg-green-50' : status === 'error' ? 'border-red-400 bg-red-50' : 'border-gray-200'}
        ${saving ? 'opacity-50' : ''} ${className}`}
    />
  );
}

// ── Editable Select Cell ──
function EditableSelectCell({ value, onChange, options }) {
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  const handleChange = async (newVal) => {
    if (newVal === value) return;
    setSaving(true);
    try {
      await onChange(newVal);
      setStatus('saved');
      setTimeout(() => setStatus(null), 1500);
    } catch {
      setStatus('error');
      setTimeout(() => setStatus(null), 2000);
    }
    setSaving(false);
  };

  return (
    <Select value={value || ''} onValueChange={handleChange}>
      <SelectTrigger
        className={`h-8 text-xs
          ${status === 'saved' ? 'border-green-400 bg-green-50' : status === 'error' ? 'border-red-400 bg-red-50' : ''}
          ${saving ? 'opacity-50' : ''}`}
      >
        <SelectValue placeholder="—" />
      </SelectTrigger>
      <SelectContent>
        {options.map(o => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ── Format number ──
function fmtNum(val) {
  if (val == null || val === '' || isNaN(val)) return '';
  return Number(val).toLocaleString('he-IL');
}

// ── Tab definitions ──
const TABS = [
  { key: 'financial', label: 'כספי' },
  { key: 'tax', label: 'מס' },
  { key: 'processes', label: 'תהליכים' },
  { key: 'providers', label: 'נ.שירותים' },
  { key: 'bank', label: 'בנק' },
];

export default function ClientWorkbook({ embedded = false }) {
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('financial');
  const [statusFilter, setStatusFilter] = useState('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'name', dir: 'asc' });

  // ── Load ──
  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    setIsLoading(true);
    try {
      const data = await Client.list(null, 1000);
      setClients(data || []);
    } catch (err) {
      console.error('Error loading clients:', err);
    }
    setIsLoading(false);
  };

  // ── Save cell ──
  const saveField = useCallback(async (clientId, fieldPath, value) => {
    // Convert complexity_level to number or null for auto
    if (fieldPath === 'business_info.complexity_level') {
      value = value === '' || value === null ? null : Number(value);
    }
    const payload = {};
    // Build nested payload from dot-path
    const keys = fieldPath.split('.');
    if (keys.length === 1) {
      payload[keys[0]] = value;
    } else {
      // For nested fields, we need to send the full nested object
      const client = clients.find(c => c.id === clientId);
      if (!client) return;
      const topKey = keys[0];
      const updated = deepSet(client, fieldPath, value);
      payload[topKey] = updated[topKey];
    }

    await Client.update(clientId, payload);

    // Update local state
    setClients(prev => prev.map(c => {
      if (c.id !== clientId) return c;
      return deepSet(c, fieldPath, value);
    }));
  }, [clients]);

  // ── Filter & Sort ──
  const filteredClients = useMemo(() => {
    let list = clients;
    if (statusFilter && statusFilter !== 'all') {
      list = list.filter(c => c.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(c => (c.name || '').toLowerCase().includes(q));
    }
    // Sort
    list = [...list].sort((a, b) => {
      const av = deepGet(a, sortConfig.key) ?? '';
      const bv = deepGet(b, sortConfig.key) ?? '';
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv), 'he');
      return sortConfig.dir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [clients, statusFilter, searchQuery, sortConfig]);

  // ── Sort handler ──
  const handleSort = (key) => {
    setSortConfig(prev =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' }
    );
  };

  // ── Summary totals ──
  const totals = useMemo(() => {
    const sum = (path) => filteredClients.reduce((s, c) => s + (parseFloat(deepGet(c, path)) || 0), 0);
    return {
      monthly_fee: sum('monthly_fee'),
      payroll: sum('business_info.estimated_monthly_hours.payroll'),
      vat_reporting: sum('business_info.estimated_monthly_hours.vat_reporting'),
      bookkeeping: sum('business_info.estimated_monthly_hours.bookkeeping'),
      reports: sum('business_info.estimated_monthly_hours.reports'),
    };
  }, [filteredClients]);

  totals.total_hours = totals.payroll + totals.vat_reporting + totals.bookkeeping + totals.reports;

  // ── Helpers ──
  const getStatusBadge = (status) => {
    const s = STATUS_OPTIONS.find(o => o.value === status);
    return s ? <Badge className={`${s.color} text-xs`}>{s.label}</Badge> : <Badge variant="outline">{status}</Badge>;
  };

  const calcTotalHours = (c) => {
    const h = c?.business_info?.estimated_monthly_hours || {};
    return (h.payroll || 0) + (h.vat_reporting || 0) + (h.bookkeeping || 0) + (h.reports || 0);
  };

  const SortHeader = ({ label, sortKey }) => (
    <TableHead
      className="cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap text-xs"
      onClick={() => handleSort(sortKey)}
    >
      <span className="flex items-center gap-1">
        {label}
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      </span>
    </TableHead>
  );

  const StickyNameCell = ({ client }) => (
    <TableCell className="sticky right-0 bg-white z-10 border-l font-medium text-sm whitespace-nowrap min-w-[140px]">
      {client.name || '—'}
    </TableCell>
  );

  const StatusCell = ({ client }) => (
    <TableCell className="whitespace-nowrap">{getStatusBadge(client.status)}</TableCell>
  );

  // ── Render tab content ──
  const renderFinancialTab = () => (
    <div className="overflow-auto" style={{ maxHeight: '70vh' }}>
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-gray-50 shadow-sm">
          <TableRow>
            <TableHead className="sticky right-0 bg-gray-50 z-10 border-l text-xs">שם לקוח</TableHead>
            <TableHead className="text-xs">סטטוס</TableHead>
            <SortHeader label="שכ״ט חודשי" sortKey="monthly_fee" />
            <SortHeader label="שעות שכר" sortKey="business_info.estimated_monthly_hours.payroll" />
            <SortHeader label="שעות מע״מ" sortKey="business_info.estimated_monthly_hours.vat_reporting" />
            <SortHeader label="שעות הנה״ח" sortKey="business_info.estimated_monthly_hours.bookkeeping" />
            <SortHeader label="שעות דוחות" sortKey="business_info.estimated_monthly_hours.reports" />
            <SortHeader label="סה״כ שעות" sortKey="name" />
            <TableHead className="text-xs">אמצעי תשלום</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredClients.map(c => (
            <TableRow key={c.id} className="hover:bg-blue-50/30">
              <StickyNameCell client={c} />
              <StatusCell client={c} />
              <TableCell>
                <EditableCell
                  type="number"
                  value={c.monthly_fee}
                  onChange={v => saveField(c.id, 'monthly_fee', v)}
                />
              </TableCell>
              <TableCell>
                <EditableCell
                  type="number" step={0.25}
                  value={deepGet(c, 'business_info.estimated_monthly_hours.payroll')}
                  onChange={v => saveField(c.id, 'business_info.estimated_monthly_hours.payroll', v)}
                />
              </TableCell>
              <TableCell>
                <EditableCell
                  type="number" step={0.25}
                  value={deepGet(c, 'business_info.estimated_monthly_hours.vat_reporting')}
                  onChange={v => saveField(c.id, 'business_info.estimated_monthly_hours.vat_reporting', v)}
                />
              </TableCell>
              <TableCell>
                <EditableCell
                  type="number" step={0.25}
                  value={deepGet(c, 'business_info.estimated_monthly_hours.bookkeeping')}
                  onChange={v => saveField(c.id, 'business_info.estimated_monthly_hours.bookkeeping', v)}
                />
              </TableCell>
              <TableCell>
                <EditableCell
                  type="number" step={0.25}
                  value={deepGet(c, 'business_info.estimated_monthly_hours.reports')}
                  onChange={v => saveField(c.id, 'business_info.estimated_monthly_hours.reports', v)}
                />
              </TableCell>
              <TableCell className="text-center text-sm font-medium text-gray-600">
                {fmtNum(calcTotalHours(c))}
              </TableCell>
              <TableCell className="min-w-[140px]">
                <EditableSelectCell
                  value={c.authorities_payment_method}
                  onChange={v => saveField(c.id, 'authorities_payment_method', v)}
                  options={PAYMENT_METHOD_OPTIONS}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow className="bg-gray-100 font-bold">
            <TableCell className="sticky right-0 bg-gray-100 z-10 border-l text-sm">סה״כ</TableCell>
            <TableCell />
            <TableCell className="text-sm">{fmtNum(totals.monthly_fee)}</TableCell>
            <TableCell className="text-sm">{fmtNum(totals.payroll)}</TableCell>
            <TableCell className="text-sm">{fmtNum(totals.vat_reporting)}</TableCell>
            <TableCell className="text-sm">{fmtNum(totals.bookkeeping)}</TableCell>
            <TableCell className="text-sm">{fmtNum(totals.reports)}</TableCell>
            <TableCell className="text-sm text-center">{fmtNum(totals.total_hours)}</TableCell>
            <TableCell />
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );

  const renderTaxTab = () => (
    <div className="overflow-auto" style={{ maxHeight: '70vh' }}>
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-gray-50 shadow-sm">
          <TableRow>
            <TableHead className="sticky right-0 bg-gray-50 z-10 border-l text-xs">שם לקוח</TableHead>
            <SortHeader label="ח.פ / ע.מ" sortKey="tax_info.tax_id" />
            <SortHeader label="תיק מע״מ" sortKey="tax_info.vat_file_number" />
            <SortHeader label="תיק ניכויים" sortKey="tax_info.tax_deduction_file_number" />
            <SortHeader label="תיק בל״ל" sortKey="tax_info.social_security_file_number" />
            <SortHeader label="מקדמות מס" sortKey="tax_info.annual_tax_ids.tax_advances_id" />
            <SortHeader label="% מקדמות" sortKey="tax_info.annual_tax_ids.tax_advances_percentage" />
            <SortHeader label="בל״ל שנתי" sortKey="tax_info.annual_tax_ids.social_security_id" />
            <SortHeader label="ניכויים שנתי" sortKey="tax_info.annual_tax_ids.deductions_id" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredClients.map(c => (
            <TableRow key={c.id} className="hover:bg-blue-50/30">
              <StickyNameCell client={c} />
              <TableCell>
                <EditableCell value={deepGet(c, 'tax_info.tax_id')} onChange={v => saveField(c.id, 'tax_info.tax_id', v)} />
              </TableCell>
              <TableCell>
                <EditableCell value={deepGet(c, 'tax_info.vat_file_number')} onChange={v => saveField(c.id, 'tax_info.vat_file_number', v)} />
              </TableCell>
              <TableCell>
                <EditableCell value={deepGet(c, 'tax_info.tax_deduction_file_number')} onChange={v => saveField(c.id, 'tax_info.tax_deduction_file_number', v)} />
              </TableCell>
              <TableCell>
                <EditableCell value={deepGet(c, 'tax_info.social_security_file_number')} onChange={v => saveField(c.id, 'tax_info.social_security_file_number', v)} />
              </TableCell>
              <TableCell>
                <EditableCell value={deepGet(c, 'tax_info.annual_tax_ids.tax_advances_id')} onChange={v => saveField(c.id, 'tax_info.annual_tax_ids.tax_advances_id', v)} />
              </TableCell>
              <TableCell>
                <EditableCell type="number" value={deepGet(c, 'tax_info.annual_tax_ids.tax_advances_percentage')} onChange={v => saveField(c.id, 'tax_info.annual_tax_ids.tax_advances_percentage', v)} />
              </TableCell>
              <TableCell>
                <EditableCell value={deepGet(c, 'tax_info.annual_tax_ids.social_security_id')} onChange={v => saveField(c.id, 'tax_info.annual_tax_ids.social_security_id', v)} />
              </TableCell>
              <TableCell>
                <EditableCell value={deepGet(c, 'tax_info.annual_tax_ids.deductions_id')} onChange={v => saveField(c.id, 'tax_info.annual_tax_ids.deductions_id', v)} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  const renderProcessesTab = () => (
    <div className="overflow-auto" style={{ maxHeight: '70vh' }}>
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-gray-50 shadow-sm">
          <TableRow>
            <TableHead className="sticky right-0 bg-gray-50 z-10 border-l text-xs">שם לקוח</TableHead>
            <SortHeader label="סוג עסק" sortKey="business_info.business_type" />
            <SortHeader label="גודל עסק" sortKey="business_info.business_size" />
            <SortHeader label="מס׳ עובדים" sortKey="business_info.employee_count" />
            <SortHeader label="מורכבות (ידני)" sortKey="business_info.complexity_level" />
            <TableHead className="text-xs whitespace-nowrap">טייר מחושב</TableHead>
            <TableHead className="text-xs">סוגי שירות</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredClients.map(c => (
            <TableRow key={c.id} className="hover:bg-blue-50/30">
              <StickyNameCell client={c} />
              <TableCell className="min-w-[120px]">
                <EditableSelectCell
                  value={deepGet(c, 'business_info.business_type')}
                  onChange={v => saveField(c.id, 'business_info.business_type', v)}
                  options={BUSINESS_TYPE_OPTIONS}
                />
              </TableCell>
              <TableCell className="min-w-[100px]">
                <EditableSelectCell
                  value={deepGet(c, 'business_info.business_size')}
                  onChange={v => saveField(c.id, 'business_info.business_size', v)}
                  options={BUSINESS_SIZE_OPTIONS}
                />
              </TableCell>
              <TableCell>
                <EditableCell
                  type="number"
                  value={deepGet(c, 'business_info.employee_count')}
                  onChange={v => saveField(c.id, 'business_info.employee_count', v)}
                />
              </TableCell>
              <TableCell className="min-w-[100px]">
                <EditableSelectCell
                  value={deepGet(c, 'business_info.complexity_level')}
                  onChange={v => saveField(c.id, 'business_info.complexity_level', v)}
                  options={COMPLEXITY_OPTIONS}
                />
              </TableCell>
              <TableCell className="text-center">
                {(() => {
                  const tier = computeComplexityTier(c);
                  const info = getTierInfo(tier);
                  return (
                    <Badge className={`text-xs ${
                      tier === 0 ? 'bg-green-100 text-green-700' :
                      tier === 1 ? 'bg-blue-100 text-blue-700' :
                      tier === 2 ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {info?.label || `T${tier}`}
                    </Badge>
                  );
                })()}
              </TableCell>
              <TableCell className="max-w-[200px]">
                <div className="flex flex-wrap gap-1">
                  {(c.service_types || []).map((st, i) => (
                    <Badge key={i} variant="outline" className="text-xs">{st}</Badge>
                  ))}
                  {(!c.service_types || c.service_types.length === 0) && <span className="text-xs text-gray-400">—</span>}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  const renderProvidersTab = () => (
    <div className="overflow-auto" style={{ maxHeight: '70vh' }}>
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-gray-50 shadow-sm">
          <TableRow>
            <TableHead className="sticky right-0 bg-gray-50 z-10 border-l text-xs">שם לקוח</TableHead>
            <SortHeader label="ערוץ מועדף" sortKey="communication_preferences.preferred_method" />
            <SortHeader label="איש קשר" sortKey="contact_person" />
            <SortHeader label="טלפון" sortKey="phone" />
            <SortHeader label="אימייל" sortKey="email" />
            <TableHead className="text-xs">הערות</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredClients.map(c => (
            <TableRow key={c.id} className="hover:bg-blue-50/30">
              <StickyNameCell client={c} />
              <TableCell className="min-w-[120px]">
                <EditableSelectCell
                  value={deepGet(c, 'communication_preferences.preferred_method')}
                  onChange={v => saveField(c.id, 'communication_preferences.preferred_method', v)}
                  options={CONTACT_METHOD_OPTIONS}
                />
              </TableCell>
              <TableCell>
                <EditableCell value={c.contact_person} onChange={v => saveField(c.id, 'contact_person', v)} />
              </TableCell>
              <TableCell>
                <EditableCell value={c.phone} onChange={v => saveField(c.id, 'phone', v)} />
              </TableCell>
              <TableCell>
                <EditableCell value={c.email} onChange={v => saveField(c.id, 'email', v)} />
              </TableCell>
              <TableCell className="min-w-[180px] max-w-[220px]">
                <EditableCell
                  value={c.notes}
                  onChange={v => saveField(c.id, 'notes', v)}
                  className="truncate"
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  const renderBankTab = () => (
    <div className="overflow-auto" style={{ maxHeight: '70vh' }}>
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-gray-50 shadow-sm">
          <TableRow>
            <TableHead className="sticky right-0 bg-gray-50 z-10 border-l text-xs">שם לקוח</TableHead>
            <SortHeader label="מספר ישות" sortKey="entity_number" />
            <SortHeader label="מזהה דוחות שנתיים" sortKey="integration_info.annual_reports_client_id" />
            <SortHeader label="LastPass Payment ID" sortKey="integration_info.lastpass_payment_entry_id" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredClients.map(c => (
            <TableRow key={c.id} className="hover:bg-blue-50/30">
              <StickyNameCell client={c} />
              <TableCell>
                <EditableCell value={c.entity_number} onChange={v => saveField(c.id, 'entity_number', v)} />
              </TableCell>
              <TableCell>
                <EditableCell
                  value={deepGet(c, 'integration_info.annual_reports_client_id')}
                  onChange={v => saveField(c.id, 'integration_info.annual_reports_client_id', v)}
                />
              </TableCell>
              <TableCell>
                <EditableCell
                  value={deepGet(c, 'integration_info.lastpass_payment_entry_id')}
                  onChange={v => saveField(c.id, 'integration_info.lastpass_payment_entry_id', v)}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  const tabRenderers = {
    financial: renderFinancialTab,
    tax: renderTaxTab,
    processes: renderProcessesTab,
    providers: renderProvidersTab,
    bank: renderBankTab,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className={embedded ? "space-y-3" : "p-4 space-y-4"} dir="rtl">
      {/* Header */}
      {!embedded && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6" />
              חוברת לקוחות
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {filteredClients.length} לקוחות מוצגים מתוך {clients.length}
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
            <CheckCircle className="w-4 h-4" />
            <span>שמירה אוטומטית — כל עריכה נשמרת מיד</span>
          </div>
        </div>
      )}

      {/* Filter bar */}
      <Card>
        <CardContent className="py-3 px-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">סטטוס:</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px] h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">הכל</SelectItem>
                  {STATUS_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 flex-1 max-w-xs">
              <Search className="h-4 w-4 text-gray-400" />
              <Input
                placeholder="חיפוש לפי שם..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs + Table */}
      <Card>
        <CardContent className="p-0">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="border-b px-4 pt-2">
              <TabsList className="bg-transparent">
                {TABS.map(t => (
                  <TabsTrigger key={t.key} value={t.key} className="text-sm">
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            <div className="p-0">
              {tabRenderers[activeTab]?.()}
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
