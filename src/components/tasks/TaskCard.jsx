
import React, { useState } from 'react';

const fixShortYear = (v) => {
  if (!v) return v;
  const m = v.match(/^(\d{1,2})-(\d{2})-(\d{2})$/);
  if (m) { const yr = parseInt(m[1], 10); return `${yr < 100 ? (yr < 50 ? 2000 + yr : 1900 + yr) : yr}-${m[2]}-${m[3]}`; }
  return v;
};
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
    Clock, 
    Check, 
    Edit, 
    Play, 
    User,
    CheckCircle,
    ExternalLink,
    Trash2,
    Save,
    X
} from 'lucide-react';
import { format, formatDistanceToNow, parseISO, isBefore, differenceInDays } from 'date-fns';
import { he } from 'date-fns/locale';
import OverdueTags from "./OverdueTags";
import { STATUS_CONFIG } from '@/config/processTemplates';

const statusTranslations = {
  not_started: 'טרם התחיל',
  remaining_completions: 'נותרו השלמות',
  in_progress: 'בעבודה',
  completed: 'דווח ושולם',
  postponed: 'נדחה',
  cancelled: 'בוטל',
  waiting_for_approval: 'לבדיקה',
  waiting_for_materials: 'ממתין לחומרים',
  issue: 'בעיה',
  ready_for_reporting: 'מוכן לדיווח',
  reported_waiting_for_payment: 'ממתין לתשלום'
};

const categoryTranslations = {
    work_payroll: "שכר",
    work_vat_reporting: "מע\"מ",
    work_tax_advances: "מקדמות מס",
    work_deductions: "ניכויים",
    work_social_security: "ביטוח לאומי",
    work_authorities: "רשויות",
    work_client_management: "ניהול לקוח",
    work_reconciliation: "התאמות",
    work_admin: "אדמיניסטרציה",
    home_cleaning_kitchen: "ניקיון מטבח",
    home_cleaning_livingroom: "ניקיון סלון",
    home_cleaning_bathrooms: 'שירותים ומקלחות',
    home_cleaning_bedrooms: 'חדרי שינה',
    home_cleaning_general: 'ניקיון כללי',
    home_laundry: 'כביסה',
    home_food_planning: 'תכנון תפריט',
    home_shopping: 'קניות',
    home_garden_watering: 'השקיה',
    home_garden_maintenance: 'תחזוקת גינה',
    home_garden_pest_control: 'הדברה',
    home_garden_fertilizing: 'הזנה',
    home_family_time: 'זמן משפחה',
    home_personal_time: 'זמן אישי',
    home_exercise: 'פעילות גופנית',
    home_health: 'בריאות',
    home_weekend_nap: 'מנוחת סוף שבוע',
    home_errands: 'סידורים',
    home_maintenance: 'תחזוקת הבית'
};

