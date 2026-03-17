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
  PartyPopper, Lock
} from 'lucide-react';

const ACCENT = '#7C3AED';

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
 *  Main ProjectWorkbook Page
 * ──────────────────────────────────────────────────────────────── */
export default function ProjectWorkbook() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const projectId = searchParams.get('projectId');

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkedItems, setCheckedItems] = useState({});
  const [expandedPhase, setExpandedPhase] = useState(null);

  /* ── Scroll to top on mount ── */
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [projectId]);

  /* ── Load project data ── */
  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const projects = await Project.list(null, 500);
        const found = projects.find(p => p.id === projectId);
        if (found) {
          setProject(found);
          // Load saved checklist from project notes or a dedicated field
          const saved = found.workbook_checklist;
          if (saved && typeof saved === 'object') {
            setCheckedItems(saved);
          }
          // Auto-expand the current phase
          const currentPhase = getPhaseFromStatus(found.status);
          setExpandedPhase(currentPhase);
        }
      } catch (e) {
        console.error('Failed to load project:', e);
      }
      setLoading(false);
    })();
  }, [projectId]);

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

  if (!projectId || !project) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <BookOpen className="w-16 h-16 text-gray-300" />
        <p className="text-lg font-bold text-gray-500">לא נבחר פרויקט</p>
        <Button onClick={() => navigate('/Projects')} className="rounded-xl" style={{ background: ACCENT }}>
          <ArrowRight className="w-4 h-4 ms-2" />
          חזרה לפרויקטים
        </Button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto space-y-6 p-1 dark:bg-gray-900"
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/Projects')}
          className="rounded-xl hover:bg-purple-50 text-gray-400 hover:text-purple-600 transition-colors"
        >
          <ArrowRight className="w-5 h-5" />
        </Button>
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
