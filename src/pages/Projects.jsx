import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Project } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Plus, Pencil, Trash2, ExternalLink, GitBranch, Globe, Server,
  FolderKanban, X, Check, Database, BarChart3, HardDrive, TrainFront,
  ChevronDown, ChevronUp, Cpu, Layers, Rocket, BookOpen, Undo2, Settings2
} from 'lucide-react';
import { loadPlatformConfig } from '@/config/platformConfig';
import ProjectTimelineView from '@/components/dashboard/ProjectTimelineView';
import ProjectAyoaMindMap from '@/components/canvas/ProjectAyoaMindMap';

/* ── DNA Color ── */
const ACCENT = '#7C3AED';

/* ── Status pipeline ── */
const statusOptions = [
  { value: 'planning',       label: 'תכנון',    color: 'bg-slate-100 text-slate-700',  accent: '#94A3B8', icon: '📋' },
  { value: 'in_development', label: 'בפיתוח',   color: 'bg-blue-100 text-blue-700',    accent: '#3B82F6', icon: '🔨' },
  { value: 'testing',        label: 'בדיקות',   color: 'bg-teal-100 text-teal-700',    accent: '#0D9488', icon: '🧪' },
  { value: 'deployed',       label: 'באוויר',   color: 'bg-emerald-100 text-emerald-700', accent: '#10B981', icon: '🚀' },
  { value: 'maintenance',    label: 'תחזוקה',   color: 'bg-purple-100 text-purple-700', accent: '#8B5CF6', icon: '🔧' },
  { value: 'archived',       label: 'ארכיון',   color: 'bg-gray-200 text-gray-500',    accent: '#9CA3AF', icon: '📦' },
];

const systemTypes = [
  { value: 'web_app', label: 'אפליקציית ווב' },
  { value: 'mobile_app', label: 'אפליקציית מובייל' },
  { value: 'api', label: 'API / Backend' },
  { value: 'landing_page', label: 'דף נחיתה' },
  { value: 'ecommerce', label: 'חנות אונליין' },
  { value: 'crm', label: 'מערכת CRM' },
  { value: 'internal_tool', label: 'כלי פנימי' },
  { value: 'other', label: 'אחר' },
];

const PLATFORM_ICONS = {
  server: Server,
  'bar-chart': BarChart3,
  globe: Globe,
  'hard-drive': HardDrive,
  'train-front': TrainFront,
};

function getPlatformIcon(iconName) {
  return PLATFORM_ICONS[iconName] || Server;
}

const emptyProject = {
  name: '', description: '', status: 'planning', system_type: 'web_app',
  platform: '', platform_data: {}, git_repo: '', supabase_url: '',
  subdomain: '', production_url: '', tech_stack: '', notes: '',
  client_ids: [],  // Link to specific clients (empty = global tool)
};

/* ── Redesign Seed Data ── */
const REDESIGN_SEED_KEY = 'calmplan_redesign_seeded';
const REDESIGN_CARDS = [
  { name: 'עמוד הבית — Home', description: 'באנר, KPI, תצוגת AYOA, שעון ביולוגי, פתקים', status: 'in_development', system_type: 'web_app', tech_stack: 'React, FocusMapView, BioClock', notes: 'P1 priority — UX feedback received' },
  { name: 'P1 — שכר ומשכורות', description: 'עמוד שכר — סקירת UX טרם בוצעה', status: 'planning', system_type: 'web_app', tech_stack: 'React', notes: 'ממתין לסקירה' },
  { name: 'P2 — הנהלת חשבונות', description: 'עמוד הנה"ח — סקירת UX טרם בוצעה', status: 'planning', system_type: 'web_app', tech_stack: 'React', notes: 'ממתין לסקירה' },
  { name: 'P3 — מרכז לקוחות', description: 'Hub — סקירת UX טרם בוצעה', status: 'planning', system_type: 'web_app', tech_stack: 'React', notes: 'ממתין לסקירה' },
  { name: 'P4 — בית ואישי', description: 'אזור אישי — סקירת UX טרם בוצעה', status: 'planning', system_type: 'web_app', tech_stack: 'React', notes: 'ממתין לסקירה' },
  { name: 'P5 — שנתי', description: 'עמוד שנתי — סקירת UX טרם בוצעה', status: 'planning', system_type: 'web_app', tech_stack: 'React', notes: 'ממתין לסקירה' },
  { name: 'P6 — פרויקטים', description: 'עמוד זה — תצוגת AYOA, ניווט ADHD, צבעים רגועים', status: 'in_development', system_type: 'web_app', tech_stack: 'React, UnifiedAyoaLayout', notes: 'בעבודה כעת' },
  { name: 'Layout ותפריט', description: 'סרגל צד, header, לוגו LITAY, סלוגן', status: 'deployed', system_type: 'web_app', tech_stack: 'React', notes: 'שינויים בוצעו — לוגו + צבעים' },
];

