

import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Home, Brain, Briefcase, CheckSquare, Target, BookCheck, DollarSign,
  BarChart3, Settings, Menu, X, Users, Monitor, Scaling,
  Soup, BookHeart, Eye, Calendar, BookUser, Calculator, UserCheck, Database,
  ArrowRight, FileBarChart, Repeat, FolderKanban, Zap, StickyNote, ChevronLeft, ChevronRight
} from "lucide-react";
import { createPageUrl } from "@/utils";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import TimeAwareness from "@/components/ui/TimeAwareness";
import StickyNotes from "@/components/StickyNotes";
import GlobalSearch from "@/components/GlobalSearch";
import useAutoReminders from "@/hooks/useAutoReminders";

const navigationGroups = [
  {
    title: "LitayHub",
    icon: Home,
    color: 'emerald', // group accent color
    items: [
      {
        name: "ניהול זמן וריכוז",
        icon: Eye,
        color: 'sky',
        children: [
          { name: "פוקוס יומי", href: createPageUrl("Home"), icon: Eye },
          { name: "משימות", href: createPageUrl("Tasks"), icon: CheckSquare },
          { name: "ריכוז דיווחים חודשיים", href: createPageUrl("ClientsDashboard"), icon: BarChart3 },
          { name: "לוח שנה", href: createPageUrl("Calendar"), icon: Calendar },
          { name: "תכנון שבועי", href: createPageUrl("WeeklyPlanningDashboard"), icon: Brain },
          { name: "סיכום שבועי", href: createPageUrl("WeeklySummary"), icon: FileBarChart },
        ],
      },
      {
        name: "חשבות שכר והנה\"ח",
        icon: Calculator,
        color: 'violet',
        children: [
          {
            name: "שכר ודיווחי שכר",
            icon: Calculator,
            color: 'violet',
            children: [
              { name: "שכר ודיווחי רשויות", href: createPageUrl("PayrollDashboard"), icon: Calculator },
              { name: "דיווחים מרכזים תקופתיים", href: createPageUrl("PeriodicSummaryReports"), icon: FileBarChart },
            ],
          },
          {
            name: "הנה\"ח ודיווחי מיסים",
            icon: BookCheck,
            color: 'blue',
            children: [
              { name: "דיווחי מיסים חודשיים", href: createPageUrl("TaxReportsDashboard"), icon: FileBarChart },
              { name: "התאמות חשבונות", href: createPageUrl("Reconciliations"), icon: BookCheck },
              { name: "מאזנים שנתיים", href: createPageUrl("BalanceSheets"), icon: Scaling },
            ],
          },
          { name: "שירותים נוספים", href: createPageUrl("AdditionalServicesDashboard"), icon: Settings },
        ],
      },
      {
        name: "אוטומציות ויצירת משימות חוזרות",
        icon: Zap,
        color: 'amber',
        children: [
          { name: "אוטומציות", href: createPageUrl("AutomationRules"), icon: Zap },
          { name: "משימות חוזרות", href: createPageUrl("RecurringTasks"), icon: Repeat },
        ],
      },
      {
        name: "מרכז לקוחות",
        icon: Users,
        color: 'orange',
        children: [
          { name: "מרכז לקוחות", href: createPageUrl("ClientManagement"), icon: Users },
          { name: "לידים", href: createPageUrl("Leads"), icon: Target },
          { name: "קליטת לקוח חדש", href: createPageUrl("ClientOnboarding"), icon: UserCheck },
          { name: "מרכז נתוני שכ״ט", href: createPageUrl("FeeManagement"), icon: DollarSign },
        ],
      },
      {
        name: "ספקים ונותני שירות",
        icon: BookUser,
        color: 'teal',
        children: [
          { name: "ספקים ונותני שירותים", href: createPageUrl("ServiceProviders"), icon: BookUser },
        ],
      },
      { name: "מעקב פרויקטים", href: createPageUrl("Projects"), icon: FolderKanban, color: 'rose' },
    ],
  },
  {
    title: "LENA - בית וחיים",
    icon: BookHeart,
    color: 'pink',
    items: [
      { name: "תכנון ארוחות", href: createPageUrl("MealPlanner"), icon: Soup },
      { name: "השראה וספרים", href: createPageUrl("Inspiration"), icon: BookHeart },
      { name: "הגדרות אישיות", href: createPageUrl("LifeSettings"), icon: Settings },
    ],
  },
  {
    title: "מערכת",
    icon: Settings,
    color: 'gray',
    items: [
      { name: "הגדרת פרמטרים", href: createPageUrl("Settings"), icon: Settings },
      { name: "ייבוא נתונים", href: createPageUrl("DataImportTool"), icon: Database },
    ],
  },
];

