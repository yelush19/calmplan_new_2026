

import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Home, Brain, Briefcase, CheckSquare, Target, BookCheck, DollarSign,
  BarChart3, Settings, Menu, X, Users, Monitor, Scaling,
  Soup, BookHeart, Eye, Calendar, BookUser, Calculator, UserCheck, Database,
  ArrowRight, FileBarChart, Repeat, FolderKanban, Zap
} from "lucide-react";
import { createPageUrl } from "@/utils";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import TimeAwareness from "@/components/ui/TimeAwareness";

const navigationGroups = [
  {
    title: "LitayHub",
    icon: Home,
    items: [
      {
        name: "ניהול זמן וריכוז",
        icon: Eye,
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
        children: [
          {
            name: "שכר ודיווחי שכר",
            icon: Calculator,
            children: [
              { name: "שכר ודיווחי רשויות", href: createPageUrl("PayrollDashboard"), icon: Calculator },
              { name: "דיווחים מרכזים תקופתיים", href: createPageUrl("PeriodicSummaryReports"), icon: FileBarChart },
            ],
          },
          {
            name: "הנה\"ח ודיווחי מיסים",
            icon: BookCheck,
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
        children: [
          { name: "אוטומציות", href: createPageUrl("AutomationRules"), icon: Zap },
          { name: "משימות חוזרות", href: createPageUrl("RecurringTasks"), icon: Repeat },
        ],
      },
      {
        name: "מרכז לקוחות",
        icon: Users,
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
        children: [
          { name: "ספקים ונותני שירותים", href: createPageUrl("ServiceProviders"), icon: BookUser },
        ],
      },
      { name: "מעקב פרויקטים", href: createPageUrl("Projects"), icon: FolderKanban },
    ],
  },
  {
    title: "LENA - בית וחיים",
    icon: BookHeart,
    items: [
      { name: "תכנון ארוחות", href: createPageUrl("MealPlanner"), icon: Soup },
      { name: "השראה וספרים", href: createPageUrl("Inspiration"), icon: BookHeart },
      { name: "הגדרות אישיות", href: createPageUrl("LifeSettings"), icon: Settings },
    ],
  },
  {
    title: "מערכת",
    icon: Settings,
    items: [
      { name: "הגדרת פרמטרים", href: createPageUrl("Settings"), icon: Settings },
      { name: "ייבוא נתונים", href: createPageUrl("DataImportTool"), icon: Database },
    ],
  },
];

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

        @import url('https://fonts.googleapis.com/css2?family=Assistant:wght@400;600&family=Varela+Round:wght@400&display=swap');

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

            <nav className="flex-1 p-4 overflow-y-auto">
              <Accordion type="single" collapsible className="w-full" defaultValue={activeGroupTitle || navigationGroups[0].title}>
                {navigationGroups.map((group) => (
                  <AccordionItem value={group.title} key={group.title} className="border-none mb-2 rounded-xl overflow-hidden bg-muted/30">
                    <AccordionTrigger className="p-3 font-semibold text-foreground hover:no-underline hover:bg-muted/50 rounded-t-lg">
                      <div className="flex items-center gap-3">
                        <group.icon className="w-5 h-5 text-primary" />
                        <span>{group.title}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 pb-1 px-1 space-y-1 bg-card">
                      {group.items.map((item) => {
                        const hasActiveChild = isNavItemActive(item);

                        if (item.children) {
                          return (
                            <Accordion
                              type="single"
                              collapsible
                              className="w-full pr-2"
                              defaultValue={hasActiveChild ? item.name : undefined}
                              key={item.name}
                            >
                              <AccordionItem value={item.name} className="border-none rounded-xl overflow-hidden bg-muted/20">
                                <AccordionTrigger className="p-3 font-semibold text-foreground hover:no-underline hover:bg-muted/50 rounded-lg">
                                  <div className="flex items-center gap-3">
                                    <item.icon className="w-5 h-5 text-primary" />
                                    <span>{item.name}</span>
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent className="pt-2 pb-1 px-1 space-y-1 bg-card">
                                  {item.children.map((childItem) => {
                                    if (childItem.children) {
                                      const hasActiveSubChild = isNavItemActive(childItem);
                                      return (
                                        <Accordion
                                          type="single"
                                          collapsible
                                          className="w-full pr-1"
                                          defaultValue={hasActiveSubChild ? childItem.name : undefined}
                                          key={childItem.name}
                                        >
                                          <AccordionItem value={childItem.name} className="border-none rounded-lg overflow-hidden bg-muted/10">
                                            <AccordionTrigger className="p-2.5 pr-4 text-sm font-semibold text-foreground hover:no-underline hover:bg-muted/40 rounded-lg">
                                              <div className="flex items-center gap-2">
                                                <childItem.icon className="w-4 h-4 text-primary/70" />
                                                <span>{childItem.name}</span>
                                              </div>
                                            </AccordionTrigger>
                                            <AccordionContent className="pt-1 pb-1 px-1 space-y-0.5">
                                              {childItem.children.map((subItem) => {
                                                const isActive = location.pathname.startsWith(subItem.href);
                                                const subClasses = `group flex items-center pr-8 pl-3 py-2 text-sm font-medium rounded-lg transition-all duration-300 ${isActive ? 'bg-primary text-primary-foreground shadow-md' : 'text-foreground hover:bg-primary/10'}`;
                                                const subIconClasses = `ml-2 h-3.5 w-3.5 ${isActive ? 'text-primary-foreground' : 'text-primary/70'}`;
                                                return (
                                                  <Link
                                                    key={subItem.name}
                                                    to={subItem.href}
                                                    onClick={() => setIsMobileMenuOpen(false)}
                                                    className={subClasses}
                                                  >
                                                    <subItem.icon className={subIconClasses} />
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
                                    const itemClasses = `group flex items-center pr-6 pl-3 py-2.5 text-base font-medium rounded-lg transition-all duration-300 ${isActive ? 'bg-primary text-primary-foreground shadow-md' : 'text-foreground hover:bg-primary/10'}`;
                                    const iconClasses = `ml-3 h-4 w-4 ${isActive ? 'text-primary-foreground' : 'text-primary/80'}`;

                                    if (childItem.external) {
                                      return (
                                        <a
                                          key={childItem.name}
                                          href={childItem.href}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className={itemClasses}
                                          onClick={() => setIsMobileMenuOpen(false)}
                                        >
                                          <childItem.icon className={iconClasses} />
                                          {childItem.name}
                                        </a>
                                      );
                                    }

                                    return (
                                      <Link
                                        key={childItem.name}
                                        to={childItem.href}
                                        onClick={() => setIsMobileMenuOpen(false)}
                                        className={itemClasses}
                                      >
                                        <childItem.icon className={iconClasses} />
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
                          const itemClasses = `group flex items-center pr-4 pl-3 py-2.5 text-base font-medium rounded-lg transition-all duration-300 ${isActive ? 'bg-primary text-primary-foreground shadow-md' : 'text-foreground hover:bg-primary/10'}`;
                          const iconClasses = `ml-3 h-5 w-5 ${isActive ? 'text-primary-foreground' : 'text-primary/80'}`;

                          if (item.external) {
                            return (
                              <a
                                key={item.name}
                                href={item.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={itemClasses}
                                onClick={() => setIsMobileMenuOpen(false)}
                              >
                                <item.icon className={iconClasses} />
                                {item.name}
                              </a>
                            );
                          }

                          return (
                            <Link
                              key={item.name}
                              to={item.href}
                              onClick={() => setIsMobileMenuOpen(false)}
                              className={itemClasses}
                            >
                              <item.icon className={iconClasses} />
                              {item.name}
                            </Link>
                          );
                        }
                      })}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </nav>
          </div>
        </div>

        <main className="flex-1 flex flex-col min-h-0">
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
        </main>
      </div>
       {isMobileMenuOpen && <div className="md:hidden fixed inset-0 bg-black/40 z-30" onClick={() => setIsMobileMenuOpen(false)}></div>}
    </div>
  );
}

