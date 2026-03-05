import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, useMotionValue } from "framer-motion";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Home, Brain, CheckSquare, Target, BookCheck, DollarSign,
  BarChart3, Settings, Menu, X, Users, Scaling, FileText,
  Soup, BookHeart, Eye, Calendar, BookUser, Calculator, UserCheck, Database,
  ArrowRight, FileBarChart, Repeat, FolderKanban, Zap, StickyNote,
  ChevronLeft, ChevronRight, ChevronDown, Plus, Hourglass, Maximize2, Star,
  BatteryLow, BatteryMedium, BatteryFull, Shield, Upload, CheckCircle, AlertTriangle,
  CalendarPlus, LayoutGrid, TrendingUp, HardDrive, Workflow, Building2, Link2,
  Receipt, FileSignature, Briefcase, FolderOpen, Layers, Import
} from "lucide-react";
import { createPageUrl } from "@/utils";
import { differenceInDays, parseISO } from "date-fns";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import TimeAwareness from "@/components/ui/TimeAwareness";
import StickyNotes from "@/components/StickyNotes";
import GlobalSearch from "@/components/GlobalSearch";
import QuickAddTaskDialog from "@/components/tasks/QuickAddTaskDialog";
import useAutoReminders from "@/hooks/useAutoReminders";
import useBackupMonitor from "@/hooks/useBackupMonitor";
import BackupHealthIndicator from "@/components/BackupHealthIndicator";
import SyncStatusIndicator from "@/components/SyncStatusIndicator";
import { Task, Client } from "@/api/entities";
import { importAllData } from "@/api/base44Client";
import { AppProvider, useApp } from "@/contexts/AppContext";
import RealityCheck from "@/components/tasks/RealityCheck";
import CompletionFeedback from "@/components/tasks/CompletionFeedback";
import DesktopBridge from "@/components/desktop/DesktopBridge";

// Work Modes — aligned to P1-P4 process tree
const WORK_MODES = [
  {
    key: 'doing',
    label: 'ביצוע',
    icon: Zap,
    color: 'bg-emerald-600 text-white',
    description: 'משימות יומיות + דיווחים שוטפים',
    visibleSections: ['p1_payroll', 'p2_bookkeeping', 'p3_doing']
  },
  {
    key: 'planning',
    label: 'תכנון',
    icon: Brain,
    color: 'bg-blue-600 text-white',
    description: 'אוטומציות, הגדרות חוזרות, אפיון עומס',
    visibleSections: ['p3_planning']
  },
  {
    key: 'admin',
    label: 'ניהול',
    icon: Settings,
    color: 'bg-purple-700 text-white',
    description: 'לקוחות + ספקים + ניתוח עסקי',
    visibleSections: ['p3_admin']
  },
];

