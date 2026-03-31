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
  Receipt, FileSignature, Briefcase, FolderOpen, Layers, Import, Activity, Search,
  BookOpen
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
import SyncBackupStatus from "@/components/SyncBackupStatus";
import { Task, Client } from "@/api/entities";
import { importAllData } from "@/api/base44Client";
import { AppProvider, useApp } from "@/contexts/AppContext";
import RealityCheck from "@/components/tasks/RealityCheck";
import CompletionFeedback from "@/components/tasks/CompletionFeedback";
import DesktopBridge from "@/components/desktop/DesktopBridge";
import { AyoaViewProvider, useAyoaView } from "@/contexts/AyoaViewContext";
import { DesignProvider } from "@/contexts/DesignContext";
import { BiologicalClockProvider } from "@/contexts/BiologicalClockContext";
import DesignFloatingTab from "@/components/canvas/DesignFloatingTab";
import BiologicalClockIndicator from "@/components/canvas/BiologicalClockIndicator";
import AyoaViewToggle from "@/components/canvas/AyoaViewToggle";
import { runAllAutomations } from "@/engines/automationEngine";
import AggressiveReminderSystem from "@/components/notifications/AggressiveReminderSystem";
import { PILLAR_COLORS, URGENT_COLOR } from "@/lib/theme-constants";
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";

// Work Modes — aligned to P1-P5 pillar tree
const WORK_MODES = [
  {
    key: 'doing',
    label: 'ביצוע',
    icon: Zap,
    color: 'bg-emerald-600 text-white',
    description: 'משימות יומיות + דיווחים שוטפים',
    visibleSections: ['p1_payroll', 'p2_bookkeeping', 'p3_hub', 'p4_home', 'p5_annual', 'p6_projects']
  },
  {
    key: 'planning',
    label: 'תכנון',
    icon: Brain,
    color: 'bg-blue-600 text-white',
    description: 'תכנון שבועי, עומס קוגניטיבי, אוטומציות',
    visibleSections: ['p3_hub', 'p4_home', 'p5_annual', 'p6_projects']
  },
  {
    key: 'admin',
    label: 'ניהול',
    icon: Settings,
    color: 'bg-purple-700 text-white',
    description: 'לקוחות + ספקים + ניתוח עסקי',
    visibleSections: ['p3_hub', 'p4_home', 'p5_annual', 'p6_projects']
  },
];

// ============================================================
// Sidebar sections — 5-Pillar Hierarchy (Law 1)
// P1: Payroll (Production → Reporting → Payment)
// P2: Bookkeeping (VAT, Advances, Collection)
// P3: Management & Planning (VIEWER/HUB — pulls from P1,P2,P4,P5)
// P4: Home/Personal (Meals, Routines, Inspiration)
// P5: Annual Reports (Income Tax, Capital Statements)
// ============================================================
// ══════════════════════════════════════════════════════════════
// FINAL MENU STRUCTURE — 2 Centers + 2 Top Buttons
//
// Top buttons (above menu): 🎯 מה לעשות היום | 🔭 התמונה המלאה
//
// 🏢 מרכז עסקי:
//    Planning: תכנון שבועי, לוח שנה, כל המשימות
//    Production: מרכז שכר ומיסים (שכר, הנה"ח, מאזנים)
//    Management: לקוחות, פרוייקטים, ניהול מערכת
//
// 🏠 בית ולייפסטייל
// ══════════════════════════════════════════════════════════════
const getSidebarSections = () => ({
  // ── 🏢 מרכז עסקי — main business center ──
  business: {
    title: "🏢 מרכז עסקי",
    icon: Building2,
    tabColor: `border-[${PILLAR_COLORS.P1.color}]`,
    isMainCenter: true,
    items: [
      { name: "תכנון שבועי", href: createPageUrl("WeeklyPlanningDashboard"), icon: Brain },
      { name: "לוח שנה", href: createPageUrl("Calendar"), icon: Calendar },
      { name: "כל המשימות", href: createPageUrl("Tasks"), icon: CheckSquare },
    ],
    subGroups: [
      { key: 'sg_payroll', label: '💰 שכר', icon: Calculator, items: [
        { name: "ייצור + הפצה", href: createPageUrl("PayrollDashboard"), icon: Zap },
        { name: "פנסיות וקרנות", href: createPageUrl("AdditionalServicesDashboard"), icon: LayoutGrid },
        { name: "דיווחים שוטפים (102)", href: createPageUrl("PayrollReportsDashboard"), icon: FileBarChart },
        { name: "דיווחים תקופתיים", href: createPageUrl("PeriodicSummaryReports"), icon: FileBarChart },
      ]},
      { key: 'sg_bookkeeping', label: '📊 הנהלת חשבונות', icon: FileBarChart, items: [
        { name: "דיווחים (מע\"מ ומקדמות)", href: createPageUrl("TaxReportsDashboard"), icon: BarChart3 },
        { name: "התאמות חשבונות", href: createPageUrl("Reconciliations"), icon: BookCheck },
        { name: "תוצרים (רוה\"ס)", href: createPageUrl("FinancialResultsDashboard"), icon: TrendingUp },
      ]},
      { key: 'sg_annual', label: '📋 מאזנים ודוחות', icon: Scaling, items: [
        { name: "מאזנים ודוחות", href: createPageUrl("BalanceSheets"), icon: Scaling },
      ]},
      { key: 'sg_clients', label: '👥 לקוחות וקשרי עבודה', icon: Users, items: [
        { name: "מרכז לקוחות", href: createPageUrl("ClientManagement"), icon: Users },
        { name: "לידים ושיווק", href: createPageUrl("Leads"), icon: Target },
        { name: "ספקי שירות", href: createPageUrl("ServiceProviders"), icon: Briefcase },
      ]},
      { key: 'sg_projects', label: '📁 פרוייקטים', icon: FolderKanban, items: [
        { name: "פרוייקטים", href: createPageUrl("Projects"), icon: FolderKanban },
        { name: "דאשבורד פרויקט", href: createPageUrl("ProjectWorkbook"), icon: BookOpen },
      ]},
      { key: 'sg_settings', label: '⚙️ ניהול מערכת', icon: Settings, items: [
        { name: "הגדרות מערכת", href: createPageUrl("Settings"), icon: Settings },
        { name: "הגדרות אישיות", href: createPageUrl("LifeSettings"), icon: Settings },
        { name: "כללי אוטומציה", href: createPageUrl("AutomationRules"), icon: Workflow },
        { name: "מרכז עסקי (כלים)", href: createPageUrl("BusinessHub"), icon: Building2 },
        { name: "אפיון עומס קוגניטיבי", href: createPageUrl("BatchSetup"), icon: Layers },
        { name: "משימות חוזרות (הזרקה)", href: createPageUrl("RecurringTasks"), icon: Repeat },
        { name: "מצב המערכת", href: createPageUrl("SystemOverview"), icon: Eye },
        { name: "גיבויים", href: createPageUrl("BackupManager"), icon: HardDrive },
      ]},
    ]
  },
  // ── 🏠 בית ולייפסטייל ──
  p4_home: {
    title: "🏠 בית ולייפסטייל",
    icon: BookHeart,
    tabColor: `border-[${PILLAR_COLORS.P4.color}]`,
    isMainCenter: true,
    items: [
      { name: "תכנון ארוחות", href: createPageUrl("MealPlanner"), icon: Soup },
      { name: "השראה וספרים", href: createPageUrl("Inspiration"), icon: BookHeart },
      { name: "משימות בית", href: createPageUrl("HomeTaskGenerator"), icon: Home },
    ]
  },
});

