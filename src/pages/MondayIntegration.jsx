
import React, { useState, useEffect, useCallback } from 'react';
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
  FileText, BookCheck, Home, Calendar, Heart, Clock, BarChart3, Edit, Save, X, AlertTriangle, CreditCard, Trash2, BookUser, Upload
} from 'lucide-react';
import { Client, Dashboard, Task, AccountReconciliation, WeeklySchedule, ClientAccount, Therapist } from '@/api/entities';
import { mondayApi } from '@/api/functions';
import { mondayBoardApi } from '@/api/functions';
import { mondayReportsAutomation } from "@/api/functions";
import { getMondayToken, setMondayToken, hasMondayToken } from '@/api/mondayClient';

// Token Configuration Component
const TokenConfig = ({ onTokenSaved }) => {
  const [token, setToken] = useState(getMondayToken());
  const [showToken, setShowToken] = useState(false);
  const [saved, setSaved] = useState(hasMondayToken());

  const handleSave = () => {
    if (token.trim()) {
      setMondayToken(token.trim());
      setSaved(true);
      if (onTokenSaved) onTokenSaved();
      setTimeout(() => setSaved(false), 3000);
    }
  };

  const isConnected = hasMondayToken();

  return (
    <Card className={`border-2 ${isConnected ? 'border-green-200 bg-gradient-to-br from-green-50 to-emerald-50' : 'border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50'}`}>
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${isConnected ? 'bg-green-100' : 'bg-amber-100'}`}>
            <Settings className={`w-6 h-6 ${isConnected ? 'text-green-600' : 'text-amber-600'}`} />
          </div>
          <div>
            <h3 className="text-xl font-semibold">
              {isConnected ? 'Monday.com מחובר' : 'חיבור ל-Monday.com'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {isConnected ? 'ה-API Token שלך מוגדר ופעיל' : 'הזיני את ה-API Token שלך מ-Monday.com'}
            </p>
          </div>
          {isConnected && (
            <Badge className="bg-green-500 text-white mr-auto">
              <CheckCircle className="w-3 h-3 ml-1" />
              מחובר
            </Badge>
          )}
        </div>

        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Input
              type={showToken ? 'text' : 'password'}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiJ9..."
              className="h-10 font-mono text-sm"
              dir="ltr"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-10"
            onClick={() => setShowToken(!showToken)}
          >
            {showToken ? 'הסתר' : 'הצג'}
          </Button>
          <Button
            onClick={handleSave}
            className="h-10"
            disabled={!token.trim()}
          >
            {saved ? (
              <>
                <CheckCircle className="w-4 h-4 ml-1" />
                נשמר!
              </>
            ) : (
              <>
                <Save className="w-4 h-4 ml-1" />
                שמור
              </>
            )}
          </Button>
        </div>

        {!isConnected && (
          <p className="text-xs text-amber-700 mt-2">
            ניתן למצוא את ה-Token ב-Monday.com: הגדרות &gt; Developer &gt; My Access Tokens
          </p>
        )}
      </CardContent>
    </Card>
  );
};

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
  const [reportMonth, setReportMonth] = useState(8);
  const [reportYear, setReportYear] = useState(2025);
  const [isCreatingReports, setIsCreatingReports] = useState(false);
  const [isQuickSyncing, setIsQuickSyncing] = useState(false);
  const [quickClientBoardId, setQuickClientBoardId] = useState("");
  const [isReverseSyncing, setIsReverseSyncing] = useState(false);
  const [isCreatingMonthlyBoards, setIsCreatingMonthlyBoards] = useState(false);
  const [monthlyBoardsYear, setMonthlyBoardsYear] = useState(new Date().getFullYear() + 1);
  const [monthlyBoardsResult, setMonthlyBoardsResult] = useState(null);
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [addColumnResult, setAddColumnResult] = useState(null);

  const loadData = useCallback(async () => {
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
  }, [setBoardConfigs, setBoardData, setError, setIsLoading]);

  const loadAvailableBoards = useCallback(async () => {
    try {
      const response = await mondayBoardApi({ action: 'getAllBoards' });
      const data = response?.data;

      if (data?.rate_limited) {
        console.warn('Rate limited when loading boards. Retry after seconds:', data?.retry_after_seconds || 15);
        setError(`המערכת עמוסה (Rate Limit). נסה שוב בעוד ~${data?.retry_after_seconds || 15} שניות.`);
        return;
      }

      if (data?.forbidden) {
        setError('גישה ל-Monday נחסמה (403). בדוק את מפתח ה-API והרשאות הלוח.');
        return;
      }

      if (data?.success) {
        setAvailableBoards(data.boards || []);
      } else if (data?.error) {
        setError(data.error);
      }
    } catch (error) {
      console.error("Error loading available boards:", error);
      setError('שגיאה בטעינת רשימת לוחות מ-Monday');
    }
  }, [setAvailableBoards, setError]);

  const loadPageData = useCallback(async () => {
    setIsLoading(true);
    setError(null); // Clear previous errors on reload
    await Promise.all([
      loadData(),
      loadAvailableBoards()
    ]);
    setIsLoading(false);
  }, [loadData, loadAvailableBoards, setIsLoading]);

  useEffect(() => {
    loadPageData();
  }, [loadPageData]);

  const handleAddServicesColumn = async () => {
    if (!window.confirm('האם להוסיף עמודת "שירותים" ללוח הלקוחות?')) {
      return;
    }

    setIsAddingColumn(true);
    setAddColumnResult(null);
    
    try {
      const response = await mondayApi({
        action: 'addColumnToBoard',
        boardId: '1923441265', // CLIENTS_BOARD_ID (this ID must be correct for the specific monday.com account)
        columnTitle: 'שירותים',
        columnType: 'dropdown',
        columnSettings: JSON.stringify({
          labels: {
            0: "הנהלת חשבונות מלאה",
            1: "שכר",
            2: "מאזנים שנתיים",
            3: "דוחות מיוחדים",
            4: "ייעוץ",
            5: "דיווחי מע״מ",
            6: "מקדמות מס",
            7: "התאמות חשבונות",
            8: "שליחת תלושי שכר לעובדים",
            9: "העלאת מס״ב עובדים",
            10: "שליחת דוח אחיד למתפעל",
            11: "העלאת מס״ב סוציאליות",
            12: "שידור אחיד באמצעות טמל",
            13: "העלאת תשלומי רשויות לבנק"
          }
        })
      });
      
      if (response.data.success) {
        setAddColumnResult({
          type: 'success',
          message: `✅ עמודת "שירותים" נוספה בהצלחה ללוח הלקוחות עם 14 סוגי שירותים!`,
          columnId: response.data.column.id
        });
      } else {
        setAddColumnResult({
          type: 'error',
          message: 'שגיאה בהוספת העמודה'
        });
      }
    } catch (error) {
      console.error("Error adding column:", error);
      setAddColumnResult({
        type: 'error',
        message: `שגיאה: ${error?.response?.data?.error || error.message}`
      });
    } finally {
      setIsAddingColumn(false);
    }
  };

  const handleCreateMonthlyBoards = async () => {
    if (!window.confirm(`האם ליצור 12 לוחות דיווח חודשיים עבור שנת ${monthlyBoardsYear}?`)) {
      return;
    }

    setIsCreatingMonthlyBoards(true);
    setMonthlyBoardsResult(null);
    
    try {
      const response = await mondayApi({ 
        action: 'createMonthlyBoards', 
        year: monthlyBoardsYear 
      });
      
      if (response.data.success) {
        setMonthlyBoardsResult({
          type: 'success',
          message: `✅ נוצרו ${response.data.createdBoards.length} לוחות חודשיים לשנת ${response.data.year}!`,
          boards: response.data.createdBoards.map(b => ({ month: b.month, monthName: b.monthName }))
        });
        
        await loadData(); // Reload all board configs and data
      } else {
        setMonthlyBoardsResult({
          type: 'error',
          message: 'שגיאה ביצירת לוחות חודשיים'
        });
      }
    } catch (error) {
      console.error("Error creating monthly boards:", error);
      setMonthlyBoardsResult({
        type: 'error',
        message: `שגיאה: ${error?.response?.data?.error || error.message}`
      });
    } finally {
      setIsCreatingMonthlyBoards(false);
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

  const handleCreateReportsForMonth = async () => {
    setIsCreatingReports(true);
    setError(null);
    try {
      const response = await mondayReportsAutomation({ targetYear: reportYear, targetMonth: reportMonth });
      const res = response?.data;
      if (res?.success) {
        alert(res.message || `נוצרו דיווחים לחודש ${String(reportMonth).padStart(2,'0')}.${reportYear}`);
        setLastSyncTime(new Date());
      } else {
        throw new Error(res?.error || 'שגיאה לא ידועה ביצירת דיווחים');
      }
    } catch (err) {
      console.error('Create reports error:', err);
      setError(`שגיאה ביצירת דיווחים: ${err?.response?.data?.error || err.message}`);
    } finally {
      setIsCreatingReports(false);
    }
  };

  // סנכרון מהיר של לקוחות מלוח Monday לפי Board ID
  const handleQuickClientSync = async () => {
    if (!quickClientBoardId || String(quickClientBoardId).trim() === "") {
      alert("אנא הזן Board ID של לוח הלקוחות ב-Monday");
      return;
    }
    setIsQuickSyncing(true);
    setError(null);
    setLogs(prev => ({ 
      ...prev, 
      clients: [...(prev.clients || []), `[${new Date().toLocaleTimeString('he-IL')}] מתחיל סנכרון לקוחות מלוח ${quickClientBoardId}...`] 
    }));

    try {
      const response = await mondayApi({ action: 'syncClients', boardId: String(quickClientBoardId).trim() });

      if (response?.data?.success) {
        const created = response?.data?.created || 0;
        const updated = response?.data?.updated || 0;
        setLogs(prev => ({ 
          ...prev, 
          clients: [...(prev.clients || []), `הסתיים: נוצרו ${created}, עודכנו ${updated}`] 
        }));
        alert(`סנכרון הושלם בהצלחה!\nנוצרו: ${created}\nעודכנו: ${updated}`);
        await loadData();
      } else {
        const msg = response?.data?.error || 'שגיאה לא ידועה בסנכרון';
        setLogs(prev => ({ 
          ...prev, 
          clients: [...(prev.clients || []), `שגיאה: ${msg}`] 
        }));
        setError(`שגיאה בסנכרון לקוחות: ${msg}`);
        alert(`שגיאה בסנכרון: ${msg}`);
      }
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'שגיאה לא ידועה';
      setLogs(prev => ({ 
        ...prev, 
        clients: [...(prev.clients || []), `שגיאה קריטית: ${msg}`] 
      }));
      setError(`שגיאה בסנכרון לקוחות: ${msg}`);
      alert(`שגיאה בסנכרון: ${msg}`);
    } finally {
      setIsQuickSyncing(false);
    }
  };

  const handleReverseSyncAll = async () => {
    if (!window.confirm('האם לבצע סנכרון הפוך (CalmPlan → Monday) לכל הלוחות הפעילים?')) return;
    setIsReverseSyncing(true);
    setError(null);
    try {
      const response = await mondayApi({ action: 'reverseSyncAllBoards' });
      const data = response?.data;
      if (data?.success) {
        const updated = data.totalUpdated || 0;
        const skipped = data.totalSkipped || 0;
        alert(`סנכרון הפוך הושלם!\nעודכנו ${updated} פריטים ב-Monday\nדולגו ${skipped}`);
        setLastSyncTime(new Date());
      } else {
        throw new Error(data?.error || 'כשל בסנכרון הפוך');
      }
    } catch (e) {
      setError(`שגיאה בסנכרון הפוך: ${e?.response?.data?.error || e.message}`);
    } finally {
      setIsReverseSyncing(false);
    }
  };

  // ניקוי מטמון מקומי (בטוח): מוחק רק נתוני דפדפן לא-קריטיים
  const handleClearLocalCache = () => {
    try {
      const lsKeys = Object.keys(localStorage);
      lsKeys.forEach(k => {
        const lower = k.toLowerCase();
        if (lower.includes('monday') || lower.includes('calmplan') || lower.includes('cache')) {
          localStorage.removeItem(k);
        }
      });
      const ssKeys = Object.keys(sessionStorage);
      ssKeys.forEach(k => {
        const lower = k.toLowerCase();
        if (lower.includes('monday') || lower.includes('calmplan') || lower.includes('cache')) {
          sessionStorage.removeItem(k);
        }
      });
      // אפס לוגים ממסך האינטגרציה (UI בלבד)
      setLogs({});
      alert('מטמון מקומי נוקה בהצלחה (local/session storage). אין השפעה על נתוני השרת.');
    } catch (e) {
      alert('שגיאה בניקוי מטמון: ' + (e?.message || e));
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

      {/* Token Configuration */}
      <div className="max-w-3xl mx-auto w-full">
        <TokenConfig onTokenSaved={() => loadPageData()} />
      </div>

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
              {lastSyncTime ? lastSyncTime.toLocaleString('he-IL', { 
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

        <Button
          onClick={handleReverseSyncAll}
          variant="outline"
          size="lg"
          disabled={isReverseSyncing || isLoading}
        >
          <Upload className={`w-5 h-5 ml-2 ${isReverseSyncing ? 'animate-pulse' : ''}`} />
          {isReverseSyncing ? 'מעלה ל-Monday...' : 'סנכרון הפוך ל-Monday'}
        </Button>

        <Button
          variant="outline"
          size="lg"
          onClick={handleClearLocalCache}
          disabled={isLoading}
        >
          נקה מטמון
        </Button>
      </div>

      {/* Add Services Column Section */}
      <div className="max-w-3xl mx-auto w-full">
        <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
          <CardContent className="p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Plus className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-green-900">הוספת עמודת שירותים ללוח לקוחות</h3>
                <p className="text-sm text-green-700">הוסף עמודת Dropdown עם 14 סוגי שירותים לבחירה</p>
              </div>
            </div>

            {addColumnResult && (
              <div className={`p-4 rounded-lg border ${
                addColumnResult.type === 'success' 
                  ? 'bg-green-50 border-green-200 text-green-800' 
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}>
                <div className="flex items-start gap-2">
                  {addColumnResult.type === 'success' ? (
                    <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium">{addColumnResult.message}</p>
                    {addColumnResult.columnId && (
                      <p className="text-sm mt-1">Column ID: {addColumnResult.columnId}</p>
                    )}
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setAddColumnResult(null)}
                    className="flex-shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            <div className="bg-green-100/50 p-3 rounded-lg">
              <p className="text-sm text-green-800 font-semibold mb-2">
                השירותים שיתווספו (14 סוגים):
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-green-700">
                <div className="space-y-1">
                  <p className="font-medium text-green-800">שירותים כלליים:</p>
                  <ul className="mr-4 space-y-0.5">
                    <li>• הנהלת חשבונות מלאה</li>
                    <li>• שכר</li>
                    <li>• מאזנים שנתיים</li>
                    <li>• דוחות מיוחדים</li>
                    <li>• ייעוץ</li>
                    <li>• דיווחי מע״מ</li>
                    <li>• מקדמות מס</li>
                  </ul>
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-green-800">שירותי שכר ודיווח:</p>
                  <ul className="mr-4 space-y-0.5">
                    <li>• התאמות חשבונות</li>
                    <li>• שליחת תלושי שכר לעובדים</li>
                    <li>• העלאת מס״ב עובדים</li>
                    <li>• שליחת דוח אחיד למתפעל</li>
                    <li>• העלאת מס״ב סוציאליות</li>
                    <li>• שידור אחיד באמצעות טמל</li>
                    <li>• העלאת תשלומי רשויות לבנק</li>
                  </ul>
                </div>
              </div>
            </div>

            <Button
              onClick={handleAddServicesColumn}
              disabled={isAddingColumn}
              className="bg-green-600 hover:bg-green-700 text-white"
              size="lg"
            >
              {isAddingColumn ? (
                <>
                  <RefreshCw className="w-5 h-5 ml-2 animate-spin" />
                  מוסיף עמודה...
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5 ml-2" />
                  הוסף עמודת שירותים (14 סוגים)
                </>
              )}
            </Button>

            <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg">
              <p className="text-sm text-amber-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>
                  <strong>שים לב:</strong> פעולה זו תוסיף עמודה חדשה ללוח הלקוחות ב-Monday.com 
                  עם 14 סוגי שירותים. תוכל לבחור מספר שירותים לכל לקוח (multi-select).
                </span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create Monthly Boards Section */}
      <div className="max-w-3xl mx-auto w-full">
        <Card className="mt-6 border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50">
          <CardContent className="p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-indigo-900">יצירת לוחות דיווח חודשיים</h3>
                <p className="text-sm text-indigo-700">צור 12 לוחות חדשים בפעולה אחת - אחד לכל חודש בשנה</p>
              </div>
            </div>

            {monthlyBoardsResult && (
              <div className={`p-4 rounded-lg border ${
                monthlyBoardsResult.type === 'success' 
                  ? 'bg-green-50 border-green-200 text-green-800' 
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}>
                <div className="flex items-start gap-2">
                  {monthlyBoardsResult.type === 'success' ? (
                    <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium mb-2">{monthlyBoardsResult.message}</p>
                    
                    {monthlyBoardsResult.boards && monthlyBoardsResult.boards.length > 0 && (
                      <div className="mt-3 space-y-1">
                        <p className="text-sm font-semibold">לוחות שנוצרו:</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                          {monthlyBoardsResult.boards.map((board, index) => (
                            <div key={index} className="bg-white/50 p-2 rounded">
                              {board.monthName}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setMonthlyBoardsResult(null)}
                    className="flex-shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
              <div>
                <label className="text-sm font-medium text-indigo-800 mb-2 block">
                  שנה ליצירת לוחות
                </label>
                <Input
                  type="number"
                  min={2024}
                  max={2030}
                  value={monthlyBoardsYear}
                  onChange={(e) => setMonthlyBoardsYear(Number(e.target.value))}
                  className="h-10 bg-white"
                />
              </div>
              <Button
                onClick={handleCreateMonthlyBoards}
                disabled={isCreatingMonthlyBoards}
                className="bg-indigo-600 hover:bg-indigo-700 text-white h-10"
                size="lg"
              >
                {isCreatingMonthlyBoards ? (
                  <>
                    <RefreshCw className="w-5 h-5 ml-2 animate-spin" />
                    יוצר לוחות...
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5 ml-2" />
                    צור 12 לוחות חדשים
                  </>
                )}
              </Button>
            </div>

            <div className="bg-indigo-100/50 p-3 rounded-lg">
              <p className="text-sm text-indigo-800 flex items-start gap-2">
                <span className="font-bold text-lg">💡</span>
                <span>
                  פעולה זו תיצור 12 לוחות חדשים ב-Monday.com (ינואר-דצמבר {monthlyBoardsYear}), 
                  כולל כל העמודות הנדרשות וקישור ללוח הלקוחות. 
                  הלוחות יישמרו אוטומטית במערכת CalmPlan.
                </span>
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg">
              <p className="text-sm text-amber-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>
                  <strong>חשוב:</strong> לאחר יצירת הלוחות, תוכל לעבור ל-Monday.com ולבצע Move של משימות 
                  מהלוח הישן ללוחות החדשים. המערכת תזהה אוטומטית את הלוח החודשי המתאים לכל דיווח חדש.
                </span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* סנכרון מהיר ללוח לקוחות לפי Board ID */}
      <div className="max-w-3xl mx-auto w-full">
        <Card className="mt-2">
          <CardContent className="p-4 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">סנכרון מהיר - לקוחות</h3>
                <p className="text-sm text-muted-foreground">סנכרן לקוחות מלוח Monday לפי Board ID, ללא הגדרות נוספות.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
              <div>
                <label className="text-xs text-gray-600">Board ID של לוח הלקוחות</label>
                <Input
                  placeholder="למשל: 1923441265"
                  value={quickClientBoardId}
                  onChange={(e) => setQuickClientBoardId(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleQuickClientSync}
                  disabled={isQuickSyncing || !quickClientBoardId}
                  className="w-full sm:w-auto"
                >
                  <RefreshCw className={`w-4 h-4 ml-2 ${isQuickSyncing ? 'animate-spin' : ''}`} />
                  {isQuickSyncing ? 'מסנכרן...' : 'סנכרן לקוחות'}
                </Button>
              </div>
            </div>

            <p className="text-xs text-gray-500">
              טיפ: אם תרצה לשמור את הלוח הזה כ"לוח לקוחות" קבוע במערכת – ערוך את הכרטיס של "לוח לקוחות" למעלה ושמור את ה-Board ID שם.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* כפתור יצירת דיווחים לחודש נבחר (MDAY) */}
      <div className="max-w-3xl mx-auto w-full">
        <Card className="mt-6">
          <CardContent className="p-4 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">יצירת דיווחים חודשיים ל-Monday</h3>
                <p className="text-sm text-muted-foreground">בחר חודש ושנה ולחץ על הכפתור ליצירת משימות דיווח בקבוצת החודש</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="text-xs text-gray-600">חודש</label>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={reportMonth}
                  onChange={(e) => setReportMonth(Math.max(1, Math.min(12, Number(e.target.value) || 1)))}
                  className="h-9"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600">שנה</label>
                <Input
                  type="number"
                  min={2023}
                  max={2030}
                  value={reportYear}
                  onChange={(e) => setReportYear(Math.max(2023, Math.min(2030, Number(e.target.value) || 2025)))}
                  className="h-9"
                />
              </div>
              <div className="col-span-2">
                <Button
                  onClick={handleCreateReportsForMonth}
                  disabled={isCreatingReports}
                  className="w-full sm:w-auto"
                >
                  <Calendar className={`w-4 h-4 ml-2 ${isCreatingReports ? 'animate-spin' : ''}`} />
                  {isCreatingReports ? 'יוצר דיווחים...' : `צור דיווחים לחודש ${String(reportMonth).padStart(2,'0')}.${reportYear}`}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
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
