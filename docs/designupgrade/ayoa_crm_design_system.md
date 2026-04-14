# מערכת עיצוב CRM בהשראת Ayoa
## הנחיות מלאות לקלוד קוד — עברית RTL, ידידותי לקשב

---

## חלק א׳: הפילוסופיה העיצובית

### מי המשתמשת
אישה עם קשב, מנהלת עסק מהבית עם 30+ לקוחות, ריבוי משימות, צורך בבהירות מיידית.
**המטרה:** המערכת תרגיש כמו עוזר מסדר — לא כמו בירוקרטיה.

### שלושת עמודי היסוד
1. **צבע = שייכות** — כל לקוח/פרויקט מוכר לפי הצבע שלו, לפני שקוראים מילה
2. **עיגולים ועקומות** — אין זוויות חדות. הכל רך, מוזמן, לא מאיים
3. **גילוי הדרגתי** — ברירת מחדל: מינימום. מורכבות — רק לפי בחירה

---

## חלק ב׳: מערכת הצבעים המלאה

### עיקרון: כל קטגוריה = משפחת צבעים

כל קטגוריה (לקוח / סוג משימה / סטטוס) מקבלת **שלושה גוונים** מאותה משפחה:
- `--bg`: רקע כרטיסייה (כמעט לבן, 8% רוויה)
- `--main`: הצבע הראשי (לתגיות, עיגולים, אינדיקטורים)
- `--deep`: גרסה כהה (לטקסט, אייקונים, גבולות)

### 10 משפחות הקטגוריות

```css
:root {

  /* 1. מרווה — טבעי, מאוזן */
  --cat-1-bg:   #F0FAF5;
  --cat-1-main: #74C69D;
  --cat-1-deep: #2D8653;

  /* 2. לבנדר — עדין, יצירתי */
  --cat-2-bg:   #F5F2FA;
  --cat-2-main: #B5A4CF;
  --cat-2-deep: #6B4FA0;

  /* 3. אפרסק — חמים, אנרגטי */
  --cat-3-bg:   #FEF6EF;
  --cat-3-main: #F4A261;
  --cat-3-deep: #C4622A;

  /* 4. צהוב חמאה — בהיר, ממוקד */
  --cat-4-bg:   #FEFCE8;
  --cat-4-main: #F9C74F;
  --cat-4-deep: #A07800;

  /* 5. תורכיז — רענן, ברור */
  --cat-5-bg:   #F0FAFA;
  --cat-5-main: #2EC4B6;
  --cat-5-deep: #1A7A70;

  /* 6. טרקוטה — חם, ללא לחץ (במקום אדום) */
  --cat-6-bg:   #FDF2EE;
  --cat-6-main: #E07B54;
  --cat-6-deep: #9A3E1E;

  /* 7. כחול פלדה — מקצועי, נקי */
  --cat-7-bg:   #EFF4FA;
  --cat-7-main: #5B8DB8;
  --cat-7-deep: #2A5A8A;

  /* 8. סגול-ורוד — נעים, יצירתי */
  --cat-8-bg:   #FDF2F8;
  --cat-8-main: #D4A5C9;
  --cat-8-deep: #8A3F74;

  /* 9. ירוק זית — יציב, ארצי */
  --cat-9-bg:   #F4F7F0;
  --cat-9-main: #8DB174;
  --cat-9-deep: #4A6E35;

  /* 10. אינדיגו — עמוק, אמין */
  --cat-10-bg:   #F0F1FA;
  --cat-10-main: #7B8BD4;
  --cat-10-deep: #3A4BA0;

  /* --- צבעי מערכת (לא קטגוריות) --- */
  --color-primary:       #5B8DB8;   /* כחול ראשי — UI */
  --color-primary-hover: #2A5A8A;
  --color-primary-light: #EFF4FA;

  /* סטטוס — מבוקר ולא מאיים */
  --color-urgent:    #E07B54;  /* טרקוטה — דחוף (במקום אדום בוהק) */
  --color-important: #F4A261;  /* אפרסק — חשוב */
  --color-active:    #74C69D;  /* מרווה — פעיל */
  --color-pending:   #F9C74F;  /* צהוב חמאה — ממתין */
  --color-done:      #B0B8C1;  /* אפור — הושלם */

  /* רקעים */
  --bg-app:      #F8F9FA;   /* רקע כללי — לבן קרם */
  --bg-surface:  #FFFFFF;   /* כרטיסיות ופאנלים */
  --bg-sidebar:  #1E2A3A;   /* סרגל צד כהה */
  --bg-toolbar:  #FFFFFF;   /* סרגל עליון לבן */

  /* טקסט */
  --text-primary:   #1A2332;   /* כמעט שחור, לא שחור מלא */
  --text-secondary: #5A6A7A;
  --text-muted:     #9AA5B4;
  --text-on-dark:   #F0F4F8;
  --text-on-color:  #FFFFFF;

  /* גבולות */
  --border-light:  #EEF1F5;
  --border-medium: #D8DDE5;
  --border-focus:  #5B8DB8;
}
```

