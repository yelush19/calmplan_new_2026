import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Users,
  Plus,
  Search,
  RefreshCw,
  Phone,
  Mail,
  Calendar,
  FileText,
  User,
  Building,
  DollarSign,
  CheckCircle,
  Clock,
  AlertCircle,
  Eye,
  UserPlus
} from 'lucide-react';
import { Lead, Client } from '@/api/entities';
import { format, parseISO } from 'date-fns';
import { he } from 'date-fns/locale';

const statusLabels = {
  new_lead: 'ליד חדש',
  contacted: 'יצרנו קשר',
  quote_sent: 'נשלחה הצעה',
  follow_up: 'מעקב',
  client_active: 'לקוח פעיל',
  closed_lost: 'נסגר ללא עסקה'
};

const statusColors = {
  new_lead: 'bg-blue-100 text-blue-800',
  contacted: 'bg-yellow-100 text-yellow-800',
  quote_sent: 'bg-purple-100 text-purple-800',
  follow_up: 'bg-orange-100 text-orange-800',
  client_active: 'bg-green-100 text-green-800',
  closed_lost: 'bg-gray-100 text-gray-800'
};

export default function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [filteredLeads, setFilteredLeads] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedLead, setSelectedLead] = useState(null);
  const [isConverting, setIsConverting] = useState(false);

  useEffect(() => {
    loadLeads();
  }, []);

  useEffect(() => {
    let filtered = [...leads];

    if (searchTerm) {
      filtered = filtered.filter(lead =>
        lead.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.contact_person?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(lead => lead.status === statusFilter);
    }

    // מיון לפי תאריך יצירה (החדשים ראשונים)
    filtered.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

    setFilteredLeads(filtered);
  }, [leads, searchTerm, statusFilter]);

  const loadLeads = async () => {
    setIsLoading(true);
    try {
      const leadsData = await Lead.list();
      setLeads(leadsData || []);
    } catch (error) {
      console.error("Error loading leads:", error);
      setLeads([]);
    }
    setIsLoading(false);
  };

  const handleStatusUpdate = async (leadId, newStatus) => {
    try {
      await Lead.update(leadId, { 
        status: newStatus,
        last_contact_date: new Date().toISOString().split('T')[0]
      });
      await loadLeads();
    } catch (error) {
      console.error("Error updating lead status:", error);
    }
  };

  const handleConvertToClient = async (lead) => {
    if (!window.confirm(`האם אתה בטוח שברצונך להמיר את הליד "${lead.company_name}" ללקוח פעיל?`)) {
      return;
    }

    setIsConverting(true);
    try {
      // יצירת לקוח חדש
      const clientData = {
        name: lead.company_name,
        contact_person: lead.contact_person,
        email: lead.email,
        phone: lead.phone,
        status: 'active',
        notes: `המרה מליד. מקור: ${lead.source}${lead.quote_amount ? `. סכום הצעת מחיר: ₪${lead.quote_amount}` : ''}`
      };

      const newClient = await Client.create(clientData);

      // עדכון הליד
      await Lead.update(lead.id, {
        status: 'client_active',
        converted_client_id: newClient.id,
        agreement_date: new Date().toISOString().split('T')[0]
      });

      await loadLeads();
      setSelectedLead(null);
      alert('הליד הומר בהצלחה ללקוח פעיל!');
    } catch (error) {
      console.error("Error converting lead to client:", error);
      alert('שגיאה בהמרת הליד ללקוח');
    }
    setIsConverting(false);
  };

  if (selectedLead) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center gap-3">
                <Building className="w-6 h-6 text-blue-600" />
                פרטי ליד: {selectedLead.company_name}
              </CardTitle>
              <Button variant="outline" onClick={() => setSelectedLead(null)}>
                חזרה לרשימה
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">פרטי יצירת קשר</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-500" />
                    <span>{selectedLead.contact_person}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-gray-500" />
                    <a href={`mailto:${selectedLead.email}`} className="text-blue-600 hover:underline">
                      {selectedLead.email}
                    </a>
                  </div>
                  {selectedLead.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-gray-500" />
                      <a href={`tel:${selectedLead.phone}`} className="text-blue-600 hover:underline">
                        {selectedLead.phone}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">מידע על הליד</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">מקור:</span>
                    <Badge variant="outline">{selectedLead.source}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">סטטוס:</span>
                    <Badge className={statusColors[selectedLead.status]}>
                      {statusLabels[selectedLead.status]}
                    </Badge>
                  </div>
                  {selectedLead.quote_amount && (
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-gray-500" />
                      <span>₪{selectedLead.quote_amount.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {selectedLead.quote_pdf_url && (
              <div>
                <h3 className="text-lg font-semibold mb-2">הצעת מחיר</h3>
                <Button 
                  variant="outline" 
                  onClick={() => window.open(selectedLead.quote_pdf_url, '_blank')}
                  className="flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  צפה בהצעת מחיר
                </Button>
              </div>
            )}

            {selectedLead.inquiry_details && (
              <div>
                <h3 className="text-lg font-semibold mb-2">פרטי הפנייה המקורית</h3>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <pre className="text-sm whitespace-pre-wrap">
                    {JSON.stringify(selectedLead.inquiry_details, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-4 border-t">
              <Select 
                value={selectedLead.status} 
                onValueChange={(newStatus) => handleStatusUpdate(selectedLead.id, newStatus)}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedLead.status !== 'client_active' && selectedLead.status !== 'closed_lost' && (
                <Button 
                  onClick={() => handleConvertToClient(selectedLead)}
                  disabled={isConverting}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isConverting ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <UserPlus className="w-4 h-4 mr-2" />
                  )}
                  המר ללקוח
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
            <Users className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              ניהול לידים ({filteredLeads.length})
            </h1>
            <p className="text-gray-600">מעקב אחר פניות ולקוחות פוטנציאליים</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={loadLeads} variant="outline" size="sm" disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </motion.div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            חיפוש וסינון
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="חפש ליד..."
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
                {Object.entries(statusLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        <AnimatePresence>
          {isLoading ? (
            Array(3).fill(0).map((_, i) => (
              <Card key={i} className="h-32 animate-pulse bg-gray-100" />
            ))
          ) : filteredLeads.length === 0 ? (
            <Card className="p-12 text-center">
              <Users className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">לא נמצאו לידים</h3>
              <p className="text-gray-500">לידים חדשים יופיעו כאן אוטומטית ממערכת הצעות המחיר.</p>
            </Card>
          ) : (
            filteredLeads.map((lead) => (
              <motion.div
                key={lead.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {lead.company_name}
                          </h3>
                          <Badge className={statusColors[lead.status]}>
                            {statusLabels[lead.status]}
                          </Badge>
                        </div>
                        
                        <div className="space-y-1 text-sm text-gray-600 mb-3">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4" />
                            <span>{lead.contact_person}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4" />
                            <span>{lead.email}</span>
                          </div>
                          {lead.phone && (
                            <div className="flex items-center gap-2">
                              <Phone className="w-4 h-4" />
                              <span>{lead.phone}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2 mb-3">
                          <Badge variant="outline" className="text-xs">
                            {lead.source}
                          </Badge>
                          {lead.quote_amount && (
                            <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                              ₪{lead.quote_amount.toLocaleString()}
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs">
                            <Calendar className="w-3 h-3 mr-1" />
                            {format(parseISO(lead.created_date), 'dd/MM/yyyy', { locale: he })}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 mr-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedLead(lead)}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          צפייה
                        </Button>
                        
                        {lead.status !== 'client_active' && lead.status !== 'closed_lost' && (
                          <Select 
                            value={lead.status} 
                            onValueChange={(newStatus) => handleStatusUpdate(lead.id, newStatus)}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(statusLabels).map(([key, label]) => (
                                <SelectItem key={key} value={key}>{label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}