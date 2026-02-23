import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Home, Brain, CheckSquare, Target, BookCheck, DollarSign,
  BarChart3, Settings, Menu, X, Users, Scaling, FileText,
  Soup, BookHeart, Eye, Calendar, BookUser, Calculator, UserCheck, Database,
  ArrowRight, FileBarChart, Repeat, FolderKanban, Zap, StickyNote,
  ChevronLeft, ChevronRight, Plus, Hourglass, Maximize2, Star,
  BatteryLow, BatteryMedium, BatteryFull, Shield, Upload, CheckCircle, AlertTriangle
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

// Work Modes
const WORK_MODES = [
  {
    key: 'doing',
    label: 'ביצוע',
    icon: Zap,
    color: 'bg-emerald-500 text-white',
    description: 'קנבן + משימות להיום',
    visibleSections: ['core', 'reporting']
  },
  {
    key: 'planning',
    label: 'תכנון',
    icon: Brain,
    color: 'bg-blue-500 text-white',
    description: 'תכנון שבועי + מעקב',
    visibleSections: ['planning']
  },
  {
    key: 'admin',
    label: 'ניהול',
    icon: Settings,
    color: 'bg-gray-500 text-white',
    description: 'לקוחות + ספקים + הגדרות',
    visibleSections: ['clients', 'system']
  },
];

// Sidebar sections – 6 clear categories
const getSidebarSections = () => ({
  core: {
    title: "ליבת הביצוע",
    icon: Target,
    items: [
      { name: "פוקוס יומי", href: createPageUrl("Home"), icon: Eye },
      { name: "משימות", href: createPageUrl("Tasks"), icon: CheckSquare },
      { name: "לוח שנה", href: createPageUrl("Calendar"), icon: Calendar },
      { name: "ריכוז לקוחות חודשי", href: createPageUrl("ClientsDashboard"), icon: BarChart3 },
    ]
  },
  reporting: {
    title: "דיווחים",
    icon: FileBarChart,
    items: [
      { name: "דיווחי מיסים", href: createPageUrl("TaxReportsDashboard"), icon: FileBarChart },
      { name: "שכר ודיווחי רשויות", href: createPageUrl("PayrollDashboard"), icon: Calculator },
      { name: "דיווחים תקופתיים", href: createPageUrl("PeriodicSummaryReports"), icon: FileBarChart },
      { name: "מאזנים שנתיים", href: createPageUrl("BalanceSheets"), icon: Scaling },
      { name: "התאמות חשבונות", href: createPageUrl("Reconciliations"), icon: BookCheck },
      { name: "שירותים נוספים", href: createPageUrl("AdditionalServicesDashboard"), icon: Settings },
      { name: "אדמיניסטרטיבי", href: createPageUrl("AdminTasksDashboard"), icon: FolderKanban },
    ]
  },
  planning: {
    title: "תכנון",
    icon: Brain,
    items: [
      { name: "תכנון שבועי", href: createPageUrl("WeeklyPlanningDashboard"), icon: Brain },
      { name: "סיכום שבועי", href: createPageUrl("WeeklySummary"), icon: FileBarChart },
      { name: "מעקב פרויקטים", href: createPageUrl("Projects"), icon: FolderKanban },
      { name: "אוטומציות", href: createPageUrl("AutomationRules"), icon: Zap },
      { name: "משימות חוזרות", href: createPageUrl("RecurringTasks"), icon: Repeat },
    ]
  },
  clients: {
    title: "ניהול לקוחות",
    icon: Users,
    items: [
      { name: "מרכז לקוחות", href: createPageUrl("ClientManagement"), icon: Users },
      { name: "לידים", href: createPageUrl("Leads"), icon: Target },
      { name: "קליטת לקוח חדש", href: createPageUrl("ClientOnboarding"), icon: UserCheck },
      { name: "מרכז נתוני שכ״ט", href: createPageUrl("FeeManagement"), icon: DollarSign },
      { name: "ניהול גבייה", href: createPageUrl("Collections"), icon: DollarSign },
      { name: "ספקים ונותני שירותים", href: createPageUrl("ServiceProviders"), icon: BookUser },
      { name: "ניהול חוזים", href: createPageUrl("ClientContracts"), icon: FileText },
    ]
  },
  system: {
    title: "מערכת",
    icon: Settings,
    items: [
      { name: "אשף הגדרת נתונים", href: createPageUrl("SystemReadiness"), icon: Zap },
      { name: "הגדרת מורכבות לקוחות", href: createPageUrl("BatchSetup"), icon: Scaling },
      { name: "הגדרת פרמטרים", href: createPageUrl("Settings"), icon: Settings },
      { name: "גיבוי ושחזור", href: createPageUrl("BackupManager"), icon: Shield },
      { name: "ייבוא נתונים", href: createPageUrl("DataImportTool"), icon: Database },
      { name: "סקירת מערכת", href: createPageUrl("SystemOverview"), icon: Eye },
      { name: "שחזור חירום", href: createPageUrl("EmergencyRecovery"), icon: AlertTriangle },
    ]
  },
  life: {
    title: "LENA - בית וחיים",
    icon: BookHeart,
    items: [
      { name: "תכנון ארוחות", href: createPageUrl("MealPlanner"), icon: Soup },
      { name: "השראה וספרים", href: createPageUrl("Inspiration"), icon: BookHeart },
      { name: "הגדרות אישיות", href: createPageUrl("LifeSettings"), icon: Settings },
    ]
  },
});

