import React, { useState, useEffect } from 'react';
import { ClientServiceProvider, ServiceProvider, ServiceCompany } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Users, Plus, Phone, Mail, Building, User, Trash2,
  Edit, Save, X, Star, Briefcase
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const serviceProviderTypes = {
  cpa: "רו\"ח",
  attorney: "עו\"ד",
  auditor: "מבקר",
  bookkeeper: "מנה\"ח",
  partner: "שותף",
  consultant: "יועץ",
  insurance_agent: "סוכן ביטוח",
  pension_advisor: "יועץ פנסיוני",
  tax_consultant: "יועץ מס",
  bank_contact: "איש קשר בנק",
  investment_advisor: "יועץ השקעות",
  other: "אחר"
};

const roleLabels = {
  primary_cpa: "רו\"ח ראשי",
  secondary_cpa: "רו\"ח משני",
  attorney: "עו\"ד",
  insurance_main: "סוכן ביטוח ראשי",
  pension_advisor: "יועץ פנסיוני",
  bank_contact: "איש קשר בנק",
  other: "אחר"
};

export default function ClientServiceProvidersTab({ clientId, clientName }) {
  const [clientProviders, setClientProviders] = useState([]);
  const [allProviders, setAllProviders] = useState([]);
  const [allCompanies, setAllCompanies] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [role, setRole] = useState('other');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadData();
  }, [clientId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [clientProvidersData, providersData, companiesData] = await Promise.all([
        ClientServiceProvider.filter({ client_id: clientId }),
        ServiceProvider.list(),
        ServiceCompany.list()
      ]);

      setClientProviders(clientProvidersData || []);
      setAllProviders(providersData || []);
      setAllCompanies(companiesData || []);
    } catch (error) {
      console.error("Error loading service providers:", error);
    }
    setIsLoading(false);
  };

  const getProviderDetails = (providerId) => {
    return allProviders.find(p => p.id === providerId);
  };

  const getCompanyName = (companyId) => {
    const company = allCompanies.find(c => c.id === companyId);
    return company?.name || '';
  };

  const handleAddProvider = async () => {
    if (!selectedProviderId) return;

    try {
      await ClientServiceProvider.create({
        client_id: clientId,
        service_provider_id: selectedProviderId,
        role: role,
        notes: notes,
        is_active: true
      });

      setShowAddDialog(false);
      setSelectedProviderId('');
      setRole('other');
      setNotes('');
      await loadData();
    } catch (error) {
      console.error("Error adding service provider:", error);
      alert('שגיאה בהוספת נותן שירות');
    }
  };

  const handleRemoveProvider = async (clientProviderId) => {
    if (!window.confirm('האם להסיר את נותן השירות מהלקוח?')) return;

    try {
      await ClientServiceProvider.delete(clientProviderId);
      await loadData();
    } catch (error) {
      console.error("Error removing service provider:", error);
      alert('שגיאה בהסרת נותן שירות');
    }
  };

  // מיון לפי סוג
  const providersByType = clientProviders.reduce((acc, cp) => {
    const provider = getProviderDetails(cp.service_provider_id);
    if (provider) {
      const type = provider.type || 'other';
      if (!acc[type]) acc[type] = [];
      acc[type].push({ ...cp, provider });
    }
    return acc;
  }, {});

  // נותני שירות שעדיין לא משויכים ללקוח
  const availableProviders = allProviders.filter(
    p => !clientProviders.some(cp => cp.service_provider_id === p.id)
  );

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-muted-foreground">טוען נותני שירות...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* כותרת וכפתור הוספה */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">נותני שירות של {clientName}</h3>
          <p className="text-sm text-muted-foreground">
            {clientProviders.length} נותני שירות משויכים
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)} disabled={availableProviders.length === 0}>
          <Plus className="w-4 h-4 ml-2" />
          הוסף נותן שירות
        </Button>
      </div>

      {/* סטטיסטיקות */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Users className="w-8 h-8 mx-auto mb-2 text-primary" />
            <div className="text-2xl font-bold">{clientProviders.length}</div>
            <div className="text-sm text-muted-foreground">סה"כ</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Briefcase className="w-8 h-8 mx-auto mb-2 text-blue-600" />
            <div className="text-2xl font-bold">{providersByType['cpa']?.length || 0}</div>
            <div className="text-sm text-muted-foreground">רו"ח</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Star className="w-8 h-8 mx-auto mb-2 text-green-600" />
            <div className="text-2xl font-bold">{providersByType['insurance_agent']?.length || 0}</div>
            <div className="text-sm text-muted-foreground">סוכני ביטוח</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Building className="w-8 h-8 mx-auto mb-2 text-purple-600" />
            <div className="text-2xl font-bold">{providersByType['pension_advisor']?.length || 0}</div>
            <div className="text-sm text-muted-foreground">יועצי פנסיה</div>
          </CardContent>
        </Card>
      </div>

      {/* רשימת נותני שירות לפי סוג */}
      {clientProviders.length === 0 ? (
        <Card className="p-8 text-center">
          <Users className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-semibold text-gray-600 mb-2">
            אין נותני שירות משויכים ל{clientName}
          </h3>
          <p className="text-gray-500 mb-4">
            הוסף רו"ח, עו"ד, סוכן ביטוח או נותני שירות אחרים ללקוח זה.
          </p>
          <Button onClick={() => setShowAddDialog(true)} disabled={availableProviders.length === 0}>
            <Plus className="w-4 h-4 ml-2" />
            הוסף נותן שירות ראשון
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(serviceProviderTypes).map(([typeKey, typeLabel]) => {
            const providersOfType = providersByType[typeKey];
            if (!providersOfType || providersOfType.length === 0) return null;

            return (
              <Card key={typeKey}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-md flex items-center gap-2">
                    <Briefcase className="w-4 h-4" />
                    {typeLabel} ({providersOfType.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {providersOfType.map((cp) => (
                      <div
                        key={cp.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <div className="font-medium">{cp.provider.name}</div>
                            <div className="text-sm text-gray-500">
                              {getCompanyName(cp.provider.service_company_id)}
                            </div>
                            {cp.role && cp.role !== 'other' && (
                              <Badge variant="outline" className="mt-1 text-xs">
                                {roleLabels[cp.role] || cp.role}
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {cp.provider.contact_info?.primary_phone && (
                            <a
                              href={`tel:${cp.provider.contact_info.primary_phone}`}
                              className="text-gray-500 hover:text-primary transition-colors"
                            >
                              <Phone className="w-4 h-4" />
                            </a>
                          )}
                          {cp.provider.contact_info?.email && (
                            <a
                              href={`mailto:${cp.provider.contact_info.email}`}
                              className="text-gray-500 hover:text-primary transition-colors"
                            >
                              <Mail className="w-4 h-4" />
                            </a>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => handleRemoveProvider(cp.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* דיאלוג הוספת נותן שירות */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>הוסף נותן שירות ל{clientName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="provider">בחר נותן שירות</Label>
              <Select value={selectedProviderId} onValueChange={setSelectedProviderId}>
                <SelectTrigger>
                  <SelectValue placeholder="בחר נותן שירות..." />
                </SelectTrigger>
                <SelectContent>
                  {availableProviders.map(provider => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.name} - {serviceProviderTypes[provider.type] || provider.type}
                      {provider.service_company_id && ` (${getCompanyName(provider.service_company_id)})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="role">תפקיד אצל הלקוח</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(roleLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="notes">הערות</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="הערות נוספות..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                ביטול
              </Button>
              <Button onClick={handleAddProvider} disabled={!selectedProviderId}>
                הוסף נותן שירות
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