### JavaScript — מערך הצבעים לסופהבייס ולבחירת משתמש

```typescript
// src/constants/categoryColors.ts

export const CATEGORY_COLORS = [
  {
    id: 1,
    nameHe: 'מרווה',
    bg: '#F0FAF5',
    main: '#74C69D',
    deep: '#2D8653',
    feel: 'טבעי, מאוזן'
  },
  {
    id: 2,
    nameHe: 'לבנדר',
    bg: '#F5F2FA',
    main: '#B5A4CF',
    deep: '#6B4FA0',
    feel: 'עדין, יצירתי'
  },
  {
    id: 3,
    nameHe: 'אפרסק',
    bg: '#FEF6EF',
    main: '#F4A261',
    deep: '#C4622A',
    feel: 'חמים, אנרגטי'
  },
  {
    id: 4,
    nameHe: 'צהוב חמאה',
    bg: '#FEFCE8',
    main: '#F9C74F',
    deep: '#A07800',
    feel: 'בהיר, ממוקד'
  },
  {
    id: 5,
    nameHe: 'תורכיז',
    bg: '#F0FAFA',
    main: '#2EC4B6',
    deep: '#1A7A70',
    feel: 'רענן, ברור'
  },
  {
    id: 6,
    nameHe: 'טרקוטה',
    bg: '#FDF2EE',
    main: '#E07B54',
    deep: '#9A3E1E',
    feel: 'חם, ללא לחץ'
  },
  {
    id: 7,
    nameHe: 'כחול פלדה',
    bg: '#EFF4FA',
    main: '#5B8DB8',
    deep: '#2A5A8A',
    feel: 'מקצועי, נקי'
  },
  {
    id: 8,
    nameHe: 'סגול-ורוד',
    bg: '#FDF2F8',
    main: '#D4A5C9',
    deep: '#8A3F74',
    feel: 'נעים, יצירתי'
  },
  {
    id: 9,
    nameHe: 'ירוק זית',
    bg: '#F4F7F0',
    main: '#8DB174',
    deep: '#4A6E35',
    feel: 'יציב, ארצי'
  },
  {
    id: 10,
    nameHe: 'אינדיגו',
    bg: '#F0F1FA',
    main: '#7B8BD4',
    deep: '#3A4BA0',
    feel: 'עמוק, אמין'
  },
] as const;

export type CategoryColor = typeof CATEGORY_COLORS[number];

// פונקציה: לקבל צבעים לפי ID
export function getCategoryColor(id: number): CategoryColor {
  return CATEGORY_COLORS.find(c => c.id === id) ?? CATEGORY_COLORS[0];
}
```

---

## חלק ג׳: טיפוגרפיה

```css
:root {
  /* פונטים */
  --font-primary: 'Heebo', 'Open Sans', system-ui, sans-serif;
  /* Heebo — פונט עברי מעוצב היטב, תומך RTL מלא */

  /* גדלים */
  --text-xs:   0.75rem;   /* 12px — תגיות, מטא-דאטה */
  --text-sm:   0.875rem;  /* 14px — טקסט משני */
  --text-base: 1rem;      /* 16px — גוף ראשי */
  --text-lg:   1.125rem;  /* 18px — כותרות כרטיסייה */
  --text-xl:   1.25rem;   /* 20px — כותרות סעיף */
  --text-2xl:  1.5rem;    /* 24px — כותרות ראשיות */
  --text-3xl:  1.875rem;  /* 30px — כותרת עמוד */

  /* משקלים */
  --weight-regular:  400;
  --weight-medium:   500;
  --weight-semibold: 600;
  --weight-bold:     700;

  /* גובה שורה — נדיב לקריאות */
  --leading-tight:   1.3;
  --leading-normal:  1.6;
  --leading-relaxed: 1.8;  /* לפסקאות ארוכות */
}
```

