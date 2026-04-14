# אפיון ADHD-First — עמוד הבית CalmPlan + התאמת AYOA

> **מסמך מקצועי לפיתוח** | על בסיס ביקורת קוד מלאה של `Home.jsx` + `HOME_PAGE_SPEC.md` + `DESIGN_AUDIT_REPORT.md`

***

## 🔴 האבחנה המרכזית: למה "רשימה מקופלת" לא עובדת

הבעיה שלנה מתארת — "נכנסת לעמוד ורואה רשימה מקופלת שלא נותנת לי כלום" — היא לא באג. זה **כשל עיצוב שיטתי** שנובע מפיצ׳ר שנוסף בשלב 5.6 של הפיתוח. 

הקוד הנוכחי ב-`Home.jsx` מציג ארבע סקציות מקופלות (`collapsedSections`) עם ברירת מחדל: 
```js
const [collapsedSections, setCollapsedSections] = useState({
  today: false,      // פתוח
  upcoming: true,    // מקופל
  events: true,      // מקופל
  payment: true,     // מקופל
});
```

**עבור מוח עם ADHD קשה:** קיפול = היעלמות. מה שלא נראה — לא קיים. המשמעות: 75% מהמידע נעלם, ולאחר שנסגרת ונפתחת שוב — גם הסקציה הפתוחה לא זכורה. זה בדיוק ההפך ממה שמערכת כזו צריכה לעשות.

**הבעיה האמיתית** היא שב-Stage 5.6 הוסרה `FocusMapView` (המפה הויזואלית) מעמוד הבית, והוחלפה בלינק טקסטואלי למפה מלאה.  כך נוצר ואקום ויזואלי — אין שום תצוגת AYOA, ויש רשימות אפורות שמתקפלות.

***

## ✅ מה קיים ועובד (לא לשנות)

| רכיב | מצב | ערך |
|------|-----|-----|
| `BiologicalClockContext` — שעה ביולוגית | ✅ פעיל | מוצג בברכה |
| `MoodCheckerInline` — צ'ק-אין מצב רוח | ✅ פעיל | מחבר לרמת אנרגיה |
| `BadDayMode` | ✅ פעיל | דוחה משימות לא דחופות |
| `SmartNudge` | ✅ פעיל | nudge אחד רך מ-TaskCascade |
| `StickyNotes` — עד 3 פתקים | ✅ פעיל | ממוין לפי urgency |
| `QuickAddTaskDialog` | ✅ פעיל | כפתור + |
| `TaskSidePanel` | ✅ פעיל | עריכת משימה |
| `UndoContext` + Ctrl+Z | ✅ פעיל | Stage 5.5 |
| `capacityEngine` | ✅ פעיל | KPIs קיבולת |
| `filterByEnergy` | ✅ פעיל | סינון לפי אנרגיה |
| פלטת Zero-Panic (ללא אדום) | ✅ פעיל | `#F57C00, #7B1FA2, #2E7D32, #0288D1` |
| ברכה + הודעת יום | ✅ פעיל | לפי שעה |
| Progress bar | ✅ פעיל | התקדמות היום |



***

## 🧠 מה AYOA עושה שהרשימות לא עושות

AYOA היא מערכת ניהול משימות שנבנתה **ספציפית** לאנשים עם ADHD ועיבוד ויזואלי.  עקרונות הליבה שלה:

- **עיגולים צבעוניים** במקום שורות טקסט — הגודל מייצג דחיפות, הצבע מייצג קטגוריה
- **מפת קבוצות רדיאלית** — רואים הכל בבת אחת בלי לגלול
- **ארגון spatial** — המוח ה-ADHD מנווט במרחב טוב יותר מאשר ברשימה ליניארית
- **מגע/לחיצה על עיגול** — מחשוף את הפרטים בלי לאבד את ה"מפה"

ב-CalmPlan קיימות שתי תצוגות AYOA שלא מחוברות לדף הבית: 
- `AyoaRadialView.jsx` — מפה רדיאלית מלאה (נמצאת ב-`/MindMap`)
- `FocusMapView.jsx` — תצוגת מפה קומפקטית (הוסרה מ-Home בשלב 5.6)

***

## 🏗️ אפיון החדש — עמוד הבית ADHD-First

### עיקרון יסוד: "3 שניות להבנה"

משתמשת עם ADHD קשה צריכה להבין **מה לעשות עכשיו** תוך 3 שניות מרגע כניסה לעמוד. כל אלמנט שמאט את זה — מזיק.

### סדר עדיפויות מחדש

