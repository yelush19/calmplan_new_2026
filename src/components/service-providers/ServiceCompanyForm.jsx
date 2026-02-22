import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { X } from 'lucide-react';
import { ServiceCompany } from '@/api/entities';

export default function ServiceCompanyForm({ company, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    main_phone: '',
    notes: ''
  });

  useEffect(() => {
    if (company) {
      setFormData(company);
    }
  }, [company]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if(formData.id) {
        await ServiceCompany.update(formData.id, formData);
    } else {
        await ServiceCompany.create(formData);
    }
    onSubmit(formData);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onCancel}
    >
      <Card className="w-full max-w-lg bg-white shadow-xl" onClick={e => e.stopPropagation()}>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{company?.id ? 'עריכת חברה' : 'הוספת חברה חדשה'}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onCancel}><X className="w-5 h-5" /></Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <Label htmlFor="name">שם החברה</Label>
                <Input id="name" value={formData.name} onChange={(e) => handleChange('name', e.target.value)} required />
            </div>
             <div>
                <Label htmlFor="address">כתובת</Label>
                <Input id="address" value={formData.address} onChange={(e) => handleChange('address', e.target.value)} />
            </div>
             <div>
                <Label htmlFor="main_phone">טלפון ראשי</Label>
                <Input id="main_phone" value={formData.main_phone} onChange={(e) => handleChange('main_phone', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="notes">הערות</Label>
              <Textarea id="notes" value={formData.notes} onChange={(e) => handleChange('notes', e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onCancel}>ביטול</Button>
              <Button type="submit">שמירה</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}