
import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Filter, Users, Calendar as CalendarIcon } from "lucide-react";
import { format, addDays } from "date-fns";
import { he } from "date-fns/locale";
import { STATUS_CONFIG } from '@/config/processTemplates';

export default function TaskFilters({ filters, setFilters, context, clients }) {
  const handleFilterChange = (type, value) => {
    setFilters(prev => ({
      ...prev,
      [type]: value
    }));
  };
  
  const handleDateChange = (dateRange) => {
    setFilters(prev => ({
        ...prev,
        dueDate: dateRange
    }));
  };

  const workCategories = [
    { value: "work_vat_reporting", label: "דיווח מע\"מ" },
    { value: "work_tax_advances", label: "מקדמות מס" },
    { value: "work_deductions", label: "ניכויים" },
    { value: "work_social_security", label: "ביטוח לאומי" },
    { value: "work_payroll", label: "שכר" },
    { value: "work_client_management", label: "ניהול לקוחות" },
    { value: "work_reconciliation", label: "התאמות" },
    { value: "work_admin", label: "אדמיניסטרציה" }
  ];

  const homeCategories = [
    { value: "home_cleaning_general", label: "ניקיון כללי" },
    { value: "home_food_planning", label: "תכנון אוכל" },
    { value: "home_shopping", label: "קניות" },
    { value: "home_family_time", label: "זמן משפחה" },
    { value: "home_maintenance", label: "תחזוקה" }
  ];

  const currentCategories = context === 'work' ? workCategories : homeCategories;

  const statusOptions = Object.entries(STATUS_CONFIG)
    .filter(([k]) => k !== 'issues')
    .map(([value, cfg]) => ({ value, label: cfg.label }));

  return (
    <div className="flex flex-wrap gap-4 p-6 bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-gray-500" />
        <span className="font-medium text-gray-700">מסננים מתקדמים:</span>
      </div>

      <Select value={filters.status} onValueChange={(value) => handleFilterChange("status", value)}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="סטטוס" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">כל הסטטוסים</SelectItem>
          {statusOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.category} onValueChange={(value) => handleFilterChange("category", value)}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="קטגוריה" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">כל הקטגוריות</SelectItem>
          {currentCategories.map(cat => (
            <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.priority} onValueChange={(value) => handleFilterChange("priority", value)}>
        <SelectTrigger className="w-32">
          <SelectValue placeholder="דחיפות" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">כל הדחיפויות</SelectItem>
          <SelectItem value="low">נמוכה</SelectItem>
          <SelectItem value="medium">בינונית</SelectItem>
          <SelectItem value="high">גבוהה</SelectItem>
          <SelectItem value="urgent">דחוף</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.importance} onValueChange={(value) => handleFilterChange("importance", value)}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="רמת אנרגיה" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">כל רמות האנרגיה</SelectItem>
          <SelectItem value="low">נמוכה</SelectItem>
          <SelectItem value="medium">בינונית</SelectItem>
          <SelectItem value="high">גבוהה</SelectItem>
        </SelectContent>
      </Select>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className="w-64 justify-start text-left font-normal"
          >
            <CalendarIcon className="ml-2 h-4 w-4" />
            {filters.dueDate?.from ? (
              filters.dueDate.to ? (
                <>
                  {format(filters.dueDate.from, "d בLLL, y", {locale: he})} - {format(filters.dueDate.to, "d בLLL, y", {locale: he})}
                </>
              ) : (
                format(filters.dueDate.from, "d בLLL, y", {locale: he})
              )
            ) : (
              <span>בחר טווח תאריכים</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={filters.dueDate?.from}
            selected={filters.dueDate}
            onSelect={handleDateChange}
            numberOfMonths={2}
            locale={he}
          />
        </PopoverContent>
      </Popover>
      
      {context === 'work' && (
        <Select value={filters.client} onValueChange={(value) => handleFilterChange("client", value)}>
            <SelectTrigger className="w-48">
                <SelectValue placeholder="סנן לפי לקוח" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">כל הלקוחות</SelectItem>
                {clients?.map(client => (
                    <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                ))}
            </SelectContent>
        </Select>
      )}

      <div className="flex items-center gap-2">
        <Users className="w-4 h-4 text-gray-500" />
        <Input
          placeholder="שם לקוח..."
          value={filters.clientName || ""}
          onChange={(e) => handleFilterChange("clientName", e.target.value)}
          className="w-32"
        />
      </div>
    </div>
  );
}