// ============================================================
// Sidebar sections — P1-P4 Process Tree Hierarchy
// Split P3 into doing/planning/admin for clear separation
// ============================================================
const getSidebarSections = () => ({
  // ── P1 | חשבות שכר ──
  p1_payroll: {
    title: "P1 | חשבות שכר",
    icon: Calculator,
    tabColor: 'border-emerald-600',
    items: [
      { name: "שלב ייצור ואישור", href: createPageUrl("PayrollDashboard"), icon: Zap },
      { name: "דיווחים שוטפים (102)", href: createPageUrl("PayrollReportsDashboard"), icon: FileBarChart },
      { name: "דיווחים תקופתיים", href: createPageUrl("PeriodicSummaryReports"), icon: FileBarChart },
      { name: "שכר - שירותים נוספים", href: createPageUrl("AdditionalServicesDashboard"), icon: LayoutGrid },
    ]
  },
  // ── P2 | הנהלת חשבונות ──
  p2_bookkeeping: {
    title: "P2 | הנהלת חשבונות",
    icon: FileBarChart,
    tabColor: 'border-emerald-600',
    items: [
      { name: "ריכוז דיווחי מיסים", href: createPageUrl("ClientsDashboard"), icon: BarChart3 },
      { name: "דיווחים (מע\"מ ומקדמות)", href: createPageUrl("TaxReportsDashboard"), icon: FileBarChart },
      { name: "התאמות חשבונות", href: createPageUrl("Reconciliations"), icon: BookCheck },
      { name: "תוצרים (רוה\"ס)", href: createPageUrl("FinancialResultsDashboard"), icon: TrendingUp },
      { name: "מאזנים שנתיים", href: createPageUrl("BalanceSheets"), icon: Scaling },
      { name: "שירותים נוספים", href: createPageUrl("BookkeepingExtrasDashboard"), icon: LayoutGrid },
    ]
  },
  // ── P3 | ביצוע (משימות + לו"ז בלבד) ──
  p3_doing: {
    title: "P3 | ביצוע",
    icon: Target,
    tabColor: 'border-emerald-600',
    items: [
      { name: "משימות", href: createPageUrl("Tasks"), icon: CheckSquare },
      { name: "לוח שנה", href: createPageUrl("Calendar"), icon: Calendar },
      { name: "אדמיניסטרציה", href: createPageUrl("AdminTasksDashboard"), icon: FolderKanban },
      { name: "פרויקטים", href: createPageUrl("Projects"), icon: FolderKanban },
    ]
  },
  // ── P3 | תכנון (תשתית עבודה + הגדרות מערכת) ──
  p3_planning: {
    title: "P3 | תכנון",
    icon: Brain,
    tabColor: 'border-blue-600',
    items: [
      { name: "תכנון שבועי", href: createPageUrl("WeeklyPlanningDashboard"), icon: Brain },
      { name: "משימות חוזרות", href: createPageUrl("RecurringTasks"), icon: Repeat },
      { name: "אפיון עומס קוגניטיבי", href: createPageUrl("BatchSetup"), icon: Layers },
    ],
    subGroups: [
      { key: 'p3_automation', label: 'אוטומציה והגדרות', icon: Workflow, items: [
        { name: "כללי אוטומציה", href: createPageUrl("AutomationRules"), icon: Workflow },
        { name: "הגדרות מערכת", href: createPageUrl("Settings"), icon: Settings },
        { name: "גיבויים", href: createPageUrl("BackupManager"), icon: HardDrive },
      ]},
      { key: 'p3_integrations', label: 'חיבורים וייבוא', icon: Link2, items: [
        { name: "חיבור Monday", href: createPageUrl("MondayIntegration"), icon: Link2 },
        { name: "ייבוא נתונים", href: createPageUrl("DataImportTool"), icon: Import },
        { name: "מוכנות מערכת", href: createPageUrl("SystemReadiness"), icon: Shield },
      ]},
    ]
  },
  // ── P3 | ניהול עסקי (לקוחות + ספקים + ניתוח) ──
  p3_admin: {
    title: "P3 | ניהול עסקי",
    icon: Building2,
    tabColor: 'border-purple-700',
    items: [
      { name: "מרכז לקוחות", href: createPageUrl("ClientManagement"), icon: Users },
      { name: "לידים ושיווק", href: createPageUrl("Leads"), icon: Target },
      { name: "מרכז עסקי", href: createPageUrl("BusinessHub"), icon: Building2 },
    ],
    subGroups: [
      { key: 'p3_finance', label: 'כספים וחוזים', icon: Receipt, items: [
        { name: "ניהול שכ\"ט", href: createPageUrl("FeeManagement"), icon: Receipt },
        { name: "חוזי לקוחות", href: createPageUrl("ClientContracts"), icon: FileSignature },
      ]},
      { key: 'p3_resources', label: 'משאבים וניתוח', icon: Briefcase, items: [
        { name: "ספקי שירות", href: createPageUrl("ServiceProviders"), icon: Briefcase },
        { name: "קבצי לקוחות", href: createPageUrl("ClientFiles"), icon: FolderOpen },
        { name: "ניתוח נתונים", href: createPageUrl("Analytics"), icon: BarChart3 },
      ]},
    ]
  },
  // ── P4 | בית (LENA) ──
  life: {
    title: "P4 | בית (LENA)",
    icon: BookHeart,
    tabColor: 'border-[#008291]',
    items: [
      { name: "תכנון ארוחות", href: createPageUrl("MealPlanner"), icon: Soup },
      { name: "השראה וספרים", href: createPageUrl("Inspiration"), icon: BookHeart },
      { name: "הגדרות אישיות", href: createPageUrl("LifeSettings"), icon: Settings },
    ]
  },
});

// Map sidebar sections to their parent work mode for auto-switching
const SECTION_TO_MODE = {
  p1_payroll: 'doing',
  p2_bookkeeping: 'doing',
  p3_doing: 'doing',
  p3_planning: 'planning',
  p3_admin: 'admin',
  life: null, // visible in all modes
};

const getVisibleSections = (mode) => {
  if (mode === 'doing') return ['p1_payroll', 'p2_bookkeeping', 'p3_doing', 'life'];
  if (mode === 'planning') return ['p3_planning', 'life'];
  if (mode === 'admin') return ['p3_admin', 'life'];
  return ['p1_payroll', 'p2_bookkeeping', 'p3_doing', 'p3_planning', 'p3_admin', 'life'];
};

// Deadline countdown
const getNextDeadline = () => {
  const now = new Date();
  const day = now.getDate();
  const month = now.getMonth();
  const year = now.getFullYear();
  let deadline = new Date(year, month, 15);
  if (day > 15) deadline = new Date(year, month + 1, 15);
  const daysLeft = differenceInDays(deadline, now);
  return { daysLeft, label: 'דיווח מע"מ' };
};

// ─── Draggable FAB component (useMotionValue localStorage persist) ─────────
function DraggableFab({ storageKey, children, className = '' }) {
  const fullKey = `calmplan_drag_${storageKey}`;
  const didDrag = React.useRef(false);

  // Read saved position once on mount via useMemo (stable across re-renders)
  const initPos = React.useMemo(() => {
    try {
      const s = localStorage.getItem(fullKey);
      if (s) { const p = JSON.parse(s); if (typeof p.x === 'number') return p; }
    } catch { /* ignore */ }
    return { x: 0, y: 0 };
  }, [fullKey]);

  // MotionValues: Framer Motion's drag mutates these directly — no React state needed
  const mx = useMotionValue(initPos.x);
  const my = useMotionValue(initPos.y);

  const handleDragStart = useCallback(() => { didDrag.current = false; }, []);
  const handleDrag = useCallback(() => { didDrag.current = true; }, []);
  const handleDragEnd = useCallback(() => {
    const cx = mx.get();
    const cy = my.get();
    didDrag.current = true;
    try { localStorage.setItem(fullKey, JSON.stringify({ x: cx, y: cy })); } catch { /* ignore */ }
  }, [fullKey, mx, my]);

  const handleReset = useCallback(() => {
    mx.set(0);
    my.set(0);
    try { localStorage.removeItem(fullKey); } catch { /* ignore */ }
  }, [fullKey, mx, my]);

  const guardClick = useCallback((handler) => (e) => {
    if (didDrag.current) { didDrag.current = false; e.preventDefault(); e.stopPropagation(); return; }
    handler?.(e);
  }, []);

  return (
    <motion.div
      drag
      dragMomentum={false}
      dragElastic={0}
      onDragStart={handleDragStart}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
      style={{ x: mx, y: my }}
      onDoubleClick={handleReset}
      className={`cursor-grab active:cursor-grabbing ${className}`}
    >
      {typeof children === 'function' ? children({ guardClick }) : children}
    </motion.div>
  );
}

