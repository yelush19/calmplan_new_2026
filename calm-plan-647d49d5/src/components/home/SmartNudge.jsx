import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';

const nudgeColors = {
  orange: 'from-orange-100 to-amber-100 border-orange-300 text-orange-800',
  purple: 'from-purple-100 to-indigo-100 border-purple-300 text-purple-800',
  blue: 'from-blue-100 to-cyan-100 border-blue-300 text-blue-800',
  green: 'from-green-100 to-emerald-100 border-green-300 text-green-800',
};

export default function SmartNudge({ nudge }) {
  if (!nudge) return null;

  const { icon: Icon, title, message, color } = nudge;
  const colorClasses = nudgeColors[color] || nudgeColors.blue;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ duration: 0.5, type: 'spring' }}
    >
      <Card className={`bg-gradient-to-tr ${colorClasses}`}>
        <CardContent className="p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-white/50 flex-shrink-0 flex items-center justify-center">
            <Icon className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-bold">{title}</h4>
            <p className="text-sm opacity-90">{message}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}