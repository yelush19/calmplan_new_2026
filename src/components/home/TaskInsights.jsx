import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileBarChart, Clock, Calculator, GitBranch, Zap,
  AlertTriangle, TrendingUp, Sparkles,
} from 'lucide-react';

const ICON_MAP = { FileBarChart, Clock, Calculator, GitBranch, Zap, AlertTriangle, TrendingUp, Sparkles };

const COLOR_MAP = {
  teal:    { bg: 'bg-teal-50',    border: 'border-teal-200',   icon: 'text-teal-600',    text: 'text-teal-800' },
  amber:   { bg: 'bg-amber-50',   border: 'border-amber-200',  icon: 'text-amber-600',   text: 'text-amber-800' },
  blue:    { bg: 'bg-blue-50',    border: 'border-blue-200',   icon: 'text-blue-600',    text: 'text-blue-800' },
  sky:     { bg: 'bg-sky-50',     border: 'border-sky-200',    icon: 'text-sky-600',     text: 'text-sky-800' },
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200',icon: 'text-emerald-600', text: 'text-emerald-800' },
};

const MAX_INSIGHTS = 4;

export default function TaskInsights({ insights }) {
  if (!insights || insights.length === 0) return null;

  // Take top 4 insights (already sorted by priority from cascade engine)
  const visible = insights.slice(0, MAX_INSIGHTS);

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-slate-500 px-1">תובנות מהמערכת</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <AnimatePresence mode="popLayout">
          {visible.map((insight, idx) => {
            const Icon = ICON_MAP[insight.icon] || Sparkles;
            const colors = COLOR_MAP[insight.color] || COLOR_MAP.blue;

            return (
              <motion.div
                key={insight.category}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3, delay: idx * 0.05 }}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${colors.bg} ${colors.border}`}
              >
                <div className={`w-8 h-8 rounded-lg bg-white flex-shrink-0 flex items-center justify-center ${colors.icon}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold leading-tight ${colors.text}`}>
                    {insight.title}
                  </p>
                  {insight.description && (
                    <p className={`text-xs mt-0.5 opacity-75 truncate ${colors.text}`}>
                      {insight.description}
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