function LayoutInner({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { workMode, setWorkMode, energyLevel, setEnergyLevel, focusMode, setFocusMode } = useApp();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState(new Set(['personal_tools', 'p1_payroll', 'p2_bookkeeping', 'p3_doing', 'p3_planning', 'p3_admin', 'life', 'p3_automation', 'p3_integrations', 'p3_finance', 'p3_resources']));
  const [emergencyTasks, setEmergencyTasks] = useState([]);
  const [pinnedClients, setPinnedClients] = useState([]);
  const [recentClients, setRecentClients] = useState([]);
  const [myMenu, setMyMenu] = useState([]);
  const [dailyFocusTasks, setDailyFocusTasks] = useState([]);
  const [importStatus, setImportStatus] = useState(null); // {type, message}
  const importFileRef = useRef(null);

  useAutoReminders();
  const backupHealth = useBackupMonitor();

  const handleImportJsonBackup = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await importAllData(data);
      setImportStatus({ type: 'success', message: 'נתונים יובאו בהצלחה! רענן את הדף לראות את השינויים.' });
      setTimeout(() => setImportStatus(null), 8000);
    } catch (err) {
      console.error('Import failed:', err);
      setImportStatus({ type: 'error', message: `שגיאה בייבוא: ${err.message}` });
      setTimeout(() => setImportStatus(null), 8000);
    }
    e.target.value = '';
  };

  const sidebarSections = getSidebarSections();

  useEffect(() => {
    if (location.pathname === "/") {
      navigate(createPageUrl("Home"));
    }
  }, [location.pathname, navigate]);

  // Load emergency tasks
  useEffect(() => {
    const loadEmergency = async () => {
      try {
        const allTasks = await Task.list("-due_date", 5000).catch(() => []);
        const tasks = Array.isArray(allTasks) ? allTasks : [];
        const now = new Date();
        const emergency = tasks
          .filter(t => {
            if (t.status === 'completed' || t.status === 'not_relevant') return false;
            const due = t.due_date ? parseISO(t.due_date) : null;
            if (!due) return false;
            return differenceInDays(due, now) <= 0;
          })
          .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
          .slice(0, 5);
        setEmergencyTasks(emergency);
      } catch { setEmergencyTasks([]); }
    };
    loadEmergency();
  }, []);

  // Load pinned/recent clients
  useEffect(() => {
    const saved = localStorage.getItem('calmplan_pinned_clients');
    if (saved) {
      try { setPinnedClients(JSON.parse(saved)); } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    const loadRecent = async () => {
      try {
        const clients = await Client.list('-updated_date', 5).catch(() => []);
        const pinnedIds = new Set(pinnedClients.map(c => c.id));
        const notPinned = (clients || []).filter(c => !pinnedIds.has(c.id)).slice(0, 5 - pinnedClients.length);
        setRecentClients(notPinned);
      } catch { setRecentClients([]); }
    };
    loadRecent();
  }, [pinnedClients]);

  // Load My Menu from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('calmplan_my_menu');
    if (saved) {
      try { setMyMenu(JSON.parse(saved)); } catch { /* ignore */ }
    } else {
      // Default items
      const defaults = [createPageUrl("Tasks"), createPageUrl("Calendar"), createPageUrl("Home")];
      setMyMenu(defaults);
      localStorage.setItem('calmplan_my_menu', JSON.stringify(defaults));
    }
  }, []);

  // Load Daily Focus tasks (due today, not done)
  useEffect(() => {
    const loadDailyFocus = async () => {
      try {
        const allTasks = await Task.list("-due_date", 5000).catch(() => []);
        const tasks = Array.isArray(allTasks) ? allTasks : [];
        const today = new Date().toISOString().split('T')[0];
        const todayTasks = tasks
          .filter(t => t.status !== 'completed' && t.status !== 'not_relevant' && t.due_date === today)
          .slice(0, 5);
        setDailyFocusTasks(todayTasks);
      } catch { setDailyFocusTasks([]); }
    };
    loadDailyFocus();
  }, []);

  const toggleMyMenu = useCallback((href) => {
    setMyMenu(prev => {
      const next = prev.includes(href) ? prev.filter(h => h !== href) : [...prev, href];
      localStorage.setItem('calmplan_my_menu', JSON.stringify(next));
      return next;
    });
  }, []);

  const isActive = (href) => location.pathname.startsWith(href);

  const findPageTitle = () => {
    if (location.pathname === createPageUrl("Home")) return 'פוקוס יומי';
    for (const section of Object.values(sidebarSections)) {
      for (const item of section.items) {
        if (item.href && location.pathname.startsWith(item.href)) return item.name;
      }
    }
    return 'LitayCalmPlan';
  };

  const isHomePage = location.pathname === createPageUrl("Home");
  const emergencyCount = emergencyTasks.length;
  const { daysLeft, label: deadlineLabel } = getNextDeadline();

  return (
    <TooltipProvider>
    {/* Desktop Bridge - connects React with Electron native features */}
    {window.calmplanDesktop && (
      <DesktopBridge
        currentTask={emergencyTasks[0] || null}
        tasks={emergencyTasks}
      />
    )}
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      <div className="h-screen flex flex-col">
        {/* === TOP HEADER BAR === */}
        <header className="border-b border-[#B0BEC5] px-3 py-1 flex items-center justify-between sticky top-0 z-50 shadow-xl" style={{ backgroundColor: '#FFFFFF' }}>
          {/* Right: Logo + Mobile menu */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="md:hidden h-7 w-7" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
              {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </Button>
            <Link to={createPageUrl("Home")} className="flex items-center gap-1.5">
              <div className="w-7 h-7 rounded-md flex items-center justify-center shadow-sm" style={{ background: 'linear-gradient(135deg, #008291, #00acc1)' }}>
                <Brain className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-sm font-bold hidden md:block" style={{ color: '#008291' }}>CalmPlan</h1>
            </Link>
          </div>

          {/* Center: Global Search */}
          <div className="flex-1 max-w-md mx-4 hidden md:block">
            <GlobalSearch />
          </div>

          {/* Left: Header actions */}
          <div className="flex items-center gap-2">
            {/* Deadline Countdown */}
            <Badge variant={daysLeft <= 3 ? "destructive" : "secondary"} className="text-xs hidden md:inline-flex">
              עוד {daysLeft} ימים ל{deadlineLabel}
            </Badge>

            {/* Energy Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  {energyLevel === 'low' && <BatteryLow className="w-5 h-5 text-amber-500" />}
                  {energyLevel === 'medium' && <BatteryMedium className="w-5 h-5 text-yellow-500" />}
                  {energyLevel === 'full' && <BatteryFull className="w-5 h-5 text-green-500" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEnergyLevel('low')}>
                  <BatteryLow className="w-4 h-4 ml-2 text-amber-500" />
                  סוללה נמוכה - רק משימות של 5-10 דקות
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setEnergyLevel('medium')}>
                  <BatteryMedium className="w-4 h-4 ml-2 text-yellow-500" />
                  אנרגיה בינונית - משימות S ו-M
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setEnergyLevel('full')}>
                  <BatteryFull className="w-4 h-4 ml-2 text-green-500" />
                  אנרגיה מלאה - הכל מוצג
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Emergency Center (Hourglass, calm amber/purple) */}
            <Sheet>
              <SheetTrigger asChild>
                <button className="relative p-2 rounded-lg hover:bg-amber-50 transition-colors">
                  <Hourglass className="w-5 h-5 text-purple-500" />
                  {emergencyCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-purple-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {emergencyCount}
                    </span>
                  )}
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[380px] border-l border-[#B0BEC5] rounded-l-[32px]" style={{ backgroundColor: '#FFFFFF' }}>
                <SheetHeader>
                  <SheetTitle className="text-purple-700 flex items-center gap-2">
                    <Hourglass className="w-5 h-5" /> משימות ממתינות לטיפול
                  </SheetTitle>
                </SheetHeader>
                <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                  {emergencyCount} משימות עברו את מועד הדיווח ודורשות תשומת לב
                </div>
                <div className="mt-4 space-y-3">
                  {emergencyTasks.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-8">אין משימות שדורשות תשומת לב</p>
                  ) : (
                    emergencyTasks.map(task => (
                      <Card key={task.id} className="border-r-4 border-purple-400 cursor-pointer hover:bg-purple-50"
                            onClick={() => navigate(createPageUrl("Tasks"))}>
                        <CardContent className="p-3">
                          <p className="font-medium text-sm">{task.title}</p>
                          <p className="text-xs text-slate-500">{task.client_name} {task.due_date && `\u2022 ${task.due_date}`}</p>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </SheetContent>
            </Sheet>

            {/* Focus Mode */}
            <Button variant="ghost" size="icon" onClick={() => setFocusMode(!focusMode)}
              className={focusMode ? 'bg-emerald-100 text-emerald-700' : ''}>
              <Maximize2 className="w-5 h-5" />
            </Button>

            <SyncStatusIndicator />
            <BackupHealthIndicator health={backupHealth} />
          </div>
        </header>

        {/* === MOBILE SIDEBAR === */}
        {isMobileMenuOpen && (
          <>
            <div className="md:hidden fixed inset-0 bg-black/40 z-30" onClick={() => setIsMobileMenuOpen(false)} />
            <div className="md:hidden fixed inset-y-0 right-0 z-40 w-72 bg-white border-l-2 border-[#B0BEC5] shadow-xl overflow-y-auto">
              <div className="p-4 border-b border-[#B0BEC5] flex items-center justify-between">
                <Link to={createPageUrl("Home")} className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
                    <Brain className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <h1 className="text-lg font-bold">CalmPlan</h1>
                </Link>
                <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
              <div className="px-4 pt-2 pb-0 text-center">
                <p className="block font-black text-2xl py-6 text-center text-transparent bg-clip-text bg-gradient-to-r from-[#008291] to-[#00acc1]">✨ עשוי טוב יותר ממושלם</p>
              </div>

              {/* Mobile search */}
              <div className="px-4 py-2">
                <GlobalSearch />
              </div>

              {/* Work Mode Selector */}
              <div className="px-3 py-2 border-b border-[#B0BEC5]">
                <div className="flex gap-1">
                  {WORK_MODES.map(mode => (
                    <button
                      key={mode.key}
                      onClick={() => setWorkMode(mode.key)}
                      className={`flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-[32px] text-xs font-medium transition-all
                        ${workMode === mode.key ? mode.color + ' shadow-md' : 'bg-[#F5F5F5] text-[#37474F] hover:bg-[#E8F5F7]'}`}
                    >
                      <mode.icon className="w-4 h-4" />
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mobile navigation — Accordion */}
              <nav className="p-2">
                <Link to={createPageUrl("Home")}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors mb-2
                    ${isActive(createPageUrl("Home")) ? 'bg-[#E8F5F7] text-[#008291]' : 'text-[#000000] hover:bg-[#F5F5F5]'}`}>
                  <Eye className="w-4 h-4" />
                  פוקוס יומי
                </Link>
                {Object.entries(sidebarSections)
                  .filter(([key]) => getVisibleSections(workMode).includes(key))
                  .map(([key, section]) => {
                    const isOpen = !collapsedSections.has(key);
                    return (
                    <div key={key} className="mb-1">
                      <button
                        onClick={() => setCollapsedSections(prev => {
                          const next = new Set(prev);
                          if (next.has(key)) next.delete(key); else next.add(key);
                          return next;
                        })}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-bold text-[#000000] hover:bg-[#F5F5F5] transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <section.icon className="w-4 h-4 text-[#008291]" />
                          <span>{section.title}</span>
                        </div>
                        <ChevronDown className={`w-3.5 h-3.5 text-[#455A64] transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                      </button>
                      {isOpen && (
                        <>
                          {section.items.map(item => (
                            <Link key={item.href} to={item.href}
                              onClick={() => {
                                setIsMobileMenuOpen(false);
                                const targetMode = SECTION_TO_MODE[key];
                                if (targetMode && targetMode !== workMode) setWorkMode(targetMode);
                              }}
                              className={`flex items-center gap-2 px-6 py-1.5 rounded-xl text-sm transition-colors
                                ${isActive(item.href) ? 'bg-[#E8F5F7] text-[#008291] font-bold' : 'text-[#000000] hover:bg-[#F5F5F5]'}`}>
                              <item.icon className="w-3.5 h-3.5" />
                              {item.name}
                            </Link>
                          ))}
                          {section.subGroups?.map(sg => {
                            const sgOpen = !collapsedSections.has(sg.key);
                            return (
                              <div key={sg.key} className="mr-3">
                                <button
                                  onClick={() => setCollapsedSections(prev => {
                                    const next = new Set(prev);
                                    if (next.has(sg.key)) next.delete(sg.key); else next.add(sg.key);
                                    return next;
                                  })}
                                  className="w-full flex items-center justify-between px-6 py-1.5 text-xs font-bold text-[#37474F] hover:bg-[#F5F5F5] rounded-xl"
                                >
                                  <div className="flex items-center gap-1.5">
                                    <sg.icon className="w-3 h-3 text-[#546E7A]" />
                                    <span>{sg.label}</span>
                                  </div>
                                  <ChevronDown className={`w-3 h-3 text-[#455A64] transition-transform ${sgOpen ? '' : '-rotate-90'}`} />
                                </button>
                                {sgOpen && sg.items.map(item => (
                                  <Link key={item.href} to={item.href}
                                    onClick={() => {
                                      setIsMobileMenuOpen(false);
                                      const targetMode = SECTION_TO_MODE[key];
                                      if (targetMode && targetMode !== workMode) setWorkMode(targetMode);
                                    }}
                                    className={`flex items-center gap-2 px-8 py-1 rounded-xl text-sm transition-colors
                                      ${isActive(item.href) ? 'bg-[#E8F5F7] text-[#008291] font-bold' : 'text-[#000000] hover:bg-[#F5F5F5]'}`}>
                                    <item.icon className="w-3 h-3" />
                                    {item.name}
                                  </Link>
                                ))}
                              </div>
                            );
                          })}
                        </>
                      )}
                    </div>
                    );
                  })}
              </nav>
            </div>
          </>
        )}

        {/* === DESKTOP: Resizable Sidebar + Main Content === */}
        <ResizablePanelGroup direction="horizontal" className="flex-1">
          {/* === SIDEBAR PANEL (Desktop only, hidden on mobile) === */}
          {!focusMode && (
            <>
              <ResizablePanel
                defaultSize={sidebarCollapsed ? 4 : 15}
                minSize={sidebarCollapsed ? 4 : 10}
                maxSize={sidebarCollapsed ? 4 : 22}
                collapsible={false}
                className="hidden md:flex"
                style={{ overflow: 'hidden' }}
              >
                <aside className="flex flex-col border-l border-[#B0BEC5] shadow-xl h-full w-full" style={{ backgroundColor: '#FFFFFF' }}>

                  {/* Toggle button */}
                  <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                    className="self-start p-2 m-2 rounded-[32px] hover:bg-[#E0E0E0] transition-colors">
                    {sidebarCollapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>

                  {sidebarCollapsed ? (
                    /* Collapsed: icons only */
                    <div className="flex flex-col items-center gap-1 py-2 overflow-y-auto flex-1">
                      {/* Work Mode indicators */}
                      {WORK_MODES.map(mode => (
                        <Tooltip key={mode.key}>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => setWorkMode(mode.key)}
                              className={`p-2 rounded-[32px] transition-all ${workMode === mode.key ? mode.color + ' shadow-md' : 'text-[#455A64] hover:bg-[#E0E0E0]'}`}
                            >
                              <mode.icon className="w-4 h-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="left">{mode.label}</TooltipContent>
                        </Tooltip>
                      ))}
                      <div className="w-8 border-b border-[#B0BEC5] my-1" />
                      {/* Nav icons */}
                      {Object.entries(sidebarSections)
                        .filter(([key]) => getVisibleSections(workMode).includes(key))
                        .map(([, section]) => (
                          section.items.map(item => (
                            <Tooltip key={item.href}>
                              <TooltipTrigger asChild>
                                <Link to={item.href} className={`p-2 rounded-[32px] transition-colors
                                  ${isActive(item.href) ? 'bg-[#E8F5F7] text-[#008291]' : 'text-[#455A64] hover:bg-[#E0E0E0] hover:text-[#37474F]'}`}>
                                  <item.icon className="w-5 h-5" />
                                </Link>
                              </TooltipTrigger>
                              <TooltipContent side="left">{item.name}</TooltipContent>
                            </Tooltip>
                          ))
                        ))}
                    </div>
                  ) : (
                    /* Expanded: full sidebar */
                    <div className="flex flex-col flex-1 overflow-y-auto">
                      {/* Mantra — very top of sidebar */}
                      <div className="px-3 pt-3 pb-1 text-center">
                        <p className="block font-black text-2xl py-6 text-center text-transparent bg-clip-text bg-gradient-to-r from-[#008291] to-[#00acc1]">✨ עשוי טוב יותר ממושלם</p>
                      </div>

                      {/* Work Mode Selector */}
                      <div className="px-3 py-2 border-b border-[#B0BEC5]">
                        <div className="flex gap-1">
                          {WORK_MODES.map(mode => (
                            <button
                              key={mode.key}
                              onClick={() => setWorkMode(mode.key)}
                              className={`flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-[32px] text-xs font-medium transition-all
                                ${workMode === mode.key ? mode.color + ' shadow-md scale-105' : 'bg-[#F5F5F5] text-[#37474F] hover:bg-[#E8F5F7]'}`}
                            >
                              <mode.icon className="w-4 h-4" />
                              {mode.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* כלים אישיים — Collapsible accordion for pinned clients + my menu */}
                      {(pinnedClients.length > 0 || myMenu.length > 0) && (
                        <div className="px-2 py-1">
                          <button
                            onClick={() => setCollapsedSections(prev => {
                              const next = new Set(prev);
                              if (next.has('personal_tools')) next.delete('personal_tools'); else next.add('personal_tools');
                              return next;
                            })}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-bold text-[#000000] hover:bg-[#F5F5F5] transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <Star className="w-4 h-4 text-[#008291]" />
                              <span>כלים אישיים</span>
                            </div>
                            <ChevronDown className={`w-3.5 h-3.5 text-[#455A64] transition-transform ${!collapsedSections.has('personal_tools') ? '' : '-rotate-90'}`} />
                          </button>
                          {!collapsedSections.has('personal_tools') && (
                            <div className="mr-3 border-r-2 border-[#E0E0E0] pr-1 mt-0.5 mb-1">
                              {/* Pinned Clients */}
                              {pinnedClients.length > 0 && (
                                <>
                                  <h4 className="text-[10px] font-bold text-[#455A64] px-3 pt-1 pb-0.5">גישה מהירה</h4>
                                  {pinnedClients.slice(0, 8).map(client => (
                                    <Link key={client.id}
                                      to={`${createPageUrl('ClientManagement')}?clientId=${client.id}`}
                                      onClick={() => setIsMobileMenuOpen(false)}
                                      className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm text-[#000000] hover:bg-[#F5F5F5] transition-colors">
                                      <div className="w-2 h-2 rounded-full bg-emerald-400" />
                                      {client.name}
                                    </Link>
                                  ))}
                                </>
                              )}
                              {/* My Menu */}
                              {myMenu.length > 0 && (
                                <>
                                  <h4 className="text-[10px] font-bold text-[#455A64] px-3 pt-1 pb-0.5">התפריט שלי</h4>
                                  {myMenu.map(href => {
                                    let menuItem = null;
                                    for (const section of Object.values(sidebarSections)) {
                                      menuItem = section.items.find(i => i.href === href);
                                      if (menuItem) break;
                                    }
                                    if (!menuItem) return null;
                                    return (
                                      <Link key={href} to={href}
                                        onClick={() => setIsMobileMenuOpen(false)}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm transition-colors
                                          ${isActive(href) ? 'bg-[#E8F5F7] text-[#008291] font-bold' : 'text-[#000000] hover:bg-[#F5F5F5]'}`}>
                                        <menuItem.icon className="w-3.5 h-3.5" />
                                        {menuItem.name}
                                      </Link>
                                    );
                                  })}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Navigation sections — Accordion */}
                      <nav className="flex-1 p-2">
                        {/* Daily Focus — single entry point (no duplication) */}
                        <Link to={createPageUrl("Home")}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors mb-2
                            ${isActive(createPageUrl("Home")) ? 'bg-[#E8F5F7] text-[#008291]' : 'text-[#000000] hover:bg-[#F5F5F5]'}`}>
                          <Eye className="w-4 h-4" />
                          פוקוס יומי
                          {dailyFocusTasks.length > 0 && (
                            <Badge className="text-[9px] bg-rose-100 text-rose-700 px-1.5 py-0">{dailyFocusTasks.length}</Badge>
                          )}
                        </Link>

                        {Object.entries(sidebarSections)
                          .filter(([key]) => getVisibleSections(workMode).includes(key))
                          .map(([key, section]) => {
                            const isOpen = !collapsedSections.has(key);
                            return (
                              <div key={key} className="mb-1">
                                <button
                                  onClick={() => setCollapsedSections(prev => {
                                    const next = new Set(prev);
                                    if (next.has(key)) next.delete(key); else next.add(key);
                                    return next;
                                  })}
                                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-bold text-[#000000] hover:bg-[#F5F5F5] transition-colors border-r-3 ${section.tabColor || ''}`}
                                >
                                  <div className="flex items-center gap-2">
                                    <section.icon className="w-4 h-4 text-[#008291]" />
                                    <span>{section.title}</span>
                                  </div>
                                  <ChevronDown className={`w-3.5 h-3.5 text-[#455A64] transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                                </button>
                                {isOpen && (
                                  <div className="mr-3 border-r-2 border-[#E0E0E0] pr-1 mt-0.5 mb-1">
                                    {section.items.map(item => (
                                      <div key={item.href} className="flex items-center group">
                                        <Link to={item.href}
                                          onClick={() => {
                                            setIsMobileMenuOpen(false);
                                            const targetMode = SECTION_TO_MODE[key];
                                            if (targetMode && targetMode !== workMode) {
                                              setWorkMode(targetMode);
                                            }
                                          }}
                                          className={`flex-1 flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm transition-colors
                                            ${isActive(item.href) ? 'bg-[#E8F5F7] text-[#008291] font-bold' : 'text-[#000000] hover:bg-[#F5F5F5]'}`}>
                                          <item.icon className="w-3.5 h-3.5" />
                                          {item.name}
                                        </Link>
                                        <button
                                          onClick={() => toggleMyMenu(item.href)}
                                          className="p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#E0E0E0]"
                                          title={myMenu.includes(item.href) ? 'הסר מהתפריט שלי' : 'הוסף לתפריט שלי'}
                                        >
                                          <Star className="w-3 h-3" style={{ color: myMenu.includes(item.href) ? '#F59E0B' : '#D1D5DB', fill: myMenu.includes(item.href) ? '#F59E0B' : 'none' }} />
                                        </button>
                                      </div>
                                    ))}
                                    {/* Sub-group folders (max 5 items per level) */}
                                    {section.subGroups?.map(sg => {
                                      const sgOpen = !collapsedSections.has(sg.key);
                                      return (
                                        <div key={sg.key} className="mt-0.5">
                                          <button
                                            onClick={() => setCollapsedSections(prev => {
                                              const next = new Set(prev);
                                              if (next.has(sg.key)) next.delete(sg.key); else next.add(sg.key);
                                              return next;
                                            })}
                                            className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-bold text-[#37474F] hover:bg-[#F5F5F5] transition-colors"
                                          >
                                            <div className="flex items-center gap-1.5">
                                              <sg.icon className="w-3 h-3 text-[#546E7A]" />
                                              <span>{sg.label}</span>
                                            </div>
                                            <ChevronDown className={`w-3 h-3 text-[#455A64] transition-transform ${sgOpen ? '' : '-rotate-90'}`} />
                                          </button>
                                          {sgOpen && (
                                            <div className="mr-3 border-r-2 border-[#E8F5F7] pr-1">
                                              {sg.items.map(item => (
                                                <div key={item.href} className="flex items-center group">
                                                  <Link to={item.href}
                                                    onClick={() => {
                                                      setIsMobileMenuOpen(false);
                                                      const targetMode = SECTION_TO_MODE[key];
                                                      if (targetMode && targetMode !== workMode) setWorkMode(targetMode);
                                                    }}
                                                    className={`flex-1 flex items-center gap-2 px-3 py-1 rounded-xl text-sm transition-colors
                                                      ${isActive(item.href) ? 'bg-[#E8F5F7] text-[#008291] font-bold' : 'text-[#000000] hover:bg-[#F5F5F5]'}`}>
                                                    <item.icon className="w-3 h-3" />
                                                    {item.name}
                                                  </Link>
                                                  <button
                                                    onClick={() => toggleMyMenu(item.href)}
                                                    className="p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#E0E0E0]"
                                                    title={myMenu.includes(item.href) ? 'הסר מהתפריט שלי' : 'הוסף לתפריט שלי'}
                                                  >
                                                    <Star className="w-3 h-3" style={{ color: myMenu.includes(item.href) ? '#F59E0B' : '#D1D5DB', fill: myMenu.includes(item.href) ? '#F59E0B' : 'none' }} />
                                                  </button>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </nav>
                    </div>
                  )}
                </aside>
              </ResizablePanel>

              {/* Drag handle between sidebar and main — visible only when sidebar expanded */}
              {!sidebarCollapsed && (
                <ResizableHandle
                  withHandle
                  className="hidden md:flex border-l border-[#B0BEC5] bg-[#F5F5F5] hover:bg-[#E0E0E0] transition-colors w-[6px]"
                />
              )}
            </>
          )}

          {/* === MAIN CONTENT PANEL === */}
          <ResizablePanel defaultSize={focusMode || sidebarCollapsed ? 96 : 85} minSize={60}>
            <main className="flex flex-col min-h-0 h-full">
              {/* Desktop sub-header (page title + back) */}
              {!isHomePage && (
                <div className="hidden md:block p-4 border-b border-[#B0BEC5]" style={{ backgroundColor: '#FAFBFC' }}>
                  <div className="max-w-full mx-auto flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-foreground">{findPageTitle()}</h2>
                    <Link to={createPageUrl("Home")}>
                      <Button variant="outline" className="flex items-center gap-2">
                        <ArrowRight className="w-4 h-4" />
                        חזור לדף הבית
                      </Button>
                    </Link>
                  </div>
                </div>
              )}

              {/* Mobile sub-header */}
              {!isHomePage && (
                <div className="md:hidden px-4 py-3 border-b border-[#B0BEC5]" style={{ backgroundColor: '#FAFBFC' }}>
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-foreground">{findPageTitle()}</h2>
                    <Link to={createPageUrl("Home")}>
                      <Button variant="outline" size="sm" className="flex items-center gap-2">
                        <ArrowRight className="w-4 h-4" />
                        חזור לבית
                      </Button>
                    </Link>
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-auto p-1.5 md:p-2 flex flex-col" style={{ backgroundColor: '#F9FAFB' }}>
                <div className="w-full flex-1 flex flex-col min-h-0">
                  <TimeAwareness />

                  {/* Backup import moved to BackupManager page exclusively */}

                  <div className="flex-1 min-h-0">
                    {children}
                  </div>
                </div>
              </div>
            </main>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Reality Check & Completion Feedback */}
      <RealityCheck />
      <CompletionFeedback />

      {/* Floating Add Event FAB — draggable, always visible */}
      <DraggableFab storageKey="fab_add_event" className="fixed bottom-5 left-[8.5rem] z-[9999]">
        {({ guardClick }) => (
          <button
            onClick={guardClick(() => navigate(createPageUrl("NewEvent")))}
            className="w-11 h-11 rounded-full shadow-xl flex items-center justify-center bg-[#006064] hover:bg-[#004d40] text-white ring-2 ring-white/50 select-none"
            title="הוסף אירוע • גרור לשינוי מיקום • לחיצה כפולה לאיפוס"
          >
            <CalendarPlus className="w-5 h-5" />
          </button>
        )}
      </DraggableFab>

      {/* Floating Quick Add Task FAB — draggable, always visible */}
      <DraggableFab storageKey="fab_quick_add" className="fixed bottom-5 left-[4.5rem] z-[9999]">
        {({ guardClick }) => (
          <button
            onClick={guardClick(() => setShowQuickAdd(true))}
            className="w-11 h-11 rounded-full shadow-xl flex items-center justify-center bg-emerald-500 hover:bg-emerald-600 text-white ring-2 ring-white/50 select-none"
            title="משימה מהירה • גרור לשינוי מיקום • לחיצה כפולה לאיפוס"
          >
            <Plus className="w-5 h-5" />
          </button>
        )}
      </DraggableFab>

      {/* Floating Sticky Notes FAB — draggable, always visible */}
      <DraggableFab storageKey="fab_notes" className="fixed bottom-5 left-5 z-[9999]">
        {({ guardClick }) => (
          <button
            onClick={guardClick(() => setNotesOpen(!notesOpen))}
            className={`w-11 h-11 rounded-full shadow-xl flex items-center justify-center ring-2 ring-white/50 select-none ${
              notesOpen
                ? 'bg-[#008291] hover:bg-[#006d7a] text-white'
                : 'bg-amber-500 hover:bg-amber-600 text-white'
            }`}
            title={notesOpen ? 'סגור פתקים' : 'פתח פתקים • גרור לשינוי מיקום • לחיצה כפולה לאיפוס'}
          >
            {notesOpen ? <X className="w-4 h-4" /> : <StickyNote className="w-4 h-4" />}
          </button>
        )}
      </DraggableFab>

      {/* Global Quick Add Task Dialog */}
      <QuickAddTaskDialog
        open={showQuickAdd}
        onOpenChange={setShowQuickAdd}
        onCreated={() => {}}
      />

      {/* Floating Sticky Notes Panel */}
      {notesOpen && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setNotesOpen(false)} />
          <div
            className="fixed bottom-20 left-4 z-50 w-[320px] max-w-[calc(100vw-2rem)] max-h-[70vh] bg-white border-2 border-[#B0BEC5] rounded-[32px] shadow-2xl flex flex-col overflow-hidden"
            style={{ direction: 'rtl' }}
          >
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-l from-amber-100 to-amber-50 border-b border-amber-200 shrink-0">
              <div className="flex items-center gap-2">
                <StickyNote className="w-5 h-5 text-amber-600" />
                <span className="font-bold text-amber-800">פתקים דביקים</span>
              </div>
              <button onClick={() => setNotesOpen(false)} className="p-1 rounded-lg hover:bg-amber-200 transition-colors">
                <X className="w-4 h-4 text-amber-600" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain p-3" style={{ scrollBehavior: 'smooth' }}>
              <StickyNotes compact={false} />
            </div>
          </div>
        </>
      )}
    </div>
    </TooltipProvider>
  );
}

export default function Layout({ children, currentPageName }) {
  return (
    <AppProvider>
      <LayoutInner>{children}</LayoutInner>
    </AppProvider>
  );
}