---

## חלק ד׳: צורות, עיגולים, ועקומות

```css
:root {
  /* Border Radius — מערכת ה"בועתיות" */
  --radius-sm:     6px;    /* אלמנטים קטנים: תגיות, badges */
  --radius-md:     12px;   /* כרטיסיות, כפתורים */
  --radius-lg:     16px;   /* פאנלים, מודלים */
  --radius-xl:     24px;   /* containers גדולים */
  --radius-pill:   9999px; /* כפתורי pill, תגיות סטטוס */
  --radius-circle: 50%;    /* בועות משימה, אווטרים */

  /* צלליות — רכות ולא בנקאיות */
  --shadow-xs:     0 1px 3px rgba(26, 35, 50, 0.06);
  --shadow-sm:     0 2px 8px rgba(26, 35, 50, 0.08);
  --shadow-md:     0 4px 16px rgba(26, 35, 50, 0.10);
  --shadow-lg:     0 8px 32px rgba(26, 35, 50, 0.12);
  --shadow-bubble: 0 4px 20px rgba(91, 141, 184, 0.18);
  --shadow-drag:   0 16px 48px rgba(26, 35, 50, 0.22);

  /* מרווחים */
  --space-1: 0.25rem;  /* 4px */
  --space-2: 0.5rem;   /* 8px */
  --space-3: 0.75rem;  /* 12px */
  --space-4: 1rem;     /* 16px */
  --space-5: 1.25rem;  /* 20px */
  --space-6: 1.5rem;   /* 24px */
  --space-8: 2rem;     /* 32px */
  --space-10: 2.5rem;  /* 40px */
  --space-12: 3rem;    /* 48px */
  --space-16: 4rem;    /* 64px */
}
```

---

## חלק ה׳: אנימציות ומיקרו-אינטראקציות

```css
:root {
  --transition-fast:   150ms ease-out;
  --transition-normal: 250ms ease-in-out;
  --transition-slow:   400ms ease-in-out;
  --transition-spring: 300ms cubic-bezier(0.34, 1.56, 0.64, 1); /* קפיצי */
  --transition-bounce: 500ms cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

/* --- אנימציות מוכנות לשימוש --- */

/* טבעת התקדמות */
@keyframes progressRing {
  from { stroke-dashoffset: var(--circumference); }
  to   { stroke-dashoffset: var(--offset); }
}

/* השלמת משימה — דעיכה עם שינוי צבע */
@keyframes taskComplete {
  0%   { opacity: 1; transform: scale(1); }
  50%  { opacity: 0.7; transform: scale(1.05); background: var(--color-done); }
  100% { opacity: 0; transform: scale(0.8); }
}

/* קונפטי — אבן דרך */
@keyframes confettiFall {
  0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
  100% { transform: translateY(60px) rotate(360deg); opacity: 0; }
}

/* כניסת כרטיסייה */
@keyframes cardEnter {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* pulse עדין לאלמנטים חשובים */
@keyframes softPulse {
  0%, 100% { box-shadow: var(--shadow-bubble); }
  50%       { box-shadow: 0 4px 24px rgba(91, 141, 184, 0.32); }
}

/* --- Hover States --- */
.task-bubble:hover {
  transform: scale(1.04);
  box-shadow: var(--shadow-drag);
  transition: var(--transition-spring);
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  transition: var(--transition-normal);
}

.sidebar-item:hover {
  background: rgba(255,255,255,0.08);
  padding-inline-start: calc(var(--space-4) + 4px);
  transition: var(--transition-fast);
}
```

---

## חלק ו׳: קומפוננטות React מוכנות

### 1. בועת משימה (Canvas View)

