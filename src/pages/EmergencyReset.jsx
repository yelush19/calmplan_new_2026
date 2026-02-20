import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { RefreshCw, Construction } from 'lucide-react';

export default function EmergencyResetPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center">
          <RefreshCw className="w-6 h-6 text-red-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">איפוס חירום</h1>
          <p className="text-muted-foreground">איפוס נתונים למקרי חירום</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-12 text-center">
          <Construction className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-semibold text-gray-600 mb-2">עמוד בפיתוח</h3>
          <p className="text-gray-500">הדף יהיה זמין בקרוב.</p>
        </CardContent>
      </Card>
    </div>
  );
}