async function seedRedesignProject() {
  if (localStorage.getItem(REDESIGN_SEED_KEY)) return false;
  try {
    const existing = await Project.list(null, 500);
    const hasRedesign = existing.some(p => p.name && p.name.includes('עמוד הבית — Home'));
    if (hasRedesign) {
      localStorage.setItem(REDESIGN_SEED_KEY, 'true');
      return false;
    }
    for (const card of REDESIGN_CARDS) {
      await Project.create(card);
    }
    localStorage.setItem(REDESIGN_SEED_KEY, 'true');
    return true;
  } catch (e) {
    console.error('Failed to seed redesign projects:', e);
    return false;
  }
}

/* ── Animations ── */
const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: (i) => ({
    opacity: 1, y: 0, scale: 1,
    transition: { delay: i * 0.04, type: 'spring', stiffness: 260, damping: 24 },
  }),
};

const groupVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.03 } },
};

/* ────────────────────────────────────────────── */
/*  Undo Toast — replaces window.confirm          */
/* ────────────────────────────────────────────── */
function UndoToast({ message, onUndo, onExpire }) {
  const [remaining, setRemaining] = useState(5);
  const timerRef = useRef(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          onExpire();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [onExpire]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 40 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-lg border border-slate-200 bg-white"
    >
      <span className="text-sm text-slate-700 font-medium">{message}</span>
      <span className="text-xs text-slate-400">{remaining}s</span>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          clearInterval(timerRef.current);
          onUndo();
        }}
        className="flex items-center gap-1.5 rounded-xl text-violet-600 border-violet-200 hover:bg-violet-50"
      >
        <Undo2 className="w-3.5 h-3.5" />
        ביטול מחיקה
      </Button>
    </motion.div>
  );
}

