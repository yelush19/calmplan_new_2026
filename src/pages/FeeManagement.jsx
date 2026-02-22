import React, { useState, useEffect, useMemo } from 'react';
import { Client } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DollarSign, TrendingUp, TrendingDown, Users, Search, ArrowUpDown,
  Star, Link2, UserX
} from 'lucide-react';
import ResizableTable from '@/components/ui/ResizableTable';

const serviceTypeLabels = {
  bookkeeping: 'הנהלת חשבונות',
  bookkeeping_full: 'הנהלת חשבונות מלאה',
  vat_reporting: 'דיווחי מע״מ',
  tax_advances: 'מקדמות מס',
  payroll: 'שכר',
  social_security: 'ביטוח לאומי',
  deductions: 'מ״ה ניכויים',
  annual_reports: 'מאזנים / דוחות שנתיים',
  reconciliation: 'התאמות חשבונות',
  special_reports: 'דוחות מיוחדים',
  masav_employees: 'מס״ב עובדים',
  masav_social: 'מס״ב סוציאליות',
  masav_authorities: 'מס״ב רשויות',
  masav_suppliers: 'מס״ב ספקים',
  authorities_payment: 'תשלום רשויות',
  authorities: 'דיווח רשויות',
  operator_reporting: 'דיווח למתפעל',
  taml_reporting: 'דיווח לטמל',
  payslip_sending: 'משלוח תלושים',
  social_benefits: 'סוציאליות',
  reserve_claims: 'תביעות מילואים',
  pnl_reports: 'דוחות רווח והפסד',
  admin: 'אדמיניסטרציה',
};

const serviceTypeColors = {
  bookkeeping: 'bg-green-100 text-green-800 border-green-200',
  bookkeeping_full: 'bg-green-100 text-green-800 border-green-200',
  reconciliation: 'bg-green-100 text-green-800 border-green-200',
  annual_reports: 'bg-green-100 text-green-800 border-green-200',
  pnl_reports: 'bg-green-100 text-green-800 border-green-200',
  vat_reporting: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  tax_advances: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  payroll: 'bg-blue-100 text-blue-800 border-blue-200',
  social_security: 'bg-blue-100 text-blue-800 border-blue-200',
  deductions: 'bg-blue-100 text-blue-800 border-blue-200',
  authorities: 'bg-blue-100 text-blue-800 border-blue-200',
  authorities_payment: 'bg-blue-100 text-blue-800 border-blue-200',
  social_benefits: 'bg-blue-100 text-blue-800 border-blue-200',
  payslip_sending: 'bg-purple-100 text-purple-800 border-purple-200',
  masav_employees: 'bg-purple-100 text-purple-800 border-purple-200',
  masav_social: 'bg-amber-100 text-amber-800 border-amber-200',
  masav_authorities: 'bg-amber-100 text-amber-800 border-amber-200',
  operator_reporting: 'bg-amber-100 text-amber-800 border-amber-200',
  taml_reporting: 'bg-amber-100 text-amber-800 border-amber-200',
  masav_suppliers: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  reserve_claims: 'bg-blue-100 text-blue-800 border-blue-200',
  admin: 'bg-green-100 text-green-800 border-green-200',
  special_reports: 'bg-green-100 text-green-800 border-green-200',
};

const feeStatusLabels = {
  oth: 'תיק עצמי (OTH)',
  linked_to_parent: 'מתומחר עם לקוח ראשי',
};

function FeeStatusBadge({ client, allClients }) {
  const feeStatus = client.fee_status;
  if (!feeStatus || feeStatus === 'normal') return null;

  if (feeStatus === 'oth') {
    return (
      <Badge className="bg-gray-100 text-gray-700 border-gray-300 text-xs border">
        <UserX className="w-3 h-3 ml-1" />
        תיק עצמי
      </Badge>
    );
  }

  if (feeStatus === 'linked_to_parent') {
    const parent = allClients.find(c => c.id === client.paying_client_id);
    return (
      <Badge className="bg-violet-100 text-violet-700 border-violet-300 text-xs border">
        <Link2 className="w-3 h-3 ml-1" />
        {parent ? `מתומחר עם ${parent.name}` : 'מקושר ללקוח ראשי'}
      </Badge>
    );
  }

  return null;
}

