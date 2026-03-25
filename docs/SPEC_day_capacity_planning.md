# אפיון: מערכת תכנון יום חכמה — Day Capacity Planning

## מצב קיים (AS-IS)

### מה עובד
| רכיב | מה עושה | חסר |
|---|---|---|
| `LifeSettings.jsx` | מנהל ימי חופש, חגים 2026, הדממת אוגוסט, ימי הולדת | לא מזין למנועי תכנון |
| `NewEvent.jsx` | חוסם יצירת אירוע ביום חופש | רק חסימה בינארית, לא מבין "חצי יום" |
| `HolidayAnalyzer.jsx` | מזהה חגים, ערבי חג, חוה"מ, שישי, שבת | נתוני 2024 מיושנים, לא מחובר לשאר המנועים |
| `SchedulingEngine.js` | מתזמן משימות לפי זמני טיפולים, אנרגיה, slots | לא מכיר ימי חופש/חגים כלל |
| `recurringTaskEngine.js` | מייצר משימות חודשיות לפי עץ תהליכים | due_date נקבע לפי SLA בלי לבדוק אם היום חסום |
| `capacityEngine.js` | מחשב KPI: ניצולת, עומס קוגניטיבי, יעילות | קיבולת קבועה 480 דקות, לא מותאמת לסוג יום |
| `automationEngine.js` | AND gate, אוטו-ארכיון, sequence unlock | לא מודע לסוג יום |
| `WeeklyPlanningDashboard.jsx` | תכנון שבועי, max 5 משימות ליום | לא בודק temporary_events |
| `MyFocus.jsx` | אנרגיה DNA מצוין (high/medium/low/recovery) | לא בודק אם היום חסום |
| `GanttView.jsx` | תצוגה ויזואלית של משימות על ציר זמן | מציג משימות על ימים חסומים בלי אזהרה |

### הבעיה המרכזית
**אין שכבה מרכזית שאומרת "מה הקיבולת של יום X".**
כל רכיב מחליט לבד (או לא מחליט בכלל) אם יום מסוים זמין לעבודה.

---

## פתרון: `getDayCapacity()` — שכבה מרכזית

### מיקום
```
/src/utils/dayCapacity.js
```

### חתימה
```javascript
getDayCapacity(dateStr, schedule) → DayCapacity
```

### מבנה תוצאה: `DayCapacity`
```javascript
{
  date: "2026-04-02",           // התאריך
  dayType: "holiday",           // סוג היום (ראה טבלה למטה)
  label: "פסח א׳",             // שם לתצוגה

  blocked: boolean,             // true = אסור לתכנן עליו כלום
  maxHours: number,             // שעות עבודה מקסימליות (0-8)
  maxCognitiveLoad: number,     // עומס קוגניטיבי מקסימלי (0-3)
  cutoffTime: string | null,    // שעת סיום ("13:00" לערב חג, null ליום רגיל)
  onlyUrgent: boolean,          // true = רק משימות עם דדליין צמוד
  urgentThresholdDays: number,  // מה נחשב "צמוד" (ימים עד דדליין)

  // מטא-דאטא לתצוגה
  color: string,                // צבע רקע לUI
  emoji: string,                // אמוג'י לתצוגה
  tooltip: string,              // הסבר קצר
}
```

---

## טבלת סוגי ימים מלאה

| סוג יום | `dayType` | `blocked` | `maxHours` | `maxCognitiveLoad` | `cutoffTime` | `onlyUrgent` | `urgentThresholdDays` | הסבר |
|---|---|---|---|---|---|---|---|---|
| **שבת** | `shabbat` | true | 0 | 0 | — | — | — | חסום לחלוטין |
| **חג** | `holiday` | true | 0 | 0 | — | — | — | חסום לחלוטין |
| **חופש/חופשה** | `day_off` | true | 0 | 0 | — | — | — | חסום לחלוטין |
| **ערב חג** | `erev` | false | 3 | 1 | `"13:00"` | true | 2 | חצי יום, רק דחוף ופשוט |
| **שישי** | `friday` | false | 3 | 1 | `"13:00"` | false | — | חצי יום, עבודה קלה |
| **חול המועד** | `chol_hamoed` | false | 3 | 2 | `"14:00"` | true | 3 | רק אם אין ברירה ולא נספיק אחרת |
| **הדממת אוגוסט** | `quiet_period` | false | 2 | 1 | `"14:00"` | true | 3 | מינימום הכרחי. מנוחה ואיפוס. |
| **יום הולדת** | `birthday` | false | 4 | 2 | `"14:00"` | false | — | יום מקוצר, לא משימות כבדות |
| **יום רגיל** | `normal` | false | 8 | 3 | null | false | — | יום עבודה מלא |

