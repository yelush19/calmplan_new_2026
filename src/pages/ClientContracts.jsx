import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  FileText, Plus, Search, Calendar, Building, User, Clock,
  CheckCircle, AlertCircle, RefreshCw, Eye, Edit, Trash2, Download
} from 'lucide-react';
import { Client } from '@/api/entities';
import { format, parseISO, differenceInDays } from 'date-fns';
import { he } from 'date-fns/locale';

const contractStatusLabels = {
  draft: 'טיוטה',
  pending_signature: 'ממתין לחתימה',
  active: 'פעיל',
  expired: 'פג תוקף',
  cancelled: 'בוטל',
  renewed: 'חודש'
};

const contractStatusColors = {
  draft: 'bg-gray-100 text-gray-800 border-gray-200',
  pending_signature: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  active: 'bg-green-100 text-green-800 border-green-200',
  expired: 'bg-red-100 text-red-800 border-red-200',
  cancelled: 'bg-gray-200 text-gray-600 border-gray-300',
  renewed: 'bg-blue-100 text-blue-800 border-blue-200'
};

const serviceTypeLabels = {
  bookkeeping_full: 'הנהלת חשבונות מלאה',
  payroll: 'שכר',
  annual_reports: 'מאזנים שנתיים',
  vat_reporting: 'דיווחי מע״מ',
  tax_advances: 'מקדמות מס',
  consulting: 'ייעוץ',
  reconciliation: 'התאמות חשבונות'
};

