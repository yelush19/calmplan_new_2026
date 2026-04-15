# WORKPLAN — שדרוג עמוד הבית + AyoaMiniMap
**Stage 5.9 | תאריך: 15/04/2026**

---

## רקע ומטרה

עמוד הבית של CalmPlan נסקר מחדש ביסודיות.
המטרה: הסרת כל מה שמפזר קשב, מחיקת קוד מת, תיקון כפילויות,
ושילוב AyoaMiniMap כרכיב מרכזי לניווט לפי **תחומי שירות** (לא לפי לקוחות).

עיקרון AYOA: כל בלוק בעמוד חייב להיות ממוקד, ייחודי, ובעל תפקיד אחד בלבד.

---

## קבצים מושפעים

| קובץ | תיאור שינוי |
|---|---|
| `src/pages/Home.jsx` | מחיקת קוד מת, כפילויות, החזרת רכיבים חסרים |
| `src/components/home/AyoaMiniMap.jsx` | תיקון לוגיקת קיבוץ + Drawer |
| `src/components/calendar/AdvanceWarningPanel.jsx` | ✅ תוקן: חלון 7 ימי עבודה במקום 14 קלנדריים |

---

## שינויים ב-Home.jsx

### ❌ הסר — קוד מת (לא מרונדר בשום מקום)

| מה למחוק | פירוט |
|---|---|
| `capacityKPIs` useMemo | מחושב אך לא בשימוש. מחק גם import מ-capacityEngine |
| `calmTasks` useMemo | לא מרונדר בשום מקום ב-JSX |
| `allFocusTasks` const | לא מרונדר |
| `getTabContent()` function | switch על activeTab — לא נקראת מאז הגריד 2-col |
| `activeTab` state + `setActiveTab` | כולל 4 שורות `setActiveTab` בסוף `loadData()` |
| `searchTerm` state | ה-`<Input>` לא קיים ב-JSX |
| imports לא בשימוש: `Input`, `Search`, `Eye`, `Sun`, `Moon` | מ-lucide + ui/input |

### ❌ הסר — כפילות תוכן

| מה למחוק | פירוט |
|---|---|
| `<CategoryBreakdown>` standalone (section 1.3) | מופיע פעמיים כשbyCategory פתוח |
| `byCategory` מ-FOCUS_TABS | אובייקט כולו |
| `byCategory: true` מ-openSections | |
| branch byCategory מ-`getTabCount` | |
| branch byCategory מ-`getSectionData` | |
| פילטר עמודה ימין | שנה ל: `t.key === 'today'` בלבד |
| branch byCategory בתוך ה-render של עמודה ימין | הסר, השאר רק `today` |
| import של `CategoryBreakdown` | אם לא בשימוש בשום מקום אחר |

### ✅ הוסף — רכיבים שהוסרו בטעות ב-Stage 5.8

| מה להוסיף | מיקום |
|---|---|
| `<OverdueAlert tasks={data.overdue} />` | בתוך section "היום", לפני TaskList, בתוך AnimatePresence block |
| `<AdvanceWarningPanel />` | בתחתית העמודה השמאלית, אחרי כל ה-FOCUS_TABS |

> שניהם כבר מיובאים בקובץ — אין צורך ב-import חדש.

### ✅ אל תיגעי ב

- כרטיס ברכה (section 1) — MoodCheckerInline, Battery Banner, Energy buttons, BadDayMode
- `<AyoaMiniMap tasks={data.activeTasks} />` (section 1.2)
- `TaskList` + `TaskRow` functions
- `StickyNotes` strip, `SmartNudge`, `TaskInsights`
- FOCUS_TABS עבור upcoming / events / payment
- צבעי ZERO_PANIC, `#FFFFFF`, `#E5E7EB`, `#5A9EB5`

---

## שינויים ב-AyoaMiniMap.jsx

### 1. הוסף לפני groupByClient

