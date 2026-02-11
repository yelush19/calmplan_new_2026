import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar, Grid3x3, Rows3, Square } from "lucide-react";
import { format, addDays, addWeeks, addMonths, subDays, subWeeks, subMonths } from "date-fns";
import { he } from "date-fns/locale";
import { motion } from "framer-motion";

export default function CalendarHeader({ 
  currentDate, 
  setCurrentDate, 
  view, 
  setView, 
  selectedDate, 
  setSelectedDate 
}) {
  const navigateDate = (direction) => {
    if (view === "day") {
      setCurrentDate(direction === "next" ? addDays(currentDate, 1) : subDays(currentDate, 1));
      setSelectedDate(direction === "next" ? addDays(selectedDate, 1) : subDays(selectedDate, 1));
    } else if (view === "week") {
      setCurrentDate(direction === "next" ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
    } else {
      setCurrentDate(direction === "next" ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
    }
  };

  const getDateTitle = () => {
    if (view === "day") {
      return format(selectedDate, "EEEE, d בMMMM yyyy", { locale: he });
    } else if (view === "week") {
      return `שבוע של ${format(currentDate, "d בMMMM yyyy", { locale: he })}`;
    } else {
      return format(currentDate, "MMMM yyyy", { locale: he });
    }
  };

  const viewIcons = {
    day: Square,
    week: Rows3,
    month: Grid3x3
  };

  const viewLabels = {
    day: "יום",
    week: "שבוע", 
    month: "חודש"
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col md:flex-row items-center justify-between gap-6 p-6 bg-white rounded-2xl shadow-lg border border-gray-100"
    >
      {/* ניווט תאריכים */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="lg"
          onClick={() => navigateDate("prev")}
          className="w-12 h-12 rounded-full border-2 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50 transition-all duration-300 focus-ring"
        >
          <ChevronRight className="w-5 h-5 text-emerald-600" />
        </Button>
        
        <div className="text-center min-w-[250px]">
          <h2 className="text-2xl font-bold text-gray-800 mb-1">
            {getDateTitle()}
          </h2>
          <Button
            variant="ghost"
            onClick={() => {
              setCurrentDate(new Date());
              setSelectedDate(new Date());
            }}
            className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg px-4 py-2 transition-all duration-300"
          >
            <Calendar className="w-4 h-4 ml-2" />
            חזור להיום
          </Button>
        </div>

        <Button
          variant="outline"
          size="lg"
          onClick={() => navigateDate("next")}
          className="w-12 h-12 rounded-full border-2 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50 transition-all duration-300 focus-ring"
        >
          <ChevronLeft className="w-5 h-5 text-emerald-600" />
        </Button>
      </div>

      {/* בחירת תצוגה */}
      <div className="flex items-center gap-2 bg-emerald-50 rounded-xl p-2">
        {["day", "week", "month"].map((viewType) => {
          const Icon = viewIcons[viewType];
          return (
            <Button
              key={viewType}
              variant={view === viewType ? "default" : "ghost"}
              onClick={() => setView(viewType)}
              className={`px-6 py-3 rounded-lg transition-all duration-300 flex items-center gap-2 ${
                view === viewType 
                  ? "bg-emerald-500 text-white shadow-lg hover:bg-emerald-600" 
                  : "hover:bg-emerald-100 hover:shadow-sm text-emerald-700"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="font-medium">{viewLabels[viewType]}</span>
            </Button>
          );
        })}
      </div>
    </motion.div>
  );
}