
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { X, Plus, Loader2 } from 'lucide-react';
import { ServiceCompany, ServiceProvider } from '@/api/entities';

const serviceProviderTypes = {
  cpa: "רו\"ח",
  cpa_representative: "רו\"ח מייצג",
  attorney: "עו\"ד",
  auditor: "מבקר",
  bookkeeper: "מנה\"ח",
  payroll_specialist: "חשב/ת שכר",
  tax_consultant: "יועץ מס",
  insurance_agent: "סוכן ביטוח",
  insurance_operator: "סוכן ביטוח מתפעל",
  pension_advisor: "יועץ פנסיוני",
  partner: "שותף",
  consultant: "יועץ",
  it_support: "תמיכת IT/מערכות",
  bank_contact: "איש קשר בנק",
  other: "אחר"
};

const specialtiesTypes = {
  tax_planning: "תכנון מס",
  auditing: "ביקורת",
  legal_consulting: "ייעוץ משפטי",
  bookkeeping: "הנהלת חשבונות",
  payroll: "שכר ונלוות",
  business_consulting: "ייעוץ עסקי",
  international_tax: "מיסוי בינלאומי",
  mergers_acquisitions: "מיזוגים ורכישות",
  vat_reporting: "דיווחי מע\"מ",
  social_security: "ביטוח לאומי",
  pension_insurance: "פנסיה וביטוח",
  operator_reporting: "דיווח למתפעל",
  tamal_reporting: "דיווח לטמל",
  masav: "מס\"ב",
  financial_statements: "דוחות כספיים",
  company_registration: "רישום חברות"
};

const getInitialFormData = (provider, serviceCompanyId) => {
    const emptyForm = {
        name: '',
        company_name: '',
        type: 'cpa',
        service_company_id: serviceCompanyId || '',
        license_number: '',
        contact_info: {
            primary_phone: '',
            secondary_phone: '',
            email: '',
            address: '',
            website: ''
        },
        specialties: [],
        hourly_rate: '',
        preferred_contact_method: 'email',
        availability_notes: '',
        rating: '',
        status: 'active',
        notes: ''
    };

    if (!provider || !provider.id) {
        return emptyForm;
    }

    return {
        ...emptyForm,
        ...provider,
        service_company_id: provider.service_company_id || serviceCompanyId || '',
        contact_info: { ...emptyForm.contact_info, ...(provider.contact_info || {}) },
        specialties: provider.specialties || [],
    };
};