```js
const SERVICE_NORMALIZATION = {
  'שכר': 'payroll', 'תלושים': 'payroll', 'קליטת שכר': 'payroll',
  'payroll': 'payroll', 'salary': 'payroll', 'payroll_monthly': 'payroll',
  'מ.ע.ב': 'payroll',
  'פנסיות': 'pensions', 'קרן פנסיה': 'pensions',
  'pensions': 'pensions', 'pension_reporting': 'pensions',
  'מע"מ': 'vat', 'מעמ': 'vat', 'מקדמות מס': 'vat',
  'vat_reporting': 'vat', 'work_vat_reporting': 'vat',
  'הנהלת חשבונות': 'bookkeeping', 'ניכויים': 'bookkeeping',
  'bookkeeping': 'bookkeeping', 'bookkeeping_monthly': 'bookkeeping',
  'דוח שנתי': 'annual_report', 'דו"ח שנתי': 'annual_report',
  'מאזן': 'annual_report', 'annual_report': 'annual_report',
  'annual_financials': 'annual_report',
  'ביטוח לאומי': 'national_insurance', 'בט"ל': 'national_insurance',
  'national_insurance': 'national_insurance',
  'קליטה': 'client_onboarding', 'קליטת לקוח': 'client_onboarding',
  'client_onboarding': 'client_onboarding',
  'bookkeeping_onboarding': 'client_onboarding',
  'התאמות': 'reconciliations', 'reconciliations': 'reconciliations',
  'adjustments': 'reconciliations',
};

const LABEL_MAP = {
  payroll: 'שכר',
  pensions: 'פנסיות',
  vat: 'מע"מ',
  bookkeeping: 'הנהלת ח-ב',
  annual_report: 'דוח שנתי',
  national_insurance: 'ביטוח לאומי',
  client_onboarding: 'קליטת לקוח',
  reconciliations: 'התאמות',
  unknown: 'כללי',
};

function normalizeServiceKey(rawCategory) {
  if (!rawCategory) return 'unknown';
  const trimmed = rawCategory.trim();
  if (SERVICE_NORMALIZATION[trimmed]) return SERVICE_NORMALIZATION[trimmed];
  for (const [key, val] of Object.entries(SERVICE_NORMALIZATION)) {
    if (trimmed.startsWith(key) || key.startsWith(trimmed)) return val;
  }
  return 'unknown';
}
```

### 2. החלף groupByClient → groupByServiceDomain

```js
function groupByServiceDomain(tasks) {
  const groups = new Map();
  const unknownKeys = new Set();
  (tasks || []).forEach((task) => {
    const raw = task.category || task.service_key || task.service_group || '';
    const normalized = normalizeServiceKey(raw);
    if (normalized === 'unknown' && raw) unknownKeys.add(raw);
    if (!groups.has(normalized)) {
      groups.set(normalized, {
        normalized_key: normalized,
        label: LABEL_MAP[normalized] || 'כללי',
        tasks: [],
      });
    }
    groups.get(normalized).tasks.push(task);
  });
  if (unknownKeys.size > 0) {
    console.log('[AyoaMiniMap] Unknown service keys:', [...unknownKeys]);
  }
  return Array.from(groups.values())
    .sort((a, b) => {
      const aU = a.tasks.some(t => t.priority === 'urgent') ? 0 : 1;
      const bU = b.tasks.some(t => t.priority === 'urgent') ? 0 : 1;
      if (aU !== bU) return aU - bU;
      return b.tasks.length - a.tasks.length;
    })
    .slice(0, 9)
    .map((group, i) => ({ ...group, color: PALETTE[i % PALETTE.length] }));
}
```

### 3. עדכן useMemo
```js
// לפני:
const groups = useMemo(() => groupByClient(tasks), [tasks]);
// אחרי:
const groups = useMemo(() => groupByServiceDomain(tasks), [tasks]);
```