| עדיפות | רכיב | מה לשנות |
|--------|-------|----------|
| **1 — קריטי** | AYOA Mini-Map | להחזיר תצוגת עיגולים **מוטמעת** בעמוד (לא לינק) |
| **2 — קריטי** | "משימה אחת עכשיו" | כרטיס בולט ביותר — המשימה הדחופה ביותר להיום |
| **3 — חשוב** | פתקים דביקים | להעלות מעל הסקציות המקופלות |
| **4 — חשוב** | Uncollapse חכם | סקציות פתוחות עם תוכן, מקופלות כשריקות |
| **5 — בינוני** | כפתור "שבצי לי" | CTA בולט מוקדם בעמוד |

***

## 📐 מבנה הדף החדש — שכבה אחרי שכבה

### שכבה 1: ברכה (קיים, שמור) — ~80px

```
[ברכה + שם] [אנרגיה ביולוגית]
[Mood checker] [כפתור +חדש]
[Progress bar]
[רמת אנרגיה: ☀️ ☕ 🔋]
```

**לא לשנות.** עובד מצוין.

***

### שכבה 2: "משימה אחת עכשיו" — רכיב חדש — ~100px

**זהו הרכיב החסר הכי קריטי לאנשים עם ADHD.**

כרטיס בולט אחד עם המשימה הדחופה ביותר:

```
┌──────────────────────────────────────────────┐
│  ⚡  מה עכשיו?                                │
│                                              │
│  [שם משימה]  [שם לקוח]  [דחוף / היום]        │
│  ○ לא התחלתי   ○ בתהליך   ✓ סיימתי           │
└──────────────────────────────────────────────┘
```

**לוגיקת בחירה:**
```js
// בוחר לפי: urgent > high, ואז הקרוב ביותר לתאריך
const pickTopTask = (mergedToday, energyLevel) => {
  const filtered = filterByEnergy(mergedToday); // כבר קיים
  const sorted = sortByPriority(filtered);       // כבר קיים
  return sorted || null;
};
```

