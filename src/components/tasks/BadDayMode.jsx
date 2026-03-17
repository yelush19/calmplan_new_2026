import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Heart, Coffee, Calendar, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function BadDayMode({ isActive, onToggle, onPostponeTasks }) {
  const [isActivating, setIsActivating] = useState(false);

  const handleActivate = async () => {
    setIsActivating(true);
    await onPostponeTasks();
    onToggle(true);
    setIsActivating(false);
  };

  if (!isActive) {
    return (
      <Card className="border border-sky-200/60 bg-sky-50/40">
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Heart className="w-5 h-5 text-sky-500" />
              <span className="text-sky-800 font-medium text-sm">יום קשה? הפעלי מצב הקלה</span>
            </div>
            <Button
              onClick={handleActivate}
              disabled={isActivating}
              size="sm"
              className="bg-sky-500 hover:bg-sky-600 text-white text-xs"
            >
              {isActivating ? 'מפעיל...' : 'הפעלי מצב הקלה'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-4"
    >
      <Card className="border border-emerald-200/60 bg-emerald-50/40">
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="flex items-center gap-2 text-emerald-700 text-sm">
            <Shield className="w-4 h-4" />
            מצב הקלה פעיל
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-3 px-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex items-center gap-2 text-emerald-600">
              <Calendar className="w-3.5 h-3.5" />
              <span className="text-xs">משימות לא דחופות נדחו</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-600">
              <Coffee className="w-3.5 h-3.5" />
              <span className="text-xs">זמן להפסקות הוגדל</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-600">
              <Heart className="w-3.5 h-3.5" />
              <span className="text-xs">רק המשימות החשובות נשארו</span>
            </div>
          </div>

          <div className="flex justify-center">
            <Button
              onClick={() => onToggle(false)}
              variant="outline"
              size="sm"
              className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 text-xs"
            >
              בטלי מצב הקלה
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
