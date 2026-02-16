import React, { useState, useEffect, useMemo } from 'react';
import { Client } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DollarSign, TrendingUp, TrendingDown, Users, Search, ArrowUpDown
} from 'lucide-react';

export default function FeeManagement() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name');

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    setLoading(true);
    try {
      const data = await Client.list(null, 500);
      setClients(data.filter(c => c.status === 'active'));
    } catch (e) {
      console.error('Failed to load clients:', e);
    }
    setLoading(false);
  };

  const filteredClients = useMemo(() => {
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

  const totalMonthlyFees = useMemo(() =>
    clients.reduce((sum, c) => sum + (parseFloat(c.monthly_fee) || 0), 0),
    [clients]
  );

  const clientsWithFee = useMemo(() =>
    clients.filter(c => c.monthly_fee && parseFloat(c.monthly_fee) > 0).length,
    [clients]
  );

  const clientsWithoutFee = useMemo(() =>
    clients.filter(c => !c.monthly_fee || parseFloat(c.monthly_fee) === 0).length,
    [clients]
  );

  const avgFee = clientsWithFee > 0 ? totalMonthlyFees / clientsWithFee : 0;

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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
            <p className="text-2xl font-bold">{clientsWithFee} <span className="text-sm text-muted-foreground">/ {clients.length}</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingDown className="w-6 h-6 text-orange-500 mx-auto mb-1" />
            <p className="text-sm text-muted-foreground">ממוצע שכ״ט</p>
            <p className="text-2xl font-bold">₪{Math.round(avgFee).toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {clientsWithoutFee > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
          {clientsWithoutFee} לקוחות פעילים ללא שכ״ט מוגדר
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

      {/* Client Fee Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">פירוט שכ״ט לפי לקוח</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-right p-3 font-semibold">לקוח</th>
                  <th className="text-right p-3 font-semibold">שירותים</th>
                  <th className="text-right p-3 font-semibold">שכ״ט חודשי</th>
                  <th className="text-right p-3 font-semibold">שכ״ט שנתי</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map((client) => {
                  const fee = parseFloat(client.monthly_fee) || 0;
                  return (
                    <tr key={client.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-medium">{client.name}</td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {(client.service_types || []).slice(0, 3).map(st => (
                            <Badge key={st} variant="outline" className="text-xs">{st}</Badge>
                          ))}
                          {(client.service_types || []).length > 3 && (
                            <Badge variant="outline" className="text-xs">+{client.service_types.length - 3}</Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        {fee > 0 ? (
                          <span className="font-semibold text-green-700">₪{fee.toLocaleString()}</span>
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
                  <td className="p-3">סה״כ ({filteredClients.length} לקוחות)</td>
                  <td className="p-3"></td>
                  <td className="p-3 text-green-700">
                    ₪{filteredClients.reduce((s, c) => s + (parseFloat(c.monthly_fee) || 0), 0).toLocaleString()}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    ₪{(filteredClients.reduce((s, c) => s + (parseFloat(c.monthly_fee) || 0), 0) * 12).toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
