import React, { useState, useEffect } from 'react';
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
  FolderKanban, X, Check, Database
} from 'lucide-react';

const statusOptions = [
  { value: 'planning', label: 'תכנון', color: 'bg-gray-200 text-gray-800' },
  { value: 'in_development', label: 'בפיתוח', color: 'bg-blue-200 text-blue-800' },
  { value: 'testing', label: 'בדיקות', color: 'bg-yellow-200 text-yellow-800' },
  { value: 'deployed', label: 'באוויר', color: 'bg-green-200 text-green-800' },
  { value: 'maintenance', label: 'תחזוקה', color: 'bg-purple-200 text-purple-800' },
  { value: 'archived', label: 'ארכיון', color: 'bg-gray-300 text-gray-600' },
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

const emptyProject = {
  name: '',
  description: '',
  status: 'planning',
  system_type: 'web_app',
  git_repo: '',
  vercel_url: '',
  supabase_url: '',
  subdomain: '',
  production_url: '',
  tech_stack: '',
  notes: '',
};

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingProject, setEditingProject] = useState(null);
  const [formData, setFormData] = useState({ ...emptyProject });
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const data = await Project.list(null, 500);
      setProjects(data);
    } catch (e) {
      console.error('Failed to load projects:', e);
    }
    setLoading(false);
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

  const handleDelete = async (id) => {
    if (!window.confirm('למחוק את הפרויקט?')) return;
    try {
      await Project.delete(id);
      await loadProjects();
    } catch (e) {
      console.error('Failed to delete project:', e);
    }
  };

  const startEdit = (project) => {
    setEditingProject(project);
    setFormData({
      name: project.name || '',
      description: project.description || '',
      status: project.status || 'planning',
      system_type: project.system_type || 'web_app',
      git_repo: project.git_repo || '',
      vercel_url: project.vercel_url || '',
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
    setIsCreating(true);
  };

  const cancelEdit = () => {
    setEditingProject(null);
    setIsCreating(false);
    setFormData({ ...emptyProject });
  };

  const getStatusConfig = (status) =>
    statusOptions.find(s => s.value === status) || statusOptions[0];

  const getSystemTypeLabel = (type) =>
    systemTypes.find(s => s.value === type)?.label || type;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">פרויקטים</h1>
        {!isCreating && (
          <Button onClick={startCreate} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            פרויקט חדש
          </Button>
        )}
      </div>

      {/* Create/Edit Form */}
      {isCreating && (
        <Card className="border-2 border-primary/30">
          <CardHeader>
            <CardTitle>{editingProject ? `עריכת פרויקט: ${editingProject.name}` : 'פרויקט חדש'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>שם הפרויקט</Label>
                <Input value={formData.name} onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))} placeholder="שם הפרויקט" />
              </div>
              <div>
                <Label>סוג מערכת</Label>
                <Select value={formData.system_type} onValueChange={(v) => setFormData(p => ({ ...p, system_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {systemTypes.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>סטטוס</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData(p => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {statusOptions.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>טכנולוגיות (Tech Stack)</Label>
                <Input value={formData.tech_stack} onChange={(e) => setFormData(p => ({ ...p, tech_stack: e.target.value }))} placeholder="React, Node.js, Supabase..." />
              </div>
            </div>

            <div>
              <Label>תיאור</Label>
              <Textarea value={formData.description} onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))} placeholder="תיאור קצר של הפרויקט" rows={2} />
            </div>

            <div className="border-t pt-4">
              <h4 className="font-semibold mb-3">פרטי פריסה ותשתית</h4>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label className="flex items-center gap-1"><GitBranch className="w-4 h-4" /> Git Repository</Label>
                  <Input value={formData.git_repo} onChange={(e) => setFormData(p => ({ ...p, git_repo: e.target.value }))} placeholder="https://github.com/user/repo" dir="ltr" />
                </div>
                <div>
                  <Label className="flex items-center gap-1"><Server className="w-4 h-4" /> Vercel URL</Label>
                  <Input value={formData.vercel_url} onChange={(e) => setFormData(p => ({ ...p, vercel_url: e.target.value }))} placeholder="https://project.vercel.app" dir="ltr" />
                </div>
                <div>
                  <Label className="flex items-center gap-1"><Database className="w-4 h-4" /> Supabase URL</Label>
                  <Input value={formData.supabase_url} onChange={(e) => setFormData(p => ({ ...p, supabase_url: e.target.value }))} placeholder="https://xxxxx.supabase.co" dir="ltr" />
                </div>
                <div>
                  <Label className="flex items-center gap-1"><Globe className="w-4 h-4" /> Subdomain</Label>
                  <Input value={formData.subdomain} onChange={(e) => setFormData(p => ({ ...p, subdomain: e.target.value }))} placeholder="app.example.com" dir="ltr" />
                </div>
                <div>
                  <Label className="flex items-center gap-1"><ExternalLink className="w-4 h-4" /> Production URL</Label>
                  <Input value={formData.production_url} onChange={(e) => setFormData(p => ({ ...p, production_url: e.target.value }))} placeholder="https://www.example.com" dir="ltr" />
                </div>
              </div>
            </div>

            <div>
              <Label>הערות</Label>
              <Textarea value={formData.notes} onChange={(e) => setFormData(p => ({ ...p, notes: e.target.value }))} placeholder="הערות נוספות..." rows={2} />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={cancelEdit} className="flex items-center gap-1">
                <X className="w-4 h-4" /> ביטול
              </Button>
              <Button onClick={handleSave} disabled={!formData.name} className="flex items-center gap-1">
                <Check className="w-4 h-4" /> {editingProject ? 'עדכן' : 'צור פרויקט'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Projects Grid */}
      {projects.length === 0 && !isCreating ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <FolderKanban className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg">אין פרויקטים עדיין</p>
            <p className="text-sm">לחצי על "פרויקט חדש" כדי להתחיל</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => {
            const statusConf = getStatusConfig(project.status);
            return (
              <Card key={project.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{project.name}</CardTitle>
                      <Badge className={`mt-1 ${statusConf.color}`}>{statusConf.label}</Badge>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => startEdit(project)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(project.id)} className="text-red-500 hover:text-red-700">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FolderKanban className="w-4 h-4" />
                    {getSystemTypeLabel(project.system_type)}
                  </div>

                  {project.description && (
                    <p className="text-sm text-muted-foreground">{project.description}</p>
                  )}

                  {project.tech_stack && (
                    <div className="flex flex-wrap gap-1">
                      {project.tech_stack.split(',').map((tech, i) => (
                        <Badge key={i} variant="outline" className="text-xs">{tech.trim()}</Badge>
                      ))}
                    </div>
                  )}

                  <div className="border-t pt-2 space-y-1 text-xs" dir="ltr">
                    {project.git_repo && (
                      <a href={project.git_repo} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline">
                        <GitBranch className="w-3 h-3" /> {project.git_repo.replace('https://github.com/', '')}
                      </a>
                    )}
                    {project.vercel_url && (
                      <a href={project.vercel_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline">
                        <Server className="w-3 h-3" /> {project.vercel_url.replace('https://', '')}
                      </a>
                    )}
                    {project.supabase_url && (
                      <a href={project.supabase_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-green-600 hover:underline">
                        <Database className="w-3 h-3" /> {project.supabase_url.replace('https://', '')}
                      </a>
                    )}
                    {project.subdomain && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Globe className="w-3 h-3" /> {project.subdomain}
                      </div>
                    )}
                    {project.production_url && (
                      <a href={project.production_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline">
                        <ExternalLink className="w-3 h-3" /> {project.production_url.replace('https://', '')}
                      </a>
                    )}
                  </div>

                  {project.notes && (
                    <p className="text-xs text-muted-foreground border-t pt-2">{project.notes}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