export default function ClientContractsPage() {
  const [clients, setClients] = useState([]);
  const [filteredClients, setFilteredClients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    filterClients();
  }, [searchTerm, statusFilter, clients]);

  const loadClients = async () => {
    setIsLoading(true);
    try {
      const clientsData = await Client.filter({ status: 'active' }, '-updated_date', 500);
      setClients(clientsData || []);
    } catch (error) {
      console.error("Error loading clients:", error);
      setClients([]);
    }
    setIsLoading(false);
  };

  const filterClients = () => {
    let filtered = [...clients];

    if (searchTerm) {
      filtered = filtered.filter(client =>
        client.name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // סינון לפי סטטוס חוזה (אם יש)
    if (statusFilter !== 'all') {
      filtered = filtered.filter(client => {
        const contract = client.contract_info || {};
        return contract.status === statusFilter;
      });
    }

    setFilteredClients(filtered);
  };

  const getContractStatus = (client) => {
    const contract = client.contract_info || {};

    if (!contract.start_date) return 'draft';
    if (contract.status) return contract.status;

    if (contract.end_date) {
      const endDate = parseISO(contract.end_date);
      const daysUntilEnd = differenceInDays(endDate, new Date());
      if (daysUntilEnd < 0) return 'expired';
      if (daysUntilEnd < 30) return 'pending_signature'; // עומד לפוג
    }

    return 'active';
  };

  const getContractStats = () => {
    const stats = {
      total: clients.length,
      active: 0,
      expiring_soon: 0,
      expired: 0,
      no_contract: 0
    };

    clients.forEach(client => {
      const contract = client.contract_info || {};

      if (!contract.start_date) {
        stats.no_contract++;
        return;
      }

      const status = getContractStatus(client);
      if (status === 'active') {
        // בדיקה אם עומד לפוג ב-30 יום הקרובים
        if (contract.end_date) {
          const daysUntilEnd = differenceInDays(parseISO(contract.end_date), new Date());
          if (daysUntilEnd >= 0 && daysUntilEnd <= 30) {
            stats.expiring_soon++;
            return;
          }
        }
        stats.active++;
      } else if (status === 'expired') {
        stats.expired++;
      }
    });

    return stats;
  };

  const stats = getContractStats();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-lg text-gray-600">טוען חוזי לקוחות...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileText className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-neutral-dark">ניהול חוזים</h1>
            <p className="text-neutral-medium">מעקב חוזים והסכמים עם לקוחות</p>
          </div>
        </div>

        <Button onClick={loadClients} variant="outline">
          <RefreshCw className={`w-4 h-4 ml-2 ${isLoading ? 'animate-spin' : ''}`} />
          רענן
        </Button>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Building className="w-8 h-8 mx-auto mb-2 text-primary" />
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-muted-foreground">סה"כ לקוחות</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-600" />
            <div className="text-2xl font-bold">{stats.active}</div>
            <div className="text-sm text-muted-foreground">חוזים פעילים</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Clock className="w-8 h-8 mx-auto mb-2 text-yellow-600" />
            <div className="text-2xl font-bold">{stats.expiring_soon}</div>
            <div className="text-sm text-muted-foreground">עומדים לפוג</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-red-600" />
            <div className="text-2xl font-bold">{stats.expired}</div>
            <div className="text-sm text-muted-foreground">פגי תוקף</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <FileText className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <div className="text-2xl font-bold">{stats.no_contract}</div>
            <div className="text-sm text-muted-foreground">ללא חוזה</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="חיפוש לקוח..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="סנן לפי סטטוס" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הסטטוסים</SelectItem>
                {Object.entries(contractStatusLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

      {/* Contracts List */}
      <div className="space-y-4">
        {filteredClients.length === 0 ? (
          <Card className="p-12 text-center">
            <FileText className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">לא נמצאו חוזים</h3>
            <p className="text-gray-500">נסה לשנות את פרמטרי החיפוש.</p>
          </Card>
        ) : (
          <AnimatePresence>
            {filteredClients.map((client, index) => {
              const contract = client.contract_info || {};
              const status = getContractStatus(client);
              const daysUntilEnd = contract.end_date
                ? differenceInDays(parseISO(contract.end_date), new Date())
                : null;

              return (
                <motion.div
                  key={client.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                        {/* Client Info */}
                        <div className="flex items-start gap-4 flex-1">
                          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                            <Building className="w-6 h-6 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-lg">{client.name}</h3>
                              <Badge className={`${contractStatusColors[status]} border`}>
                                {contractStatusLabels[status]}
                              </Badge>
                            </div>

                            {/* Services */}
                            {client.service_types?.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {client.service_types.slice(0, 3).map(service => (
                                  <Badge key={service} variant="outline" className="text-xs">
                                    {serviceTypeLabels[service] || service}
                                  </Badge>
                                ))}
                                {client.service_types.length > 3 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{client.service_types.length - 3}
                                  </Badge>
                                )}
                              </div>
                            )}

                            {/* Contract Dates */}
                            <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-gray-500">
                              {contract.start_date && (
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-4 h-4" />
                                  <span>התחלה: {format(parseISO(contract.start_date), 'd בMMM yyyy', { locale: he })}</span>
                                </div>
                              )}
                              {contract.end_date && (
                                <div className="flex items-center gap-1">
                                  <Clock className="w-4 h-4" />
                                  <span>סיום: {format(parseISO(contract.end_date), 'd בMMM yyyy', { locale: he })}</span>
                                  {daysUntilEnd !== null && daysUntilEnd >= 0 && daysUntilEnd <= 30 && (
                                    <Badge className="bg-yellow-100 text-yellow-800 text-xs mr-1">
                                      {daysUntilEnd} ימים
                                    </Badge>
                                  )}
                                </div>
                              )}
                              {contract.monthly_fee && (
                                <div className="flex items-center gap-1">
                                  <span>תשלום חודשי: ₪{contract.monthly_fee.toLocaleString()}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm">
                            <Eye className="w-4 h-4 ml-1" />
                            צפייה
                          </Button>
                          <Button variant="outline" size="sm">
                            <Edit className="w-4 h-4 ml-1" />
                            עריכה
                          </Button>
                          {contract.document_url && (
                            <Button variant="outline" size="sm">
                              <Download className="w-4 h-4 ml-1" />
                              הורדה
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
