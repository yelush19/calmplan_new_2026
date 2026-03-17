import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Project } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight, CheckCircle2, Circle, Lightbulb, PenTool, Layout,
  Hammer, Link2, TestTube2, Rocket, Wrench, ChevronDown,
  Sparkles, Eye, ArrowLeft, BookOpen, MapPin, Star, AlertCircle,
  PartyPopper, Lock, Plus, Palette, Code2, Brain, Bug, FileSearch,
  AlertTriangle, CheckCheck, Trash2, Merge, Ghost
} from 'lucide-react';

const ACCENT = '#7C3AED';

const PHASES_STATUS_MAP = {
  planning:       { emoji: '📋', label: 'תכנון',    color: '#94A3B8' },
  in_development: { emoji: '🔨', label: 'בפיתוח',   color: '#3B82F6' },
  testing:        { emoji: '🧪', label: 'בדיקות',   color: '#F59E0B' },
  deployed:       { emoji: '🚀', label: 'באוויר',   color: '#10B981' },
  maintenance:    { emoji: '🔧', label: 'תחזוקה',   color: '#8B5CF6' },
  archived:       { emoji: '📦', label: 'ארכיון',   color: '#9CA3AF' },
};

/* ────────────────────────────────────────────────────────────────
 *  ADHD-Friendly Development Phases
 *  Each phase is a "chapter" in the project booklet.
 *  Written in simple Hebrew for a non-engineer.
 * ──────────────────────────────────────────────────────────────── */
