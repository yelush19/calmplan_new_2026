
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  RefreshCw, Shield, AlertTriangle, Search, ChevronDown, ChevronUp,
  Users, FileText, CheckCircle, XCircle, Filter
} from 'lucide-react';
import { Client } from '@/api/entities';

// ═══════════════════════════════════════════════
// CLIENT AUDIT TOOL — מצב המערכת
// Scans all clients for data integrity issues:
//   1. Exempt Dealers (עוסק פטור) with VAT reporting
//   2. Missing Deductions ID (ניכויים)
//   3. Missing Tax File Numbers
//   4. Missing Social Security IDs
// ═══════════════════════════════════════════════

const AUDIT_RULES = [
  {
    key: 'exempt_with_vat',
    title: 'עוסק פטור + דיווח מע"מ',
    description: 'לקוחות מסוג עוסק פטור שמוגדר להם דיווח מע"מ — סתירה לוגית',
    severity: 'critical',
    icon: '⚠️',
    check: (client) => {
      const bType = (client.business_info?.business_type || '').toLowerCase();
      const isExempt = bType === 'exempt' || bType === 'עוסק פטור' || bType === 'exempt_dealer' || bType === 'patur';
      const hasVat = client.tax_info?.vat_file_number ||
        (client.reporting_info?.vat_reporting_frequency && client.reporting_info.vat_reporting_frequency !== 'none' && client.reporting_info.vat_reporting_frequency !== 'not_applicable');
      const hasVatService = Array.isArray(client.service_types) && client.service_types.includes('vat');
      return isExempt && (hasVat || hasVatService);
    },
    columns: ['name', 'business_type', 'vat_file', 'vat_frequency'],
  },
  {
    key: 'missing_deductions_id',
    title: 'חסר מספר תיק ניכויים',
    description: 'לקוחות עם שירות שכר/ניכויים שאין להם מספר תיק ניכויים',
    severity: 'warning',
    icon: '🔍',
    check: (client) => {
      const hasPayrollService = Array.isArray(client.service_types) &&
        (client.service_types.includes('payroll') || client.service_types.includes('deductions'));
      const hasDeductionsFreq = client.reporting_info?.deductions_frequency &&
        client.reporting_info.deductions_frequency !== 'none' &&
        client.reporting_info.deductions_frequency !== 'not_applicable';
      const needsDeductions = hasPayrollService || hasDeductionsFreq;
      const missingId = !client.tax_info?.annual_tax_ids?.deductions_id &&
        !client.tax_info?.tax_deduction_file_number;
      return needsDeductions && missingId;
    },
    columns: ['name', 'services', 'deductions_freq', 'deductions_id'],
  },
  {
    key: 'missing_tax_id',
    title: 'חסר מספר עוסק / ח.פ.',
    description: 'לקוחות פעילים ללא מספר זיהוי מס',
    severity: 'warning',
    icon: '📋',
    check: (client) => {
      const isActive = client.status === 'active';
      const missingTaxId = !client.tax_info?.tax_id && !client.entity_number;
      return isActive && missingTaxId;
    },
    columns: ['name', 'status', 'entity_number'],
  },
  {
    key: 'missing_ss_id',
    title: 'חסר מספר תיק ביטוח לאומי',
    description: 'לקוחות עם שכר שאין להם מספר ביטוח לאומי',
    severity: 'info',
    icon: '🏥',
    check: (client) => {
      const hasPayroll = Array.isArray(client.service_types) && client.service_types.includes('payroll');
      const hasSsFreq = client.reporting_info?.social_security_frequency &&
        client.reporting_info.social_security_frequency !== 'none' &&
        client.reporting_info.social_security_frequency !== 'not_applicable';
      const needsSs = hasPayroll || hasSsFreq;
      const missingId = !client.tax_info?.annual_tax_ids?.social_security_id &&
        !client.tax_info?.social_security_file_number;
      return needsSs && missingId;
    },
    columns: ['name', 'services', 'ss_freq', 'ss_id'],
  },
];

