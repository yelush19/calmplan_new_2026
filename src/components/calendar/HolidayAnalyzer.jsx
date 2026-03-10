import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from '@/components/ui/button';
import { Info, AlertTriangle, PartyPopper, CalendarDays, Moon } from 'lucide-react';
import { isToday, isTomorrow, isSameDay, parseISO, format, addDays } from 'date-fns';
import { he } from 'date-fns/locale';

const ISRAELI_HOLIDAYS_2024 = {
  "2024-10-02": { name: "ערב ראש השנה", type: "erev" },
  "2024-10-03": { name: "ראש השנה א'", type: "holiday" },
  "2024-10-04": { name: "ראש השנה ב'", type: "holiday" },
  "2024-10-11": { name: "ערב יום כיפור", type: "erev" },
  "2024-10-12": { name: "יום כיפור", type: "holiday" },
  "2024-10-16": { name: "ערב סוכות", type: "erev" },
  "2024-10-17": { name: "סוכות", type: "holiday" },
  "2024-10-18": { name: "חול המועד סוכות", type: "chol_hamoed" },
  "2024-10-19": { name: "חול המועד סוכות", type: "chol_hamoed" },
  "2024-10-20": { name: "חול המועד סוכות", type: "chol_hamoed" },
  "2024-10-21": { name: "חול המועד סוכות", type: "chol_hamoed" },
  "2024-10-22": { name: "חול המועד סוכות", type: "chol_hamoed" },
  "2024-10-23": { name: "ערב שמחת תורה", type: "erev" },
  "2024-10-24": { name: "שמחת תורה", type: "holiday" },
};

export default function HolidayAnalyzer({ task, date, onDateChange }) {
  const analysis = useMemo(() => {
    if (!date) return null;

    try {
      const selectedDate = parseISO(date);
      const dateString = format(selectedDate, "yyyy-MM-dd");
      const dayOfWeek = selectedDate.getDay();

      if (ISRAELI_HOLIDAYS_2024[dateString]) {
        const holiday = ISRAELI_HOLIDAYS_2024[dateString];
        if (holiday.type === 'holiday') {
          return {
            level: 'error',
            icon: PartyPopper,
            title: `תשומת לב: ${holiday.name}`,
            message: 'התאריך שבחרת הוא יום חג מלא. מומלץ למצוא תאריך חלופי.'
          };
        }
        if (holiday.type === 'erev') {
          return {
            level: 'warning',
            icon: Info,
            title: `הערה: ${holiday.name}`,
            message: 'התאריך הוא ערב חג. כדאי לתכנן משימות קצרות יותר ולהיערך בהתאם.'
          };
        }
        if (holiday.type === 'chol_hamoed') {
          return {
            level: 'info',
            icon: CalendarDays,
            title: `הערה: ${holiday.name}`,
            message: 'התאריך הוא חול המועד. ייתכן ולוח הזמנים יהיה שונה מהרגיל.'
          };
        }
      }

      if (dayOfWeek === 5) { // Friday
        return {
          level: 'warning',
          icon: Moon,
          title: 'ערב שבת',
          message: 'יום שישי הוא יום קצר יותר. האם המשימה מתאימה? אולי להעביר ליום אחר?'
        };
      }
      
      if (dayOfWeek === 6) { // Saturday
        return {
          level: 'error',
          icon: PartyPopper,
          title: 'שבת',
          message: 'שבת היא יום מנוחה. לא ניתן לתכנן אירועים ליום זה.'
        };
      }

      if (task.priority === 'urgent' && (dayOfWeek === 4 || dayOfWeek === 5)) {
        return {
            level: 'warning',
            icon: AlertTriangle,
            title: 'דחוף לפני סופ"ש',
            message: 'המשימה דחופה והיא ממש לפני הסופ"ש. האם תספיקי? אולי להקדים אותה?'
        }
      }

      return null;
    } catch (e) {
      return null; // Invalid date
    }
  }, [date, task]);

  if (!analysis) return null;

  const getAlertVariant = () => {
    if (analysis.level === 'error') return 'destructive';
    if (analysis.level === 'warning') return { className: "bg-yellow-50 border-yellow-200 text-yellow-800" };
    return { className: "bg-blue-50 border-blue-200 text-blue-800" };
  };

  const suggestNextWorkday = () => {
    let currentDate = addDays(parseISO(date), 1);
    while (true) {
        const dayOfWeek = currentDate.getDay();
        const dateString = format(currentDate, "yyyy-MM-dd");
        if (dayOfWeek !== 5 && dayOfWeek !== 6 && (!ISRAELI_HOLIDAYS_2024[dateString] || ISRAELI_HOLIDAYS_2024[dateString].type !== 'holiday')) {
            onDateChange(format(currentDate, "yyyy-MM-dd'T'HH:mm"));
            break;
        }
        currentDate = addDays(currentDate, 1);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <Alert variant={getAlertVariant()}>
        <analysis.icon className="h-5 w-5" />
        <AlertTitle className="font-bold">{analysis.title}</AlertTitle>
        <AlertDescription>
          {analysis.message}
          {(analysis.level === 'error' || analysis.level === 'warning') && onDateChange && (
            <Button
              onClick={suggestNextWorkday}
              variant="link"
              className="p-0 h-auto text-current font-bold mt-2"
            >
              מצא לי את יום העבודה הפנוי הבא
            </Button>
          )}
        </AlertDescription>
      </Alert>
    </motion.div>
  );
}