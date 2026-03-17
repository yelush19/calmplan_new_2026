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
import DesignCanvas from '@/components/canvas/DesignCanvas';
import AyoaViewToggle from '@/components/canvas/AyoaViewToggle';
import AyoaRadialView from '@/components/canvas/AyoaRadialView';
import AyoaMapView from '@/components/canvas/AyoaMapView';
import AyoaFeedView from '@/components/canvas/AyoaFeedView';
import AyoaWorkflowView from '@/components/canvas/AyoaWorkflowView';
import ProcessTreeFocusMap from '@/components/canvas/ProcessTreeFocusMap';
import { useAyoaView } from '@/contexts/AyoaViewContext';
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
  const { ayoaView: viewMode, setAyoaView: setViewMode } = useAyoaView();

  useEffect(() => { loadData(); }, []);
  useRealtimeRefresh(() => { loadData(); }, ['tasks', 'clients']);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [tasksData, clientsData] = await Promise.all([
        Task.list(null, 5000).catch(() => []),
        Client.list(null, 1000).catch(() => []),
      ]);
      const raw = Array.isArray(tasksData) ? tasksData : [];
      const treeTasks = getActiveTreeTasks(raw);
      // DATA SURVIVAL: never show empty if raw has data
      setTasks(treeTasks.length > 0 ? treeTasks : raw);
      setClients(Array.isArray(clientsData) ? clientsData : []);
    } catch (err) {
      console.error('MyFocus load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const energy = getEnergyProfile();
  const EnergyIcon = energy.icon;

  // Active tasks for focus view: overdue + due today + upcoming this month + tasks without dates
  const todayTasks = useMemo(() => {
    const now = new Date();
    const monthEnd = format(new Date(now.getFullYear(), now.getMonth() + 1, 0), 'yyyy-MM-dd');
    return tasks.filter(t =>
      t.status !== 'production_completed' &&
      (!t.due_date || t.due_date <= monthEnd)
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


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <Brain className="w-8 h-8 text-[#4682B4] animate-pulse" />
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
            <div className="text-[12px] text-gray-400">{format(new Date(), 'EEEE, d בMMMM', { locale: he })}</div>
          </div>
        </div>

        <div className="w-px h-8 bg-gray-200" />

        {/* KPI Summary */}
        <div className="flex items-center gap-3">
          <div className="text-center">
            <div className="text-lg font-bold text-[#4682B4]">{todayTasks.length}</div>
            <div className="text-[12px] text-gray-400">משימות</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold" style={{ color: kpis.efficiencyScore >= 50 ? '#2E7D32' : '#F57C00' }}>
              {kpis.efficiencyScore}%
            </div>
            <div className="text-[12px] text-gray-400">יעילות</div>
          </div>
          <div className="flex items-center gap-1">
            {[3, 2, 1, 0].map(tier => {
              const count = kpis.cognitiveLoadMix[tier] || 0;
              if (!count) return null;
              const lc = LOAD_COLORS[tier];
              return (
                <div key={tier} className="flex items-center gap-0.5">
                  <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: lc.color }} />
                  <span className="text-[12px] font-bold" style={{ color: lc.color }}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex-1" />

        {/* View Toggle: all AYOA views + canvas */}
        <AyoaViewToggle
          value={viewMode === 'canvas' ? null : viewMode}
          onChange={(v) => setViewMode(v)}
          accentColor="#FF9800"
        />
        <button
          onClick={() => setViewMode(viewMode === 'canvas' ? 'radial' : 'canvas')}
          className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all ${
            viewMode === 'canvas' ? 'bg-[#6366F1]/10 text-[#6366F1] font-bold shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-white/60'
          }`}
        >
          🎨 קנבס
        </button>
      </div>

      {/* ── Energy Suggestions Strip ── */}
      {energySuggestions.length > 0 && (
        <div className="flex items-center gap-2 bg-white rounded-xl border px-3 py-2 overflow-x-auto">
          <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="text-[12px] text-gray-500 shrink-0 font-medium">מומלץ עכשיו:</span>
          {energySuggestions.map(task => {
            const lc = LOAD_COLORS[task._load] || LOAD_COLORS[0];
            return (
              <div key={task.id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg border shrink-0"
                style={{ borderColor: lc.color + '40' }}>
                <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: lc.color }} />
                <span className="text-[12px] font-medium truncate max-w-[120px]">{task.title}</span>
                <span className="text-[12px] text-gray-400">{task._duration}דק׳</span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Main View ── */}
      <div className="flex-1 min-h-0">
        {viewMode === 'canvas' ? (
          <Card className="h-full">
            <CardContent className="h-full p-0">
              <DesignCanvas tasks={todayTasks} clients={clients} />
            </CardContent>
          </Card>
        ) : viewMode === 'radial' ? (
          <div className="h-full rounded-2xl overflow-hidden border border-gray-100 bg-white" style={{ minHeight: '450px' }}>
            <AyoaRadialView tasks={todayTasks} centerLabel="הפוקוס שלי" centerSub={`${todayTasks.length} משימות`} />
          </div>
        ) : viewMode === 'map' ? (
          <div className="h-full rounded-2xl overflow-hidden border border-gray-100 bg-white" style={{ minHeight: '450px' }}>
            <AyoaMapView tasks={todayTasks} centerLabel="הפוקוס שלי" centerSub={`${todayTasks.length} משימות`} />
          </div>
        ) : viewMode === 'gantt' ? (
          <Card className="h-full overflow-auto">
            <CardContent className="p-2">
              <GanttView tasks={todayTasks} clients={clients} />
            </CardContent>
          </Card>
        ) : viewMode === 'feed' ? (
          <div className="h-full">
            <AyoaFeedView tasks={todayTasks} />
          </div>
        ) : viewMode === 'focus' ? (
          <div className="h-full rounded-2xl overflow-hidden border border-amber-100" style={{ minHeight: '450px', background: 'linear-gradient(180deg, #FFFDE7 0%, #FFFFFF 100%)' }}>
            <ProcessTreeFocusMap tasks={todayTasks} clients={clients} centerLabel="הפוקוס שלי" />
          </div>
        ) : viewMode === 'workflow' ? (
          <div className="h-full rounded-2xl overflow-hidden border border-gray-100 bg-white" style={{ minHeight: '450px' }}>
            <AyoaWorkflowView tasks={todayTasks} />
          </div>
        ) : (
          /* fallback: show radial as default view */
          <div className="h-full rounded-2xl overflow-hidden border border-gray-100 bg-white" style={{ minHeight: '450px' }}>
            <AyoaRadialView tasks={todayTasks} centerLabel="הפוקוס שלי" centerSub={`${todayTasks.length} משימות`} />
          </div>
        )}
      </div>
    </div>
  );
}
