# CalmPlan - אפיון סופי: Header, Sidebar, Command Bar & View Switching

> **מסמך זה הוא אפיון סופי מאוחד.** הוא כולל את כל מה שצריך ליישום — ללא צורך בניתוח מחודש.
> כל קובץ מצוין עם הנתיב המדויק שלו. כל שינוי מתואר ברמת הקומפוננטה.

---

## מבנה טכנולוגי קיים (לידיעת המתכנת)

| טכנולוגיה | פרטים |
|---|---|
| Framework | React 18 + Vite |
| Routing | react-router-dom (Hash routing) |
| CSS | Tailwind CSS + shadcn/ui |
| Animation | framer-motion |
| Icons | lucide-react |
| State | useState/useEffect (אין Redux) |
| Data Layer | `src/api/base44Client.js` → `localDB.js` (localStorage) / `supabaseDB.js` |
| CRUD API | `entity.list()`, `entity.create(data)`, `entity.filter(filters)`, `entity.update(id, data)`, `entity.delete(id)` |
| RTL | כיוון RTL גלובלי (`dir="rtl"`) |

### Entities בשימוש ישיר באפיון זה
```javascript
import { Task, Client, Event, StickyNote, Project } from "@/api/entities";
```

---

## חלק 1: שדרוג ה-Header (חלק עליון)

### 1.1 קבצים לשינוי
| קובץ | מה לשנות |
|---|---|
| `src/pages/Layout.jsx` | הוספת Work Mode Toggle, Emergency Icon, Energy Filter ל-Header |
| `src/pages/Home.jsx` | הפיכת FOCUS_TABS לפילטרים לחיצים + Daily Progress Bar |
| `src/components/tasks/QuickStats.jsx` | הפיכת קוביות סטטיסטיקה לכפתורי סינון |

### 1.2 הפיכת קוביות סטטיסטיקה לפילטרים לחיצים (Actionable Stat Boxes)

**קובץ:** `src/components/tasks/QuickStats.jsx`

**מצב נוכחי:** 4 קוביות סטטיסטיות (משימות הושלמו, זמן כולל, פרודוקטיביות, משימות לא מתוכננות). הן מציגות מספרים בלבד — לא ניתן ללחוץ עליהן.

**שינוי נדרש:**
- כל קובייה הופכת לכפתור (`onClick`).
- הוספת `cursor-pointer` ו-`hover:ring-2` לכרטיס.
- הוספת מצב `active` (עם `ring-2 ring-{color}`) כשהפילטר פעיל.
- לחיצה על קובייה מפעילה callback `onFilterSelect(filterKey)` שמסנן את התצוגה.

**מיפוי פילטרים:**
| קובייה | filterKey | פעולה בלחיצה |
|---|---|---|
| "8 הושלמו" | `completed` | מסנן ומציג רק משימות completed (אפקט דופמין) |
| "17 סה"כ" | `all` | פותח Mind Map View (אם קיים) או מציג הכל |
| **חדש:** "3 בפיגור" (אדום) | `overdue` | מסנן ומציג רק משימות שעבר ה-due_date שלהן |
| **חדש:** "5 להיום" (כחול) | `today` | מסנן ומציג רק משימות עם due_date=today |

**קובייה חדשה — "בפיגור / דחוף":**
```jsx
{
  title: "בפיגור",
  value: overdueTasks.length,
  subtitle: "דורשות טיפול מיידי",
  icon: AlertTriangle,
  color: "text-red-600",
  bgColor: "bg-red-100",
  filterKey: "overdue"
}
```

**Props חדשים של QuickStats:**
```typescript
interface QuickStatsProps {
  tasks: Task[];
  sessions: TaskSession[];
  isLoading: boolean;
  activeFilter: string | null;        // NEW
  onFilterSelect: (key: string) => void;  // NEW
}
```

### 1.3 מד התקדמות יומי (Daily Progress Bar)

**קובץ:** `src/pages/Home.jsx`

**מיקום:** מתחת ל-QuickStats, מעל רשימת המשימות.

**התנהגות:**
- סופר את כמות המשימות שהושלמו היום חלקי כלל המשימות להיום.
- פס Progress (Tailwind `bg-gradient-to-r from-emerald-400 to-emerald-600`).
- כשמגיע ל-100% — אנימציית celebration (Framer Motion scale + sparkle).

**יישום:**
```jsx
const todayTasks = tasks.filter(t => t.due_date && isToday(parseISO(t.due_date)));
const completedToday = todayTasks.filter(t => t.status === 'completed').length;
const progress = todayTasks.length > 0 ? (completedToday / todayTasks.length) * 100 : 0;

<div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
  <motion.div
    className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full"
    initial={{ width: 0 }}
    animate={{ width: `${progress}%` }}
    transition={{ duration: 0.8, ease: "easeOut" }}
  />
</div>
<p className="text-sm text-gray-500 mt-1">
  {completedToday} מתוך {todayTasks.length} משימות הושלמו היום
</p>
```

### 1.4 מרכז חירום (Emergency Center) — החלפת הפס האדום

**קובץ:** `src/pages/Layout.jsx`

**מצב נוכחי:** פס אדום עם טקסט צפוף שמציג התראות על לקוחות שמחכים לדיווח.

**שינוי נדרש:**
- **מחיקת** הפס האדום הארוך.
- **הוספת** אייקון `Flame` (lucide-react) קטן ב-Header ליד שם המשתמש.
- לצד האייקון — Badge עם מספר השריפות (למשל: `3`).
- לחיצה על האייקון פותחת **Sheet** (מ-shadcn/ui) מצד ימין.