const getVisibleSections = (mode) => {
  const modeConfig = WORK_MODES.find(m => m.key === mode);
  return [...modeConfig.visibleSections, 'life'];
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

// ─── Draggable FAB component (localStorage persist) ─────────
function DraggableFab({ storageKey, children, className = '', onDoubleClick: externalDblClick }) {
  const fullKey = `calmplan_drag_${storageKey}`;
  const didDrag = React.useRef(false);
  const nodeRef = React.useRef(null);
  const savedPos = React.useRef(() => {
    try {
      const s = localStorage.getItem(fullKey);
      if (s) return JSON.parse(s);
    } catch { /* ignore */ }
    return { x: 0, y: 0 };
  });
  if (typeof savedPos.current === 'function') savedPos.current = savedPos.current();
  const [resetKey, setResetKey] = useState(0);

  const handleDragStart = useCallback(() => { didDrag.current = false; }, []);
  const handleDrag = useCallback(() => { didDrag.current = true; }, []);
  const handleDragEnd = useCallback((_, info) => {
    const dist = Math.abs(info.offset.x) + Math.abs(info.offset.y);
    if (dist < 3) { didDrag.current = false; return; }
    didDrag.current = true;
    const prev = savedPos.current;
    const next = { x: prev.x + info.offset.x, y: prev.y + info.offset.y };
    savedPos.current = next;
    try { localStorage.setItem(fullKey, JSON.stringify(next)); } catch { /* ignore */ }
  }, [fullKey]);
  const handleReset = useCallback(() => {
    savedPos.current = { x: 0, y: 0 };
    try { localStorage.removeItem(fullKey); } catch { /* ignore */ }
    setResetKey(k => k + 1); // force re-mount to re-apply initial={0,0}
  }, [fullKey]);
  const guardClick = useCallback((handler) => (e) => {
    if (didDrag.current) { didDrag.current = false; e.preventDefault(); e.stopPropagation(); return; }
    handler?.(e);
  }, []);

  return (
    <motion.div
      key={resetKey}
      ref={nodeRef}
      drag
      dragMomentum={false}
      dragElastic={0}
      onDragStart={handleDragStart}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
      initial={savedPos.current}
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
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
        <header className="border-b border-gray-200 px-3 py-1 flex items-center justify-between sticky top-0 z-50 shadow-sm" style={{ backgroundColor: '#f8fdfd' }}>
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
              <SheetContent side="right" className="w-[380px] backdrop-blur-xl bg-white/60 border-l border-white/20 rounded-l-[32px]">
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
                    <p className="text-sm text-gray-400 text-center py-8">אין משימות שדורשות תשומת לב</p>
                  ) : (
                    emergencyTasks.map(task => (
                      <Card key={task.id} className="border-r-4 border-purple-400 cursor-pointer hover:bg-purple-50"
                            onClick={() => navigate(createPageUrl("Tasks"))}>
                        <CardContent className="p-3">
                          <p className="font-medium text-sm">{task.title}</p>
                          <p className="text-xs text-gray-500">{task.client_name} {task.due_date && `\u2022 ${task.due_date}`}</p>
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

        <div className="flex-1 flex flex-row">
          {/* === SIDEBAR === */}
          {!focusMode && (
            <aside className={`hidden md:flex flex-col border-l border-white/20 backdrop-blur-xl transition-all duration-300 shrink-0
              ${sidebarCollapsed ? 'w-14' : 'w-56 max-w-[224px]'}`} style={{ backgroundColor: 'rgba(255,255,255,0.6)' }}>

              {/* Toggle button */}
              <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="self-start p-2 m-2 rounded-lg hover:bg-gray-100 transition-colors">
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
                          className={`p-2 rounded-lg transition-all ${workMode === mode.key ? mode.color + ' shadow-md' : 'text-gray-400 hover:bg-gray-100'}`}
                        >
                          <mode.icon className="w-4 h-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="left">{mode.label}</TooltipContent>
                    </Tooltip>
                  ))}
                  <div className="w-8 border-b border-gray-200 my-1" />
                  {/* Nav icons */}
                  {Object.entries(sidebarSections)
                    .filter(([key]) => getVisibleSections(workMode).includes(key))
                    .map(([, section]) => (
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
                /* Expanded: full sidebar */
                <div className="flex flex-col flex-1 overflow-y-auto">
                  {/* Mantra — very top of sidebar */}
                  <div className="px-3 pt-3 pb-1 text-center">
                    <p className="block font-black text-xl py-6 text-center text-transparent bg-clip-text bg-gradient-to-r from-[#008291] to-[#00acc1]">✨ עשוי טוב יותר ממושלם</p>
                  </div>

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

                  {/* Pinned Clients (pin-only, no auto-recent) */}
                  {pinnedClients.length > 0 && (
                    <div className="px-3 py-2 border-b border-gray-200">
                      <h3 className="text-xs font-bold text-gray-400 mb-2 flex items-center gap-1">
                        <Star className="w-3 h-3" /> גישה מהירה
                      </h3>
                      {pinnedClients.slice(0, 8).map(client => (
                        <Link key={client.id}
                          to={`${createPageUrl('ClientManagement')}?clientId=${client.id}`}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors">
                          <div className="w-2 h-2 rounded-full bg-emerald-400" />
                          {client.name}
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* "התפריט שלי" — user-customized menu */}
                  {myMenu.length > 0 && (
                    <div className="px-3 py-2 border-b border-gray-200">
                      <h3 className="text-xs font-bold text-gray-400 mb-2 flex items-center gap-1">
                        <Star className="w-3 h-3 text-amber-400" /> התפריט שלי
                      </h3>
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
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors
                              ${isActive(href) ? 'bg-amber-50 text-amber-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}>
                            <menuItem.icon className="w-3.5 h-3.5" />
                            {menuItem.name}
                          </Link>
                        );
                      })}
                    </div>
                  )}

                  {/* Daily Focus — top 5 tasks due today */}
                  {dailyFocusTasks.length > 0 && (
                    <div className="px-3 py-2 border-b border-gray-200">
                      <h3 className="text-xs font-bold text-gray-400 mb-2 flex items-center gap-1">
                        <Target className="w-3 h-3 text-rose-400" /> מיקוד יומי
                      </h3>
                      {dailyFocusTasks.map(task => (
                        <Link key={task.id}
                          to={createPageUrl("Tasks")}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-gray-600 hover:bg-gray-100 transition-colors">
                          <div className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                          <span className="truncate flex-1">{task.title}</span>
                          {task.client_name && (
                            <span className="text-[9px] bg-gray-100 text-gray-500 px-1 rounded shrink-0">{task.client_name}</span>
                          )}
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* Navigation sections */}
                  <nav className="flex-1 p-3">
                    {Object.entries(sidebarSections)
                      .filter(([key]) => getVisibleSections(workMode).includes(key))
                      .map(([key, section]) => (
                        <div key={key} className="mb-3">
                          <h3 className="text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-1 px-3">
                            <section.icon className="w-3 h-3" /> {section.title}
                          </h3>
                          {section.items.map(item => (
                            <div key={item.href} className="flex items-center group">
                              <Link to={item.href}
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors
                                  ${isActive(item.href) ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}>
                                <item.icon className="w-4 h-4" />
                                {item.name}
                              </Link>
                              <button
                                onClick={() => toggleMyMenu(item.href)}
                                className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-amber-50"
                                title={myMenu.includes(item.href) ? 'הסר מהתפריט שלי' : 'הוסף לתפריט שלי'}
                              >
                                <Star className="w-3 h-3" style={{ color: myMenu.includes(item.href) ? '#F59E0B' : '#D1D5DB', fill: myMenu.includes(item.href) ? '#F59E0B' : 'none' }} />
                              </button>
                            </div>
                          ))}
                        </div>
                      ))}
                  </nav>
                </div>
              )}
            </aside>
          )}

          {/* === MOBILE SIDEBAR === */}
          {isMobileMenuOpen && (
            <>
              <div className="md:hidden fixed inset-0 bg-black/40 z-30" onClick={() => setIsMobileMenuOpen(false)} />
              <div className="md:hidden fixed inset-y-0 right-0 z-40 w-72 backdrop-blur-xl bg-white/60 border-l border-white/20 shadow-xl overflow-y-auto">
                <div className="p-4 border-b border-gray-200 flex items-center justify-between">
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
                  <p className="block font-black text-xl py-6 text-center text-transparent bg-clip-text bg-gradient-to-r from-[#008291] to-[#00acc1]">✨ עשוי טוב יותר ממושלם</p>
                </div>

                {/* Mobile search */}
                <div className="px-4 py-2">
                  <GlobalSearch />
                </div>

                {/* Work Mode Selector */}
                <div className="px-3 py-2 border-b border-gray-200">
                  <div className="flex gap-1">
                    {WORK_MODES.map(mode => (
                      <button
                        key={mode.key}
                        onClick={() => setWorkMode(mode.key)}
                        className={`flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-lg text-xs font-medium transition-all
                          ${workMode === mode.key ? mode.color + ' shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                      >
                        <mode.icon className="w-4 h-4" />
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mobile navigation */}
                <nav className="p-3">
                  {Object.entries(sidebarSections)
                    .filter(([key]) => getVisibleSections(workMode).includes(key))
                    .map(([key, section]) => (
                      <div key={key} className="mb-3">
                        <h3 className="text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-1 px-3">
                          <section.icon className="w-3 h-3" /> {section.title}
                        </h3>
                        {section.items.map(item => (
                          <Link key={item.href} to={item.href}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors
                              ${isActive(item.href) ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}>
                            <item.icon className="w-4 h-4" />
                            {item.name}
                          </Link>
                        ))}
                      </div>
                    ))}
                </nav>
              </div>
            </>
          )}

          {/* === MAIN CONTENT === */}
          <main className="flex-1 flex flex-col min-h-0">
            {/* Desktop sub-header (page title + back) */}
            {!isHomePage && (
              <div className="hidden md:block p-4 border-b border-border bg-gradient-to-r from-primary/5 to-secondary/5">
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
              <div className="md:hidden bg-gradient-to-r from-primary/5 to-secondary/5 px-4 py-3 border-b border-border">
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

            <div className="flex-1 overflow-auto p-1.5 md:p-2 bg-neutral-bg/30 flex flex-col">
              <div className="w-full flex-1 flex flex-col min-h-0">
                <TimeAwareness />

                {/* Admin Mode: Prominent Import Backup Banner */}
                {workMode === 'admin' && (
                  <div className="mb-6">
                    {importStatus && (
                      <div className={`mb-4 p-4 rounded-lg flex items-center gap-3 ${
                        importStatus.type === 'success'
                          ? 'bg-green-50 border border-green-200 text-green-800'
                          : 'bg-amber-50 border border-amber-200 text-amber-800'
                      }`}>
                        {importStatus.type === 'success'
                          ? <CheckCircle className="w-5 h-5 flex-shrink-0" />
                          : <AlertTriangle className="w-5 h-5 flex-shrink-0" />}
                        <span className="font-medium">{importStatus.message}</span>
                        <button onClick={() => setImportStatus(null)} className="mr-auto text-sm underline opacity-60 hover:opacity-100">
                          סגור
                        </button>
                      </div>
                    )}
                    <Card className="border-2 border-dashed border-orange-300 bg-gradient-to-l from-orange-50 to-amber-50 hover:shadow-lg transition-shadow cursor-pointer"
                          onClick={() => importFileRef.current?.click()}>
                      <CardContent className="p-5 flex items-center gap-4">
                        <div className="w-14 h-14 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                          <Upload className="w-7 h-7 text-orange-600" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-gray-800">ייבוא גיבוי JSON</h3>
                          <p className="text-sm text-gray-500">לחצי כאן לבחור קובץ גיבוי (.json) ולשחזר את כל הנתונים</p>
                        </div>
                        <Button className="bg-orange-500 hover:bg-orange-600 text-white px-6">
                          <Upload className="w-4 h-4 ml-2" />
                          בחר קובץ
                        </Button>
                        <input
                          ref={importFileRef}
                          type="file"
                          accept=".json"
                          className="hidden"
                          onChange={handleImportJsonBackup}
                        />
                      </CardContent>
                    </Card>
                  </div>
                )}

                <div className="flex-1 min-h-0">
                  {children}
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* Reality Check & Completion Feedback */}
      <RealityCheck />
      <CompletionFeedback />

      {/* Floating Quick Add Task FAB — draggable, always visible */}
      <DraggableFab storageKey="fab_quick_add" className="fixed bottom-5 left-[4.5rem] z-[60]">
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
      <DraggableFab storageKey="fab_notes" className="fixed bottom-5 left-5 z-[60]">
        {({ guardClick }) => (
          <button
            onClick={guardClick(() => setNotesOpen(!notesOpen))}
            className={`w-11 h-11 rounded-full shadow-xl flex items-center justify-center ring-2 ring-white/50 select-none ${
              notesOpen
                ? 'bg-gray-500 hover:bg-gray-600 text-white'
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
            className="fixed bottom-20 left-4 z-50 w-[320px] max-w-[calc(100vw-2rem)] max-h-[70vh] bg-white rounded-2xl shadow-2xl border-2 border-amber-300 flex flex-col overflow-hidden"
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
