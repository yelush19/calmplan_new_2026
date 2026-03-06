/**
 * ── MY FOCUS: Personal Planner & Energy DNA ──
 * The "home base" for Lena — combines personal + work tasks with energy-aware scheduling.
 * Features:
 * - Radial mind map ("היום שלי" at center, tasks radially arranged)
 * - Energy DNA: suggests nano tasks during low-energy, complex tasks during high-focus
 * - Personal Gantt: unified timeline of business + personal tasks
 * - Shape gallery for visual differentiation
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Task, Client } from '@/api/entities';
import { format, parseISO, isToday } from 'date-fns';
import { he } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Brain, Zap, Target, Clock, CheckCircle, Sun, Moon, Coffee,
  Network, BarChart3, List, Star, Sparkles,
} from 'lucide-react';
import { calculateCapacity, getTaskFeed, LOAD_COLORS } from '@/engines/capacityEngine';
import { getServiceWeight } from '@/config/serviceWeights';
import GanttView from '@/components/views/GanttView';
import { getActiveTreeTasks } from '@/utils/taskTreeFilter';
import useRealtimeRefresh from '@/hooks/useRealtimeRefresh';

// Energy DNA: time-of-day → recommended cognitive load
function getEnergyProfile() {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 10) return { level: 'high', label: 'ריכוז גבוה', icon: Sun, color: '#800000', recommended: [3, 2] };
  if (hour >= 10 && hour < 13) return { level: 'medium', label: 'אנרגיה בינונית', icon: Coffee, color: '#4682B4', recommended: [2, 1] };
  if (hour >= 13 && hour < 16) return { level: 'low', label: 'אנרגיה נמוכה', icon: Clock, color: '#8FBC8F', recommended: [0, 1] };
  if (hour >= 16 && hour < 19) return { level: 'medium', label: 'התאוששות', icon: Coffee, color: '#4682B4', recommended: [2, 1] };
  return { level: 'rest', label: 'זמן מנוחה', icon: Moon, color: '#ADD8E6', recommended: [0] };
}

export default function MyFocus() {
  const [tasks, setTasks] = useState([]);
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState('radial'); // radial | gantt | feed

  useEffect(() => { loadData(); }, []);
  useRealtimeRefresh(() => { loadData(); }, ['tasks', 'clients']);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [tasksData, clientsData] = await Promise.all([
        Task.list('-due_date', 5000).catch(() => []),
        Client.list('name', 1000).catch(() => []),
      ]);
      const raw = Array.isArray(tasksData) ? tasksData : [];
      setTasks(getActiveTreeTasks(raw));
      setClients(Array.isArray(clientsData) ? clientsData : []);
    } catch (err) {
      console.error('MyFocus load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const energy = getEnergyProfile();
  const EnergyIcon = energy.icon;

  // Split tasks into today's active tasks
  const todayTasks = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    return tasks.filter(t =>
      t.status !== 'production_completed' &&
      t.due_date && t.due_date <= todayStr
    );
  }, [tasks]);

  // Energy-matched suggestions from DNA
  const energySuggestions = useMemo(() => {
    return todayTasks
      .map(task => {
        const sw = getServiceWeight(task.category);
        const load = typeof task.cognitive_load === 'number' ? task.cognitive_load : sw.cognitiveLoad;
        return { ...task, _load: load, _duration: sw.duration };
      })
      .filter(t => energy.recommended.includes(t._load))
      .sort((a, b) => b._load - a._load)
      .slice(0, 5);
  }, [todayTasks, energy]);

  // KPI metrics
  const kpis = useMemo(() => calculateCapacity(todayTasks), [todayTasks]);
  const feed = useMemo(() => getTaskFeed(todayTasks), [todayTasks]);

  // Radial layout for today's tasks
  const radialNodes = useMemo(() => {
    const top = todayTasks.slice(0, 12);
    const angleStep = (2 * Math.PI) / Math.max(top.length, 1);
    const RADIUS = 160;
    return top.map((task, i) => {
      const angle = -Math.PI / 2 + i * angleStep;
      const sw = getServiceWeight(task.category);
      const load = typeof task.cognitive_load === 'number' ? task.cognitive_load : sw.cognitiveLoad;
      const lc = LOAD_COLORS[Math.min(3, Math.max(0, load))] || LOAD_COLORS[0];
      return {
        ...task,
        x: 250 + Math.cos(angle) * RADIUS,
        y: 250 + Math.sin(angle) * RADIUS,
        loadColor: lc,
        _load: load,
        _duration: sw.duration,
      };
    });
  }, [todayTasks]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <Brain className="w-8 h-8 text-[#00838F] animate-pulse" />
          <span className="text-sm text-gray-500">טוען את המרחב האישי...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-3 p-3" dir="rtl">
      {/* ── Header: Energy DNA Bar ── */}
      <div className="flex items-center gap-4 bg-white rounded-xl border px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: energy.color + '20' }}>
            <EnergyIcon className="w-5 h-5" style={{ color: energy.color }} />
          </div>
          <div>
            <div className="text-sm font-bold">{energy.label}</div>
            <div className="text-[10px] text-gray-400">{format(new Date(), 'EEEE, d בMMMM', { locale: he })}</div>
          </div>
        </div>

        <div className="w-px h-8 bg-gray-200" />

        {/* KPI Summary */}
        <div className="flex items-center gap-3">
          <div className="text-center">
            <div className="text-lg font-bold text-[#00838F]">{todayTasks.length}</div>
            <div className="text-[9px] text-gray-400">משימות</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold" style={{ color: kpis.efficiencyScore >= 50 ? '#2E7D32' : '#F57C00' }}>
              {kpis.efficiencyScore}%
            </div>
            <div className="text-[9px] text-gray-400">יעילות</div>
          </div>
          <div className="flex items-center gap-1">
            {[3, 2, 1, 0].map(tier => {
              const count = kpis.cognitiveLoadMix[tier] || 0;
              if (!count) return null;
              const lc = LOAD_COLORS[tier];
              return (
                <div key={tier} className="flex items-center gap-0.5">
                  <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: lc.color }} />
                  <span className="text-[10px] font-bold" style={{ color: lc.color }}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex-1" />

        {/* View Switcher */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          {[
            { key: 'radial', label: 'רדיאלי', icon: '🎯' },
            { key: 'feed', label: 'זרימה', icon: '📋' },
            { key: 'gantt', label: 'גאנט', icon: '📊' },
          ].map(v => (
            <button
              key={v.key}
              onClick={() => setViewMode(v.key)}
              className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${
                viewMode === v.key ? 'bg-white shadow text-[#00838F] font-bold' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {v.icon} {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Energy Suggestions Strip ── */}
      {energySuggestions.length > 0 && (
        <div className="flex items-center gap-2 bg-white rounded-xl border px-3 py-2 overflow-x-auto">
          <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="text-[10px] text-gray-500 shrink-0 font-medium">מומלץ עכשיו:</span>
          {energySuggestions.map(task => {
            const lc = LOAD_COLORS[task._load] || LOAD_COLORS[0];
            return (
              <div key={task.id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg border shrink-0"
                style={{ borderColor: lc.color + '40' }}>
                <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: lc.color }} />
                <span className="text-[10px] font-medium truncate max-w-[120px]">{task.title}</span>
                <span className="text-[9px] text-gray-400">{task._duration}דק׳</span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Main View ── */}
      <div className="flex-1 min-h-0">
        {viewMode === 'radial' ? (
          <Card className="h-full">
            <CardContent className="h-full p-0 relative">
              {/* Radial Mind Map — AYOA Style with Tapered Bezier Branches */}
              <svg viewBox="0 0 500 500" className="w-full h-full" style={{ maxHeight: 'calc(100vh - 200px)' }}>
                <defs>
                  {radialNodes.map(node => (
                    <radialGradient key={`grad-${node.id}`} id={`node-grad-${node.id}`}>
                      <stop offset="0%" stopColor={node.loadColor.color} stopOpacity="0.15" />
                      <stop offset="100%" stopColor={node.loadColor.color} stopOpacity="0.05" />
                    </radialGradient>
                  ))}
                </defs>

                {/* Tapered Bezier branches (AYOA organic roots) */}
                {radialNodes.map(node => {
                  const sx = 250, sy = 250, ex = node.x, ey = node.y;
                  const dx = ex - sx, dy = ey - sy;
                  const len = Math.sqrt(dx * dx + dy * dy) || 1;
                  const nx = -dy / len, ny = dx / len;
                  const startW = 4, endW = 1.5;
                  const cp1x = sx + dx * 0.3 + nx * len * 0.08;
                  const cp1y = sy + dy * 0.3 + ny * len * 0.08;
                  const cp2x = sx + dx * 0.7 - nx * len * 0.05;
                  const cp2y = sy + dy * 0.7 - ny * len * 0.05;
                  const sw2 = startW / 2, ew2 = endW / 2;
                  const d = [
                    `M ${sx + nx * sw2} ${sy + ny * sw2}`,
                    `C ${cp1x + nx * sw2 * 0.8} ${cp1y + ny * sw2 * 0.8} ${cp2x + nx * ew2 * 0.5} ${cp2y + ny * ew2 * 0.5} ${ex + nx * ew2} ${ey + ny * ew2}`,
                    `L ${ex - nx * ew2} ${ey - ny * ew2}`,
                    `C ${cp2x - nx * ew2 * 0.5} ${cp2y - ny * ew2 * 0.5} ${cp1x - nx * sw2 * 0.8} ${cp1y - ny * sw2 * 0.8} ${sx - nx * sw2} ${sy - ny * sw2}`,
                    'Z'
                  ].join(' ');
                  return (
                    <path key={`branch-${node.id}`} d={d}
                      fill={node.loadColor.color} opacity={0.55}
                      style={{ transition: 'all 0.4s ease' }} />
                  );
                })}

                {/* Center hub — gradient circle */}
                <circle cx={250} cy={250} r={48} fill="url(#center-glow)" />
                <circle cx={250} cy={250} r={45} fill="#1E3A5F" />
                <defs>
                  <radialGradient id="center-glow">
                    <stop offset="0%" stopColor="#1E3A5F" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#1E3A5F" stopOpacity="0" />
                  </radialGradient>
                </defs>
                <text x={250} y={243} textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">היום שלי</text>
                <text x={250} y={257} textAnchor="middle" fill="#B0BEC5" fontSize="9">
                  {todayTasks.length} משימות
                </text>
                <text x={250} y={269} textAnchor="middle" fill="#546E7A" fontSize="8">
                  {energy.label}
                </text>

                {/* Task nodes — organic bubbles with load-colored borders */}
                {radialNodes.map((node, idx) => {
                  const r = node._load >= 3 ? 36 : node._load >= 2 ? 32 : node._load >= 1 ? 28 : 24;
                  return (
                    <g key={node.id} style={{ cursor: 'pointer' }}>
                      {/* Glow halo for high-load tasks */}
                      {node._load >= 2 && (
                        <circle cx={node.x} cy={node.y} r={r + 4}
                          fill="none" stroke={node.loadColor.color} strokeWidth={1} opacity={0.25} />
                      )}
                      <circle cx={node.x} cy={node.y} r={r}
                        fill={`url(#node-grad-${node.id})`} stroke={node.loadColor.color} strokeWidth={2.5} />
                      <circle cx={node.x} cy={node.y} r={r - 1}
                        fill="white" opacity={0.85} />
                      <text x={node.x} y={node.y - 5} textAnchor="middle" fontSize="8" fontWeight="600" fill="#263238">
                        {(node.title || '').substring(0, 14)}
                      </text>
                      <text x={node.x} y={node.y + 7} textAnchor="middle" fontSize="7" fill={node.loadColor.color}>
                        {node.loadColor.label} • {node._duration}דק׳
                      </text>
                      {node.client_name && (
                        <text x={node.x} y={node.y + 17} textAnchor="middle" fontSize="6" fill="#90A4AE">
                          {node.client_name.substring(0, 12)}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </CardContent>
          </Card>
        ) : viewMode === 'gantt' ? (
          <Card className="h-full overflow-auto">
            <CardContent className="p-2">
              <GanttView tasks={todayTasks} clients={clients} />
            </CardContent>
          </Card>
        ) : (
          <Card className="h-full overflow-auto">
            <CardContent className="p-2 space-y-1">
              {feed.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <CheckCircle className="w-8 h-8 mb-2" />
                  <p className="text-sm">כל המשימות הושלמו!</p>
                </div>
              ) : (
                feed.map((task, idx) => {
                  const lc = task._loadColor || LOAD_COLORS[0];
                  return (
                    <motion.div
                      key={task.id || idx}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className="flex items-center gap-2 p-2.5 rounded-lg border border-gray-100 hover:shadow-md cursor-pointer bg-white"
                      style={{ borderRight: `4px solid ${lc.color}` }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold truncate">{task.title}</span>
                          {task.client_name && (
                            <span className="text-[10px] text-gray-400">• {task.client_name}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-[9px] px-1 h-4" style={{ borderColor: lc.color, color: lc.color }}>
                            {lc.label}
                          </Badge>
                          <span className="text-[10px] text-gray-400">{task._duration} דק׳</span>
                          <span className="text-[10px] font-medium" style={{ color: lc.color }}>{task._priority}</span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
