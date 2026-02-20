
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from '@/components/ui/input';
import {
  Monitor, RefreshCw, CheckCircle, AlertCircle, Users, Settings, ExternalLink, Database, Plus,
  FileText, BookCheck, Home, Calendar, Heart, Clock, BarChart3, Edit, Save, X, AlertTriangle, CreditCard, Trash2, BookUser
} from 'lucide-react';
import { Client, Dashboard, Task, AccountReconciliation, WeeklySchedule, ClientAccount, Therapist } from '@/api/entities';
import { mondayApi } from '@/api/functions';
import { mondayBoardApi } from '@/api/functions';

// Component for selecting a board with search functionality
const BoardSelector = ({ availableBoards, selectedBoardId, onBoardChange }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [open, setOpen] = useState(false);

  // Filter boards based on search term (case-insensitive on name and ID)
  const filteredBoards = availableBoards.filter(board =>
    board.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(board.id).toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Select
      value={selectedBoardId}
      onValueChange={(value) => {
        onBoardChange(value);
        setOpen(false); // Close select after selection
        setSearchTerm(''); // Clear search term
      }}
      onOpenChange={setOpen} // Control open state to reset search if closed
      open={open}
    >
      <SelectTrigger className="h-8 text-sm">
        <SelectValue placeholder="בחר לוח...">
          {selectedBoardId ? (availableBoards.find(b => b.id === selectedBoardId)?.name || 'לוח לא נמצא') : 'בחר לוח...'}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-[300px] overflow-y-auto"> {/* Added max-height and overflow-y for scrollability */}
        {/* Search input - made sticky for better UX */}
        <div className="p-1 sticky top-0 bg-white z-10 border-b">
          <Input
            placeholder="חפש לוח..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8 mb-1"
            // Prevent the Select from closing when typing in the input
            onKeyDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()} // Also stop click propagation
          />
        </div>
        {/* Option for no board selected */}
        <SelectItem value={null}>ללא לוח</SelectItem>
        {filteredBoards.length > 0 ? (
          filteredBoards.map(board => (
            <SelectItem key={board.id} value={board.id}>
              {board.name} ({board.id})
            </SelectItem>
          ))
        ) : (
          <div className="p-2 text-center text-gray-500 text-sm">לא נמצאו לוחות התואמים לחיפוש.</div>
        )}
      </SelectContent>
    </Select>
  );
};


const boardCategories = {
  clients: { label: 'לוח לקוחות', icon: Users, color: 'text-blue-600', description: 'ניהול כל לקוחות החברה' },
  reports_main: { label: 'תהליכי דיווח חודשיים', icon: FileText, color: 'text-blue-600', description: 'לוח הדיווחים הראשי - שוטף מאז הקמת המערכת' },
  reports_126_856_2025: { label: 'לוח 126+856-2025', icon: FileText, color: 'text-green-600', description: 'לוח נפרד עבור תהליכי דיווח 2025' },
  reports_126_856_2024: { label: 'לוח 126+856-2024', icon: FileText, color: 'text-amber-600', description: 'לוח נפרד עבור תהליכי דיווח 2024' },
  weekly_tasks: { label: 'משימות שבועיות ופגישות', icon: Calendar, color: 'text-purple-600', description: 'תכנון משימות שבועיות ומעקב פגישות' },
  balance_sheets: { label: 'מאזנים', icon: BarChart3, color: 'text-teal-600', description: 'מעקב ועבודה על מאזנים' },
  reconciliations: { label: 'התאמות בנק וסליקה', icon: BookCheck, color: 'text-purple-600', description: 'נתונים כספיים מפורטים מלוח ההתאמות' },
  client_accounts: { label: 'חשבונות בנק וסליקה', icon: CreditCard, color: 'text-yellow-600', description: 'ניהול חשבונות בנק וכרטיסי אשראי של לקוחות' },
  family_tasks: { label: 'משימות משפחה', icon: Home, color: 'text-orange-600', description: 'משימות בית ומשפחה' },
  weekly_planning: { label: 'לוח טיפולים', icon: Calendar, color: 'text-indigo-600', description: 'תכנון זמנים וטיפולים' },
  wellbeing: { label: 'מעקב רווחה', icon: Heart, color: 'text-pink-600', description: 'מעקב אחר בריאות ומצב רוח' },
  therapists: { label: 'לוח מטפלים', icon: BookUser, color: 'text-teal-600', description: 'ניהול וסנכרון רשימת המטפלים' }
};