**תוכן ה-Sheet:**
```jsx
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Flame } from "lucide-react";

// בתוך ה-Header:
<Sheet>
  <SheetTrigger asChild>
    <button className="relative p-2 rounded-lg hover:bg-red-50 transition-colors">
      <Flame className="w-5 h-5 text-red-500" />
      {emergencyCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
          {emergencyCount}
        </span>
      )}
    </button>
  </SheetTrigger>
  <SheetContent side="right" className="w-[380px]">
    <SheetHeader>
      <SheetTitle className="text-red-600 flex items-center gap-2">
        <Flame className="w-5 h-5" /> משימות דחופות
      </SheetTitle>
    </SheetHeader>
    {/* רשימה תמציתית של עד 5 משימות הכי דחופות */}
    <div className="mt-4 space-y-3">
      {emergencyTasks.map(task => (
        <Card key={task.id} className="border-r-4 border-red-400 cursor-pointer hover:bg-red-50"
              onClick={() => navigateToTask(task)}>
          <CardContent className="p-3">
            <p className="font-medium text-sm">{task.title}</p>
            <p className="text-xs text-gray-500">{task.client_name} • {task.due_date}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  </SheetContent>
</Sheet>
```

**חישוב emergencyTasks:**
```javascript
const emergencyTasks = tasks
  .filter(t => {
    if (t.status === 'completed' || t.status === 'not_relevant') return false;
    const due = t.due_date ? parseISO(t.due_date) : null;
    if (!due) return false;
    return differenceInDays(due, new Date()) <= 0; // עבר או היום
  })
  .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
  .slice(0, 5);
const emergencyCount = emergencyTasks.length;
```

### 1.5 בורר מפלס אנרגיה (Energy Filter)

**קובץ:** `src/pages/Layout.jsx` (בתוך ה-Header)

**רעיון:** כפתור סוללה ב-Header. לחיצה עליו מאפשרת בחירת מצב אנרגיה שמשפיע על מה מוצג.

**יישום:**
```jsx
import { Battery, BatteryLow, BatteryMedium, BatteryFull } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

// State חדש ב-Layout:
const [energyLevel, setEnergyLevel] = useState('full'); // 'low' | 'medium' | 'full'

// כפתור ב-Header:
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="icon" className="relative">
      {energyLevel === 'low' && <BatteryLow className="w-5 h-5 text-red-500" />}
      {energyLevel === 'medium' && <BatteryMedium className="w-5 h-5 text-yellow-500" />}
      {energyLevel === 'full' && <BatteryFull className="w-5 h-5 text-green-500" />}
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem onClick={() => setEnergyLevel('low')}>
      <BatteryLow className="w-4 h-4 ml-2 text-red-500" />
      סוללה נמוכה — רק משימות של 5-10 דקות
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => setEnergyLevel('medium')}>
      <BatteryMedium className="w-4 h-4 ml-2 text-yellow-500" />
      אנרגיה בינונית — משימות S ו-M
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => setEnergyLevel('full')}>
      <BatteryFull className="w-4 h-4 ml-2 text-green-500" />
      אנרגיה מלאה — הכל מוצג
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

**העברת energyLevel לדפים:**
- ה-Layout מעביר את `energyLevel` דרך React Context או כ-prop ל-children.
- דפים כמו Home.jsx ו-Tasks.jsx מסננים לפי כך:

```javascript
// סינון לפי אנרגיה (מבוסס על שדה estimated_duration או client size)
const filterByEnergy = (tasks, level) => {
  if (level === 'full') return tasks;
  if (level === 'low') return tasks.filter(t =>
    (t.estimated_duration && t.estimated_duration <= 10) || t.client_size === 'S'
  );
  if (level === 'medium') return tasks.filter(t =>
    !t.client_size || t.client_size !== 'XL'
  );
  return tasks;
};
```

### 1.6 ספירה לאחור לדד-ליין (Deadline Countdown)

**קובץ:** `src/pages/Layout.jsx` — ב-Header, ליד התאריך

**יישום:**
```jsx
// חישוב הדד-ליין הקרוב ביותר (15 או 16 בחודש לדיווח מע"מ)
const getNextDeadline = () => {
  const now = new Date();
  const day = now.getDate();
  const month = now.getMonth();
  const year = now.getFullYear();
  // דד-ליין 15 לדיווח מע"מ
  let deadline = new Date(year, month, 15);
  if (day > 15) deadline = new Date(year, month + 1, 15);
  const daysLeft = differenceInDays(deadline, now);
  return { daysLeft, label: 'דיווח מע"מ' };
};

// בתוך ה-Header:
const { daysLeft, label } = getNextDeadline();
<Badge variant={daysLeft <= 3 ? "destructive" : "secondary"} className="text-xs">
  עוד {daysLeft} ימים ל{label}
</Badge>
```

---

## חלק 2: אפיון מחדש של התפריט הצידי (Sidebar)

### 2.1 קבצים לשינוי
| קובץ | מה לשנות |
|---|---|
| `src/pages/Layout.jsx` | החלפת navigationGroups + הוספת Work Modes + Pinned Clients + Sidebar Collapse |

### 2.2 מצבי עבודה (Work Modes) — 3 כפתורי-על בראש התפריט

**מצב נוכחי:** `navigationGroups` ב-`Layout.jsx` (שורות 27-123) מכיל 3 קבוצות ראשיות עם 11+ פריטים מקוננים. זה יוצר שיתוק בחירה.

**שינוי נדרש:** הוספת 3 כפתורי Mode בראש התפריט. כל Mode מחביא/מציג חלקים שונים.

```jsx
// State חדש ב-Layout:
const [workMode, setWorkMode] = useState('doing'); // 'doing' | 'planning' | 'admin'