```tsx
// src/components/TaskBubble.tsx
import { getCategoryColor } from '../constants/categoryColors';

interface TaskBubbleProps {
  title: string;
  progress: number; // 0-100
  categoryColorId: number;
  isImportant?: boolean;
  isUrgent?: boolean;
  assigneeInitials?: string;
  dueDate?: string;
  size?: 'sm' | 'md' | 'lg'; // גודל לפי חשיבות
  onClick?: () => void;
}

export function TaskBubble({
  title, progress, categoryColorId,
  isImportant, isUrgent, assigneeInitials,
  dueDate, size = 'md', onClick
}: TaskBubbleProps) {
  const color = getCategoryColor(categoryColorId);
  const sizeMap = { sm: 80, md: 108, lg: 136 };
  const d = sizeMap[size];
  const r = d / 2;
  const strokeR = r - 5;
  const circumference = 2 * Math.PI * strokeR;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div
      className="relative cursor-pointer group select-none"
      style={{ width: d, height: d }}
      onClick={onClick}
    >
      {/* SVG — טבעת רקע + טבעת התקדמות */}
      <svg
        viewBox={`0 0 ${d} ${d}`}
        className="absolute inset-0"
        style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.08))' }}
      >
        {/* רקע הבועה */}
        <circle
          cx={r} cy={r} r={strokeR}
          fill={color.bg}
          stroke={color.main}
          strokeWidth="2"
          opacity="0.5"
        />
        {/* טבעת התקדמות */}
        {progress > 0 && (
          <circle
            cx={r} cy={r} r={strokeR}
            fill="none"
            stroke={color.main}
            strokeWidth="3.5"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{
              transform: 'rotate(-90deg)',
              transformOrigin: 'center',
              transition: 'stroke-dashoffset 600ms ease-out'
            }}
          />
        )}
      </svg>

      {/* תוכן הבועה */}
      <div
        className="absolute inset-0 flex flex-col items-center
                   justify-center text-center px-3"
      >
        <span
          className="text-xs font-semibold leading-tight line-clamp-3"
          style={{ color: color.deep }}
        >
          {title}
        </span>
        {progress > 0 && (
          <span
            className="text-[10px] mt-1 font-medium opacity-70"
            style={{ color: color.deep }}
          >
            {progress}%
          </span>
        )}
      </div>

      {/* דגל חשוב */}
      {isImportant && (
        <div className="absolute -top-1 -end-1 w-5 h-5 rounded-full
                        bg-[#F4A261] flex items-center justify-center
                        shadow-sm text-white text-[10px]">
          !
        </div>
      )}

      {/* דגל דחוף */}
      {isUrgent && (
        <div className="absolute -top-1 -start-1 w-5 h-5 rounded-full
                        bg-[#E07B54] flex items-center justify-center
                        shadow-sm text-white text-[10px]">
          ⚡
        </div>
      )}

      {/* אווטר */}
      {assigneeInitials && (
        <div
          className="absolute -bottom-2 end-0 w-7 h-7 rounded-full
                     border-2 border-white shadow-sm
                     flex items-center justify-center
                     text-[10px] font-bold text-white"
          style={{ background: color.main }}
        >
          {assigneeInitials}
        </div>
      )}

      {/* תאריך יעד */}
      {dueDate && (
        <span className="absolute -bottom-6 text-[10px] text-gray-400
                         whitespace-nowrap">
          {dueDate}
        </span>
      )}
    </div>
  );
}
```

### 2. כרטיסיית לקוח (Kanban / רשימה)

