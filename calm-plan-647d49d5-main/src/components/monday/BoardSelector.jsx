import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter } from 'lucide-react';

export function BoardSelector({ availableBoards, selectedBoardId, onBoardChange }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');

  // Extract unique groups from boards
  const groups = useMemo(() => {
    const groupSet = new Set();
    availableBoards?.forEach(board => {
      if (board.group?.title) {
        groupSet.add(board.group.title);
      }
    });
    return Array.from(groupSet).sort();
  }, [availableBoards]);

  // Filter boards based on search and group
  const filteredBoards = useMemo(() => {
    if (!availableBoards) return [];
    
    return availableBoards.filter(board => {
      const matchesSearch = searchTerm === '' || 
        board.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        board.id.includes(searchTerm);
      
      const matchesGroup = groupFilter === 'all' || 
        board.group?.title === groupFilter;
      
      return matchesSearch && matchesGroup;
    });
  }, [availableBoards, searchTerm, groupFilter]);

  return (
    <div className="space-y-2">
      {/* Search and Filter Controls */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            placeholder="חפש לוח לפי שם או ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        
        <Select value={groupFilter} onValueChange={setGroupFilter}>
          <SelectTrigger className="w-32 h-8 text-sm">
            <SelectValue placeholder="קבוצה" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הקבוצות</SelectItem>
            {groups.map(group => (
              <SelectItem key={group} value={group}>{group}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Board Selection */}
      <Select value={selectedBoardId || ''} onValueChange={onBoardChange}>
        <SelectTrigger className="h-8 text-sm">
          <SelectValue placeholder="בחר לוח..." />
        </SelectTrigger>
        <SelectContent className="max-h-60">
          <SelectItem value={null}>ללא לוח</SelectItem>
          {filteredBoards.length === 0 && searchTerm && (
            <div className="p-2 text-sm text-gray-500 text-center">
              לא נמצאו לוחות התואמים לחיפוש
            </div>
          )}
          {filteredBoards.map(board => (
            <SelectItem key={board.id} value={board.id}>
              <div className="flex flex-col">
                <span className="font-medium">{board.name}</span>
                <span className="text-xs text-gray-500">
                  ID: {board.id} • {board.group?.title || 'ללא קבוצה'}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {/* Results Count */}
      {searchTerm && (
        <div className="text-xs text-gray-500">
          נמצאו {filteredBoards.length} לוחות
        </div>
      )}
    </div>
  );
}