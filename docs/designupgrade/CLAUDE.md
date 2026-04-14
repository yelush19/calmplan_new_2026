# הנחיות עיצוב — מערכת CRM ליתאי ניהול חשבונאות

## זהותך בפרויקט זה

אתה המעצב הבכיר של מערכת CRM עבור עסק חשבונאות ישראלי.
המשתמשת הראשית היא אישה עם קשב, המנהלת 30+ לקוחות במקביל מהבית.
**כל החלטה עיצובית שלך נובעת מהשאלה:** האם זה מפחית עומס קוגניטיבי או מגביר אותו?

---

## כללי ברזל — אי פעם תפר אותם

### RTL
- תמיד `dir="rtl"` על כל קומפוננטה ועל `index.html`
- **אסור לחלוטין:** `margin-left`, `padding-left`, `left:`, `right:`, `ml-`, `mr-`, `pl-`, `pr-`
- **חובה תמיד:** `margin-inline-start`, `padding-inline-end`, `ms-`, `me-`, `ps-`, `pe-`
- `inset-inline-start` / `inset-inline-end` — לא `left` / `right`
- `border-inline-start` — לא `border-left`
- `text-align: start` — לא `text-align: right`

### צבעים
- **אסור:** אדום בוהק (`#EF4444` ומשפחתו) כצבע קטגוריה — הוא מפעיל חרדה
- אדום שמור **אך ורק** לשגיאות מערכת קריטיות
- **חובה:** כל קטגוריה/לקוח מקבל צבע מהפלטה המאושרת בלבד (ראה למטה)

### טיפוגרפיה
- פונט: `Heebo` בלבד (תומך עברית מלא)
- גודל מינימום: `14px` — אף פעם לא פחות
- `line-height` מינימום: `1.5` — תמיד

### צורות
- אין זוויות חדות — `border-radius` מינימום `8px` על כל אלמנט
- כפתורים: `border-radius: 9999px` (pill) או `12px` — לא פחות
- כרטיסיות: `border-radius: 12px`

---

## מערכת הצבעים

### 10 צבעי קטגוריות — כל אחד עם שלושה גוונים

```
שם          רקע (bg)   ראשי (main)  כהה (deep)
מרווה       #F0FAF5    #74C69D      #2D8653
לבנדר       #F5F2FA    #B5A4CF      #6B4FA0
אפרסק       #FEF6EF    #F4A261      #C4622A
צהוב חמאה   #FEFCE8    #F9C74F      #A07800
תורכיז      #F0FAFA    #2EC4B6      #1A7A70
טרקוטה      #FDF2EE    #E07B54      #9A3E1E
כחול פלדה   #EFF4FA    #5B8DB8      #2A5A8A
סגול-ורוד   #FDF2F8    #D4A5C9      #8A3F74
ירוק זית    #F4F7F0    #8DB174      #4A6E35
אינדיגו     #F0F1FA    #7B8BD4      #3A4BA0
```

### שימוש נכון בצבעי קטגוריה
```
רקע כרטיסייה    → bg
גבול שמאלי      → main (4px, inline-start)
אווטר רקע       → bg + border: main
אווטר טקסט      → deep
תגית/badge       → bg + text: deep
פס התקדמות      → main
```

### צבעי מערכת (לא קטגוריות)
```
UI ראשי          #5B8DB8
UI hover         #2A5A8A
UI בהיר          #EFF4FA
סטטוס פעיל       #74C69D
סטטוס ממתין      #F9C74F
סטטוס דחוף       #E07B54  ← טרקוטה, לא אדום
סטטוס הושלם      #B0B8C1
רקע אפליקציה     #F8F9FA
רקע כרטיסייה     #FFFFFF
סרגל צד          #1E2A3A
טקסט ראשי        #1A2332
טקסט משני        #5A6A7A
טקסט מעומעם      #9AA5B4
גבול עדין        #EEF1F5
```

---

## מבנה Layout

```
[סרגל צד #1E2A3A — 224px] | [תוכן ראשי]
                              [header לבן 56px]
                              [אזור תצוגה — overflow-auto]
                                            | [פאנל צד 420px — אופציונלי]
```

### סרגל הצד
- רקע: `#1E2A3A` (כחול-כהה, לא שחור)
- טקסט: `#F0F4F8`
- פריט פעיל: רקע `rgba(255,255,255,0.10)` + גבול `inline-start` `#5B8DB8` ברוחב 3px
- hover: `rgba(255,255,255,0.06)` + הזזה של `4px` לכיוון `inline-end`

### Header עליון
- רקע לבן, `border-block-end: 1px solid #EEF1F5`
- גובה: `56px`
- מכיל: מחליף תצוגות (שמאל) + חיפוש (מרכז) + פעולות (ימין)

