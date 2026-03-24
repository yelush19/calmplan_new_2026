import React, { useMemo, useState, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  STATUS_CONFIG,
  getServiceForTask,
  getTaskProcessSteps,
} from '@/config/processTemplates';
import { getTaskReportingMonth } from '@/config/automationRules';
import { CheckSquare, Square, ChevronUp, ChevronDown, Pencil } from 'lucide-react';

// Alternating tint colors for service column groups
const SERVICE_TINTS = [
  { bg: '#EFF6FF', headerBg: '#DBEAFE' },  // blue
  { bg: '#F0FDF4', headerBg: '#DCFCE7' },  // green
  { bg: '#FFF7ED', headerBg: '#FFEDD5' },  // orange
  { bg: '#FAF5FF', headerBg: '#F3E8FF' },  // purple
  { bg: '#FEF2F2', headerBg: '#FEE2E2' },  // red
  { bg: '#ECFDF5', headerBg: '#D1FAE5' },  // emerald
  { bg: '#FFFBEB', headerBg: '#FEF3C7' },  // amber
];

// Status cycle order for clicking through statuses
const STATUS_CYCLE = [
  'waiting_for_materials',
  'not_started',
  'ready_to_broadcast',
  'reported_pending_payment',
  'sent_for_review',
  'needs_corrections',
  'production_completed',
];

/**
 * TaxWorkbookView — interactive spreadsheet-style view of all clients x services.
 *
 * Rows = clients (one per client)
 * Column groups = services (income_collection, expense_collection, vat, etc.)
 * Sub-columns = each service's process steps (clickable checkboxes)
 * Status column per service (clickable badge to cycle status)
 *
 * Interactions:
 * - Click checkbox → toggle step done/undone
 * - Click status badge → cycle to next status
 * - Click client name → open edit dialog for first task
 * - Click column header → sort by that service's completion
 */
