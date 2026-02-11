import Layout from "./Layout.jsx";

import Calendar from "./Calendar";

import NewEvent from "./NewEvent";

import Print from "./Print";

import Tasks from "./Tasks";

import Analytics from "./Analytics";

import TaskMatrix from "./TaskMatrix";

import Settings from "./Settings";

import MondayIntegration from "./MondayIntegration";

import Recommendations from "./Recommendations";

import Dashboards from "./Dashboards";

import LifeSettings from "./LifeSettings";

import Reconciliations from "./Reconciliations";

import Home from "./Home";

import BusinessHub from "./BusinessHub";

import MealPlanner from "./MealPlanner";

import Inspiration from "./Inspiration";

import ClientManagement from "./ClientManagement";

import Collections from "./Collections";

import ServiceProviders from "./ServiceProviders";

import ClientOnboarding from "./ClientOnboarding";

import PayrollDashboard from "./PayrollDashboard";

import ClientsDashboard from "./ClientsDashboard";

import TaxReportsDashboard from "./TaxReportsDashboard";

import Leads from "./Leads";

import ServiceProvidersPage from "./ServiceProvidersPage";

import Roadmap from "./Roadmap";

import HomeTaskGenerator from "./HomeTaskGenerator";

import WeeklyPlanner from "./WeeklyPlanner";

import TestDataManager from "./TestDataManager";

import EmergencyRecovery from "./EmergencyRecovery";

import SystemOverview from "./SystemOverview";

import EmergencyReset from "./EmergencyReset";

import FullSync from "./FullSync";

import WeeklyPlanningDashboard from "./WeeklyPlanningDashboard";

import BalanceSheets from "./BalanceSheets";

import WeeklySummary from "./WeeklySummary";

import RecurringTasks from "./RecurringTasks";

import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';

const PAGES = {
    
    Calendar: Calendar,
    
    NewEvent: NewEvent,
    
    Print: Print,
    
    Tasks: Tasks,
    
    Analytics: Analytics,
    
    TaskMatrix: TaskMatrix,
    
    Settings: Settings,
    
    MondayIntegration: MondayIntegration,
    
    Recommendations: Recommendations,
    
    Dashboards: Dashboards,
    
    LifeSettings: LifeSettings,
    
    Reconciliations: Reconciliations,
    
    Home: Home,
    
    BusinessHub: BusinessHub,
    
    MealPlanner: MealPlanner,
    
    Inspiration: Inspiration,
    
    ClientManagement: ClientManagement,
    
    Collections: Collections,
    
    ServiceProviders: ServiceProviders,
    
    ClientOnboarding: ClientOnboarding,
    
    PayrollDashboard: PayrollDashboard,

    ClientsDashboard: ClientsDashboard,

    TaxReportsDashboard: TaxReportsDashboard,

    Leads: Leads,
    
    ServiceProvidersPage: ServiceProvidersPage,
    
    Roadmap: Roadmap,
    
    HomeTaskGenerator: HomeTaskGenerator,

    WeeklyPlanner: WeeklyPlanner,
    
    TestDataManager: TestDataManager,
    
    EmergencyRecovery: EmergencyRecovery,
    
    SystemOverview: SystemOverview,
    
    EmergencyReset: EmergencyReset,
    
    FullSync: FullSync,
    
    WeeklyPlanningDashboard: WeeklyPlanningDashboard,
    
    BalanceSheets: BalanceSheets,

    WeeklySummary: WeeklySummary,

    RecurringTasks: RecurringTasks,

}

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }

    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === urlLastPart.toLowerCase());
    return pageName || Object.keys(PAGES)[0];
}

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);
    
    return (
        <Layout currentPageName={currentPage}>
            <Routes>            
                
                    <Route path="/" element={<Calendar />} />
                
                
                <Route path="/Calendar" element={<Calendar />} />
                
                <Route path="/NewEvent" element={<NewEvent />} />
                
                <Route path="/Print" element={<Print />} />
                
                <Route path="/Tasks" element={<Tasks />} />
                
                <Route path="/Analytics" element={<Analytics />} />
                
                <Route path="/TaskMatrix" element={<TaskMatrix />} />
                
                <Route path="/Settings" element={<Settings />} />
                
                <Route path="/MondayIntegration" element={<MondayIntegration />} />
                
                <Route path="/Recommendations" element={<Recommendations />} />
                
                <Route path="/Dashboards" element={<Dashboards />} />
                
                <Route path="/LifeSettings" element={<LifeSettings />} />
                
                <Route path="/Reconciliations" element={<Reconciliations />} />
                
                <Route path="/Home" element={<Home />} />
                
                <Route path="/BusinessHub" element={<BusinessHub />} />
                
                <Route path="/MealPlanner" element={<MealPlanner />} />
                
                <Route path="/Inspiration" element={<Inspiration />} />
                
                <Route path="/ClientManagement" element={<ClientManagement />} />
                
                <Route path="/Collections" element={<Collections />} />
                
                <Route path="/ServiceProviders" element={<ServiceProviders />} />
                
                <Route path="/ClientOnboarding" element={<ClientOnboarding />} />
                
                <Route path="/PayrollDashboard" element={<PayrollDashboard />} />

                <Route path="/ClientsDashboard" element={<ClientsDashboard />} />

                <Route path="/TaxReportsDashboard" element={<TaxReportsDashboard />} />

                <Route path="/Leads" element={<Leads />} />
                
                <Route path="/ServiceProvidersPage" element={<ServiceProvidersPage />} />
                
                <Route path="/Roadmap" element={<Roadmap />} />
                
                <Route path="/HomeTaskGenerator" element={<HomeTaskGenerator />} />

                <Route path="/WeeklyPlanner" element={<WeeklyPlanner />} />
                
                <Route path="/TestDataManager" element={<TestDataManager />} />
                
                <Route path="/EmergencyRecovery" element={<EmergencyRecovery />} />
                
                <Route path="/SystemOverview" element={<SystemOverview />} />
                
                <Route path="/EmergencyReset" element={<EmergencyReset />} />
                
                <Route path="/FullSync" element={<FullSync />} />
                
                <Route path="/WeeklyPlanningDashboard" element={<WeeklyPlanningDashboard />} />
                
                <Route path="/BalanceSheets" element={<BalanceSheets />} />

                <Route path="/WeeklySummary" element={<WeeklySummary />} />

                <Route path="/RecurringTasks" element={<RecurringTasks />} />

            </Routes>
        </Layout>
    );
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}