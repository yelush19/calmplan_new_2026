/**
 * ── AyoaFeedView: Clean organized list with DNA color indicators ──
 */

import React from 'react';
import { motion } from 'framer-motion';
import { getServiceWeight } from '@/config/serviceWeights';
import { LOAD_COLORS } from '@/engines/capacityEngine';
import { Badge } from '@/components/ui/badge';
import { CheckCircle } from 'lucide-react';

export default function AyoaFeedView({ tasks = [], onEditTask }) {
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <CheckCircle className="w-8 h-8 mb-2" />
        <p className="text-sm">אין משימות להצגה</p>
      </div>
    );
  }

  return (
    <div className="space-y-1 p-2">
      {tasks.map((task, idx) => {
        const sw = getServiceWeight(task.category);
        const load = typeof task.cognitive_load === 'number' ? task.cognitive_load : sw.cognitiveLoad;
        const lc = LOAD_COLORS[Math.min(3, Math.max(0, load))] || LOAD_COLORS[0];
        return (
          <motion.div
            key={task.id || idx}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.02 }}
            onClick={() => onEditTask?.(task)}
            className="flex items-center gap-2 p-2.5 rounded-xl border border-gray-100 hover:shadow-md cursor-pointer bg-white transition-all"
            style={{ borderRight: `4px solid ${lc.color}` }}
          >
            {/* DNA color indicator */}
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: lc.color + '15' }}>
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: lc.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold truncate">{task.title}</span>
                {task.client_name && (
                  <span className="text-[10px] text-gray-400 truncate">• {task.client_name}</span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="outline" className="text-[9px] px-1.5 h-4 rounded-full" style={{ borderColor: lc.color, color: lc.color }}>
                  {lc.label}
                </Badge>
                <span className="text-[10px] text-gray-400">{sw.duration} דק׳</span>
                {task.due_date && (
                  <span className="text-[10px] text-gray-400">{task.due_date}</span>
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
