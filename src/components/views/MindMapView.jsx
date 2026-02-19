import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

const BRANCH_COLORS = {
  'מע"מ': 'from-violet-400 to-violet-600',
  'מקדמות מס': 'from-blue-400 to-blue-600',
  'שכר': 'from-orange-400 to-orange-600',
  'ביטוח לאומי': 'from-green-400 to-green-600',
  'ניכויים': 'from-teal-400 to-teal-600',
  'אחר': 'from-gray-400 to-gray-600',
};

const STATUS_COLORS = {
  completed: 'bg-emerald-500 border-emerald-600',
  in_progress: 'bg-sky-400 border-sky-500',
  not_started: 'bg-gray-300 border-gray-400',
  overdue: 'bg-purple-500 border-purple-600 animate-pulse',
  issue: 'bg-amber-400 border-amber-500',
  waiting_for_materials: 'bg-amber-300 border-amber-400',
  ready_for_reporting: 'bg-indigo-300 border-indigo-400',
  reported_waiting_for_payment: 'bg-violet-300 border-violet-400',
};

const SIZE_MAP = { S: 32, M: 48, L: 64, XL: 80 };

const estimateClientSize = (client, tasks) => {
  if (client?.size) return client.size;
  const services = client?.service_types?.length || 0;
  const taskCount = tasks.filter(t => t.client_name === client?.name).length;
  if (services >= 4 || taskCount >= 8) return 'XL';
  if (services >= 3 || taskCount >= 5) return 'L';
  if (services >= 2 || taskCount >= 3) return 'M';
  return 'S';
};

export default function MindMapView({ tasks, clients }) {
  const grouped = useMemo(() => {
    const groups = {};
    tasks.forEach(task => {
      const cat = task.category || 'אחר';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(task);
    });
    return groups;
  }, [tasks]);

  const getClientSize = (clientName) => {
    const client = clients?.find(c => c.name === clientName);
    return estimateClientSize(client, tasks);
  };

  const isOverdue = (task) => {
    if (task.status === 'completed') return false;
    return task.due_date && new Date(task.due_date) < new Date();
  };

  const categories = Object.keys(grouped);
  const angleStep = (2 * Math.PI) / Math.max(categories.length, 1);
  const branchRadius = 200;
  const nodeSpacing = 70;

  if (tasks.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-gray-400">
        <p>אין משימות להצגה במפה</p>
      </div>
    );
  }

  return (
    <div className="relative w-full min-h-[600px] overflow-auto bg-gradient-to-br from-gray-50 to-white rounded-2xl border">
      <div className="relative" style={{ width: '800px', height: '800px', margin: '0 auto' }}>
        {/* Center node */}
        <motion.div
          className="absolute bg-gradient-to-br from-emerald-400 to-emerald-600 text-white rounded-full w-24 h-24 flex items-center justify-center text-sm font-bold shadow-xl z-10"
          style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200 }}
        >
          דיווחים
        </motion.div>

        {/* Branches */}
        {categories.map((cat, catIndex) => {
          const angle = catIndex * angleStep - Math.PI / 2;
          const tasksInCat = grouped[cat];

          return (
            <React.Fragment key={cat}>
              {/* Category label */}
              <motion.div
                className={`absolute bg-gradient-to-r ${BRANCH_COLORS[cat] || BRANCH_COLORS['אחר']} text-white px-3 py-1 rounded-full text-xs font-medium shadow-md z-10`}
                style={{
                  top: `${50 + Math.sin(angle) * 25}%`,
                  left: `${50 + Math.cos(angle) * 25}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: catIndex * 0.1 }}
              >
                {cat} ({tasksInCat.length})
              </motion.div>

              {/* Task nodes */}
              {tasksInCat.map((task, taskIndex) => {
                const clientSize = getClientSize(task.client_name);
                const size = SIZE_MAP[clientSize];
                const distance = branchRadius + taskIndex * nodeSpacing;
                const overdueStatus = isOverdue(task);
                const statusKey = overdueStatus ? 'overdue' : task.status;

                return (
                  <motion.div
                    key={task.id}
                    className={`absolute rounded-full flex items-center justify-center text-white text-[10px] font-medium cursor-pointer border-2 shadow-md
                      ${STATUS_COLORS[statusKey] || STATUS_COLORS.not_started}`}
                    style={{
                      width: size,
                      height: size,
                      top: `${50 + Math.sin(angle) * (distance / 8)}%`,
                      left: `${50 + Math.cos(angle) * (distance / 8)}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: catIndex * 0.1 + taskIndex * 0.05 }}
                    whileHover={{ scale: 1.3, zIndex: 50 }}
                    title={`${task.client_name} - ${task.title} (${clientSize})`}
                  >
                    {task.client_name?.substring(0, 4)}
                  </motion.div>
                );
              })}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