```tsx
// src/components/ClientCard.tsx
interface ClientCardProps {
  name: string;
  company: string;
  lastActivity: string;
  status: 'active' | 'pending' | 'done' | 'urgent';
  categoryColorId: number;
  tasksOpen: number;
  tasksDone: number;
  onClick?: () => void;
}

const STATUS_MAP = {
  active:  { label: 'פעיל',    bg: '#F0FAF5', text: '#2D8653' },
  pending: { label: 'ממתין',   bg: '#FEFCE8', text: '#A07800' },
  done:    { label: 'הושלם',   bg: '#F3F4F6', text: '#6B7280' },
  urgent:  { label: 'דחוף',    bg: '#FDF2EE', text: '#9A3E1E' },
};

export function ClientCard({
  name, company, lastActivity, status,
  categoryColorId, tasksOpen, tasksDone, onClick
}: ClientCardProps) {
  const color = getCategoryColor(categoryColorId);
  const statusStyle = STATUS_MAP[status];
  const totalTasks = tasksOpen + tasksDone;
  const progressPct = totalTasks > 0
    ? Math.round((tasksDone / totalTasks) * 100) : 0;

  return (
    <div
      onClick={onClick}
      className="group cursor-pointer rounded-[12px] bg-white
                 border border-[#EEF1F5] p-4
                 hover:-translate-y-0.5
                 hover:shadow-[0_8px_24px_rgba(26,35,50,0.10)]
                 transition-all duration-250
                 animate-[cardEnter_300ms_ease-out]"
      style={{
        borderInlineStart: `4px solid ${color.main}`,
      }}
    >
      {/* כותרת */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          {/* אווטר צבעוני */}
          <div
            className="w-10 h-10 rounded-full flex items-center
                       justify-center text-sm font-bold shrink-0"
            style={{
              background: color.bg,
              color: color.deep,
              border: `2px solid ${color.main}`,
            }}
          >
            {name.charAt(0)}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#1A2332]
                           leading-tight">
              {name}
            </h3>
            <p className="text-xs text-[#9AA5B4] mt-0.5">{company}</p>
          </div>
        </div>

        {/* תגית סטטוס */}
        <span
          className="text-[11px] font-semibold px-2 py-0.5
                     rounded-pill shrink-0"
          style={{
            background: statusStyle.bg,
            color: statusStyle.text,
          }}
        >
          {statusStyle.label}
        </span>
      </div>

      {/* פס התקדמות */}
      {totalTasks > 0 && (
        <div className="mt-3">
          <div className="flex justify-between text-[11px]
                          text-[#9AA5B4] mb-1">
            <span>{tasksDone} מתוך {totalTasks} משימות</span>
            <span>{progressPct}%</span>
          </div>
          <div className="h-1.5 bg-[#EEF1F5] rounded-pill overflow-hidden">
            <div
              className="h-full rounded-pill transition-all duration-500"
              style={{
                width: `${progressPct}%`,
                background: color.main,
              }}
            />
          </div>
        </div>
      )}

      {/* פעילות אחרונה */}
      <p className="mt-2 text-[11px] text-[#9AA5B4]">
        פעילות אחרונה: {lastActivity}
      </p>
    </div>
  );
}
```

### 3. בורר צבע קטגוריה

```tsx
// src/components/ColorPicker.tsx
interface ColorPickerProps {
  selectedId: number;
  onSelect: (id: number) => void;
}

export function ColorPicker({ selectedId, onSelect }: ColorPickerProps) {
  return (
    <div className="flex flex-wrap gap-2 p-2">
      {CATEGORY_COLORS.map(color => (
        <button
          key={color.id}
          onClick={() => onSelect(color.id)}
          title={color.nameHe}
          className="w-8 h-8 rounded-full border-2 transition-all
                     hover:scale-110 active:scale-95"
          style={{
            background: color.main,
            borderColor: selectedId === color.id
              ? color.deep : 'transparent',
            boxShadow: selectedId === color.id
              ? `0 0 0 3px ${color.bg}, 0 0 0 5px ${color.main}`
              : 'none',
          }}
        />
      ))}
    </div>
  );
}
```

### 4. פאנל צד (RTL — נפתח משמאל)

