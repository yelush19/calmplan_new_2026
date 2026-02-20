import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Home, Construction } from 'lucide-react';

export default function HomeTaskGeneratorPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center">
          <Home className="w-6 h-6 text-orange-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">יצירת משימות בית</h1>
          <p className="text-muted-foreground">יצירה אוטומטית של משימות בית</p>
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
