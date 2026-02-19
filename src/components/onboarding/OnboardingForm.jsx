import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function OnboardingForm({ formState, setFormState }) {
    const handleInputChange = (field, value) => {
        setFormState(prev => ({ ...prev, [field]: value }));
    };

    const addContact = () => {
        const newContacts = [...(formState.contacts || []), { name: '', role: 'contact_person', phone: '', mobile: '', email: '', is_primary: false }];
        setFormState(prev => ({ ...prev, contacts: newContacts }));
    };

    const updateContact = (index, field, value) => {
        const newContacts = [...formState.contacts];
        newContacts[index][field] = value;
        setFormState(prev => ({ ...prev, contacts: newContacts }));
    };

    const removeContact = (index) => {
        const newContacts = formState.contacts.filter((_, i) => i !== index);
        setFormState(prev => ({ ...prev, contacts: newContacts }));
    };

    const roleLabels = {
        owner: 'בעלים', ceo: 'מנכ"ל', cfo: 'סמנכ"ל כספים', accountant: 'רו"ח', secretary: 'מזכירה', hr_manager: 'מנהל משאבי אנוש', operations: 'תפעול', contact_person: 'איש קשר', administration: 'אדמיניסטרציה', legal_counsel: 'יועץ משפטי', insurance_agent: 'סוכן ביטוח', other: 'אחר'
    };

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-xl font-semibold mb-4 border-b pb-2">פרטי העסק</h3>
                <div className="grid md:grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="name">שם העסק / חברה</Label>
                        <Input id="name" value={formState.name || ''} onChange={e => handleInputChange('name', e.target.value)} required />
                    </div>
                    <div>
                        <Label htmlFor="entity_number">מספר ח.פ. / ע.מ.</Label>
                        <Input id="entity_number" value={formState.entity_number || ''} onChange={e => handleInputChange('entity_number', e.target.value)} />
                    </div>
                    <div className="md:col-span-2">
                        <Label htmlFor="address">כתובת</Label>
                        <Input id="address" value={formState.address || ''} onChange={e => handleInputChange('address', e.target.value)} />
                    </div>
                </div>
            </div>

            <div>
                 <div className="flex justify-between items-center mb-4 border-b pb-2">
                    <h3 className="text-xl font-semibold">אנשי קשר</h3>
                    <Button type="button" variant="outline" size="sm" onClick={addContact}><Plus className="w-4 h-4 ml-2" />הוסף איש קשר</Button>
                </div>
                <div className="space-y-4">
                    {(formState.contacts || []).map((contact, index) => (
                        <div key={index} className="bg-gray-50 p-4 rounded-lg border">
                             <div className="flex justify-end mb-2">
                                <Button type="button" variant="ghost" size="icon" onClick={() => removeContact(index)} className="text-amber-500 hover:bg-amber-50"><Trash2 className="w-4 h-4" /></Button>
                            </div>
                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div><Label>שם מלא</Label><Input value={contact.name} onChange={e => updateContact(index, 'name', e.target.value)} required /></div>
                                <div><Label>תפקיד</Label><Select value={contact.role} onValueChange={(value) => updateContact(index, 'role', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(roleLabels).map(([key, label]) => (<SelectItem key={key} value={key}>{label}</SelectItem>))}</SelectContent></Select></div>
                                <div><Label>אימייל</Label><Input type="email" value={contact.email} onChange={e => updateContact(index, 'email', e.target.value)} /></div>
                                <div><Label>טלפון</Label><Input value={contact.phone} onChange={e => updateContact(index, 'phone', e.target.value)} /></div>
                                <div><Label>נייד</Label><Input value={contact.mobile} onChange={e => updateContact(index, 'mobile', e.target.value)} /></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}