/**
 * ── AyoaFeedView: Clean organized data list (Directive #5, Lens 4 fallback) ──
 *
 * DIRECTIVE #5: The Feed view must render actual, original data so the user
 * never loses access to raw numbers.
 *
 * DIRECTIVE #10: No pale gray. Bold titles. High contrast.
 *
 * This component is the FALLBACK when children are not provided to UnifiedAyoaLayout.
 * When children ARE provided, the wrapper renders children directly instead of this.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { TASK_STATUS_CONFIG } from '@/config/processTemplates';
import { CheckCircle } from 'lucide-react';

export default function AyoaFeedView({ tasks = [], onEditTask }) {
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-500">
        <CheckCircle className="w-8 h-8 mb-2" />
        <p className="text-sm font-bold">אין נתונים להצגה</p>
      </div>
    );
  }

  return (
    <div className="space-y-1 p-2">
      {tasks.map((task, idx) => {
        const category = task.category || '';
        const status = task.status || 'not_started';

        return (
          <motion.div
            key={task.id || idx}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.02 }}
            onClick={() => onEditTask?.(task)}
            className="flex items-center gap-2 p-2.5 rounded-xl border border-gray-100 hover:shadow-md cursor-pointer bg-white transition-all"
            style={{ borderRight: '4px solid #4682B4' }}
          >
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-[#4682B4]/10">
              <div className="w-3 h-3 rounded-full bg-[#4682B4]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                {/* Directive #10: Semi-bold titles */}
                <span className="text-sm font-bold text-[#0F172A] truncate">{task.title}</span>
                {task.client_name && (
                  <span className="text-xs font-semibold text-[#334155] truncate">• {task.client_name}</span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {category && (
                  <Badge variant="outline" className="text-[12px] px-1.5 h-4 rounded-full font-bold border-[#4682B4] text-[#4682B4]">
                    {category}
                  </Badge>
                )}
                {task.due_date && (
                  <span className="text-[11px] font-semibold text-slate-700">{task.due_date}</span>
                )}
                <Badge variant="outline" className={`text-[12px] px-1.5 h-4 rounded-full font-bold ${TASK_STATUS_CONFIG[status]?.color || 'text-slate-700'}`}>
                  {TASK_STATUS_CONFIG[status]?.text || status}
                </Badge>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
