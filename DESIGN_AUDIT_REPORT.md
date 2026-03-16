# דוח ביקורת עיצוב — CalmPlan
### תאריך: 16.03.2026 | הוכן לפגישת מעצב

---

## 1. סיכום מנהלים

המערכת מכילה **147 קומפוננטות** ב-**86,185 שורות קוד**.
נמצאו **בעיות קריטיות** בעקביות הצבעים, הפרה של כלל "ללא צללים", וחוסר סנכרון בין מנוע העיצוב (DesignContext) לקומפוננטות בפועל.

---

## 2. בעיות קריטיות

### 2.1 הפרת כלל הברזל: "ללא צללים / טשטוש"

| סוג | כמות שימושים | רמת חומרה |
|-----|-------------|-----------|
| shadow-sm | 173 | קריטי |
| shadow-md | 73 | קריטי |
| shadow-lg | 85 | קריטי |
| shadow-xl | 33 | קריטי |
| shadow-2xl | 25 | קריטי |
| blur-sm/md | 6 | קריטי |
| **סה"כ** | **395** | |

**הערה:** קיים override גלובלי ב-`index.css` (שורות 327-330) שמנסה לבטל צללים, אך לא עובד בגלל specificity issues.

**צללים ברכיבי בסיס (ui/) — תיקון ברמת המערכת:**
- `button.jsx` שורה 13: `shadow`, `hover:shadow-md`
- `card.jsx` שורה 8: `shadow-sm`
- `badge.jsx` שורה 12: `shadow-sm`
- `sheet.jsx` שורה 29: `shadow-2xl`
- `drawer.jsx` שורה 36: `shadow-2xl`
- `dropdown-menu.jsx` שורות 39, 53: `shadow-lg`
- `alert-dialog.jsx` שורה 30: `shadow-xl`
- `popover.jsx` שורה 19: `shadow-lg`

**טשטוש (blur):** Settings.jsx, FocusMapView.jsx, AyoaRadialView.jsx, ProcessTreeFocusMap.jsx, SettingsMindMap.jsx.

**פעולה נדרשת:** להחליף את כל הצללים ב-`border` חד (למשל `border border-gray-200`).
**עדיפות:** לתקן קודם את רכיבי הבסיס (button, card, badge) — זה ישפיע על כל המערכת.

---

### 2.2 חוסר עקביות בצבעי P-branch

**שתי מערכות צבעים שונות בקוד:**

| ענף | Layout.jsx (סיידבר) | theme-constants.js | DesignContext defaults |
|-----|---------------------|-------------------|----------------------|
| P1 שכר | #00A3E0 | #00A3E0 | #00A3E0 |
| P2 הנח"ש | #B2AC88 | #4682B4 | לא מוגדר |
| P3 ניהול | #E91E63 | #F59E0B | לא מוגדר |
| P4 בית | #FFC107 | #FACC15 | לא מוגדר |
| P5 שנתי | #2E7D32 | #2E7D32 | #2E7D32 |

**בעיה:** P2 ו-P3 שונים לגמרי בין הסיידבר לקונסטנטות.
**החלטה נדרשת מהמעצב:**
- P2: #B2AC88 (חום-זהב) או #4682B4 (כחול פלדה)?
- P3: #E91E63 (ורוד) או #F59E0B (כתום-ענבר)?

---

### 2.3 DesignContext — 50% "עציץ"

מנוע העיצוב הגלובלי מחזיק 15 משתני state, אבל רק חלקם באמת משפיעים:

| פיצ'ר | מצב | הערה |
|-------|-----|------|
| theme (light/dark) | פעיל | עובד |
| automationsPaused | פעיל | עובד |
| shape / lineStyle | פעיל | רק ב-MindMap |
| branchColors | עציץ | לא מחובר ל-Kanban, טבלאות, דשבורדים |
| cognitiveLoadLimit | עציץ | מוגדר (480 דקות) אבל אף מנוע לא בודק אותו |
| glassmorphism | עציץ | לא מיושם |
| softShadows | עציץ | סותר את כלל הברזל |
| stickerMap | חלקי | רק ב-MindMap |

