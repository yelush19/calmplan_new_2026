import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FolderOpen, Users, Search, Globe, User } from 'lucide-react';
import { Client, FileMetadata } from '@/api/entities';
import ClientFilesManager from '@/components/files/ClientFilesManager';
import FileList from '@/components/files/FileList';
import FilePreview from '@/components/files/FilePreview';
import { DOCUMENT_TYPES } from '@/components/files/FileMetadataForm';

export default function ClientFiles() {
  const [searchParams] = useSearchParams();
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState(searchParams.get('clientId') || '');
  const [isLoading, setIsLoading] = useState(true);
  const [pageTab, setPageTab] = useState(selectedClientId ? 'client' : 'search');

  // Cross-client search state
  const [allFiles, setAllFiles] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDocType, setSearchDocType] = useState('all');
  const [searchYear, setSearchYear] = useState('all');
  const [searchMonth, setSearchMonth] = useState('all');
  const [previewFile, setPreviewFile] = useState(null);

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    setIsLoading(true);
    try {
      const data = await Client.list(null, 500);
      const activeClients = (data || []).filter(c => c.status === 'active' || c.status === 'onboarding_pending' || c.status === 'balance_sheet_only');
      activeClients.sort((a, b) => a.name.localeCompare(b.name, 'he'));
      setClients(activeClients);
    } catch (err) {
      console.error('Error loading clients:', err);
    }
    setIsLoading(false);
  };

  // Load all files for cross-client search
  const loadAllFiles = async () => {
    setIsSearching(true);
    try {
      const files = await FileMetadata.list('-created_date', 5000);
      setAllFiles(files || []);
    } catch (err) {
      console.error('Error loading all files:', err);
    }
    setIsSearching(false);
  };

  useEffect(() => {
    if (pageTab === 'search') loadAllFiles();
  }, [pageTab]);

  const selectedClient = clients.find(c => c.id === selectedClientId);

  // Filtered search results
  const searchResults = useMemo(() => {
    let results = [...allFiles];

    if (searchQuery) {
      const lower = searchQuery.toLowerCase();
      results = results.filter(f =>
        f.file_name?.toLowerCase().includes(lower) ||
        f.client_name?.toLowerCase().includes(lower) ||
        f.notes?.toLowerCase().includes(lower)
      );
    }

    if (searchDocType !== 'all') {
      results = results.filter(f => f.document_type === searchDocType);
    }

    if (searchYear !== 'all') {
      results = results.filter(f => f.year === searchYear);
    }

    if (searchMonth !== 'all') {
      results = results.filter(f => f.month === searchMonth);
    }

    return results;
  }, [allFiles, searchQuery, searchDocType, searchYear, searchMonth]);

  // Available years/months for filters
  const availableYears = useMemo(() => {
    const years = new Set(allFiles.map(f => f.year).filter(Boolean));
    return Array.from(years).sort().reverse();
  }, [allFiles]);

  const MONTHS = [
    { value: '01', label: 'ינואר' },
    { value: '02', label: 'פברואר' },
    { value: '03', label: 'מרץ' },
    { value: '04', label: 'אפריל' },
    { value: '05', label: 'מאי' },
    { value: '06', label: 'יוני' },
    { value: '07', label: 'יולי' },
    { value: '08', label: 'אוגוסט' },
    { value: '09', label: 'ספטמבר' },
    { value: '10', label: 'אוקטובר' },
    { value: '11', label: 'נובמבר' },
    { value: '12', label: 'דצמבר' },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
          <FolderOpen className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-neutral-dark">ניהול קבצים</h1>
          <p className="text-neutral-medium">אחסון, ניהול ושיתוף מסמכי לקוחות</p>
        </div>
      </div>

      {/* Main Tabs: By Client / Cross-Client Search */}
      <Tabs value={pageTab} onValueChange={setPageTab} dir="rtl">
        <TabsList className="bg-gray-100 p-1">
          <TabsTrigger value="client" className="flex items-center gap-2 data-[state=active]:bg-white">
            <User className="w-4 h-4" />
            לפי לקוח
          </TabsTrigger>
          <TabsTrigger value="search" className="flex items-center gap-2 data-[state=active]:bg-white">
            <Globe className="w-4 h-4" />
            חיפוש כללי
          </TabsTrigger>
        </TabsList>

        {/* Tab: By Client */}
        <TabsContent value="client" className="mt-4 space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <Users className="w-5 h-5 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">בחר לקוח:</span>
                <Select value={selectedClientId} onValueChange={(v) => { setSelectedClientId(v); setPageTab('client'); }}>
                  <SelectTrigger className="w-[300px]">
                    <SelectValue placeholder={isLoading ? 'טוען...' : 'בחר לקוח'} />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map(client => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {selectedClient ? (
            <ClientFilesManager
              clientId={selectedClient.id}
              clientName={selectedClient.name}
            />
          ) : (
            <Card className="p-12 text-center">
              <FolderOpen className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">בחר לקוח להצגת קבצים</h3>
              <p className="text-gray-500">בחר לקוח מהרשימה כדי לצפות בקבצים שלו, להעלות קבצים חדשים, או לנהל מסמכים קיימים.</p>
            </Card>
          )}
        </TabsContent>

        {/* Tab: Cross-Client Search */}
        <TabsContent value="search" className="mt-4 space-y-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <Search className="w-5 h-5" />
                חיפוש קבצים בכל הלקוחות
              </h3>

              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="חיפוש לפי שם לקוח, שם קובץ, הערות..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-10"
                />
              </div>

              {/* Filters Row */}
              <div className="flex flex-wrap gap-3">
                <div className="space-y-1">
                  <span className="text-xs text-gray-500">סוג מסמך</span>
                  <Select value={searchDocType} onValueChange={setSearchDocType}>
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
                  <span className="text-xs text-gray-500">שנה</span>
                  <Select value={searchYear} onValueChange={setSearchYear}>
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
                <div className="space-y-1">
                  <span className="text-xs text-gray-500">חודש (תקופת דיווח)</span>
                  <Select value={searchMonth} onValueChange={setSearchMonth}>
                    <SelectTrigger className="w-[140px] h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">הכל</SelectItem>
                      {MONTHS.map(m => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {(searchQuery || searchDocType !== 'all' || searchYear !== 'all' || searchMonth !== 'all') && (
                  <div className="flex items-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => { setSearchQuery(''); setSearchDocType('all'); setSearchYear('all'); setSearchMonth('all'); }}
                    >
                      נקה הכל
                    </Button>
                  </div>
                )}
              </div>

              <div className="text-xs text-gray-500">
                {isSearching ? 'מחפש...' : `${searchResults.length} תוצאות`}
              </div>
            </CardContent>
          </Card>

          {/* Search Results */}
          <FileList
            files={searchResults}
            isLoading={isSearching}
            onPreview={setPreviewFile}
            showClientColumn
          />

          <FilePreview
            file={previewFile}
            open={!!previewFile}
            onClose={() => setPreviewFile(null)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
