import React, { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  STATUS_CONFIG,
  getServiceForTask,
  getTaskProcessSteps,
} from '@/config/processTemplates';
import { getTaskReportingMonth } from '@/config/automationRules';
import { CheckSquare, Square } from 'lucide-react';

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

/**
 * TaxWorkbookView — spreadsheet-style view of all clients x services.
 *
 * Rows = clients (one per client)
 * Column groups = services (income_collection, expense_collection, vat, etc.)
 * Sub-columns = each service's process steps (checkboxes)
 * Status column per service (color badge)
 */
export default function TaxWorkbookView({
  tasks,
  clients,
  services,
  onToggleStep,
  onStatusChange,
  onDateChange,
}) {
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

  // Sorted client names
  const sortedClients = useMemo(() => {
    return Object.keys(clientMap).sort((a, b) => a.localeCompare(b, 'he'));
  }, [clientMap]);

  // Client lookup by name
  const clientByName = useMemo(() => {
    const m = {};
    clients.forEach(c => { m[c.name] = c; });
    return m;
  }, [clients]);

  // Total sub-columns count (steps + status badge per service)
  const totalColumns = useMemo(() => {
    return serviceList.reduce((sum, svc) => sum + svc.steps.length + 1, 0) + 1; // +1 for client name
  }, [serviceList]);

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
                className="sticky right-0 z-20 bg-slate-100 border-b-2 border-l border-slate-300 px-3 py-2 text-right font-bold text-slate-700 min-w-[140px]"
                style={{ boxShadow: '-2px 0 4px rgba(0,0,0,0.05)' }}
              >
                לקוח
              </th>
              {serviceList.map((svc, svcIdx) => {
                const tint = SERVICE_TINTS[svcIdx % SERVICE_TINTS.length];
                const colSpan = svc.steps.length + 1; // steps + status
                return (
                  <th
                    key={svc.key}
                    colSpan={colSpan}
                    className="border-b border-l border-slate-200 px-2 py-2 text-center font-bold text-slate-700 text-xs"
                    style={{ backgroundColor: tint.headerBg }}
                  >
                    {svc.label}
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

              return (
                <tr key={clientName} className="hover:bg-blue-50/40 transition-colors" style={{ backgroundColor: rowBg }}>
                  {/* Sticky client name column */}
                  <td
                    className="sticky right-0 z-10 border-b border-l border-slate-200 px-3 py-2 font-semibold text-slate-800 text-sm whitespace-nowrap"
                    style={{
                      backgroundColor: rowBg,
                      boxShadow: '-2px 0 4px rgba(0,0,0,0.05)',
                    }}
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
                          // First unchecked step (either after checked, or the very first)
                          currentStepKey = step.key;
                          break;
                        }
                      }
                      // If no checked steps found, the first step is current
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
                              className={`border-b border-l border-slate-100 text-center px-1 py-1.5 ${
                                !task ? 'opacity-30' : ''
                              }`}
                              style={{
                                backgroundColor: isCurrent
                                  ? '#FEF9C3' // highlighted current step
                                  : isDone
                                    ? '#DCFCE7' // light green for done
                                    : tint.bg,
                                cursor: task ? 'pointer' : 'default',
                              }}
                              onClick={() => task && onToggleStep(task, step.key)}
                            >
                              {task ? (
                                isDone ? (
                                  <CheckSquare className="w-4 h-4 mx-auto text-emerald-600" />
                                ) : (
                                  <Square className="w-4 h-4 mx-auto text-slate-400" />
                                )
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                          );
                        })}
                        {/* Status badge cell */}
                        <td
                          className="border-b border-l border-slate-200 text-center px-1 py-1.5"
                          style={{ backgroundColor: tint.bg }}
                        >
                          {task && statusCfg ? (
                            <Badge
                              className={`${statusCfg.bg} ${statusCfg.text} text-[10px] px-1.5 py-0.5 whitespace-nowrap`}
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