// הגדרת מצבי עבודה:
const WORK_MODES = [
  {
    key: 'doing',
    label: 'ביצוע',
    icon: Zap,
    color: 'bg-emerald-500 text-white',
    description: 'קנבן + משימות להיום',
    visibleSections: ['focus', 'operations']
  },
  {
    key: 'planning',
    label: 'תכנון',
    icon: Brain,
    color: 'bg-blue-500 text-white',
    description: 'מפה + גאנט + תכנון שבועי',
    visibleSections: ['planning']
  },
  {
    key: 'admin',
    label: 'ניהול',
    icon: Settings,
    color: 'bg-gray-500 text-white',
    description: 'לקוחות + ספקים + הגדרות',
    visibleSections: ['admin', 'system']
  },
];
```

**מבנה תפריט חדש (4 קבוצות-על):**

```javascript
const sidebarSections = {
  focus: {
    title: "פוקוס",
    icon: Target,
    color: 'sky',
    items: [
      { name: "פוקוס יומי", href: createPageUrl("Home"), icon: Eye },
      { name: "משימות", href: createPageUrl("Tasks"), icon: CheckSquare },
      { name: "לוח שנה", href: createPageUrl("Calendar"), icon: Calendar },
    ]
  },
  operations: {
    title: "ביצוע",
    icon: Calculator,
    color: 'violet',
    items: [
      { name: "ריכוז דיווחים חודשיים", href: createPageUrl("ClientsDashboard"), icon: BarChart3 },
      { name: "דיווחי מיסים", href: createPageUrl("TaxReportsDashboard"), icon: FileBarChart },
      { name: "שכר ודיווחי רשויות", href: createPageUrl("PayrollDashboard"), icon: Calculator },
      { name: "דיווחים תקופתיים", href: createPageUrl("PeriodicSummaryReports"), icon: FileBarChart },
      { name: "התאמות חשבונות", href: createPageUrl("Reconciliations"), icon: BookCheck },
      { name: "שירותים נוספים", href: createPageUrl("AdditionalServicesDashboard"), icon: Settings },
      { name: "אדמיניסטרטיבי", href: createPageUrl("AdminTasksDashboard"), icon: FolderKanban },
      { name: "מאזנים שנתיים", href: createPageUrl("BalanceSheets"), icon: Scaling },
    ]
  },
  planning: {
    title: "תכנון",
    icon: Brain,
    color: 'blue',
    items: [
      { name: "תכנון שבועי", href: createPageUrl("WeeklyPlanningDashboard"), icon: Brain },
      { name: "סיכום שבועי", href: createPageUrl("WeeklySummary"), icon: FileBarChart },
      { name: "מעקב פרויקטים", href: createPageUrl("Projects"), icon: FolderKanban },
      { name: "אוטומציות", href: createPageUrl("AutomationRules"), icon: Zap },
      { name: "משימות חוזרות", href: createPageUrl("RecurringTasks"), icon: Repeat },
      // Mind Map ו-Gantt יופיעו כאן כשיהיו דפים ייעודיים
    ]
  },
  admin: {
    title: "משרד",
    icon: Users,
    color: 'orange',
    items: [
      { name: "מרכז לקוחות", href: createPageUrl("ClientManagement"), icon: Users },
      { name: "לידים", href: createPageUrl("Leads"), icon: Target },
      { name: "קליטת לקוח חדש", href: createPageUrl("ClientOnboarding"), icon: UserCheck },
      { name: "מרכז נתוני שכ״ט", href: createPageUrl("FeeManagement"), icon: DollarSign },
      { name: "ספקים ונותני שירותים", href: createPageUrl("ServiceProviders"), icon: BookUser },
    ]
  },
  system: {
    title: "מערכת",
    icon: Settings,
    color: 'gray',
    items: [
      { name: "הגדרת פרמטרים", href: createPageUrl("Settings"), icon: Settings },
      { name: "ייבוא נתונים", href: createPageUrl("DataImportTool"), icon: Database },
    ]
  },
  life: {
    title: "LENA - בית וחיים",
    icon: BookHeart,
    color: 'pink',
    items: [
      { name: "תכנון ארוחות", href: createPageUrl("MealPlanner"), icon: Soup },
      { name: "השראה וספרים", href: createPageUrl("Inspiration"), icon: BookHeart },
      { name: "הגדרות אישיות", href: createPageUrl("LifeSettings"), icon: Settings },
    ]
  },
};

