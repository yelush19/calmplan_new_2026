import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Search, Download, Trash2, Edit, Eye, Share2, Calendar,
  FileText, Image, Table, File, SortAsc, SortDesc, Filter,
  MoreVertical, Link, CheckSquare, Square, X
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DOCUMENT_TYPES, STATUS_OPTIONS } from './FileMetadataForm';
import { getFileTypeIcon, formatFileSize } from './FilePreview';

const documentTypeLabels = Object.fromEntries(DOCUMENT_TYPES.map(d => [d.value, d.label]));
const statusLabels = Object.fromEntries(STATUS_OPTIONS.map(s => [s.value, s.label]));

const statusColors = {
  draft: 'bg-gray-100 text-gray-800 border-gray-200',
  final: 'bg-green-100 text-green-800 border-green-200',
  pending_approval: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  approved: 'bg-blue-100 text-blue-800 border-blue-200',
};

const docTypeColors = {
  contract: 'bg-purple-100 text-purple-800',
  monthly_report: 'bg-blue-100 text-blue-800',
  payslip: 'bg-green-100 text-green-800',
  correspondence: 'bg-orange-100 text-orange-800',
  tax_report: 'bg-amber-100 text-amber-800',
  invoice: 'bg-cyan-100 text-cyan-800',
  receipt: 'bg-teal-100 text-teal-800',
  bank_statement: 'bg-indigo-100 text-indigo-800',
  other: 'bg-gray-100 text-gray-800',
};