// Color mapping for section-specific styling
const SECTION_COLORS = {
  sky: { bg: 'bg-sky-50', border: 'border-r-sky-400', icon: 'text-sky-600', activeBg: 'bg-sky-500', dot: 'bg-sky-400' },
  violet: { bg: 'bg-violet-50', border: 'border-r-violet-400', icon: 'text-violet-600', activeBg: 'bg-violet-500', dot: 'bg-violet-400' },
  blue: { bg: 'bg-blue-50', border: 'border-r-blue-400', icon: 'text-blue-600', activeBg: 'bg-blue-500', dot: 'bg-blue-400' },
  amber: { bg: 'bg-amber-50', border: 'border-r-amber-400', icon: 'text-amber-600', activeBg: 'bg-amber-500', dot: 'bg-amber-400' },
  orange: { bg: 'bg-orange-50', border: 'border-r-orange-400', icon: 'text-orange-600', activeBg: 'bg-orange-500', dot: 'bg-orange-400' },
  teal: { bg: 'bg-teal-50', border: 'border-r-teal-400', icon: 'text-teal-600', activeBg: 'bg-teal-500', dot: 'bg-teal-400' },
  rose: { bg: 'bg-rose-50', border: 'border-r-rose-400', icon: 'text-rose-600', activeBg: 'bg-rose-500', dot: 'bg-rose-400' },
  emerald: { bg: 'bg-emerald-50', border: 'border-r-emerald-400', icon: 'text-emerald-600', activeBg: 'bg-emerald-500', dot: 'bg-emerald-400' },
  pink: { bg: 'bg-pink-50', border: 'border-r-pink-400', icon: 'text-pink-600', activeBg: 'bg-pink-500', dot: 'bg-pink-400' },
  gray: { bg: 'bg-gray-50', border: 'border-r-gray-400', icon: 'text-gray-600', activeBg: 'bg-gray-500', dot: 'bg-gray-400' },
};

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  useAutoReminders();

  useEffect(() => {
    if (location.pathname === "/") {
      navigate(createPageUrl("Home"));
    }
  }, [location.pathname, navigate]);

  const isNavItemActive = (item) => {
    if (item.href) return location.pathname.startsWith(item.href);
    if (item.children) return item.children.some(child => isNavItemActive(child));
    return false;
  };

  const findPageTitle = (items) => {
    for (const item of items) {
      if (item.href && location.pathname.startsWith(item.href)) return item.name;
      if (item.children) {
        const title = findPageTitle(item.children);
        if (title) return title;
      }
    }
    return null;
  };

  const getPageTitle = () => {
    if (location.pathname === createPageUrl("Home")) return 'פוקוס יומי';
    for (const group of navigationGroups) {
      const title = findPageTitle(group.items);
      if (title) return title;
    }
    return 'LitayCalmPlan';
  };

  const activeGroupTitle = navigationGroups.find(group =>
    group.items.some(item => isNavItemActive(item))
  )?.title;

  const isHomePage = location.pathname === createPageUrl("Home");

  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      <style>{`
        :root {
          /* צבעים חדשים ושמחים */
          --primary: 160 80% 39%; /* emerald-500: #10b981 */
          --primary-foreground: 0 0% 100%;
          --secondary: 158 92% 30%; /* emerald-600: #059669 */
          --secondary-foreground: 0 0% 100%;
          --accent: 158 92% 30%; /* emerald-600 */
          --accent-foreground: 0 0% 100%;

          /* אפורים מקצועיים */
          --neutral-dark: #2d3436;
          --neutral-medium: #636e72;
          --neutral-light: #b2bec3;
          --neutral-bg: #f5f6fa;
          --background: #ffffff;

          /* צבעי סטטוס */
          --status-success: #27ae60;
          --status-warning: #f39c12;
          --status-error: #e74c3c;
          --status-info: #3498db;
          --status-pending: #9b59b6;

          /* מיפוי לטיילווינד בפורמט HSL */
          --muted: 228 25% 97%;
          --muted-foreground: 200 7% 42%;
          --card: 0 0% 100%;
          --card-foreground: 192 9% 19%;
          --popover: 0 0% 100%;
          --popover-foreground: 192 9% 19%;
          --border: 200 16% 85%; /* Lightened border */
          --input: 200 16% 85%;  /* Lightened input border */
          --ring: 160 80% 39%; /* emerald-500 */
          --foreground: 192 9% 19%;
          --destructive: 5 79% 57%;
          --destructive-foreground: 0 0% 100%;
        }

        /* Fonts loaded via index.html <link> for faster rendering */

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

      <div className="min-h-screen flex flex-col md:flex-row w-full">
        <div className="md:hidden bg-card/90 backdrop-blur-md border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 z-50 shadow-sm">
           <Link to={createPageUrl("Home")} className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center shadow-lg">
                <Brain className="w-5 h-5 text-primary-foreground" />
              </div>
              <h1 className="text-lg font-bold text-foreground">LitayCalmPlan</h1>
          </Link>
          <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </Button>
        </div>

        <div className={`fixed md:relative inset-y-0 right-0 z-40 w-72 bg-card/95 backdrop-blur-xl border-l border-border shadow-xl transform transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'} md:translate-x-0`}>
          <div className="flex flex-col h-full">
             <div className="p-4 border-b border-border flex items-center justify-between bg-gradient-to-r from-primary/5 to-secondary/5">
                <Link to={createPageUrl("Home")} className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center shadow-lg">
                      <Brain className="w-6 h-6 text-primary-foreground" />
                    </div>
                    <div>
                      <h1 className="text-xl font-bold text-foreground">LitayCalmPlan</h1>
                      <p className="text-sm text-muted-foreground">ניהול עסק חכם</p>
                    </div>
                </Link>
                <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsMobileMenuOpen(false)}>
                    <X className="w-5 h-5"/>
                </Button>
            </div>

            {/* Global Search */}
            <div className="px-4 pt-3">
              <GlobalSearch />
            </div>

            <nav className="flex-1 p-3 overflow-y-auto">
              <Accordion type="single" collapsible className="w-full" defaultValue={activeGroupTitle || navigationGroups[0].title}>
                {navigationGroups.map((group) => {
                  const groupColor = SECTION_COLORS[group.color] || SECTION_COLORS.emerald;
                  const groupHasActive = group.items.some(item => isNavItemActive(item));
                  return (
                  <AccordionItem value={group.title} key={group.title} className="border-none mb-2 rounded-xl overflow-hidden">
                    <AccordionTrigger className={`p-3 font-bold text-foreground hover:no-underline rounded-t-lg transition-colors ${groupHasActive ? groupColor.bg : 'hover:bg-muted/50'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${groupHasActive ? groupColor.activeBg : 'bg-gray-200'}`}>
                          <group.icon className={`w-4 h-4 ${groupHasActive ? 'text-white' : 'text-gray-500'}`} />
                        </div>
                        <span className="text-sm">{group.title}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-1 pb-1 px-1 space-y-0.5 bg-card">
                      {group.items.map((item) => {
                        const hasActiveChild = isNavItemActive(item);
                        const sectionColor = SECTION_COLORS[item.color] || groupColor;

                        if (item.children) {
                          return (
                            <Accordion
                              type="single"
                              collapsible
                              className="w-full"
                              defaultValue={hasActiveChild ? item.name : undefined}
                              key={item.name}
                            >
                              <AccordionItem value={item.name} className={`border-none rounded-lg overflow-hidden ${hasActiveChild ? 'border-r-2 ' + sectionColor.border : ''}`}>
                                <AccordionTrigger className={`p-2.5 pr-3 font-semibold text-sm hover:no-underline rounded-lg transition-colors ${hasActiveChild ? sectionColor.bg : 'hover:bg-muted/40'}`}>
                                  <div className="flex items-center gap-2.5">
                                    <div className={`w-2 h-2 rounded-full ${hasActiveChild ? sectionColor.dot : 'bg-gray-300'}`} />
                                    <item.icon className={`w-4 h-4 ${hasActiveChild ? sectionColor.icon : 'text-gray-400'}`} />
                                    <span className={hasActiveChild ? 'text-gray-900' : 'text-gray-600'}>{item.name}</span>
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent className="pt-1 pb-1 px-1 space-y-0.5">
                                  {item.children.map((childItem) => {
                                    const childColor = SECTION_COLORS[childItem.color] || sectionColor;
                                    if (childItem.children) {
                                      const hasActiveSubChild = isNavItemActive(childItem);
                                      return (
                                        <Accordion
                                          type="single"
                                          collapsible
                                          className="w-full"
                                          defaultValue={hasActiveSubChild ? childItem.name : undefined}
                                          key={childItem.name}
                                        >
                                          <AccordionItem value={childItem.name} className="border-none rounded-lg overflow-hidden">
                                            <AccordionTrigger className={`p-2 pr-5 text-xs font-semibold hover:no-underline rounded-lg transition-colors ${hasActiveSubChild ? childColor.bg : 'hover:bg-muted/30'}`}>
                                              <div className="flex items-center gap-2">
                                                <div className={`w-1.5 h-1.5 rounded-full ${hasActiveSubChild ? childColor.dot : 'bg-gray-200'}`} />
                                                <childItem.icon className={`w-3.5 h-3.5 ${hasActiveSubChild ? childColor.icon : 'text-gray-400'}`} />
                                                <span className={hasActiveSubChild ? 'text-gray-800' : 'text-gray-500'}>{childItem.name}</span>
                                              </div>
                                            </AccordionTrigger>
                                            <AccordionContent className="pt-0.5 pb-1 px-1 space-y-0.5">
                                              {childItem.children.map((subItem) => {
                                                const isActive = location.pathname.startsWith(subItem.href);
                                                return (
                                                  <Link
                                                    key={subItem.name}
                                                    to={subItem.href}
                                                    onClick={() => setIsMobileMenuOpen(false)}
                                                    className={`group flex items-center pr-8 pl-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${isActive ? childColor.activeBg + ' text-white shadow-sm' : 'text-gray-600 hover:' + childColor.bg}`}
                                                  >
                                                    <subItem.icon className={`ml-2 h-3.5 w-3.5 ${isActive ? 'text-white' : childColor.icon}`} />
                                                    {subItem.name}
                                                  </Link>
                                                );
                                              })}
                                            </AccordionContent>
                                          </AccordionItem>
                                        </Accordion>
                                      );
                                    }

                                    const isActive = location.pathname.startsWith(childItem.href);
                                    return (
                                      <Link
                                        key={childItem.name}
                                        to={childItem.href}
                                        onClick={() => setIsMobileMenuOpen(false)}
                                        className={`group flex items-center pr-5 pl-3 py-2 text-sm font-medium rounded-md transition-all duration-200 ${isActive ? sectionColor.activeBg + ' text-white shadow-sm' : 'text-gray-600 hover:' + sectionColor.bg}`}
                                      >
                                        <childItem.icon className={`ml-2.5 h-4 w-4 ${isActive ? 'text-white' : sectionColor.icon}`} />
                                        {childItem.name}
                                      </Link>
                                    );
                                  })}
                                </AccordionContent>
                              </AccordionItem>
                            </Accordion>
                          );
                        } else {
                          const isActive = location.pathname.startsWith(item.href);
                          return (
                            <Link
                              key={item.name}
                              to={item.href}
                              onClick={() => setIsMobileMenuOpen(false)}
                              className={`group flex items-center pr-3 pl-3 py-2 text-sm font-medium rounded-md transition-all duration-200 ${isActive ? sectionColor.activeBg + ' text-white shadow-sm' : 'text-gray-600 hover:' + sectionColor.bg}`}
                            >
                              <div className={`w-2 h-2 rounded-full ml-2.5 ${isActive ? 'bg-white' : sectionColor.dot}`} />
                              <item.icon className={`ml-2.5 h-4 w-4 ${isActive ? 'text-white' : sectionColor.icon}`} />
                              {item.name}
                            </Link>
                          );
                        }
                      })}
                    </AccordionContent>
                  </AccordionItem>
                  );
                })}
              </Accordion>
            </nav>
          </div>
        </div>

        <main className="flex-1 flex min-h-0">
          {/* Main content column */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="md:hidden bg-gradient-to-r from-primary/5 to-secondary/5 px-4 py-3 border-b border-border">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-foreground">
                  {getPageTitle()}
                </h2>
                {!isHomePage && (
                  <Link to={createPageUrl("Home")}>
                    <Button variant="outline" size="sm" className="flex items-center gap-2">
                      <ArrowRight className="w-4 h-4" />
                      חזור לבית
                    </Button>
                  </Link>
                )}
              </div>
            </div>

            {/* Desktop Back Button */}
            <div className="hidden md:block">
              {!isHomePage && (
                <div className="p-4 border-b border-border bg-gradient-to-r from-primary/5 to-secondary/5">
                  <div className="max-w-full mx-auto flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-foreground">
                      {getPageTitle()}
                    </h2>
                    <Link to={createPageUrl("Home")}>
                      <Button variant="outline" className="flex items-center gap-2">
                        <ArrowRight className="w-4 h-4" />
                        חזור לדף הבית
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-auto p-3 md:p-6 lg:p-8 bg-neutral-bg/30">
              <div className="max-w-full mx-auto">
                <TimeAwareness />
                {children}
              </div>
            </div>
          </div>

        </main>
      </div>

      {isMobileMenuOpen && <div className="md:hidden fixed inset-0 bg-black/40 z-30" onClick={() => setIsMobileMenuOpen(false)}></div>}

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

      {/* Floating Sticky Notes Panel - overlay */}
      {notesOpen && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setNotesOpen(false)} />
          <div
            className="fixed bottom-20 left-4 z-50 w-[320px] max-w-[calc(100vw-2rem)] max-h-[70vh] bg-white rounded-2xl shadow-2xl border-2 border-amber-300 flex flex-col overflow-hidden"
            style={{ direction: 'rtl' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-l from-amber-100 to-amber-50 border-b border-amber-200 shrink-0">
              <div className="flex items-center gap-2">
                <StickyNote className="w-5 h-5 text-amber-600" />
                <span className="font-bold text-amber-800">פתקים דביקים</span>
              </div>
              <button
                onClick={() => setNotesOpen(false)}
                className="p-1 rounded-lg hover:bg-amber-200 transition-colors"
              >
                <X className="w-4 h-4 text-amber-600" />
              </button>
            </div>
            {/* Scrollable notes body */}
            <div className="flex-1 overflow-y-auto overscroll-contain p-3" style={{ scrollBehavior: 'smooth' }}>
              <StickyNotes compact={false} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