**עיצוב:**
- רקע: `#EEF6FB` (sky-50 רגוע)
- גבול שמאל: 3px בצבע `ZERO_PANIC.blue` (#0288D1)
- גופן המשימה: 16px, bold, `#1E293B`
- 3 כפתורי סטטוס גלויים — לא Select dropdown (קשה יותר לאנשי ADHD)

***

### שכבה 3: AYOA Mini-Map — רכיב חדש — ~220px

**זה הלב של האפיון.** במקום הלינק הטקסטואלי הנוכחי, להטמיע תצוגת עיגולים קומפקטית ישירות בדף.

**מה לבנות: `AyoaMiniMap.jsx`**

```jsx
// src/components/home/AyoaMiniMap.jsx
// תצוגת עיגולים קומפקטית — לא canvas מלא
// רנדור: SVG (קל, בלי תלות ב-Konva/Canvas)

function AyoaMiniMap({ tasks, clients, onTaskClick }) {
  const groups = groupByClient(tasks); // לפי client_name
  
  return (
    <div className="ayoa-mini" style={{ height: '200px', overflow: 'hidden' }}>
      <svg width="100%" height="200" viewBox="0 0 360 200">
        {groups.map((group, i) => (
          <AyoaCircle
            key={group.key}
            cx={calcX(i, groups.length)}
            cy={100}
            r={calcRadius(group.tasks.length)}  // גודל = כמות/דחיפות
            color={getBranchColor(group.key)}   // מ-DesignContext
            label={group.label}
            count={group.tasks.length}
            urgentCount={group.tasks.filter(t => t.priority === 'urgent').length}
            onClick={() => onTaskClick(group)}
          />
        ))}
      </svg>
    </div>
  );
}
```

**עיקרי העיצוב:**
- עיגולים בSVG — ללא תלות ב-canvas, קל על הרנדור
- גודל עיגול: `min(20, max(40, count * 5))` px radius
- צבע: ענפי P לפי `DesignContext.branchColors` (מחובר סוף סוף!)
- נקודה אדומה/כתומה קטנה אם יש `urgent` בקבוצה
- לחיצה → פותח Drawer עם משימות הקבוצה (לא ניווט לדף אחר)
- טקסט: שם לקוח + מספר משימות מתחת לעיגול

**RTL awareness:** עיגולים מסודרים מימין לשמאל, הראשון = הדחוף ביותר.

***

### שכבה 4: SmartNudge (קיים) — שמור

***

### שכבה 5: פתקים דביקים — להעלות מעמדה 4 ל-5

**שינוי:** להציג עד 4 פתקים (לא 3) ולהעלות אותם מעל הסקציות המקופלות.

```jsx
// לשנות: stickyNotes.slice(0, 3) → stickyNotes.slice(0, 4)
// לשנות: grid-cols-2 md:grid-cols-3 → grid-cols-2 (יותר קריא על mobile)
```

***

### שכבה 6: סקציות — לוגיקת Uncollapse חכמה

**במקום** `collapsedSections` קבועות — **uncollapse חכם:**

```js
// חדש: פתח סקציה רק אם יש בה תוכן
const smartCollapse = useMemo(() => ({
  today: false,                              // תמיד פתוח
  upcoming: data.upcoming.length === 0,     // מקופל רק כשריק
  events: data.todayEvents.length === 0,    // מקופל רק כשריק
  payment: data.payment.length === 0,       // מקופל רק כשריק
}), [data]);
```

**זמן משמעותי שחוסך:** המשתמשת לא צריכה לזכור לפתוח — הסקציות פתוחות בדיוק כשיש בהן מידע.

***

### שכבה 7: BadDayMode (קיים) — להוריד מתחת לסקציות

BadDayMode לא צריך להופיע *לפני* הסקציות. הוא מוד חירום — לכן מתחתיהן.

***

### שכבה 8: כפתור "שבצי לי את היום" — חדש

```jsx
<Button
  className="w-full gap-2 py-4"
  style={{ backgroundColor: '#5A9EB5', color: 'white' }}
  onClick={handleAutoSchedule}
>
  <Zap className="w-4 h-4" />
  שבצי לי את היום
  <span className="text-xs opacity-75">({data.totalActive} משימות ממתינות)</span>
</Button>
```

**לוגיקה בסיסית (Phase 1 — בלי אלגוריתם מלא):**
```js
const handleAutoSchedule = async () => {
  // קח את 5 המשימות הדחופות ביותר
  const top5 = sortByPriority(data.mergedToday).slice(0, 5);
  // שמור ב-localStorage כ-"היום שלי" (לא Task.update — לא ישנה דאטה)
  localStorage.setItem('calmplan_today_plan', JSON.stringify(top5.map(t => t.id)));
  // הצג confirmation card
  setShowTodayPlan(true);
};
```

*Phase 2 (עתידי): חיבור ל-`capacityEngine` + `BiologicalClockContext`.*

***

## 🎨 עיצוב — התאמות ADHD

### מה נשאר מ-Zero-Panic Palette

```js
const ZERO_PANIC = {
  orange: '#F57C00',  // דחוף — שמור
  purple: '#7B1FA2',  // איחור — שמור
  green:  '#2E7D32',  // הבית — שמור
  blue:   '#0288D1',  // עבודה — שמור
};
```

### כללי עיצוב ADHD

| עיקרון | יישום |
|--------|-------|
| **Salience** — הדחוף בולט מיד | עיגול גדול יותר + נקודה כתומה = urgent |
| **No cognitive load on empty state** | לא "לחץ כדי לראות" — הכל גלוי |
| **Chunking** | מקסימום 5 פריטים בכל קבוצה |
| **Action affordance** | 3 כפתורי סטטוס ברורים, לא dropdown |
| **Spatial memory** | AYOA mini-map — אותו מיקום תמיד |
| **RTL = Direction of priority** | ימין = הכי דחוף |

### RTL + Hebrew typography

כל הטקסטים שאמורים להיות בעברית כבר בעברית.  נקודות שחסרות:

1. **`dir="rtl"` חסר ברכיבי Badge** — חלק מה-Badges מ-Radix UI מציגים טקסט עברי ב-LTR. לתקן:
   ```jsx
   <Badge dir="rtl" ...>
   ```

2. **פונט Hebrew-friendly** — הקוד לא מציין `font-family` מפורש לעברית. להוסיף ל-`index.css`:
   ```css
   :root {
     --font-he: 'Rubik', 'Assistant', 'Heebo', system-ui, sans-serif;
   }
   body { font-family: var(--font-he); }
   ```
   Rubik ו-Assistant מיוצרים לעברית ומעולים לקריאות.

3. **גודל פונט — ADHD minimum** — טקסטים של `text-[10px]` (כגון "התקדמות היום") קטנים מדי. מינימום לאנשי ADHD: **13px**. 

***

## 🔧 בעיות טכניות לתיקון

### 1. `collapsedSections` state — לוגיקת uncollapse חכמה

ראה שכבה 6 לעיל. שינוי מינורי עם השפעה עצומה.

### 2. `TaskList` — grouped ≤5 tasks פותח ב-flat list, מעל 5 מקפל לפי לקוח 

**בעיה:** כשיש 6+ משימות, הרשימה מתקפלת לפי לקוח ו-ADHD לא יודעת מה לחפש. **פתרון:** להציג תמיד את 5 הראשונות flat + "הצג עוד X" בתחתית:

```jsx
// לא: if (tasks.length <= 5) → flat; else → grouped
// כן: תמיד flat עד 5, grouped רק אם המשתמשת בוחרת "הצג לפי לקוח"
```

### 3. `HOME_MAX_TASKS = 5` — limit נסתר 

הגבלה קיימת אבל לא ברורה למשתמשת. הוסיפי indication:
```jsx
<span className="text-xs text-slate-400">
  מוצגות {limitedItems.length} מתוך {items.length}
</span>
```

### 4. תיקון טאב "ממתין לתשלום"

הבאג הידוע: פילטר הטאב לא תופס משימות שעברו `handleStatusChange`.  הבעיה: כשמשנים סטטוס ב-`processTemplates` (עץ תהליכים), ה-state המקומי ב-Home לא מתעדכן.

**תיקון:**
```js
// handleStatusChange — לאחר Task.update:
// להוסיף בדיקת payment step בכל שינוי סטטוס:
const shouldMoveToPayment = (task, newStatus) => {
  if (newStatus === 'production_completed') {
    return task.process_steps?.payment && !task.process_steps.payment.done;
  }
  // גם: אם newStatus === 'reported_waiting_for_payment'
  if (newStatus === 'reported_waiting_for_payment') return true;
  return false;
};
```

### 5. DesignContext.branchColors — לחבר ל-Mini-Map

הצבעים קיימים ב-`DesignContext` אבל לא מחוברים לשום רכיב חוץ מ-MindMap.  ב-`AyoaMiniMap.jsx` החדש:

```js
const { branchColors } = useDesign();
// ...
color={branchColors?.[group.branchId] || '#0288D1'}
```

***

## 📋 checklist מימוש — לפי עדיפות

### Phase 1 — שינויים ללא רכיבים חדשים (שעות בודדות)

- [ ] **`collapsedSections` → `smartCollapse`** — פתח סקציה רק אם יש תוכן
- [ ] **הוסיפי "מוצגות X מתוך Y"** ב-TaskList
- [ ] **הוסיפי `dir="rtl"` ל-Badge-ים**
- [ ] **שנה font-family** ל-Rubik/Assistant ב-`index.css`
- [ ] **הגדל minimal font size** מ-10px ל-13px (`text-[10px]` → `text-[13px]`)
- [ ] **הוסיפי פתק 4** (`stickyNotes.slice(0, 4)`)
- [ ] **תיקון payment status** ב-`handleStatusChange`

### Phase 2 — רכיבים חדשים (כמה ימים)

- [ ] **`AyoaMiniMap.jsx`** — SVG עיגולים, חיבור ל-`DesignContext.branchColors`
- [ ] **"משימה אחת עכשיו"** — כרטיס קריאה לפעולה בודדת
- [ ] **3 כפתורי סטטוס** ב-TaskRow (במקום Select dropdown)
- [ ] **כפתור "שבצי לי" Phase 1** — top5 + confirmation card
- [ ] **Drawer פתיחת קבוצת עיגול** — meshimot per client

### Phase 3 — אופטימיזציה (עתידי)

- [ ] **שיבוץ אוטומטי מלא** — `capacityEngine` + `BiologicalClockContext`
- [ ] **DesignContext.cognitiveLoadLimit** — לחבר לממשק
- [ ] **אנימציית עיגול** — pulse על urgent circles
- [ ] **Haptic feedback** (mobile) — כשמסמנים משימה כהושלמה

***

## ❌ מה לא לעשות

| ❌ אסור | ✅ במקומו |
|---------|---------|
| רשימות נגללות של 30+ שורות | עיגולים + expand לפי לקוח |
| `details/summary` לקיפול | רכיבים עם visibilty חכמה |
| Dropdown לשינוי סטטוס (12 אפשרויות) | 3 כפתורים: ○ → ⟳ → ✓ |
| "לחצי כאן לראות הכל" | הכל גלוי, מקופל רק מה שריק |
| פונט מתחת ל-13px | מינימום 13px בכל טקסט |
| Shadow על cards | `border: 1px solid #E5E7EB` בלבד |
| רקע לבן על לבן (no depth) | Surface hierarchy: `#F7F7F7 → #FFFFFF → #F9FAFB` |



***

## 📊 מדד הצלחה

| מטרה | מדד |
|------|-----|
| "3 שניות להבנה" | המשתמשת יכולה לזהות המשימה הדחופה ביותר ב-3 שניות |
| ויזואליות AYOA | רואים עיגולים בפתיחת הדף, בלי לגלול |
| אין קיפולים ריקים | סקציה ריקה = מקופלת, מלאה = פתוחה |
| שינוי סטטוס ≤ 2 קליקים | כפתורי inline, לא dropdown |
| RTL נכון | כל טקסט עברי מיושר ימינה, אין badges הפוכים |