const PHASES = [
  {
    id: 'idea',
    icon: Lightbulb,
    emoji: '💡',
    title: 'רעיון וחזון',
    color: '#F59E0B',
    tagline: 'מה אני בונה ולמה?',
    description: 'כאן את מגדירה את הרעיון — מה המערכת עושה, למי היא מיועדת, ואיזו בעיה היא פותרת. אין צורך להיכנס לפרטים טכניים.',
    whatINeed: ['רעיון ברור — משפט אחד שמסביר מה המערכת עושה', 'למי זה מיועד — מי ישתמש בזה?', 'למה זה חשוב — איזו בעיה זה פותר?'],
    checklist: [
      { key: 'idea_sentence', label: 'כתבתי משפט אחד שמתאר את המערכת' },
      { key: 'idea_audience', label: 'הגדרתי למי זה מיועד' },
      { key: 'idea_problem', label: 'הגדרתי איזו בעיה זה פותר' },
      { key: 'idea_name', label: 'בחרתי שם לפרויקט' },
    ],
    doneWhen: 'את יכולה להסביר לחברה בשתי שורות מה המערכת ולמה את בונה אותה.',
    nextHint: 'עכשיו נתכנן מה יהיה בפנים — אילו עמודים, אילו פיצ\'רים.',
  },
  {
    id: 'planning',
    icon: Layout,
    emoji: '📐',
    title: 'תכנון מבנה',
    color: '#3B82F6',
    tagline: 'מה יהיה בפנים?',
    description: 'כאן את מחליטה אילו עמודים/מסכים יהיו, אילו כפתורים, ואיזה מידע המערכת צריכה לשמור. כמו לתכנן דירה — חדרים, דלתות, חלונות.',
    whatINeed: ['רשימת עמודים ראשיים (דף בית, הגדרות, רשימה...)', 'מה כל עמוד עושה בקצרה', 'איזה מידע צריך לשמור (טבלאות/שדות)'],
    checklist: [
      { key: 'plan_pages', label: 'רשמתי רשימת עמודים ראשיים' },
      { key: 'plan_features', label: 'תיארתי מה כל עמוד עושה' },
      { key: 'plan_data', label: 'הגדרתי איזה מידע לשמור' },
      { key: 'plan_flow', label: 'ציירתי זרימה בסיסית (אפילו על דף)' },
    ],
    doneWhen: 'יש לך רשימה ברורה של עמודים + מה כל אחד עושה + איזה מידע שומרים.',
    nextHint: 'הגיע הזמן להחליט איך זה ייראה — צבעים, סגנון, תחושה.',
  },
  {
    id: 'design',
    icon: PenTool,
    emoji: '🎨',
    title: 'עיצוב ומראה',
    color: '#EC4899',
    tagline: 'איך זה ייראה?',
    description: 'כאן את בוחרת צבעים, פונטים, וסגנון כללי. לא חייבים להיות מעצבת — אפשר להשתמש בתבניות מוכנות.',
    whatINeed: ['צבע ראשי (כמו הסגול הזה 💜)', 'החלטה על סגנון: מודרני? חמים? מינימלי?', 'דוגמאות ממערכות שאת אוהבת'],
    checklist: [
      { key: 'design_colors', label: 'בחרתי צבעים ראשיים' },
      { key: 'design_style', label: 'הגדרתי סגנון כללי (מודרני/חמים/מינימלי)' },
      { key: 'design_reference', label: 'שמרתי דוגמאות השראה' },
      { key: 'design_logo', label: 'יש לוגו או שם ויזואלי' },
    ],
    doneWhen: 'יש לך פלטת צבעים + סגנון ברור + את יודעת "איך זה מרגיש".',
    nextHint: 'מצוין! עכשיו מתחילים לבנות את הבסיס — הקמת הפרויקט.',
  },
  {
    id: 'foundation',
    icon: Hammer,
    emoji: '🧱',
    title: 'בניית הבסיס',
    color: '#8B5CF6',
    tagline: 'מקימים את הפרויקט',
    description: 'כאן מקימים את הפרויקט עצמו — יוצרים את האפליקציה, מגדירים את העמודים הראשונים, ובונים את השלד. זה כמו ליצוק יסודות.',
    whatINeed: ['פלטפורמה (React/Next/אחר)', 'סביבת עבודה מוכנה', 'העמוד הראשון עובד'],
    checklist: [
      { key: 'found_setup', label: 'הקמתי את הפרויקט (npm create / template)' },
      { key: 'found_first_page', label: 'העמוד הראשון נטען ועובד' },
      { key: 'found_navigation', label: 'יש ניווט בסיסי בין עמודים' },
      { key: 'found_git', label: 'הפרויקט ב-Git ויש גיבוי' },
    ],
    doneWhen: 'את רואה את האפליקציה רצה בדפדפן עם ניווט בסיסי.',
    nextHint: 'הבסיס עובד! עכשיו מחברים את הנתונים — בסיס נתונים ולוגיקה.',
  },
  {
    id: 'connections',
    icon: Link2,
    emoji: '🔗',
    title: 'חיבורים ונתונים',
    color: '#0891B2',
    tagline: 'מחברים את הנתונים',
    description: 'כאן מחברים את בסיס הנתונים, מגדירים טבלאות, ומוודאים שהמידע נשמר ונטען כמו שצריך. זה כמו לחבר חשמל ומים לבניין.',
    whatINeed: ['בסיס נתונים (Supabase/Firebase)', 'טבלאות מוגדרות לפי התכנון', 'הנתונים נשמרים ונטענים'],
    checklist: [
      { key: 'conn_db', label: 'בסיס נתונים מוגדר ומחובר' },
      { key: 'conn_tables', label: 'טבלאות עיקריות נוצרו' },
      { key: 'conn_crud', label: 'אפשר ליצור, לקרוא, לעדכן ולמחוק נתונים' },
      { key: 'conn_auth', label: 'יש הרשמה/התחברות (אם צריך)' },
    ],
    doneWhen: 'את יכולה להוסיף מידע, לראות אותו, לערוך אותו — הכל נשמר.',
    nextHint: 'המערכת עובדת! עכשיו בודקים שהכל תקין לפני שמעלים.',
  },
  {
    id: 'testing',
    icon: TestTube2,
    emoji: '🧪',
    title: 'בדיקות ותיקונים',
    color: '#F59E0B',
    tagline: 'בודקים שהכל עובד',
    description: 'כאן את עוברת על כל חלק במערכת ובודקת שהוא עובד. מנסה לשבור דברים. מתקנת באגים. זה כמו לבדוק חשבוניות לפני שליחה — שום דבר לא יוצא עם טעות.',
    whatINeed: ['רשימת תרחישים לבדוק', 'מישהו נוסף שיבדוק (fresh eyes)', 'סבלנות 💪'],
    checklist: [
      { key: 'test_flows', label: 'בדקתי את כל הזרימות הראשיות' },
      { key: 'test_mobile', label: 'בדקתי במובייל' },
      { key: 'test_edge', label: 'בדקתי מקרי קצה (שדות ריקים, מספרים שליליים...)' },
      { key: 'test_bugs', label: 'תיקנתי את כל הבאגים שמצאתי' },
    ],
    doneWhen: 'את יכולה לעבור על כל המערכת בלי להיתקל בשגיאות.',
    nextHint: 'הכל עובד! זמן להעלות לאוויר ולתת לאנשים להשתמש.',
  },
  {
    id: 'launch',
    icon: Rocket,
    emoji: '🚀',
    title: 'השקה',
    color: '#10B981',
    tagline: 'מעלים לאוויר!',
    description: 'הרגע הגדול! כאן את מעלה את המערכת לאוויר כדי שאנשים אמיתיים ישתמשו. זה כמו לפתוח עסק חדש — ההזמנות מוכנות, הדלתות נפתחות.',
    whatINeed: ['דומיין (כתובת אינטרנט)', 'שרת hosting', 'גיבוי אחרון לפני העלייה'],
    checklist: [
      { key: 'launch_domain', label: 'יש דומיין מוכן' },
      { key: 'launch_deploy', label: 'המערכת באוויר ונגישה' },
      { key: 'launch_ssl', label: 'יש HTTPS (מנעול ירוק)' },
      { key: 'launch_test_live', label: 'בדקתי שהכל עובד גם בגרסה החיה' },
    ],
    doneWhen: 'אפשר להיכנס לכתובת ולהשתמש במערכת. 🎉',
    nextHint: 'מזל טוב! עכשיו שומרים שהמערכת תמשיך לעבוד.',
  },
  {
    id: 'maintenance',
    icon: Wrench,
    emoji: '🔧',
    title: 'תחזוקה שוטפת',
    color: '#6366F1',
    tagline: 'שומרים שהכל ימשיך לעבוד',
    description: 'כמו רכב — גם מערכת צריכה טיפול שוטף. עדכונים, תיקונים, גיבויים. פעם בשבוע/חודש — לבדוק שהכל בסדר.',
    whatINeed: ['ניטור שגיאות', 'גיבויים אוטומטיים', 'רשימת שיפורים עתידיים'],
    checklist: [
      { key: 'maint_monitoring', label: 'יש ניטור שגיאות' },
      { key: 'maint_backup', label: 'גיבויים רצים אוטומטית' },
      { key: 'maint_updates', label: 'עדכנתי ספריות ותלויות' },
      { key: 'maint_wishlist', label: 'רשמתי רשימת שיפורים עתידיים' },
    ],
    doneWhen: 'המערכת רצה חלק, יש גיבויים, ויש לך רשימת שיפורים לעתיד.',
    nextHint: 'את מנהלת מערכת חיה! כל שיפור הוא סיבוב נוסף של הלולאה הזו.',
  },
];

/* ── Determine current phase based on project status ── */
function getPhaseFromStatus(status) {
  switch (status) {
    case 'planning': return 'idea';
    case 'in_development': return 'foundation';
    case 'testing': return 'testing';
    case 'deployed': return 'maintenance';
    case 'maintenance': return 'maintenance';
    default: return 'idea';
  }
}

