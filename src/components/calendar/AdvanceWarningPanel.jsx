import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Calendar, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

// This data would typically come from a utility or calculation module
const ISRAELI_HOLIDAYS_2024 = {
  "2024-10-03": { name: "ראש השנה א'" },
  "2024-10-12": { name: "יום כפור" },
  "2024-10-17": { name: "סוכות" },
  "2024-04-23": { name: "פסח א'" },
};
const CRITICAL_DATES = { payroll: 15, vat: 15, authorities: 15 };

const getAdvanceWarnings = (currentDate) => {
  const warnings = [];
  const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
  const criticalDay = CRITICAL_DATES.payroll; // Using one for simplicity

  const checkDate = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), criticalDay);
  const checkDateStr = checkDate.toISOString().split('T')[0];

  if (ISRAELI_HOLIDAYS_2024[checkDateStr]) {
    warnings.push({
      date: checkDate,
      holiday: ISRAELI_HOLIDAYS_2024[checkDateStr],
      daysUntil: Math.ceil((checkDate - currentDate) / (1000 * 60 * 60 * 24)),
      type: "דיווח מע\"מ"
    });
  }
  return warnings;
};

export default function AdvanceWarningPanel() {
  const [warnings, setWarnings] = useState([]);
  
  useEffect(() => {
    setWarnings(getAdvanceWarnings(new Date()));
  }, []);

  if (warnings.length === 0) {
    return null; // Don't render anything if there are no warnings
  }

  return (
    <Card className="bg-yellow-50 border-yellow-200 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-yellow-800">
          <AlertTriangle className="w-6 h-6" />
          התראות חכמות לחודש הבא
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {warnings.map((warning, index) => (
          <div key={index} className="p-3 bg-white rounded-lg border border-yellow-300 flex items-start gap-4">
            <div className="flex-shrink-0 mt-1">
              <Calendar className="w-5 h-5 text-yellow-700" />
            </div>
            <div>
              <p className="font-bold text-gray-800">
                שימי לב: מועד ה{warning.type} בחודש הבא ({format(warning.date, 'MMMM', { locale: he })}) 
                נופל על {warning.holiday.name}.
              </p>
              <p className="text-sm text-gray-600">
                מומלץ להיערך מראש ולהקדים את הדיווחים. נותרו <span className="font-bold">{warning.daysUntil}</span> ימים.
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>