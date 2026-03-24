import { Link as RouterLink } from 'react-router-dom';
import Layout from "./Layout.jsx";

import Calendar from "./Calendar";

import NewEvent from "./NewEvent";

import Print from "./Print";

import Tasks from "./Tasks";

import Analytics from "./Analytics";

import TaskMatrix from "./TaskMatrix";

import Settings from "./Settings";

// MondayIntegration removed (Kill Monday directive)

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

import Roadmap from "./Roadmap";

import HomeTaskGenerator from "./HomeTaskGenerator";

import TestDataManager from "./TestDataManager";

import EmergencyRecovery from "./EmergencyRecovery";

import SystemOverview from "./SystemOverview";

import EmergencyReset from "./EmergencyReset";

// FullSync removed (Kill Monday directive)

import WeeklyPlanningDashboard from "./WeeklyPlanningDashboard";

import BalanceSheets from "./BalanceSheets";

import BalanceSheetWorkbook from "./BalanceSheetWorkbook";

import WeeklySummary from "./WeeklySummary";

import RecurringTasks from "./RecurringTasks";

import DataImportTool from "./DataImportTool";

import FeeManagement from "./FeeManagement";

import Projects from "./Projects";

import ProjectWorkbook from "./ProjectWorkbook";

import PeriodicSummaryReports from "./PeriodicSummaryReports";

import AutomationRules from "./AutomationRules";

import AdditionalServicesDashboard from "./AdditionalServicesDashboard";

import PayrollReportsDashboard from "./PayrollReportsDashboard";

import AdminTasksDashboard from "./AdminTasksDashboard";

import ClientFiles from "./ClientFiles";

import BackupManager from "./BackupManager";

import SystemReadiness from "./SystemReadiness";

import ClientContracts from "./ClientContracts";

import BatchSetup from "./BatchSetup";

import FinancialResultsDashboard from "./FinancialResultsDashboard";

import MyFocus from "./MyFocus";

import Inventory from "./Inventory";

import WeeklyPlanner from "./WeeklyPlanner";

import TreatmentInput from "./TreatmentInput";

import AutomationPage from "./AutomationPage";

import CalendarView from "./CalendarView";

import ClientWorkbook from "./ClientWorkbook";

import { HashRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const pageTransition = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
    transition: { duration: 0.2, ease: 'easeOut' },
};

function AnimatedPage({ children }) {
    return (
        <motion.div {...pageTransition}>
            {children}
        </motion.div>
    );
}

