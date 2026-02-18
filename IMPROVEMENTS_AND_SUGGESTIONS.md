# CalmPlan - שיפורים והצעות

> נבדק: 2026-02-17 | סקירה מקיפה של הפרויקט כולו
> נקודת מבט: מתכנת בכיר + בודק QA + מומחה ADHD-UX

---

## תוכן עניינים

1. [באגים קריטיים - לתקן מיידית](#1-באגים-קריטיים)
2. [בעיות נתונים ושלמות מידע](#2-בעיות-נתונים)
3. [סטטוסים ואחידות](#3-סטטוסים-ואחידות)
4. [ביצועים](#4-ביצועים)
5. [UX/ADHD - שיפורים](#5-ux-adhd)
6. [פיצ'רים חסרים או שבורים](#6-פיצרים-חסרים)
7. [אבטחה](#7-אבטחה)
8. [ארכיטקטורה וקוד](#8-ארכיטקטורה)
9. [ניקיון ותחזוקה](#9-ניקיון)
10. [המלצות לטווח ארוך](#10-טווח-ארוך)

---

## 1. באגים קריטיים

### 1.1 functions.js תמיד כותב ל-localStorage, לא ל-Supabase
**חומרה: קריטי**
`src/api/functions.js` מייבא ישירות מ-`localDB` במקום מ-`base44Client`.
כל פעולות הסנכרון עם Monday, גיבוי חירום, ו-seedData כותבים ל-localStorage
גם כש-Supabase מוגדר. הנתונים לא מגיעים ל-Supabase!

**תיקון:** שנה את `import { entities, exportAllData, clearAllData } from './localDB'`
ל-`import { entities, exportAllData, importAllData } from './base44Client'`

### 1.2 לוח שנה מס 2026 הרדקודד
**חומרה: קריטי (יפסיק לעבוד ב-2027)**
`src/config/taxCalendar2026.js` מחשב מראש רק את 2026.
ב-2027 כל התאריכים יהיו שגויים.

**תיקון:** הפוך את הפונקציה לדינאמית - `getTaxCalendar(year)` במקום קובץ סטטי.

### 1.3 `issue` ו-`issues` - מפתחות כפולים ב-STATUS_CONFIG
**חומרה: גבוה**
`src/config/processTemplates.js` שורות 490-491 מגדיר שני מפתחות עם אותה תווית.
משימות עם `status: 'issues'` עשויות להתנהג שונה ממשימות `status: 'issue'`.

**תיקון:** בחר אחד (מומלץ `issue`), מחק את השני, ועדכן בכל ה-DB.

### 1.4 Inspiration.jsx - לולאת טעינה אינסופית
**חומרה: גבוה**
כשלוחצים על כפתור ההמלצות, `setIsLoading(true)` נקרא אבל `InvokeLLM`
תמיד מחזיר שגיאה, ו-`setIsLoading(false)` לא נקרא בנתיב השגיאה.
התוצאה: ספינר טעינה אינסופי.

### 1.5 SystemConfig.list(null, 50) - הגבלה מסוכנת
**חומרה: בינוני-גבוה**
כל קבצי הקונפיגורציה (automationRules, platformConfig, balanceSheetTemplates)
קוראים `SystemConfig.list(null, 50)`. אם יש יותר מ-50 רשומות config,
הרשומות יחסרו בשקט ויווצרו כפילויות.

**תיקון:** השתמש ב-`SystemConfig.filter({ config_key: 'xxx' })` במקום list + find.

---

## 2. בעיות נתונים

### 2.1 TaxReport פיצול לפי שנה
`TaxReport`, `TaxReport2025`, `TaxReport2024` - שלושה entities נפרדים.
בכל שנה צריך להוסיף עוד entity ידנית. לא סקלבילי.

**תיקון:** Entity אחד `TaxReport` עם שדה `year` + filter לפי שנה.

### 2.2 supabaseDB.filter() - סריקה מלאה
כל `filter()` טוען עד 10,000 רשומות לזיכרון ומסנן ב-JS.
עבור טבלת tasks גדולה זה איטי ובזבזני.

**תיקון:** השתמש ב-PostgREST JSONB filtering של Supabase:
`supabase.from('app_data').select('*').eq('data->status', 'completed')`

### 2.3 update() - מרוץ תהליכים
`supabaseDB.update()` עושה read-then-write (שני קריאות נפרדות).
שני tabים פתוחים עלולים לדרוס שינויים אחד של השני.

### 2.4 restoreFromBackupSnapshot - שחזור לא מלא
פונקציית השחזור עושה `importAllData` (merge) ולא מוחקת נתונים קיימים.
רשומות ישנות שנמחקו לפני הגיבוי יישארו אחרי השחזור.

**תיקון:** הוסף `clearAllData()` לפני השחזור (עם אישור מהמשתמש).

### 2.5 seedDemoData.js תמיד כותב ל-localStorage
אותה בעיה כמו functions.js - מייבא ישירות מ-localDB.

### 2.6 backup כולל את עצמו
`exportAllData()` כולל את ה-`backup_snapshots` collection.
כל גיבוי יומי חדש גדל כי הוא מכיל את כל הגיבויים הקודמים.

**תיקון:** סנן `backup_snapshots` מתוך `exportAllData()`.

---

## 3. סטטוסים ואחידות

### 3.1 statusConfig מוגדר 7 פעמים!
הגדרות סטטוס שונות קיימות בקבצים הבאים:
- `processTemplates.js` - STATUS_CONFIG (הגרסה "הרשמית")
- `Home.jsx` - statusColors
- `Tasks.jsx` - statusConfig
- `WeeklySummary.jsx` - statusConfig
- `Reconciliations.jsx` - statusConfig
- `Collections.jsx` - statusConfig
- `PeriodicSummaryReports.jsx` - STATUS_OPTIONS

הצבעים, התוויות והמפתחות **לא אחידים** בין הקבצים.

**תיקון:** מקור אמת יחיד - `processTemplates.js` STATUS_CONFIG.
כל שאר הקבצים יייבאו משם. PeriodicSummaryReports ישתמש ב-subset.

### 3.2 ALL_SERVICES - התנגשות שמות
`automationRules.js` מייצא `ALL_SERVICES` כ-map פשוט `{ key: label }`.
`processTemplates.js` מייצא `ALL_SERVICES` כ-map עשיר `{ key: { label, steps, dashboard } }`.
שתי הגדרות שונות עם אותו שם!

**תיקון:** שנה את automationRules לייצא `SERVICE_LABELS` במקום `ALL_SERVICES`.

### 3.3 masav_authorities חסר
`masav_authorities` מופיע ב-`TASK_BOARD_CATEGORIES` אבל לא ב-`ALL_SERVICES`.
אוטומציות שמחפשות את השירות הזה לא ימצאו אותו.

### 3.4 Monday status mapping - "תקוע" שבור
`mondayClient.js` ממפה "תקוע" ל-`status: 'stuck'`, אבל `STATUS_CONFIG`
לא מגדיר סטטוס `stuck`. משימות כאלה יוצגו ללא צבע/תווית.

---

## 4. ביצועים

### 4.1 אין cache גלובלי
כל עמוד טוען את כל הנתונים מאפס. ניווט Home -> Tasks -> Home
מפעיל 3 fetch מלאים. אין React Query, SWR, או Context.

**המלצה:** הוסף `react-query` (TanStack Query) עם staleTime של 2 דקות.
זה ישפר דרמטית את מהירות הניווט בין עמודים.

### 4.2 StickyNotes נטען פעמיים
`StickyNotes` מרונדר גם ב-Layout sidebar וגם ב-Calendar/Home,
כל instance טוען את הנתונים מחדש מה-DB.

### 4.3 framer-motion על רשימות גדולות
`AnimatePresence` + `motion.div` על כל כרטיס משימה ברשימות של 100+ פריטים.
זה יוצר overhead משמעותי ב-rendering.

**המלצה:** השתמש ב-animations רק על 20 הפריטים הראשונים, או החלף ל-CSS transitions.

### 4.4 Tasks.jsx - חישוב תאריך בזמן טעינת מודול
`const now = new Date()` מחושב בזמן טעינת המודול (לא בתוך component).
אחרי חצות, ה-"היום" שגוי עד רענון מלא של הדף.

### 4.5 Google Fonts נטען עם @import בתוך style tag
גורם ל-FOUC (Flash Of Unstyled Content). צריך להעביר ל-`<link>` ב-index.html.

---

## 5. UX/ADHD - שיפורים

### 5.1 עקביות פעולות הרסניות
40+ שימושים ב-`window.confirm()` לפעולות מסוכנות.
זה חסום על ידי חלק מהדפדפנים, ולא ADHD-friendly (קופץ ונעלם מהר).

**המלצה:** החלף ל-`AlertDialog` של shadcn/ui עם:
- צבע אדום ברור לכפתור המחיקה
- 3 שניות השהיה לפני שהכפתור הופך ללחיץ
- טקסט ברור של מה עומד להימחק

### 5.2 Toast notifications לא בשימוש
`<Toaster />` מותקן ב-App.jsx אבל רוב העמודים מציגים הצלחה/שגיאה
דרך state מקומי או console.error בלבד. המשתמש לא יודע מה קרה.

**המלצה:** שימוש עקבי ב-`toast.success('נשמר!')` ו-`toast.error('שגיאה')`
בכל פעולת שמירה/מחיקה/עדכון.

### 5.3 אין 404 route
ניווט לכתובת לא קיימת מפנה בשקט ל-Calendar. המשתמש לא מבין מה קרה.

**המלצה:** הוסף דף 404 ברור עם "העמוד לא נמצא" + לינק לדף הבית.

### 5.4 MealPlanner לא שומר
כל התכנון האוכל השבועי נמחק בניווט מהעמוד. מתסכל במיוחד ל-ADHD.

**תיקון:** שמור ל-DB (entity חדש `MealPlan`) או לפחות ל-localStorage.

### 5.5 חיפוש גלובלי חסר
אין חיפוש שחוצה את כל המערכת (לקוחות + משימות + לידים + אירועים).
ל-ADHD, לחפש במקום אחד הרבה יותר קל מלנווט בין עמודים.

**המלצה:** הוסף Command Palette (כבר יש `cmdk` כ-dependency!)
עם `Ctrl+K` לחיפוש גלובלי.

### 5.6 עמודים חבויים בניווט
9+ עמודים עם routes קיימים אבל לא בתפריט הצד:
- Analytics - ניתוח נתונים
- TaskMatrix - מטריצת אייזנהאואר
- BusinessHub - מרכז עסקי
- Recommendations - המלצות שבועיות
- Roadmap - מפת דרכים
- Collections - גביות
- WeeklyPlanner - מתכנן שבועי
- MondayIntegration - סנכרון Monday.com
- NewEvent - אירוע חדש

**המלצה:** הוסף לתפריט או מחק. עמודים חבויים = בזבוז.

### 5.7 חסר "מספר badge" בתפריט
התפריט הצדדי לא מראה כמה משימות/לידים/התראות ממתינים.
ל-ADHD, badge אדום עם מספר הוא מוטיבציה וכיוון חזותי.

**המלצה:** הוסף badges לפריטי תפריט:
- Tasks: מספר משימות באיחור
- Leads: מספר לידים חדשים
- ClientsDashboard: אחוז התקדמות החודש

### 5.8 אין מצב "Focus Mode"
ל-ADHD, עודף מידע על המסך הוא עומס. אין אפשרות להסתיר sidebar,
לצמצם לתצוגה מינימלית, או להתמקד במשימה אחת.

**המלצה:** כפתור "מצב מיקוד" שמסתיר sidebar, sticky notes, ו-header.
מראה רק את המשימה הנוכחית + טיימר.

---

## 6. פיצ'רים חסרים או שבורים

| פיצ'ר | סטטוס | הערה |
|--------|--------|------|
| Collections / גביות | שבור | mockInvoices = [], לא עובד בכלל |
| המלצות ספרים (AI) | שבור | InvokeLLM = stub + באג infinite loading |
| ייבוא/ייצוא Excel | שבור | כל 4 הפונקציות מחזירות success: false |
| שליחת מיילים | שבור | SendEmail = stub |
| יצירת PDF | שבור | GenerateImage = stub |
| לוח שנה חגים 2025+ | שבור | רק 2024 הרדקודד ב-LifeSettings |
| MoodTracker | קיים, לא מחובר | קומפוננטה קיימת, לא מרונדרת |
| SmartNudge | קיים, לא מחובר | קומפוננטה קיימת, לא מרונדרת |
| FamilyDashboard | חסר | Entity קיים, אין UI |
| סנכרון Monday אוטומטי | חסר | רק ידני, אין webhook/cron |
| WeeklyPlanner | חלקי ~40% | אין grid שעות, אין drag-to-slot |
| Analytics / TaskSession | חלקי | אין UI ליצירת sessions |
| Print | קיים, לא נגיש | אין לינק בתפריט |
| TaskMatrix drag&drop | חלקי | אין שמירת סדר ל-DB |

---

## 7. אבטחה

### 7.1 אין אימות משתמשים
`auth.me()` מחזיר משתמש הרדקודד. כל מי שיודע את הURL יכול לגשת לכל הנתונים.

**המלצה מינימלית:** הוסף Supabase Auth עם magic link / Google login.

### 7.2 Monday.com token ב-localStorage
ה-token שמור בטקסט פתוח. כל XSS יחשוף אותו.

### 7.3 .env עם credentials
ודא ש-`.env` נמצא ב-`.gitignore`. אם ה-repo ציבורי, ה-credentials חשופים.

### 7.4 עמודי ניהול ללא הגנה
TestDataManager, EmergencyReset, SystemOverview - נגישים לכולם.
`EmergencyReset` מאפשר מחיקת כל הנתונים בלחיצה.

### 7.5 Supabase RLS
ודא שיש Row Level Security policy על טבלת `app_data`.
בלי RLS, ה-anon key מאפשר קריאה/כתיבה לכל הנתונים.

---

## 8. ארכיטקטורה וקוד

### 8.1 כפילויות קוד
- `WeeklyPlanning.jsx` ו-`TreatmentInput.jsx` - אותו קוד בדיוק
- `ServiceProviders.jsx` ו-`ServiceProvidersPage.jsx` - חופף
- `PROCESS_TEMPLATES` מוגדר גם ב-`functions.js` וגם ב-`processTemplates.js`
- Date formatting מיובא ומוגדר בכל עמוד בנפרד

**המלצה:** מחק כפילויות, צור shared helpers.

### 8.2 אין React Context / Global State
כל עמוד מנהל state עצמאי. אין שיתוף של:
- רשימת לקוחות (נטענת ב-10+ עמודים)
- רשימת משימות (נטענת ב-8+ עמודים)
- הגדרות מערכת

**המלצה:** Context provider עבור clients, tasks, settings + React Query cache.

### 8.3 אין TypeScript
הפרויקט ב-JS חוץ מ-`utils/index.ts` בודד. אין type safety על entities,
API responses, או props של components.

**המלצה לטווח ארוך:** מעבר הדרגתי ל-TypeScript. התחל עם API layer.

### 8.4 אין testing
אפס קבצי טסטים. שום דבר לא נבדק אוטומטית.

**המלצה מינימלית:** הוסף Vitest + בדיקות לפונקציות חישוב:
- `getTaskReportingMonth`
- `isBimonthlyOffMonth`
- `getDueDateForCategory`
- `STATUS_CONFIG` completeness

---

## 9. ניקיון ותחזוקה

### 9.1 console.log/console.error שנותרו
- `SystemOverview.jsx` - debug logs עם emojis
- `WeeklySummary.jsx` - שגיאות נבלעות עם console.error בלבד
- `base44Client.js` - console.log/warn on every load

### 9.2 Dependencies לא בשימוש (לבדוק)
- `input-otp` - אין OTP בשום מקום
- `next-themes` - אין dark mode
- `embla-carousel-react` - אין carousel
- `vaul` - drawer שאולי לא בשימוש

### 9.3 xlsx ב-devDependencies
`xlsx` צריך להיות ב-`dependencies` (לא `devDependencies`) אם Excel import/export
אמור לעבוד ב-production.

### 9.4 עמודים מתים
- `TreatmentInput.jsx` - אין route, לא נגיש
- `WeeklyPlanning.jsx` - אין route, כפילות

---

## 10. המלצות לטווח ארוך

### עדיפות 1 - תיקוני באגים (שבוע)
1. תקן functions.js לייבא מ-base44Client
2. תקן backup snapshot לסנן את backup_snapshots
3. מחק `issues` כפול מ-STATUS_CONFIG
4. תקן Inspiration.jsx infinite loading
5. תקן SystemConfig.list limit

### עדיפות 2 - אחידות (שבועיים)
1. איחוד statusConfig למקור יחיד
2. איחוד ALL_SERVICES naming
3. Command Palette (Ctrl+K) לחיפוש גלובלי
4. החלפת window.confirm ל-AlertDialog

### עדיפות 3 - ביצועים (חודש)
1. הוסף React Query עם caching
2. שפר supabaseDB.filter() לסינון server-side
3. הפחת animations ברשימות גדולות
4. Context provider ל-clients/tasks

### עדיפות 4 - פיצ'רים (חודשיים)
1. Collections/גביות - מימוש אמיתי
2. MoodTracker - חיבור ל-UI
3. סנכרון Monday אוטומטי
4. WeeklyPlanner - השלמה

### עדיפות 5 - ארכיטקטורה (רבעון)
1. Supabase Auth
2. מעבר ל-TypeScript
3. בדיקות אוטומטיות
4. RLS policies

---

*נוצר אוטומטית על ידי סקירת קוד מקיפה.*
