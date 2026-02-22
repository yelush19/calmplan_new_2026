import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, Building, User, Plus, Trash2 } from 'lucide-react';
import { Client } from '@/api/entities';

export default function ClientOnboardingPage() {
  const [linkId, setLinkId] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    nickname: '',
    entity_number: '',
    email: '',
    phone: '',
    address: '',
    contact_person: '',
    contacts: [],
    business_type: 'company',
    service_types: [],
    agreement_agreed: false,
    agreement_by_name: ''
  });

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    if (id) {
      setLinkId(id);
    }
  }, []);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleServiceTypeChange = (serviceType, checked) => {
    setFormData(prev => ({
      ...prev,
      service_types: checked
        ? [...(prev.service_types || []), serviceType]
        : (prev.service_types || []).filter(s => s !== serviceType)
    }));
  };

  const addContact = () => {
    setFormData(prev => ({
      ...prev,
      contacts: [...(prev.contacts || []), {
        name: '',
        role: 'contact_person',
        phone: '',
        email: '',
        is_primary: false
      }]
    }));
  };

  const removeContact = (index) => {
    setFormData(prev => ({
      ...prev,
      contacts: prev.contacts.filter((_, i) => i !== index)
    }));
  };

  const updateContact = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      contacts: prev.contacts.map((contact, i) => 
        i === index ? { ...contact, [field]: value } : contact
      )
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const clientData = {
        ...formData,
        status: 'onboarding_pending',
        onboarding_link_id: linkId,
        agreement_details: {
          agreed_on: new Date().toISOString(),
          agreed_by_name: formData.agreement_by_name,
          agreement_text: agreementText
        }
      };

      await Client.create(clientData);
      setIsSubmitted(true);
    } catch (error) {
      console.error("Error submitting client onboarding:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const serviceTypes = [
    { value: 'payroll', label: 'שכר' },
    { value: 'vat_reporting', label: 'דיווחי מע״מ' },
    { value: 'tax_advances', label: 'מקדמות מס' },
    { value: 'bookkeeping', label: 'הנהלת חשבונות' },
    { value: 'annual_reports', label: 'מאזנים שנתיים' },
    { value: 'reconciliation', label: 'התאמות חשבונות' },
    { value: 'consulting', label: 'ייעוץ' }
  ];

  const roleLabels = {
    owner: 'בעלים',
    ceo: 'מנכ"ל',
    cfo: 'סמנכ"ל כספים',
    accountant: 'רו"ח',
    secretary: 'מזכירה',
    contact_person: 'איש קשר',
    other: 'אחר'
  };

  const agreementText = `הסכם שירותי הנהלת חשבונות

בזאת אני מאשר/ת כי קראתי והבנתי את תנאי השירות של משרד רו"ח תמיר בוק.

אני מסכים/ה לקבל שירותי הנהלת חשבונות בהתאם לסוגי השירותים שסימנתי לעיל.

השירותים יינתנו בהתאם לחוק רו"ח והתקנות שהותקנו מכוחו, ובכפוף לכללי האתיקה המקצועית.

התשלום עבור השירותים יתבצע בהתאם למחירון המשרד ויחויב מדי חודש.

הסכם זה בתוקף מיום חתימתו ועד להודעה על ביטולו על ידי אחד מהצדדים בהודעה מוקדמת של 30 יום.`;

  if (!linkId) {
    return (
      <div className="flex items-center justify-center bg-gray-50 flex-1">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">קישור לא תקין</h2>
              <p className="text-gray-600">נא לפנות למשרד לקבלת קישור חדש לטופס הקליטה.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="flex items-center justify-center bg-gray-50 flex-1">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h2 className="text-2xl font-semibold mb-2">הטופס נשלח בהצלחה!</h2>
                <p className="text-gray-600 mb-4">
                  תודה על מילוי הטופס. צוות המשרד יבדוק את הפרטים ויצור איתך קשר בהקדם.
                </p>
                <p className="text-sm text-gray-500">
                  תוכל לסגור חלון זה כעת.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl font-bold text-gray-900 mb-2">טופס קליטת לקוח</h1>
          <p className="text-gray-600">משרד רו"ח תמיר בוק</p>
        </motion.div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Building className="w-6 h-6 text-blue-600" />
              פרטי הלקוח
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* פרטים בסיסיים */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">שם החברה/העסק *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="nickname">כינוי (אופציונלי)</Label>
                  <Input
                    id="nickname"
                    value={formData.nickname}
                    onChange={(e) => handleInputChange('nickname', e.target.value)}
                    placeholder="שם מקוצר / כינוי"
                  />
                </div>
                <div>
                  <Label htmlFor="entity_number">מספר ח.פ./ע.מ.</Label>
                  <Input
                    id="entity_number"
                    value={formData.entity_number}
                    onChange={(e) => handleInputChange('entity_number', e.target.value)}
                    placeholder="512345678"
                  />
                </div>
                <div>
                  <Label htmlFor="contact_person">איש קשר ראשי *</Label>
                  <Input
                    id="contact_person"
                    value={formData.contact_person}
                    onChange={(e) => handleInputChange('contact_person', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="business_type">סוג העסק</Label>
                  <Select value={formData.business_type} onValueChange={(value) => handleInputChange('business_type', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="company">חברה</SelectItem>
                      <SelectItem value="freelancer">עצמאי</SelectItem>
                      <SelectItem value="nonprofit">עמותה</SelectItem>
                      <SelectItem value="partnership">שותפות</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="email">אימייל *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="phone">טלפון *</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="address">כתובת</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                  />
                </div>
              </div>

              {/* אנשי קשר נוספים */}
              <div className="border-t pt-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">אנשי קשר נוספים</h3>
                  <Button type="button" onClick={addContact} variant="outline" size="sm">
                    <Plus className="w-4 h-4 ml-2" />
                    הוסף איש קשר
                  </Button>
                </div>
                {formData.contacts?.map((contact, index) => (
                  <div key={index} className="bg-gray-50 p-4 rounded-lg mb-4">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-medium">איש קשר #{index + 1}</h4>
                      <Button type="button" onClick={() => removeContact(index)} variant="ghost" size="sm" className="text-amber-600">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="grid md:grid-cols-3 gap-3">
                      <div>
                        <Label>שם</Label>
                        <Input
                          value={contact.name}
                          onChange={(e) => updateContact(index, 'name', e.target.value)}
                          placeholder="שם מלא"
                        />
                      </div>
                      <div>
                        <Label>תפקיד</Label>
                        <Select value={contact.role} onValueChange={(value) => updateContact(index, 'role', value)}>
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
                        <Label>אימייל</Label>
                        <Input
                          type="email"
                          value={contact.email}
                          onChange={(e) => updateContact(index, 'email', e.target.value)}
                          placeholder="email@example.com"
                        />
                      </div>
                      <div>
                        <Label>טלפון</Label>
                        <Input
                          value={contact.phone}
                          onChange={(e) => updateContact(index, 'phone', e.target.value)}
                          placeholder="03-1234567"
                        />
                      </div>
                    </div>
                    <div className="mt-3">
                      <label className="flex items-center gap-2">
                        <Checkbox
                          checked={contact.is_primary}
                          onCheckedChange={(checked) => updateContact(index, 'is_primary', checked)}
                        />
                        איש קשר ראשי
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              {/* סוגי שירותים */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-4">סוגי השירותים הנדרשים</h3>
                <div className="grid md:grid-cols-2 gap-3">
                  {serviceTypes.map((service) => (
                    <div key={service.value} className="flex items-center space-x-2 space-x-reverse">
                      <Checkbox
                        id={service.value}
                        checked={formData.service_types.includes(service.value)}
                        onCheckedChange={(checked) => handleServiceTypeChange(service.value, checked)}
                      />
                      <Label htmlFor={service.value}>{service.label}</Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* הסכם */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-4">הסכם שירות</h3>
                <div className="bg-gray-50 p-4 rounded-lg max-h-60 overflow-y-auto mb-4">
                  <pre className="text-sm whitespace-pre-wrap font-sans">{agreementText}</pre>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="agreement_by_name">שם החותם על ההסכם *</Label>
                    <Input
                      id="agreement_by_name"
                      value={formData.agreement_by_name}
                      onChange={(e) => handleInputChange('agreement_by_name', e.target.value)}
                      placeholder="שם מלא"
                      required
                    />
                  </div>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <Checkbox
                      id="agreement_agreed"
                      checked={formData.agreement_agreed}
                      onCheckedChange={(checked) => handleInputChange('agreement_agreed', checked)}
                      required
                    />
                    <Label htmlFor="agreement_agreed" className="text-sm">
                      אני מאשר/ת כי קראתי, הבנתי ואני מסכים/ה לתנאי ההסכם
                    </Label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={isLoading || !formData.agreement_agreed}
                >
                  {isLoading ? 'שולח...' : 'שלח טופס'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}