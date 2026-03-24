import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Plus, X, Pencil, Trash2, Check, Tag } from 'lucide-react';
import {
  loadTags, saveTag, deleteTag,
  TAG_SCOPES, TAG_COLORS, TAGS_CHANGED_EVENT,
} from '@/services/tagService';

// ============================================================
// TagsSettings — Settings page section for managing system tags
// ============================================================

export default function TagsSettings() {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTag, setEditingTag] = useState(null); // tag object being edited, or null
  const [isAdding, setIsAdding] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formColor, setFormColor] = useState(TAG_COLORS[0]);
  const [formScopes, setFormScopes] = useState([]);

  // Load tags on mount
  useEffect(() => {
    loadTags().then(t => { setTags(t); setLoading(false); });
    const handler = (e) => { if (e.detail?.tags) setTags(e.detail.tags); };
    window.addEventListener(TAGS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(TAGS_CHANGED_EVENT, handler);
  }, []);

  const resetForm = useCallback(() => {
    setFormName('');
    setFormColor(TAG_COLORS[0]);
    setFormScopes([]);
    setEditingTag(null);
    setIsAdding(false);
  }, []);

  const startEdit = useCallback((tag) => {
    setEditingTag(tag);
    setFormName(tag.name);
    setFormColor(tag.color);
    setFormScopes([...(tag.scope || [])]);
    setIsAdding(false);
  }, []);

  const startAdd = useCallback(() => {
    resetForm();
    setIsAdding(true);
  }, [resetForm]);

  const toggleScope = useCallback((scopeKey) => {
    setFormScopes(prev =>
      prev.includes(scopeKey) ? prev.filter(s => s !== scopeKey) : [...prev, scopeKey]
    );
  }, []);

  const handleSave = useCallback(async () => {
    if (!formName.trim() || formScopes.length === 0) return;
    const tag = {
      id: editingTag?.id,
      name: formName.trim(),
      color: formColor,
      scope: formScopes,
    };
    const updated = await saveTag(tag);
    setTags(updated);
    resetForm();
  }, [formName, formColor, formScopes, editingTag, resetForm]);

  const handleDelete = useCallback(async (id) => {
    const updated = await deleteTag(id);
    setTags(updated);
    if (editingTag?.id === id) resetForm();
  }, [editingTag, resetForm]);

  // Group tags by scope for display
  const tagsByScope = React.useMemo(() => {
    const grouped = {};
    for (const s of TAG_SCOPES) grouped[s.key] = [];
    for (const tag of tags) {
      for (const scope of (tag.scope || [])) {
        if (grouped[scope]) grouped[scope].push(tag);
      }
    }
    return grouped;
  }, [tags]);

  if (loading) {
    return (
      <Card className="bg-white rounded-2xl border shadow-sm">
        <CardContent className="p-6 text-center text-gray-400">טוען תגיות...</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header + Add button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag className="w-5 h-5 text-[#6366F1]" />
          <h2 className="text-lg font-bold text-gray-800">ניהול תגיות</h2>
          <Badge variant="secondary" className="text-xs">{tags.length} תגיות</Badge>
        </div>
        <Button size="sm" onClick={startAdd} className="gap-1 rounded-full">
          <Plus className="w-4 h-4" /> תגית חדשה
        </Button>
      </div>

      {/* Add / Edit form */}
      {(isAdding || editingTag) && (
        <Card className="bg-white rounded-2xl border-2 border-[#6366F1]/30 shadow-sm">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              {editingTag ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {editingTag ? 'עריכת תגית' : 'תגית חדשה'}
            </div>

            {/* Name */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">שם התגית</label>
              <Input
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="למשל: דחוף, VIP..."
                className="rounded-xl"
              />
            </div>

            {/* Color picker */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">צבע</label>
              <div className="flex gap-2 flex-wrap">
                {TAG_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setFormColor(c)}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${
                      formColor === c ? 'border-gray-800 scale-110 shadow-md' : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* Scope checkboxes */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">היקף (באילו ישויות תוצג)</label>
              <div className="flex gap-2 flex-wrap">
                {TAG_SCOPES.map(s => (
                  <button
                    key={s.key}
                    onClick={() => toggleScope(s.key)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                      formScopes.includes(s.key)
                        ? 'bg-[#6366F1] text-white border-[#6366F1]'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview */}
            {formName.trim() && (
              <div>
                <label className="text-xs text-gray-500 mb-1 block">תצוגה מקדימה</label>
                <Badge
                  className="text-white text-xs"
                  style={{ backgroundColor: formColor }}
                >
                  {formName.trim()}
                </Badge>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={handleSave} disabled={!formName.trim() || formScopes.length === 0} className="gap-1 rounded-full">
                <Check className="w-3.5 h-3.5" /> שמור
              </Button>
              <Button size="sm" variant="outline" onClick={resetForm} className="gap-1 rounded-full">
                <X className="w-3.5 h-3.5" /> ביטול
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tags grouped by scope */}
      {TAG_SCOPES.map(scope => {
        const scopeTags = tagsByScope[scope.key] || [];
        if (scopeTags.length === 0) return null;
        return (
          <Card key={scope.key} className="bg-white rounded-2xl border shadow-sm">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-gray-600">{scope.label}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="flex gap-2 flex-wrap">
                {scopeTags.map(tag => (
                  <div key={`${scope.key}-${tag.id}`} className="group flex items-center gap-1">
                    <Badge
                      className="text-white text-xs cursor-pointer hover:opacity-80 transition-opacity"
                      style={{ backgroundColor: tag.color }}
                      onClick={() => startEdit(tag)}
                    >
                      {tag.name}
                    </Badge>
                    <button
                      onClick={() => handleDelete(tag.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Empty state */}
      {tags.length === 0 && (
        <Card className="bg-white rounded-2xl border shadow-sm">
          <CardContent className="p-8 text-center text-gray-400">
            <Tag className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>אין תגיות עדיין. לחץ על "תגית חדשה" כדי להתחיל.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