// סינון לפי Mode:
const getVisibleSections = (mode) => {
  const modeConfig = WORK_MODES.find(m => m.key === mode);
  // life תמיד מוצג בתחתית
  return [...modeConfig.visibleSections, 'life'];
};
```

**רינדור כפתורי Mode בראש ה-Sidebar:**
```jsx
{/* Work Mode Selector */}
<div className="px-3 py-2 border-b border-gray-200">
  <div className="flex gap-1">
    {WORK_MODES.map(mode => (
      <button
        key={mode.key}
        onClick={() => setWorkMode(mode.key)}
        className={`flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-lg text-xs font-medium transition-all
          ${workMode === mode.key ? mode.color + ' shadow-md scale-105' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
      >
        <mode.icon className="w-4 h-4" />
        {mode.label}
      </button>
    ))}
  </div>
</div>

{/* Filtered Navigation */}
{Object.entries(sidebarSections)
  .filter(([key]) => getVisibleSections(workMode).includes(key))
  .map(([key, section]) => (
    <div key={key} className="px-3 py-2">
      <h3 className="text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-1">
        <section.icon className="w-3 h-3" /> {section.title}
      </h3>
      {section.items.map(item => (
        <Link key={item.href} to={item.href}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors
            ${isActive(item.href) ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}>
          <item.icon className="w-4 h-4" />
          {item.name}
        </Link>
      ))}
    </div>
  ))}
```

### 2.3 נעוצים (Pinned / Recent Clients)

**קובץ:** `src/pages/Layout.jsx`

**מיקום:** מתחת לכפתורי Mode, מעל הניווט הרגיל.

**יישום:**
```jsx
// State:
const [pinnedClients, setPinnedClients] = useState([]);

// טעינה מ-localStorage (persist בין sessions):
useEffect(() => {
  const saved = localStorage.getItem('calmplan_pinned_clients');
  if (saved) setPinnedClients(JSON.parse(saved));
}, []);

// חישוב "אחרונים" — 5 לקוחות ששונו לאחרונה:
useEffect(() => {
  const loadRecent = async () => {
    const clients = await Client.list('-updated_date', 5);
    // מיזוג עם pinned (pinned קודמים)
    const pinnedIds = new Set(pinnedClients.map(c => c.id));
    const recentNotPinned = clients.filter(c => !pinnedIds.has(c.id)).slice(0, 5 - pinnedClients.length);
    // לא לשנות את pinnedClients, רק להציג בנוסף
    setRecentClients(recentNotPinned);
  };
  loadRecent();
}, [pinnedClients]);

// רינדור:
<div className="px-3 py-2 border-b border-gray-200">
  <h3 className="text-xs font-bold text-gray-400 mb-2 flex items-center gap-1">
    <Star className="w-3 h-3" /> גישה מהירה
  </h3>
  {[...pinnedClients, ...recentClients].slice(0, 5).map(client => (
    <Link key={client.id}
      to={`${createPageUrl('ClientManagement')}?clientId=${client.id}`}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors">
      <div className="w-2 h-2 rounded-full bg-emerald-400" />
      {client.name}
    </Link>
  ))}
</div>
```

### 2.4 Sidebar מצומצם כברירת מחדל

**קובץ:** `src/pages/Layout.jsx`

**שינוי:** ה-Sidebar יתחיל במצב מצומצם (אייקונים בלבד). לחיצה על כפתור מרחיבה אותו.

```jsx
// State:
const [sidebarCollapsed, setSidebarCollapsed] = useState(true); // ברירת מחדל: מצומצם

// ב-Sidebar wrapper:
<aside className={`hidden md:flex flex-col border-l border-gray-200 bg-white transition-all duration-300
  ${sidebarCollapsed ? 'w-16' : 'w-64'}`}>

  {/* Toggle button */}
  <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
    className="self-start p-2 m-2 rounded-lg hover:bg-gray-100">
    {sidebarCollapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
  </button>

  {sidebarCollapsed ? (
    /* מצב אייקונים בלבד */
    <div className="flex flex-col items-center gap-2 py-4">
      {Object.entries(sidebarSections)
        .filter(([key]) => getVisibleSections(workMode).includes(key))
        .map(([key, section]) => (
          section.items.map(item => (
            <Tooltip key={item.href}>
              <TooltipTrigger asChild>
                <Link to={item.href} className={`p-2 rounded-lg transition-colors
                  ${isActive(item.href) ? 'bg-emerald-50 text-emerald-600' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}>
                  <item.icon className="w-5 h-5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="left">{item.name}</TooltipContent>
            </Tooltip>
          ))
        ))}
    </div>
  ) : (
    /* מצב מורחב — ניווט מלא */
    // ... הקוד מסעיף 2.2 למעלה
  )}
</aside>
```

### 2.5 כפתור "מצב ריכוז" (Focus Mode)

**קובץ:** `src/pages/Layout.jsx` — ב-Header

**התנהגות:** לחיצה מחביאה את ה-Sidebar לגמרי ומרחיבה את אזור התוכן ל-100%.

```jsx
const [focusMode, setFocusMode] = useState(false);

// כפתור ב-Header:
<Button variant="ghost" size="icon" onClick={() => setFocusMode(!focusMode)}
  className={focusMode ? 'bg-emerald-100 text-emerald-700' : ''}>
  <Maximize2 className="w-5 h-5" />
</Button>

// ב-Layout:
{!focusMode && <aside>...</aside>}
<main className={focusMode ? 'w-full' : 'flex-1'}>
  {children}
</main>
```

---

## חלק 3: שדרוג ה-Command Bar (חיפוש חכם)

### 3.1 קבצים לשינוי
| קובץ | מה לשנות |
|---|---|
| `src/components/GlobalSearch.jsx` | שדרוג לתמיכה בפעולות מהירות + חיפוש הקשרי |
| `src/pages/Layout.jsx` | העברת כפתור החיפוש למרכז ה-Header |

### 3.2 מצב נוכחי של GlobalSearch
**קובץ:** `src/components/GlobalSearch.jsx`

כבר קיים Command Bar עם:
- קיצור `Ctrl+K` / `Cmd+K`
- חיפוש ב-4 entities: Clients, Tasks, Projects, StickyNotes
- CommandDialog מ-shadcn/ui
- מקסימום 5 תוצאות לכל קטגוריה

### 3.3 שדרוגים נדרשים

**א. העברה למרכז ה-Header:**

**קובץ:** `src/pages/Layout.jsx`

במקום שכפתור החיפוש יושב בתוך ה-Sidebar (שורה 282), הוא עובר ל-Header:

```jsx
{/* בתוך ה-Header bar, במרכז */}
<div className="flex-1 max-w-md mx-4">
  <GlobalSearch />
</div>
```

עדכון ב-GlobalSearch — סגנון הכפתור:
```jsx
<button
  onClick={() => setOpen(true)}
  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-400 bg-gray-100 hover:bg-gray-200 rounded-xl border border-gray-200 transition-colors"