// Map sidebar sections to their parent work mode for auto-switching
const SECTION_TO_MODE = {
  business: null,
  p4_home: null,
};

const getVisibleSections = (mode) => {
  return ['business', 'p4_home'];
};

// Deadline countdown — connected to real TAX_CALENDAR_2026
import { TAX_CALENDAR_2026 } from "@/config/taxCalendar2026";

const getNextDeadline = () => {
  const now = new Date();
  const today = now.toISOString().slice(0, 10); // YYYY-MM-DD

  // Collect all upcoming deadlines from the tax calendar
  const allDeadlines = [];
  const DEADLINE_LABELS = {
    payroll: 'שכר',
    masavSuppliers: 'מס"ב ספקים',
    masavSocial: 'מס"ב סוציאליות',
    masavAuthorities: 'מס"ב רשויות',
    nationalInsurance: 'ביטוח לאומי',
    deductions: 'ניכויים',
    onlineFiling: 'מע"מ / מקדמות',
    detailedVat: 'מע"מ 874',
    operatorReport: 'דיווח מתפעל',
    operatorInstructions: 'הנחיות מתפעל',
  };

  for (const [, entry] of Object.entries(TAX_CALENDAR_2026)) {
    for (const [key, label] of Object.entries(DEADLINE_LABELS)) {
      const dateStr = entry[key];
      if (dateStr && dateStr >= today) {
        allDeadlines.push({
          date: dateStr,
          label,
          reportMonth: entry.reportMonthName,
        });
      }
    }
  }

  // Sort by date and pick the closest
  allDeadlines.sort((a, b) => a.date.localeCompare(b.date));
  const next = allDeadlines[0];

  if (!next) {
    return { daysLeft: 99, label: 'אין דדליינים קרובים' };
  }

  const daysLeft = differenceInDays(parseISO(next.date), now);
  return { daysLeft, label: next.label, reportMonth: next.reportMonth };
};