function ClientFeeTable({ clients, allClients, search, sortBy, title, showFeeStatus = false }) {
  const filtered = useMemo(() => {
    let result = clients.filter(c =>
      !search || c.name?.toLowerCase().includes(search.toLowerCase())
    );

    result.sort((a, b) => {
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '', 'he');
      if (sortBy === 'fee_high') return (b.monthly_fee || 0) - (a.monthly_fee || 0);
      if (sortBy === 'fee_low') return (a.monthly_fee || 0) - (b.monthly_fee || 0);
      return 0;
    });

    return result;
  }, [clients, search, sortBy]);

  if (filtered.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <ResizableTable className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-right p-3 font-semibold">לקוח</th>
                <th className="text-right p-3 font-semibold">שירותים</th>
                {showFeeStatus && <th className="text-right p-3 font-semibold">סטטוס שכ״ט</th>}
                <th className="text-right p-3 font-semibold">שכ״ט חודשי</th>
                <th className="text-right p-3 font-semibold">שכ״ט שנתי</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((client) => {
                const fee = parseFloat(client.monthly_fee) || 0;
                const isOth = client.fee_status === 'oth';
                const isLinked = client.fee_status === 'linked_to_parent';
                const hasSpecialStatus = isOth || isLinked;
                return (
                  <tr key={client.id} className={`border-b hover:bg-muted/30 transition-colors ${hasSpecialStatus ? 'bg-gray-50/50' : ''}`}>
                    <td className="p-3 font-medium">{client.name}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {(client.service_types || []).slice(0, 3).map(st => (
                          <Badge key={st} className={`${serviceTypeColors[st] || 'bg-gray-50 text-gray-700 border-gray-200'} text-xs px-2 py-0.5 border`}>
                            {serviceTypeLabels[st] || st}
                          </Badge>
                        ))}
                        {(client.service_types || []).length > 3 && (
                          <Badge variant="outline" className="text-xs">+{client.service_types.length - 3}</Badge>
                        )}
                      </div>
                    </td>
                    {showFeeStatus && (
                      <td className="p-3">
                        {fee === 0 && hasSpecialStatus ? (
                          <FeeStatusBadge client={client} allClients={allClients} />
                        ) : fee === 0 ? (
                          <span className="text-yellow-600 text-xs">לא מוגדר</span>
                        ) : null}
                      </td>
                    )}
                    <td className="p-3">
                      {fee > 0 ? (
                        <span className="font-semibold text-green-700">₪{fee.toLocaleString()}</span>
                      ) : hasSpecialStatus ? (
                        <span className="text-gray-400">—</span>
                      ) : (
                        <span className="text-muted-foreground">לא הוגדר</span>
                      )}
                    </td>
                    <td className="p-3">
                      {fee > 0 ? (
                        <span className="text-muted-foreground">₪{(fee * 12).toLocaleString()}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-muted/50 font-bold">
                <td className="p-3">סה״כ ({filtered.length})</td>
                <td className="p-3"></td>
                {showFeeStatus && <td className="p-3"></td>}
                <td className="p-3 text-green-700">
                  ₪{filtered.reduce((s, c) => s + (parseFloat(c.monthly_fee) || 0), 0).toLocaleString()}
                </td>
                <td className="p-3 text-muted-foreground">
                  ₪{(filtered.reduce((s, c) => s + (parseFloat(c.monthly_fee) || 0), 0) * 12).toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </ResizableTable>
        </div>
      </CardContent>
    </Card>
  );
}

export default function FeeManagement() {
  const [allClients, setAllClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [activeTab, setActiveTab] = useState('active');

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    setLoading(true);
    try {
      const data = await Client.list(null, 500);
      setAllClients(data);
    } catch (e) {
      console.error('Failed to load clients:', e);
    }
    setLoading(false);
  };

  // Active clients - regular fee payers
  const activeClients = useMemo(() =>
    allClients.filter(c => c.status === 'active'),
    [allClients]
  );

  // Potential clients
  const potentialClients = useMemo(() =>
    allClients.filter(c => c.status === 'potential'),
    [allClients]
  );

  // Active without fee and without special status
  const activeWithoutFee = useMemo(() =>
    activeClients.filter(c => {
      const fee = parseFloat(c.monthly_fee) || 0;
      return fee === 0 && !c.fee_status;
    }).length,
    [activeClients]
  );

  // Active with OTH or linked
  const activeOthCount = useMemo(() =>
    activeClients.filter(c => c.fee_status === 'oth').length,
    [activeClients]
  );

  const activeLinkedCount = useMemo(() =>
    activeClients.filter(c => c.fee_status === 'linked_to_parent').length,
    [activeClients]
  );

  // Stats for active
  const totalMonthlyFees = useMemo(() =>
    activeClients.reduce((sum, c) => sum + (parseFloat(c.monthly_fee) || 0), 0),
    [activeClients]
  );

  const clientsWithFee = useMemo(() =>
    activeClients.filter(c => c.monthly_fee && parseFloat(c.monthly_fee) > 0).length,
    [activeClients]
  );

  const avgFee = clientsWithFee > 0 ? totalMonthlyFees / clientsWithFee : 0;

  // Stats for potential (expected)
  const potentialMonthlyFees = useMemo(() =>
    potentialClients.reduce((sum, c) => sum + (parseFloat(c.monthly_fee) || 0), 0),
    [potentialClients]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">מרכז נתוני שכ״ט</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <DollarSign className="w-6 h-6 text-green-600 mx-auto mb-1" />
            <p className="text-sm text-muted-foreground">סה״כ שכ״ט חודשי</p>
            <p className="text-2xl font-bold text-green-700">₪{totalMonthlyFees.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingUp className="w-6 h-6 text-blue-600 mx-auto mb-1" />
            <p className="text-sm text-muted-foreground">שכ״ט שנתי משוער</p>
            <p className="text-2xl font-bold text-blue-700">₪{(totalMonthlyFees * 12).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Users className="w-6 h-6 text-purple-600 mx-auto mb-1" />
            <p className="text-sm text-muted-foreground">לקוחות עם שכ״ט</p>
            <p className="text-2xl font-bold">{clientsWithFee} <span className="text-sm text-muted-foreground">/ {activeClients.length}</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingDown className="w-6 h-6 text-orange-500 mx-auto mb-1" />
            <p className="text-sm text-muted-foreground">ממוצע שכ״ט</p>
            <p className="text-2xl font-bold">₪{Math.round(avgFee).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border-dashed border-2 border-amber-300 bg-amber-50/30">
          <CardContent className="p-4 text-center">
            <Star className="w-6 h-6 text-amber-500 mx-auto mb-1" />
            <p className="text-sm text-amber-700">הכנסה צפויה (פוטנציאליים)</p>
            <p className="text-2xl font-bold text-amber-600">
              ₪{potentialMonthlyFees.toLocaleString()}
              <span className="text-sm font-normal text-muted-foreground"> / חודש</span>
            </p>
            <p className="text-xs text-amber-600 mt-1">{potentialClients.length} לקוחות פוטנציאליים</p>
          </CardContent>
        </Card>
      </div>

      {/* Warnings */}
      {activeWithoutFee > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
          {activeWithoutFee} לקוחות פעילים ללא שכ״ט מוגדר (ללא סטטוס מיוחד)
        </div>
      )}
      {(activeOthCount > 0 || activeLinkedCount > 0) && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-600 flex gap-4">
          {activeOthCount > 0 && (
            <span className="flex items-center gap-1">
              <UserX className="w-4 h-4" />
              {activeOthCount} תיקים עצמיים (OTH)
            </span>
          )}
          {activeLinkedCount > 0 && (
            <span className="flex items-center gap-1">
              <Link2 className="w-4 h-4" />
              {activeLinkedCount} מתומחרים עם לקוח ראשי
            </span>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="חיפוש לקוח..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-10"
          />
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-48">
            <ArrowUpDown className="w-4 h-4 ml-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">לפי שם</SelectItem>
            <SelectItem value="fee_high">שכ״ט - גבוה לנמוך</SelectItem>
            <SelectItem value="fee_low">שכ״ט - נמוך לגבוה</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabs: Active vs Potential */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="active" className="gap-2">
            <Users className="w-4 h-4" />
            לקוחות פעילים ({activeClients.length})
          </TabsTrigger>
          <TabsTrigger value="potential" className="gap-2">
            <Star className="w-4 h-4" />
            לקוחות פוטנציאליים - צפוי ({potentialClients.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4 mt-4">
          <ClientFeeTable
            clients={activeClients}
            allClients={allClients}
            search={search}
            sortBy={sortBy}
            title="פירוט שכ״ט - לקוחות פעילים"
            showFeeStatus={true}
          />
        </TabsContent>

        <TabsContent value="potential" className="space-y-4 mt-4">
          {potentialClients.length === 0 ? (
            <Card className="p-8 text-center">
              <Star className="w-12 h-12 mx-auto text-amber-300 mb-3" />
              <p className="text-lg font-semibold text-gray-600">אין לקוחות פוטנציאליים</p>
              <p className="text-sm text-gray-500 mt-1">הוסף לקוח עם סטטוס "פוטנציאלי" כדי לראות הכנסה צפויה</p>
            </Card>
          ) : (
            <ClientFeeTable
              clients={potentialClients}
              allClients={allClients}
              search={search}
              sortBy={sortBy}
              title={
                <span className="flex items-center gap-2">
                  פירוט שכ״ט צפוי - לקוחות פוטנציאליים
                  <Badge className="bg-amber-100 text-amber-700 border-amber-300 text-xs border">צפוי</Badge>
                </span>
              }
              showFeeStatus={false}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
