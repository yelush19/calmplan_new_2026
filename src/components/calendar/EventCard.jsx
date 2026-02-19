import React from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin, AlertCircle, Video, CheckSquare, Briefcase, Heart } from "lucide-react";

export default function EventCard({ 
  item, 
  onClick, 
  showDate = false 
}) {
  if (!item) return null;

  const { itemType, category = 'personal', priority = 'medium' } = item;

  // FIXED: Consistent colors based on type and category
  const getItemColor = () => {
    // Health/Treatment = GREEN (consistent)
    if (category === 'health') {
      return 'bg-green-100 text-green-800 border-green-200';
    }
    
    // Meeting = ORANGE (new, distinct from teal)
    if (category === 'meeting') {
      return 'bg-orange-100 text-orange-800 border-orange-200';
    }
    
    // Tasks = BLUE (consistent)
    if (itemType === 'task') {
      return 'bg-blue-100 text-blue-800 border-blue-200';
    }
    
    // Events = PURPLE (consistent)
    if (itemType === 'event') {
      return 'bg-purple-100 text-purple-800 border-purple-200';
    }
    
    // Default fallback
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getItemIcon = () => {
    if (category === 'health') return <Heart className="w-5 h-5 text-green-600" />;
    if (category === 'meeting') return <Briefcase className="w-5 h-5 text-orange-600" />;
    if (itemType === 'task') return <CheckSquare className="w-5 h-5 text-blue-600" />;
    return <Briefcase className="w-5 h-5 text-purple-600" />;
  };

  const getTimeDisplay = () => {
    if (itemType === 'event' && item.start_date && item.end_date) {
      try {
        const startTime = item.start_date.split('T')[1]?.substring(0, 5);
        const endTime = item.end_date.split('T')[1]?.substring(0, 5);
        return startTime && endTime ? `${startTime} - ${endTime}` : '';
      } catch {
        return '';
      }
    }
    return '';
  };

  const getDateDisplay = () => {
    if (showDate) {
      const dateStr = item.start_date || item.due_date;
      if (dateStr) {
        try {
          const [year, month, day] = dateStr.split('T')[0].split('-');
          return `${day}/${month}`;
        } catch {
          return '';
        }
      }
    }
    return '';
  };

  const getBadgeText = () => {
    if (category === 'health') return 'טיפול';
    if (itemType === 'task') return 'משימה';
    if (category === 'meeting') return 'פגישה';
    return 'אירוע';
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`p-4 rounded-xl cursor-pointer transition-all duration-300 hover:shadow-lg border-l-4 ${getItemColor()}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            {getItemIcon()}
            <h4 className="font-semibold text-lg">{item.title}</h4>
            {priority === "urgent" && (
              <AlertCircle className="w-4 h-4 text-amber-600 animate-pulse" />
            )}
          </div>
          
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Badge 
              variant="secondary" 
              className={`text-xs font-medium px-2 py-1 ${getItemColor()}`}
            >
              {getBadgeText()}
            </Badge>
          </div>

          {item.description && (
            <p className="text-sm opacity-80 mb-2 line-clamp-2">{item.description}</p>
          )}
          
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm mt-2">
            {getDateDisplay() && (
              <div className="flex items-center gap-1 font-medium text-emerald-600">
                <span>{getDateDisplay()}</span>
              </div>
            )}
            
            {getTimeDisplay() && (
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{getTimeDisplay()}</span>
              </div>
            )}
            
            {item.location && (
              <div className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                <span className="truncate max-w-[150px]">{item.location}</span>
              </div>
            )}
            
            {item.meeting_link && (
              <a 
                href={item.meeting_link} 
                target="_blank" 
                rel="noopener noreferrer" 
                onClick={(e) => e.stopPropagation()} 
                className="flex items-center gap-1 text-blue-600 hover:text-blue-800 transition-colors font-medium bg-blue-50 px-2 py-1 rounded-full"
              >
                <Video className="w-3 h-3" />
                <span>פגישה</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}