export default function TaskCard({
  task,
  sessions,
  categoryColors,
  priorityColors,
  onEdit,
  onStatusChange,
  onApprove,
  onStartTimer,
  onClick,
  onDelete,
  onUpdate,
}) {
  const [isQuickEditing, setIsQuickEditing] = useState(false);
  const [clients, setClients] = useState([]);
  const [quickEditData, setQuickEditData] = useState({
    title: task?.title || '',
    description: task?.description || '',
    status: task?.status || 'not_started',
    priority: task?.priority || 'medium',
    category: task?.category || (task?.context === 'work' ? 'work_admin' : 'home_cleaning_general'),
    due_date: task?.due_date || '',
    client_related: task?.client_related || false,
    client_id: task?.client_id || '',
    client_name: task?.client_name || ''
  });

  if (!task) return null;

  const totalTime = sessions.reduce((acc, s) => acc + (s.duration_minutes || 0), 0);
  const isWaitingForApproval = task.status === 'waiting_for_approval';
  
  // טעינת רשימת לקוחות בעת הפתיחה לעריכה
  const loadClients = async () => {
    try {
      const { Client } = await import('@/api/entities');
      const clientsData = await Client.filter({ status: 'active' });
      setClients(clientsData || []);
    } catch (error) {
      console.error("Error loading clients:", error);
      setClients([]);
    }
  };

  const handleCardClick = (e) => {
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('textarea') || e.target.closest('[role="combobox"]')) {
      return;
    }
    if (!isQuickEditing) {
      onClick(task);
    }
  };

  // פונקציה לסימון משימה כהושלמה
  const handleCompleteTask = async (e) => {
    e.stopPropagation();
    if (onStatusChange) {
      await onStatusChange(task, 'completed');
    }
  };
  
  const handleQuickSave = async () => {
    if (onUpdate) {
      const updateData = {
        title: quickEditData.title,
        description: quickEditData.description,
        status: quickEditData.status,
        priority: quickEditData.priority,
        category: quickEditData.category,
        due_date: quickEditData.due_date,
        client_related: quickEditData.client_related,
        client_id: quickEditData.client_id,
        client_name: quickEditData.client_name
      };
      
      await onUpdate(task.id, updateData);
    }
    setIsQuickEditing(false);
  };

  const handleQuickCancel = () => {
    setQuickEditData({
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority,
      category: task.category,
      due_date: task.due_date || '',
      client_related: task.client_related || false,
      client_id: task.client_id || '',
      client_name: task.client_name || ''
    });
    setIsQuickEditing(false);
  };

  const handleClientSelect = (clientId) => {
    const selectedClient = clients.find(c => c.id === clientId);
    setQuickEditData(prev => ({
      ...prev,
      client_id: clientId,
      client_name: selectedClient ? selectedClient.name : ''
    }));
  };

  const isUrgent = task.due_date && differenceInDays(parseISO(task.due_date), new Date()) <= 3;

  const statusOptions = Object.entries(STATUS_CONFIG)
    .filter(([k]) => k !== 'issues') // skip duplicate
    .map(([value, cfg]) => ({ value, label: cfg.label }));

  const priorityOptions = [
    { value: 'low', label: 'נמוכה' },
    { value: 'medium', label: 'בינונית' },
    { value: 'high', label: 'גבוהה' },
    { value: 'urgent', label: 'דחוף' }
  ];

  const categoryOptions = task?.context === 'work' ? [
    { value: 'work_payroll', label: 'שכר' },
    { value: 'work_vat_reporting', label: 'מע"מ' },
    { value: 'work_tax_advances', label: 'מקדמות מס' },
    { value: 'work_deductions', label: 'ניכויים' },
    { value: 'work_social_security', label: 'ביטוח לאומי' },
    { value: 'work_authorities', label: 'רשויות' },
    { value: 'work_client_management', label: 'ניהול לקוח' },
    { value: 'work_reconciliation', label: 'התאמות' },
    { value: 'work_admin', label: 'אדמיניסטרציה' }
  ] : [
    { value: 'home_cleaning_kitchen', label: 'ניקיון מטבח' },
    { value: 'home_cleaning_livingroom', label: 'ניקיון סלון' },
    { value: 'home_cleaning_bathrooms', label: 'שירותים ומקלחות' },
    { value: 'home_cleaning_bedrooms', label: 'חדרי שינה' },
    { value: 'home_cleaning_general', label: 'ניקיון כללי' },
    { value: 'home_laundry', label: 'כביסה' },
    { value: 'home_food_planning', label: 'תכנון תפריט' },
    { value: 'home_shopping', label: 'קניות' },
    { value: 'home_garden_watering', label: 'השקיה' },
    { value: 'home_garden_maintenance', label: 'תחזוקת גינה' },
    { value: 'home_garden_pest_control', label: 'הדברה' },
    { value: 'home_garden_fertilizing', label: 'הזנה' },
    { value: 'home_family_time', label: 'זמן משפחה' },
    { value: 'home_personal_time', label: 'זמן אישי' },
    { value: 'home_exercise', label: 'פעילות גופנית' },
    { value: 'home_health', label: 'בריאות' },
    { value: 'home_weekend_nap', label: 'מנוחת סוף שבוע' },
    { value: 'home_errands', label: 'סידורים' },
    { value: 'home_maintenance', label: 'תחזוקת הבית' }
  ];
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      onClick={handleCardClick}
      className="cursor-pointer"
    >
      <Card className={`overflow-hidden transition-all duration-300 hover:shadow-lg ${priorityColors[task.priority] || 'border-l-gray-300'} ${isUrgent ? 'animate-pulse' : ''} ${isQuickEditing ? 'ring-2 ring-blue-500' : ''}`}>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row justify-between">
            <div className="flex-grow">
              <div className="flex items-center gap-2 mb-2">
                {/* Functional Checkbox for Completion */}
                <button 
                  onClick={handleCompleteTask}
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                    task.status === 'completed' 
                      ? 'bg-green-500 border-green-500 text-white' 
                      : 'border-gray-300 hover:border-green-400 hover:bg-green-50'
                  }`}
                  title={task.status === 'completed' ? 'משימה הושלמה' : 'סמן כהושלם'}
                >
                  {task.status === 'completed' && <Check className="w-4 h-4" />}
                </button>
                
                <div className="flex items-center gap-2 flex-grow">
                  {isQuickEditing ? (
                    <Input
                      value={quickEditData.title}
                      onChange={(e) => setQuickEditData(prev => ({ ...prev, title: e.target.value }))}
                      className="text-lg font-semibold flex-1"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <h3 className={`text-lg font-semibold ${task.status === 'completed' ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                      {task.title}
                    </h3>
                  )}
                  {!isQuickEditing && <OverdueTags dueDate={task.due_date} showText={true} />}
                </div>
              </div>
              
              {isQuickEditing ? (
                <div className="space-y-3 ml-8">
                  <Textarea
                    value={quickEditData.description}
                    onChange={(e) => setQuickEditData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="תיאור המשימה..."
                    className="text-sm"
                    rows={2}
                    onClick={(e) => e.stopPropagation()}
                  />
                  
                  {task?.context === 'work' && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`client_related_${task.id}`}
                          checked={quickEditData.client_related || false}
                          onChange={(e) => {
                            const isChecked = e.target.checked;
                            setQuickEditData(prev => ({ 
                              ...prev, 
                              client_related: isChecked,
                              client_id: isChecked ? prev.client_id : '',
                              client_name: isChecked ? prev.client_name : ''
                            }));
                            if (isChecked && clients.length === 0) {
                              loadClients();
                            }
                          }}
                          className="w-4 h-4 text-blue-600 rounded"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <label htmlFor={`client_related_${task.id}`} className="text-sm font-medium text-gray-700">
                          קשור ללקוח
                        </label>
                      </div>
                      {quickEditData.client_related && (
                        <div className="space-y-2">
                          <Select
                            value={quickEditData.client_id}
                            onValueChange={handleClientSelect}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="בחר לקוח..." />
                            </SelectTrigger>
                            <SelectContent>
                              {clients.map(client => (
                                <SelectItem key={client.id} value={client.id}>
                                  {client.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            placeholder="או הכנס שם לקוח ידנית..."
                            value={quickEditData.client_name || ''}
                            onChange={(e) => setQuickEditData(prev => ({ 
                              ...prev, 
                              client_name: e.target.value,
                              client_id: e.target.value ? '' : prev.client_id
                            }))}
                            className="text-sm"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="flex gap-2 flex-wrap">
                    <Select 
                      value={quickEditData.status} 
                      onValueChange={(value) => setQuickEditData(prev => ({ ...prev, status: value }))}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <Select 
                      value={quickEditData.priority} 
                      onValueChange={(value) => setQuickEditData(prev => ({ ...prev, priority: value }))}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {priorityOptions.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select 
                      value={quickEditData.category} 
                      onValueChange={(value) => setQuickEditData(prev => ({ ...prev, category: value }))}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="בחר קטגוריה" />
                      </SelectTrigger>
                      <SelectContent>
                        {categoryOptions.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={quickEditData.due_date}
                      onChange={(e) => setQuickEditData(prev => ({ ...prev, due_date: e.target.value }))}
                      onBlur={(e) => { const f = fixShortYear(e.target.value); if (f !== e.target.value) setQuickEditData(prev => ({ ...prev, due_date: f })); }}
                      className="w-40"
                      onClick={(e) => e.stopPropagation()}
                      placeholder="תאריך יעד"
                    />
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        handleQuickSave(); 
                      }} 
                      size="sm"
                      className="bg-green-500 hover:bg-green-600"
                    >
                      <Save className="w-4 h-4 ml-2" />
                      שמור
                    </Button>
                    <Button 
                      onClick={(e) => { e.stopPropagation(); handleQuickCancel(); }} 
                      variant="outline" 
                      size="sm"
                    >
                      <X className="w-4 h-4 ml-2" />
                      בטל
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {task.description && (
                    <p className="text-sm text-gray-600 mb-3 ml-8">{task.description}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-2 ml-8">
                    <Badge className={categoryColors[task.category] || 'bg-gray-200'}>
                      {categoryTranslations[task.category] || task.category}
                    </Badge>
                    {task.due_date && (
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>בתאריך: {format(parseISO(task.due_date), "d MMM yyyy", { locale: he })}</span>
                      </Badge>
                    )}
                    {task.client_related && task.client_name && (
                       <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                         <User className="w-3 h-3 ml-1"/>
                         {task.client_name}
                       </Badge>
                    )}
                    {task.assigned_to && (
                       <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                         <User className="w-3 h-3 ml-1"/>
                         {task.assigned_to}
                       </Badge>
                    )}
                    {totalTime > 0 && (
                       <Badge variant="outline" className="bg-blue-50 text-blue-700">
                         <Clock className="w-3 h-3 ml-1"/>
                         {Math.floor(totalTime/60)}ש' {totalTime%60}ד'
                       </Badge>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-col items-end justify-between mt-4 sm:mt-0 sm:ml-4 gap-2">
              {isWaitingForApproval ? (
                <Button onClick={(e) => { e.stopPropagation(); onApprove(task); }} className="bg-green-500 hover:bg-green-600">
                  <CheckCircle className="w-4 h-4 ml-2" />
                  אשר ביצוע
                </Button>
              ) : !isQuickEditing ? (
                <div className="flex items-center gap-2">
                    {task.external_app_link && (
                        <Button 
                            variant="outline" 
                            size="icon"
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                window.open(task.external_app_link, '_blank', 'noopener,noreferrer'); 
                            }}
                            title="פתח ב-Monday.com"
                        >
                            <ExternalLink className="w-4 h-4" />
                        </Button>
                    )}
                  <Button variant="outline" size="icon" onClick={(e) => { e.stopPropagation(); onStartTimer(task); }}>
                    <Play className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={async (e) => { 
                      e.stopPropagation(); 
                      setQuickEditData({
                        title: task.title,
                        description: task.description || '',
                        status: task.status,
                        priority: task.priority,
                        category: task.category || (task.context === 'work' ? 'work_admin' : 'home_cleaning_general'),
                        due_date: task.due_date || '',
                        client_related: task.client_related || false,
                        client_id: task.client_id || '',
                        client_name: task.client_name || ''
                      });
                      setIsQuickEditing(true); 
                      // If task is already client-related, load clients when entering quick edit
                      if (task.client_related) {
                        await loadClients();
                      }
                    }}
                    title="עריכה מהירה"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}>
                    <Trash2 className="w-4 h-4 text-amber-500 hover:text-amber-600" />
                  </Button>
                </div>
              ) : null}
              {!isQuickEditing && (
                <Badge variant={task.status === 'in_progress' ? 'default' : 'secondary'}>
                  {statusTranslations[task.status] || task.status}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
