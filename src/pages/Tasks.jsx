
import React, { useState, useEffect } from "react";
import { Task, Dashboard } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Plus, Calendar, Clock, User, AlertTriangle, CheckCircle,
  Filter, Search, BarChart3, Home, Briefcase, List, LayoutGrid, Trash2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { format, parseISO, isValid } from "date-fns";
import { he } from "date-fns/locale";
import KanbanView from "../components/tasks/KanbanView";

const statusConfig = {
  not_started: { text: 'נותרו השלמות', color: 'bg-gray-100 text-gray-800' },
  in_progress: { text: 'בעבודה', color: 'bg-sky-100 text-sky-800' },
  completed: { text: 'דווח ושולם', color: 'bg-green-100 text-green-800' },
  postponed: { text: 'נדחה', color: 'bg-neutral-100 text-neutral-800' },
  waiting_for_approval: { text: 'לבדיקה', color: 'bg-purple-100 text-purple-800' },
  waiting_for_materials: { text: 'ממתין לחומרים', color: 'bg-orange-100 text-orange-800' },
  issue: { text: 'בעיה', color: 'bg-pink-100 text-pink-800' },
  ready_for_reporting: { text: 'מוכן לדיווח', color: 'bg-teal-100 text-teal-800' },
  reported_waiting_for_payment: { text: 'ממתין לתשלום', color: 'bg-yellow-100 text-yellow-800' },
  not_relevant: { text: 'לא רלוונטי', color: 'bg-gray-50 text-gray-400' },
};

const priorityConfig = {
    low: { text: 'נמוכה', color: 'bg-gray-100 text-gray-800' },
    medium: { text: 'בינונית', color: 'bg-yellow-100 text-yellow-800' },
    high: { text: 'גבוהה', color: 'bg-orange-100 text-orange-800' },
    urgent: { text: 'דחוף', color: 'bg-red-100 text-red-800' }
};

// מיפוי הסטטוסים מ-Monday לסטטוסים פנימיים - מורחב ומשופר
const mondayStatusMapping = {
  // וריאציות עם רווחים
  'ממתין לחומרים': 'waiting_for_materials',
  'בעבודה': 'in_progress', 
  'ממתין לתחילת העבודה': 'not_started',
  'לבדיקה': 'waiting_for_approval',
  'מוכן לדיווח': 'ready_for_reporting',
  'דיווח ממתין לתשלום': 'reported_waiting_for_payment',
  'דווח ושולם': 'completed',
  'בעיה': 'issue',
  'נדחה': 'postponed',
  
  // וריאציות עם קווים תחתונים (מה שהיה במקור)
  'ממתין_לחומרים': 'waiting_for_materials',
  'ממתין_לתחילת_העבודה': 'not_started',
  'מוכן_לדיווח': 'ready_for_reporting',
  'דיווח_ממתין_לתשלום': 'reported_waiting_for_payment',
  'דווח_ושולם': 'completed',

  // וריאציות נוספות אפשריות
  'בוצע': 'completed',
  'הושלם': 'completed',
  'סיום': 'completed',
  'ביצוע': 'in_progress',
  'ממתין לתשלום': 'reported_waiting_for_payment', // Added based on statusConfig
  'ממתין לאישור': 'waiting_for_approval', // Added based on statusConfig
};