const PAGES = {
    
    Calendar: Calendar,
    
    NewEvent: NewEvent,
    
    Print: Print,
    
    Tasks: Tasks,
    
    Analytics: Analytics,
    
    TaskMatrix: TaskMatrix,
    
    Settings: Settings,
    
    // MondayIntegration: removed (Kill Monday)
    
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

    PayrollReportsDashboard: PayrollReportsDashboard,

    ClientsDashboard: ClientsDashboard,

    TaxReportsDashboard: TaxReportsDashboard,

    Leads: Leads,
    
    Roadmap: Roadmap,

    HomeTaskGenerator: HomeTaskGenerator,
    
    TestDataManager: TestDataManager,
    
    EmergencyRecovery: EmergencyRecovery,
    
    SystemOverview: SystemOverview,
    
    EmergencyReset: EmergencyReset,
    
    // FullSync: removed (Kill Monday)
    
    WeeklyPlanningDashboard: WeeklyPlanningDashboard,
    
    BalanceSheets: BalanceSheets,

    BalanceSheetWorkbook: BalanceSheetWorkbook,

    WeeklySummary: WeeklySummary,

    RecurringTasks: RecurringTasks,

    DataImportTool: DataImportTool,

    FeeManagement: FeeManagement,

    Projects: Projects,

    ProjectWorkbook: ProjectWorkbook,

    PeriodicSummaryReports: PeriodicSummaryReports,

    AutomationRules: AutomationRules,

    AdditionalServicesDashboard: AdditionalServicesDashboard,

    AdminTasksDashboard: AdminTasksDashboard,

    ClientFiles: ClientFiles,

    BackupManager: BackupManager,

    SystemReadiness: SystemReadiness,

    ClientContracts: ClientContracts,

    BatchSetup: BatchSetup,

    FinancialResultsDashboard: FinancialResultsDashboard,

    MyFocus: MyFocus,

    Inventory: Inventory,

    WeeklyPlanner: WeeklyPlanner,

    TreatmentInput: TreatmentInput,

    AutomationPage: AutomationPage,

    CalendarView: CalendarView,

    ClientWorkbook: ClientWorkbook,

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
    return pageName || 'Home';
}

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);
    
    return (
        <Layout currentPageName={currentPage}>
            <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>

                    <Route path="/" element={<AnimatedPage><Home /></AnimatedPage>} />
                
                
                <Route path="/Calendar" element={<AnimatedPage><Calendar /></AnimatedPage>} />
                
                <Route path="/NewEvent" element={<AnimatedPage><NewEvent /></AnimatedPage>} />
                
                <Route path="/Print" element={<AnimatedPage><Print /></AnimatedPage>} />
                
                <Route path="/Tasks" element={<AnimatedPage><Tasks /></AnimatedPage>} />
                
                <Route path="/Analytics" element={<AnimatedPage><Analytics /></AnimatedPage>} />
                
                <Route path="/TaskMatrix" element={<AnimatedPage><TaskMatrix /></AnimatedPage>} />
                
                <Route path="/Settings" element={<AnimatedPage><Settings /></AnimatedPage>} />
                
                {/* MondayIntegration route removed — Kill Monday */}
                
                <Route path="/Recommendations" element={<AnimatedPage><Recommendations /></AnimatedPage>} />
                
                <Route path="/Dashboards" element={<AnimatedPage><Dashboards /></AnimatedPage>} />
                
                <Route path="/LifeSettings" element={<AnimatedPage><LifeSettings /></AnimatedPage>} />
                
                <Route path="/Reconciliations" element={<AnimatedPage><Reconciliations /></AnimatedPage>} />
                
                <Route path="/Home" element={<AnimatedPage><Home /></AnimatedPage>} />
                
                <Route path="/BusinessHub" element={<AnimatedPage><BusinessHub /></AnimatedPage>} />
                
                <Route path="/MealPlanner" element={<AnimatedPage><MealPlanner /></AnimatedPage>} />
                
                <Route path="/Inspiration" element={<AnimatedPage><Inspiration /></AnimatedPage>} />
                
                <Route path="/ClientManagement" element={<AnimatedPage><ClientManagement /></AnimatedPage>} />
                
                <Route path="/Collections" element={<AnimatedPage><Collections /></AnimatedPage>} />
                
                <Route path="/ServiceProviders" element={<AnimatedPage><ServiceProviders /></AnimatedPage>} />
                
                <Route path="/ClientOnboarding" element={<AnimatedPage><ClientOnboarding /></AnimatedPage>} />
                
                <Route path="/PayrollDashboard" element={<AnimatedPage><PayrollDashboard /></AnimatedPage>} />

                <Route path="/ClientsDashboard" element={<AnimatedPage><ClientsDashboard /></AnimatedPage>} />

                <Route path="/TaxReportsDashboard" element={<AnimatedPage><TaxReportsDashboard /></AnimatedPage>} />

                <Route path="/Leads" element={<AnimatedPage><Leads /></AnimatedPage>} />
                
                <Route path="/Roadmap" element={<AnimatedPage><Roadmap /></AnimatedPage>} />

                <Route path="/HomeTaskGenerator" element={<AnimatedPage><HomeTaskGenerator /></AnimatedPage>} />
                
                <Route path="/TestDataManager" element={<AnimatedPage><TestDataManager /></AnimatedPage>} />
                
                <Route path="/EmergencyRecovery" element={<AnimatedPage><EmergencyRecovery /></AnimatedPage>} />
                
                <Route path="/SystemOverview" element={<AnimatedPage><SystemOverview /></AnimatedPage>} />
                
                <Route path="/EmergencyReset" element={<AnimatedPage><EmergencyReset /></AnimatedPage>} />
                
                {/* FullSync route removed — Kill Monday */}
                
                <Route path="/WeeklyPlanningDashboard" element={<AnimatedPage><WeeklyPlanningDashboard /></AnimatedPage>} />
                
                <Route path="/BalanceSheets" element={<AnimatedPage><BalanceSheets /></AnimatedPage>} />

                <Route path="/BalanceSheetWorkbook" element={<AnimatedPage><BalanceSheetWorkbook /></AnimatedPage>} />

                <Route path="/WeeklySummary" element={<AnimatedPage><WeeklySummary /></AnimatedPage>} />

                <Route path="/RecurringTasks" element={<AnimatedPage><RecurringTasks /></AnimatedPage>} />

                <Route path="/DataImportTool" element={<AnimatedPage><DataImportTool /></AnimatedPage>} />

                <Route path="/FeeManagement" element={<AnimatedPage><FeeManagement /></AnimatedPage>} />

                <Route path="/Projects" element={<AnimatedPage><Projects /></AnimatedPage>} />

                <Route path="/ProjectWorkbook" element={<AnimatedPage><ProjectWorkbook /></AnimatedPage>} />

                <Route path="/PeriodicSummaryReports" element={<AnimatedPage><PeriodicSummaryReports /></AnimatedPage>} />

                <Route path="/AutomationRules" element={<AnimatedPage><AutomationRules /></AnimatedPage>} />

                <Route path="/AdditionalServicesDashboard" element={<AnimatedPage><AdditionalServicesDashboard scope="p1" /></AnimatedPage>} />

                <Route path="/PayrollReportsDashboard" element={<AnimatedPage><PayrollReportsDashboard /></AnimatedPage>} />

                <Route path="/BookkeepingExtrasDashboard" element={<AnimatedPage><AdditionalServicesDashboard scope="p2" /></AnimatedPage>} />

                <Route path="/AdminTasksDashboard" element={<AnimatedPage><AdminTasksDashboard /></AnimatedPage>} />

                <Route path="/ClientFiles" element={<AnimatedPage><ClientFiles /></AnimatedPage>} />

                <Route path="/BackupManager" element={<AnimatedPage><BackupManager /></AnimatedPage>} />

                <Route path="/SystemReadiness" element={<AnimatedPage><SystemReadiness /></AnimatedPage>} />

                <Route path="/ClientContracts" element={<AnimatedPage><ClientContracts /></AnimatedPage>} />

                <Route path="/BatchSetup" element={<AnimatedPage><BatchSetup /></AnimatedPage>} />

                <Route path="/FinancialResultsDashboard" element={<AnimatedPage><FinancialResultsDashboard /></AnimatedPage>} />

                <Route path="/MyFocus" element={<AnimatedPage><MyFocus /></AnimatedPage>} />

                <Route path="/Inventory" element={<AnimatedPage><Inventory /></AnimatedPage>} />

                <Route path="/WeeklyPlanner" element={<AnimatedPage><WeeklyPlanner /></AnimatedPage>} />

                <Route path="/TreatmentInput" element={<AnimatedPage><TreatmentInput /></AnimatedPage>} />

                <Route path="/AutomationPage" element={<AnimatedPage><AutomationPage /></AnimatedPage>} />

                <Route path="/CalendarView" element={<AnimatedPage><CalendarView /></AnimatedPage>} />

                <Route path="/ClientWorkbook" element={<AnimatedPage><ClientWorkbook /></AnimatedPage>} />

                <Route path="*" element={
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <h1 className="text-6xl font-bold text-gray-300 mb-4">404</h1>
                        <p className="text-xl text-gray-600 mb-6">העמוד לא נמצא</p>
                        <RouterLink to="/Home" className="text-primary hover:underline font-medium">חזור לדף הבית</RouterLink>
                    </div>
                } />

            </Routes>
            </AnimatePresence>
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