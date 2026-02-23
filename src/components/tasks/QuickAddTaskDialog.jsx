import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Briefcase, Home as HomeIcon, Search, ChevronDown, ChevronLeft, X, Clock, Calendar as CalendarIcon, AlertTriangle } from 'lucide-react';
import { Task, Client, Dashboard } from '@/api/entities';
import { Switch } from '@/components/ui/switch';
import { ALL_SERVICES } from '@/config/processTemplates';
import { getScheduledStartForCategory } from '@/config/automationRules';
import { format, parseISO, subMonths } from 'date-fns';
import { he } from 'date-fns/locale';
import { toast } from 'sonner';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// Group services by dashboard for the dropdown
const SERVICE_GROUPS = [
  { key: 'tax', label: 'דיווחי מיסים' },
  { key: 'payroll', label: 'שכר' },
  { key: 'additional', label: 'שירותים נוספים' },
  { key: 'reconciliation', label: 'התאמות' },
  { key: 'admin', label: 'אדמיניסטרציה' },
  { key: 'balance', label: 'מאזנים' },
];

const SERVICE_LIST = Object.values(ALL_SERVICES).map(s => ({
  key: s.key,
  label: s.label,
  dashboard: s.dashboard,
  createCategory: s.createCategory,
}));

// Searchable dropdown component
function SearchableSelect({ value, onChange, items, placeholder, renderItem, groupBy, groupLabels, allowNone, noneLabel = 'ללא', disabled = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) setSearch('');
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(item => {
      const label = typeof renderItem === 'function' ? renderItem(item) : (item.label || item.name || '');
      return String(label).toLowerCase().includes(q);
    });
  }, [items, search, renderItem]);

  const selectedItem = items.find(i => i.id === value || i.key === value);
  const displayLabel = selectedItem ? (renderItem ? renderItem(selectedItem) : selectedItem.label || selectedItem.name) : (value === '__none__' ? noneLabel : placeholder);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => { if (!disabled) { setIsOpen(!isOpen); setTimeout(() => inputRef.current?.focus(), 50); } }}
        disabled={disabled}
        className={`w-full flex items-center justify-between h-9 px-3 text-xs border border-gray-200 rounded-md transition-colors ${disabled ? 'bg-gray-100 cursor-not-allowed opacity-60' : 'bg-white hover:bg-gray-50'}`}
      >
        <span className={`truncate ${!selectedItem && value === '__none__' ? 'text-gray-400' : 'text-gray-800'}`}>
          {displayLabel}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 flex flex-col">
          {/* Search input */}
          <div className="p-1.5 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300" />
              <input
                ref={inputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="חפש..."
                className="w-full h-7 text-xs pr-7 pl-2 border border-gray-100 rounded focus:outline-none focus:ring-1 focus:ring-emerald-300"
              />
            </div>
          </div>

          {/* Options */}
          <div className="overflow-y-auto flex-1">
            {allowNone && (
              <button
                type="button"
                onClick={() => { onChange('__none__'); setIsOpen(false); }}
                className={`w-full text-right px-3 py-1.5 text-xs hover:bg-gray-50 transition-colors ${value === '__none__' ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-gray-500'}`}
              >
                {noneLabel}
              </button>
            )}

            {groupBy ? (
              // Grouped rendering
              groupLabels.map(group => {
                const groupItems = filtered.filter(i => i[groupBy] === group.key);
                if (groupItems.length === 0) return null;
                return (
                  <div key={group.key}>
                    <div className="px-3 py-1 text-[10px] font-bold text-gray-400 bg-gray-50 sticky top-0">
                      {group.label}
                    </div>
                    {groupItems.map(item => {
                      const itemKey = item.id || item.key;
                      const isSelected = itemKey === value;
                      return (
                        <button
                          type="button"
                          key={itemKey}
                          onClick={() => { onChange(itemKey); setIsOpen(false); }}
                          className={`w-full text-right px-3 py-1.5 text-xs hover:bg-gray-50 transition-colors ${isSelected ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-gray-700'}`}
                        >
                          {renderItem ? renderItem(item) : item.label || item.name}
                        </button>
                      );
                    })}
                  </div>
                );
              })
            ) : (
              // Flat rendering
              filtered.map(item => {
                const itemKey = item.id || item.key;
                const isSelected = itemKey === value;
                return (
                  <button
                    type="button"
                    key={itemKey}
                    onClick={() => { onChange(itemKey); setIsOpen(false); }}
                    className={`w-full text-right px-3 py-1.5 text-xs hover:bg-gray-50 transition-colors ${isSelected ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-gray-700'}`}
                  >
                    {renderItem ? renderItem(item) : item.label || item.name}
                  </button>
                );
              })
            )}

            {filtered.length === 0 && !allowNone && (
              <div className="text-center py-3 text-xs text-gray-400">לא נמצאו תוצאות</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function QuickAddTaskDialog({ open, onOpenChange, onCreated, defaultContext = 'work', defaultCategory = '', defaultParentId = null, defaultClientId = null, lockedParent = false, lockedClient = false }) {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dueTime, setDueTime] = useState('');
  const [duration, setDuration] = useState('');
  const [context, setContext] = useState(defaultContext);
  const [serviceKey, setServiceKey] = useState(defaultCategory || '__none__');
  const [clientId, setClientId] = useState('__none__');
  const [clients, setClients] = useState([]);
  const [boardId, setBoardId] = useState('__none__');
  const [dashboards, setDashboards] = useState([]);
  const [parentId, setParentId] = useState('__none__');
  const [parentTasks, setParentTasks] = useState([]);
  const [status, setStatus] = useState('not_started');
  const [reportingDeadline, setReportingDeadline] = useState('');
  const [submitAsIs, setSubmitAsIs] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadWarning, setLoadWarning] = useState(null);

  // SMART Anchor: daily load feasibility check
  useEffect(() => {
    if (!dueDate || !open) { setLoadWarning(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const allTasks = await Task.list('-due_date', 5000).catch(() => []);
        if (cancelled) return;
        const threshold = parseInt(localStorage.getItem('calmplan_daily_capacity') || '240', 10);
        const sameDayTasks = (allTasks || []).filter(
          t => t.due_date === dueDate && t.status !== 'completed' && t.status !== 'not_relevant'
        );
        const totalMinutes = sameDayTasks.reduce((sum, t) => sum + (t.estimated_duration || 15), 0);
        const currentDuration = parseInt(duration) || 15;
        const projected = totalMinutes + currentDuration;
        if (projected > threshold) {
          setLoadWarning({ totalMinutes: projected, threshold, taskCount: sameDayTasks.length });
        } else {
          setLoadWarning(null);
        }
      } catch { if (!cancelled) setLoadWarning(null); }
    })();
    return () => { cancelled = true; };
  }, [dueDate, duration, open]);

  useEffect(() => {
    if (open) {
      Client.list(null, 500).then(list => {
        setClients((list || []).filter(c => c.status === 'active' || c.status === 'onboarding_pending' || c.status === 'balance_sheet_only').sort((a, b) => a.name?.localeCompare(b.name, 'he')));
      }).catch(() => setClients([]));
      Dashboard.list(null, 200).then(list => {
        const dbBoards = (list || []).map(d => ({ ...d, source: 'db' }));
        // Always include built-in SERVICE_GROUPS as board options
        const builtInBoards = SERVICE_GROUPS.map(g => ({
          id: `board_${g.key}`, key: g.key, name: g.label, source: 'builtin',
        }));
        const dbKeys = new Set(dbBoards.map(d => d.key || d.board_key));
        const merged = [...dbBoards, ...builtInBoards.filter(b => !dbKeys.has(b.key))];
        setDashboards(merged.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'he')));
      }).catch(() => {
        // On error, still show built-in boards
        setDashboards(SERVICE_GROUPS.map(g => ({
          id: `board_${g.key}`, key: g.key, name: g.label, source: 'builtin',
        })));
      });
      Task.list('-created_date', 200).then(list => {
        setParentTasks((list || []).filter(t => t.status !== 'completed' && t.status !== 'not_relevant'));
      }).catch(() => setParentTasks([]));
      setTitle('');
      setDueDate(format(new Date(), 'yyyy-MM-dd'));
      setDueTime('');
      setDuration('');
      setContext(defaultContext);
      setServiceKey(defaultCategory || '__none__');
      setClientId(defaultClientId || '__none__');
      setBoardId('__none__');
      setParentId(defaultParentId || '__none__');
      setStatus('not_started');
      setReportingDeadline('');
      setSubmitAsIs(false);
    }
  }, [open, defaultContext, defaultCategory, defaultParentId, defaultClientId]);

  const selectedService = serviceKey !== '__none__' ? SERVICE_LIST.find(s => s.key === serviceKey) : null;
  const selectedClient = clientId !== '__none__' ? clients.find(c => c.id === clientId) : null;
  const selectedBoard = boardId !== '__none__' ? dashboards.find(d => d.id === boardId) : null;
  const selectedParent = parentId !== '__none__' ? parentTasks.find(t => t.id === parentId) : null;

  // Build ancestor breadcrumb chain (max 4 levels) when a parent is selected
  const ancestorChain = useMemo(() => {
    if (!selectedParent) return [];
    const chain = [{ id: selectedParent.id, title: selectedParent.title }];
    let current = selectedParent;
    let depth = 0;
    while (current?.parent_id && depth < 4) {
      const parent = parentTasks.find(t => t.id === current.parent_id);
      if (!parent) break;
      chain.unshift({ id: parent.id, title: parent.title });
      current = parent;
      depth++;
    }
    return chain;
  }, [selectedParent, parentTasks]);

  // Deadline warning: status is 'waiting_on_client' AND reportingDeadline within 24h or overdue
  const isDeadlineCritical = useMemo(() => {
    if (status !== 'waiting_on_client' || !reportingDeadline) return false;
    const deadlineDate = parseISO(reportingDeadline);
    const now = new Date();
    const hoursUntil = (deadlineDate - now) / (1000 * 60 * 60);
    return hoursUntil <= 24;
  }, [status, reportingDeadline]);

  const handleSave = async () => {
    if (!title.trim() || isSaving) return;
    setIsSaving(true);
    try {
      const category = selectedService?.createCategory || '';
      const scheduledStart = category && dueDate ? getScheduledStartForCategory(category, dueDate) : null;

      // Build title with client name if selected
      let taskTitle = title.trim();
      if (selectedClient && !taskTitle.includes(selectedClient.name)) {
        taskTitle = `${taskTitle} - ${selectedClient.name}`;
      }

      // For work tasks with a service category, set reporting_month so dashboards find this task.
      // Due dates are in the deadline month (M+1), so reporting_month = due_date month - 1.
      let reportingMonth;
      if (context === 'work' && category && dueDate) {
        const dueDateObj = parseISO(dueDate);
        reportingMonth = format(subMonths(dueDateObj, 1), 'yyyy-MM');
      }

      await Task.create({
        title: taskTitle,
        status: status,
        due_date: dueDate,
        due_time: dueTime || undefined,
        estimated_duration: duration ? parseInt(duration) : undefined,
        scheduled_start: scheduledStart || undefined,
        context,
        category,
        client_name: selectedClient?.name || undefined,
        client_id: selectedClient?.id || undefined,
        client_related: !!selectedClient,
        priority: isDeadlineCritical ? 'critical' : 'medium',
        ...(reportingMonth && { reporting_month: reportingMonth }),
        ...(selectedBoard && {
          board_id: selectedBoard.id,
          board_name: selectedBoard.name || selectedBoard.board_name,
          monday_board_id: selectedBoard.monday_board_id || undefined,
        }),
        ...(selectedParent && {
          parent_id: selectedParent.id,
          parent_title: selectedParent.title,
        }),
        ...(reportingDeadline && { reporting_deadline: reportingDeadline }),
        ...(submitAsIs && { submit_as_is: true }),
      });

      toast.success('משימה נוצרה בהצלחה');
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      console.error('שגיאה ביצירת משימה:', err);
      toast.error('שגיאה ביצירת המשימה');
    }
    setIsSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            {defaultParentId ? 'הוספת תת-משימה' : 'הוספת משימה מהירה'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {/* Parent breadcrumb */}
          {ancestorChain.length > 0 && (
            <div className="flex items-center flex-wrap gap-1 px-2 py-1.5 bg-blue-50 rounded-lg border border-blue-100">
              {ancestorChain.map((ancestor, i) => (
                <React.Fragment key={ancestor.id}>
                  <span className="text-xs text-blue-600 font-medium truncate max-w-[120px]" title={ancestor.title}>
                    {ancestor.title}
                  </span>
                  <ChevronLeft className="w-3 h-3 text-blue-300 shrink-0" />
                </React.Fragment>
              ))}
              <span className="text-xs text-blue-800 font-bold">תת-משימה חדשה</span>
            </div>
          )}

          {/* Title */}
          <div>
            <Label htmlFor="qa-title" className="text-xs">תיאור המשימה</Label>
            <Input
              id="qa-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="מה צריך לעשות?"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
          </div>

          {/* Service type (searchable) + Context */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">סוג שירות</Label>
              <SearchableSelect
                value={serviceKey}
                onChange={setServiceKey}
                items={SERVICE_LIST}
                placeholder="בחר שירות"
                renderItem={(item) => item.label}
                groupBy="dashboard"
                groupLabels={SERVICE_GROUPS}
                allowNone
                noneLabel="ללא (כללי)"
              />
            </div>
            <div>
              <Label className="text-xs">הקשר</Label>
              <Select value={context} onValueChange={setContext}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="work" className="text-xs">
                    <span className="inline-flex items-center gap-1"><Briefcase className="w-3 h-3" /> עבודה</span>
                  </SelectItem>
                  <SelectItem value="home" className="text-xs">
                    <span className="inline-flex items-center gap-1"><HomeIcon className="w-3 h-3" /> בית</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Client (searchable) */}
          <div>
            <Label className="text-xs">שיוך ללקוח</Label>
            <SearchableSelect
              value={clientId}
              onChange={setClientId}
              items={clients}
              placeholder="בחר לקוח"
              renderItem={(item) => item.name}
              allowNone
              noneLabel="ללא לקוח"
              disabled={lockedClient}
            />
          </div>

          {/* Board (Dashboard) + Parent Task */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">לוח (דשבורד)</Label>
              <SearchableSelect
                value={boardId}
                onChange={setBoardId}
                items={dashboards}
                placeholder="בחר לוח"
                renderItem={(item) => item.name || item.board_name || 'לוח ללא שם'}
                allowNone
                noneLabel="ללא לוח"
              />
            </div>
            <div>
              <Label className="text-xs">משימת אב</Label>
              <SearchableSelect
                value={parentId}
                onChange={setParentId}
                items={parentTasks}
                placeholder="בחר משימת אב"
                renderItem={(item) => item.title}
                allowNone
                noneLabel="ללא משימת אב"
                disabled={lockedParent}
              />
            </div>
          </div>

          {/* Status + Reporting Deadline */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">סטטוס</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_started" className="text-xs">טרם התחיל</SelectItem>
                  <SelectItem value="in_progress" className="text-xs">בביצוע</SelectItem>
                  <SelectItem value="waiting_on_client" className="text-xs">ממתין ללקוח</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">דדליין דיווח</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    type="button"
                    className="w-full h-9 justify-start text-xs font-normal px-3"
                  >
                    <CalendarIcon className="w-3.5 h-3.5 ml-1.5 shrink-0" />
                    {reportingDeadline ? format(parseISO(reportingDeadline), 'd בMMM yyyy', { locale: he }) : 'ללא'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={reportingDeadline ? parseISO(reportingDeadline) : undefined}
                    onSelect={(date) => date && setReportingDeadline(format(date, 'yyyy-MM-dd'))}
                    locale={he}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Submit As-Is toggle */}
          <div className="flex items-center justify-between px-1">
            <Label className="text-xs flex items-center gap-1.5">
              הגש כמות שיש (Submit As-Is)
            </Label>
            <Switch checked={submitAsIs} onCheckedChange={setSubmitAsIs} className="data-[state=unchecked]:bg-emerald-200" />
          </div>

          {/* Critical Deadline Warning */}
          {isDeadlineCritical && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-300 rounded-lg text-red-700">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
              <div className="text-xs font-bold">
                ⚠️ DEADLINE: הגש כמות שיש — הדדליין תוך 24 שעות או שעבר!
              </div>
            </div>
          )}

          {/* Due date + Time + Duration */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">תאריך יעד</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    type="button"
                    className="w-full h-9 justify-start text-xs font-normal px-3"
                  >
                    <CalendarIcon className="w-3.5 h-3.5 ml-1.5 shrink-0" />
                    {dueDate ? format(parseISO(dueDate), 'd בMMM yyyy', { locale: he }) : 'בחר תאריך'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate ? parseISO(dueDate) : undefined}
                    onSelect={(date) => date && setDueDate(format(date, 'yyyy-MM-dd'))}
                    locale={he}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1">
                <Clock className="w-3 h-3" />
                שעה
              </Label>
              <Input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="text-xs h-9"
                dir="ltr"
              />
            </div>
            <div>
              <Label className="text-xs">משך (דקות)</Label>
              <Input
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="30"
                className="text-xs h-9"
                dir="ltr"
                min="0"
              />
            </div>
          </div>

          {/* SMART Anchor: Daily Load Warning */}
          {loadWarning && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                עומס יומי: {Math.round(loadWarning.totalMinutes / 60 * 10) / 10} שעות ({loadWarning.taskCount} משימות) — מעל הסף של {loadWarning.threshold / 60} שעות
              </span>
            </div>
          )}

          <Button
            onClick={handleSave}
            disabled={!title.trim() || isSaving}
            className="w-full gap-1"
          >
            <Plus className="w-4 h-4" />
            {isSaving ? 'שומר...' : 'הוסף משימה'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
