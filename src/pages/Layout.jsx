import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Home, Brain, CheckSquare, Target, BookCheck, DollarSign,
  BarChart3, Settings, Menu, X, Users, Scaling,
  Soup, BookHeart, Eye, Calendar, BookUser, Calculator, UserCheck, Database,
  ArrowRight, FileBarChart, Repeat, FolderKanban, Zap, StickyNote,
  ChevronLeft, ChevronRight, Plus, Hourglass, Maximize2, Star,
  BatteryLow, BatteryMedium, BatteryFull
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
    visibleSections: ['focus', 'operations']
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
    visibleSections: ['admin', 'system']
  },
];

// Sidebar sections (flat structure)
const getSidebarSections = () => ({
  focus: {
    title: "פוקוס",
    icon: Target,
    items: [
      { name: "פוקוס יומי", href: createPageUrl("Home"), icon: Eye },
      { name: "משימות", href: createPageUrl("Tasks"), icon: CheckSquare },
      { name: "לוח שנה", href: createPageUrl("Calendar"), icon: Calendar },
    ]
  },
  operations: {
    title: "ביצוע",
    icon: Calculator,
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
    items: [
      { name: "תכנון שבועי", href: createPageUrl("WeeklyPlanningDashboard"), icon: Brain },
      { name: "סיכום שבועי", href: createPageUrl("WeeklySummary"), icon: FileBarChart },
      { name: "מעקב פרויקטים", href: createPageUrl("Projects"), icon: FolderKanban },
      { name: "אוטומציות", href: createPageUrl("AutomationRules"), icon: Zap },
      { name: "משימות חוזרות", href: createPageUrl("RecurringTasks"), icon: Repeat },
    ]
  },
  admin: {
    title: "משרד",
    icon: Users,
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
    items: [
      { name: "הגדרת פרמטרים", href: createPageUrl("Settings"), icon: Settings },
      { name: "ייבוא נתונים", href: createPageUrl("DataImportTool"), icon: Database },
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

  useAutoReminders();
  const backupHealth = useBackupMonitor();

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
      <style>{`
        :root {
          --primary: 160 80% 39%;
          --primary-foreground: 0 0% 100%;
          --secondary: 158 92% 30%;
          --secondary-foreground: 0 0% 100%;
          --accent: 158 92% 30%;
          --accent-foreground: 0 0% 100%;
          --neutral-dark: #2d3436;
          --neutral-medium: #636e72;
          --neutral-light: #b2bec3;
          --neutral-bg: #f5f6fa;
          --background: #ffffff;
          --status-success: #10b981; /* emerald-500: completed */
          --status-warning: #f59e0b; /* amber-500: today/urgent */
          --status-error: #8b5cf6;   /* violet-500: overdue (calm purple) */
          --status-info: #0ea5e9;    /* sky-500: in progress */
          --status-pending: #6366f1; /* indigo-500: pending */
          --muted: 228 25% 97%;
          --muted-foreground: 200 7% 42%;
          --card: 0 0% 100%;
          --card-foreground: 192 9% 19%;
          --popover: 0 0% 100%;
          --popover-foreground: 192 9% 19%;
          --border: 200 16% 85%;
          --input: 200 16% 85%;
          --ring: 160 80% 39%;
          --foreground: 192 9% 19%;
          --destructive: 5 79% 57%;
          --destructive-foreground: 0 0% 100%;
        }
        body {
          font-family: 'Varela Round', 'Assistant', 'Heebo', 'Arial Hebrew', sans-serif;
          background-color: var(--neutral-bg);
        }
        h1, h2, h3, h4, h5, h6, .heading {
          font-family: 'Assistant', 'Heebo', 'Arial Hebrew', sans-serif;
          font-weight: 600;
          color: var(--neutral-dark);
        }
        .btn, button {
          font-family: 'Assistant', 'Varela Round', 'Heebo', sans-serif;
          font-weight: 600;
        }
      `}</style>

      <div className="min-h-screen flex flex-col">
        {/* === TOP HEADER BAR === */}
        <header className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between sticky top-0 z-50 shadow-sm">
          {/* Right: Logo + Mobile menu */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
            <Link to={createPageUrl("Home")} className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center shadow-md">
                <Brain className="w-5 h-5 text-primary-foreground" />
              </div>
              <h1 className="text-lg font-bold text-foreground hidden md:block">CalmPlan</h1>
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
              <SheetContent side="right" className="w-[380px]">
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
            <aside className={`hidden md:flex flex-col border-l border-gray-200 bg-white transition-all duration-300
              ${sidebarCollapsed ? 'w-16' : 'w-64'}`}>

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

                  {/* Pinned / Recent Clients */}
                  {(pinnedClients.length > 0 || recentClients.length > 0) && (
                    <div className="px-3 py-2 border-b border-gray-200">
                      <h3 className="text-xs font-bold text-gray-400 mb-2 flex items-center gap-1">
                        <Star className="w-3 h-3" /> גישה מהירה
                      </h3>
                      {[...pinnedClients, ...recentClients].slice(0, 5).map(client => (
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
              )}
            </aside>
          )}

          {/* === MOBILE SIDEBAR === */}
          {isMobileMenuOpen && (
            <>
              <div className="md:hidden fixed inset-0 bg-black/40 z-30" onClick={() => setIsMobileMenuOpen(false)} />
              <div className="md:hidden fixed inset-y-0 right-0 z-40 w-72 bg-white shadow-xl overflow-y-auto">
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

            <div className="flex-1 overflow-auto p-3 md:p-6 lg:p-8 bg-neutral-bg/30">
              <div className="max-w-full mx-auto">
                <TimeAwareness />
                {children}
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* Reality Check & Completion Feedback */}
      <RealityCheck />
      <CompletionFeedback />

      {/* Floating Quick Add Task FAB */}
      <button
        onClick={() => setShowQuickAdd(true)}
        className="fixed bottom-6 left-20 z-50 w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 bg-emerald-500 hover:bg-emerald-600 text-white hover:scale-105"
        title="משימה מהירה"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Floating Sticky Notes FAB */}
      <button
        onClick={() => setNotesOpen(!notesOpen)}
        className={`fixed bottom-6 left-6 z-50 w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${
          notesOpen
            ? 'bg-gray-500 hover:bg-gray-600 text-white scale-90'
            : 'bg-amber-500 hover:bg-amber-600 text-white animate-pulse hover:animate-none'
        }`}
        title={notesOpen ? 'סגור פתקים' : 'פתח פתקים'}
      >
        {notesOpen ? <X className="w-5 h-5" /> : <StickyNote className="w-5 h-5" />}
      </button>

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