/* ────────────────────────────────────────────── */
/*  Quick Status Picker — inline on card          */
/* ────────────────────────────────────────────── */
function QuickStatusPicker({ currentStatus, statusConf, onChangeStatus }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold cursor-pointer transition-all hover:ring-2 hover:ring-offset-1"
        style={{
          background: `${statusConf.accent}18`,
          color: statusConf.accent,
          border: `1px solid ${statusConf.accent}30`,
          '--tw-ring-color': `${statusConf.accent}40`,
        }}
      >
        {statusConf.icon} {statusConf.label}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -4 }}
            className="absolute top-full mt-1 right-0 z-30 bg-white border border-gray-100 rounded-2xl shadow-lg p-1.5 min-w-[140px]"
            onClick={(e) => e.stopPropagation()}
          >
            {statusOptions.map(s => (
              <button
                key={s.value}
                onClick={() => { onChangeStatus(s.value); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors text-right ${
                  s.value === currentStatus ? 'bg-gray-50 font-bold' : 'hover:bg-gray-50'
                }`}
                style={{ color: s.accent }}
              >
                <span>{s.icon}</span>
                {s.label}
                {s.value === currentStatus && <Check className="w-3 h-3 mr-auto" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ────────────────────────────────────────────── */
/*  Project Card Component                        */
/* ────────────────────────────────────────────── */
function ProjectCard({ project, statusConf, platform, platforms, onEdit, onDelete, onOpenWorkbook, onQuickStatus }) {
  const PlatIcon = platform ? getPlatformIcon(platform.icon) : null;
  const getSystemTypeLabel = (type) => systemTypes.find(s => s.value === type)?.label || type;

  return (
    <motion.div
      variants={cardVariants}
      whileHover={{ y: -4, boxShadow: `0 12px 32px ${ACCENT}18` }}
      className="group"
    >
      <div
        onClick={() => onOpenWorkbook(project)}
        className="relative rounded-[32px] bg-white border border-gray-100 overflow-hidden transition-all duration-300 cursor-pointer"
        style={{ boxShadow: `0 4px 20px ${ACCENT}10, 0 1px 3px rgba(0,0,0,0.04)` }}
      >
        {/* Top accent stripe */}
        <div
          className="h-1 w-full"
          style={{ background: `linear-gradient(90deg, ${statusConf.accent}, ${ACCENT}60)` }}
        />

        <div className="p-5">
          {/* Header row */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-gray-900 truncate">{project.name}</h3>
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <QuickStatusPicker
                  currentStatus={project.status || 'planning'}
                  statusConf={statusConf}
                  onChangeStatus={(newStatus) => onQuickStatus(project.id, newStatus)}
                />
                {platform && (
                  <Badge
                    className="text-[11px] px-2 py-0.5 rounded-full gap-1"
                    style={{ background: '#F1F5F9', color: '#475569' }}
                  >
                    {PlatIcon && <PlatIcon className="w-3 h-3" />}
                    {platform.name}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => { e.stopPropagation(); onEdit(project); }}
                className="p-1.5 h-7 w-7 rounded-xl hover:bg-purple-50 text-gray-400 hover:text-purple-600 transition-colors"
                title="עריכה"
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => { e.stopPropagation(); onDelete(project.id); }}
                className="p-1.5 h-7 w-7 rounded-xl hover:bg-slate-50 text-gray-400 hover:text-slate-500 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* System type */}
          <div className="flex items-center gap-2 text-[12px] text-gray-500 mb-2">
            <Cpu className="w-3.5 h-3.5" />
            {getSystemTypeLabel(project.system_type)}
          </div>

          {/* Description */}
          {project.description && (
            <p className="text-[12px] text-gray-500 leading-relaxed mb-3 line-clamp-2">
              {project.description}
            </p>
          )}

          {/* Tech Stack */}
          {project.tech_stack && (
            <div className="flex flex-wrap gap-1 mb-3">
              {project.tech_stack.split(',').map((tech, i) => (
                <span
                  key={i}
                  className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                  style={{ background: `${ACCENT}10`, color: ACCENT }}
                >
                  {tech.trim()}
                </span>
              ))}
            </div>
          )}

          {/* Platform-specific fields */}
          {platform && project.platform_data && Object.keys(project.platform_data).some(k => project.platform_data[k]) && (
            <div className="rounded-2xl p-2.5 space-y-1 text-[11px] bg-gray-50/80 border border-gray-100 mb-3" dir="ltr">
              {platform.fields.map(field => {
                const val = project.platform_data?.[field.key];
                if (!val) return null;
                return field.type === 'url' ? (
                  <a key={field.key} href={val} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-purple-600 hover:text-purple-800 hover:underline transition-colors">
                    {PlatIcon && <PlatIcon className="w-3 h-3" />}
                    <span className="truncate">{val.replace('https://', '')}</span>
                  </a>
                ) : (
                  <div key={field.key} className="flex items-center gap-1 text-gray-500">
                    <span className="text-gray-400">{field.label}:</span> {val}
                  </div>
                );
              })}
            </div>
          )}

          {/* Links row */}
          {(project.git_repo || project.production_url || project.supabase_url || project.subdomain) && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
              {project.production_url && (
                <a
                  href={project.production_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full font-medium transition-colors"
                  style={{ background: `${ACCENT}10`, color: ACCENT }}
                >
                  <Rocket className="w-3 h-3" />
                  Production
                </a>
              )}
              {project.git_repo && (
                <a
                  href={project.git_repo}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors font-medium"
                >
                  <GitBranch className="w-3 h-3" />
                  Git
                </a>
              )}
              {project.supabase_url && (
                <a
                  href={project.supabase_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors font-medium"
                >
                  <Database className="w-3 h-3" />
                  DB
                </a>
              )}
              {project.subdomain && (
                <span className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 font-medium">
                  <Globe className="w-3 h-3" />
                  {project.subdomain}
                </span>
              )}
            </div>
          )}

          {project.notes && (
            <p className="text-[11px] text-gray-400 mt-2 pt-2 border-t border-gray-100 line-clamp-1">
              {project.notes}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ────────────────────────────────────────────── */
/*  Main Projects Page                            */
/* ────────────────────────────────────────────── */
export default function Projects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingProject, setEditingProject] = useState(null);
  const [formData, setFormData] = useState({ ...emptyProject });
  const [isCreating, setIsCreating] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [platforms, setPlatforms] = useState([]);
  const [collapsedGroups, setCollapsedGroups] = useState(() => {
    // Only collapse 'archived' by default — show active projects immediately (ADHD-friendly)
    return { archived: true };
  });
  const [allExpanded, setAllExpanded] = useState(true);
  const [pendingDelete, setPendingDelete] = useState(null); // { id, name, backup }

  useEffect(() => {
    loadProjects();
    loadPlatforms();
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const seeded = await seedRedesignProject();
      const data = await Project.list(null, 500);
      setProjects(data);
    } catch (e) {
      console.error('Failed to load projects:', e);
    }
    setLoading(false);
  };

  const loadPlatforms = async () => {
    try {
      const { platforms: loaded } = await loadPlatformConfig();
      setPlatforms(loaded.filter(p => p.enabled));
    } catch (e) {
      console.error('Failed to load platforms:', e);
    }
  };

  const handleSave = async () => {
    try {
      if (editingProject) {
        await Project.update(editingProject.id, formData);
      } else {
        await Project.create(formData);
      }
      setEditingProject(null);
      setIsCreating(false);
      setFormData({ ...emptyProject });
      await loadProjects();
    } catch (e) {
      console.error('Failed to save project:', e);
    }
  };

  const handleDelete = useCallback((id) => {
    const project = projects.find(p => p.id === id);
    if (!project) return;
    // Soft-delete: hide from UI immediately, actually delete after 5s unless undone
    setPendingDelete({ id, name: project.name, backup: { ...project } });
    setProjects(prev => prev.filter(p => p.id !== id));
  }, [projects]);

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    try {
      await Project.delete(pendingDelete.id);
    } catch (e) {
      console.error('Failed to delete project:', e);
    }
    setPendingDelete(null);
  }, [pendingDelete]);

  const undoDelete = useCallback(() => {
    if (!pendingDelete) return;
    // Restore the project in the list
    setProjects(prev => [...prev, pendingDelete.backup]);
    setPendingDelete(null);
  }, [pendingDelete]);

  const handleQuickStatus = useCallback(async (projectId, newStatus) => {
    try {
      await Project.update(projectId, { status: newStatus });
      setProjects(prev => prev.map(p =>
        p.id === projectId ? { ...p, status: newStatus } : p
      ));
    } catch (e) {
      console.error('Failed to update status:', e);
    }
  }, []);

  const startEdit = (project) => {
    setEditingProject(project);
    setFormData({
      name: project.name || '',
      description: project.description || '',
      status: project.status || 'planning',
      system_type: project.system_type || 'web_app',
      platform: project.platform || '',
      platform_data: project.platform_data || {},
      git_repo: project.git_repo || '',
      supabase_url: project.supabase_url || '',
      subdomain: project.subdomain || '',
      production_url: project.production_url || '',
      tech_stack: project.tech_stack || '',
      notes: project.notes || '',
    });
    setIsCreating(true);
  };

  const startCreate = () => {
    setEditingProject(null);
    setFormData({ ...emptyProject });
    setShowAdvanced(false);
    setIsCreating(true);
  };

  const cancelEdit = () => {
    setEditingProject(null);
    setIsCreating(false);
    setShowAdvanced(false);
    setFormData({ ...emptyProject });
  };

  const getStatusConfig = (status) =>
    statusOptions.find(s => s.value === status) || statusOptions[0];

  const selectedPlatform = platforms.find(p => p.id === formData.platform);

  const updatePlatformField = (fieldKey, value) => {
    setFormData(prev => ({
      ...prev,
      platform_data: { ...prev.platform_data, [fieldKey]: value },
    }));
  };

  const getPlatformForProject = (project) =>
    platforms.find(p => p.id === project.platform) || null;

  const openWorkbook = (project) => {
    navigate(`/ProjectWorkbook?projectId=${project.id}`);
  };

  /* ── Pseudo-tasks for Ayoa views ── */
  const pseudoTasks = useMemo(() =>
    projects.map(p => ({
      id: p.id,
      title: p.name || p.title || 'פרויקט',
      category: getStatusConfig(p.status)?.label || 'תכנון',
      status: p.status === 'deployed' ? 'production_completed'
        : p.status === 'in_development' ? 'not_started'
        : p.status === 'testing' ? 'not_started'
        : 'not_started',
      due_date: p.deadline || p.due_date,
      scheduled_start: p.created_date,
    })), [projects]);

  /* ── Status pipeline summary ── */
  const statusCounts = useMemo(() => {
    const counts = {};
    statusOptions.forEach(s => { counts[s.value] = 0; });
    projects.forEach(p => {
      const key = p.status || 'planning';
      if (counts[key] !== undefined) counts[key]++;
    });
    return counts;
  }, [projects]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-t-transparent" style={{ borderColor: `${ACCENT}40`, borderTopColor: 'transparent' }} />
        <span className="text-sm font-medium text-gray-500">טוען פרויקטים...</span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 p-1"
    >
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-xl font-bold text-[#1E3A5F]"
          >
            פרויקטים
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">ניהול וצפייה בכל הפרויקטים שלך</p>
        </div>
        {!isCreating && (
          <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
            <Button
              onClick={startCreate}
              className="flex items-center gap-2 rounded-2xl px-5 py-2.5 text-white shadow-lg font-semibold"
              style={{
                background: `linear-gradient(135deg, ${ACCENT}, #6D28D9)`,
                boxShadow: `0 6px 20px ${ACCENT}40`,
              }}
            >
              <Plus className="w-4 h-4" />
              פרויקט חדש
            </Button>
          </motion.div>
        )}
      </div>

      {/* ── Status Pipeline Bar ── */}
      {projects.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-center gap-2 overflow-x-auto pb-1"
        >
          {statusOptions.filter(s => s.value !== 'archived').map((s) => (
            <div
              key={s.value}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-[12px] font-semibold whitespace-nowrap transition-all"
              style={{
                background: statusCounts[s.value] > 0 ? `${s.accent}15` : '#F8FAFC',
                color: statusCounts[s.value] > 0 ? s.accent : '#94A3B8',
                border: `1px solid ${statusCounts[s.value] > 0 ? `${s.accent}30` : '#E2E8F0'}`,
              }}
            >
              <span>{s.icon}</span>
              {s.label}
              <span
                className="px-1.5 py-0.5 rounded-full text-[10px] font-bold min-w-[18px] text-center"
                style={{
                  background: statusCounts[s.value] > 0 ? `${s.accent}20` : '#F1F5F9',
                  color: statusCounts[s.value] > 0 ? s.accent : '#94A3B8',
                }}
              >
                {statusCounts[s.value]}
              </span>
            </div>
          ))}
        </motion.div>
      )}

      {/* ── Create/Edit Form ── */}
      <AnimatePresence>
        {isCreating && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <Card
              className="rounded-[32px] border-2 overflow-hidden"
              style={{
                borderColor: `${ACCENT}30`,
                boxShadow: `0 8px 32px ${ACCENT}12`,
              }}
            >
              <CardHeader
                className="pb-3"
                style={{ background: `linear-gradient(135deg, ${ACCENT}08, ${ACCENT}04)` }}
              >
                <CardTitle className="text-lg" style={{ color: ACCENT }}>
                  {editingProject ? `עריכת: ${editingProject.name}` : 'פרויקט חדש'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                {/* ── Essential fields (always visible) ── */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>שם הפרויקט</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                      placeholder="שם הפרויקט"
                      className="rounded-xl"
                      autoFocus
                    />
                  </div>
                  <div>
                    <Label>סטטוס</Label>
                    <Select value={formData.status} onValueChange={(v) => setFormData(p => ({ ...p, status: v }))}>
                      <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {statusOptions.map(s => (
                          <SelectItem key={s.value} value={s.value}>{s.icon} {s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>תיאור</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
                    placeholder="תיאור קצר של הפרויקט"
                    rows={2}
                    className="rounded-xl"
                  />
                </div>

                {/* ── "More details" toggle ── */}
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  {showAdvanced ? 'הסתר פרטים נוספים' : 'עוד פרטים (טכנולוגיות, לינקים, פלטפורמה...)'}
                  <ChevronDown className={`w-3 h-3 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {showAdvanced && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-4 overflow-hidden"
                    >
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <Label>סוג מערכת</Label>
                          <Select value={formData.system_type} onValueChange={(v) => setFormData(p => ({ ...p, system_type: v }))}>
                            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {systemTypes.map(t => (
                                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>טכנולוגיות (Tech Stack)</Label>
                          <Input
                            value={formData.tech_stack}
                            onChange={(e) => setFormData(p => ({ ...p, tech_stack: e.target.value }))}
                            placeholder="React, Node.js, Supabase..."
                            className="rounded-xl"
                          />
                        </div>
                      </div>

                      {/* Platform Section */}
                      <div className="border-t pt-4">
                        <h4 className="font-semibold mb-3 text-sm">פלטפורמת הרצה</h4>
                        <div className="flex flex-wrap gap-2 mb-4">
                          <Badge
                            variant={!formData.platform ? 'default' : 'outline'}
                            className="cursor-pointer px-3 py-1.5 text-sm rounded-xl"
                            onClick={() => setFormData(p => ({ ...p, platform: '', platform_data: {} }))}
                          >
                            ללא
                          </Badge>
                          {platforms.map(plat => {
                            const Icon = getPlatformIcon(plat.icon);
                            const isActive = formData.platform === plat.id;
                            return (
                              <Badge
                                key={plat.id}
                                variant={isActive ? 'default' : 'outline'}
                                className={`cursor-pointer px-3 py-1.5 text-sm gap-1.5 rounded-xl ${isActive ? plat.color : 'hover:bg-gray-100'}`}
                                onClick={() => setFormData(p => ({ ...p, platform: plat.id, platform_data: isActive ? p.platform_data : {} }))}
                              >
                                <Icon className="w-3.5 h-3.5" />
                                {plat.name}
                              </Badge>
                            );
                          })}
                        </div>

                        {selectedPlatform && selectedPlatform.fields.length > 0 && (
                          <div className="grid md:grid-cols-2 gap-4 p-3 bg-gray-50 rounded-2xl border">
                            {selectedPlatform.fields.map(field => (
                              <div key={field.key}>
                                <Label className="text-xs">{field.label}</Label>
                                <Input
                                  value={formData.platform_data?.[field.key] || ''}
                                  onChange={(e) => updatePlatformField(field.key, e.target.value)}
                                  placeholder={field.placeholder}
                                  dir="ltr"
                                  className="text-sm rounded-xl"
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Infrastructure */}
                      <div className="border-t pt-4">
                        <h4 className="font-semibold mb-3 text-sm">תשתית ולינקים</h4>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <Label className="flex items-center gap-1"><GitBranch className="w-4 h-4" /> Git Repository</Label>
                            <Input value={formData.git_repo} onChange={(e) => setFormData(p => ({ ...p, git_repo: e.target.value }))} placeholder="https://github.com/user/repo" dir="ltr" className="rounded-xl" />
                          </div>
                          <div>
                            <Label className="flex items-center gap-1"><Database className="w-4 h-4" /> Supabase URL</Label>
                            <Input value={formData.supabase_url} onChange={(e) => setFormData(p => ({ ...p, supabase_url: e.target.value }))} placeholder="https://xxxxx.supabase.co" dir="ltr" className="rounded-xl" />
                          </div>
                          <div>
                            <Label className="flex items-center gap-1"><Globe className="w-4 h-4" /> Subdomain</Label>
                            <Input value={formData.subdomain} onChange={(e) => setFormData(p => ({ ...p, subdomain: e.target.value }))} placeholder="app.example.com" dir="ltr" className="rounded-xl" />
                          </div>
                          <div>
                            <Label className="flex items-center gap-1"><ExternalLink className="w-4 h-4" /> Production URL</Label>
                            <Input value={formData.production_url} onChange={(e) => setFormData(p => ({ ...p, production_url: e.target.value }))} placeholder="https://www.example.com" dir="ltr" className="rounded-xl" />
                          </div>
                        </div>
                      </div>

                      <div>
                        <Label>הערות</Label>
                        <Textarea value={formData.notes} onChange={(e) => setFormData(p => ({ ...p, notes: e.target.value }))} placeholder="הערות נוספות..." rows={2} className="rounded-xl" />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={cancelEdit} className="flex items-center gap-1 rounded-xl">
                    <X className="w-4 h-4" /> ביטול
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={!formData.name}
                    className="flex items-center gap-1 rounded-xl text-white"
                    style={{ background: `linear-gradient(135deg, ${ACCENT}, #6D28D9)` }}
                  >
                    <Check className="w-4 h-4" /> {editingProject ? 'עדכן' : 'צור פרויקט'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

        {projects.length === 0 && !isCreating ? (
          /* ── Empty State ── */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-[32px] border-2 border-dashed p-16 text-center"
            style={{ borderColor: `${ACCENT}30` }}
          >
            <div
              className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${ACCENT}15, ${ACCENT}08)` }}
            >
              <FolderKanban className="w-10 h-10" style={{ color: `${ACCENT}60` }} />
            </div>
            <p className="text-lg font-bold text-gray-700">אין פרויקטים עדיין</p>
            <p className="text-sm text-gray-400 mt-1">לחצי על "פרויקט חדש" כדי להתחיל</p>
          </motion.div>
        ) : (
          <>
            {/* ── Expand/Collapse All ── */}
            <div className="flex items-center justify-end mb-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (allExpanded) {
                    const collapsed = {};
                    statusOptions.forEach(s => { collapsed[s.value] = true; });
                    setCollapsedGroups(collapsed);
                    setAllExpanded(false);
                  } else {
                    setCollapsedGroups({});
                    setAllExpanded(true);
                  }
                }}
                className="text-xs gap-1 rounded-xl"
              >
                {allExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {allExpanded ? 'כווץ הכל' : 'הרחב הכל'}
              </Button>
            </div>

            {/* ── Status Groups ── */}
            <div className="space-y-4">
              {statusOptions.map(statusOpt => {
                const groupProjects = projects.filter(p => (p.status || 'planning') === statusOpt.value);
                if (groupProjects.length === 0) return null;
                const groupKey = statusOpt.value;
                const isCollapsed = collapsedGroups[groupKey];

                return (
                  <motion.div
                    key={groupKey}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mb-1"
                  >
                    {/* Group header */}
                    <Button
                      variant="ghost"
                      onClick={() => setCollapsedGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }))}
                      className="w-full flex items-center justify-between p-3 h-auto rounded-2xl transition-all hover:shadow-sm"
                      style={{
                        background: `linear-gradient(135deg, ${statusOpt.accent}08, ${statusOpt.accent}04)`,
                        border: `1px solid ${statusOpt.accent}15`,
                      }}
                    >
                      <div className="flex items-center gap-2.5">
                        <ChevronDown
                          className="w-4 h-4 transition-transform duration-200"
                          style={{
                            color: statusOpt.accent,
                            transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                          }}
                        />
                        <span className="text-sm">{statusOpt.icon}</span>
                        <span className="font-bold text-sm" style={{ color: statusOpt.accent }}>
                          {statusOpt.label}
                        </span>
                        <span
                          className="text-[11px] px-2 py-0.5 rounded-full font-semibold"
                          style={{
                            background: `${statusOpt.accent}15`,
                            color: statusOpt.accent,
                          }}
                        >
                          {groupProjects.length}
                        </span>
                      </div>
                    </Button>

                    {/* Cards grid */}
                    <AnimatePresence>
                      {!isCollapsed && (
                        <motion.div
                          variants={groupVariants}
                          initial="hidden"
                          animate="visible"
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-2 grid md:grid-cols-2 lg:grid-cols-3 gap-4"
                        >
                          {groupProjects.map((project, idx) => (
                            <ProjectCard
                              key={project.id}
                              project={project}
                              statusConf={getStatusConfig(project.status)}
                              platform={getPlatformForProject(project)}
                              platforms={platforms}
                              onEdit={startEdit}
                              onDelete={handleDelete}
                              onOpenWorkbook={openWorkbook}
                              onQuickStatus={handleQuickStatus}
                              custom={idx}
                            />
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          </>
        )}
      {/* ── Undo Delete Toast ── */}
      <AnimatePresence>
        {pendingDelete && (
          <UndoToast
            message={`"${pendingDelete.name}" נמחק`}
            onUndo={undoDelete}
            onExpire={confirmDelete}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
