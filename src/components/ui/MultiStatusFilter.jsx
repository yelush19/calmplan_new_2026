import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Filter, X } from 'lucide-react';

export default function MultiStatusFilter({
  options, // [{ value: 'active', label: 'פעיל', count: 5 }]
  selected, // Set or array of selected values
  onChange, // (newSelected: string[]) => void
  label = 'סנן לפי סטטוס',
}) {
  const [open, setOpen] = useState(false);
  const selectedSet = selected instanceof Set ? selected : new Set(selected || []);
  const isAllSelected = selectedSet.size === 0;

  const handleToggle = (value) => {
    const newSet = new Set(selectedSet);
    if (newSet.has(value)) {
      newSet.delete(value);
    } else {
      newSet.add(value);
    }
    onChange(Array.from(newSet));
  };

  const handleClearAll = () => {
    onChange([]);
  };

  const handleSelectAll = () => {
    onChange([]);
  };

  const activeFilters = options.filter(o => selectedSet.has(o.value));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full md:w-auto min-w-48 justify-start gap-2">
          <Filter className="w-4 h-4 shrink-0" />
          {isAllSelected ? (
            <span>{label}</span>
          ) : (
            <span className="flex items-center gap-1 truncate">
              {activeFilters.length === 1
                ? activeFilters[0].label
                : `${activeFilters.length} סטטוסים`
              }
            </span>
          )}
          {!isAllSelected && (
            <Badge variant="secondary" className="mr-auto text-xs px-1.5">
              {activeFilters.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="space-y-2">
          <div className="flex items-center justify-between pb-2 border-b">
            <span className="text-sm font-semibold">{label}</span>
            {!isAllSelected && (
              <Button variant="ghost" size="sm" onClick={handleClearAll} className="h-6 px-2 text-xs">
                <X className="w-3 h-3 ml-1" />
                נקה
              </Button>
            )}
          </div>
          <div
            className="flex items-center gap-2 p-1.5 rounded hover:bg-muted cursor-pointer"
            onClick={handleSelectAll}
          >
            <Checkbox checked={isAllSelected} />
            <span className="text-sm font-medium">הכל</span>
          </div>
          {options.map((option) => (
            <div
              key={option.value}
              className="flex items-center gap-2 p-1.5 rounded hover:bg-muted cursor-pointer"
              onClick={() => handleToggle(option.value)}
            >
              <Checkbox checked={selectedSet.has(option.value)} />
              <span className="text-sm flex-1">{option.label}</span>
              {option.count !== undefined && (
                <span className="text-xs text-muted-foreground">{option.count}</span>
              )}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
