/**
 * ── TemplatePanel: Service Template Inspector & Board Mapper ──
 * Side panel that shows service steps, allows template editing,
 * and board mapping (linking services to boards).
 *
 * Preserves ALL existing data — no deletion, only wrapping.
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  X, Plus, Copy, Link2, Layers, ChevronRight,
  GripVertical, CheckCircle, ArrowRight, FileText,
} from 'lucide-react';
import { ALL_SERVICES } from '@/config/processTemplates';

// DNA colors
const DNA_COLORS = {
  P1: '#00A3E0',
  P2: '#B2AC88',
  P3: '#E91E63',
  P4: '#FFC107',
};

// Board mapping targets
const BOARDS = [
  { key: 'payroll', label: 'לוח שכר', color: DNA_COLORS.P1 },
  { key: 'tax', label: 'לוח מיסים', color: DNA_COLORS.P2 },
  { key: 'admin', label: 'לוח ניהול', color: DNA_COLORS.P3 },
  { key: 'additional', label: 'שירותים נוספים', color: '#9C27B0' },
];

export default function TemplatePanel({ service, onClose }) {
  const [boardMappings, setBoardMappings] = useState(() => {
    if (!service) return [];
    // Read existing dashboard mapping from the service
    return service.dashboard ? [service.dashboard] : [];
  });
  const [showCloneHint, setShowCloneHint] = useState(false);

  if (!service) return null;

  const steps = service.steps || [];
  const highSteps = service.highComplexitySteps || [];
  const pColor = service.dashboard === 'payroll' ? DNA_COLORS.P1
    : service.dashboard === 'tax' ? DNA_COLORS.P2
    : service.dashboard === 'admin' ? DNA_COLORS.P3
    : DNA_COLORS.P4;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: 320, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 320, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 250 }}
        className="fixed top-0 left-0 bottom-0 w-[340px] bg-white shadow-2xl z-50 overflow-y-auto"
        style={{ borderRight: `4px solid ${pColor}` }}
        dir="rtl"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: pColor + '15' }}>
                <Layers className="w-4 h-4" style={{ color: pColor }} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-800">{service.label}</h3>
                <span className="text-[10px] text-gray-400">{service.key} • {service.dashboard}</span>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Process Steps */}
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-3.5 h-3.5" style={{ color: pColor }} />
            <span className="text-xs font-bold text-gray-700">שלבי תהליך</span>
            <Badge variant="outline" className="text-[9px] h-4 px-1.5" style={{ borderColor: pColor, color: pColor }}>
              {steps.length} שלבים
            </Badge>
          </div>

          <div className="space-y-1.5">
            {steps.map((step, i) => (
              <div key={step.key}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition-colors group"
              >
                <div className="flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-bold text-white shrink-0"
                  style={{ backgroundColor: pColor }}>
                  {i + 1}
                </div>
                <span className="text-xs font-medium text-gray-700 flex-1">{step.label}</span>
                <span className="text-[9px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  {step.key}
                </span>
              </div>
            ))}
          </div>

          {/* High Complexity Steps */}
          {highSteps.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold text-gray-500">שלבים למורכבות גבוהה</span>
                <Badge className="text-[8px] h-3.5 px-1 bg-amber-100 text-amber-700 border-amber-200">
                  {highSteps.length}
                </Badge>
              </div>
              <div className="space-y-1">
                {highSteps.map((step, i) => (
                  <div key={step.key}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-amber-100 bg-amber-50/30"
                  >
                    <div className="w-4 h-4 rounded-full text-[8px] font-bold flex items-center justify-center bg-amber-200 text-amber-700">
                      {i + 1}
                    </div>
                    <span className="text-[10px] text-gray-600">{step.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Task Categories */}
        <div className="px-4 py-3 border-t">
          <div className="text-xs font-bold text-gray-700 mb-2">קטגוריות משימה</div>
          <div className="flex flex-wrap gap-1">
            {(service.taskCategories || []).map(cat => (
              <Badge key={cat} variant="outline" className="text-[9px] px-2 py-0.5 rounded-full"
                style={{ borderColor: pColor + '40', color: pColor }}>
                {cat}
              </Badge>
            ))}
          </div>
        </div>

        {/* Board Mapping */}
        <div className="px-4 py-3 border-t">
          <div className="flex items-center gap-2 mb-3">
            <Link2 className="w-3.5 h-3.5" style={{ color: pColor }} />
            <span className="text-xs font-bold text-gray-700">שיוך ללוח</span>
          </div>
          <div className="space-y-1.5">
            {BOARDS.map(board => {
              const isMapped = boardMappings.includes(board.key);
              return (
                <button
                  key={board.key}
                  onClick={() => {
                    setBoardMappings(prev =>
                      prev.includes(board.key)
                        ? prev.filter(k => k !== board.key)
                        : [...prev, board.key]
                    );
                  }}
                  className={`flex items-center gap-2 w-full px-3 py-2 rounded-xl border transition-all text-right ${
                    isMapped
                      ? 'border-transparent shadow-sm'
                      : 'border-gray-100 hover:border-gray-200'
                  }`}
                  style={isMapped ? {
                    backgroundColor: board.color + '10',
                    borderColor: board.color + '30',
                  } : {}}
                >
                  <div className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: isMapped ? board.color : '#E0E0E0' }} />
                  <span className={`text-xs font-medium ${isMapped ? 'text-gray-800' : 'text-gray-500'}`}>
                    {board.label}
                  </span>
                  {isMapped && (
                    <CheckCircle className="w-3 h-3 mr-auto" style={{ color: board.color }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Clone Template Action */}
        <div className="px-4 py-3 border-t">
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs gap-2 rounded-xl"
            style={{ borderColor: pColor + '30', color: pColor }}
            onClick={() => setShowCloneHint(true)}
          >
            <Copy className="w-3.5 h-3.5" />
            שכפל תבנית ללוח אחר
          </Button>
          {showCloneHint && (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[10px] text-gray-400 mt-2 text-center"
            >
              בקרוב — גרור תבנית ללוח ספציפי
            </motion.p>
          )}
        </div>

        {/* Service Metadata */}
        <div className="px-4 py-3 border-t bg-gray-50/50">
          <div className="text-[9px] text-gray-400 space-y-0.5">
            <div>מפתח: <span className="font-mono">{service.key}</span></div>
            <div>לוח: <span className="font-mono">{service.dashboard}</span></div>
            {service.taskType && <div>סוג: <span className="font-mono">{service.taskType}</span></div>}
            {service.sequentialSteps && <div className="text-amber-600">סדרתי — כל שלב דורש השלמת הקודם</div>}
            {service.supportsComplexity && <div className="text-purple-600">תומך במורכבות — שלבים משתנים לפי טייר</div>}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