```tsx
// src/components/SidePanel.tsx
interface SidePanelProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

const TABS = ['מידע', 'משימות', 'הערות', 'קבצים', 'היסטוריה'];

export function SidePanel({ isOpen, title, onClose, children }: SidePanelProps) {
  const [activeTab, setActiveTab] = useState(TABS[0]);

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-[150]
                     backdrop-blur-[2px]"
          onClick={onClose}
        />
      )}

      {/* הפאנל עצמו — נפתח מימין ב-RTL */}
      <div
        dir="rtl"
        className={`fixed top-0 end-0 h-full w-[420px]
                    bg-white z-[200] flex flex-col
                    shadow-[0_0_48px_rgba(26,35,50,0.16)]
                    transition-transform duration-300 ease-in-out
                    ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* כותרת */}
        <div className="flex items-center justify-between
                        p-4 border-b border-[#EEF1F5]">
          <h2 className="text-lg font-semibold text-[#1A2332]">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center
                       justify-center text-[#9AA5B4]
                       hover:bg-[#F8F9FA] transition-colors"
          >
            ✕
          </button>
        </div>

        {/* טאבים */}
        <div className="flex gap-1 px-4 pt-3 border-b border-[#EEF1F5] pb-0">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 text-sm font-medium rounded-t-lg
                         transition-colors -mb-px border-b-2
                         ${activeTab === tab
                           ? 'text-[#5B8DB8] border-[#5B8DB8]'
                           : 'text-[#9AA5B4] border-transparent hover:text-[#5A6A7A]'
                         }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* תוכן */}
        <div className="flex-1 overflow-y-auto p-4">
          {children}
        </div>
      </div>
    </>
  );
}
```

---

## חלק ז׳: מבנה ה-Layout הכללי

```tsx
// src/components/AppLayout.tsx
// מבנה: Sidebar כהה | תוכן ראשי | פאנל צד (לפי צורך)

export function AppLayout() {
  return (
    <div
      dir="rtl"
      className="flex h-screen overflow-hidden
                 bg-[#F8F9FA] font-[Heebo,sans-serif]"
    >
      {/* === סרגל צד שמאלי (ב-RTL = ימני) === */}
      <aside className="w-56 bg-[#1E2A3A] flex flex-col
                        shrink-0 z-10">
        {/* לוגו */}
        <div className="p-4 border-b border-white/10">
          <h1 className="text-white font-bold text-xl">ליתאי ניהול</h1>
          <p className="text-white/40 text-xs mt-0.5">מערכת לקוחות</p>
        </div>

        {/* ניווט */}
        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map(item => (
            <NavItem key={item.label} {...item} />
          ))}
        </nav>

        {/* מידע משתמש */}
        <div className="p-3 border-t border-white/10">
          <UserBadge />
        </div>
      </aside>

      {/* === תוכן ראשי === */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar עליון */}
        <header className="h-14 bg-white border-b border-[#EEF1F5]
                           flex items-center justify-between
                           px-6 shrink-0">
          <ViewSwitcher /> {/* Canvas / Kanban / לוח שנה */}
          <SearchBar />
          <ActionButtons />
        </header>

        {/* אזור תצוגה */}
        <div className="flex-1 overflow-auto p-6">
          <Outlet /> {/* React Router */}
        </div>
      </main>
    </div>
  );
}