const IntegratedBoardCard = ({ board, data, onSync, onPurgeAndResync, onEdit, onSave, syncStatus, isEditing, availableBoards, onBoardIdChange, logs }) => {
  const category = boardCategories[board.type] || { label: board.name, icon: Database, color: 'text-gray-600', description: '' };
  const Icon = category.icon;

  const getStatusInfo = () => {
    if (syncStatus === 'syncing') {
      return { icon: RefreshCw, text: 'מסנכרן...', color: 'text-blue-500', bgColor: 'bg-blue-50', badge: 'secondary' };
    }

    if (syncStatus === 'error') {
      return { icon: AlertTriangle, text: 'שגיאה', color: 'text-red-500', bgColor: 'bg-red-50', badge: 'destructive' };
    }

    if (data.count > 0) {
      return { icon: CheckCircle, text: 'מסונכרן', color: 'text-green-500', bgColor: 'bg-green-50', badge: 'default' };
    }

    if (board.monday_board_id) {
      return { icon: AlertCircle, text: 'לוח ריק', color: 'text-yellow-500', bgColor: 'bg-yellow-50', badge: 'secondary' };
    }

    return { icon: X, text: 'לא מוגדר', color: 'text-gray-500', bgColor: 'bg-gray-50', badge: 'outline' };
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;
  const hasData = data.count > 0;
  const hasError = syncStatus === 'error' || (data.syncResult?.errors && data.syncResult.errors.length > 0);

  return (
    <Card className={`h-full flex flex-col transition-all duration-300 ${hasError ? 'border-red-200 bg-red-50' : hasData ? 'border-green-200 bg-green-50' : 'border-gray-200'} hover:shadow-lg`}>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className={`p-2 rounded-lg ${statusInfo.bgColor} flex-shrink-0`}>
              <Icon className={`w-6 h-6 ${category.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg leading-tight">
                {category.label}
              </CardTitle>
              <p className="text-sm text-gray-500 mt-1">{category.description}</p>
              <p className="text-xs text-gray-400 mt-1">Board ID: {board.monday_board_id || 'לא מוגדר'}</p>

              {/* Board ID Section */}
              <div className="mt-3">
                {isEditing ? (
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-600">Board ID:</label>
                    <BoardSelector
                      availableBoards={availableBoards}
                      selectedBoardId={board.monday_board_id || ''}
                      onBoardChange={(value) => onBoardIdChange(value)}
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {data.count || 0} פריטים סונכרנו
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <StatusIcon className={`w-4 h-4 ${statusInfo.color} ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
              <Badge variant={statusInfo.badge} className="text-xs">
                {statusInfo.text}
              </Badge>
            </div>

            {isEditing ? (
              <div className="flex gap-1">
                <Button size="icon" variant="default" onClick={() => onSave(board.type)} className="h-8 w-8">
                  <Save className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => onEdit(null)} className="h-8 w-8">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Button size="icon" variant="ghost" onClick={() => onEdit(board.type)} className="h-8 w-8">
                <Edit className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 flex-grow flex flex-col">
        <div className="space-y-4 flex-grow">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500 text-xs">פריטים</p>
              <p className="font-bold text-xl text-gray-900">{data.count || 0}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">עדכון אחרון</p>
              <p className="font-medium text-sm">
                {data.lastSync ? new Date(data.lastSync).toLocaleString('he-IL', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit'
                }) : 'לא סונכרן'}
              </p>
            </div>
          </div>

          {/* Sync Results & Logs */}
          <div className="p-3 bg-white rounded-lg text-xs space-y-1 border">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1" className="border-none">
                <AccordionTrigger className="text-xs font-medium text-gray-700 hover:no-underline p-1">
                  תוצאות ויומן סנכרון אחרון
                </AccordionTrigger>
                <AccordionContent className="pt-2">
                  {data.syncResult && (
                    <div className="space-y-1 mb-2">
                      <div className="grid grid-cols-3 gap-2 text-gray-600">
                        <span>נוצרו: {data.syncResult.created || 0}</span>
                        <span>עודכנו: {data.syncResult.updated || 0}</span>
                        <span>נמחקו: {data.syncResult.deleted || 0}</span>
                      </div>
                      {data.syncResult.errors && data.syncResult.errors.length > 0 && (
                        <p className="text-red-600 font-medium">שגיאות: {data.syncResult.errors.length}</p>
                      )}
                    </div>
                  )}
                  {logs && logs.length > 0 ? (
                    <div className="max-h-28 overflow-y-auto bg-gray-50 p-2 rounded text-gray-500 font-mono text-[10px] leading-tight">
                      {logs.map((log, i) => <p key={i}>{log}</p>)}
                    </div>
                  ) : (
                     <p className="text-gray-400">אין יומן זמין.</p>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4 mt-auto">
            <Button
              size="sm"
              onClick={() => onSync(board)}
              disabled={!board.monday_board_id || syncStatus === 'syncing' || isEditing === board.type}
              className="flex-1"
            >
              <RefreshCw className={`w-3 h-3 ml-2 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
              {syncStatus === 'syncing' ? 'מסנכרן...' : 'סנכרן'}
            </Button>

            {/* Added reconciliations and client_accounts to the list as they are also data boards that can be purged */}
            {['clients', 'reports_main', 'reports_126_856_2025', 'reports_126_856_2024', 'weekly_tasks', 'balance_sheets', 'family_tasks', 'wellbeing', 'weekly_planning', 'therapists', 'reconciliations', 'client_accounts'].includes(board.type) && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => onPurgeAndResync(board)}
                disabled={!board.monday_board_id || syncStatus === 'syncing' || isEditing === board.type}
                title="מחק וסנכרן מחדש"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            )}

            {board.monday_board_id && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(`https://litay-ltd-company.monday.com/boards/${board.monday_board_id}`, '_blank')}
              >
                <ExternalLink className="w-3 h-3" />
              </Button>
            )}
          </div>
      </CardContent>
    </Card>
  );
};

export default function MondayIntegrationPage() {
  const [boardConfigs, setBoardConfigs] = useState([]);
  const [availableBoards, setAvailableBoards] = useState([]);
  const [boardData, setBoardData] = useState({});
  const [syncStatuses, setSyncStatuses] = useState({});
  const [editingBoardType, setEditingBoardType] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [error, setError] = useState(null);
  const [logs, setLogs] = useState({});

  useEffect(() => {
    loadPageData();
  }, []);

  const loadPageData = async () => {
    setIsLoading(true);
    await Promise.all([
      loadData(),
      loadAvailableBoards()
    ]);
    setIsLoading(false);
  };

  const loadData = async () => {
    try {
      console.log('🔄 Loading all data for Monday Integration page...');

      const [dashboardsData, clientsData, tasksData, recsData, schedulesData, clientAccountsData, therapistsData] = await Promise.all([
        Dashboard.list().catch(e => { console.warn('Failed to load dashboards:', e); return []; }),
        Client.filter({}, '-updated_date', 1000).catch(e => { console.warn('Failed to load clients:', e); return []; }),
        Task.filter({}, '-updated_date', 1000).catch(e => { console.warn('Failed to load tasks:', e); return []; }),
        AccountReconciliation.filter({}, '-updated_date', 1000).catch(e => { console.warn('Failed to load reconciliations:', e); return []; }),
        WeeklySchedule.filter({}, '-updated_date', 1000).catch(e => { console.warn('Failed to load schedules:', e); return []; }),
        ClientAccount.filter({}, '-updated_date', 1000).catch(e => { console.warn('Failed to load client accounts:', e); return []; }),
        Therapist.list().catch(e => { console.warn('Failed to load therapists:', e); return []; })
      ]);

      console.log('🔍 COMPLETE DATA DEBUG:');
      console.log('- Dashboards:', dashboardsData);
      console.log('- Tasks (full):', tasksData);
      console.log('- Tasks with monday_board_id:', tasksData?.filter(t => t.monday_board_id));

      // Group tasks by board_id for debugging
      const tasksByBoard = {};
      (tasksData || []).forEach(task => {
          const boardId = String(task.monday_board_id || 'no-board');
          if (!tasksByBoard[boardId]) tasksByBoard[boardId] = [];
          tasksByBoard[boardId].push(task.title);
      });
      console.log('🔍 Tasks grouped by board_id:', tasksByBoard);

      const configs = Object.keys(boardCategories).map(type => {
        const existing = (dashboardsData || []).find(d => d.type === type);
        return existing || { id: `new-${type}`, type, name: boardCategories[type].label, monday_board_id: '' };
      });
      setBoardConfigs(configs);

      // Reset board data
      setBoardData({});

      for (const config of configs) {
        let count = 0;
        let lastSync = null;

        if (config.monday_board_id) {
            const boardIdStr = String(config.monday_board_id);
            console.log(`🔍 PROCESSING: ${config.type} with board_id "${boardIdStr}"`);

            switch(config.type) {
                case 'clients':
                    const boardClients = (clientsData || []).filter(c =>
                        String(c.monday_board_id) === boardIdStr || String(c.monday_item_id)
                    );
                    count = boardClients.length;
                    if(count > 0) lastSync = Math.max(...boardClients.map(c => new Date(c.updated_date).getTime()));
                    break;

                case 'reports_main':
                case 'reports_126_856_2025':
                case 'reports_126_856_2024':
                case 'weekly_tasks':
                case 'balance_sheets':
                case 'family_tasks':
                case 'wellbeing':
                case 'weekly_planning':
                    const boardTasks = (tasksData || []).filter(t => String(t.monday_board_id) === boardIdStr);
                    count = boardTasks.length;
                    console.log(`🔍 DEBUG: ${config.type} - Found ${count} tasks matching board_id "${boardIdStr}"`);
                    if(count > 0) lastSync = Math.max(...boardTasks.map(t => new Date(t.updated_date).getTime()));
                    break;

                case 'reconciliations':
                    const boardRecs = (recsData || []).filter(r => String(r.monday_board_id) === boardIdStr);
                    count = boardRecs.length;
                    if(count > 0) lastSync = Math.max(...boardRecs.map(r => new Date(r.updated_date).getTime()));
                    break;

                case 'client_accounts':
                    const boardAccounts = (clientAccountsData || []).filter(a => String(a.monday_board_id) === boardIdStr);
                    count = boardAccounts.length;
                    if(count > 0) lastSync = Math.max(...boardAccounts.map(a => new Date(a.updated_date).getTime()));
                    break;

                case 'therapists':
                    const boardTherapists = (therapistsData || []).filter(t => String(t.monday_board_id) === boardIdStr);
                    count = boardTherapists.length;
                    if(count > 0) lastSync = Math.max(...boardTherapists.map(t => new Date(t.updated_date).getTime()));
                    break;
            }

            console.log(`✅ Final count for ${config.type}: ${count}`);
        }

        setBoardData(prev => ({
            ...prev,
            [config.type]: {
                count,
                lastSync: lastSync ? new Date(lastSync) : null,
                isLoading: false
            }
        }));
      }

    } catch (error) {
      console.error("❌ Error loading data:", error);
      setError("שגיאה בטעינת נתונים");
    } finally {
        setIsLoading(false);
    }
  };

  const loadAvailableBoards = async () => {
    try {
      const response = await mondayBoardApi({ action: 'getAllBoards' });
      if (response?.data?.success) {
        setAvailableBoards(response.data.boards || []);
      }
    } catch (error) {
      console.error("Error loading available boards:", error);
    }
  };

  const handleSyncBoard = async (board, { shouldReloadData = true } = {}) => {
    if (!board.monday_board_id) return;

    // New Save Logic
    try {
      const boardToSave = boardConfigs.find(b => b.type === board.type);
      if (!boardToSave) throw new Error("Could not find board configuration to save.");

      const selectedBoard = availableBoards.find(b => b.id === boardToSave.monday_board_id);

      const saveData = {
          name: selectedBoard?.name || boardToSave.name,
          type: boardToSave.type,
          monday_board_id: boardToSave.monday_board_id
      };

      if (boardToSave.id && !boardToSave.id.startsWith('new-')) {
        await Dashboard.update(boardToSave.id, saveData);
      } else {
        const newBoard = await Dashboard.create(saveData);
        // Important: Update local state with the new database ID
        setBoardConfigs(prev => prev.map(c => c.type === board.type ? { ...c, id: newBoard.id } : c));
      }
      console.log(`[UI] Config for ${board.type} saved successfully before sync.`);
    } catch (error) {
      console.error("Error saving board config before sync:", error);
      setError(`שגיאה בשמירת הגדרות לפני סנכרון: ${error.message}`);
      return; // Stop sync if save fails
    }
    // End New Save Logic

    console.log(`[UI] 🔄 Starting sync for ${board.type} (${board.monday_board_id})`);
    setSyncStatuses(prev => ({ ...prev, [board.type]: 'syncing' }));
    setLogs(prev => ({ ...prev, [board.type]: [`[${new Date().toLocaleTimeString('he-IL')}] מתחיל סנכרון...`] }));
    setError(null);

    try {
      let response;
      const actions = {
        clients: 'syncClients',
        reports_main: 'syncTasks',
        reports_126_856_2025: 'syncTasks',
        reports_126_856_2024: 'syncTasks',
        weekly_tasks: 'syncTasks',
        balance_sheets: 'syncTasks',
        reconciliations: 'syncReconciliations',
        client_accounts: 'syncClientAccounts',
        family_tasks: 'syncFamilyTasks',
        weekly_planning: 'syncWeeklyPlanning',
        wellbeing: 'syncWellbeing',
        therapists: 'syncTherapists'
      };

      const action = actions[board.type];
      if (action) {
        response = await mondayApi({ action, boardId: board.monday_board_id });
      } else {
        response = { data: { success: true, created: [], updated: [], skipped:[], errors:[], log: [`אין פונקציית סנכרון ללוח מסוג '${board.type}'`] } };
      }

      console.log(`[UI] ✅ Sync response for ${board.type}:`, response);
      setLogs(prev => ({ ...prev, [board.type]: response.data.log || ['לא התקבל יומן מהשרת.'] }));

      if (response?.data?.success) {
        setBoardData(prev => ({
          ...prev,
          [board.type]: {
            ...prev[board.type],
            syncResult: response.data,
            lastSync: new Date()
          }
        }));
        setSyncStatuses(prev => ({ ...prev, [board.type]: 'success' }));

        if (shouldReloadData) {
          await loadData();
        }

        setSyncStatuses(prev => ({ ...prev, [board.type]: null }));

      } else {
        throw new Error(response?.data?.error || 'סנכרון נכשל ללא הודעת שגיאה ספציפית.');
      }
    } catch (error) {
      console.error(`[UI] ❌ Sync error for ${board.name}:`, error);
      const errorMessage = error?.response?.data?.error || error?.message || 'שגיאה לא ידועה בסנכרון';

      setError(`שגיאה בסנכרון ${boardCategories[board.type]?.label}: ${errorMessage}`);
      setLogs(prev => ({ ...prev, [board.type]: [...(prev[board.type] || []), `שגיאה קריטית: ${errorMessage}`] }));
      setSyncStatuses(prev => ({ ...prev, [board.type]: 'error' }));

      // Let error state persist for a few seconds
      setTimeout(() => {
        setSyncStatuses(prev => ({ ...prev, [board.type]: null }));
      }, 8000);
    }
  };

  const handlePurgeAndResync = async (board) => {
    const itemCount = boardData[board.type]?.count || 0;
    let itemType;
    switch (board.type) {
        case 'clients':
            itemType = 'לקוחות';
            break;
        case 'therapists':
            itemType = 'מטפלים';
            break;
        case 'client_accounts': // Added for better specificity
            itemType = 'חשבונות לקוח';
            break;
        case 'reconciliations': // Added for better specificity
            itemType = 'התאמות';
            break;
        case 'reports_main':
        case 'reports_126_856_2025':
        case 'reports_126_856_2024':
        case 'weekly_tasks':
        case 'balance_sheets':
        case 'family_tasks':
        case 'wellbeing':
        case 'weekly_planning':
            itemType = 'משימות';
            break;
        default:
            itemType = 'פריטים'; // Fallback
    }

    if (!window.confirm(`⚠️ אזהרה: פעולה זו תמחק לצמיתות ${itemCount} ${itemType} מהמערכת (המשויכים ללוח זה), ותטען אותם מחדש מ-Monday.com. האם אתה בטוח שברצונך להמשיך?`)) {
        return;
    }

    // New Save Logic
    try {
      const boardToSave = boardConfigs.find(b => b.type === board.type);
       if (!boardToSave) throw new Error("Could not find board configuration to save.");

      const selectedBoard = availableBoards.find(b => b.id === boardToSave.monday_board_id);

      const saveData = {
          name: selectedBoard?.name || boardToSave.name,
          type: boardToSave.type,
          monday_board_id: boardToSave.monday_board_id
      };

      if (boardToSave.id && !boardToSave.id.startsWith('new-')) {
        await Dashboard.update(boardToSave.id, saveData);
      } else {
        const newBoard = await Dashboard.create(saveData);
        // Important: Update local state with the new database ID
        setBoardConfigs(prev => prev.map(c => c.type === board.type ? { ...c, id: newBoard.id } : c));
      }
      console.log(`[UI] Config for ${board.type} saved successfully before purge and resync.`);
    } catch (error) {
      console.error("Error saving board config before purge and resync:", error);
      setError(`שגיאה בשמירת הגדרות לפני סנכרון: ${error.message}`);
      return; // Stop sync if save fails
    }
    // End New Save Logic

    console.log(`[UI] 🔄 Starting PURGE AND RESYNC for ${board.type} (${board.monday_board_id})`);
    setSyncStatuses(prev => ({ ...prev, [board.type]: 'syncing' }));
    setLogs(prev => ({ ...prev, [board.type]: [`[${new Date().toLocaleTimeString('he-IL')}] מתחיל מחיקה וסנכרון מחדש...`] }));
    setError(null);

    try {
        const response = await mondayApi({ action: 'purgeAndResync', boardId: board.monday_board_id, type: board.type });

        console.log(`[UI] ✅ Purge and Resync response for ${board.type}:`, response);
        setLogs(prev => ({ ...prev, [board.type]: response.data.log || ['לא התקבל יומן מהשרת.'] }));

        if (response?.data?.success) {
            setBoardData(prev => ({
              ...prev,
              [board.type]: { ...prev[board.type], syncResult: response.data, lastSync: new Date() }
            }));
            setSyncStatuses(prev => ({ ...prev, [board.type]: 'success' }));
            await loadData();
            setSyncStatuses(prev => ({ ...prev, [board.type]: null }));
        } else {
            throw new Error(response?.data?.error || 'פעולת מחיקה וסנכרון נכשלה ללא הודעת שגיאה ספציפית.');
        }
    } catch (error) {
        console.error(`[UI] ❌ Purge and Resync error for ${board.name}:`, error);
        const errorMessage = error?.response?.data?.error || error?.message || 'שגיאה לא ידועה בסנכרון';
        setError(`שגיאה במחיקה וסנכרון של ${boardCategories[board.type]?.label}: ${errorMessage}`);
        setLogs(prev => ({ ...prev, [board.type]: [...(prev[board.type] || []), `שגיאה קריטית: ${errorMessage}`] }));
        setSyncStatuses(prev => ({ ...prev, [board.type]: 'error' }));
        setTimeout(() => setSyncStatuses(prev => ({ ...prev, [board.type]: null })), 8000);
    }
  };

  const handleEditBoard = (boardType) => {
    setEditingBoardType(boardType);
  };

  const handleBoardIdChange = (type, newId) => {
      setBoardConfigs(prev => prev.map(c => c.type === type ? {...c, monday_board_id: newId} : c));
  };

  const handleSaveBoard = async (boardType) => {
    try {
      const boardToSave = boardConfigs.find(b => b.type === boardType);
      const selectedBoard = availableBoards.find(b => b.id === boardToSave.monday_board_id);

      const saveData = {
          name: selectedBoard?.name || boardToSave.name,
          type: boardToSave.type,
          monday_board_id: boardToSave.monday_board_id
      };

      if (boardToSave.id.startsWith('new-')) {
        const newBoard = await Dashboard.create(saveData);
        setBoardConfigs(prev => prev.map(c => c.type === boardType ? { ...c, id: newBoard.id } : c));
      } else {
        await Dashboard.update(boardToSave.id, saveData);
      }

      setEditingBoardType(null);
      await loadData(); // Refresh data
    } catch (error) {
      console.error("Error saving board:", error);
      setError(`שגיאה בשמירת הגדרות: ${error.message}`);
    }
  };

  const handleSyncAll = async () => {
    // Get all boards that have board IDs and are syncable
    const syncableBoards = boardConfigs.filter(d =>
      d.monday_board_id &&
      ['clients', 'reports_main', 'reports_126_856_2025', 'reports_126_856_2024', 'weekly_tasks', 'balance_sheets', 'reconciliations', 'client_accounts', 'weekly_planning', 'family_tasks', 'wellbeing', 'therapists'].includes(d.type)
    );

    if (syncableBoards.length === 0) {
      alert('❌ לא נמצאו לוחות לסנכרון. ודא שהגדרת את ה-Board IDs בהגדרות.');
      return;
    }

    if (!window.confirm(`🚀 זה יסנכרן ${syncableBoards.length} לוחות פעילים:\n${syncableBoards.map(b => `• ${boardCategories[b.type]?.label || b.name}`).join('\n')}\n\nהמשך?`)) {
      return;
    }

    console.log('[UI] 🚀 Starting sync for all boards using bulk sync');
    setIsLoading(true);
    setError(null);

    try {
      const response = await mondayApi({ action: 'syncAllBoards' });

      // NEW: Graceful handling for lock/rate-limit without throwing
      if (response?.data?.in_progress) {
        const wait = response?.data?.retry_after_seconds || 15;
        alert(`סנכרון מרובה כבר רץ ברקע. נסה שוב בעוד ~${wait} שניות.`);
        setIsLoading(false);
        return;
      }
      if (response?.data?.rate_limited) {
        const wait = response?.data?.retry_after_seconds || 15;
        alert(`הגענו למגבלת קצב (Rate Limit). המתן ~${wait} שניות ונסה שוב.`);
        setIsLoading(false);
        return;
      }

      if (response?.data?.success) {
        const results = response.data.results;
        const successBoards = Object.entries(results).filter(([, r]) => r.success);
        const failedBoards = Object.entries(results).filter(([, r]) => !r.success);
        
        let message = `✅ סנכרון הושלם!\n\n`;
        
        if (successBoards.length > 0) {
          message += `🎉 לוחות שסונכרנו בהצלחה (${successBoards.length}):\n`;
          successBoards.forEach(([type, result]) => {
            const boardName = boardCategories[type]?.label || result.boardName || type;
            const created = result.created || 0;
            const updated = result.updated || 0;
            message += `• ${boardName}: +${created} חדש, ~${updated} עודכן\n`;
          });
        }
        
        if (failedBoards.length > 0) {
          message += `\n⚠️ לוחות עם בעיות (${failedBoards.length}):\n`;
          failedBoards.forEach(([type, result]) => {
            const boardName = boardCategories[type]?.label || result.boardName || type;
            message += `• ${boardName}: ${result.error}\n`;
          });
        }
        
        message += `\n📊 סה"כ: ${response.data.totalCreated || 0} פריטים חדשים, ${response.data.totalUpdated || 0} עודכנו`;
        
        alert(message);

        console.log('[UI] 📊 Bulk sync results:', results);
        await loadData();
        setLastSyncTime(new Date());
      } else {
        throw new Error(response?.data?.error || 'בעיה בסנכרון מרובה');
      }
    } catch (error) {
      console.error('[UI] ❌ Bulk sync failed:', error);
      const errorMessage = error?.response?.data?.error || error?.message || 'שגיאה לא ידועה';
      alert(`❌ סנכרון נכשל:\n${errorMessage}\n\nנסה שוב או סנכרן לוח אחד בכל פעם.`);
      setError(`שגיאה בסנכרון מרובה: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmergencyCleanup = async () => {
    if (!window.confirm('⚠️ פעולה הרסנית! האם למחוק את כל הכפילויות מהמערכת? (רק משימות עם סנכרון תקין יישארו)')) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await mondayApi({ action: 'emergencyCleanup' });

      if (response?.data?.success) {
        alert(`ניקוי הסתיים בהצלחה! נמחקו ${response.data.deleted} כפילויות. נשארו ${response.data.remaining} משימות תקינות.`);
        await loadData();
      } else {
        throw new Error(response?.data?.error || 'ניקוי נכשל');
      }
    } catch (error) {
      console.error('Emergency cleanup failed:', error);
      setError(`שגיאה בניקוי: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate total correctly by summing only the actual counts
  const totalItems = Object.values(boardData).reduce((sum, data) => sum + (data.count || 0), 0);
  const activeBoardsCount = boardConfigs.filter(d => d.monday_board_id).length;
  // This configurableBoards count now excludes the removed 'reconciliation_tasks'
  const configurableBoards = boardConfigs.filter(d => ['clients', 'reports_main', 'reports_126_856_2025', 'reports_126_856_2024', 'weekly_tasks', 'balance_sheets', 'reconciliations', 'client_accounts', 'weekly_planning', 'family_tasks', 'wellbeing', 'therapists'].includes(d.type) && d.monday_board_id).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-lg text-gray-600">טוען נתוני Monday.com...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-1 md:p-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4"
      >
        <div className="flex items-center justify-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center shadow-lg">
            <Monitor className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Monday Integration
          </h1>
        </div>
        <p className="text-xl text-muted-foreground">
          הגדרות, סטטוס וסנכרון עם Monday.com במקום אחד
        </p>
      </motion.div>

      {/* Error Alert */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>שגיאה</AlertTitle>
              <AlertDescription className="flex items-center justify-between">
                {error}
                <Button variant="ghost" size="sm" onClick={() => setError(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Database className="w-8 h-8 text-blue-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">{boardConfigs.length}</p>
            <p className="text-sm text-gray-500">סוגי לוחות במערכת</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">{activeBoardsCount}</p>
            <p className="text-sm text-gray-500">לוחות מחוברים ל-Monday</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <BarChart3 className="w-8 h-8 text-purple-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">{totalItems.toLocaleString()}</p>
            <p className="text-sm text-gray-500">סה"כ פריטים סונכרנו</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Clock className="w-8 h-8 text-orange-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">
              {lastSyncTime ? lastSyncTime.toLocaleTimeString('he-IL', { 
                hour: '2-digit', 
                minute: '2-digit',
                day: '2-digit',
                month: '2-digit'
              }) : 'לא סונכרן'}
            </p>
            <p className="text-sm text-gray-500">סנכרון אחרון</p>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4 justify-center flex-wrap">
        <Button
          onClick={handleSyncAll}
          size="lg"
          disabled={activeBoardsCount === 0 || isLoading}
        >
          <RefreshCw className="w-5 h-5 ml-2" />
          סנכרן הכל ({configurableBoards} לוחות)
        </Button>

        <Button
          onClick={handleEmergencyCleanup}
          variant="destructive"
          size="lg"
          disabled={isLoading}
          className="bg-red-600 hover:bg-red-700"
        >
          <AlertTriangle className="w-5 h-5 ml-2" />
          ניקוי דחוף - מחק כפילויות
        </Button>
      </div>

      {/* Board Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {boardConfigs.map(board => (
          <IntegratedBoardCard
            key={board.type}
            board={board}
            data={boardData[board.type] || { count: 0, lastSync: null }}
            onSync={handleSyncBoard}
            onPurgeAndResync={handlePurgeAndResync}
            onEdit={handleEditBoard}
            onSave={handleSaveBoard}
            onBoardIdChange={(newId) => handleBoardIdChange(board.type, newId)}
            syncStatus={syncStatuses[board.type]}
            isEditing={editingBoardType === board.type}
            availableBoards={availableBoards}
            logs={logs[board.type]}
          />
        ))}
      </div>

      {/* Empty State */}
      {boardConfigs.length === 0 && (
        <Card className="p-12 text-center">
          <Monitor className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-semibold text-gray-600 mb-2">לא הוגדרו לוחות</h3>
          <p className="text-gray-500 mb-4">משהו השתבש בטעינת הנתונים. נסה לרענן את הדף.</p>
          <Button onClick={() => window.location.reload()}>
            <RefreshCw className="w-4 h-4 ml-2" />
            רענן דף
          </Button>
        </Card>
      )}
    </div>
  );
}