export default function TaxWorkbookView({
  tasks,
  clients,
  services,
  onToggleStep,
  onStatusChange,
  onDateChange,
  onEdit,
}) {
  const [sortKey, setSortKey] = useState(null);      // null | 'client' | serviceKey
  const [sortDir, setSortDir] = useState('asc');      // 'asc' | 'desc'

  // Build ordered list of service definitions — DYNAMIC: only include services that have tasks
  const serviceList = useMemo(() => {
    const all = Object.values(services);
    // Filter to services that have at least one matching task
    const activeServices = all.filter(svc =>
      tasks.some(t => svc.taskCategories.includes(t.category))
    );
    return activeServices.length > 0 ? activeServices : all;
  }, [services, tasks]);

  // Build a map: clientName → { [serviceKey]: task }
  const clientMap = useMemo(() => {
    const map = {};
    tasks.forEach(task => {
      const clientName = task.client_name || 'ללא לקוח';
      if (!map[clientName]) map[clientName] = {};
      const svc = getServiceForTask(task);
      if (svc) {
        map[clientName][svc.key] = task;
      }
    });
    return map;
  }, [tasks]);

  // Client lookup by name
  const clientByName = useMemo(() => {
    const m = {};
    clients.forEach(c => { m[c.name] = c; });
    return m;
  }, [clients]);

  // Helper: get completion score for a client's service (0-100)
  const getCompletionScore = useCallback((clientTasks, svcKey, svc) => {
    const task = clientTasks?.[svcKey];
    if (!task) return -1; // no task = sort to bottom
    if (task.status === 'production_completed') return 100;
    const steps = getTaskProcessSteps(task);
    const total = svc.steps.length;
    if (total === 0) return 0;
    const done = svc.steps.filter(s => steps[s.key]?.done).length;
    return Math.round((done / total) * 100);
  }, []);

  // Sorted client names
  const sortedClients = useMemo(() => {
    const names = Object.keys(clientMap);
    if (!sortKey) {
      return names.sort((a, b) => a.localeCompare(b, 'he'));
    }
    if (sortKey === 'client') {
      return names.sort((a, b) => {
        const cmp = a.localeCompare(b, 'he');
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    // Sort by service completion
    const svc = serviceList.find(s => s.key === sortKey);
    if (!svc) return names.sort((a, b) => a.localeCompare(b, 'he'));
    return names.sort((a, b) => {
      const scoreA = getCompletionScore(clientMap[a], sortKey, svc);
      const scoreB = getCompletionScore(clientMap[b], sortKey, svc);
      const cmp = scoreA - scoreB;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [clientMap, sortKey, sortDir, serviceList, getCompletionScore]);

  // Handle sort toggle
  const handleSort = useCallback((key) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }, [sortKey]);

  // Handle status cycle
  const handleStatusCycle = useCallback((task) => {
    if (!task || !onStatusChange) return;
    const currentIdx = STATUS_CYCLE.indexOf(task.status || 'not_started');
    const nextIdx = (currentIdx + 1) % STATUS_CYCLE.length;
    onStatusChange(task, STATUS_CYCLE[nextIdx]);
  }, [onStatusChange]);

  // Total sub-columns count (steps + status badge per service)
  const totalColumns = useMemo(() => {
    return serviceList.reduce((sum, svc) => sum + svc.steps.length + 1, 0) + 1; // +1 for client name
  }, [serviceList]);

  // Sort indicator component
  const SortIndicator = ({ columnKey }) => {
    if (sortKey !== columnKey) return null;
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 inline-block mr-0.5" />
      : <ChevronDown className="w-3 h-3 inline-block mr-0.5" />;
  };

  if (sortedClients.length === 0) return null;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
      <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: '75vh' }}>
        <table className="w-full border-collapse text-sm" style={{ direction: 'rtl', minWidth: `${totalColumns * 60}px` }}>
          {/* Header row 1: service names spanning sub-columns */}
          <thead className="sticky top-0 z-10">
            <tr>
              <th
                rowSpan={2}
                className="sticky right-0 z-20 bg-slate-100 border-b-2 border-l border-slate-300 px-3 py-2 text-right font-bold text-slate-700 min-w-[140px] cursor-pointer select-none hover:bg-slate-200 transition-colors"
                style={{ boxShadow: '-2px 0 4px rgba(0,0,0,0.05)' }}
                onClick={() => handleSort('client')}
              >
                <div className="flex items-center gap-1">
                  לקוח
                  <SortIndicator columnKey="client" />
                </div>
              </th>
              {serviceList.map((svc, svcIdx) => {
                const tint = SERVICE_TINTS[svcIdx % SERVICE_TINTS.length];
                const colSpan = svc.steps.length + 1; // steps + status
                return (
                  <th
                    key={svc.key}
                    colSpan={colSpan}
                    className="border-b border-l border-slate-200 px-2 py-2 text-center font-bold text-slate-700 text-xs cursor-pointer select-none hover:brightness-95 transition-all"
                    style={{ backgroundColor: tint.headerBg }}
                    onClick={() => handleSort(svc.key)}
                  >
                    <div className="flex items-center justify-center gap-1">
                      {svc.label}
                      <SortIndicator columnKey={svc.key} />
                    </div>
                  </th>
                );
              })}
            </tr>
            {/* Header row 2: step labels + "סטטוס" per service */}
            <tr>
              {serviceList.map((svc, svcIdx) => {
                const tint = SERVICE_TINTS[svcIdx % SERVICE_TINTS.length];
                return (
                  <React.Fragment key={svc.key}>
                    {svc.steps.map(step => (
                      <th
                        key={step.key}
                        className="border-b-2 border-l border-slate-200 px-1 py-1.5 text-center text-[11px] font-medium text-slate-600 whitespace-nowrap"
                        style={{ backgroundColor: tint.headerBg }}
                      >
                        {step.label}
                      </th>
                    ))}
                    <th
                      className="border-b-2 border-l border-slate-300 px-1 py-1.5 text-center text-[11px] font-medium text-slate-600 whitespace-nowrap"
                      style={{ backgroundColor: tint.headerBg }}
                    >
                      סטטוס
                    </th>
                  </React.Fragment>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {sortedClients.map((clientName, rowIdx) => {
              const clientTasks = clientMap[clientName];
              // Determine row background based on overall status
              const allCompleted = serviceList.every(svc => {
                const task = clientTasks[svc.key];
                return !task || task.status === 'production_completed';
              });
              const anyWaiting = serviceList.some(svc => {
                const task = clientTasks[svc.key];
                return task && task.status === 'waiting_for_materials';
              });

              let rowBg = rowIdx % 2 === 0 ? '#FFFFFF' : '#FAFBFC';
              if (allCompleted && Object.keys(clientTasks).length > 0) rowBg = '#F0FDF4'; // light green
              if (anyWaiting) rowBg = '#FFFBEB'; // light amber

              // Reporting month badge (extract month number)
              const anyTask = Object.values(clientTasks)[0];
              const reportingMonth = anyTask ? getTaskReportingMonth(anyTask) : null;
              const monthNum = reportingMonth ? parseInt(reportingMonth.split('-')[1], 10) : null;

              // First task for "edit" click
              const firstTask = Object.values(clientTasks)[0];

              return (
                <tr key={clientName} className="hover:bg-blue-50/40 transition-colors group" style={{ backgroundColor: rowBg }}>
                  {/* Sticky client name column — clickable to edit */}
                  <td
                    className="sticky right-0 z-10 border-b border-l border-slate-200 px-3 py-2 font-semibold text-slate-800 text-sm whitespace-nowrap cursor-pointer hover:text-blue-700 transition-colors"
                    style={{
                      backgroundColor: rowBg,
                      boxShadow: '-2px 0 4px rgba(0,0,0,0.05)',
                    }}
                    onClick={() => firstTask && onEdit?.(firstTask)}
                  >
                    <div className="flex items-center gap-2">
                      <span>{clientName}</span>
                      {monthNum && (
                        <span
                          className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold text-white"
                          style={{ backgroundColor: '#4682B4' }}
                        >
                          {monthNum}
                        </span>
                      )}
                      {onEdit && (
                        <Pencil className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                  </td>

                  {/* Service columns */}
                  {serviceList.map((svc, svcIdx) => {
                    const task = clientTasks[svc.key];
                    const tint = SERVICE_TINTS[svcIdx % SERVICE_TINTS.length];
                    const steps = task ? getTaskProcessSteps(task) : {};
                    const status = task ? (task.status || 'not_started') : null;
                    const statusCfg = status ? STATUS_CONFIG[status] : null;

                    // Find the "current step" — first unchecked step after a checked one
                    let currentStepKey = null;
                    if (task) {
                      let foundChecked = false;
                      for (const step of svc.steps) {
                        if (steps[step.key]?.done) {
                          foundChecked = true;
                        } else if (foundChecked || svc.steps[0].key === step.key) {
                          currentStepKey = step.key;
                          break;
                        }
                      }
                      if (!foundChecked && !currentStepKey && svc.steps.length > 0) {
                        currentStepKey = svc.steps[0].key;
                      }
                    }

                    return (
                      <React.Fragment key={svc.key}>
                        {svc.steps.map(step => {
                          const stepData = steps[step.key];
                          const isDone = stepData?.done;
                          const isCurrent = step.key === currentStepKey && !isDone;

                          return (
                            <td
                              key={step.key}
                              className={`border-b border-l border-slate-100 text-center px-1 py-1.5 transition-colors ${
                                !task ? 'opacity-30' : 'hover:brightness-95 active:scale-95'
                              }`}
                              style={{
                                backgroundColor: isCurrent
                                  ? '#FEF9C3' // highlighted current step
                                  : isDone
                                    ? '#DCFCE7' // light green for done
                                    : tint.bg,
                                cursor: task ? 'pointer' : 'default',
                              }}
                              onClick={() => task && onToggleStep?.(task, step.key)}
                              title={task ? `${step.label}: ${isDone ? 'בוצע' : 'לא בוצע'} — לחץ לשינוי` : ''}
                            >
                              {task ? (
                                isDone ? (
                                  <CheckSquare className="w-4 h-4 mx-auto text-emerald-600" />
                                ) : (
                                  <Square className="w-4 h-4 mx-auto text-slate-400 hover:text-slate-600" />
                                )
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                          );
                        })}
                        {/* Status badge cell — clickable to cycle status */}
                        <td
                          className={`border-b border-l border-slate-200 text-center px-1 py-1.5 ${
                            task ? 'cursor-pointer hover:brightness-95 active:scale-95' : ''
                          } transition-all`}
                          style={{ backgroundColor: tint.bg }}
                          onClick={() => task && handleStatusCycle(task)}
                          title={task ? 'לחץ לשינוי סטטוס' : ''}
                        >
                          {task && statusCfg ? (
                            <Badge
                              className={`${statusCfg.bg} ${statusCfg.text} text-[10px] px-1.5 py-0.5 whitespace-nowrap cursor-pointer`}
                            >
                              {statusCfg.label}
                            </Badge>
                          ) : (
                            <span className="text-slate-300 text-[10px]">—</span>
                          )}
                        </td>
                      </React.Fragment>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