// פריטי ניווט
const NAV_ITEMS = [
  { label: 'דשבורד',     icon: '📊', path: '/' },
  { label: 'לקוחות',     icon: '👥', path: '/clients' },
  { label: 'משימות',     icon: '✅', path: '/tasks' },
  { label: 'לוח שנה',   icon: '📅', path: '/calendar' },
  { label: 'דוחות',     icon: '📈', path: '/reports' },
  { label: 'הגדרות',    icon: '⚙️', path: '/settings' },
];
```

---

## חלק ח׳: הגדרות Tailwind CSS

```js
// tailwind.config.ts
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        primary: ['Heebo', 'Open Sans', 'sans-serif'],
      },
      borderRadius: {
        pill: '9999px',
        bubble: '50%',
        card: '12px',
        panel: '16px',
      },
      boxShadow: {
        bubble: '0 4px 20px rgba(91, 141, 184, 0.18)',
        drag:   '0 16px 48px rgba(26, 35, 50, 0.22)',
        soft:   '0 2px 8px rgba(26, 35, 50, 0.08)',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      },
      animation: {
        'card-enter':    'cardEnter 300ms ease-out',
        'task-complete': 'taskComplete 400ms ease-in forwards',
        'soft-pulse':    'softPulse 2s ease-in-out infinite',
        'ring-fill':     'progressRing 600ms ease-out forwards',
      },
      keyframes: {
        cardEnter: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        taskComplete: {
          '0%':   { opacity: '1', transform: 'scale(1)' },
          '50%':  { opacity: '0.6', transform: 'scale(1.05)' },
          '100%': { opacity: '0', transform: 'scale(0.8)' },
        },
        softPulse: {
          '0%, 100%': { boxShadow: '0 4px 20px rgba(91,141,184,0.18)' },
          '50%':       { boxShadow: '0 4px 28px rgba(91,141,184,0.35)' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
} satisfies Config;
```

---

## חלק ט׳: הנחיות RTL לקלוד קוד

### כללים ברזל ל-RTL מלא

```
1. תמיד dir="rtl" על ה-root element ועל כל קומפוננטה עצמאית
2. NEVER use margin-left / padding-left / left / right
   תמיד: margin-inline-start, padding-inline-end, inset-inline-start
3. בטייל: תמיד ms-* / me-* / ps-* / pe-* במקום ml-* / mr-*
4. flex-row נשאר flex-row — ב-RTL הוא מתהפך אוטומטית
5. text-align: start במקום text-align: right
6. border-inline-start במקום border-right (לצד הפנימי של הסרגל)
```

### דוגמת CSS Logical Properties

```css
/* ❌ לא לעשות */
.card { margin-left: 16px; padding-right: 12px; }

/* ✅ לעשות */
.card { margin-inline-start: 16px; padding-inline-end: 12px; }
```

---

## חלק י׳: תוכנית העבודה המומלצת לקלוד קוד

### שלב 1 — בסיס (יום 1)
- [ ] הוסף את קובץ `src/styles/design-tokens.css` עם כל המשתנים
- [ ] הגדר `tailwind.config.ts` עם ההרחבות
- [ ] התקן Heebo מ-Google Fonts
- [ ] הוסף `dir="rtl"` ל-`index.html` ול-`App.tsx`
- [ ] צור `src/constants/categoryColors.ts`

### שלב 2 — Layout (יום 1-2)
- [ ] בנה `AppLayout` עם סרגל צד כהה + header
- [ ] ממש React Router עם Outlet
- [ ] בנה `NavItem` עם hover animation
- [ ] וודא שכל מרווחי הניווט ב-`inline-start/end`

### שלב 3 — קומפוננטות בסיס (יום 2-3)
- [ ] `ColorPicker` — בורר 10 צבעים
- [ ] `StatusBadge` — תגיות סטטוס עם צבעים
- [ ] `ProgressBar` + `ProgressRing`
- [ ] `Avatar` — עם אות ראשונה + צבע קטגוריה
- [ ] `SidePanel` — עם אנימציית כניסה

### שלב 4 — תצוגות (יום 3-5)
- [ ] **Kanban View** — עמודות לפי סטטוס, כרטיסיות `ClientCard`
- [ ] **Canvas View** — `TaskBubble` על רקע כרטסייה
- [ ] **List View** — טבלה מינימליסטית עם צבע inline-start
- [ ] **Dashboard** — סטטיסטיקות + משימות קרובות

### שלב 5 — אינטראקטיביות (יום 5-7)
- [ ] Drag & Drop (dnd-kit) בין עמודות
- [ ] אנימציית השלמת משימה
- [ ] פאנל פרטי לקוח עם טאבים
- [ ] חיפוש + פילטר לפי צבע קטגוריה

### שלב 6 — נגישות ולטש (יום 7+)
- [ ] בדיקת כל הצבעים עם contrast ratio מינימום 4.5:1
- [ ] `focus-visible` styles לניווט מקלדת
- [ ] `prefers-reduced-motion` — כיבוי אנימציות לפי בחירה
- [ ] בדיקה מלאה ב-mobile

---

## סיכום — מה שקלוד קוד צריך לזכור

> **העיצוב הזה אומר:** "אני רואה שאת עסוקה. תני לי לארגן את הכאוס."
>
> כל צבע = לקוח מזוהה לפני קריאה.
> כל עיגול = משימה ברורה.
> כל אנימציה = אישור שהפעולה הצליחה.
> כל גוון רקע = שייכות ויזואלית מיידית.
>
> RTL הוא לא תוספת — הוא הנשמה של המערכת. כל פיקסל בונה לתוך זה מלכתחילה.
