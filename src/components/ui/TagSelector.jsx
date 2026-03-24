import React, { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';
import { loadTags, TAGS_CHANGED_EVENT } from '@/services/tagService';

/**
 * TagSelector — Reusable component for selecting tags on any entity.
 *
 * Props:
 *   scope        {string}   - which scope to filter tags for (e.g. 'task', 'client')
 *   selectedTags {string[]} - array of selected tag IDs
 *   onChange     {function} - callback(newSelectedTagIds: string[])
 */
export default function TagSelector({ scope, selectedTags = [], onChange }) {
  const [allTags, setAllTags] = useState([]);
  const [open, setOpen] = useState(false);

  // Load tags and listen for changes
  useEffect(() => {
    loadTags().then(setAllTags);
    const handler = (e) => { if (e.detail?.tags) setAllTags(e.detail.tags); };
    window.addEventListener(TAGS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(TAGS_CHANGED_EVENT, handler);
  }, []);

  // Filter tags by scope
  const scopedTags = allTags.filter(t => t.scope && t.scope.includes(scope));
  const selected = scopedTags.filter(t => selectedTags.includes(t.id));
  const available = scopedTags.filter(t => !selectedTags.includes(t.id));

  const addTag = useCallback((tagId) => {
    onChange([...selectedTags, tagId]);
  }, [selectedTags, onChange]);

  const removeTag = useCallback((tagId) => {
    onChange(selectedTags.filter(id => id !== tagId));
  }, [selectedTags, onChange]);

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* Selected tags as badges */}
      {selected.map(tag => (
        <Badge
          key={tag.id}
          className="text-white text-xs gap-1 pl-2 pr-1 cursor-default"
          style={{ backgroundColor: tag.color }}
        >
          {tag.name}
          <button
            onClick={() => removeTag(tag.id)}
            className="hover:bg-white/20 rounded-full p-0.5 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </Badge>
      ))}

      {/* Add button with popover */}
      {available.length > 0 && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-6 w-6 p-0 rounded-full border-dashed border-gray-300 hover:border-gray-400"
            >
              <Plus className="w-3.5 h-3.5 text-gray-400" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="start">
            <div className="space-y-1 max-h-48 overflow-y-auto">
              <p className="text-xs text-gray-400 px-2 py-1 font-medium">בחר תגית</p>
              {available.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => { addTag(tag.id); if (available.length <= 1) setOpen(false); }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors text-right"
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="text-sm text-gray-700">{tag.name}</span>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Empty state when no tags exist for scope */}
      {scopedTags.length === 0 && selectedTags.length === 0 && (
        <span className="text-xs text-gray-300">אין תגיות</span>
      )}
    </div>
  );
}
