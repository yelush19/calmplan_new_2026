# 🗺️ מדריך עבודה — שיפור עמוד הבית CalmPlan
### מסמך לנה | עודכן 15/04/2026
---

## 📍 איפה אנחנו עכשיו — Stage 5.8 הושלם

### ✅ הושלם
| Stage | מה בוצע | קבצים שנגעו |
|-------|---------|-------------|
| 5.6 | AyoaMiniMap — עיגולי SVG לפי לקוח | AyoaMiniMap.jsx |
| 5.6 | button.jsx + card.jsx עודכנו לפי CLAUDE.md | button.jsx, card.jsx |
| 5.7 | smartCollapse הוחלף ב-openSections (toggle אמיתי) | Home.jsx |
| 5.7 | 2-column grid — RTL, סקציות עם תוכן פתוחות | Home.jsx |
| 5.7 | Battery Banner, Energy buttons, BadDayMode inline | Home.jsx |
| 5.7 | ביטול FocusMapView, הוספת Mind Map link | Home.jsx |
| 5.8 | הסרת OverdueAlert + AdvanceWarningPanel מה-grid | Home.jsx |
| 5.8 | CategoryBreakdown כפול הוסר (נשאר רק ב-tab "לפי תחום") | Home.jsx |
| 5.8 | Drawer — קיבוץ לפי קטגוריה + צבעי סטטוס | AyoaMiniMap.jsx |
| 5.8 | Drawer — Attachments + Thumbnail + Popover | AyoaMiniMap.jsx |
| 5.8 | Attachments גלובלי בלוחות | GroupedServiceTable.jsx, ClientTasksTab.jsx |
| 5.8 | smartCollapse ניקוי — לא נמצאו references בקוד | — |

### ⏳ הצעד הבא — Stage 5.9
בדיקת עמידות ותיקונים קטנים מה-Stage 5.8 (ראה הנחיה למטה).

---

## 🧭 ארכיטקטורת עמוד הבית — מצב נוכחי

```
Home.jsx
├── 1. Greeting Card (שם, הודעה יומית, MoodChecker, Battery Banner)
│   ├── כפתור "חדש" + Link "מפת חשיבה"
│   └── Energy buttons + BadDayMode (inline)
│
├── 2. AyoaMiniMap — עיגולי SVG לפי לקוח
│   └── Drawer לכל לקוח:
│       ├── משימות מקובצות לפי קטגוריה
│       ├── צבעי סטטוס (TASK_STATUS_CONFIG)
│       └── 📎 Popover → TaskFileAttachments
│
└── 3. Grid 2-עמודות (RTL)
    ├── עמודה ימין (ראשית):
    │   ├── Tab "היום" (mergedToday, max 5)
    │   ├── Tab "לפי תחום" → CategoryBreakdown ✅ (נשאר כאן)
    │   ├── StickyNotes (slice 0,4)
    │   ├── SmartNudge
    │   └── TaskInsights
    └── עמודה שמאל (משנית):
        ├── Tab "3 ימים"
        ├── Tab "אירועים"
        └── Tab "ממתין לתשלום"
```

**Scope Fence קבוע — אל תיגע לעולם:**
- `App.jsx`, `pages/index.jsx`, `processTemplates.js`
- `CategoryBreakdown` — שני המקומות ב-Home נשארים
- לוגיקת SVG / groupByClient / calcX / AyoaCircle ב-AyoaMiniMap
- sort של drawerTasks

---

## 💬 הנחיה לקלוד — Stage 5.9 (בדיקת עמידות)

```
שלום קלוד.
Branch: claude/review-home-category-yH2dQ
Repo: yelush19/calmplan_new_2026

לפני שתתחיל — קרא:
1. src/components/home/AyoaMiniMap.jsx
2. src/components/tasks/TaskFileAttachments.jsx
3. src/components/dashboard/GroupedServiceTable.jsx
4. src/components/clients/ClientTasksTab.jsx

---

## Stage 5.9 — בדיקת עמידות ל-Stage 5.8

### משימה 1: DrawerContent overflow

ב-AyoaMiniMap.jsx — ודא שה-DrawerContent מקבל:
style={{ overflow: 'visible' }}

אם ה-DrawerContent מה-@/components/ui/drawer.jsx
כולל overflow-hidden קשיח — הוסף !important,
או עטוף את התוכן ב-div עם overflow:visible.

### משימה 2: stopPropagation ב-Popover

בכל PopoverTrigger שנוסף (AyoaMiniMap, GroupedServiceTable, ClientTasksTab) —
ודא שיש e.stopPropagation() ב-onClick כדי שקליק 📎
לא יסגור את ה-Drawer.

### משימה 3: Thumbnail accessibility

ב-TaskFileAttachments.jsx — ודא שה-thumbnail כולל alt="":
<img src={att.file_url} className="w-10 h-10 object-cover rounded" alt="" />

---

## Scope Fence
- אל תיגע ב-Home.jsx, App.jsx, processTemplates.js
- אל תיגע ב-CategoryBreakdown
- אל תשנה לוגיקת SVG ב-AyoaMiniMap

## דו"ח בסיום
1. האם overflow:visible תקין?
2. האם stopPropagation קיים בכל 3 הקבצים?
3. האם alt="" קיים ב-thumbnail?
4. האם יש PR פתוח ל-branch?
```

---

## 🚀 Stage 6.0 — מה אחרי (לא עכשיו)

אחרי שה-Stage 5.9 מאומת ומוזג, הצעדים הבאים:

| # | פיצ'ר | קבצים צפויים |
|---|-------|-------------|
| 6.1 | 3 כפתורי סטטוס inline בכרטיסיית משימה (במקום dropdown) | TaskRow.jsx / רכיב חדש |
| 6.2 | כפתור "שבצי לי את היום" — AI-assisted scheduling | Home.jsx + API |
| 6.3 | Drag & Drop סדר עדיפויות בHome | Home.jsx |
| 6.4 | Notification center — תגובה לאירועים בזמן אמת | AppContext / WebSocket |

---

## 🔍 Checklist בדיקה ידנית לאחר כל Stage

פתחי את האפליקציה ובדקי:

- [ ] AyoaMiniMap מציג עיגולים לפי לקוח
- [ ] לחיצה על עיגול → Drawer נפתח
- [ ] Drawer מציג משימות מקובצות לפי קטגוריה
- [ ] כרטיסיות בצבעי סטטוס (לא לבן אחיד)
- [ ] 📎 פותח Popover (לא ניווט)
- [ ] Popover לא נחתך מהDrawer (overflow visible)
- [ ] Thumbnail מוצג לתמונות ב-Attachments
- [ ] CategoryBreakdown קיים בtab "לפי תחום" (עמודה ימין)
- [ ] CategoryBreakdown לא מופיע מעל ה-grid (הוסר)
- [ ] OverdueAlert + AdvanceWarningPanel לא מופיעים ב-grid

---

## 📁 קבצי אפיון רלוונטיים

| קובץ | תוכן |
|------|------|
| `docs/designupgrade/אפיון ADHD-First.md` | אפיון מלא UX/UI |
| `docs/designupgrade/WORK_GUIDE.md` | מדריך ישן (Phase 1-2) |
| `docs/PerPl-Upgrade/WORK_GUIDE.md` | **המסמך הזה** — מעודכן |

---

*Branch פעיל: `claude/review-home-category-yH2dQ`*
*עודכן: 15/04/2026 | Stage 5.8 ✅*