export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [filteredTasks, setFilteredTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [context, setContext] = useState("work");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [view, setView] = useState("list");
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  
  const [isClearing, setIsClearing] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  const handleClearAllTasks = async () => {
    const count = tasks.length;
    if (!window.confirm(`האם למחוק את כל ${count} המשימות? פעולה זו בלתי הפיכה!`)) return;
    if (!window.confirm('בטוח? כל המשימות יימחקו לצמיתות. לא ניתן לשחזר.')) return;
    setIsClearing(true);
    try {
      await Task.deleteAll();
      setTasks([]);
      setFilteredTasks([]);
      alert(`נמחקו ${count} משימות בהצלחה. המערכת נקייה.`);
    } catch (error) {
      console.error('Error clearing tasks:', error);
      alert('שגיאה במחיקת משימות');
    }
    setIsClearing(false);
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const contextParam = params.get('context');
    if (contextParam && ['work', 'home'].includes(contextParam)) {
      setContext(contextParam);
    }
  }, [location.search]);

  useEffect(() => {
    loadTasks();
  }, [context]);

  useEffect(() => {
    if (!Array.isArray(tasks)) {
      setFilteredTasks([]);
      return;
    }
    
    // הסינון לפי context כבר מתבצע ב-loadTasks,
    // לכן כאן אנחנו רק מסננים לפי חיפוש וסטטוס
    let filtered = [...tasks];
    
    if (searchTerm) {
      filtered = filtered.filter(task => 
        task.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (statusFilter !== "all") {
      filtered = filtered.filter(task => task.status === statusFilter);
    }
    
    if (priorityFilter !== "all") {
      filtered = filtered.filter(task => task.priority === priorityFilter);
    }
    
    setFilteredTasks(filtered);
  }, [tasks, searchTerm, statusFilter, priorityFilter]); // הורדנו את context מהתלויות

  const loadTasks = async () => {
    setIsLoading(true);
    try {
      // 1. קריאת הגדרות הלוחות
      const boardConfigs = await Dashboard.list() || [];

      // 2. הגדרת סוגי הלוחות לכל קונטקסט
      const workBoardTypes = ['reports', 'reconciliations', 'client_accounts', 'payroll', 'clients'];
      const homeBoardTypes = ['family_tasks', 'wellbeing'];

      // 3. איסוף ה-IDs של הלוחות הרלוונטיים
      let targetBoardIds = [];
      if (context === 'work') {
        targetBoardIds = boardConfigs
          .filter(config => workBoardTypes.includes(config.type) && config.monday_board_id)
          .map(config => config.monday_board_id);
      } else { // context === 'home'
        targetBoardIds = boardConfigs
          .filter(config => homeBoardTypes.includes(config.type) && config.monday_board_id)
          .map(config => config.monday_board_id);
      }
      
      if (targetBoardIds.length === 0) {
        setTasks([]);
        setIsLoading(false);
        return;
      }
      
      // 4. סינון המשימות לפי רשימת ה-IDs
      const fetchedTasks = await Task.filter({
        'monday_board_id': { '$in': targetBoardIds }
      }, "-created_date", 2000);
      
      const validTasks = Array.isArray(fetchedTasks) ? fetchedTasks : [];

      // 5. תיקון וניקוי הסטטוסים
      const normalizedTasks = validTasks.map(task => {
        let normalizedStatus = task.status;
        
        // אם יש מיפוי לסטטוס הזה
        if (task.status && mondayStatusMapping[task.status]) {
          normalizedStatus = mondayStatusMapping[task.status];
          // console.log(`מיפוי סטטוס: "${task.status}" → "${normalizedStatus}"`); // Optional: for detailed debug
        } 
        // אם אין סטטוס כלל
        else if (!task.status) {
          normalizedStatus = 'not_started';
          console.log(`משימה ללא סטטוס: "${task.title}" - הוגדר כ-not_started`);
        }
        // אם יש סטטוס שלא מוכר
        else {
          console.warn(`סטטוס לא מוכר: "${task.status}" במשימה "${task.title}" - הוגדר כ-not_started`);
          normalizedStatus = 'not_started'; // ברירת מחדל
        }

        return {
          ...task,
          status: normalizedStatus,
          isFromMonday: true // Mark tasks loaded from Monday as such
        };
      });

      // 6. סינון משימות ישנות - משימות שהושלמו לפני יותר מ-60 יום לא רלוונטיות
      // משימות לא-הושלמו שעברו יותר מ-180 יום - כנראה תקועות ולא רלוונטיות
      const MAX_COMPLETED_AGE_DAYS = 60;
      const MAX_STALE_AGE_DAYS = 180;
      const now = Date.now();

      const freshTasks = normalizedTasks.filter(task => {
        const taskDate = task.due_date || task.created_date;
        if (!taskDate) return true;
        const daysSince = Math.floor((now - new Date(taskDate).getTime()) / (1000 * 60 * 60 * 24));

        // משימות שהושלמו לפני יותר מ-60 יום - הסתר
        if (task.status === 'completed' && daysSince > MAX_COMPLETED_AGE_DAYS) return false;
        // משימות תקועות מעל 180 יום - הסתר
        if (task.status !== 'completed' && daysSince > MAX_STALE_AGE_DAYS) return false;
        return true;
      });

      setTasks(freshTasks);
    } catch (error) {
      console.error("שגיאה בטעינת משימות:", error);
      setTasks([]);
    }
    setIsLoading(false);
  };

  const handleContextChange = (newContext) => {
    setContext(newContext);
    navigate(`/Tasks?context=${newContext}`);
  };

  const handleDeleteTask = async (taskId) => {
    if (window.confirm("האם אתה בטוח שברצונך למחוק משימה זו?")) {
      try {
        await Task.delete(taskId);
        loadTasks();
      } catch (error) {
        console.error("שגיאה במחיקת משימה:", error);
      }
    }
  };

  const handleStatusChange = async (task, newStatus) => {
    try {
      const currentTasks = Array.isArray(tasks) ? tasks : [];
      const updatedTasks = currentTasks.map(t => t.id === task.id ? { ...t, status: newStatus } : t);
      setTasks(updatedTasks);
      await Task.update(task.id, { ...task, status: newStatus });
    } catch (error) {
        console.error("שגיאה בעדכון סטטוס:", error);
        loadTasks(); 
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    try {
      const date = parseISO(dateString);
      return isValid(date) ? format(date, "dd/MM/yyyy", { locale: he }) : dateString;
    } catch {
      return dateString;
    }
  };

  const getPriorityColor = (priority) => {
    return priorityConfig[priority]?.color || priorityConfig.medium.color;
  };

  const getStatusColor = (status) => {
    return statusConfig[status]?.color || statusConfig.not_started.color;
  };

  const getStatusText = (status) => {
    return statusConfig[status]?.text || status;
  };

  const getPriorityText = (priority) => {
    return priorityConfig[priority]?.text || priority;
  };

  const getTaskSource = (task) => {
    if (task.is_auto_generated && task.related_entity_type) {
      switch (task.related_entity_type) {
        case 'ClientAccount':
          return { icon: '🏦', text: 'נוצר אוטומטית מחשבון בנק', color: 'text-blue-600' };
        case 'BalanceSheet':
          return { icon: '📊', text: 'נוצר אוטומטית ממאזן', color: 'text-purple-600' };
        case 'AccountReconciliation':
          return { icon: '📋', text: 'נוצר אוטומטית מהתאמה', color: 'text-teal-600' };
        default:
          return { icon: '🤖', text: 'נוצר אוטומטית', color: 'text-gray-600' };
      }
    }
    
    if (task.isFromMonday) {
      return { icon: '📅', text: 'מסונכרן מ-Monday.com', color: 'text-indigo-600' };
    }
    
    return null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-gray-600">טוען משימות מ-Monday...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
            <div className="flex items-center gap-4 mb-4 md:mb-0">
              <h1 className="text-3xl font-bold text-gray-900">משימות מ-Monday</h1>
              <Badge className="bg-blue-500 text-white text-lg px-3 py-1 rounded-full">
                {filteredTasks.length}
              </Badge>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex bg-white rounded-xl p-1 shadow-sm border">
                <Button
                  variant={context === "work" ? "default" : "ghost"}
                  onClick={() => handleContextChange("work")}
                  className={`px-4 py-2 rounded-lg transition-all ${
                    context === "work" 
                      ? "bg-blue-500 text-white shadow-md" 
                      : "hover:bg-gray-100"
                  }`}
                >
                  <Briefcase className="w-4 h-4 ml-2" />
                  עבודה
                </Button>
                <Button
                  variant={context === "home" ? "default" : "ghost"}
                  onClick={() => handleContextChange("home")}
                  className={`px-4 py-2 rounded-lg transition-all ${
                    context === "home" 
                      ? "bg-green-500 text-white shadow-md" 
                      : "hover:bg-gray-100"
                  }`}
                >
                  <Home className="w-4 h-4 ml-2" />
                  בית
                </Button>
              </div>

              <div className="flex bg-white rounded-xl p-1 shadow-sm border">
                <Button variant={view === 'list' ? 'secondary' : 'ghost'} size="icon" onClick={() => setView('list')}>
                  <List className="w-5 h-5" />
                </Button>
                <Button variant={view === 'kanban' ? 'secondary' : 'ghost'} size="icon" onClick={() => setView('kanban')}>
                  <LayoutGrid className="w-5 h-5" />
                </Button>
              </div>

              <Button
                variant="outline"
                onClick={handleClearAllTasks}
                disabled={isClearing || tasks.length === 0}
                className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4 ml-2" />
                {isClearing ? 'מוחק...' : 'נקה הכל'}
              </Button>
            </div>
          </div>

          <Card className="bg-white shadow-sm">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <Input
                    placeholder="חיפוש משימות..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full"
                  />
                </div>
                
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue placeholder="סטטוס" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">כל הסטטוסים</SelectItem>
                    {Object.entries(statusConfig).map(([statusKey, { text }]) => (
                      <SelectItem key={statusKey} value={statusKey}>{text}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue placeholder="עדיפות" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">כל העדיפויות</SelectItem>
                    {Object.entries(priorityConfig).map(([priorityKey, { text }]) => (
                        <SelectItem key={priorityKey} value={priorityKey}>{text}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {view === 'list' ? (
          <div className="space-y-4">
            {!Array.isArray(filteredTasks) || filteredTasks.length === 0 ? (
              <Card className="bg-white">
                <CardContent className="p-8 text-center">
                  <div className="text-gray-500 mb-4">
                    {isLoading ? "טוען משימות..." : `אין משימות ${context === "work" ? "עבודה" : "בית"} מ-Monday`}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <AnimatePresence>
                {filteredTasks.map((task, index) => (
                  task && task.id ? (
                    <motion.div
                      key={task.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card className="bg-white hover:shadow-md transition-shadow">
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-lg font-semibold text-gray-900">
                                  {task.title}
                                </h3>
                                <Badge className={getPriorityColor(task.priority)}>
                                  {getPriorityText(task.priority)}
                                </Badge>
                                <Badge className={getStatusColor(task.status)}>
                                  {getStatusText(task.status)}
                                </Badge>
                              </div>
                              
                              {/* הצגת מקור המשימה */}
                              {getTaskSource(task) && (
                                <div className={`flex items-center gap-2 mb-2 text-sm ${getTaskSource(task).color}`}>
                                  <span>{getTaskSource(task).icon}</span>
                                  <span>{getTaskSource(task).text}</span>
                                </div>
                              )}
                              
                              {task.description && (
                                <p className="text-gray-600 mb-3">{task.description}</p>
                              )}
                              
                              <div className="flex items-center gap-4 text-sm text-gray-500">
                                {task.due_date && (
                                  <div className="flex items-center gap-1">
                                    <Calendar className="w-4 h-4" />
                                    <span>יעד: {formatDate(task.due_date)}</span>
                                  </div>
                                )}
                                {task.client_name && (
                                  <div className="flex items-center gap-1">
                                    <User className="w-4 h-4" />
                                    <span>{task.client_name}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <Select
                                value={task.status}
                                onValueChange={(newStatus) => handleStatusChange(task, newStatus)}
                              >
                                <SelectTrigger className="w-32">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(statusConfig).map(([statusKey, { text }]) => (
                                    <SelectItem key={statusKey} value={statusKey}>{text}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ) : null
                ))}
              </AnimatePresence>
            )}
          </div>
        ) : (
          <KanbanView 
            tasks={Array.isArray(filteredTasks) ? filteredTasks : []} 
            onTaskStatusChange={handleStatusChange} 
            onDeleteTask={handleDeleteTask} 
            formatDate={formatDate}
            getPriorityColor={getPriorityColor}
            getStatusColor={getStatusColor}
            getStatusText={getStatusText}
            getPriorityText={getPriorityText}
          />
        )}
      </div>
    </div>
  );
}
