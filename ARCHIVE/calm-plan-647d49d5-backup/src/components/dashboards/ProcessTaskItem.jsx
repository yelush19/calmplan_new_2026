import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { differenceInDays, startOfDay } from 'date-fns';
import { AlertTriangle, FileWarning, CircleEllipsis } from 'lucide-react';

export default function ProcessTaskItem({ task }) {
  const getStatusBadge = () => {
    switch(task.status) {
      case 'completed':
        return <Badge variant="success" className="bg-green-100 text-green-800">הושלם</Badge>;
      case 'in_progress':
        return <Badge variant="outline" className="text-blue-800 border-blue-300">בתהליך</Badge>;
      case 'waiting_for_materials':
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="destructive" className="bg-orange-100 text-orange-800 cursor-help">
                  <FileWarning className="w-3 h-3 ml-1" />
                  חסר חומר
                </Badge>
              </TooltipTrigger>
              <TooltipContent><p>ממתין לחומרים מהלקוח</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      case 'issue':
        return <Badge variant="destructive">תקלה</Badge>;
      default:
        return <Badge variant="secondary">ממתין</Badge>;
    }
  };

  const daysLeft = task.due_date ? differenceInDays(startOfDay(new Date(task.due_date)), startOfDay(new Date())) : null;
  
  return (
    <div className="flex justify-between items-center bg-gray-50 p-2 rounded-md border border-gray-200 hover:bg-gray-100 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="truncate font-medium text-gray-800">{task.client_name || task.title}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {daysLeft !== null && daysLeft <= 3 && task.status !== 'completed' && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="destructive" className="flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {daysLeft < 0 ? `איחור ב-${Math.abs(daysLeft)} ימים` : `נשארו ${daysLeft} ימים`}
                </Badge>
              </TooltipTrigger>
              <TooltipContent><p>תאריך יעד: {new Date(task.due_date).toLocaleDateString('he-IL')}</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {getStatusBadge()}
      </div>
    </div>
  );
}