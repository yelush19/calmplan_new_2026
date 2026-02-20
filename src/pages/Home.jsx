
import React, { useState, useEffect, useCallback } from "react";
import { Task, Event, User, Dashboard, Client, AccountReconciliation } from "@/api/entities";
import { isToday, isPast, parseISO, format } from "date-fns";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/glass-card";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Briefcase, Home as HomeIcon, Calendar, AlertTriangle, Clock
} from "lucide-react";
import MindMapCanvas from "@/components/mindmap/MindMapCanvas";
import { BOARD_CATEGORIES } from "@/lib/theme-constants";

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "בוקר טוב";
  if (hour < 18) return "צהריים טובים";
  return "ערב טוב";
};

export default function HomePage() {
  // ======= PRESERVED: All existing state variables =======
  const [tasks, setTasks] = useState({ today: [], overdue: [], upcoming: [], total: 0, completed: 0, completionRate: 0 });
  const [events, setEvents] = useState({ today: [], upcoming: [] });
  const [workTasksCount, setWorkTasksCount] = useState(0);
  const [homeTasksCount, setHomeTasksCount] = useState(0);
  const [workBoardIds, setWorkBoardIds] = useState([]);
  const [homeBoardIds, setHomeBoardIds] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userName, setUserName] = useState("משתמש");

  // ======= NEW: MindMap data state =======
  const [allClients, setAllClients] = useState([]);
  const [allTasksRaw, setAllTasksRaw] = useState([]);
  const [allReconciliations, setAllReconciliations] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  // ======= PRESERVED: Complete existing loadData logic + NEW entity loads =======
  const loadData = async () => {
    setIsLoading(true);
    try {
      // Get user info
      try {
        const user = await User.me();
        if (user && user.full_name) {
          setUserName(user.full_name.split(" ")[0]);
        }
      } catch (error) {
        console.log("No user data available");
      }

      // 1. קריאת הגדרות הלוחות, בדיוק כמו בדף המשימות
      const boardConfigs = await Dashboard.list() || [];
      const workBoardTypes = ['reports', 'reconciliations', 'client_accounts', 'payroll', 'clients'];
      const homeBoardTypes = ['family_tasks', 'wellbeing'];

      // 2. איסוף כל ה-IDs של הלוחות הרלוונטיים ושמירה ב-State
      const currentWorkBoardIds = boardConfigs
        .filter(config => workBoardTypes.includes(config.type) && config.monday_board_id)
        .map(config => config.monday_board_id);
      setWorkBoardIds(currentWorkBoardIds);

      const currentHomeBoardIds = boardConfigs
        .filter(config => homeBoardTypes.includes(config.type) && config.monday_board_id)
        .map(config => config.monday_board_id);
      setHomeBoardIds(currentHomeBoardIds);

      const allRelevantBoardIds = [...currentWorkBoardIds, ...currentHomeBoardIds];

      // 3. Load ALL data in parallel: tasks (filtered), events, clients, reconciliations
      const [tasksData, eventsData, clientsData, reconciliationsData] = await Promise.all([
        allRelevantBoardIds.length > 0 ? Task.filter({
          'monday_board_id': { '$in': allRelevantBoardIds }
        }, "-created_date", 2000).catch(() => []) : Promise.resolve([]),
        Event.list("-start_date", 1000).catch(() => []),
        Client.list().catch(() => []),
        AccountReconciliation.list().catch(() => []),
      ]);

      const allTasks = Array.isArray(tasksData) ? tasksData : [];

      // NEW: Store raw data for MindMap
      setAllClients(Array.isArray(clientsData) ? clientsData : []);
      setAllTasksRaw(allTasks);
      setAllReconciliations(Array.isArray(reconciliationsData) ? reconciliationsData : []);

      // 4. חלוקת המשימות לפי קונטקסט לספירה נכונה
      const workTasks = allTasks.filter(task => task.monday_board_id && currentWorkBoardIds.includes(task.monday_board_id));
      const homeTasks = allTasks.filter(task => task.monday_board_id && currentHomeBoardIds.includes(task.monday_board_id));

      setWorkTasksCount(workTasks.length);
      setHomeTasksCount(homeTasks.length);

      // --- PRESERVED: Date processing logic ---
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);

      const todayTasks = allTasks.filter(task => {
        const dateString = task.due_date || task.scheduled_start;
        if (!dateString) return false;
        try {
            const taskDate = parseISO(dateString);
            taskDate.setHours(0, 0, 0, 0);
            return taskDate.getTime() === today.getTime();
        } catch(e) {
            return false;
        }
      });

      const overdueTasksList = allTasks.filter(task => {
        if (task.status === 'completed') return false;
        const dateString = task.due_date || task.scheduled_start;
        if (!dateString) return false;
        try {
            const taskDate = parseISO(dateString);
            taskDate.setHours(23, 59, 59, 999);
            return taskDate < today;
        } catch(e) {
            return false;
        }
      });

      const upcomingTasks = allTasks.filter(task => {
        if (task.status === 'completed') return false;
        const dateString = task.due_date || task.scheduled_start;
        if (!dateString) return false;
        try {
            const taskDate = parseISO(dateString);
            taskDate.setHours(0, 0, 0, 0);
            return taskDate >= tomorrow && taskDate <= nextWeek;
        } catch(e) {
            return false;
        }
      }).sort((a, b) => {
          const dateA = new Date(a.due_date || a.scheduled_start);
          const dateB = new Date(b.due_date || b.scheduled_start);
          return dateA - dateB;
      });

      const allEvents = Array.isArray(eventsData) ? eventsData : [];

      const todayEvents = allEvents.filter(event => {
        if (!event.start_date) return false;
        const eventDate = parseISO(event.start_date);
        eventDate.setHours(0, 0, 0, 0);
        return eventDate.getTime() === today.getTime();
      });

      const upcomingEvents = allEvents.filter(event => {
        if (!event.start_date) return false;
        const eventDate = parseISO(event.start_date);
        eventDate.setHours(0, 0, 0, 0);
        return eventDate >= tomorrow && eventDate <= nextWeek;
      }).sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

      const totalTasks = allTasks.length;
      const completedTasks = allTasks.filter(t => t.status === 'completed').length;
      const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      setTasks({
        today: todayTasks,
        overdue: overdueTasksList,
        upcoming: upcomingTasks,
        total: totalTasks,
        completed: completedTasks,
        completionRate
      });

      setEvents({
        today: todayEvents,
        upcoming: upcomingEvents
      });

      console.log('🏠 HOME PAGE DEBUG:');
      console.log('- Total tasks loaded:', totalTasks);
      console.log('- Work tasks:', workTasks.length);
      console.log('- Home tasks:', homeTasks.length);
      console.log('- Clients loaded:', (clientsData || []).length);
      console.log('- Reconciliations loaded:', (reconciliationsData || []).length);

    } catch (error) {
      console.error("Error loading home page data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNodeClick = useCallback((node) => {
    console.log('Node clicked:', node);
    // Future: open detail panel, navigate to client, etc.
  }, []);

  // ======= LOADING STATE =======
  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 40%, #0f172a 100%)' }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-full"
            style={{
              background: 'linear-gradient(135deg, #10b981, #059669)',
              animation: 'calm-pulse 2s ease-in-out infinite',
            }}
          />
          <p className="text-white/60 text-sm">טוען את המוח החיצוני...</p>
        </motion.div>
      </div>
    );
  }

  // ======= MAIN RENDER: MindMap Canvas with Floating Overlays =======
  return (
    <div className="relative w-full h-full" style={{ minHeight: 'calc(100vh - 0px)' }}>
      {/* MindMap fills the entire area */}
      <MindMapCanvas
        clients={allClients}
        tasks={allTasksRaw}
        reconciliations={allReconciliations}
        onNodeClick={handleNodeClick}
      />

      {/* === FLOATING GLASS OVERLAYS === */}

      {/* Top-Right: Greeting */}
      <motion.div
        className="absolute top-4 right-4 z-10"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <GlassCard className="px-5 py-3">
          <h2 className="text-white font-bold text-lg leading-tight">
            {getGreeting()}, {userName}
          </h2>
          <p className="text-white/60 text-xs mt-0.5">
            {format(new Date(), 'EEEE, d בMMMM yyyy')}
          </p>
        </GlassCard>
      </motion.div>

      {/* Top-Left: Quick Stats Row */}
      <motion.div
        className="absolute top-4 left-4 z-10 flex gap-2"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Link to={createPageUrl("Tasks?context=work")}>
          <GlassCard className="px-3 py-2 flex items-center gap-2 hover:bg-white/20 cursor-pointer">
            <Briefcase className="w-4 h-4 text-blue-400" />
            <span className="text-white font-bold text-sm">{workTasksCount}</span>
            <span className="text-white/50 text-xs hidden lg:inline">עבודה</span>
          </GlassCard>
        </Link>

        <Link to={createPageUrl("Tasks?context=home")}>
          <GlassCard className="px-3 py-2 flex items-center gap-2 hover:bg-white/20 cursor-pointer">
            <HomeIcon className="w-4 h-4 text-green-400" />
            <span className="text-white font-bold text-sm">{homeTasksCount}</span>
            <span className="text-white/50 text-xs hidden lg:inline">בית</span>
          </GlassCard>
        </Link>

        <Link to={createPageUrl("Calendar")}>
          <GlassCard className="px-3 py-2 flex items-center gap-2 hover:bg-white/20 cursor-pointer">
            <Calendar className="w-4 h-4 text-purple-400" />
            <span className="text-white font-bold text-sm">{events.today.length}</span>
            <span className="text-white/50 text-xs hidden lg:inline">אירועים</span>
          </GlassCard>
        </Link>

        {tasks.overdue.length > 0 && (
          <GlassCard className="px-3 py-2 flex items-center gap-2" style={{ borderColor: 'rgba(239,68,68,0.3)' }}>
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-red-400 font-bold text-sm">{tasks.overdue.length}</span>
            <span className="text-red-400/50 text-xs hidden lg:inline">באיחור</span>
          </GlassCard>
        )}
      </motion.div>

      {/* Bottom-Right: Daily Progress */}
      <motion.div
        className="absolute bottom-4 right-4 z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <GlassCard className="px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="text-white/60 text-xs">התקדמות יומית</div>
            <div className="w-24 h-2 rounded-full bg-white/10 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg, #10b981, #059669)' }}
                initial={{ width: 0 }}
                animate={{ width: `${tasks.completionRate}%` }}
                transition={{ duration: 1, delay: 0.8 }}
              />
            </div>
            <div className="text-white font-bold text-sm">{tasks.completionRate}%</div>
          </div>
          {tasks.today.length > 0 && (
            <div className="text-white/40 text-xs mt-1">
              {tasks.today.filter(t => t.status === 'completed').length}/{tasks.today.length} משימות היום
            </div>
          )}
        </GlassCard>
      </motion.div>

      {/* Bottom-Left: Category Legend (compact) */}
      <motion.div
        className="absolute bottom-12 left-4 z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <GlassCard className="px-3 py-2">
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {BOARD_CATEGORIES.map(cat => (
              <div key={cat.id} className="flex items-center gap-1.5">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: `linear-gradient(135deg, ${cat.gradient.from}, ${cat.gradient.to})` }}
                />
                <span className="text-white/50 text-[10px]">{cat.label}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
}
