import React from 'react';
import { differenceInDays } from 'date-fns';
import { CalendarX } from 'lucide-react';

const OverdueTags = ({ dueDate, showText = false }) => {
  if (!dueDate) return null;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const dueDateObj = new Date(dueDate);
  dueDateObj.setHours(0, 0, 0, 0);
  
  const daysOverdue = differenceInDays(today, dueDateObj);
  
  if (daysOverdue <= 0) return null;
  
  let bgColor, textColor, label;
  
  if (daysOverdue === 1) {
    bgColor = 'bg-yellow-100';
    textColor = 'text-yellow-800';
    label = 'איחור יום';
  } else if (daysOverdue <= 3) {
    bgColor = 'bg-orange-100';
    textColor = 'text-orange-800';
    label = `איחור ${daysOverdue} ימים`;
  } else if (daysOverdue <= 7) {
    bgColor = 'bg-amber-100';
    textColor = 'text-amber-800';
    label = `איחור ${daysOverdue} ימים`;
  } else {
    bgColor = 'bg-amber-200';
    textColor = 'text-amber-900';
    label = `איחור ${daysOverdue} ימים`;
  }
  
  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${bgColor} ${textColor}`}>
      <CalendarX className="w-3 h-3" />
      {showText && <span>{label}</span>}
    </div>
  );
};

export default OverdueTags;