### 4. עדכן כותרות
```jsx
// לפני: "מפה לפי לקוחות" / "X לקוחות"
// אחרי: "מפה לפי תחומי שירות" / "X תחומים"
```

### 5. החלף drawerTasksByCategory → drawerTasksByStatus

```js
const STATUS_ORDER = [
  'not_started', 'waiting_for_materials', 'in_progress',
  'sent_for_review', 'needs_corrections', 'ready_to_broadcast',
  'reported_pending_payment', 'production_completed',
];

const drawerTasksByStatus = useMemo(() => {
  if (!selectedGroup) return {};
  const grouped = {};
  drawerTasks.forEach(task => {
    const s = migrateStatus(task.status) || 'not_started';
    if (!grouped[s]) grouped[s] = [];
    grouped[s].push(task);
  });
  return Object.fromEntries(
    STATUS_ORDER.filter(s => grouped[s]).map(s => [s, grouped[s]])
  );
}, [drawerTasks, selectedGroup]);
```

### 6. Drawer — כותרת + תת-כותרת

```jsx
// כותרת: selectedGroup?.label + ספירה
// תת-כותרת: שמות לקוחות ייחודיים בתחום (slice(0,5) + "+N")
// כרטיס task: הצג client_name מתחת ל-title
// bucket header: TASK_STATUS_CONFIG[s]?.text || s
```

---

## שינויים ב-AdvanceWarningPanel.jsx

### ✅ כבר בוצע על ידי המשתמשת

בפונקציה `computeWarnings`:
```js
// לפני:
if (daysUntil < 0 || daysUntil > 14) continue;
// אחרי:
if (daysUntil < 0 || daysUntil > 7) continue; // 7 ימי עבודה
```
> הערה: אם רוצים 7 ימי **עבודה** (לא קלנדריים), יש להוסיף לוגיקת דילוג על שישי/שבת.
> כרגע הספירה היא 7 ימים קלנדריים — לשקול לעדכן ל-workingDaysAhead().

---

## בדיקות חובה אחרי הביצוע

- [ ] Console נקי מ-warnings על `capacityKPIs`, `allFocusTasks`, `activeTab`, `searchTerm`
- [ ] `[AyoaMiniMap] Unknown service keys` — רשום מה מופיע ושלח לביקורת
- [ ] `CategoryBreakdown` לא מופיע בשום מקום בעמוד הבית
- [ ] לחיצה על עיגול ב-MiniMap → Drawer עם שם תחום (שכר / מע"מ...), לא שם לקוח
- [ ] `AdvanceWarningPanel` מופיע בתחתית עמודה שמאל (מסתיר אוטומטית אם אין דדליין)
- [ ] `OverdueAlert` מופיע בתוך section "היום" בלבד כשיש באיחור

---

## כללי עיצוב — אסור לשנות

| כלל | ערך |
|---|---|
| Background עמוד | `#F7F7F7` |
| Background כרטיסים | `#FFFFFF` + `border: 1px solid #E5E7EB` |
| Primary blue | `#5A9EB5` |
| OverdueAlert | `sky-50` / `sky-200` — **לא אדום** |
| AdvanceWarningPanel | `slate-50` + `amber-50` לחגים |
| אסור | `#FF0000`, `red-*` בשום מקום |

---

## סטטוס ביצוע

| משימה | סטטוס |
|---|---|
| AdvanceWarningPanel → 7 ימים | ✅ בוצע |
| Home.jsx — מחיקת קוד מת | ⏳ ממתין |
| Home.jsx — הסרת byCategory | ⏳ ממתין |
| Home.jsx — הוספת OverdueAlert + AdvanceWarningPanel | ⏳ ממתין |
| AyoaMiniMap — groupByServiceDomain | ⏳ ממתין |
| AyoaMiniMap — LABEL_MAP + NORMALIZATION | ⏳ ממתין |
| AyoaMiniMap — Drawer לפי סטטוס | ⏳ ממתין |
| בדיקה + console report | ⏳ ממתין |
