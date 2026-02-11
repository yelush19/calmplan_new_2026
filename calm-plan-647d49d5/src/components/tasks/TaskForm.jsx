
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO } from "date-fns";
import { he } from "date-fns/locale";
import { Calendar as CalendarIcon, Save, X } from 'lucide-react';

export default function TaskForm({ task, context, onSubmit, onCancel }) {
  const [clients, setClients] = useState([]);
  const [currentTask, setCurrentTask] = useState({
    title: "",
    description: "",
    category: context === 'work' ? "work_vat_reporting" : "home_cleaning_general",
    priority: "medium",
    importance: "medium",
    status: "not_started",
    due_date: "",
    assigned_to: "אני",
    client_related: false,
    client_id: "", // New field for client ID
    client_name: "" // Existing field, but now can be linked to client_id
  });

  // תיקון הלוגיקה - בדיקה אם זו עריכה מבוססת על קיום ID במשימה המקורית
  const isEditing = task && task.id;

  useEffect(() => {
    if (task) {
      setCurrentTask({
        ...task,
        client_related: task.client_related || false,
        client_id: task.client_id || "",
        client_name: task.client_name || ""
      });
      // If editing a work task that is client related, load clients
      if (context === 'work' && task.client_related) {
        loadClients();
      }
    } else {
      setCurrentTask({
        title: "",
        description: "",
        category: context === 'work' ? "work_vat_reporting" : "home_cleaning_general",
        priority: "medium",
        importance: "medium",
        status: "not_started",
        due_date: "",
        assigned_to: "אני",
        client_related: false,
        client_id: "",
        client_name: ""
      });
    }
  }, [task, context]);

  // טעינת רשימת לקוחות
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

  const handleInputChange = (field, value) => {
    setCurrentTask(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleDateChange = (date) => {
    handleInputChange('due_date', date ? format(date, 'yyyy-MM-dd') : "");
  };

  const handleClientSelect = (clientId) => {
    const selectedClient = clients.find(c => c.id === clientId);
    setCurrentTask(prev => ({
      ...prev,
      client_id: clientId,
      client_name: selectedClient ? selectedClient.name : ''
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(currentTask);
  };

  const workCategories = [
    { value: "work_payroll", label: "הכנת שכר" },
    { value: "work_vat_reporting", label: "דיווח מע\"מ" },
    { value: "work_authorities", label: "דיווח רשויות" },
    { value: "work_client_management", label: "ניהול לקוח" },
    { value: "work_reconciliation", label: "התאמות חשבונות" },
    { value: "work_admin", label: "אדמיניסטרציה" },
  ];

  const homeCategories = [
    { value: "home_cleaning_kitchen", label: "מטבח" },
    { value: "home_cleaning_livingroom", label: "סלון" },
    { value: "home_cleaning_bathrooms", label: "שירותים ומקלחות" },
    { value: "home_cleaning_bedrooms", label: "חדרי שינה" },
    { value: "home_cleaning_general", label: "כללי וחיצוני" },
    { value: "home_laundry", label: "כביסה" },
    { value: "home_food_planning", label: "תכנון תפריט" },
    { value: "home_shopping", label: "רשימת קניות" },
    { value: "home_garden_watering", label: "השקיה" },
    { value: "home_garden_maintenance", label: "תחזוקה" },
    { value: "home_garden_pest_control", label: "הדברה" },
    { value: "home_garden_fertilizing", label: "הזנה" },
    { value: "home_family_time", label: "זמן משפחה" },
    { value: "home_personal_time", label: "זמן אישי" },
    { value: "home_exercise", label: "פעילות גופנית" },
    { value: "home_health", label: "בריאות" },
    { value: "home_weekend_nap", label: "מנוחת סוף שבוע" },
    { value: "home_errands", label: "סידורים" },
    { value: "home_maintenance", label: "תחזוקת הבית" },
  ];

  const currentCategories = context === 'work' ? workCategories : homeCategories;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-white rounded-2xl shadow-lg p-6 my-6 border border-gray-100"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          placeholder="שם המשימה..."
          value={currentTask.title || ''}
          onChange={(e) => handleInputChange('title', e.target.value)}
          className="text-lg font-semibold"
          required
        />
        <Textarea
          placeholder="תיאור המשימה..."
          value={currentTask.description || ''}
          onChange={(e) => handleInputChange('description', e.target.value)}
        />

        {/* שדה קשור ללקוח */}
        {context === 'work' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="client_related"
                checked={currentTask.client_related || false}
                onChange={(e) => {
                  const isChecked = e.target.checked;
                  handleInputChange('client_related', isChecked);
                  if (!isChecked) {
                    handleInputChange('client_id', '');
                    handleInputChange('client_name', '');
                  } else if (clients.length === 0) { // Only load clients if they haven't been loaded yet
                    loadClients();
                  }
                }}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <label htmlFor="client_related" className="text-sm font-medium text-gray-700">
                קשור ללקוח
              </label>
            </div>
            {currentTask.client_related && (
              <div className="space-y-2">
                <Select
                  value={currentTask.client_id}
                  onValueChange={handleClientSelect}
                >
                  <SelectTrigger>
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
                  value={currentTask.client_name || ''}
                  onChange={(e) => {
                    handleInputChange('client_name', e.target.value);
                    if (e.target.value) {
                      handleInputChange('client_id', ''); // Clear ID if typing manually
                    }
                  }}
                />
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="justify-start text-left font-normal"
                type="button"
              >
                <CalendarIcon className="ml-2 h-4 w-4" />
                {currentTask.due_date
                  ? format(parseISO(currentTask.due_date), 'd MMM yyyy', { locale: he })
                  : "תאריך יעד"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={currentTask.due_date ? parseISO(currentTask.due_date) : undefined}
                onSelect={handleDateChange}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <Select value={currentTask.priority || 'medium'} onValueChange={(value) => handleInputChange('priority', value)}>
            <SelectTrigger><SelectValue placeholder="דחיפות" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">נמוכה</SelectItem>
              <SelectItem value="medium">בינונית</SelectItem>
              <SelectItem value="high">גבוהה</SelectItem>
              <SelectItem value="urgent">דחוף</SelectItem>
            </SelectContent>
          </Select>

          <Select value={currentTask.importance || 'medium'} onValueChange={(value) => handleInputChange('importance', value)}>
            <SelectTrigger><SelectValue placeholder="רמת אנרגיה" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">נמוכה</SelectItem>
              <SelectItem value="medium">בינונית</SelectItem>
              <SelectItem value="high">גבוהה</SelectItem>
            </SelectContent>
          </Select>

          <Select value={currentTask.category || ''} onValueChange={(value) => handleInputChange('category', value)}>
            <SelectTrigger><SelectValue placeholder="קטגוריה" /></SelectTrigger>
            <SelectContent>
              {currentCategories.map(cat => (
                <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onCancel}
            className="flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            ביטול
          </Button>
          <Button 
            type="submit" 
            disabled={!currentTask.title?.trim()} 
            className="bg-primary hover:bg-primary/90 text-white flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {isEditing ? 'עדכן משימה' : 'צור משימה'}
          </Button>
        </div>
      </form>
    </motion.div>
  );
}
