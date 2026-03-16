# אפיון מודול מאזן לביקורת — CalmPlan

## רקע
כיום העבודה על מאזנים לביקורת מתבצעת באקסל עם מספר גליונות, נספחים וביאורים.
המודול החדש יחליף את תהליך העבודה באקסל ויאפשר ניהול מלא בתוך CalmPlan.

---

## מבנה המודול

### 1. יישות BalanceSheet (קיים — להרחבה)

**שדות קיימים:**
- `client_name`, `client_id`, `tax_year`
- `current_stage` (שלב נוכחי בתהליך)
- `target_date`, `folder_link`, `notes`

**שדות חדשים להוספה:**
- `worksheets[]` — מערך גליונות עבודה (מחליף את גליונות האקסל)
- `appendices[]` — נספחים (נספח א', ב', ג'...)
- `notes_biaurim[]` — ביאורים לדוחות כספיים
- `trial_balance_data` — נתוני מאזן בוחן
- `adjustments[]` — פקודות תיקון/התאמה
- `auditor_comments[]` — הערות רואה חשבון
- `version_history[]` — היסטוריית גרסאות

### 2. גליונות עבודה (Worksheets)

כל גליון עבודה מייצג נייר עבודה (כמו גליון באקסל):

```javascript
worksheet = {
  id: string,
  title: string,           // "התאמת בנק", "לקוחות", "ספקים", etc.
  type: 'reconciliation' | 'schedule' | 'analysis' | 'custom',
  account_code: string,    // קוד חשבון בהנה"ח

  // נתונים
  opening_balance: number, // יתרת פתיחה
  closing_balance: number, // יתרת סגירה
  book_balance: number,    // יתרה לפי ספרים
  audit_balance: number,   // יתרה לביקורת
  difference: number,      // הפרש (חושב אוטומטית)

  // שורות פירוט
  rows: [{
    description: string,
    date: string,
    reference: string,     // מספר אסמכתה
    debit: number,
    credit: number,
    notes: string,
  }],

  // מצב
  status: 'draft' | 'in_review' | 'approved' | 'needs_fix',
  reviewed_by: string,
  review_date: string,

  // קבצים מצורפים
  attachments: [{
    file_url: string,
    file_name: string,
    file_size: number,
  }],

  notes: string,
  sort_order: number,
}
```

**גליונות ברירת מחדל (תבנית):**
1. מאזן בוחן
2. התאמת בנק
3. התאמת כרטיסי אשראי
4. לקוחות — פירוט יתרות
5. ספקים — פירוט יתרות
6. מלאי
7. רכוש קבוע ופחת
8. הפרשות (חופשה, הבראה, פיצויים)
9. הלוואות
10. הון ועודפים

### 3. נספחים (Appendices)

```javascript
appendix = {
  id: string,
  code: string,           // "א", "ב", "ג" or "A", "B", "C"
  title: string,          // "נספח א' — פירוט רכוש קבוע"
  content_type: 'table' | 'text' | 'mixed',

  // לנספח טבלאי
  columns: [{ key, label, type: 'text'|'number'|'date' }],
  rows: [{ [key]: value }],

  // לנספח טקסטואלי
  content: string,        // rich text / markdown

  attachments: [],
  sort_order: number,
}
```

### 4. ביאורים (Notes to Financial Statements)

```javascript
biur = {
  id: string,
  number: number,         // מספר ביאור (1, 2, 3...)
  title: string,          // "מדיניות חשבונאית", "רכוש קבוע", etc.
  content: string,        // תוכן הביאור (rich text)

  // קישור לגליון עבודה
  linked_worksheet_id: string | null,

  // טבלאות בתוך הביאור
  tables: [{
    title: string,
    columns: [{ key, label, type }],
    rows: [{ [key]: value }],
  }],

  // השוואה לשנה קודמת
  prior_year_values: {},
  current_year_values: {},

  status: 'draft' | 'final',
  sort_order: number,
}
```

**ביאורים סטנדרטיים (תבנית):**
1. כללי — פעילות החברה
2. מדיניות חשבונאית עיקרית
3. מזומנים ושווי מזומנים
4. לקוחות
5. מלאי
6. רכוש קבוע, נטו
7. ספקים ונותני שירותים
8. הלוואות לזמן קצר
9. הלוואות לזמן ארוך
10. זכויות עובדים
11. הון מניות
12. הכנסות
13. עלות המכירות
14. הוצאות הנהלה וכלליות
15. הוצאות מימון
16. מיסים על הכנסה
17. אירועים לאחר תאריך המאזן

---

## ממשק משתמש

### תצוגה ראשית — דשבורד מאזן לקוח

```
┌─────────────────────────────────────────────────┐
│  מאזן לביקורת — [שם לקוח] — שנת מס 2025       │
│  שלב: עריכה לביקורת  [=====>        ] 60%       │
├──────────┬──────────────────────────────────────┤
│ ניווט    │  תוכן (גליון/נספח/ביאור נבחר)       │
│          │                                      │
│ גליונות  │  ┌─────────────────────────────────┐ │
│ ▸ בנק    │  │  התאמת בנק — בנק לאומי          │ │
│ ▸ לקוחות │  │                                  │ │
│ ▸ ספקים  │  │  יתרה לפי ספרים: 145,230        │ │
│ ▸ מלאי   │  │  יתרה לפי בנק:   148,500        │ │
│ ▸ פחת    │  │  הפרש:            -3,270         │ │
│          │  │                                  │ │
│ נספחים   │  │  פירוט:                          │ │
│ ▸ נספח א │  │  ┌──────┬────────┬───────┐       │ │
│ ▸ נספח ב │  │  │ תאריך│ תיאור  │ סכום  │       │ │
│          │  │  ├──────┼────────┼───────┤       │ │
│ ביאורים  │  │  │12/25 │ צ'ק... │ 2,500 │       │ │
│ ▸ ביאור 1│  │  │12/25 │ העב... │   770 │       │ │
│ ▸ ביאור 2│  │  └──────┴────────┴───────┘       │ │
│          │  │                                  │ │
│ [+חדש]   │  │  📎 קבצים: אישור יתרה.pdf       │ │
│          │  └─────────────────────────────────┘ │
├──────────┴──────────────────────────────────────┤
│  [ייצוא PDF]  [ייצוא Excel]  [שלח לרו"ח]       │
└─────────────────────────────────────────────────┘
```

### תכונות UI

1. **ניווט צדדי** — עץ גליונות/נספחים/ביאורים עם drag & drop לסידור
2. **עריכה inline** — עריכת שורות טבלה ישירות (כמו אקסל)
3. **חישוב אוטומטי** — סכומים, הפרשים, סה"כ
4. **השוואה שנה קודמת** — עמודות שנה נוכחית מול שנה קודמת
5. **סימון סטטוס** — כל גליון/נספח/ביאור עם סטטוס (טיוטה/בבדיקה/מאושר)
6. **הערות רו"ח** — אפשרות לסמן הערות ושאלות בכל רמה
7. **קבצים מצורפים** — צירוף אסמכתאות לכל גליון
8. **ייצוא** — ייצוא לאקסל/PDF מוכן לרו"ח
9. **תבניות** — שמירת מבנה כתבנית לשנים הבאות
10. **העתקה משנה קודמת** — העתקת מבנה + יתרות פתיחה מהשנה הקודמת

---

## תהליך עבודה

```
שלב 1: יצירת מאזן חדש לשנת מס
  ↓ (אוטומטי: יצירת גליונות מתבנית)
שלב 2: פעולות סגירה
  ↓ (מילוי גליונות עבודה, התאמות)
שלב 3: עריכה לביקורת
  ↓ (הכנת נספחים וביאורים)
שלב 4: שליחה לרו"ח
  ↓ (ייצוא + שליחה)
שלב 5: שאלות רו"ח
  ↓ (תיקונים, השלמות)
שלב 6: חתימה והגשה
```

---

## שילוב עם מערכת קיימת

### חיבור ל-BalanceSheets.jsx
- הוספת כפתור "פתח מאזן מלא" בכרטיס מאזן קיים
- ניווט לעמוד חדש `BalanceSheetWorkbook` עם client_id + tax_year

### חיבור ל-Tasks
- יצירת משימות אוטומטית מתבניות (כבר קיים)
- קישור גליונות עבודה למשימות

### חיבור ל-ClientFiles
- קבצים מצורפים נשמרים ב-FileMetadata
- נגישים גם מעמוד קבצי לקוח

### חיבור ל-ProcessTree
- שלבי המאזן מוגדרים ב-companyProcessTree (P5 branch)
- sub_steps מאפשרים פירוט תת-שלבים

---

## מודל נתונים — Entity חדש

```javascript
// BalanceSheetWorkbook — entity חדש
{
  id: string,
  client_id: string,
  client_name: string,
  tax_year: string,
  balance_sheet_id: string,  // קישור ל-BalanceSheet entity

  worksheets: Worksheet[],
  appendices: Appendix[],
  notes_biaurim: Biur[],
  adjustments: Adjustment[],

  // סיכום
  total_assets: number,
  total_liabilities: number,
  equity: number,
  net_income: number,

  // מטא
  template_id: string,      // תבנית ממנה נוצר
  created_from_prior: string, // ID של שנה קודמת
  status: 'active' | 'submitted' | 'signed',
  last_updated: string,
}
```

---

## פקודות התאמה (Adjustments)

```javascript
adjustment = {
  id: string,
  number: number,          // מספר רץ
  description: string,
  date: string,
  entries: [{
    account_code: string,
    account_name: string,
    debit: number,
    credit: number,
  }],
  type: 'audit' | 'reclassification' | 'tax',
  status: 'draft' | 'approved',
  linked_worksheet_id: string,
  notes: string,
}
```

---

## עדיפויות מימוש

### שלב א' (MVP)
1. עמוד BalanceSheetWorkbook עם ניווט צדדי
2. גליונות עבודה בסיסיים (טבלה עם שורות)
3. נספחים טבלאיים
4. ביאורים (rich text)
5. חישוב אוטומטי של סכומים
6. צירוף קבצים
7. ייצוא ל-Excel

### שלב ב'
1. תבניות ביאורים סטנדרטיים
2. העתקה משנה קודמת
3. פקודות התאמה
4. הערות רו"ח + מעקב
5. השוואה לשנה קודמת

### שלב ג'
1. ייצוא PDF מעוצב
2. שליחה ישירה לרו"ח
3. חתימה דיגיטלית
4. אינטגרציה עם תוכנות הנה"ח

---

## קבצי מימוש מרכזיים

| קובץ | תפקיד |
|------|--------|
| `src/pages/BalanceSheetWorkbook.jsx` | עמוד ראשי חדש |
| `src/components/balance/WorksheetEditor.jsx` | עורך גליון עבודה |
| `src/components/balance/AppendixEditor.jsx` | עורך נספחים |
| `src/components/balance/BiurEditor.jsx` | עורך ביאורים |
| `src/components/balance/AdjustmentEditor.jsx` | עורך פקודות התאמה |
| `src/components/balance/ExportTools.jsx` | כלי ייצוא |
| `src/config/balanceWorkbookTemplates.js` | תבניות ברירת מחדל |

---

*מסמך זה מהווה אפיון ראשוני למודול מאזן לביקורת. המימוש יבוצע בשלבים לפי סדר העדיפויות.*