// ─── Draggable FAB component (useMotionValue localStorage persist) ─────────
function DraggableFab({ storageKey, children, className = '' }) {
  const fullKey = `calmplan_drag_${storageKey}`;
  const didDrag = React.useRef(false);

  // Read saved position once on mount — auto-reset if off-screen
  const initPos = React.useMemo(() => {
    try {
      const s = localStorage.getItem(fullKey);
      if (s) {
        const p = JSON.parse(s);
        if (typeof p.x === 'number') {
          const vw = window.innerWidth || 800;
          const vh = window.innerHeight || 600;
          if (Math.abs(p.x) > vw * 0.8 || Math.abs(p.y) > vh * 0.8) {
            localStorage.removeItem(fullKey);
            return { x: 0, y: 0 };
          }
          return p;
        }
      }
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

  const constraintsRef = React.useRef(null);

  // Set drag constraints to keep FAB within viewport
  React.useEffect(() => {
    constraintsRef.current = {
      top: -(window.innerHeight - 80),
      bottom: 60,
      left: -(window.innerWidth - 80),
      right: window.innerWidth - 80,
    };
  }, []);

  return (
    <motion.div
      drag
      dragMomentum={false}
      dragElastic={0}
      dragConstraints={constraintsRef.current || { top: -500, bottom: 60, left: -500, right: 500 }}
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

// ── Global AYOA View Bar — appears on all pages ──
function GlobalAyoaBar() {
  const { ayoaView, setAyoaView } = useAyoaView();
  const location = useLocation();
  // Only show on task/dashboard pages, not on settings/admin pages
  const taskPages = ['/', '/payroll', '/tax-reports', '/admin-tasks', '/additional-services', '/my-focus', '/tasks', '/clients'];
  const showBar = taskPages.some(p => location.pathname === p || location.pathname.startsWith(p + '/'));
  if (!showBar) return null;
  return (
    <div className="flex items-center gap-2 mb-1.5 px-1">
      <AyoaViewToggle value={ayoaView} onChange={setAyoaView} />
      <div className="flex items-center gap-1 mr-auto">
        {[
          { color: '#6366F1', label: 'אישי' },
          { color: '#FFC107', label: 'משימות' },
          { color: '#00A3E0', label: 'תיקיות' },
          { color: '#800000', label: 'דחוף' },
        ].map(c => (
          <div key={c.color} className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} title={c.label} />
        ))}
      </div>
    </div>
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
  const [collapsedSections, setCollapsedSections] = useState(new Set(['p4_home', 'sg_payroll', 'sg_bookkeeping', 'sg_annual', 'sg_clients', 'sg_projects', 'sg_settings']));
  const [emergencyTasks, setEmergencyTasks] = useState([]);
  const [pinnedClients, setPinnedClients] = useState([]);
  const [recentClients, setRecentClients] = useState([]);
  const [myMenu, setMyMenu] = useState([]);
  const [dailyFocusTasks, setDailyFocusTasks] = useState([]);
  const [importStatus, setImportStatus] = useState(null); // {type, message}
  const [sidebarSearch, setSidebarSearch] = useState('');
  const importFileRef = useRef(null);

  useAutoReminders();
  const backupHealth = useBackupMonitor();

  // Green Plus (+) global event — opens QuickAddTaskDialog from any AYOA view
  useEffect(() => {
    const handler = () => setShowQuickAdd(true);
    window.addEventListener('calmplan:add-new-service', handler);
    return () => window.removeEventListener('calmplan:add-new-service', handler);
  }, []);

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

  // Load emergency tasks — refreshes on every page navigation
  useEffect(() => {
    const loadEmergency = async () => {
      try {
        const allTasks = await Task.list(null, 5000).catch(() => []);
        const tasks = Array.isArray(allTasks) ? allTasks : [];
        const now = new Date();
        const DONE = new Set(['completed', 'not_relevant', 'production_completed']);
        const emergency = tasks
          .filter(t => {
            if (DONE.has(t.status)) return false;
            const due = t.due_date ? parseISO(t.due_date) : null;
            if (!due) return false;
            return differenceInDays(due, now) <= 0;
          })
          .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
          .slice(0, 10);
        setEmergencyTasks(emergency);
      } catch { setEmergencyTasks([]); }
    };
    loadEmergency();
  }, [location.pathname]);

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
        const clients = await Client.list(null, 5).catch(() => []);
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

  // Load Daily Focus tasks — auto-populated from Planning section
  // Includes: overdue + due this week (Sunday→Friday), sorted by urgency
  useEffect(() => {
    const loadDailyFocus = async () => {
      try {
        const allTasks = await Task.list(null, 5000).catch(() => []);
        const tasks = Array.isArray(allTasks) ? allTasks : [];
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        // Week window: Sunday → Friday
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        const weekStartStr = weekStart.toISOString().split('T')[0];
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 5);
        const weekEndStr = weekEnd.toISOString().split('T')[0];

        const focusTasks = tasks
          .filter(t => {
            if (t.status === 'completed' || t.status === 'not_relevant' || t.status === 'production_completed') return false;
            if (!t.due_date) return false;
            // Overdue OR due this week → auto-populate focus
            return t.due_date <= weekEndStr;
          })
          .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
          .slice(0, 8);
        setDailyFocusTasks(focusTasks);
      } catch { setDailyFocusTasks([]); }
    };
    loadDailyFocus();
  }, []);

  // Background automation runner: auto-archive, sequence unlock
  useEffect(() => {
    let paused = false;
    try {
      const prefs = JSON.parse(localStorage.getItem('calmplan_design_prefs') || '{}');
      paused = prefs.automationsPaused || false;
    } catch { /* ignore */ }

    const runAutomations = async () => {
      try {
        const allTasks = await Task.list(null, 5000).catch(() => []);
        if (Array.isArray(allTasks) && allTasks.length > 0) {
          await runAllAutomations(allTasks, paused);
        }
      } catch { /* silent */ }
    };

    // Run once on mount, then every 10 minutes
    const timer = setTimeout(runAutomations, 5000);
    const interval = setInterval(runAutomations, 10 * 60 * 1000);
    return () => { clearTimeout(timer); clearInterval(interval); };
  }, []);

  const toggleMyMenu = useCallback((href) => {
    setMyMenu(prev => {
      const next = prev.includes(href) ? prev.filter(h => h !== href) : [...prev, href];
      localStorage.setItem('calmplan_my_menu', JSON.stringify(next));
      return next;
    });
  }, []);

  const isActive = (href) => location.pathname.startsWith(href);

  // Sidebar search: filter items by query
  const sidebarSearchLower = sidebarSearch.trim().toLowerCase();
  const matchesSidebarSearch = useCallback((item) => {
    if (!sidebarSearchLower) return true;
    return (item.name || '').toLowerCase().includes(sidebarSearchLower) ||
      (item.subItems || []).some(sub => (sub.name || '').toLowerCase().includes(sidebarSearchLower));
  }, [sidebarSearchLower]);

  const sectionMatchesSearch = useCallback((section) => {
    if (!sidebarSearchLower) return true;
    if ((section.title || '').toLowerCase().includes(sidebarSearchLower)) return true;
    if (section.items?.some(matchesSidebarSearch)) return true;
    if (section.subGroups?.some(sg =>
      (sg.label || '').toLowerCase().includes(sidebarSearchLower) ||
      sg.items?.some(matchesSidebarSearch)
    )) return true;
    return false;
  }, [sidebarSearchLower, matchesSidebarSearch]);

  const findPageTitle = () => {
    if (location.pathname === createPageUrl("Home")) return 'מה לעשות היום';
    for (const section of Object.values(sidebarSections)) {
      for (const item of section.items) {
        if (item.href && location.pathname.startsWith(item.href)) return item.name;
      }
    }
    return 'LitayCalmPlan';
  };

  const isHomePage = location.pathname === createPageUrl("Home");

  // Build breadcrumb trail from current path + sidebar structure
  const breadcrumbTrail = React.useMemo(() => {
    if (isHomePage) return null; // No breadcrumb on home
    const path = location.pathname;
    for (const [sectionKey, section] of Object.entries(sidebarSections)) {
      // Check direct items
      for (const item of section.items) {
        if (item.href && path.startsWith(item.href)) {
          return { section: section.title, page: item.name };
        }
      }
      // Check sub-group items
      if (section.subGroups) {
        for (const sg of section.subGroups) {
          for (const item of sg.items) {
            if (item.href && path.startsWith(item.href)) {
              return { section: section.title, subGroup: sg.label, page: item.name };
            }
          }
        }
      }
    }
    // Special pages
    if (path.includes('MyFocus')) return { section: null, page: 'התמונה המלאה' };
    return null;
  }, [location.pathname, isHomePage, sidebarSections]);

  const emergencyCount = emergencyTasks.length;
  const { daysLeft, label: deadlineLabel, reportMonth: deadlineReportMonth } = getNextDeadline();

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
        <header className="border-b border-gray-200/60 px-4 py-2 flex items-center justify-between sticky top-0 z-50"
          style={{ background: 'linear-gradient(135deg, #FAFEFE 0%, #F0F7FA 50%, #F5F9FC 100%)', boxShadow: '0 1px 8px rgba(0,163,224,0.05)' }}>
          {/* Right: LITAY Logo + Mobile menu */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="md:hidden h-8 w-8" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
              {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </Button>
            <Link to={createPageUrl("Home")} className="flex items-center gap-3 group">
              <img
                src="/logo-litay.png"
                alt="LITAY Logo"
                className="w-10 h-10 rounded-xl object-contain transition-transform group-hover:scale-105 drop-shadow-sm"
              />
              <div className="hidden md:block">
                <h1 className="text-base font-black tracking-tight" style={{ color: '#4A7C8F' }}>
                  LitayCalmPlan
                </h1>
                <p className="text-[11px] font-medium -mt-0.5" style={{ color: '#8BAAB8' }}>ניהול חכם ורגוע</p>
              </div>
            </Link>
          </div>

          {/* Center: Global Search — sleek pill design */}
          <div className="flex-1 max-w-lg mx-6 hidden md:block">
            <GlobalSearch />
          </div>

          {/* Left: Header actions — compact row */}
          <div className="flex items-center gap-2.5">
            {/* Biological Clock Indicator */}
            <div className="hidden md:block">
              <BiologicalClockIndicator />
            </div>

            {/* Deadline Countdown — calm style, no destructive red */}
            <Badge variant="secondary" className="text-xs hidden md:inline-flex border border-sky-200" style={{
              backgroundColor: daysLeft <= 3 ? '#FFF8E7' : '#F0F7FA',
              color: daysLeft <= 3 ? '#B8860B' : '#5A8FA0',
            }}>
              {daysLeft <= 0 ? 'היום' : daysLeft === 1 ? 'מחר' : `עוד ${daysLeft} ימים`} — {deadlineLabel}{deadlineReportMonth ? ` (${deadlineReportMonth})` : ''}
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
                  <BatteryLow className="w-4 h-4 ms-2 text-amber-500" />
                  סוללה נמוכה - רק משימות של 5-10 דקות
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setEnergyLevel('medium')}>
                  <BatteryMedium className="w-4 h-4 ms-2 text-yellow-500" />
                  אנרגיה בינונית - משימות S ו-M
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setEnergyLevel('full')}>
                  <BatteryFull className="w-4 h-4 ms-2 text-green-500" />
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
                    <span className="absolute -top-1 -right-1 bg-purple-500 text-white text-[12px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
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

            <SyncBackupStatus health={backupHealth} />
          </div>
        </header>

        {/* === MOBILE SIDEBAR === */}
        {isMobileMenuOpen && (
          <>
            <div className="md:hidden fixed inset-0 bg-black/40 z-30" onClick={() => setIsMobileMenuOpen(false)} />
            <div className="md:hidden fixed inset-y-0 right-0 z-40 w-72 bg-white border-l-2 border-[#B0BEC5] shadow-xl overflow-y-auto">
              <div className="p-4 border-b border-[#B0BEC5] flex items-center justify-between">
                <Link to={createPageUrl("Home")} className="flex items-center gap-2">
                  <img src="/logo-litay.png" alt="LITAY" className="w-8 h-8 rounded-lg object-contain" />
                  <h1 className="text-lg font-bold" style={{ color: '#4A7C8F' }}>LitayCalmPlan</h1>
                </Link>
                <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
              <div className="px-4 pt-2 pb-0 text-center">
                <p className="block font-black text-2xl py-6 text-center" style={{ color: '#1E3A5F' }}>עשוי טוב יותר ממושלם</p>
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
                    ${isActive(createPageUrl("Home")) ? 'bg-[#E8F5F7] text-[#4682B4]' : 'text-[#000000] hover:bg-[#F5F5F5]'}`}>
                  <Eye className="w-4 h-4" />
                  מה לעשות היום
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
                          <section.icon className="w-4 h-4 text-[#4682B4]" />
                          <span>{section.title}</span>
                        </div>
                        <ChevronDown className={`w-3.5 h-3.5 text-[#455A64] transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                      </button>
                      {isOpen && (
                        <>
                          {section.items.map(item => (
                            <React.Fragment key={item.href}>
                              <Link to={item.href}
                                onClick={() => {
                                  setIsMobileMenuOpen(false);
                                  const targetMode = SECTION_TO_MODE[key];
                                  if (targetMode && targetMode !== workMode) setWorkMode(targetMode);
                                }}
                                className={`flex items-center gap-2 px-6 py-1.5 rounded-xl text-sm transition-colors
                                  ${isActive(item.href) ? 'bg-gradient-to-l from-sky-100/80 to-violet-50/40 text-[#00A3E0] font-bold shadow-sm border border-sky-100' : 'text-[#37474F] hover:bg-white/70 hover:shadow-sm'}`}>
                                <item.icon className="w-3.5 h-3.5" />
                                {item.name}
                              </Link>
                              {item.subItems?.map(sub => (
                                <Link key={sub.href} to={sub.href}
                                  onClick={() => setIsMobileMenuOpen(false)}
                                  className={`flex items-center gap-2 px-9 py-1 rounded-xl text-xs transition-colors
                                    ${isActive(sub.href) ? 'bg-gradient-to-l from-sky-100/80 to-violet-50/40 text-[#00A3E0] font-bold shadow-sm border border-sky-100' : 'text-[#546E7A] hover:bg-white/70 hover:shadow-sm'}`}>
                                  <sub.icon className="w-3 h-3" />
                                  {sub.name}
                                </Link>
                              ))}
                            </React.Fragment>
                          ))}
                          {section.subGroups?.map(sg => {
                            const sgOpen = !collapsedSections.has(sg.key);
                            return (
                              <div key={sg.key} className="me-3">
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
                                      ${isActive(item.href) ? 'bg-gradient-to-l from-sky-100/80 to-violet-50/40 text-[#00A3E0] font-bold shadow-sm border border-sky-100' : 'text-[#37474F] hover:bg-white/70 hover:shadow-sm'}`}>
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
                <aside className="flex flex-col border-l border-gray-200/40 h-full w-full" style={{ background: 'linear-gradient(180deg, #FAFCFE 0%, #F4F8FB 50%, #EFF4F8 100%)' }}>

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
                          section.items.flatMap(item => [
                            <Tooltip key={item.href}>
                              <TooltipTrigger asChild>
                                <Link to={item.href} className={`p-2 rounded-[32px] transition-colors
                                  ${isActive(item.href) ? 'bg-[#E8F5F7] text-[#4682B4]' : 'text-[#455A64] hover:bg-[#E0E0E0] hover:text-[#37474F]'}`}>
                                  <item.icon className="w-5 h-5" />
                                </Link>
                              </TooltipTrigger>
                              <TooltipContent side="left">{item.name}</TooltipContent>
                            </Tooltip>,
                            ...(item.subItems || []).map(sub => (
                              <Tooltip key={sub.href}>
                                <TooltipTrigger asChild>
                                  <Link to={sub.href} className={`p-1.5 rounded-[32px] transition-colors
                                    ${isActive(sub.href) ? 'bg-[#E8F5F7] text-[#4682B4]' : 'text-[#455A64] hover:bg-[#E0E0E0] hover:text-[#37474F]'}`}>
                                    <sub.icon className="w-4 h-4" />
                                  </Link>
                                </TooltipTrigger>
                                <TooltipContent side="left">{sub.name}</TooltipContent>
                              </Tooltip>
                            ))
                          ])
                        ))}
                    </div>
                  ) : (
                    /* Expanded: full sidebar */
                    <div className="flex flex-col flex-1 overflow-y-auto">
                      {/* Mantra — very top of sidebar */}
                      <div className="px-3 pt-4 pb-2 text-center">
                        <p className="block font-black text-xl py-4 text-center" style={{ color: '#1E3A5F' }}>
                          עשוי טוב יותר ממושלם
                        </p>
                      </div>

                      {/* P4 Home shortcut — hard-wired to Branch P4 */}
                      <div className="px-3 pt-1 pb-0">
                        <Link to={createPageUrl("LifeSettings")}
                          className="flex items-center justify-center gap-2 px-3 py-2 rounded-2xl text-sm font-bold transition-all hover:shadow-md"
                          style={{
                            background: 'linear-gradient(135deg, #FFC10720, #FF980020)',
                            color: '#FFC107',
                            border: '1px solid #FFC10730',
                          }}>
                          <Home className="w-4 h-4" />
                          <span className="text-xs">P4 | בית</span>
                        </Link>
                      </div>

                      {/* Work Mode Selector */}
                      <div className="px-3 py-2 border-b border-gray-200/40">
                        <div className="flex gap-1.5 p-1 rounded-2xl" style={{ background: 'linear-gradient(135deg, #F0F4FA, #FFF8F0)' }}>
                          {WORK_MODES.map(mode => (
                            <button
                              key={mode.key}
                              onClick={() => setWorkMode(mode.key)}
                              className={`flex-1 flex flex-col items-center gap-1 py-2.5 px-1 rounded-2xl text-xs font-bold transition-all
                                ${workMode === mode.key ? 'text-white shadow-lg scale-105' : 'text-gray-500 hover:bg-white/60 hover:shadow-sm'}`}
                              style={workMode === mode.key ? {
                                background: mode.key === 'doing' ? 'linear-gradient(135deg, #00A3E0, #00BCD4)'
                                  : mode.key === 'planning' ? 'linear-gradient(135deg, #7C4DFF, #9C27B0)'
                                  : 'linear-gradient(135deg, #6366F1, #818CF8)',
                                boxShadow: mode.key === 'doing' ? '0 4px 15px #00A3E040'
                                  : mode.key === 'planning' ? '0 4px 15px #7C4DFF40'
                                  : '0 4px 15px #6366F140',
                              } : {}}
                            >
                              <mode.icon className="w-4 h-4" />
                              {mode.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* ── Sidebar Filter Search ── */}
                      <div className="px-3 py-1.5">
                        <div className="relative">
                          <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                          <input
                            value={sidebarSearch}
                            onChange={(e) => {
                              setSidebarSearch(e.target.value);
                              // Auto-expand sections when searching
                              if (e.target.value.trim()) {
                                setCollapsedSections(new Set());
                              }
                            }}
                            placeholder="סנן תפריט... (מע״מ, P1...)"
                            className="w-full h-8 text-xs pe-8 ps-2 rounded-xl border border-gray-200 bg-white/70 focus:outline-none focus:ring-1 focus:ring-[#4682B4] focus:bg-white placeholder:text-gray-400"
                          />
                          {sidebarSearch && (
                            <button
                              onClick={() => setSidebarSearch('')}
                              className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Navigation sections — Accordion */}
                      <nav className="flex-1 px-2 py-1 space-y-0.5">
                        {/* Daily Focus — single entry point (no duplication) */}
                        <Link to={createPageUrl("Home")}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-2xl text-sm font-bold transition-all mb-1
                            ${isActive(createPageUrl("Home"))
                              ? 'text-white shadow-lg'
                              : 'text-[#37474F] hover:bg-gradient-to-l hover:from-sky-50 hover:to-transparent'}`}
                          style={isActive(createPageUrl("Home")) ? {
                            background: 'linear-gradient(135deg, #00A3E0, #00BCD4)',
                            boxShadow: '0 4px 15px #00A3E040',
                          } : {}}>
                          <Eye className="w-4 h-4" style={{ color: isActive(createPageUrl("Home")) ? 'white' : '#00A3E0' }} />
                          מה לעשות היום
                          {dailyFocusTasks.length > 0 && (
                            <Badge className="text-[12px] bg-amber-100 text-amber-700 px-1.5 py-0">{dailyFocusTasks.length}</Badge>
                          )}
                        </Link>
                        <Link to={createPageUrl("MyFocus")}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-2xl text-sm font-bold transition-all mb-2
                            ${isActive(createPageUrl("MyFocus"))
                              ? 'text-white shadow-lg'
                              : 'text-[#37474F] hover:bg-gradient-to-l hover:from-amber-50 hover:to-transparent'}`}
                          style={isActive(createPageUrl("MyFocus")) ? {
                            background: 'linear-gradient(135deg, #FFC107, #FF9800)',
                            boxShadow: '0 4px 15px #FFC10740',
                          } : {}}>
                          <Target className="w-4 h-4" style={{ color: isActive(createPageUrl("MyFocus")) ? 'white' : '#FFC107' }} />
                          התמונה המלאה
                        </Link>

                        {/* כלים אישיים — right after top buttons */}
                        {(myMenu.length > 0 || pinnedClients.length > 0) && (
                          <div className="mb-2">
                            <button
                              onClick={() => setCollapsedSections(prev => {
                                const next = new Set(prev);
                                if (next.has('personal_tools')) next.delete('personal_tools'); else next.add('personal_tools');
                                return next;
                              })}
                              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-white transition-colors hover:brightness-110"
                              style={{ background: '#1E3A5F' }}
                            >
                              <div className="flex items-center gap-1.5">
                                <Star className="w-3.5 h-3.5" style={{ color: '#FCD34D' }} />
                                <span style={{ color: '#FFFFFF' }}>כלים אישיים</span>
                              </div>
                              <ChevronDown className="w-3 h-3 transition-transform" style={{ color: 'rgba(255,255,255,0.7)', transform: collapsedSections.has('personal_tools') ? 'rotate(-90deg)' : 'none' }} />
                            </button>
                            {!collapsedSections.has('personal_tools') && (
                              <div className="mt-0.5">
                                {pinnedClients.slice(0, 8).map(client => (
                                  <div key={client.id} className="flex items-center gap-1 group">
                                    <Link
                                      to={`${createPageUrl('ClientManagement')}?clientId=${client.id}`}
                                      onClick={() => setIsMobileMenuOpen(false)}
                                      className="flex-1 flex items-center gap-2 px-3 py-1 rounded-lg text-xs text-slate-700 hover:bg-slate-50 transition-colors">
                                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                      {client.name}
                                    </Link>
                                  </div>
                                ))}
                                {myMenu.map(href => {
                                  let menuItem = null;
                                  for (const section of Object.values(sidebarSections)) {
                                    menuItem = section.items.find(i => i.href === href);
                                    if (menuItem) break;
                                    if (section.subGroups) {
                                      for (const sg of section.subGroups) {
                                        menuItem = sg.items.find(i => i.href === href);
                                        if (menuItem) break;
                                      }
                                      if (menuItem) break;
                                    }
                                  }
                                  if (!menuItem) return null;
                                  return (
                                    <div key={href} className="flex items-center gap-1 group">
                                      <Link to={href}
                                        onClick={() => setIsMobileMenuOpen(false)}
                                        className={`flex-1 flex items-center gap-2 px-3 py-1 rounded-lg text-xs transition-colors
                                          ${isActive(href) ? 'bg-sky-50 text-sky-700 font-bold' : 'text-slate-700 hover:bg-slate-50'}`}>
                                        <menuItem.icon className="w-3 h-3" />
                                        {menuItem.name}
                                      </Link>
                                      <button
                                        onClick={() => setMyMenu(prev => {
                                          const next = prev.filter(h => h !== href);
                                          try { localStorage.setItem('calmplan_my_menu', JSON.stringify(next)); } catch {}
                                          return next;
                                        })}
                                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-amber-50 transition-opacity"
                                        title="הסר מכלים אישיים"
                                      >
                                        <X className="w-3 h-3 text-amber-500" />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}

                        {Object.entries(sidebarSections)
                          .filter(([key]) => getVisibleSections(workMode).includes(key))
                          .filter(([, section]) => sectionMatchesSearch(section))
                          .map(([key, section]) => {
                            const isOpen = !collapsedSections.has(key);
                            const isCenter = section.isMainCenter;
                            return (
                              <div key={key} className={isCenter ? 'mb-3 mt-2' : 'mb-1'}>
                                {/* LEVEL 0: Main center header — dark blue with white text */}
                                <button
                                  onClick={() => setCollapsedSections(prev => {
                                    const next = new Set(prev);
                                    if (next.has(key)) next.delete(key); else next.add(key);
                                    return next;
                                  })}
                                  className={isCenter
                                    ? 'w-full flex items-center justify-between px-3 py-2 rounded-xl transition-colors text-white hover:brightness-110'
                                    : `w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-bold text-[#000000] hover:bg-[#F5F5F5] transition-colors border-r-3 ${section.tabColor || ''}`}
                                  style={isCenter ? { background: '#1E3A5F' } : {}}
                                >
                                  <div className="flex items-center gap-2">
                                    <section.icon className="w-4 h-4" style={isCenter ? { color: '#FFFFFF' } : {}} />
                                    <span className={isCenter ? 'text-[14px] font-bold' : 'text-sm font-bold'} style={isCenter ? { color: '#FFFFFF' } : {}}>{section.title}</span>
                                  </div>
                                  <ChevronDown className="w-3.5 h-3.5 transition-transform" style={isCenter ? { color: 'rgba(255,255,255,0.7)' } : { color: '#455A64' }} />
                                </button>
                                {isOpen && (
                                  <div className="mt-1.5 ms-2">
                                    {/* LEVEL 1: Direct items — semibold, 13px */}
                                    {section.items.filter(matchesSidebarSearch).map(item => (
                                      <React.Fragment key={item.href}>
                                        <div className="flex items-center group">
                                          <Link to={item.href}
                                            onClick={() => {
                                              setIsMobileMenuOpen(false);
                                              setSidebarSearch('');
                                              const targetMode = SECTION_TO_MODE[key];
                                              if (targetMode && targetMode !== workMode) {
                                                setWorkMode(targetMode);
                                              }
                                            }}
                                            className={`flex-1 flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-colors
                                              ${isActive(item.href) ? 'bg-sky-50 text-[#0077B6] font-bold border-s-2 border-[#00A3E0]' : 'text-[#1E293B] hover:bg-slate-50'}`}>
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
                                      </React.Fragment>
                                    ))}
                                    {/* LEVEL 1: Sub-groups as collapsible list (not pills) — consistent vertical list */}
                                    {section.subGroups?.filter(sg => !sidebarSearchLower || (sg.label || '').toLowerCase().includes(sidebarSearchLower) || sg.items?.some(matchesSidebarSearch)).map(sg => {
                                      const sgOpen = !collapsedSections.has(sg.key);
                                      return (
                                        <div key={sg.key}>
                                          <button
                                            onClick={() => setCollapsedSections(prev => {
                                              const next = new Set(prev);
                                              if (next.has(sg.key)) next.delete(sg.key); else next.add(sg.key);
                                              return next;
                                            })}
                                            className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-[13px] font-semibold text-[#1E293B] hover:bg-slate-50 transition-colors"
                                          >
                                            <div className="flex items-center gap-2">
                                              <sg.icon className="w-3.5 h-3.5 text-slate-400" />
                                              <span>{sg.label}</span>
                                            </div>
                                            <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${sgOpen ? '' : '-rotate-90'}`} />
                                          </button>
                                          {sgOpen && (
                                            <div className="ms-4 ps-2 border-s border-slate-200 mb-1">
                                              {sg.items.filter(matchesSidebarSearch).map(item => (
                                                <div key={item.href} className="flex items-center group">
                                                  <Link to={item.href}
                                                    onClick={() => {
                                                      setIsMobileMenuOpen(false);
                                                      setSidebarSearch('');
                                                      const targetMode = SECTION_TO_MODE[key];
                                                      if (targetMode && targetMode !== workMode) setWorkMode(targetMode);
                                                    }}
                                                    className={`flex-1 flex items-center gap-2 px-2 py-1 rounded-lg text-[12px] transition-colors
                                                      ${isActive(item.href) ? 'bg-sky-50 text-[#0077B6] font-bold' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
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
                    <Link to={createPageUrl("Home")} onClick={() => {
                      // Focus on P4 (Home branch) when navigating home
                      window.dispatchEvent(new CustomEvent('calmplan:focus-branch', { detail: { branch: 'P4' } }));
                    }}>
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
                    <Link to={createPageUrl("Home")} onClick={() => {
                      window.dispatchEvent(new CustomEvent('calmplan:focus-branch', { detail: { branch: 'P4' } }));
                    }}>
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

                  {/* Breadcrumbs + Back to Home */}
                  {breadcrumbTrail && (
                    <div className="flex items-center justify-between mb-1 px-1">
                      <Breadcrumb>
                        <BreadcrumbList>
                          <BreadcrumbItem>
                            <BreadcrumbLink href={createPageUrl("Home")} className="text-xs font-semibold text-slate-500 hover:text-slate-800">
                              🏠 עכשיו
                            </BreadcrumbLink>
                          </BreadcrumbItem>
                          {breadcrumbTrail.section && (
                            <>
                              <BreadcrumbSeparator />
                              <BreadcrumbItem>
                                <span className="text-xs font-semibold text-slate-400">{breadcrumbTrail.section}</span>
                              </BreadcrumbItem>
                            </>
                          )}
                          {breadcrumbTrail.subGroup && (
                            <>
                              <BreadcrumbSeparator />
                              <BreadcrumbItem>
                                <span className="text-xs text-slate-400">{breadcrumbTrail.subGroup}</span>
                              </BreadcrumbItem>
                            </>
                          )}
                          <BreadcrumbSeparator />
                          <BreadcrumbItem>
                            <BreadcrumbPage className="text-xs font-bold text-slate-700">{breadcrumbTrail.page}</BreadcrumbPage>
                          </BreadcrumbItem>
                        </BreadcrumbList>
                      </Breadcrumb>
                    </div>
                  )}

                  <div className="flex-1 min-h-0 relative">
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

      {/* Aggressive Reminder System — disabled (too noisy) */}
      {/* <AggressiveReminderSystem /> */}

      {/* Design Engine Floating Tab — persistent across all pages */}
      <DesignFloatingTab />

      {/* Floating Add Event FAB — draggable, always visible */}
      <DraggableFab storageKey="fab_add_event" className="fixed bottom-5 left-[8.5rem] z-[10001]">
        {({ guardClick }) => (
          <button
            onClick={guardClick(() => navigate(createPageUrl("NewEvent")))}
            className="w-11 h-11 rounded-full shadow-xl flex items-center justify-center bg-[#1E3A5F] hover:bg-[#2C3E50] text-white ring-2 ring-white/50 select-none"
            title="הוסף אירוע • גרור לשינוי מיקום • לחיצה כפולה לאיפוס"
          >
            <CalendarPlus className="w-5 h-5" />
          </button>
        )}
      </DraggableFab>

      {/* Floating Quick Add Task FAB — draggable, always visible */}
      <DraggableFab storageKey="fab_quick_add" className="fixed bottom-5 left-[4.5rem] z-[10001]">
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
      <DraggableFab storageKey="fab_notes" className="fixed bottom-5 left-5 z-[10001]">
        {({ guardClick }) => (
          <button
            onClick={guardClick(() => setNotesOpen(!notesOpen))}
            className={`w-11 h-11 rounded-full shadow-xl flex items-center justify-center ring-2 ring-white/50 select-none ${
              notesOpen
                ? 'bg-[#4682B4] hover:bg-[#2C3E50] text-white'
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
      <DesignProvider>
        <AyoaViewProvider>
          <BiologicalClockProvider>
            <LayoutInner>{children}</LayoutInner>
          </BiologicalClockProvider>
        </AyoaViewProvider>
      </DesignProvider>
    </AppProvider>
  );
}
