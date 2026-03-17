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
  AlertTriangle, CheckCheck, Trash2, Merge, Ghost,
  GitBranch, Database, Globe, ExternalLink
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

const PHASES = [
  {
    id: 'idea', icon: Lightbulb, emoji: '💡', title: 'רעיון וחזון', color: '#F59E0B',
    tagline: 'מה אני בונה ולמה?',
    description: 'כאן את מגדירה את הרעיון — מה המערכת עושה, למי היא מיועדת, ואיזו בעיה היא פותרת.',
    whatINeed: ['רעיון ברור — משפט אחד שמסביר מה המערכת עושה', 'למי זה מיועד — מי ישתמש בזה?', 'למה זה חשוב — איזו בעיה זה פותר?'],
    checklist: [
      { key: 'idea_sentence', label: 'כתבתי משפט אחד שמתאר את המערכת' },
      { key: 'idea_audience', label: 'הגדרתי למי זה מיועד' },
      { key: 'idea_problem', label: 'הגדרתי איזו בעיה זה פותר' },
      { key: 'idea_name', label: 'בחרתי שם לפרויקט' },
    ],
    doneWhen: 'את יכולה להסביר לחברה בשתי שורות מה המערכת ולמה את בונה אותה.',
  },
  {
    id: 'planning', icon: Layout, emoji: '📐', title: 'תכנון מבנה', color: '#3B82F6',
    tagline: 'מה יהיה בפנים?',
    description: 'כאן את מחליטה אילו עמודים יהיו, אילו כפתורים, ואיזה מידע המערכת צריכה לשמור.',
    whatINeed: ['רשימת עמודים ראשיים', 'מה כל עמוד עושה', 'איזה מידע צריך לשמור'],
    checklist: [
      { key: 'plan_pages', label: 'רשמתי רשימת עמודים ראשיים' },
      { key: 'plan_features', label: 'תיארתי מה כל עמוד עושה' },
      { key: 'plan_data', label: 'הגדרתי איזה מידע לשמור' },
      { key: 'plan_flow', label: 'ציירתי זרימה בסיסית' },
    ],
    doneWhen: 'יש רשימה ברורה של עמודים + מה כל אחד עושה + איזה מידע שומרים.',
  },
  {
    id: 'design', icon: PenTool, emoji: '🎨', title: 'עיצוב ומראה', color: '#EC4899',
    tagline: 'איך זה ייראה?',
    description: 'כאן את בוחרת צבעים, פונטים, וסגנון כללי. אפשר להשתמש בתבניות מוכנות.',
    whatINeed: ['צבע ראשי', 'סגנון: מודרני? חמים? מינימלי?', 'דוגמאות השראה'],
    checklist: [
      { key: 'design_colors', label: 'בחרתי צבעים ראשיים' },
      { key: 'design_style', label: 'הגדרתי סגנון כללי' },
      { key: 'design_reference', label: 'שמרתי דוגמאות השראה' },
      { key: 'design_logo', label: 'יש לוגו או שם ויזואלי' },
    ],
    doneWhen: 'יש פלטת צבעים + סגנון ברור.',
  },
  {
    id: 'foundation', icon: Hammer, emoji: '🧱', title: 'בניית הבסיס', color: '#8B5CF6',
    tagline: 'מקימים את הפרויקט',
    description: 'כאן מקימים את הפרויקט — יוצרים את האפליקציה, מגדירים את העמודים הראשונים, ובונים את השלד.',
    whatINeed: ['פלטפורמה (React/Next/אחר)', 'סביבת עבודה מוכנה', 'העמוד הראשון עובד'],
    checklist: [
      { key: 'found_setup', label: 'הקמתי את הפרויקט' },
      { key: 'found_first_page', label: 'העמוד הראשון נטען ועובד' },
      { key: 'found_navigation', label: 'יש ניווט בסיסי בין עמודים' },
      { key: 'found_git', label: 'הפרויקט ב-Git ויש גיבוי' },
    ],
    doneWhen: 'את רואה את האפליקציה רצה בדפדפן עם ניווט בסיסי.',
  },
  {
    id: 'connections', icon: Link2, emoji: '🔗', title: 'חיבורים ונתונים', color: '#0891B2',
    tagline: 'מחברים את הנתונים',
    description: 'כאן מחברים את בסיס הנתונים ומוודאים שהמידע נשמר ונטען.',
    whatINeed: ['בסיס נתונים מוגדר', 'טבלאות מוגדרות', 'הנתונים נשמרים ונטענים'],
    checklist: [
      { key: 'conn_db', label: 'בסיס נתונים מוגדר ומחובר' },
      { key: 'conn_tables', label: 'טבלאות עיקריות נוצרו' },
      { key: 'conn_crud', label: 'אפשר ליצור, לקרוא, לעדכן ולמחוק נתונים' },
      { key: 'conn_auth', label: 'יש הרשמה/התחברות (אם צריך)' },
    ],
    doneWhen: 'את יכולה להוסיף מידע, לראות אותו, לערוך אותו — הכל נשמר.',
  },
  {
    id: 'testing', icon: TestTube2, emoji: '🧪', title: 'בדיקות', color: '#F59E0B',
    tagline: 'בודקים שהכל עובד',
    description: 'עוברים על כל חלק במערכת ובודקים שהוא עובד. מתקנים באגים.',
    whatINeed: ['רשימת תרחישים', 'מישהו נוסף שיבדוק', 'סבלנות 💪'],
    checklist: [
      { key: 'test_flows', label: 'בדקתי את כל הזרימות הראשיות' },
      { key: 'test_mobile', label: 'בדקתי במובייל' },
      { key: 'test_edge', label: 'בדקתי מקרי קצה' },
      { key: 'test_bugs', label: 'תיקנתי את כל הבאגים' },
    ],
    doneWhen: 'אפשר לעבור על כל המערכת בלי שגיאות.',
  },
  {
    id: 'launch', icon: Rocket, emoji: '🚀', title: 'השקה', color: '#10B981',
    tagline: 'מעלים לאוויר!',
    description: 'מעלים את המערכת לאוויר כדי שאנשים ישתמשו.',
    whatINeed: ['דומיין', 'שרת hosting', 'גיבוי אחרון'],
    checklist: [
      { key: 'launch_domain', label: 'יש דומיין מוכן' },
      { key: 'launch_deploy', label: 'המערכת באוויר ונגישה' },
      { key: 'launch_ssl', label: 'יש HTTPS (מנעול ירוק)' },
      { key: 'launch_test_live', label: 'הכל עובד בגרסה החיה' },
    ],
    doneWhen: 'אפשר להיכנס לכתובת ולהשתמש במערכת.',
  },
  {
    id: 'maintenance', icon: Wrench, emoji: '🔧', title: 'תחזוקה', color: '#6366F1',
    tagline: 'שומרים שהכל ימשיך לעבוד',
    description: 'גם מערכת צריכה טיפול שוטף — עדכונים, תיקונים, גיבויים.',
    whatINeed: ['ניטור שגיאות', 'גיבויים אוטומטיים', 'רשימת שיפורים'],
    checklist: [
      { key: 'maint_monitoring', label: 'יש ניטור שגיאות' },
      { key: 'maint_backup', label: 'גיבויים רצים אוטומטית' },
      { key: 'maint_updates', label: 'עדכנתי ספריות ותלויות' },
      { key: 'maint_wishlist', label: 'רשמתי רשימת שיפורים' },
    ],
    doneWhen: 'המערכת רצה חלק, יש גיבויים, ויש רשימת שיפורים לעתיד.',
  },
];

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
          className="w-full flex items-center gap-3 p-4 text-end transition-colors"
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
                          className={`w-full flex items-center gap-3 p-3 rounded-2xl text-end transition-all duration-200 ${
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
            'תיקון חלקי בוצע: GroupedServiceTable מציג "דווח — ממתין לתשלום" לסוג authority. דרוש תיקון מלא ב-Engine.',
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
            '│  P5 דוחות ──→ מאזנים, ביקורת רו"ח   │',
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
      title: 'ממצאי עיצוב ו-ADHD — עדכון 17.3.2026',
      sections: [
        {
          heading: 'תוקן ע"י מעצב (branch: redesign-calmplan)',
          severity: 'success',
          items: [
            'RTL: תוקנו text-left/right → text-start/end, pl/pr → ps/pe ב-46+ קבצים',
            'עקביות כותרות: text-xl font-bold text-[#1E3A5F] בכל העמודים',
            'עקביות כרטיסים: rounded-xl shadow-sm border בכל מקום',
            'Dark mode: הוספת dark: variants למכלים ראשיים',
            'Loading: skeleton animations בכל עמוד דינאמי',
            'אנימציות: Framer Motion AnimatePresence page transitions ל-56 עמודים',
          ],
        },
        {
          heading: 'הפרות DNA שנותרו — לבדוק',
          severity: 'warning',
          items: [
            'Projects.jsx — לבדוק אם backdrop-blur-sm + bg-white/90 עדיין קיים (הפרת חוק 2: NO TRANSPARENCY)',
            'Layout.jsx — לבדוק אם text-gray-300/400/500 הוחלף ל-text-black (חוק 3)',
            'Reconciliations.jsx — animate-pulse על פריטים קריטיים (חוק 1: ZERO PANIC)',
            'ClientsDashboard.jsx — rgba transparency + gray text (חוקים 2+3)',
            'TaxReportsDashboard.jsx — SVG transparency (חוק 2)',
          ],
        },
        {
          heading: 'ADHD — מה עובד',
          severity: 'success',
          items: [
            'חוק 6 (5 סטטוסים בלבד) — מיושם נכון ב-processTemplates.js',
            'חוק 8 (collapse כברירת מחדל) — PayrollReportsDashboard מקפלת שירותים',
            'UnifiedAyoaLayout — 11 מתוך 56 עמודים משתמשים בו',
            'ProjectWorkbook — חוברת עם שלבים ברורים, מצוין ל-ADHD',
          ],
        },
        {
          heading: 'עדיין לעשות',
          severity: 'action',
          items: [
            'להוסיף UnifiedAyoaLayout ל-45 עמודים שעדיין חסרים',
            'להוסיף Bad Day Mode לעמוד הבית',
            'לבדוק שכל ה-dark mode variants עובדים בפועל (לא רק מוגדרים)',
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
      title: 'ממצאי קוד ומבנה — עדכון 17.3.2026',
      sections: [
        {
          heading: 'תוקן ע"י מעצב (branch: redesign-calmplan)',
          severity: 'success',
          items: [
            'TreatmentInput — מומש מלא עם CRUD, סטטיסטיקות, autocomplete מטפלים (entity: Treatment)',
            'WeeklyPlanner — מומש מלא עם grid שבועי, משימות/אירועים, ניווט',
            'AutomationPage — כללים נשמרים עכשיו ב-SystemConfig',
            'MealPlanner — שומר תפריט שבועי ורשימת קניות ב-Entity API (entity: MealPlan)',
            'Inspiration — ספרים דרך InspirationItem, פלייליסטים דרך UserPreferences',
            'Inventory — מיגרציה מ-localStorage ל-InventoryItem entity עם סנכרון',
            'Dashboards — tasksByCategory מלא מנתונים אמיתיים',
            'Routes חסרים נרשמו: WeeklyPlanner, TreatmentInput, AutomationPage, CalendarView',
            '4 entities חדשים: MealPlan, InspirationItem, InventoryItem, Treatment',
          ],
        },
        {
          heading: 'עמודים יתומים — עדיין אין ניווט מהסיידבר',
          severity: 'warning',
          items: [
            'AdminTasksDashboard — יש route אבל אין בסיידבר',
            'CalendarView — כפילות עם Calendar, אין ניווט',
            'Collections — מחובר לנתונים, אין ניווט',
            'Roadmap, Recommendations, WeeklySummary — עמודי מידע ללא ניווט',
            'ClientOnboarding, ClientFiles, ClientContracts — sub-pages של ClientManagement',
            'TestDataManager, EmergencyRecovery, EmergencyReset — כלי dev',
          ],
        },
        {
          heading: 'כפילויות — לבדוק',
          severity: 'warning',
          items: [
            'Calendar + CalendarView — שני עמודי לוח שנה, Calendar הוא הראשי',
            'SystemOverview + SystemReadiness — שניהם מראים מצב מערכת',
            'Tasks + AdminTasksDashboard + WeeklyPlanningDashboard — חפיפה בניהול משימות',
            'ClientsDashboard (P2) + ClientManagement (P3) — אותם לקוחות, תצוגה שונה',
            'P5 דוחות אישיים → מפנה ל-BalanceSheets (אותו URL בדיוק!)',
          ],
        },
        {
          heading: 'מה לעשות',
          severity: 'action',
          items: [
            'לאחד: SystemOverview + SystemReadiness → SystemDashboard אחד',
            'לאחד: P5 "דוחות אישיים" → טאב בתוך BalanceSheets (לא route נפרד)',
            'להוסיף לסיידבר: AdminTasksDashboard (או לאחד עם Tasks)',
            'לוודא 4 entities חדשים (MealPlan, InspirationItem, InventoryItem, Treatment) נוצרו ב-API',
            'לבדוק Inspiration — memory leak של URL.createObjectURL (האם תוקן?)',
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
            'תיקון חלקי: GroupedServiceTable מציג "דווח — ממתין לתשלום" ל-taskType=authority (UI בלבד)',
            'דרוש תיקון מלא: להוסיף status_labels לעץ התהליכים כדי שהסטטוס יהיה context-aware מה-engine',
          ],
        },
        {
          heading: 'ארכיטקטורה: עץ שולט על הכל (הוחלט)',
          severity: 'warning',
          items: [
            'הוחלט: עץ התהליכים (companyProcessTree) יהיה מקור האמת היחיד',
            'חסר בעץ: שדה taskType (רק ב-processTemplates, לא בעץ)',
            'חסר בעץ: שדה status_labels — שם סטטוס לפי סוג שירות',
            'processTemplates.js ישאר כ-fallback בלבד עד המיגרציה המלאה',
          ],
        },
        {
          heading: 'בעיות נוספות',
          severity: 'warning',
          items: [
            'processTemplates.js:937 — 5 סטטוסים "זהובים" אבל הלוגיקה מצריכה 6 (חסר: "דווח")',
            'RecurringTasks.jsx — מערך משימות hardcoded ריק! (ציון: 3/10)',
            'BusinessHub.jsx — חודש hardcoded ל-2026-02 (לא דינאמי)',
            'LifeSettings.jsx — חגים hardcoded ל-2024 (לא עודכן)',
            'evaluateAuthorityStatus עושה submission→sent_for_review גם למע"מ, גם לב"ל, גם לניכויים — בלי הבחנה',
          ],
        },
        {
          heading: 'תיקונים נדרשים — לפי סדר עדיפות',
          severity: 'action',
          items: [
            '1. להוסיף taskType + status_labels לנודים בעץ התהליכים (companyProcessTree.js)',
            '2. לעדכן taskCascadeEngine להחזיר status label מהעץ (לא רק status key)',
            '3. לתקן RecurringTasks — לטעון משימות חוזרות מ-API (לא מערך ריק)',
            '4. לתקן BusinessHub — חודש דינאמי (new Date())',
            '5. לתקן LifeSettings — חגים 2025-2026 (או לטעון מ-API)',
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
      title: 'ממצאי חוויית משתמש — עדכון 17.3.2026',
      sections: [
        {
          heading: 'מפת 56 עמודים — מה בסיידבר ומה לא',
          items: [
            'בסיידבר: 25 עמודים (P1: 4, P2: 4, P3: 13, P4: 3, P5: 2, P6: 2)',
            'יתומים (route קיים, אין ניווט): ~20 עמודים',
            'stubs שהפכו דינאמיים: TreatmentInput, WeeklyPlanner, AutomationPage (תוקן!)',
            'חדש: 4 עמודים שנרשמו ב-routes (WeeklyPlanner, TreatmentInput, AutomationPage, CalendarView)',
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
          heading: 'שיפורים מהמעצב — לאמת',
          severity: 'success',
          items: [
            'Framer Motion page transitions בכל 56 העמודים — לבדוק שחלק',
            'Skeleton loading בכל עמוד דינאמי — לבדוק שנראה טוב',
            'RTL fixes ב-46+ קבצים — לבדוק שלא שבר layout קיים',
            'Dashboards.jsx — tasksByCategory מלא מנתונים אמיתיים',
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
  const [activeTab, setActiveTab] = useState(null);

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [projectId]);

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
            if (saved && typeof saved === 'object') setCheckedItems(saved);
            setActiveTab(getPhaseFromStatus(found.status));
          }
        } else {
          setProject(null);
        }
      } catch (e) { console.error('Failed to load projects:', e); }
      setLoading(false);
    })();
  }, [projectId]);

  const selectProject = (proj) => setSearchParams({ projectId: proj.id });

  const saveChecklist = useCallback(async (newItems) => {
    if (!projectId) return;
    try { await Project.update(projectId, { workbook_checklist: newItems }); }
    catch (e) { console.error('Failed to save checklist:', e); }
  }, [projectId]);

  const toggleItem = useCallback((key) => {
    setCheckedItems(prev => {
      const next = { ...prev, [key]: !prev[key] };
      saveChecklist(next);
      return next;
    });
  }, [saveChecklist]);

  const currentPhaseId = project ? getPhaseFromStatus(project.status) : 'idea';
  const activePhase = PHASES.find(p => p.id === activeTab) || PHASES[0];

  const overallProgress = useMemo(() => {
    const total = PHASES.reduce((s, p) => s + p.checklist.length, 0);
    const done = PHASES.reduce((s, p) => s + p.checklist.filter(c => checkedItems[c.key]).length, 0);
    return total > 0 ? Math.round((done / total) * 100) : 0;
  }, [checkedItems]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-t-transparent" style={{ borderColor: `${ACCENT}40`, borderTopColor: 'transparent' }} />
      </div>
    );
  }

  /* ── Project Picker ── */
  if (!project) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 p-1">
        <h1 className="text-xl font-bold text-[#1E3A5F] dark:text-white">
          דאשבורד פרויקטים
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">בחרי פרויקט כדי לפתוח את חוברת הפיתוח שלו</p>
        {allProjects.length === 0 ? (
          <div className="rounded-[24px] border-2 border-dashed p-12 text-center" style={{ borderColor: `${ACCENT}30` }}>
            <BookOpen className="w-12 h-12 mx-auto mb-3" style={{ color: `${ACCENT}40` }} />
            <p className="text-gray-500 dark:text-gray-400 font-bold">אין פרויקטים עדיין</p>
            <Button onClick={() => navigate('/Projects')} className="mt-4 rounded-xl text-white" style={{ background: ACCENT }}>
              <Plus className="w-4 h-4 ms-2" /> צרי פרויקט חדש
            </Button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {allProjects.map((proj) => {
              const sc = PHASES_STATUS_MAP[proj.status] || { emoji: '📋', label: 'תכנון', color: '#94A3B8' };
              return (
                <motion.button key={proj.id} onClick={() => selectProject(proj)}
                  whileHover={{ y: -3 }} whileTap={{ scale: 0.98 }}
                  className="text-end rounded-[20px] p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:border-purple-200 transition-all"
                  style={{ boxShadow: `0 2px 12px ${ACCENT}08` }}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0"
                      style={{ background: `${sc.color}15` }}>{sc.emoji}</div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 dark:text-white text-sm truncate">{proj.name}</h3>
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: `${sc.color}15`, color: sc.color }}>{sc.label}</span>
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

  /* ── Main Workbook (Tab layout) ── */
  const phaseDone = (phase) => phase.checklist.filter(c => checkedItems[c.key]).length;
  const phaseTotal = (phase) => phase.checklist.length;
  const phaseComplete = (phase) => phaseDone(phase) === phaseTotal(phase);

  return (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto space-y-6 p-1 dark:bg-gray-900">
      {/* ── Header row ── */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon"
          onClick={() => navigate('/Projects')}
          className="rounded-xl hover:bg-purple-50 text-gray-400 hover:text-purple-600 transition-colors">
          <ArrowRight className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-[#1E3A5F] dark:text-white truncate">
            חוברת פיתוח: {project.name}
          </h1>
          <div className="flex items-center gap-2 mt-0.5 text-[12px] text-gray-500">
            <span className="px-2 py-0.5 rounded-full font-semibold text-[11px]"
              style={{ background: `${PHASES_STATUS_MAP[project.status]?.color || ACCENT}15`, color: PHASES_STATUS_MAP[project.status]?.color || ACCENT }}>
              {PHASES_STATUS_MAP[project.status]?.emoji} {PHASES_STATUS_MAP[project.status]?.label}
            </span>
            {project.tech_stack && <span className="text-gray-400">{project.tech_stack.split(',').slice(0, 3).join(' · ')}</span>}
            {/* Quick links */}
            <div className="flex gap-1 mr-auto" dir="ltr">
              {project.production_url && <a href={project.production_url} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-purple-50"><ExternalLink className="w-3 h-3 text-purple-500" /></a>}
              {project.git_repo && <a href={project.git_repo} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-gray-100"><GitBranch className="w-3 h-3 text-gray-500" /></a>}
              {project.supabase_url && <a href={project.supabase_url} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-emerald-50"><Database className="w-3 h-3 text-emerald-500" /></a>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setSearchParams({})} className="text-[11px] text-gray-400 hover:text-purple-600 px-2 py-1 rounded-lg hover:bg-purple-50 transition-colors">
            החלף פרויקט
          </button>
          <div className="text-center">
            <div className="text-lg font-black" style={{ color: ACCENT }}>{overallProgress}%</div>
            <div className="text-[9px] text-gray-400 font-semibold">התקדמות</div>
          </div>
        </div>
      </div>

      {/* ── Phase Tabs (horizontal card tabs) ── */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
        {PHASES.map((phase, i) => {
          const isActive = activeTab === phase.id;
          const isCurrent = currentPhaseId === phase.id;
          const done = phaseDone(phase);
          const total = phaseTotal(phase);
          const complete = done === total;

          return (
            <button
              key={phase.id}
              onClick={() => setActiveTab(phase.id)}
              className="shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all text-center min-w-[80px]"
              style={{
                background: isActive
                  ? `linear-gradient(135deg, ${phase.color}20, ${phase.color}10)`
                  : complete ? '#F0FDF4' : '#FAFBFC',
                border: isActive
                  ? `2px solid ${phase.color}`
                  : isCurrent
                  ? `2px solid ${phase.color}50`
                  : '1px solid #E2E8F0',
                boxShadow: isActive ? `0 4px 12px ${phase.color}20` : 'none',
              }}
            >
              <div className="flex items-center gap-1">
                <span className="text-sm">{phase.emoji}</span>
                {complete && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
              </div>
              <span className="text-[10px] font-bold whitespace-nowrap" style={{ color: isActive ? phase.color : '#64748B' }}>
                {phase.title}
              </span>
              <span className="text-[9px] font-semibold" style={{ color: complete ? '#10B981' : '#94A3B8' }}>
                {done}/{total}
              </span>
              {isCurrent && !isActive && (
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: phase.color }} />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Active Phase Content (wide card) ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="rounded-[24px] border-2 overflow-hidden"
          style={{
            borderColor: `${activePhase.color}30`,
            boxShadow: `0 4px 24px ${activePhase.color}10`,
          }}
        >
          {/* Phase header */}
          <div className="px-6 py-4 flex items-center gap-4"
            style={{ background: `linear-gradient(135deg, ${activePhase.color}12, ${activePhase.color}06)` }}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
              style={{ background: `${activePhase.color}18` }}>
              {activePhase.emoji}
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold" style={{ color: activePhase.color }}>{activePhase.title}</h2>
              <p className="text-[13px] text-gray-500">{activePhase.tagline}</p>
            </div>
            {/* Progress ring */}
            <div className="relative w-14 h-14 shrink-0">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <circle cx="18" cy="18" r="15" fill="none" stroke="#E2E8F0" strokeWidth="3" />
                <circle cx="18" cy="18" r="15" fill="none"
                  stroke={phaseComplete(activePhase) ? '#10B981' : activePhase.color}
                  strokeWidth="3"
                  strokeDasharray={`${(phaseDone(activePhase) / phaseTotal(activePhase)) * 94.2} 100`}
                  strokeLinecap="round" className="transition-all duration-500" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold"
                style={{ color: phaseComplete(activePhase) ? '#10B981' : activePhase.color }}>
                {phaseDone(activePhase)}/{phaseTotal(activePhase)}
              </span>
            </div>
          </div>

          {/* Phase body — 2-column grid */}
          <div className="p-6 grid md:grid-cols-2 gap-5">
            {/* Left column: Description + Prerequisites */}
            <div className="space-y-4">
              <div className="rounded-2xl p-4 bg-white border border-gray-100">
                <p className="text-[13px] text-gray-700 leading-relaxed">{activePhase.description}</p>
              </div>

              <div>
                <h4 className="text-[12px] font-bold text-gray-500 mb-2 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" style={{ color: activePhase.color }} />
                  מה צריך לפני שמתחילים?
                </h4>
                <div className="space-y-1.5">
                  {activePhase.whatINeed.map((item, i) => (
                    <div key={i} className="flex items-start gap-2 text-[12px] text-gray-600">
                      <Star className="w-3 h-3 mt-0.5 shrink-0" style={{ color: activePhase.color }} />
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl p-3 border" style={{ background: `${activePhase.color}06`, borderColor: `${activePhase.color}20` }}>
                <h4 className="text-[12px] font-bold mb-1 flex items-center gap-1.5" style={{ color: activePhase.color }}>
                  <Eye className="w-3.5 h-3.5" />
                  סיימתי כשאני יכולה לומר:
                </h4>
                <p className="text-[12px] text-gray-600">{activePhase.doneWhen}</p>
              </div>
            </div>

            {/* Right column: Checklist */}
            <div>
              <h4 className="text-[12px] font-bold text-gray-500 mb-3 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" style={{ color: activePhase.color }} />
                צ'קליסט — סמני מה הושלם
              </h4>
              <div className="space-y-2">
                {activePhase.checklist.map((item) => {
                  const checked = checkedItems[item.key] || false;
                  return (
                    <motion.button key={item.key} onClick={() => toggleItem(item.key)}
                      whileTap={{ scale: 0.98 }}
                      className={`w-full flex items-center gap-3 p-3.5 rounded-2xl text-right transition-all duration-200 ${
                        checked ? 'bg-emerald-50 border border-emerald-200' : 'bg-gray-50 border border-gray-100 hover:bg-gray-100'
                      }`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all ${
                        checked ? 'bg-emerald-500' : 'border-2 border-gray-300'
                      }`}>
                        {checked && <CheckCircle2 className="w-4 h-4 text-white" />}
                      </div>
                      <span className={`text-[13px] flex-1 ${checked ? 'text-emerald-700 line-through' : 'text-gray-700'}`}>
                        {item.label}
                      </span>
                      {checked && <Sparkles className="w-3.5 h-3.5 text-emerald-500" />}
                    </motion.button>
                  );
                })}
              </div>

              {phaseComplete(activePhase) && (
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  className="mt-4 rounded-2xl p-4 bg-gradient-to-l from-emerald-50 to-green-50 border border-emerald-200 text-center">
                  <PartyPopper className="w-6 h-6 mx-auto text-emerald-500 mb-1" />
                  <p className="text-sm font-bold text-emerald-700">השלב הושלם! 🎉</p>
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

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

      <p className="text-center text-[12px] text-gray-400 py-2">
        💜 צעד אחד בכל פעם. את לא חייבת לגמור הכל היום.
      </p>
    </motion.div>
  );
}