const SEVERITY_STYLES = {
  critical: { bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-800', headerBg: 'bg-red-100' },
  warning: { bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-800', headerBg: 'bg-amber-100' },
  info: { bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-800', headerBg: 'bg-blue-100' },
};

function AuditTable({ rule, flaggedClients }) {
  const [expanded, setExpanded] = useState(true);
  const [search, setSearch] = useState('');
  const style = SEVERITY_STYLES[rule.severity] || SEVERITY_STYLES.info;

  const filtered = useMemo(() => {
    if (!search) return flaggedClients;
    const q = search.toLowerCase();
    return flaggedClients.filter(c => (c.name || '').toLowerCase().includes(q) || (c.nickname || '').toLowerCase().includes(q));
  }, [flaggedClients, search]);

  const getField = (client, col) => {
    switch (col) {
      case 'name': return client.name || client.nickname || '—';
      case 'status': return client.status || '—';
      case 'business_type': return client.business_info?.business_type || '—';
      case 'vat_file': return client.tax_info?.vat_file_number || '—';
      case 'vat_frequency': return client.reporting_info?.vat_reporting_frequency || '—';
      case 'services': return (client.service_types || []).join(', ') || '—';
      case 'deductions_freq': return client.reporting_info?.deductions_frequency || '—';
      case 'deductions_id': return client.tax_info?.annual_tax_ids?.deductions_id || client.tax_info?.tax_deduction_file_number || '—';
      case 'entity_number': return client.entity_number || client.tax_info?.tax_id || '—';
      case 'ss_freq': return client.reporting_info?.social_security_frequency || '—';
      case 'ss_id': return client.tax_info?.annual_tax_ids?.social_security_id || client.tax_info?.social_security_file_number || '—';
      default: return '—';
    }
  };

  const COL_LABELS = {
    name: 'שם לקוח',
    status: 'סטטוס',
    business_type: 'סוג עסק',
    vat_file: 'תיק מע"מ',
    vat_frequency: 'תדירות מע"מ',
    services: 'שירותים',
    deductions_freq: 'תדירות ניכויים',
    deductions_id: 'מס׳ תיק ניכויים',
    entity_number: 'מס׳ עוסק / ח.פ.',
    ss_freq: 'תדירות בט"ל',
    ss_id: 'מס׳ תיק בט"ל',
  };

  return (
    <Card className={`${style.border} border-2 overflow-hidden`}>
      <CardHeader
        className={`${style.headerBg} cursor-pointer py-3 px-4`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <span>{rule.icon}</span>
            {rule.title}
            <Badge className={`${style.badge} text-xs font-bold`}>{flaggedClients.length}</Badge>
          </CardTitle>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
        <p className="text-xs text-gray-600 mt-1">{rule.description}</p>
      </CardHeader>

      {expanded && (
        <CardContent className="p-0">
          {flaggedClients.length === 0 ? (
            <div className="flex items-center gap-2 p-4 text-green-700">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm font-medium">לא נמצאו בעיות — הכל תקין!</span>
            </div>
          ) : (
            <>
              {/* Search */}
              <div className="px-3 py-2 border-b">
                <div className="relative">
                  <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="חפש לקוח..."
                    className="w-full pr-8 pl-2 py-1.5 text-xs border rounded-lg focus:ring-1 focus:ring-blue-300 focus:outline-none"
                    dir="rtl"
                  />
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs" dir="rtl">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="px-3 py-2 text-right font-bold text-gray-600">#</th>
                      {rule.columns.map(col => (
                        <th key={col} className="px-3 py-2 text-right font-bold text-gray-600">
                          {COL_LABELS[col] || col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((client, i) => (
                      <tr key={client.id} className={`border-b ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-blue-50/50 transition-colors`}>
                        <td className="px-3 py-2 text-gray-400 font-mono">{i + 1}</td>
                        {rule.columns.map(col => (
                          <td key={col} className="px-3 py-2">
                            {col === 'name' ? (
                              <span className="font-semibold text-gray-900">{getField(client, col)}</span>
                            ) : getField(client, col) === '—' ? (
                              <span className="text-red-500 font-bold">חסר</span>
                            ) : (
                              <span className="text-gray-700">{getField(client, col)}</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export default function SystemOverviewPage() {
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('active');

  const loadClients = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const allClients = await Client.list(null, 5000);
      setClients(allClients || []);
    } catch (err) {
      console.error('Error loading clients:', err);
      setError('שגיאה בטעינת לקוחות: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadClients(); }, []);

  const filteredClients = useMemo(() => {
    if (statusFilter === 'all') return clients;
    return clients.filter(c => c.status === statusFilter);
  }, [clients, statusFilter]);

  const auditResults = useMemo(() => {
    return AUDIT_RULES.map(rule => ({
      rule,
      flagged: filteredClients.filter(rule.check),
    }));
  }, [filteredClients]);

  const totalIssues = auditResults.reduce((sum, r) => sum + r.flagged.length, 0);
  const criticalCount = auditResults.filter(r => r.rule.severity === 'critical').reduce((sum, r) => sum + r.flagged.length, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        <span className="mr-3 text-gray-600">סורק לקוחות...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">כלי ביקורת לקוחות</h1>
            <p className="text-sm text-gray-500">סריקת תקינות נתונים — עוסק פטור, ניכויים, מזהי מס</p>
          </div>
        </div>
        <Button onClick={loadClients} variant="outline" className="gap-2">
          <RefreshCw className="w-4 h-4" />
          סרוק מחדש
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-2 border-blue-100">
          <CardContent className="p-4 text-center">
            <Users className="w-6 h-6 mx-auto text-blue-500 mb-1" />
            <div className="text-2xl font-bold text-blue-700">{filteredClients.length}</div>
            <div className="text-xs text-gray-500">לקוחות נסרקו</div>
          </CardContent>
        </Card>
        <Card className={`border-2 ${totalIssues > 0 ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'}`}>
          <CardContent className="p-4 text-center">
            {totalIssues > 0
              ? <AlertTriangle className="w-6 h-6 mx-auto text-amber-500 mb-1" />
              : <CheckCircle className="w-6 h-6 mx-auto text-green-500 mb-1" />
            }
            <div className={`text-2xl font-bold ${totalIssues > 0 ? 'text-amber-700' : 'text-green-700'}`}>{totalIssues}</div>
            <div className="text-xs text-gray-500">ממצאים</div>
          </CardContent>
        </Card>
        <Card className={`border-2 ${criticalCount > 0 ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
          <CardContent className="p-4 text-center">
            {criticalCount > 0
              ? <XCircle className="w-6 h-6 mx-auto text-red-500 mb-1" />
              : <CheckCircle className="w-6 h-6 mx-auto text-green-500 mb-1" />
            }
            <div className={`text-2xl font-bold ${criticalCount > 0 ? 'text-red-700' : 'text-green-700'}`}>{criticalCount}</div>
            <div className="text-xs text-gray-500">קריטיים</div>
          </CardContent>
        </Card>
        <Card className="border-2 border-gray-100">
          <CardContent className="p-4 text-center">
            <Filter className="w-6 h-6 mx-auto text-gray-400 mb-1" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full text-xs border rounded-lg px-2 py-1 mt-1"
              dir="rtl"
            >
              <option value="all">כל הלקוחות</option>
              <option value="active">פעילים בלבד</option>
              <option value="inactive">לא פעילים</option>
              <option value="potential">פוטנציאליים</option>
            </select>
            <div className="text-xs text-gray-500 mt-1">סינון סטטוס</div>
          </CardContent>
        </Card>
      </div>

      {/* Audit Results */}
      <div className="space-y-4">
        {auditResults.map(({ rule, flagged }) => (
          <AuditTable key={rule.key} rule={rule} flaggedClients={flagged} />
        ))}
      </div>

      {/* Footer note */}
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          <strong>כלי ביקורת אוטומטי</strong> — סורק את כל הלקוחות ומזהה חוסרים ובעיות לוגיות בנתוני המס.
          לחץ על כותרת כל קטגוריה כדי לפתוח/לסגור את הטבלה.
        </AlertDescription>
      </Alert>
    </div>
  );
}
