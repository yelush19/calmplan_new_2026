import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Briefcase, Home as HomeIcon } from 'lucide-react';
import { Task, Client } from '@/api/entities';
import { ALL_SERVICES } from '@/config/processTemplates';
import { getScheduledStartForCategory } from '@/config/automationRules';
import { format } from 'date-fns';
import { toast } from 'sonner';

// Group services by dashboard for the dropdown
const SERVICE_GROUPS = [
  { key: 'tax', label: 'דיווחי מיסים' },
  { key: 'payroll', label: 'שכר' },
  { key: 'additional', label: 'שירותים נוספים' },
];

const SERVICE_LIST = Object.values(ALL_SERVICES).map(s => ({
  key: s.key,
  label: s.label,
  dashboard: s.dashboard,
  createCategory: s.createCategory,
}));

export default function QuickAddTaskDialog({ open, onOpenChange, onCreated, defaultContext = 'work', defaultCategory = '' }) {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [context, setContext] = useState(defaultContext);
  const [serviceKey, setServiceKey] = useState(defaultCategory || '__none__');
  const [clientId, setClientId] = useState('__none__');
  const [clients, setClients] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      Client.list(null, 500).then(list => {
        setClients((list || []).filter(c => c.status === 'active').sort((a, b) => a.name?.localeCompare(b.name, 'he')));
      }).catch(() => setClients([]));
      setTitle('');
      setDueDate(format(new Date(), 'yyyy-MM-dd'));
      setContext(defaultContext);
      setServiceKey(defaultCategory || '__none__');
      setClientId('__none__');
    }
  }, [open, defaultContext, defaultCategory]);

  const selectedService = serviceKey !== '__none__' ? SERVICE_LIST.find(s => s.key === serviceKey) : null;
  const selectedClient = clientId !== '__none__' ? clients.find(c => c.id === clientId) : null;

  const handleSave = async () => {
    if (!title.trim() || isSaving) return;
    setIsSaving(true);
    try {
      const category = selectedService?.createCategory || '';
      const scheduledStart = category && dueDate ? getScheduledStartForCategory(category, dueDate) : null;

      // Build title with client name if selected
      let taskTitle = title.trim();
      if (selectedClient && !taskTitle.includes(selectedClient.name)) {
        taskTitle = `${taskTitle} - ${selectedClient.name}`;
      }

      await Task.create({
        title: taskTitle,
        status: 'not_started',
        due_date: dueDate,
        scheduled_start: scheduledStart || undefined,
        context,
        category,
        client_name: selectedClient?.name || undefined,
        client_id: selectedClient?.id || undefined,
        client_related: !!selectedClient,
        priority: 'medium',
      });

      toast.success('משימה נוצרה בהצלחה');
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      console.error('שגיאה ביצירת משימה:', err);
      toast.error('שגיאה ביצירת המשימה');
    }
    setIsSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            הוספת משימה מהירה
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {/* Title */}
          <div>
            <Label htmlFor="qa-title" className="text-xs">תיאור המשימה</Label>
            <Input
              id="qa-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="מה צריך לעשות?"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
          </div>

          {/* Service type + Context */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">סוג שירות</Label>
              <Select value={serviceKey} onValueChange={setServiceKey}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="בחר שירות" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__" className="text-xs">ללא (כללי)</SelectItem>
                  {SERVICE_GROUPS.map(group => {
                    const services = SERVICE_LIST.filter(s => s.dashboard === group.key);
                    if (services.length === 0) return null;
                    return (
                      <React.Fragment key={group.key}>
                        <div className="px-2 py-1 text-[10px] font-bold text-gray-400 bg-gray-50">
                          {group.label}
                        </div>
                        {services.map(s => (
                          <SelectItem key={s.key} value={s.key} className="text-xs">
                            {s.label}
                          </SelectItem>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">הקשר</Label>
              <Select value={context} onValueChange={setContext}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="work" className="text-xs">
                    <span className="inline-flex items-center gap-1"><Briefcase className="w-3 h-3" /> עבודה</span>
                  </SelectItem>
                  <SelectItem value="home" className="text-xs">
                    <span className="inline-flex items-center gap-1"><HomeIcon className="w-3 h-3" /> בית</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Client + Due date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">לקוח</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="שיוך ללקוח" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__" className="text-xs">ללא לקוח</SelectItem>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">תאריך יעד</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="text-xs h-9"
                dir="ltr"
              />
            </div>
          </div>

          <Button
            onClick={handleSave}
            disabled={!title.trim() || isSaving}
            className="w-full gap-1"
          >
            <Plus className="w-4 h-4" />
            {isSaving ? 'שומר...' : 'הוסף משימה'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