**פעולה נדרשת:** branchColors צריך להשפיע על כל הקומפוננטות (Kanban, טבלאות, Badge-ים).

### 2.4 צבעים קשיחים ברכיבי בסיס (ui/)

רכיבי UI בסיסיים משתמשים בצבעים hardcoded במקום CSS variables:

| קובץ | צבע | הערה |
|------|------|------|
| `input.jsx` שורה 10 | #E0E0E0 border, #4682B4 focus | למה P2 צבע ב-focus?! |
| `card.jsx` שורה 8 | #B0BEC5 border | לא חלק מהפלטה |
| `sheet.jsx` שורות 29, 36, 38 | #B0BEC5 | חוזר |
| `badge.jsx` שורות 14, 17 | #E0E0E0, #EEEEEE | לא חלק מהפלטה |
| `button.jsx` שורות 17, 20 | #E0E0E0, #EEEEEE | לא חלק מהפלטה |
| `command.jsx` | #FFFFFF, #333333 | hardcoded |
| `dialog.jsx` | #FFFFFF, #000000 | hardcoded |

**המלצה:** להגדיר CSS variables גלובליים (`--border-primary`, `--bg-card`, וכו') ולייבא.

---

## 3. בעיות חשובות

### 3.1 גרדיאנטים — שימוש מוגזם

**137 שימושים בגרדיאנטים** ברחבי המערכת.
עקב כלל "עיצוב חד" — יש להחליט: לשמור גרדיאנטים רק בכותרות/רקע ראשי, או לעבור לצבעים שטוחים.

### 3.2 טיפוגרפיה — חוסר היררכיה עקבית

| רכיב | גדלים שנמצאו | מה צריך להיות |
|------|-------------|---------------|
| כותרות עמוד | text-2xl עד text-4xl | לקבוע אחד |
| כותרות כרטיס | text-sm עד text-xl | text-base |
| תוויות שדות | text-xs עד text-sm | text-sm |
| תוכן | text-xs עד text-base | text-sm |

### 3.3 רווחים — חוסר עקביות

| רכיב | רווחים שנמצאו | המלצה |
|------|-------------|--------|
| Card padding | p-2, p-3, p-4, p-5, p-6, p-8 | p-4 אחיד |
| Section gap | gap-1, gap-2, gap-3, gap-4, gap-6 | gap-3 או gap-4 |
| Page padding | p-2 עד p-8 | p-4 sm:p-6 |

### 3.4 כרטיסים (Cards) — עיצובים שונים

נמצאו לפחות 6 סגנונות כרטיס שונים:
1. `shadow-sm border rounded-lg` — כרטיס רגיל
2. `shadow-lg rounded-xl` — כרטיס בולט
3. `shadow-2xl rounded-2xl` — כרטיס דרמטי
4. `border-2 rounded-lg` — כרטיס עם מסגרת
5. `bg-gradient-to-* rounded-xl` — כרטיס עם גרדיאנט
6. ללא צל, `border border-gray-200` — כרטיס שטוח (הנכון!)

**המלצה:** סגנון אחיד — `border border-gray-200 rounded-lg` (ללא צל).

---

## 4. מצב הסטטוסים — 3 מערכות צבע סותרות!

**בעיה קריטית:** 5 הסטטוסים המוזהבים מוגדרים ב-3 קבצים שונים עם צבעים שונים:

| סטטוס | processTemplates.js | theme-constants.js | MindMapView.jsx |
|-------|--------------------|--------------------|-----------------|
| waiting_for_materials | bg-amber-100 | #f59e0b | #FF8F00 |
| not_started | bg-slate-200 | #94a3b8 | #1565C0 (כחול!) |
| sent_for_review | bg-purple-200 | #a855f7 | #AB47BC |
| needs_corrections | bg-orange-200 | #f97316 | #F97316 |
| production_completed | bg-emerald-400 | #22c55e | #2E7D32 |

**בעיה חמורה:** `not_started` מוצג כ-slate בטבלאות, אפור ב-KPI, וכחול ב-MindMap!

**פעולה נדרשת:** מקור אמת אחד — `processTemplates.js`, וכל השאר צריכים לייבא משם.

---

## 5. RTL — בעיות ספציפיות

`dir="rtl"` מוגדר ב-Layout — טוב. אבל יש שימוש ב-`ml-*`/`mr-*`/`pl-*`/`pr-*` שצריך להפוך ל-logical properties:

| קובץ | שורה | הבעיה |
|------|------|-------|
| `dropdown-menu.jsx` | 24, 67, 78, 98, 115 | `pl-8`, `pr-2` — צריך `ps-8`, `pe-2` |
| `dropdown-menu.jsx` | 134 | `ml-auto` — צריך `ms-auto` |
| `TreatmentInput.jsx` | 452, 466, 667 | `mr-2`, `ml-2` — צריך `me-2`, `ms-2` |
| `WeeklyPlanner.jsx` | 196 | `pr-10` — צריך `pe-10` |
| `MultiStatusFilter.jsx` | 54, 66 | `mr-auto`, `ml-1` — צריך `me-auto`, `ms-1` |
| `sidebar.jsx` | 277, 421 | ml-/mr- מרובים |
| `carousel.jsx` | 124, 143 | `-ml-4`, `pl-4` — צריך `-ms-4`, `ps-4` |
| `toast.jsx` | 25 | `pr-8` — צריך `pe-8` |

**הערה חיובית:** MindMapView ו-SheetContent משתמשים נכון ב-`dir="rtl"`.

---

## 6. רספונסיביות

רוב הדפים משתמשים ב-`sm:` ו-`md:` breakpoints. בעיות ספציפיות:

| קובץ | שורה | בעיה |
|------|------|------|
| `WeeklyPlanner.jsx` | 214 | `min-w-[800px]` — לא מתאים למובייל |
| `TimeAwareness.jsx` | 83 | `min-w-[280px]` — עלול לגלוש |
| `drawer.jsx` | 41 | `w-[100px]` — רוחב קבוע |
| `sheet.jsx` | 36-38 | `w-3/4` — רחב מדי בטאבלט |

**סיידבר Layout:** מתכווץ נכון ב-mobile.

---

## 7. המלצות למעצב — סדר עדיפויות

### קריטי (לפני השקה)
1. **להגדיר פלטת צבעים אחידה** — P2 ו-P3 סותרים
2. **להסיר כל הצללים** — 395 שימושים שמפרים את כלל הברזל
3. **לסנכרן branchColors** מ-DesignContext לכל הקומפוננטות

### חשוב (שבוע הבא)
4. **לקבוע סגנון כרטיס אחיד** — border-only, ללא צל
5. **לקבוע היררכיית טיפוגרפיה** — 4 רמות מוגדרות
6. **לנקות גרדיאנטים מיותרים** — לשמור רק בכותרות

### שיפור (בהמשך)
7. **להפוך ml/mr ל-ms/me** — תאימות RTL מלאה
8. **לחבר cognitiveLoadLimit** — שהמנוע באמת יגביל
9. **לחבר glassmorphism toggle** — או למחוק

---

## 8. קבצי מפתח לבדיקה

| קובץ | תיאור |
|-------|--------|
| `src/contexts/DesignContext.jsx` | מנוע עיצוב גלובלי |
| `src/lib/theme-constants.js` | קונסטנטות עיצוב |
| `src/config/processTemplates.js` | סטטוסים + צבעים |
| `src/pages/Layout.jsx` | סיידבר + צבעי P-branch |
| `src/components/tasks/KanbanView.jsx` | Kanban — צריך branchColors |
| `src/components/views/MindMapView.jsx` | MindMap — היחיד שמשתמש ב-branchColors |

---

*דוח זה נוצר אוטומטית כחלק מביקורת מערכת מקיפה של CalmPlan.*
