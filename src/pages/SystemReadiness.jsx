
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Client, Task } from '@/api/entities';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';
import {
  Settings, Save, RefreshCw, CheckCircle, AlertTriangle,
  ArrowRight, Zap, Users, Search, ChevronDown
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import { getPayrollTier, getVatEnergyTier, PAYROLL_TIERS } from '@/engines/taskCascadeEngine';
import { getServiceForTask } from '@/config/processTemplates';

const COMPLEXITY_OPTIONS = [
  { value: 'low', label: 'רגיל', color: 'bg-green-100 text-green-700' },
  { value: 'medium', label: 'בינוני', color: 'bg-amber-100 text-amber-700' },
  { value: 'high', label: 'מורכב', color: 'bg-purple-100 text-purple-700' },
];

export default function SystemReadiness() {
  const [clients, setClients] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editedClients, setEditedClients] = useState({}); // { clientId: { employee_count, complexity_level, vat_volume } }
  const [savedCount, setSavedCount] = useState(0);
  const tableRef = useRef(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [clientsData, tasksData] = await Promise.all([
        Client.list('name', 1000).catch(() => []),
        Task.filter({ context: 'work' }).catch(() => []),
      ]);
      setClients(Array.isArray(clientsData) ? clientsData : []);
      setTasks(Array.isArray(tasksData) ? tasksData : []);
    } catch (err) {
      console.error('Error loading data:', err);
    }
    setIsLoading(false);
  };

  // Filter active clients
  const activeClients = useMemo(() => {
    let list = clients.filter(c => c.status !== 'inactive' && c.status !== 'deleted');
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      list = list.filter(c => c.name?.toLowerCase().includes(lower));
    }
    return list.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'he'));
  }, [clients, searchTerm]);

  // Readiness stats
  const stats = useMemo(() => {
    const total = activeClients.length;
    const withEmployeeCount = activeClients.filter(c => {
      const edited = editedClients[c.id];
      const count = edited?.employee_count ?? c.business_info?.employee_count ?? c.employee_count;
      return count && count > 0;
    }).length;
    const withComplexity = activeClients.filter(c => {
      const edited = editedClients[c.id];
      const level = edited?.complexity_level ?? c.business_info?.complexity_level ?? c.complexity_level;
      return level && level !== '';
    }).length;
    const withVatVolume = activeClients.filter(c => {
      const edited = editedClients[c.id];
      const vol = edited?.vat_volume ?? c.business_info?.vat_volume ?? c.vat_volume;
      return vol && vol > 0;
    }).length;
    const complete = activeClients.filter(c => {
      const edited = editedClients[c.id];
      const count = edited?.employee_count ?? c.business_info?.employee_count ?? c.employee_count;
      const level = edited?.complexity_level ?? c.business_info?.complexity_level ?? c.complexity_level;
      const vol = edited?.vat_volume ?? c.business_info?.vat_volume ?? c.vat_volume;
      return (count > 0) && (level && level !== '') && (vol > 0);
    }).length;
    const missing = total - complete;
    return { total, withEmployeeCount, withComplexity, withVatVolume, complete, missing };
  }, [activeClients, editedClients]);

  // Get current value for a field (edited or from client)
  const getFieldValue = useCallback((client, field) => {
    const edited = editedClients[client.id];
    if (edited && edited[field] !== undefined) return edited[field];
    if (client.business_info?.[field] !== undefined) return client.business_info[field];
    if (client[field] !== undefined) return client[field];
    return field === 'complexity_level' ? '' : 0;
  }, [editedClients]);

  // Update a field in the edit buffer
  const updateField = useCallback((clientId, field, value) => {
    setEditedClients(prev => ({
      ...prev,
      [clientId]: {
        ...prev[clientId],
        [field]: value,
      }
    }));
  }, []);

  // Determine payroll tier for display
  const getClientTier = useCallback((client) => {
    const edited = editedClients[client.id];
    const count = edited?.employee_count ?? client.business_info?.employee_count ?? client.employee_count ?? 0;
    const mockClient = { ...client, business_info: { ...client.business_info, employee_count: count } };
    return getPayrollTier(mockClient);
  }, [editedClients]);

  // Check if a client has unsaved changes
  const hasChanges = useMemo(() => {
    return Object.keys(editedClients).length > 0;
  }, [editedClients]);

  // Save all changes
  const handleSaveAll = async () => {
    const edits = Object.entries(editedClients);
    if (edits.length === 0) {
      toast.info('אין שינויים לשמור');
      return;
    }

    setIsSaving(true);
    let saved = 0;

    try {
      for (const [clientId, changes] of edits) {
        const client = clients.find(c => c.id === clientId);
        if (!client) continue;

        const updatedBusinessInfo = {
          ...(client.business_info || {}),
          ...changes,
        };

        await Client.update(clientId, {
          ...client,
          business_info: updatedBusinessInfo,
        });
        saved++;
      }

      toast.success(`${saved} לקוחות עודכנו בהצלחה`);
      setSavedCount(prev => prev + saved);
      setEditedClients({});

      // Reload to get fresh data
      await loadData();

      // Notify other pages that client data changed
      window.dispatchEvent(new CustomEvent('calmplan:data-synced', {
        detail: { collection: 'clients', type: 'batch-update' },
      }));

    } catch (err) {
      console.error('Error saving:', err);
      toast.error('שגיאה בשמירת הנתונים');
    }
    setIsSaving(false);
  };

  // Count tasks per client for context
  const taskCountByClient = useMemo(() => {
    const map = {};
    tasks.forEach(t => {
      if (t.client_name) {
        map[t.client_name] = (map[t.client_name] || 0) + 1;
      }
    });
    return map;
  }, [tasks]);

  // Has payroll tasks
  const hasPayrollByClient = useMemo(() => {
    const map = {};
    tasks.forEach(t => {
      if (t.client_name) {
        const svc = getServiceForTask(t);
        if (svc?.key === 'payroll') map[t.client_name] = true;
      }
    });
    return map;
  }, [tasks]);

  // Keyboard navigation handler
  const handleKeyDown = useCallback((e, clientIdx, field) => {
    if (e.key === 'Tab' || e.key === 'Enter') {
      // Let default Tab behavior work for field-to-field navigation
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextRow = document.querySelector(`[data-row="${clientIdx + 1}"][data-field="${field}"]`);
      nextRow?.focus();
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevRow = document.querySelector(`[data-row="${clientIdx - 1}"][data-field="${field}"]`);
      prevRow?.focus();
    }
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <Link to={createPageUrl('Home')}>
          <Button variant="outline" size="sm" className="gap-2 text-gray-600 hover:text-emerald-700">
            <ArrowRight className="w-4 h-4" />חזור לדף הבית
          </Button>
        </Link>
      </div>

      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-md">
            <Settings className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">הגדרת מערכת - אשף מהיר</h1>
            <p className="text-gray-500">הגדירי את נתוני הלקוחות בטבלה אחת - Tab למעבר בין שדות, Enter לשורה הבאה</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleSaveAll}
            disabled={!hasChanges || isSaving}
            className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1.5 font-bold"
          >
            {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            שמור הכל ({Object.keys(editedClients).length})
          </Button>
          <Button onClick={loadData} variant="outline" size="icon" className="h-9 w-9" disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </motion.div>

      {/* Readiness Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="bg-gradient-to-br from-gray-50 to-white border-gray-200 shadow-sm">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-gray-700">{stats.total}</div>
            <div className="text-xs text-gray-500">סה"כ לקוחות</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-200 shadow-sm">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-emerald-600">{stats.complete}</div>
            <div className="text-xs text-gray-500">מוכנים</div>
          </CardContent>
        </Card>
        <Card className={`bg-gradient-to-br shadow-sm ${stats.missing > 0 ? 'from-amber-50 to-white border-amber-200' : 'from-emerald-50 to-white border-emerald-200'}`}>
          <CardContent className="p-3 text-center">
            <div className={`text-2xl font-bold ${stats.missing > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{stats.missing}</div>
            <div className="text-xs text-gray-500">חסרים נתונים</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200 shadow-sm">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.withEmployeeCount}</div>
            <div className="text-xs text-gray-500">עם מספר עובדים</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-200 shadow-sm">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-purple-600">{stats.withVatVolume}</div>
            <div className="text-xs text-gray-500">עם נפח מע"מ</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
        <Input
          placeholder="חיפוש לקוח..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pr-10 h-9"
        />
      </div>

      {/* Keyboard hint */}
      <div className="flex items-center gap-4 text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
        <span><kbd className="px-1.5 py-0.5 bg-white rounded border text-[10px]">Tab</kbd> מעבר לשדה הבא</span>
        <span><kbd className="px-1.5 py-0.5 bg-white rounded border text-[10px]">↑↓</kbd> מעבר בין שורות</span>
        <span><kbd className="px-1.5 py-0.5 bg-white rounded border text-[10px]">Enter</kbd> שורה הבאה</span>
      </div>

      {/* Main Table */}
      <Card className="border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto" ref={tableRef}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-right py-2.5 px-4 font-semibold text-gray-600 text-xs sticky right-0 z-10 bg-gray-50 min-w-[180px]">
                  לקוח
                </th>
                <th className="text-center py-2.5 px-3 font-semibold text-gray-600 text-xs min-w-[100px]">
                  משימות
                </th>
                <th className="text-center py-2.5 px-3 font-semibold text-gray-600 text-xs min-w-[130px]">
                  <div className="flex flex-col items-center">
                    <span>מספר עובדים</span>
                    <span className="text-[9px] text-gray-400 font-normal">לחישוב Tier שכר</span>
                  </div>
                </th>
                <th className="text-center py-2.5 px-3 font-semibold text-gray-600 text-xs min-w-[130px]">
                  <div className="flex flex-col items-center">
                    <span>רמת מורכבות</span>
                    <span className="text-[9px] text-gray-400 font-normal">התאמות/מאזנים</span>
                  </div>
                </th>
                <th className="text-center py-2.5 px-3 font-semibold text-gray-600 text-xs min-w-[130px]">
                  <div className="flex flex-col items-center">
                    <span>נפח מע"מ (דק')</span>
                    <span className="text-[9px] text-gray-400 font-normal">לחישוב Energy Tier</span>
                  </div>
                </th>
                <th className="text-center py-2.5 px-3 font-semibold text-gray-600 text-xs min-w-[120px]">
                  Tier
                </th>
                <th className="text-center py-2.5 px-3 font-semibold text-gray-600 text-xs min-w-[80px]">
                  סטטוס
                </th>
              </tr>
            </thead>
            <tbody>
              {activeClients.map((client, idx) => {
                const employeeCount = getFieldValue(client, 'employee_count');
                const complexityLevel = getFieldValue(client, 'complexity_level');
                const vatVolume = getFieldValue(client, 'vat_volume');
                const tier = getClientTier(client);
                const taskCount = taskCountByClient[client.name] || 0;
                const hasPayroll = hasPayrollByClient[client.name];
                const isEdited = !!editedClients[client.id];
                const isComplete = employeeCount > 0 && complexityLevel && vatVolume > 0;

                return (
                  <tr
                    key={client.id}
                    className={`border-b border-gray-50 transition-colors ${isEdited ? 'bg-blue-50/30' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'} hover:bg-gray-100/50`}
                  >
                    {/* Client name */}
                    <td className={`py-2 px-4 sticky right-0 z-10 ${isEdited ? 'bg-blue-50/30' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800 text-xs truncate max-w-[160px]">{client.name}</span>
                        {isEdited && (
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" title="שינויים שלא נשמרו" />
                        )}
                      </div>
                    </td>

                    {/* Task count */}
                    <td className="py-2 px-3 text-center">
                      <span className="text-xs text-gray-500">{taskCount}</span>
                      {hasPayroll && (
                        <Badge className="text-[8px] px-1 py-0 bg-gray-100 text-gray-500 mr-1">שכר</Badge>
                      )}
                    </td>

                    {/* Employee count */}
                    <td className="py-2 px-3 text-center">
                      <input
                        type="number"
                        min="0"
                        max="999"
                        value={employeeCount || ''}
                        onChange={(e) => updateField(client.id, 'employee_count', parseInt(e.target.value) || 0)}
                        onKeyDown={(e) => handleKeyDown(e, idx, 'employee_count')}
                        data-row={idx}
                        data-field="employee_count"
                        className="w-20 text-center text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 bg-white"
                        placeholder="0"
                      />
                    </td>

                    {/* Complexity level */}
                    <td className="py-2 px-3 text-center">
                      <select
                        value={complexityLevel || 'low'}
                        onChange={(e) => updateField(client.id, 'complexity_level', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, idx, 'complexity_level')}
                        data-row={idx}
                        data-field="complexity_level"
                        className="w-24 text-center text-xs border border-gray-200 rounded px-1 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 bg-white"
                      >
                        {COMPLEXITY_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </td>

                    {/* VAT volume (minutes) */}
                    <td className="py-2 px-3 text-center">
                      <input
                        type="number"
                        min="0"
                        max="999"
                        value={vatVolume || ''}
                        onChange={(e) => updateField(client.id, 'vat_volume', parseInt(e.target.value) || 0)}
                        onKeyDown={(e) => handleKeyDown(e, idx, 'vat_volume')}
                        data-row={idx}
                        data-field="vat_volume"
                        className="w-20 text-center text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 bg-white"
                        placeholder="0"
                      />
                    </td>

                    {/* Computed Tier */}
                    <td className="py-2 px-3 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        {employeeCount > 0 && (
                          <Badge className={`text-[10px] px-1.5 py-0 ${
                            tier.key === 'nano' ? 'bg-emerald-100 text-emerald-700 border-emerald-300' :
                            tier.key === 'small' ? 'bg-blue-100 text-blue-700 border-blue-300' :
                            tier.key === 'mid' ? 'bg-amber-100 text-amber-700 border-amber-300' :
                            'bg-purple-100 text-purple-700 border-purple-300'
                          }`}>
                            {tier.emoji && <span className="ml-0.5">{tier.emoji}</span>}
                            {tier.label}
                          </Badge>
                        )}
                        {vatVolume > 0 && (
                          <span className={`text-[9px] font-medium ${
                            vatVolume <= 20 ? 'text-emerald-600' :
                            vatVolume <= 45 ? 'text-blue-600' :
                            'text-purple-600'
                          }`}>
                            {vatVolume <= 20 ? '⚡ Quick Win' :
                             vatVolume <= 45 ? 'Standard' :
                             'Climb'}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Readiness status */}
                    <td className="py-2 px-3 text-center">
                      {isComplete ? (
                        <CheckCircle className="w-4 h-4 text-emerald-500 mx-auto" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-400 mx-auto" />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Bottom save bar (sticky when scrolling) */}
      {hasChanges && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="sticky bottom-4 z-20"
        >
          <Card className="bg-indigo-50 border-indigo-200 shadow-lg">
            <CardContent className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                <span className="text-sm font-medium text-indigo-700">
                  {Object.keys(editedClients).length} לקוחות עם שינויים שלא נשמרו
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditedClients({})}
                  className="text-gray-600"
                >
                  בטל שינויים
                </Button>
                <Button
                  onClick={handleSaveAll}
                  disabled={isSaving}
                  size="sm"
                  className="bg-indigo-500 hover:bg-indigo-600 text-white gap-1.5 font-bold"
                >
                  {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  שמור הכל
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
