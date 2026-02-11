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
      <Card className="border-orange-200 bg-orange-50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Heart className="w-5 h-5 text-orange-600" />
              <span className="text-orange-800 font-medium">יום קשה? הפעל מצב הקלה</span>
            </div>
            <Button 
              onClick={handleActivate}
              disabled={isActivating}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {isActivating ? 'מפעיל...' : 'הפעל מצב הקלה'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-4"
    >
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-800">
            <Shield className="w-5 h-5" />
            מצב הקלה פעיל
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-2 text-green-700">
              <Calendar className="w-4 h-4" />
              <span className="text-sm">משימות לא דחופות נדחו</span>
            </div>
            <div className="flex items-center gap-2 text-green-700">
              <Coffee className="w-4 h-4" />
              <span className="text-sm">זמן להפסקות הוגדל</span>
            </div>
            <div className="flex items-center gap-2 text-green-700">
              <Heart className="w-4 h-4" />
              <span className="text-sm">רק המשימות החשובות נשארו</span>
            </div>
          </div>
          
          <div className="flex justify-center">
            <Button 
              onClick={() => onToggle(false)} 
              variant="outline"
              className="text-green-700 border-green-300 hover:bg-green-100"
            >
              בטל מצב הקלה
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}