---

## נקודות שילוב — מי צריך להשתנות

### 1. `recurringTaskEngine.js` — הזזת due_date

**מצב נוכחי:** `resolveDueDate()` מחזיר תאריך לפי SLA/לוח מס.
**שינוי:** אחרי חישוב ה-due_date, בדוק אם היום חסום. אם כן — הזז ליום העבודה **הקודם**.

```javascript
// פסאודו-קוד
let dueDate = resolveDueDate(serviceDef, client, month, year);
while (getDayCapacity(dueDate, schedule).blocked) {
  dueDate = previousBusinessDay(dueDate);
}
```

**למה הקודם ולא הבא:** כי SLA = דדליין. לא רוצים לפספס.

### 2. `SchedulingEngine.js` — `findAvailableSlots()`

**מצב נוכחי:** סורק ימים א'-ה' עם שעות 8:00-20:00.
**שינוי:** לפני סריקת slots של יום, קרא `getDayCapacity()`:

```javascript
for (const day of weekDays) {
  const capacity = getDayCapacity(dayToDateStr(day), schedule);
  if (capacity.blocked) continue; // דלג לגמרי

  const endTime = capacity.cutoffTime || workingHours.end;
  const maxMinutes = capacity.maxHours * 60;
  // סרוק slots רק עד endTime ועד maxMinutes
}
```

**שינוי נוסף:** כשמתאים משימה ל-slot, בדוק:
- `task.cognitiveLoad <= capacity.maxCognitiveLoad`
- אם `capacity.onlyUrgent` — רק משימות עם `daysUntilDeadline <= urgentThresholdDays`

### 3. `capacityEngine.js` — `calculateCapacity()`

**מצב נוכחי:** `dailyCapacityMinutes = 480` קבוע.
**שינוי:** קבל `dateStr` ושלוף קיבולת דינמית:

```javascript
calculateCapacity(tasks, dateStr, schedule) {
  const capacity = getDayCapacity(dateStr, schedule);
  const dailyCapacityMinutes = capacity.maxHours * 60;
  // ...שאר החישוב כרגיל
}
```

### 4. `WeeklyPlanningDashboard.jsx` — תצוגה + חסימה

**מצב נוכחי:** מציג 5 ימים (א'-ה'), max 5 משימות ליום.
**שינוי:**
- לכל יום בשבוע, קרא `getDayCapacity()`
- יום `blocked` → רקע אפור, לא ניתן לגרור אליו משימות, מציג את `label`
- יום מוגבל (`maxHours < 8`) → רקע בצבע מתאים, מציג `maxHours` ו-`tooltip`
- `handleAutoBalance()` — דלג על ימים חסומים, הפחת קיבולת בימים מוגבלים

### 5. `MyFocus.jsx` — סינון אנרגיה משולב

**מצב נוכחי:** `getEnergyProfile()` מצוין אבל לא בודק סוג יום.
**שינוי:**
```javascript
const todayCapacity = getDayCapacity(todayStr, schedule);
if (todayCapacity.blocked) {
  // הצג: "היום יום חופש/חג — תנוחי! 🌴"
  return;
}
if (todayCapacity.onlyUrgent) {
  // סנן רק משימות עם דדליין צמוד
  energySuggestions = energySuggestions.filter(
    t => daysUntilDeadline(t) <= todayCapacity.urgentThresholdDays
  );
}
// הגבל עומס קוגניטיבי
energySuggestions = energySuggestions.filter(
  t => getTaskLoad(t) <= todayCapacity.maxCognitiveLoad
);
```

### 6. `GanttView.jsx` — אזהרה ויזואלית

**מצב נוכחי:** מציג משימות על כל תאריך.
**שינוי:** משימה עם `due_date` על יום חסום → פס אדום + tooltip "⚠ דדליין נופל על חג"

### 7. `NewEvent.jsx` — שדרוג מבינארי לרב-שכבתי

**מצב נוכחי:** `isDayOff = true/false` בלבד.
**שינוי:** במקום בינארי, הצג את כל המידע:
```javascript
const capacity = getDayCapacity(selectedDate, schedule);
if (capacity.blocked) {
  setWarning({ level: 'error', message: `${capacity.label} — לא ניתן לתזמן` });
} else if (capacity.onlyUrgent) {
  setWarning({ level: 'warning', message: `${capacity.label} — רק משימות דחופות (דדליין עד ${capacity.urgentThresholdDays} ימים)` });
} else if (capacity.maxHours < 8) {
  setWarning({ level: 'info', message: `${capacity.label} — יום מקוצר עד ${capacity.cutoffTime}` });
}
```