### פאנל צד
- נפתח מ-`inline-end` (ימין בעברית)
- רוחב: `420px`
- `z-index: 200` + overlay עדין מאחור
- אנימציה: `translateX` — מחוץ למסך → 0

---

## קומפוננטות — כיצד לבנות

### כרטיסיית לקוח
```
┌─ border-radius: 12px ─────────────────────┐
│ ║ (4px צבע קטגוריה, inline-start)         │
│  [אווטר עיגול]  שם לקוח        [סטטוס]   │
│                 שם חברה                   │
│  ══════════════════════ (פס התקדמות)      │
│  X מתוך Y משימות              תאריך       │
└───────────────────────────────────────────┘
hover: translateY(-2px) + shadow גדול יותר
```

### בועת משימה (Canvas)
```
עיגול עם SVG ring:
- רקע: bg של הקטגוריה
- טבעת חיצונית דקה: main (50% שקיפות)
- טבעת התקדמות: main (מלאה, מסתובבת מ-12 בשעון)
- גודל: 80px (נמוך) / 108px (בינוני) / 136px (גבוה)
- חשיבות גבוהה = עיגול גדול יותר
- hover: scale(1.04) + shadow-bubble
```

### תגית סטטוס
```
border-radius: 9999px
padding: 2px 10px
font-size: 11px
font-weight: 600
background: bg של הסטטוס
color: deep של הסטטוס
```

---

## אנימציות

### מה חובה לממש
```css
/* כניסת כרטיסייה */
from: opacity:0, translateY(8px)
to:   opacity:1, translateY(0)
duration: 300ms ease-out

/* השלמת משימה */
0%:   scale(1), opacity:1
50%:  scale(1.05), opacity:0.6
100%: scale(0.85), opacity:0
duration: 400ms ease-in

/* פאנל צד */
from: translateX(100%)
to:   translateX(0)
duration: 300ms ease-in-out

/* hover כרטיסייה */
translateY(-2px) + shadow גדול
duration: 200ms ease-out
```

### Timing functions
```
רגיל:   250ms ease-in-out
מהיר:   150ms ease-out
קפיצי:  300ms cubic-bezier(0.34, 1.56, 0.64, 1)
```

### חשוב
- תמיד `prefers-reduced-motion` — כשהמשתמש ביקש, כבה אנימציות
- אנימציות עדינות בלבד — לא מסחרריות

---

## טפסים וקלט

```
input / select / textarea:
  border: 1.5px solid #EEF1F5
  border-radius: 10px
  padding: 10px 14px
  font-family: Heebo
  font-size: 15px
  
  focus:
    border-color: #5B8DB8
    box-shadow: 0 0 0 3px rgba(91,141,184,0.15)
    outline: none

label:
  font-size: 13px
  font-weight: 600
  color: #5A6A7A
  margin-block-end: 6px
```

---

## כפתורים

```
ראשי (Primary):
  background: #5B8DB8
  color: white
  border-radius: 9999px
  padding: 10px 24px
  font-weight: 600
  hover: background #2A5A8A, translateY(-1px)

משני (Secondary):
  background: #EFF4FA
  color: #5B8DB8
  border-radius: 9999px
  hover: background #DBEAFE

הרס (Destructive):
  background: #FDF2EE
  color: #9A3E1E
  border-radius: 9999px
  hover: background #E07B54, color white
```

---

## מה לא לעשות — אי פעם

- ❌ `Inter`, `Roboto`, `Arial` — השתמש ב-`Heebo` בלבד
- ❌ גרדיאנטים סגולים על לבן — קלישאה של AI
- ❌ צלליות כהות וכבדות — רק עדינות
- ❌ אלמנטים ללא `border-radius`
- ❌ טקסט מתחת ל-14px
- ❌ `margin-left` / `padding-right` — כלל RTL
- ❌ אדום (`#EF4444`) לכל דבר שאינו שגיאת מערכת
- ❌ 3+ צבעים שונים באותו אלמנט
- ❌ אנימציות מהירות מ-150ms (מסחררות)
- ❌ layout ללא whitespace — תמיד נשום

---

## רשימת בדיקה לכל קומפוננטה חדשה

לפני שאתה מסיים כל קומפוננטה, עבור על זה:

- [ ] `dir="rtl"` קיים?
- [ ] אין `margin-left/right` / `padding-left/right`?
- [ ] הצבעים מהפלטה המאושרת בלבד?
- [ ] `border-radius` מינימום 8px?
- [ ] פונט Heebo?
- [ ] גודל טקסט מינימום 14px?
- [ ] hover state מוגדר?
- [ ] אנימציית כניסה קיימת?
- [ ] `prefers-reduced-motion` מטופל?
- [ ] contrast ratio עומד ב-4.5:1 לפחות?