export default function FileList({
  files,
  onPreview,
  onEdit,
  onDelete,
  onShare,
  onBulkDelete,
  isLoading,
  showClientColumn = false,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [docTypeFilter, setDocTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [sortField, setSortField] = useState('created_date');
  const [sortDesc, setSortDesc] = useState(true);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showFilters, setShowFilters] = useState(false);

  // Get unique years from files
  const availableYears = useMemo(() => {
    const years = new Set(files.map(f => f.year).filter(Boolean));
    return Array.from(years).sort().reverse();
  }, [files]);

  // Filter and sort
  const filteredFiles = useMemo(() => {
    let result = [...files];

    // Search
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(f =>
        f.file_name?.toLowerCase().includes(lower) ||
        f.notes?.toLowerCase().includes(lower) ||
        f.client_name?.toLowerCase().includes(lower)
      );
    }

    // Filters
    if (docTypeFilter !== 'all') {
      result = result.filter(f => f.document_type === docTypeFilter);
    }
    if (statusFilter !== 'all') {
      result = result.filter(f => f.status === statusFilter);
    }
    if (yearFilter !== 'all') {
      result = result.filter(f => f.year === yearFilter);
    }

    // Sort
    result.sort((a, b) => {
      let valA = a[sortField] || '';
      let valB = b[sortField] || '';
      if (sortField === 'file_size') {
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
      }
      if (sortDesc) return valA > valB ? -1 : valA < valB ? 1 : 0;
      return valA < valB ? -1 : valA > valB ? 1 : 0;
    });

    return result;
  }, [files, searchTerm, docTypeFilter, statusFilter, yearFilter, sortField, sortDesc]);

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortDesc(!sortDesc);
    } else {
      setSortField(field);
      setSortDesc(true);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredFiles.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredFiles.map(f => f.id)));
    }
  };

  const toggleSelect = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    if (window.confirm(`האם למחוק ${selectedIds.size} קבצים?`)) {
      onBulkDelete?.(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  };

  const SortIcon = sortDesc ? SortDesc : SortAsc;
  const hasActiveFilters = docTypeFilter !== 'all' || statusFilter !== 'all' || yearFilter !== 'all';

  return (
    <div className="space-y-3">
      {/* Search and Filters Bar */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="חיפוש לפי שם, הערות..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-10"
          />
        </div>
        <Button
          variant={hasActiveFilters ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className="gap-2"
        >
          <Filter className="w-4 h-4" />
          סינון
          {hasActiveFilters && (
            <Badge className="bg-white text-primary text-xs px-1.5 py-0">
              {[docTypeFilter !== 'all', statusFilter !== 'all', yearFilter !== 'all'].filter(Boolean).length}
            </Badge>
          )}
        </Button>
      </div>

      {/* Filter dropdowns */}
      {showFilters && (
        <div className="flex flex-wrap gap-3 p-3 bg-gray-50 rounded-lg">
          <div className="space-y-1">
            <span className="text-xs text-gray-500">סוג מסמך</span>
            <Select value={docTypeFilter} onValueChange={setDocTypeFilter}>
              <SelectTrigger className="w-[160px] h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">הכל</SelectItem>
                {DOCUMENT_TYPES.map(dt => (
                  <SelectItem key={dt.value} value={dt.value}>{dt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-gray-500">סטטוס</span>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">הכל</SelectItem>
                {STATUS_OPTIONS.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-gray-500">שנה</span>
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger className="w-[100px] h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">הכל</SelectItem>
                {availableYears.map(y => (
                  <SelectItem key={y} value={y}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {hasActiveFilters && (
            <div className="flex items-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setDocTypeFilter('all'); setStatusFilter('all'); setYearFilter('all'); }}
                className="text-xs h-8"
              >
                <X className="w-3 h-3 ml-1" />
                נקה סינון
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
          <span className="text-sm font-medium text-blue-900">
            נבחרו {selectedIds.size} קבצים
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
              ביטול
            </Button>
            <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
              <Trash2 className="w-4 h-4 ml-1" />
              מחק נבחרים
            </Button>
          </div>
        </div>
      )}

      {/* Files Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-3 text-right w-10">
                  <Checkbox
                    checked={filteredFiles.length > 0 && selectedIds.size === filteredFiles.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </th>
                <th
                  className="p-3 text-right cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => toggleSort('file_name')}
                >
                  <div className="flex items-center gap-1">
                    שם קובץ
                    {sortField === 'file_name' && <SortIcon className="w-3 h-3" />}
                  </div>
                </th>
                <th className="p-3 text-right">סוג</th>
                {showClientColumn && (
                  <th
                    className="p-3 text-right cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => toggleSort('client_name')}
                  >
                    <div className="flex items-center gap-1">
                      לקוח
                      {sortField === 'client_name' && <SortIcon className="w-3 h-3" />}
                    </div>
                  </th>
                )}
                <th
                  className="p-3 text-right cursor-pointer hover:bg-gray-100 select-none hidden md:table-cell"
                  onClick={() => toggleSort('created_date')}
                >
                  <div className="flex items-center gap-1">
                    תאריך
                    {sortField === 'created_date' && <SortIcon className="w-3 h-3" />}
                  </div>
                </th>
                <th
                  className="p-3 text-right cursor-pointer hover:bg-gray-100 select-none hidden lg:table-cell"
                  onClick={() => toggleSort('file_size')}
                >
                  <div className="flex items-center gap-1">
                    גודל
                    {sortField === 'file_size' && <SortIcon className="w-3 h-3" />}
                  </div>
                </th>
                <th className="p-3 text-right hidden md:table-cell">סטטוס</th>
                <th className="p-3 text-right w-24">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={showClientColumn ? 8 : 7} className="p-8 text-center text-gray-500">
                    טוען קבצים...
                  </td>
                </tr>
              ) : filteredFiles.length === 0 ? (
                <tr>
                  <td colSpan={showClientColumn ? 8 : 7} className="p-8 text-center">
                    <File className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500">
                      {searchTerm || hasActiveFilters ? 'לא נמצאו קבצים תואמים' : 'אין קבצים עדיין'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredFiles.map(file => {
                  const FileIcon = getFileTypeIcon(file.file_name);
                  return (
                    <tr
                      key={file.id}
                      className={`hover:bg-gray-50 transition-colors ${selectedIds.has(file.id) ? 'bg-blue-50/50' : ''}`}
                    >
                      <td className="p-3">
                        <Checkbox
                          checked={selectedIds.has(file.id)}
                          onCheckedChange={() => toggleSelect(file.id)}
                        />
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                          <button
                            onClick={() => onPreview?.(file)}
                            className="text-right font-medium text-gray-900 hover:text-primary truncate max-w-[250px]"
                            title={file.file_name}
                          >
                            {file.file_name}
                          </button>
                          {file.version > 1 && (
                            <Badge variant="outline" className="text-xs flex-shrink-0">
                              v{file.version}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge className={`${docTypeColors[file.document_type] || docTypeColors.other} text-xs`}>
                          {documentTypeLabels[file.document_type] || file.document_type}
                        </Badge>
                      </td>
                      {showClientColumn && (
                        <td className="p-3 text-gray-700 text-xs whitespace-nowrap">
                          {file.client_name || '-'}
                        </td>
                      )}
                      <td className="p-3 text-gray-600 hidden md:table-cell whitespace-nowrap">
                        {file.created_date
                          ? new Date(file.created_date).toLocaleDateString('he-IL')
                          : '-'}
                      </td>
                      <td className="p-3 text-gray-600 hidden lg:table-cell whitespace-nowrap">
                        {formatFileSize(file.file_size)}
                      </td>
                      <td className="p-3 hidden md:table-cell">
                        <Badge className={`${statusColors[file.status] || statusColors.draft} text-xs border`}>
                          {statusLabels[file.status] || file.status}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onPreview?.(file)}>
                              <Eye className="w-4 h-4 ml-2" />
                              תצוגה מקדימה
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <a href={file.file_url} download={file.file_name}>
                                <Download className="w-4 h-4 ml-2" />
                                הורדה
                              </a>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onEdit?.(file)}>
                              <Edit className="w-4 h-4 ml-2" />
                              עריכת פרטים
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onShare?.(file)}>
                              <Share2 className="w-4 h-4 ml-2" />
                              שיתוף
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onDelete?.(file)}
                              className="text-amber-600 focus:text-amber-600"
                            >
                              <Trash2 className="w-4 h-4 ml-2" />
                              מחיקה
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Results count */}
      {!isLoading && filteredFiles.length > 0 && (
        <div className="text-xs text-gray-500 text-left">
          מציג {filteredFiles.length} מתוך {files.length} קבצים
        </div>
      )}
    </div>
  );
}