### 8. `HolidayAnalyzer.jsx` — מיותר, להעביר ל-`dayCapacity.js`

**מצב נוכחי:** מכיל לוגיקה כפולה (חגי 2024) ו-`suggestNextWorkday()`.
**שינוי:** העבר את `suggestNextWorkday()` ל-`dayCapacity.js`, מחק את הנתונים הישנים.

---

## לוגיקת `getDayCapacity()` — פסאודו-קוד מלא

```javascript
export function getDayCapacity(dateStr, schedule) {
  const date = new Date(dateStr);
  const dayOfWeek = date.getDay(); // 0=Sun, 6=Sat

  // 1. שבת
  if (dayOfWeek === 6) return SHABBAT;

  // 2. בדוק temporary_events
  const event = (schedule.temporary_events || [])
    .find(e => e.date === dateStr && e.is_all_day);

  if (event) {
    switch (event.type) {
      case 'day_off':
        if (event.subtype === 'holiday')
          return { ...HOLIDAY, label: event.title };
        if (event.subtype === 'erev')
          return { ...EREV, label: event.title };
        return { ...DAY_OFF, label: event.title };

      case 'chol_hamoed':
        return { ...CHOL_HAMOED, label: event.title };

      case 'quiet_period':
        return { ...QUIET_PERIOD, label: event.title };

      case 'birthday':
        return { ...BIRTHDAY, label: event.title };
    }
  }

  // 3. שישי
  if (dayOfWeek === 5) return FRIDAY;

  // 4. יום רגיל
  return NORMAL;
}

// פונקציית עזר: מצא את יום העבודה הקודם
export function previousBusinessDay(dateStr, schedule) {
  let d = new Date(dateStr);
  do {
    d.setDate(d.getDate() - 1);
  } while (getDayCapacity(format(d, 'yyyy-MM-dd'), schedule).blocked);
  return format(d, 'yyyy-MM-dd');
}

// פונקציית עזר: מצא את יום העבודה הבא
export function nextBusinessDay(dateStr, schedule) {
  let d = new Date(dateStr);
  do {
    d.setDate(d.getDate() + 1);
  } while (getDayCapacity(format(d, 'yyyy-MM-dd'), schedule).blocked);
  return format(d, 'yyyy-MM-dd');
}
```

---

## השפעה על חוויית המשתמשת

### לפני (מצב נוכחי)
- תכנון שבועי מציג 5 ימים זהים, גם אם יום שני הוא פסח
- MyFocus מציג משימות גם ביום חופש
- due_date נופל על חג → המשתמשת צריכה לזכור להזיז ידנית
- אין הבדל בין יום רגיל ליום מוגבל

### אחרי (מצב מוצע)
- תכנון שבועי: יום חג = אפור ולא ניתן לגרור אליו. חוה"מ = צהוב עם "3 שעות, רק דחוף"
- MyFocus ביום חג: "היום חג — תנוחי!" — לא מציג משימות
- MyFocus בחוה"מ: מציג רק 1-2 משימות עם דדליין צמוד, עומס קוגניטיבי נמוך
- due_date מוזז אוטומטית ליום עסקים קודם
- הדממת אוגוסט: 2 שעות מקסימום, רק חובה (משכורות/מע"מ)
- יום הולדת: יום מקוצר, לא משימות כבדות

---

## סדר מימוש מומלץ

### שלב 1: תשתית (dayCapacity.js)
- [ ] כתיבת `getDayCapacity()`
- [ ] כתיבת `previousBusinessDay()` / `nextBusinessDay()`
- [ ] טסטים

### שלב 2: חסימת תכנון
- [ ] `recurringTaskEngine.js` — הזזת due_date
- [ ] `NewEvent.jsx` — שדרוג לרב-שכבתי

### שלב 3: תצוגה חכמה
- [ ] `WeeklyPlanningDashboard.jsx` — ימים צבעוניים + חסימה
- [ ] `MyFocus.jsx` — סינון לפי סוג יום
- [ ] `GanttView.jsx` — אזהרה ויזואלית

### שלב 4: מנועים
- [ ] `SchedulingEngine.js` — slots מותאמים
- [ ] `capacityEngine.js` — קיבולת דינמית

### שלב 5: ניקוי
- [ ] `HolidayAnalyzer.jsx` — העברה ל-dayCapacity.js
- [ ] הסרת נתוני 2024 מיושנים
