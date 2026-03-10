
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

/**
 * MondayDataImport — DEPRECATED
 *
 * Monday.com data files have been quarantined (src/data/_quarantine/).
 * The Single Source of Truth (SSoT) is now:
 *   - src/config/serviceWeights.js (durations + cognitive load)
 *   - src/config/automationRules.js (automation + due dates)
 *   - src/config/taxCalendar2026.js (tax calendar + 874 logic)
 *
 * This component is kept as a tombstone to prevent re-import.
 */
export default function MondayDataImport({ onComplete }) {
  return (
    <Card className="border-amber-300 bg-amber-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2 text-amber-800">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          ייבוא Monday.com — הושבת
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-amber-700">
          נתוני Monday.com הועברו להסגר. מקור האמת היחיד הוא קבצי האפיון (serviceWeights, automationRules, taxCalendar2026).
        </p>
        <p className="text-xs text-amber-600 mt-2">
          לייבוא נתונים חדשים, השתמשו בממשק ה-UI הנוכחי או בעמוד "ייבוא נתונים".
        </p>
      </CardContent>
    </Card>
  );
}