/* ────────────────────────────────────────────────────────────────
 *  Phase Card Component
 * ──────────────────────────────────────────────────────────────── */
function PhaseCard({ phase, phaseIndex, isCurrentPhase, isCompleted, isLocked, isExpanded, onToggle, checkedItems, onToggleItem }) {
  const Icon = phase.icon;
  const totalItems = phase.checklist.length;
  const doneItems = phase.checklist.filter(c => checkedItems[c.key]).length;
  const progress = totalItems > 0 ? (doneItems / totalItems) * 100 : 0;
  const isAllDone = doneItems === totalItems;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: phaseIndex * 0.06, type: 'spring', stiffness: 200, damping: 20 }}
    >
      <div
        className="rounded-[28px] overflow-hidden transition-all duration-300"
        style={{
          border: isCurrentPhase
            ? `2px solid ${phase.color}`
            : isCompleted
            ? '2px solid #10B98140'
            : '1px solid #E2E8F0',
          boxShadow: isCurrentPhase
            ? `0 8px 32px ${phase.color}20, 0 0 0 4px ${phase.color}08`
            : isCompleted
            ? '0 2px 8px #10B98110'
            : '0 2px 8px rgba(0,0,0,0.03)',
          opacity: isLocked ? 0.55 : 1,
        }}
      >
        {/* ── Phase Header ── */}
        <button
          onClick={onToggle}
          className="w-full flex items-center gap-3 p-4 text-right transition-colors"
          style={{
            background: isCurrentPhase
              ? `linear-gradient(135deg, ${phase.color}12, ${phase.color}06)`
              : isCompleted
              ? 'linear-gradient(135deg, #10B98108, #10B98104)'
              : '#FAFBFC',
          }}
        >
          {/* Phase number bubble */}
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-lg"
            style={{
              background: isCompleted
                ? 'linear-gradient(135deg, #10B981, #059669)'
                : isCurrentPhase
                ? `linear-gradient(135deg, ${phase.color}, ${phase.color}CC)`
                : '#E2E8F0',
            }}
          >
            {isCompleted ? (
              <CheckCircle2 className="w-5 h-5 text-white" />
            ) : isLocked ? (
              <Lock className="w-4 h-4 text-gray-500" />
            ) : (
              <span className="text-white font-bold text-sm">{phaseIndex + 1}</span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-lg">{phase.emoji}</span>
              <span className="font-bold text-gray-900 text-[15px]">{phase.title}</span>
              {isCurrentPhase && (
                <Badge
                  className="text-[10px] px-2 py-0.5 rounded-full font-bold animate-pulse"
                  style={{ background: `${phase.color}20`, color: phase.color }}
                >
                  את כאן ←
                </Badge>
              )}
              {isAllDone && !isCompleted && (
                <Badge className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold">
                  מוכן!
                </Badge>
              )}
            </div>
            <p className="text-[12px] text-gray-500 mt-0.5">{phase.tagline}</p>
          </div>

          {/* Progress ring */}
          <div className="relative w-10 h-10 shrink-0">
            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
              <circle cx="18" cy="18" r="15" fill="none" stroke="#E2E8F0" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="15" fill="none"
                stroke={isCompleted ? '#10B981' : phase.color}
                strokeWidth="3"
                strokeDasharray={`${progress * 0.942} 100`}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold" style={{ color: isCompleted ? '#10B981' : phase.color }}>
              {doneItems}/{totalItems}
            </span>
          </div>

          <ChevronDown
            className="w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200"
            style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
          />
        </button>

        {/* ── Phase Content (Expanded) ── */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-5 space-y-4">
                {/* Description */}
                <div className="rounded-2xl p-4 bg-white border border-gray-100">
                  <p className="text-[13px] text-gray-700 leading-relaxed">{phase.description}</p>
                </div>

                {/* What I need */}
                <div>
                  <h4 className="text-[12px] font-bold text-gray-500 mb-2 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" style={{ color: phase.color }} />
                    מה צריך לפני שמתחילים?
                  </h4>
                  <div className="space-y-1.5">
                    {phase.whatINeed.map((item, i) => (
                      <div key={i} className="flex items-start gap-2 text-[12px] text-gray-600">
                        <Star className="w-3 h-3 mt-0.5 shrink-0" style={{ color: phase.color }} />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Checklist */}
                <div>
                  <h4 className="text-[12px] font-bold text-gray-500 mb-2 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" style={{ color: phase.color }} />
                    צ'קליסט
                  </h4>
                  <div className="space-y-2">
                    {phase.checklist.map((item) => {
                      const checked = checkedItems[item.key] || false;
                      return (
                        <motion.button
                          key={item.key}
                          onClick={() => onToggleItem(item.key)}
                          whileTap={{ scale: 0.98 }}
                          className={`w-full flex items-center gap-3 p-3 rounded-2xl text-right transition-all duration-200 ${
                            checked
                              ? 'bg-emerald-50 border border-emerald-200'
                              : 'bg-gray-50 border border-gray-100 hover:bg-gray-100'
                          }`}
                        >
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all ${
                            checked ? 'bg-emerald-500' : 'border-2 border-gray-300'
                          }`}>
                            {checked && <CheckCircle2 className="w-4 h-4 text-white" />}
                          </div>
                          <span className={`text-[13px] flex-1 ${
                            checked ? 'text-emerald-700 line-through' : 'text-gray-700'
                          }`}>
                            {item.label}
                          </span>
                          {checked && <Sparkles className="w-3.5 h-3.5 text-emerald-500" />}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* Done criteria */}
                <div
                  className="rounded-2xl p-3 border"
                  style={{
                    background: `${phase.color}06`,
                    borderColor: `${phase.color}20`,
                  }}
                >
                  <h4 className="text-[12px] font-bold mb-1 flex items-center gap-1.5" style={{ color: phase.color }}>
                    <Eye className="w-3.5 h-3.5" />
                    סיימתי כשאני יכולה לומר:
                  </h4>
                  <p className="text-[12px] text-gray-600">{phase.doneWhen}</p>
                </div>

                {/* Next step hint */}
                <div className="rounded-2xl p-3 bg-purple-50/50 border border-purple-100">
                  <h4 className="text-[12px] font-bold text-purple-600 mb-1 flex items-center gap-1.5">
                    <ArrowLeft className="w-3.5 h-3.5" />
                    השלב הבא
                  </h4>
                  <p className="text-[12px] text-purple-600/80">{phase.nextHint}</p>
                </div>

                {/* Celebration on all done */}
                {isAllDone && (
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="rounded-2xl p-4 bg-gradient-to-l from-emerald-50 to-green-50 border border-emerald-200 text-center"
                  >
                    <PartyPopper className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
                    <p className="text-sm font-bold text-emerald-700">כל הסעיפים הושלמו! 🎉</p>
                    <p className="text-[12px] text-emerald-600 mt-1">אפשר לעבור לשלב הבא</p>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* ────────────────────────────────────────────────────────────────
 *  Bird's Eye Progress Bar (top of page)
 * ──────────────────────────────────────────────────────────────── */
function BirdEyeProgress({ phases, checkedItems, currentPhaseId }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {phases.map((phase, i) => {
        const total = phase.checklist.length;
        const done = phase.checklist.filter(c => checkedItems[c.key]).length;
        const isCurrent = phase.id === currentPhaseId;
        const isComplete = done === total;

        return (
          <React.Fragment key={phase.id}>
            {i > 0 && (
              <div
                className="w-6 h-0.5 shrink-0"
                style={{ background: isComplete ? '#10B981' : '#E2E8F0' }}
              />
            )}
            <div
              className="flex flex-col items-center gap-1 shrink-0 px-1"
              title={`${phase.title}: ${done}/${total}`}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all"
                style={{
                  background: isComplete
                    ? '#10B981'
                    : isCurrent
                    ? phase.color
                    : '#E2E8F0',
                  boxShadow: isCurrent ? `0 0 0 3px ${phase.color}30` : 'none',
                }}
              >
                {isComplete ? (
                  <CheckCircle2 className="w-4 h-4 text-white" />
                ) : (
                  <span className="text-xs">{phase.emoji}</span>
                )}
              </div>
              <span className={`text-[9px] font-semibold whitespace-nowrap ${
                isCurrent ? 'text-gray-900' : 'text-gray-400'
              }`}>
                {phase.title}
              </span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
 *  Professional Audit Tabs — Claude Updates per discipline
 *  Design, Programming, Logic, UX, Feynman Summary
 * ──────────────────────────────────────────────────────────────── */
const AUDIT_TABS = [
  {
    id: 'feynman',
    label: 'סיכום פיינמן',
    icon: Brain,
    color: '#7C3AED',
    content: {
      title: 'הסבר כאילו את בת 12',
      sections: [
        {
          heading: 'מה המערכת עושה?',
          items: [
            'CalmPlan היא מערכת שעוזרת לנהל משרד הנהלת חשבונות — כל הלקוחות, כל הדיווחים, כל התשלומים — ממקום אחד.',
            'היא גם עוזרת לנהל את החיים האישיים: ארוחות, שגרות, ובית.',
            'היא בנויה כך שאפילו ביום קשה (ADHD!) אפשר לדעת מה לעשות הבא — בלי לחץ.',
          ],
        },
        {
          heading: 'למה היא מסובכת?',
          items: [
            'כי יש 6 עולמות שונים (שכר, הנה"ח, ניהול, בית, דוחות שנתיים, פרויקטים) — וכולם מחוברים אחד לשני.',
            'כי משימה אחת (למשל "שכר לחברת אבג") עוברת 6 שלבים אצל אנשים שונים ברשויות שונות.',
          ],
        },
        {
          heading: 'הרעיון הכי חכם',
          items: [
            'עץ תהליכים (Process Tree V4.3) — במקום לכתוב משימות ידנית, המערכת יודעת מה השלב הבא לפי תבנית של כל שירות.',
          ],
        },
        {
          heading: 'הבעיה הכי גדולה',
          items: [
            'סטטוס "הועבר לעיון" משמש גם לתלושי שכר (שנשלחו ללקוח) וגם לדיווחי רשויות (ביטוח לאומי, מע"מ) — וזה לא אותו דבר בכלל.',
          ],
        },
        {
          heading: 'מבנה ASCII',
          isCode: true,
          items: [
            '┌─ CalmPlan ──────────────────────────┐',
            '│  P1 שכר ──→ ייצור → דיווח → תשלום  │',
            '│  P2 הנה"ח ─→ קליטה → מע"מ → רוה"ס  │',
            '│  P3 ניהול ──→ HUB (צופה על P1+P2)   │',
            '│  P4 בית ───→ ארוחות, שגרות          │',
            '│  P5 דוחות ──→ מאזנים, סגירת שנה     │',
            '│  P6 פרויקטים → את כאן! 💜            │',
            '└─────────────────────────────────────┘',
          ],
        },
      ],
    },
  },
  {
    id: 'design',
    label: 'עיצוב',
    icon: Palette,
    color: '#EC4899',
    content: {
      title: 'ממצאי עיצוב ו-ADHD',
      sections: [
        {
          heading: 'הפרות DNA עיצובי',
          severity: 'warning',
          items: [
            'Projects.jsx:93 — backdrop-blur-sm + bg-white/90 (הפרת חוק 2: NO TRANSPARENCY)',
            'Layout.jsx:354 — שימוש ב-text-gray-300/400/500 רב (הפרת חוק 3: טקסט שחור בלבד)',
            'PayrollReportsDashboard.jsx — 4 כרטיסי סטטיסטיקה + רשימה ארוכה בטעינה (הפרת חוק 8)',
            'GroupedServiceTable — כל הסטטוסים collapsed כברירת מחדל — זה טוב!',
          ],
        },
        {
          heading: 'ADHD — מה עובד',
          severity: 'success',
          items: [
            'חוק 6 (5 סטטוסים בלבד) — מיושם נכון ב-processTemplates.js',
            'חוק 8 (collapse כברירת מחדל) — PayrollReportsDashboard מקפלת שירותים',
            'UnifiedAyoaLayout — 11 מתוך 36 עמודים משתמשים בו',
            'ProjectWorkbook — חוברת עם שלבים ברורים, מצוין ל-ADHD',
          ],
        },
        {
          heading: 'מה לתקן קודם',
          severity: 'action',
          items: [
            'להסיר כל backdrop-blur/opacity מ-Projects.jsx ו-Home.jsx',
            'להחליף כל text-gray-XXX ל-text-black בעמודי ליבה',
            'להוסיף UnifiedAyoaLayout ל-25 עמודים שעדיין חסרים',
            'להוסיף Bad Day Mode לעמוד הבית',
          ],
        },
      ],
    },
  },
  {
    id: 'programming',
    label: 'תכנות',
    icon: Code2,
    color: '#3B82F6',
    content: {
      title: 'ממצאי קוד ומבנה',
      sections: [
        {
          heading: 'עמודים יתומים (אין ניווט מהסיידבר)',
          severity: 'warning',
          items: [
            'AdminTasksDashboard — יש route אבל אין בסיידבר',
            'CalendarView — כפילות עם Calendar, אין ניווט',
            'Collections — מחובר לנתונים, אין ניווט',
            'Roadmap, Recommendations, WeeklySummary — עמודי מידע ללא ניווט',
            'ClientOnboarding, ClientFiles, ClientContracts — sub-pages של ClientManagement',
            'TestDataManager, EmergencyRecovery, EmergencyReset — כלי dev',
            'TaskMatrix, HomeTaskGenerator — כלי עזר נסתרים',
          ],
        },
        {
          heading: 'Stubs / Dead Code',
          severity: 'error',
          items: [
            'TreatmentInput.jsx — stub ריק, "עמוד בפיתוח"',
            'WeeklyPlanner.jsx — stub ריק, Construction placeholder',
            'AutomationPage.jsx — ללא API data, config-only',
            'P5 דוחות אישיים → מפנה ל-BalanceSheets (אותו URL בדיוק!)',
          ],
        },
        {
          heading: 'כפילויות חשודות',
          severity: 'warning',
          items: [
            'Calendar + CalendarView — שני עמודי לוח שנה, Calendar הוא הראשי',
            'SystemOverview + SystemReadiness — שניהם מראים מצב מערכת',
            'Tasks + AdminTasksDashboard + WeeklyPlanningDashboard — חפיפה בניהול משימות',
            'ClientsDashboard (P2) + ClientManagement (P3) — אותם לקוחות, תצוגה שונה',
          ],
        },
        {
          heading: 'מה לעשות',
          severity: 'action',
          items: [
            'למחוק: TreatmentInput, WeeklyPlanner, CalendarView, AutomationPage',
            'לאחד: SystemOverview + SystemReadiness → SystemDashboard אחד',
            'לאחד: P5 "דוחות אישיים" → טאב בתוך BalanceSheets (לא route נפרד)',
            'להוסיף לסיידבר: AdminTasksDashboard (או לאחד עם Tasks)',
          ],
        },
      ],
    },
  },
  {
    id: 'logic',
    label: 'לוגיקה',
    icon: Bug,
    color: '#F59E0B',
    content: {
      title: 'באגים לוגיים וזרימת נתונים',
      sections: [
        {
          heading: 'באג קריטי: סטטוס "הועבר לעיון" בדיווחי רשויות',
          severity: 'error',
          items: [
            'taskCascadeEngine.js:964 — כשביטוח לאומי דווח (submission=done) ותשלום עדיין לא, הסטטוס הופך ל-sent_for_review ("הועבר לעיון")',
            'הבעיה: "הועבר לעיון" מתאים לתלושי שכר (payroll) — שנשלחים ללקוח לבדיקה',
            'עבור רשויות (ביטוח לאומי, מע"מ, ניכויים, מקדמות) — זה דווח. אין "עיון". הדיווח נשלח לרשות ומחכים לתשלום',
            'פתרון מוצע: להוסיף סטטוס "דווח — ממתין לתשלום" (reported_awaiting_payment) כסטטוס 6, או להשתמש בשם שונה לפי סוג המשימה (taskType)',
          ],
        },
        {
          heading: 'בעיות נוספות',
          severity: 'warning',
          items: [
            'processTemplates.js:937 — 5 סטטוסים "זהובים" אבל הלוגיקה מצריכה 6 (חסר: "דווח")',
            'PayrollReportsDashboard:82 — DATA SURVIVAL fallback שמציג הכל אם אין תוצאות — יכול לבלבל',
            'evaluateAuthorityStatus עושה submission→sent_for_review גם למע"מ, גם לב"ל, גם לניכויים — בלי הבחנה',
          ],
        },
        {
          heading: 'הצעת תיקון',
          severity: 'action',
          items: [
            'אופציה א\': להוסיף סטטוס 6: reported_awaiting_payment → "דווח — ממתין לתשלום" (ענבר/כתום)',
            'אופציה ב\': לשנות את הטקסט של sent_for_review בהתאם ל-taskType — "הועבר לעיון" לשכר, "דווח — ממתין לתשלום" לרשויות',
            'אופציה ב\' פחות invasive כי לא צריכה סטטוס חדש ב-DB',
          ],
        },
      ],
    },
  },
  {
    id: 'ux',
    label: 'UX',
    icon: FileSearch,
    color: '#6366F1',
    content: {
      title: 'ממצאי חוויית משתמש',
      sections: [
        {
          heading: 'מפת 55 עמודים — מה בסיידבר ומה לא',
          items: [
            'בסיידבר: 25 עמודים (P1: 4, P2: 4, P3: 13, P4: 3, P5: 2, P6: 2)',
            'יתומים (route קיים, אין ניווט): 22 עמודים',
            'stubs ריקים: 2 (TreatmentInput, WeeklyPlanner)',
            'לא ב-routes כלל: 1 (AutomationPage — יש קובץ, אין route)',
          ],
        },
        {
          heading: 'ניווט — Information Architecture',
          severity: 'warning',
          items: [
            'P3 ניהול — 13 פריטים ב-3 תת-קבוצות. כבד מדי ל-ADHD',
            'P5 — "מאזנים" ו"דוחות אישיים" שניהם מפנים לאותו URL',
            'אין מיקום ברור ל-ClientOnboarding, ClientFiles, ClientContracts — הם sub-tabs של ClientManagement',
            'Work Modes (ביצוע/תכנון/ניהול) מוגדרים ב-Layout אבל getVisibleSections מחזיר הכל תמיד (שורה 183)',
          ],
        },
        {
          heading: 'המלצות UX',
          severity: 'action',
          items: [
            'P3: לצמצם ל-8 פריטים — להעביר BatchSetup, BackupManager, AutomationRules לתוך Settings כטאבים',
            'P5: להפוך "דוחות אישיים" לטאב בתוך BalanceSheets — לא לינק נפרד',
            'להפעיל את Work Modes (כרגע מושבת) — מסתיר P1+P2 בתכנון/ניהול',
            'להוסיף Home → Focus Mode שמציג רק 3 משימות הבאות (חוק 8)',
          ],
        },
      ],
    },
  },
];

/* ── Severity badge colors ── */
const SEVERITY_STYLES = {
  warning: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: AlertTriangle },
  error: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', icon: Bug },
  success: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', icon: CheckCheck },
  action: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: Rocket },
};

function AuditTabs({ projectName }) {
  const [activeTab, setActiveTab] = useState('feynman');
  const [expandedSections, setExpandedSections] = useState(new Set(['0']));

  const activeData = AUDIT_TABS.find(t => t.id === activeTab);

  const toggleSection = (idx) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      const key = String(idx);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Tab header */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {AUDIT_TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setExpandedSections(new Set(['0'])); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-2xl text-[12px] font-bold whitespace-nowrap transition-all"
              style={{
                background: isActive ? `${tab.color}15` : '#F8FAFC',
                color: isActive ? tab.color : '#94A3B8',
                border: `1px solid ${isActive ? `${tab.color}40` : '#E2E8F0'}`,
                boxShadow: isActive ? `0 2px 8px ${tab.color}15` : 'none',
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        {activeData && (
          <motion.div
            key={activeData.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="space-y-3"
          >
            <h3 className="text-[14px] font-bold" style={{ color: activeData.color }}>
              {activeData.content.title}
            </h3>

            {activeData.content.sections.map((section, idx) => {
              const sev = section.severity ? SEVERITY_STYLES[section.severity] : null;
              const isOpen = expandedSections.has(String(idx));
              const SevIcon = sev?.icon;

              return (
                <div
                  key={idx}
                  className={`rounded-2xl overflow-hidden border transition-all ${
                    sev ? `${sev.bg} ${sev.border}` : 'bg-white border-gray-100'
                  }`}
                >
                  <button
                    onClick={() => toggleSection(idx)}
                    className="w-full flex items-center gap-2 p-3 text-right"
                  >
                    <ChevronDown
                      className="w-3.5 h-3.5 shrink-0 transition-transform duration-200"
                      style={{ transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)', color: sev?.text?.replace('text-', '#') || activeData.color }}
                    />
                    {SevIcon && <SevIcon className={`w-3.5 h-3.5 shrink-0 ${sev.text}`} />}
                    <span className={`text-[13px] font-bold flex-1 ${sev ? sev.text : 'text-gray-800'}`}>
                      {section.heading}
                    </span>
                    <Badge className="text-[10px] px-1.5 py-0 rounded-full bg-gray-100 text-gray-500">
                      {section.items.length}
                    </Badge>
                  </button>

                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden"
                      >
                        <div className={`px-4 pb-3 space-y-1.5 ${section.isCode ? 'font-mono' : ''}`}>
                          {section.items.map((item, i) => (
                            <div key={i} className={`flex items-start gap-2 text-[12px] ${
                              section.isCode ? 'text-gray-600 leading-snug' : 'text-gray-700 leading-relaxed'
                            }`}>
                              {!section.isCode && (
                                <span className="mt-1 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: activeData.color }} />
                              )}
                              <span dir={section.isCode ? 'ltr' : 'rtl'}>{item}</span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
 *  Main ProjectWorkbook Page
 * ──────────────────────────────────────────────────────────────── */
export default function ProjectWorkbook() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const projectId = searchParams.get('projectId');

  const [allProjects, setAllProjects] = useState([]);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkedItems, setCheckedItems] = useState({});
  const [expandedPhase, setExpandedPhase] = useState(null);

  /* ── Scroll to top on mount ── */
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [projectId]);

  /* ── Load all projects + selected project ── */
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const projects = await Project.list(null, 500);
        setAllProjects(projects || []);
        if (projectId) {
          const found = projects.find(p => p.id === projectId);
          if (found) {
            setProject(found);
            const saved = found.workbook_checklist;
            if (saved && typeof saved === 'object') {
              setCheckedItems(saved);
            }
            const currentPhase = getPhaseFromStatus(found.status);
            setExpandedPhase(currentPhase);
          }
        } else {
          setProject(null);
        }
      } catch (e) {
        console.error('Failed to load projects:', e);
      }
      setLoading(false);
    })();
  }, [projectId]);

  const selectProject = (proj) => {
    setSearchParams({ projectId: proj.id });
  };

  /* ── Save checklist ── */
  const saveChecklist = useCallback(async (newItems) => {
    if (!projectId) return;
    try {
      await Project.update(projectId, { workbook_checklist: newItems });
    } catch (e) {
      console.error('Failed to save checklist:', e);
    }
  }, [projectId]);

  const toggleItem = useCallback((key) => {
    setCheckedItems(prev => {
      const next = { ...prev, [key]: !prev[key] };
      saveChecklist(next);
      return next;
    });
  }, [saveChecklist]);

  const currentPhaseId = project ? getPhaseFromStatus(project.status) : 'idea';
  const currentPhaseIndex = PHASES.findIndex(p => p.id === currentPhaseId);

  /* ── Overall progress ── */
  const overallProgress = useMemo(() => {
    const totalItems = PHASES.reduce((sum, p) => sum + p.checklist.length, 0);
    const doneItems = PHASES.reduce((sum, p) => sum + p.checklist.filter(c => checkedItems[c.key]).length, 0);
    return totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;
  }, [checkedItems]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-t-transparent" style={{ borderColor: `${ACCENT}40`, borderTopColor: 'transparent' }} />
        <span className="text-sm font-medium text-gray-500">טוען חוברת פרויקט...</span>
      </div>
    );
  }

  if (!project) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-3xl mx-auto space-y-6 p-1"
      >
        <h1
          className="text-3xl font-extrabold bg-clip-text text-transparent"
          style={{ backgroundImage: `linear-gradient(135deg, ${ACCENT}, #6D28D9)` }}
        >
          חוברת פיתוח
        </h1>
        <p className="text-sm text-gray-500">בחרי פרויקט כדי לפתוח את חוברת הפיתוח שלו</p>

        {allProjects.length === 0 ? (
          <div className="rounded-[28px] border-2 border-dashed p-12 text-center" style={{ borderColor: `${ACCENT}30` }}>
            <BookOpen className="w-12 h-12 mx-auto mb-3" style={{ color: `${ACCENT}40` }} />
            <p className="text-gray-500 font-bold">אין פרויקטים עדיין</p>
            <Button onClick={() => navigate('/Projects')} className="mt-4 rounded-xl text-white" style={{ background: ACCENT }}>
              <Plus className="w-4 h-4 ml-2" />
              צרי פרויקט חדש
            </Button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {allProjects.map((proj) => {
              const statusConf = PHASES_STATUS_MAP[proj.status] || { emoji: '📋', label: proj.status || 'תכנון', color: '#94A3B8' };
              return (
                <motion.button
                  key={proj.id}
                  onClick={() => selectProject(proj)}
                  whileHover={{ y: -3, boxShadow: `0 8px 24px ${ACCENT}15` }}
                  whileTap={{ scale: 0.98 }}
                  className="text-right rounded-[24px] p-4 bg-white border border-gray-100 transition-all hover:border-purple-200 cursor-pointer"
                  style={{ boxShadow: `0 2px 12px ${ACCENT}08` }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-lg"
                      style={{ background: `${statusConf.color}18` }}
                    >
                      {statusConf.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 text-[14px] truncate">{proj.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className="text-[11px] px-2 py-0.5 rounded-full font-semibold"
                          style={{ background: `${statusConf.color}15`, color: statusConf.color }}
                        >
                          {statusConf.emoji} {statusConf.label}
                        </span>
                        {proj.tech_stack && (
                          <span className="text-[10px] text-gray-400 truncate">
                            {proj.tech_stack.split(',').slice(0, 2).join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                    <ArrowLeft className="w-4 h-4 text-gray-300 shrink-0" />
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto space-y-6 p-1"
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/Projects')}
          className="p-2 rounded-xl hover:bg-purple-50 text-gray-400 hover:text-purple-600 transition-colors"
        >
          <ArrowRight className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1
            className="text-2xl font-extrabold bg-clip-text text-transparent"
            style={{ backgroundImage: `linear-gradient(135deg, ${ACCENT}, #6D28D9)` }}
          >
            חוברת פיתוח: {project.name}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5" />
            {PHASES.length} שלבים • {overallProgress}% הושלם
          </p>
        </div>
      </div>

      {/* ── Project Info Card ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="rounded-[28px] p-4 bg-white border border-gray-100"
        style={{ boxShadow: `0 2px 12px ${ACCENT}06` }}
      >
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: `${PHASES_STATUS_MAP[project.status]?.color || ACCENT}18` }}
          >
            <span className="text-sm">{PHASES_STATUS_MAP[project.status]?.emoji || '📋'}</span>
          </div>
          <div className="flex-1">
            <span
              className="text-[11px] px-2 py-0.5 rounded-full font-semibold"
              style={{
                background: `${PHASES_STATUS_MAP[project.status]?.color || ACCENT}15`,
                color: PHASES_STATUS_MAP[project.status]?.color || ACCENT,
              }}
            >
              {PHASES_STATUS_MAP[project.status]?.label || project.status}
            </span>
          </div>
          <button
            onClick={() => setSearchParams({})}
            className="text-[11px] text-gray-400 hover:text-purple-600 transition-colors"
          >
            החלף פרויקט
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[12px]">
          {project.system_type && (
            <div className="flex items-center gap-1.5 text-gray-500">
              <span className="text-gray-400">סוג:</span>
              {project.system_type === 'web_app' ? 'אפליקציית ווב' :
               project.system_type === 'mobile_app' ? 'מובייל' :
               project.system_type === 'api' ? 'API / Backend' :
               project.system_type === 'landing_page' ? 'דף נחיתה' :
               project.system_type === 'ecommerce' ? 'חנות אונליין' :
               project.system_type === 'crm' ? 'CRM' :
               project.system_type === 'internal_tool' ? 'כלי פנימי' : project.system_type}
            </div>
          )}
          {project.tech_stack && (
            <div className="flex items-center gap-1.5 text-gray-500 col-span-2">
              <span className="text-gray-400">טכנולוגיות:</span>
              <div className="flex flex-wrap gap-1">
                {project.tech_stack.split(',').map((t, i) => (
                  <span key={i} className="px-1.5 py-0.5 rounded-full text-[10px] font-medium"
                    style={{ background: `${ACCENT}10`, color: ACCENT }}>
                    {t.trim()}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Links */}
        {(project.production_url || project.git_repo || project.supabase_url || project.subdomain) && (
          <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-gray-100" dir="ltr">
            {project.production_url && (
              <a href={project.production_url} target="_blank" rel="noopener noreferrer"
                className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: `${ACCENT}10`, color: ACCENT }}>
                Production
              </a>
            )}
            {project.git_repo && (
              <a href={project.git_repo} target="_blank" rel="noopener noreferrer"
                className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                Git
              </a>
            )}
            {project.supabase_url && (
              <a href={project.supabase_url} target="_blank" rel="noopener noreferrer"
                className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-medium">
                DB
              </a>
            )}
            {project.subdomain && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">
                {project.subdomain}
              </span>
            )}
          </div>
        )}

        {project.description && (
          <p className="text-[12px] text-gray-500 mt-3 pt-3 border-t border-gray-100">{project.description}</p>
        )}

        {project.notes && (
          <p className="text-[11px] text-gray-400 mt-2 italic">{project.notes}</p>
        )}
      </motion.div>

      {/* ── Bird's Eye Progress ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-[28px] p-4 bg-white border border-gray-100"
        style={{ boxShadow: `0 4px 20px ${ACCENT}08` }}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[12px] font-bold text-gray-500 flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5" style={{ color: ACCENT }} />
            מבט על — איפה אני?
          </h3>
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full" style={{ background: `${ACCENT}15`, color: ACCENT }}>
            {overallProgress}%
          </span>
        </div>

        {/* Overall progress bar */}
        <div className="h-2.5 rounded-full bg-gray-100 mb-4 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${overallProgress}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="h-full rounded-full"
            style={{ background: `linear-gradient(90deg, ${ACCENT}, #6D28D9)` }}
          />
        </div>

        <BirdEyeProgress phases={PHASES} checkedItems={checkedItems} currentPhaseId={currentPhaseId} />
      </motion.div>

      {/* ── Current Phase Highlight ── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.15 }}
        className="rounded-[28px] p-4"
        style={{
          background: `linear-gradient(135deg, ${PHASES[currentPhaseIndex]?.color}15, ${PHASES[currentPhaseIndex]?.color}05)`,
          border: `1px solid ${PHASES[currentPhaseIndex]?.color}25`,
        }}
      >
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5" style={{ color: PHASES[currentPhaseIndex]?.color }} />
          <div>
            <p className="text-[13px] font-bold" style={{ color: PHASES[currentPhaseIndex]?.color }}>
              השלב הנוכחי שלך: {PHASES[currentPhaseIndex]?.emoji} {PHASES[currentPhaseIndex]?.title}
            </p>
            <p className="text-[12px] text-gray-500 mt-0.5">
              {PHASES[currentPhaseIndex]?.tagline} — לחצי על השלב למטה כדי לראות מה צריך לעשות
            </p>
          </div>
        </div>
      </motion.div>

      {/* ── Phase Cards ── */}
      <div className="space-y-3">
        {PHASES.map((phase, i) => {
          const isCurrentPhase = phase.id === currentPhaseId;
          const isCompleted = i < currentPhaseIndex ||
            phase.checklist.every(c => checkedItems[c.key]);
          const isLocked = i > currentPhaseIndex + 1 &&
            !phase.checklist.some(c => checkedItems[c.key]);

          return (
            <PhaseCard
              key={phase.id}
              phase={phase}
              phaseIndex={i}
              isCurrentPhase={isCurrentPhase}
              isCompleted={isCompleted}
              isLocked={isLocked}
              isExpanded={expandedPhase === phase.id}
              onToggle={() => setExpandedPhase(prev => prev === phase.id ? null : phase.id)}
              checkedItems={checkedItems}
              onToggleItem={toggleItem}
            />
          );
        })}
      </div>

      {/* ── Claude Audit Findings ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="rounded-[28px] p-5 bg-white border border-gray-100"
        style={{ boxShadow: `0 4px 20px ${ACCENT}08` }}
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: `${ACCENT}15` }}>
            <FileSearch className="w-4 h-4" style={{ color: ACCENT }} />
          </div>
          <div>
            <h3 className="text-[14px] font-bold text-gray-900">עדכונים מקצועיים — Claude</h3>
            <p className="text-[11px] text-gray-500">ממצאי ביקורת UX, עיצוב, תכנות ולוגיקה</p>
          </div>
          <Badge className="text-[10px] px-2 py-0.5 rounded-full mr-auto" style={{ background: `${ACCENT}15`, color: ACCENT }}>
            17.3.2026
          </Badge>
        </div>

        <AuditTabs projectName={project?.name || ''} />
      </motion.div>

      {/* ── Bottom encouragement ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-center py-6"
      >
        <p className="text-[13px] text-gray-400">
          💜 צעד אחד בכל פעם. את לא חייבת לגמור הכל היום.
        </p>
      </motion.div>
    </motion.div>
  );
}