>
  <Search className="w-4 h-4" />
  <span className="flex-1 text-right">חיפוש או ביצוע פעולה...</span>
  <kbd className="hidden md:inline-flex items-center gap-0.5 rounded border border-gray-300 bg-gray-50 px-1.5 py-0.5 text-[10px] font-mono text-gray-500">
    Ctrl+K
  </kbd>
</button>
```

**ב. הוספת פעולות מהירות (Quick Actions):**

```javascript
// הוספה ל-GlobalSearch.jsx:
const QUICK_ACTIONS = [
  {
    key: 'new_task',
    label: 'משימה חדשה',
    icon: Plus,
    color: 'text-emerald-600',
    keywords: ['משימה חדשה', 'צור משימה', 'הוסף משימה', 'new task'],
    action: () => { /* פתיחת QuickAddTaskDialog */ },
  },
  {
    key: 'new_client',
    label: 'קליטת לקוח חדש',
    icon: UserCheck,
    color: 'text-blue-600',
    keywords: ['לקוח חדש', 'קליטה', 'onboarding'],
    action: () => navigate(createPageUrl('ClientOnboarding')),
  },
  {
    key: 'vat_report',
    label: 'דיווח מע"מ',
    icon: FileBarChart,
    color: 'text-violet-600',
    keywords: ['מעמ', 'vat', 'דיווח מע"מ'],
    action: () => navigate(createPageUrl('TaxReportsDashboard')),
  },
  {
    key: 'payroll',
    label: 'שכר ודיווחי רשויות',
    icon: Calculator,
    color: 'text-orange-600',
    keywords: ['שכר', 'payroll', 'תלוש'],
    action: () => navigate(createPageUrl('PayrollDashboard')),
  },
  {
    key: 'focus',
    label: 'מצב ריכוז',
    icon: Eye,
    color: 'text-sky-600',
    keywords: ['ריכוז', 'פוקוס', 'focus'],
    action: () => { /* toggle focus mode */ },
  },
];
```

**ג. חיפוש הקשרי (Context-Aware Search):**

כשהמשתמש נמצא בדף דיווחי מיסים, חיפוש "אברהם" יתעדף את המשימות שקשורות למיסים:

```javascript
// שדרוג ה-filter logic:
useEffect(() => {
  if (!query.trim()) { setResults({}); return; }
  const q = query.trim().toLowerCase();
  const filtered = {};

  for (const config of ENTITY_CONFIGS) {
    const items = allData[config.key] || [];
    let matches = items.filter(item =>
      config.searchFields.some(field => {
        const val = item[field];
        return val && String(val).toLowerCase().includes(q);
      })
    );

    // Context boosting: if on TaxReportsDashboard, boost tax-related tasks
    if (currentPage === 'TaxReportsDashboard' && config.key === 'tasks') {
      matches.sort((a, b) => {
        const aIsTax = ['מע"מ', 'מקדמות מס'].includes(a.category) ? -1 : 0;
        const bIsTax = ['מע"מ', 'מקדמות מס'].includes(b.category) ? -1 : 0;
        return aIsTax - bIsTax;
      });
    }

    matches = matches.slice(0, 5);
    if (matches.length > 0) filtered[config.key] = matches;
  }

  // הוספת Quick Actions שתואמות
  const matchingActions = QUICK_ACTIONS.filter(a =>
    a.keywords.some(kw => kw.includes(q) || q.includes(kw))
  );
  if (matchingActions.length > 0) filtered['actions'] = matchingActions;

  setResults(filtered);
}, [query, allData, currentPage]);
```

**ד. רינדור Quick Actions בתוך CommandDialog:**
```jsx
{results.actions && (
  <CommandGroup heading={
    <span className="flex items-center gap-1.5">
      <Zap className="w-3.5 h-3.5 text-amber-500" />
      פעולות מהירות
    </span>
  }>
    {results.actions.map(action => (
      <CommandItem key={action.key} onSelect={() => { action.action(); setOpen(false); }}>
        <action.icon className={`w-4 h-4 ${action.color} shrink-0`} />
        <span className="text-sm font-medium">{action.label}</span>
      </CommandItem>
    ))}
  </CommandGroup>
)}
```

---

## חלק 4: שילוב תצוגות Mind Map ו-Gantt (View Switching)

### 4.1 קבצים לשינוי
| קובץ | מה לשנות |
|---|---|
| `src/pages/Tasks.jsx` | הוספת 2 אייקוני תצוגה חדשים (Map + Gantt) ליד Table/Kanban |
| `src/pages/ClientsDashboard.jsx` | אותו view switching |
| `src/pages/Home.jsx` | אותו view switching |
| **חדש:** `src/components/views/MindMapView.jsx` | קומפוננטת Mind Map |
| **חדש:** `src/components/views/GanttView.jsx` | קומפוננטת Gantt |

### 4.2 עדכון ה-View Switcher הקיים

**קובץ:** `src/pages/Tasks.jsx` (שורות 464-469)

**מצב נוכחי:**
```jsx
const [view, setView] = useState("kanban"); // רק 'list' | 'kanban'
```

**שינוי נדרש:**
```jsx
const [view, setView] = useState("kanban"); // 'list' | 'kanban' | 'mindmap' | 'gantt'

