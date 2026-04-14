# 🗺️ מדריך עבודה — שיפור עמוד הבית CalmPlan
### מסמך לנה | עודכן 14/04/2026
---

## 📍 איפה אנחנו עכשיו

✅ button.jsx — עודכן (commit 516a006)  
✅ card.jsx — עודכן (commit 516a006)  
✅ כל קבצי האפיון — הועלו ל-Git  
⏳ Home.jsx Phase 1 — הצעד הבא  
⏱️ AyoaMiniMap.jsx — אחרי Phase 1  

---

## 🧭 מה השינויים האמיתיים ולמה (הסבר אנושי)

**הבעיה שראית:** נכנסת לעמוד → רואה רשימות מקופלות → לא יודעת מה לעשות.

**למה זה קרה:** בשלב 5.6 הפיתוח הוסרה המפה הויזואלית (עיגולים) ובמקומה שמו לינק טקסטואלי.  
גם הוגדר ברירת מחדל שסקציות יהיו *תמיד* מקופלות — גם כשיש בהן תוכן.

**מה נתקן:** 3 דברים עיקריים —
1. סקציות ייפתחו *אוטומטית* כשיש בהן תוכן
2. יוחזרו עיגולים ויזואליים לדף (AYOA Mini-Map)  
3. יוצג כרטיס "משימה אחת עכשיו" בראש הדף

---

## 📋 Phase 1 — מה קלוד יעשה בשיחה הבאה

**⏱️ זמן משוער: 1-2 שעות פיתוח**

| # | שינוי | קובץ | מה זה אומר בפועל |
|---|-------|------|-----------------|
| 1 | smartCollapse | Home.jsx | סקציה עם תוכן = פתוחה. ריקה = מקופלת |
| 2 | "מוצגות X מתוך Y" | Home.jsx | תמיד תדעי כמה משימות יש |
| 3 | dir="rtl" ל-Badges | Home.jsx | טקסט עברי לא יהיה הפוך |
| 4 | פונט עברי | index.css | Rubik/Assistant במקום ברירת מחדל |
| 5 | גופן מינימום 13px | Home.jsx | text-[10px] → text-[13px] |
| 6 | פתק 4 | Home.jsx | slice(0,3) → slice(0,4) |
| 7 | תיקון payment | Home.jsx | לשלם לא ייעלם מהרשימה |

**מה קלוד לא יעשה:** לא יגע ב: BiologicalClockContext, BadDayMode, MoodChecker, UndoContext, capacityEngine, filterByEnergy — אלה עובדים ✅

---

## 💬 פרומפט פתיחת שיחה — העתיקי כולו

```
אנחנו עובדות על CalmPlan — CRM לחשבאית עם ADHD.

הקשר:
- button.jsx + card.jsx עודכנו לפי CLAUDE.md (commit 516a006) ✅
- כל קבצי האפיון ב-docs/designupgrade/

המשימה — Phase 1 בלבד:
תקראי את הקובץ src/components/Home.jsx ואת docs/designupgrade/אפיון ADHD-First.md

בצעי רק את 7 השינויים האלה — אל תיצרי קבצים חדשים:

1. collapsedSections → smartCollapse:
   const smartCollapse = useMemo(() => ({
     today: false,
     upcoming: data.upcoming.length === 0,
     events: data.todayEvents.length === 0,
     payment: data.payment.length === 0,
   }), [data]);

2. הוסיפי "מוצגות X מתוך Y" ב-TaskList

3. הוסיפי dir="rtl" לכל רכיבי Badge

4. הוסיפי ל-index.css:
   :root { --font-he: 'Rubik', 'Assistant', system-ui, sans-serif; }
   body { font-family: var(--font-he); }

5. שני text-[10px] → text-[13px]

6. stickyNotes.slice(0, 3) → stickyNotes.slice(0, 4)

7. תיקון payment: הוסיפי shouldMoveToPayment בתוך handleStatusChange

אחרי הביצוע — הצגי רשימת השינויים שביצעת בלבד.
לא לגעת ב: BiologicalClockContext, BadDayMode, MoodChecker, UndoContext, capacityEngine.
```

---

## 💬 הנחיה לאמצע השיחה — כשקלוד מציע יותר מדי

אם קלוד מתחיל לכתוב קבצים חדשים או להציע AyoaMiniMap בשיחה הזו — כתבי לו:

```
עצור. Phase 1 בלבד.
AyoaMiniMap ו"משימה אחת עכשיו" הם Phase 2 — שיחה נפרדת.
תסיים רק את 7 השינויים ברשימה.
```

---

## 💬 הנחיה לסיום שיחה — לפני שמאשרת commit

לפני שלוחצת אישור — בדקי שקלוד ענה על כל אלה:

```
לפני שאני מאשרת — תענה:
1. האם שינית collapsedSections? הצג את הקוד החדש.
2. האם נגעת ב-BiologicalClockContext? (תשובה צריכה להיות: לא)
3. האם יצרת קובץ חדש? (תשובה צריכה להיות: לא)
4. מה גודל הפונט המינימלי עכשיו?
```

---

## 🚀 Phase 2 — מה אחרי (שיחה נפרדת!)

**לא עכשיו.** רק אחרי שה-Phase 1 מאומת ועובד.

מה יבוא ב-Phase 2:
- `AyoaMiniMap.jsx` — עיגולים SVG לפי לקוח
- כרטיס "משימה אחת עכשיו"
- 3 כפתורי סטטוס inline (במקום dropdown)
- כפתור "שבצי לי את היום"

---

## 🔍 איך לבדוק שה-Phase 1 עבד

פתחי את האפליקציה ובדקי:

- [ ] סקציות עם משימות — פתוחות אוטומטית
- [ ] מתחת לרשימת משימות כתוב "מוצגות X מתוך Y"
- [ ] פונט עברי נראה יותר עגול/קריא (Rubik)
- [ ] אין טקסטים קטנטנים מתחת ל-13px
- [ ] רואה 4 פתקים דביקים (לא 3)
- [ ] שינוי סטטוס לתשלום → מופיע בטאב הנכון

---

*האפיון המלא: `docs/designupgrade/אפיון ADHD-First.md`*  
*מסמך זה: `docs/designupgrade/WORK_GUIDE.md`*