export default function ServiceProviderForm({ provider, serviceCompanyId, onSubmit, onCancel }) {
  const [formData, setFormData] = useState(() => getInitialFormData(provider, serviceCompanyId));
  const [companies, setCompanies] = useState([]);
  const [isCreatingCompany, setIsCreatingCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [isSavingCompany, setIsSavingCompany] = useState(false);

  const fetchCompanies = async () => {
    const data = await ServiceCompany.list();
    setCompanies(data || []);
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const handleCreateCompany = async () => {
    if (!newCompanyName.trim()) return;
    setIsSavingCompany(true);
    try {
      const newCompany = await ServiceCompany.create({ name: newCompanyName.trim() });
      await fetchCompanies();
      handleChange('service_company_id', newCompany.id);
      setNewCompanyName('');
      setIsCreatingCompany(false);
    } catch (err) {
      console.error('שגיאה ביצירת חברה:', err);
    }
    setIsSavingCompany(false);
  };
  
  useEffect(() => {
    // This effect ensures the form resets if the provider prop changes (e.g., from editing one to creating a new one)
    setFormData(getInitialFormData(provider, serviceCompanyId));
  }, [provider, serviceCompanyId]);

  const handleChange = (field, value) => {
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);
  };

  const handleContactChange = (field, value) => {
    const newFormData = { ...formData, contact_info: { ...formData.contact_info, [field]: value } };
    setFormData(newFormData);
  };
  
  const handleSpecialtiesChange = (value) => {
    const newFormData = { ...formData, specialties: value };
    setFormData(newFormData);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onCancel}
    >
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{provider?.id ? 'עריכת איש קשר' : 'הוספת איש קשר חדש'}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onCancel}><X className="w-5 h-5" /></Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">שם איש קשר</Label>
                <Input id="name" value={formData.name} onChange={(e) => handleChange('name', e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="company_name">שם חברה</Label>
                <Input
                  id="company_name"
                  value={formData.company_name || ''}
                  onChange={(e) => handleChange('company_name', e.target.value)}
                  placeholder="הקלד שם חברה"
                />
              </div>
              <div>
                <Label htmlFor="company">שיוך לחברת שירות (אופציונלי)</Label>
                {isCreatingCompany ? (
                  <div className="flex gap-2">
                    <Input
                      placeholder="שם החברה החדשה"
                      value={newCompanyName}
                      onChange={(e) => setNewCompanyName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleCreateCompany())}
                      autoFocus
                    />
                    <Button type="button" size="sm" onClick={handleCreateCompany} disabled={isSavingCompany || !newCompanyName.trim()}>
                      {isSavingCompany ? <Loader2 className="w-4 h-4 animate-spin" /> : 'צור'}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setIsCreatingCompany(false)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Select value={formData.service_company_id || 'none'} onValueChange={(value) => handleChange('service_company_id', value === 'none' ? '' : value)}>
                      <SelectTrigger><SelectValue placeholder="בחר חברה"/></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">ללא שיוך</SelectItem>
                        {companies.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" size="icon" variant="outline" onClick={() => setIsCreatingCompany(true)} title="הוסף חברה חדשה">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
              <div>
                <Label htmlFor="type">סוג</Label>
                <Select value={formData.type} onValueChange={(value) => handleChange('type', value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(serviceProviderTypes).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="license">מספר רישיון</Label>
                <Input id="license" value={formData.license_number || ''} onChange={(e) => handleChange('license_number', e.target.value)} />
              </div>
            </div>
            <Card>
              <CardHeader><CardTitle className="text-lg">פרטי קשר</CardTitle></CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone">טלפון ראשי</Label>
                  <Input id="phone" value={formData.contact_info.primary_phone || ''} onChange={(e) => handleContactChange('primary_phone', e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="secondary_phone">טלפון נוסף</Label>
                  <Input id="secondary_phone" value={formData.contact_info.secondary_phone || ''} onChange={(e) => handleContactChange('secondary_phone', e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="email">אימייל</Label>
                  <Input id="email" type="email" value={formData.contact_info.email || ''} onChange={(e) => handleContactChange('email', e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="website">אתר אינטרנט</Label>
                  <Input id="website" value={formData.contact_info.website || ''} onChange={(e) => handleContactChange('website', e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="address">כתובת</Label>
                  <Input id="address" value={formData.contact_info.address || ''} onChange={(e) => handleContactChange('address', e.target.value)} />
                </div>
              </CardContent>
            </Card>
            <div>
              <Label>תחומי התמחות</Label>
              <div onClick={(e) => e.stopPropagation()}>
                <ToggleGroup type="multiple" value={formData.specialties || []} onValueChange={handleSpecialtiesChange} className="flex-wrap justify-start">
                  {Object.entries(specialtiesTypes).map(([key, label]) => (
                    <ToggleGroupItem key={key} value={key}>{label}</ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="hourly_rate">שכר שעתי</Label>
                <Input id="hourly_rate" type="number" value={formData.hourly_rate || ''} onChange={(e) => handleChange('hourly_rate', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="preferred_contact_method">אופן התקשרות מועדף</Label>
                <Select value={formData.preferred_contact_method} onValueChange={(value) => handleChange('preferred_contact_method', value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">אימייל</SelectItem>
                    <SelectItem value="phone">טלפון</SelectItem>
                    <SelectItem value="whatsapp">וואטסאפ</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="availability_notes">זמינות</Label>
                <Textarea id="availability_notes" value={formData.availability_notes || ''} onChange={(e) => handleChange('availability_notes', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="rating">דירוג</Label>
                <Input id="rating" type="number" min="1" max="5" value={formData.rating || ''} onChange={(e) => handleChange('rating', e.target.value)} />
              </div>
               <div>
                <Label htmlFor="status">סטטוס</Label>
                <Select value={formData.status} onValueChange={(value) => handleChange('status', value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">פעיל</SelectItem>
                    <SelectItem value="inactive">לא פעיל</SelectItem>
                    <SelectItem value="on_hold">בהמתנה</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="notes">הערות</Label>
              <Textarea id="notes" value={formData.notes || ''} onChange={(e) => handleChange('notes', e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onCancel}>ביטול</Button>
              <Button type="submit">{provider?.id ? 'עדכן איש קשר' : 'צור איש קשר'}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}