// View Switcher UI:
<div className="flex bg-white rounded-xl p-1 shadow-sm border">
  <Button variant={view === 'list' ? 'secondary' : 'ghost'} size="icon"
    onClick={() => setView('list')} title="תצוגת רשימה">
    <List className="w-5 h-5" />
  </Button>
  <Button variant={view === 'kanban' ? 'secondary' : 'ghost'} size="icon"
    onClick={() => setView('kanban')} title="תצוגת קנבן">
    <LayoutGrid className="w-5 h-5" />
  </Button>
  <Button variant={view === 'mindmap' ? 'secondary' : 'ghost'} size="icon"
    onClick={() => setView('mindmap')} title="מפת חשיבה">
    <Network className="w-5 h-5" />
  </Button>
  <Button variant={view === 'gantt' ? 'secondary' : 'ghost'} size="icon"
    onClick={() => setView('gantt')} title="ציר זמן">
    <GanttChart className="w-5 h-5" />
  </Button>
</div>
```

**רינדור מותנה:**
```jsx
{view === 'list' && <ListView tasks={filteredTasks} ... />}
{view === 'kanban' && <KanbanView tasks={filteredTasks} ... />}
{view === 'mindmap' && <MindMapView tasks={filteredTasks} clients={clients} />}
{view === 'gantt' && <GanttView tasks={filteredTasks} clients={clients} />}
```

### 4.3 אפיון MindMapView

**קובץ חדש:** `src/components/views/MindMapView.jsx`

**מבנה הנתונים למפה:**
```
מרכז: "דיווחים חודשיים - [חודש]"
├── מע"מ (ענף סגול)
│   ├── לקוח A (S) ✅ ירוק
│   ├── לקוח B (M) 🔵 בתהליך
│   └── לקוח C (L) 🔴 באיחור
├── מקדמות מס (ענף כחול)
│   ├── ...
├── שכר (ענף כתום)
│   ├── ...
└── ביטוח לאומי (ענף ירוק)
    ├── ...
```

**T-Shirt Sizing — גודל הנקודה:**
| גודל | קוטר הנקודה | צבע מסגרת |
|---|---|---|
| S | 32px | ללא |
| M | 48px | border-2 |
| L | 64px | border-3 |
| XL | 80px | border-4 + shadow-lg |

**צבע הנקודה לפי סטטוס:**
| סטטוס | צבע |
|---|---|
| completed | `bg-green-400` |
| in_progress | `bg-blue-400` |
| not_started | `bg-gray-300` |
| overdue | `bg-red-500` + pulse animation |
| issue | `bg-yellow-500` |

**יישום בסיסי (CSS Grid Radial):**
```jsx
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

export default function MindMapView({ tasks, clients }) {
  // קיבוץ לפי קטגוריה
  const grouped = useMemo(() => {
    const groups = {};
    tasks.forEach(task => {
      const cat = task.category || 'אחר';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(task);
    });
    return groups;
  }, [tasks]);

  const BRANCH_COLORS = {
    'מע"מ': 'from-violet-400 to-violet-600',
    'מקדמות מס': 'from-blue-400 to-blue-600',
    'שכר': 'from-orange-400 to-orange-600',
    'ביטוח לאומי': 'from-green-400 to-green-600',
    'ניכויים': 'from-teal-400 to-teal-600',
    'אחר': 'from-gray-400 to-gray-600',
  };

  const STATUS_COLORS = {
    completed: 'bg-green-400 border-green-500',
    in_progress: 'bg-blue-400 border-blue-500',
    not_started: 'bg-gray-300 border-gray-400',
    overdue: 'bg-red-500 border-red-600 animate-pulse',
  };

  const SIZE_MAP = { S: 32, M: 48, L: 64, XL: 80 };

  const getClientSize = (clientName) => {
    const client = clients.find(c => c.name === clientName);
    return client?.size || 'M'; // ברירת מחדל M
  };

  const isOverdue = (task) => {
    if (task.status === 'completed') return false;
    return task.due_date && new Date(task.due_date) < new Date();
  };

  const categories = Object.keys(grouped);
  const angleStep = (2 * Math.PI) / Math.max(categories.length, 1);
  const branchRadius = 200; // מרחק הענפים מהמרכז
  const nodeSpacing = 70;   // מרחק בין נקודות על הענף

  return (
    <div className="relative w-full min-h-[600px] overflow-auto bg-gradient-to-br from-gray-50 to-white rounded-2xl border">
      <div className="relative" style={{ width: '800px', height: '800px', margin: '0 auto' }}>
        {/* מרכז */}
        <motion.div
          className="absolute bg-gradient-to-br from-emerald-400 to-emerald-600 text-white rounded-full w-24 h-24 flex items-center justify-center text-sm font-bold shadow-xl z-10"
          style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200 }}
        >
          דיווחים
        </motion.div>

        {/* ענפים */}
        {categories.map((cat, catIndex) => {
          const angle = catIndex * angleStep - Math.PI / 2;
          const tasks_in_cat = grouped[cat];

          return (
            <React.Fragment key={cat}>
              {/* תווית קטגוריה */}
              <motion.div
                className={`absolute bg-gradient-to-r ${BRANCH_COLORS[cat] || BRANCH_COLORS['אחר']} text-white px-3 py-1 rounded-full text-xs font-medium shadow-md z-10`}
                style={{
                  top: `${50 + Math.sin(angle) * 25}%`,
                  left: `${50 + Math.cos(angle) * 25}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: catIndex * 0.1 }}
              >
                {cat} ({tasks_in_cat.length})
              </motion.div>

              {/* נקודות לקוחות */}
              {tasks_in_cat.map((task, taskIndex) => {
                const clientSize = getClientSize(task.client_name);
                const size = SIZE_MAP[clientSize];
                const distance = branchRadius + taskIndex * nodeSpacing;
                const overdue = isOverdue(task);
                const statusKey = overdue ? 'overdue' : task.status;

                return (
                  <motion.div
                    key={task.id}
                    className={`absolute rounded-full flex items-center justify-center text-white text-[10px] font-medium cursor-pointer border-2 shadow-md
                      ${STATUS_COLORS[statusKey] || STATUS_COLORS.not_started}`}
                    style={{
                      width: size,
                      height: size,
                      top: `${50 + Math.sin(angle) * (distance / 8)}%`,
                      left: `${50 + Math.cos(angle) * (distance / 8)}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: catIndex * 0.1 + taskIndex * 0.05 }}
                    whileHover={{ scale: 1.3, zIndex: 50 }}
                    title={`${task.client_name} - ${task.title} (${clientSize})`}
                  >
                    {task.client_name?.substring(0, 4)}
                  </motion.div>
                );
              })}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
```

### 4.4 אפיון GanttView

**קובץ חדש:** `src/components/views/GanttView.jsx`

**מבנה:**
- ציר X: ימים בחודש (1-31)
- ציר Y: לקוחות (מקובצים לפי קטגוריה)
- כל פס = משימה. עובי הפס לפי T-Shirt Size.
- צבע הפס לפי סטטוס.

**עובי פס לפי גודל:**
| גודל | height |
|---|---|
| S | h-4 (16px) |
| M | h-6 (24px) |
| L | h-8 (32px) |
| XL | h-10 (40px) |

**יישום בסיסי:**
```jsx
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { format, parseISO, startOfMonth, endOfMonth, differenceInDays, eachDayOfInterval } from 'date-fns';
import { he } from 'date-fns/locale';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const STATUS_COLORS = {
  completed: 'bg-green-400',
  in_progress: 'bg-blue-400',
  not_started: 'bg-gray-300',
  waiting_for_materials: 'bg-yellow-300',
  issue: 'bg-red-400',
  reported_waiting_for_payment: 'bg-purple-300',
};

const SIZE_HEIGHT = { S: 'h-4', M: 'h-6', L: 'h-8', XL: 'h-10' };

export default function GanttView({ tasks, clients, currentMonth }) {
  const monthStart = startOfMonth(currentMonth || new Date());
  const monthEnd = endOfMonth(monthStart);
  const daysInMonth = differenceInDays(monthEnd, monthStart) + 1;
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // קיבוץ משימות לפי לקוח
  const grouped = useMemo(() => {
    const groups = {};
    tasks.forEach(task => {
      const key = task.client_name || 'ללא לקוח';
      if (!groups[key]) groups[key] = [];
      groups[key].push(task);
    });
    // מיון: לקוחות עם overdue ראשונים
    return Object.entries(groups).sort(([, a], [, b]) => {
      const aOverdue = a.some(t => t.status !== 'completed' && t.due_date && new Date(t.due_date) < new Date());
      const bOverdue = b.some(t => t.status !== 'completed' && t.due_date && new Date(t.due_date) < new Date());
      return bOverdue - aOverdue;
    });
  }, [tasks]);

  const getClientSize = (clientName) => {
    const client = clients.find(c => c.name === clientName);
    return client?.size || 'M';
  };

  const getTaskPosition = (task) => {
    const start = task.scheduled_start ? parseISO(task.scheduled_start) : parseISO(task.due_date);
    const end = parseISO(task.due_date);
    const startDay = Math.max(0, differenceInDays(start, monthStart));
    const endDay = Math.min(daysInMonth - 1, differenceInDays(end, monthStart));
    const width = Math.max(1, endDay - startDay + 1);
    return { left: `${(startDay / daysInMonth) * 100}%`, width: `${(width / daysInMonth) * 100}%` };
  };

  return (
    <div className="bg-white rounded-2xl border overflow-x-auto">
      {/* Header — ימות החודש */}
      <div className="flex border-b bg-gray-50 sticky top-0 z-10">
        <div className="w-40 shrink-0 p-2 text-sm font-medium text-gray-600 border-l">לקוח</div>
        <div className="flex-1 flex">
          {days.map(day => (
            <div key={day.toISOString()}
              className={`flex-1 text-center text-[10px] p-1 border-l border-gray-100
                ${day.getDay() === 6 ? 'bg-red-50' : ''}`}>
              {format(day, 'd')}
            </div>
          ))}
        </div>
      </div>

      {/* Rows — לקוחות */}
      {grouped.map(([clientName, clientTasks]) => {
        const clientSize = getClientSize(clientName);
        const heightClass = SIZE_HEIGHT[clientSize];
        return (
          <div key={clientName} className="flex border-b hover:bg-gray-50/50 transition-colors">
            <div className="w-40 shrink-0 p-2 text-sm text-gray-700 border-l flex items-center gap-1">
              <span className="font-medium truncate">{clientName}</span>
              <span className="text-[10px] text-gray-400">({clientSize})</span>
            </div>
            <div className="flex-1 relative min-h-[40px]">
              {clientTasks.filter(t => t.due_date).map(task => {
                const pos = getTaskPosition(task);
                const isOverdue = task.status !== 'completed' && new Date(task.due_date) < new Date();
                return (
                  <Tooltip key={task.id}>
                    <TooltipTrigger asChild>
                      <motion.div
                        className={`absolute top-1 ${heightClass} rounded-md cursor-pointer
                          ${STATUS_COLORS[task.status] || STATUS_COLORS.not_started}
                          ${isOverdue ? 'ring-2 ring-red-500 animate-pulse' : ''}`}
                        style={{ left: pos.left, width: pos.width }}
                        initial={{ scaleX: 0, originX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: 0.3 }}
                        whileHover={{ y: -2, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-medium">{task.title}</p>
                      <p className="text-xs text-gray-400">
                        {task.category} • {format(parseISO(task.due_date), 'dd/MM')}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

---

## חלק 5: סיכום מפת דרכים ליישום

### שלב 1 — Header (עדיפות גבוהה)
1. הפיכת QuickStats לפילטרים לחיצים (`QuickStats.jsx`)
2. הוספת Daily Progress Bar (`Home.jsx`)
3. החלפת הפס האדום באייקון 🔥 + Sheet (`Layout.jsx`)
4. הוספת Energy Filter (`Layout.jsx`)
5. הוספת Deadline Countdown (`Layout.jsx`)

### שלב 2 — Sidebar (עדיפות גבוהה)
6. הוספת 3 כפתורי Work Mode בראש התפריט (`Layout.jsx`)
7. מבנה תפריט חדש ב-4 קבוצות-על (`Layout.jsx`)
8. הוספת אזור Pinned / Recent Clients (`Layout.jsx`)
9. Sidebar מצומצם כברירת מחדל (`Layout.jsx`)
10. כפתור Focus Mode ב-Header (`Layout.jsx`)

### שלב 3 — Command Bar (עדיפות בינונית)
11. העברת GlobalSearch למרכז ה-Header (`Layout.jsx` + `GlobalSearch.jsx`)
12. הוספת Quick Actions ל-Command Bar (`GlobalSearch.jsx`)
13. חיפוש הקשרי (`GlobalSearch.jsx`)

### שלב 4 — View Switching (עדיפות בינונית)
14. הוספת כפתורי Mind Map + Gantt ל-View Switcher (`Tasks.jsx`, `ClientsDashboard.jsx`, `Home.jsx`)
15. יצירת MindMapView Component (`src/components/views/MindMapView.jsx`)
16. יצירת GanttView Component (`src/components/views/GanttView.jsx`)

---

## חלק 6: שדה client_size (T-Shirt Sizing) — דרישה מקדימה

כדי שה-Mind Map, Gantt, ו-Energy Filter יעבדו כמו שצריך, כל לקוח צריך שדה `size`.

**שדה חדש ב-Client Entity:**
```javascript
{
  size: 'S' | 'M' | 'L' | 'XL',  // גודל הלקוח (T-Shirt Size)
  // הגדרה ב-ClientForm.jsx כ-Select dropdown
}
```

**חישוב אוטומטי (fallback אם אין size ידני):**
```javascript
const estimateClientSize = (client, tasks) => {
  if (client.size) return client.size; // ידני עדיף
  const services = client.service_types?.length || 0;
  const taskCount = tasks.filter(t => t.client_name === client.name).length;
  if (services >= 4 || taskCount >= 8) return 'XL';
  if (services >= 3 || taskCount >= 5) return 'L';
  if (services >= 2 || taskCount >= 3) return 'M';
  return 'S';
};
```

**הוספת שדה estimated_duration ל-Task (אופציונלי):**
```javascript
{
  estimated_duration: number,  // דקות משוערות לביצוע (5, 10, 15, 30, 60, 120)
}
```
משמש את Energy Filter לסינון משימות לפי זמן זמין.

---

## חלק 7: React Context להעברת מצב גלובלי

מכיוון ש-Layout צריך להעביר מצבים (workMode, energyLevel, focusMode) לכל הדפים הפנימיים, נשתמש ב-Context.

**קובץ חדש:** `src/contexts/AppContext.jsx`

```jsx
import React, { createContext, useContext, useState } from 'react';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [workMode, setWorkMode] = useState('doing');
  const [energyLevel, setEnergyLevel] = useState('full');
  const [focusMode, setFocusMode] = useState(false);
  const [activeFilter, setActiveFilter] = useState(null);

  return (
    <AppContext.Provider value={{
      workMode, setWorkMode,
      energyLevel, setEnergyLevel,
      focusMode, setFocusMode,
      activeFilter, setActiveFilter,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
```

**שימוש ב-Layout.jsx:**
```jsx
import { AppProvider } from '@/contexts/AppContext';

// עוטף את כל ה-Layout:
<AppProvider>
  <div dir="rtl" ...>
    ...
  </div>
</AppProvider>
```

**שימוש בדפים (למשל Home.jsx):**
```jsx
import { useApp } from '@/contexts/AppContext';

export default function HomePage() {
  const { energyLevel, activeFilter } = useApp();
  // ... סינון לפי energyLevel ו-activeFilter
}
```

---

## נספח: רשימת כל האייקונים החדשים (lucide-react)

```javascript
import {
  Flame,              // מרכז חירום
  Battery, BatteryLow, BatteryMedium, BatteryFull,  // Energy Filter
  Network,            // Mind Map view icon
  GanttChart,         // Gantt view icon (או GanttChartSquare)
  Maximize2,          // Focus Mode toggle
  Star,               // Pinned clients
  ChevronLeft, ChevronRight,  // Sidebar collapse
} from "lucide-react";
```

> **הערה:** אם `GanttChart` לא קיים ב-lucide-react, להשתמש ב-`BarChart3` או `AlignHorizontalDistributeCenter` כחלופה.

---

## נספח: קבצים שנוצרים / משתנים

| פעולה | קובץ |
|---|---|
| **שינוי** | `src/pages/Layout.jsx` |
| **שינוי** | `src/pages/Home.jsx` |
| **שינוי** | `src/pages/Tasks.jsx` |
| **שינוי** | `src/pages/ClientsDashboard.jsx` |
| **שינוי** | `src/components/tasks/QuickStats.jsx` |
| **שינוי** | `src/components/GlobalSearch.jsx` |
| **שינוי** | `src/components/clients/ClientForm.jsx` (הוספת שדה size) |
| **חדש** | `src/components/views/MindMapView.jsx` |
| **חדש** | `src/components/views/GanttView.jsx` |
| **חדש** | `src/contexts/AppContext.jsx` |
