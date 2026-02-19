import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { isSupabaseConfigured } from '@/api/supabaseClient';
import {
  saveDailyBackupToSupabase,
  listBackupSnapshots,
  restoreFromBackupSnapshot,
  exportAllData,
  importAllData,
} from '@/api/supabaseDB';
import {
  Shield, Download, Upload, RefreshCw, Clock, CheckCircle,
  AlertTriangle, Database, HardDrive, RotateCcw
} from 'lucide-react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { useConfirm } from '@/components/ui/ConfirmDialog';

export default function BackupManager() {
  const { confirm, ConfirmDialogComponent } = useConfirm();
  const [snapshots, setSnapshots] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBacking, setIsBacking] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [lastAction, setLastAction] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadSnapshots();
  }, []);

  const loadSnapshots = async () => {
    setIsLoading(true);
    try {
      if (isSupabaseConfigured) {
        const list = await listBackupSnapshots();
        setSnapshots(list || []);
      }
    } catch (err) {
      console.error('Failed to load snapshots:', err);
    }
    setIsLoading(false);
  };

  const handleBackupNow = async () => {
    setIsBacking(true);
    try {
      const result = await saveDailyBackupToSupabase();
      if (result.saved) {
        setLastAction({ type: 'success', message: `גיבוי נשמר בהצלחה (${result.date})` });
      } else {
        setLastAction({ type: 'info', message: `גיבוי להיום כבר קיים (${result.date})` });
      }
      await loadSnapshots();
    } catch (err) {
      console.error('Backup failed:', err);
      setLastAction({ type: 'error', message: `שגיאה בגיבוי: ${err.message}` });
    }
    setIsBacking(false);
  };

  const handleRestore = async (snapshot) => {
    const ok = await confirm({
      title: 'שחזור מגיבוי',
      description: `לשחזר את המערכת מגיבוי ${snapshot.date}? פעולה זו תחליף את כל הנתונים הנוכחיים.`,
    });
    if (!ok) return;

    setIsRestoring(true);
    try {
      const result = await restoreFromBackupSnapshot(snapshot.id);
      if (result.restored) {
        setLastAction({ type: 'success', message: `המערכת שוחזרה בהצלחה מגיבוי ${result.date}` });
      }
    } catch (err) {
      console.error('Restore failed:', err);
      setLastAction({ type: 'error', message: `שגיאה בשחזור: ${err.message}` });
    }
    setIsRestoring(false);
  };

  const handleExportFile = async () => {
    try {
      const data = await exportAllData();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `calmplan-backup-${format(new Date(), 'yyyy-MM-dd-HHmm')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setLastAction({ type: 'success', message: 'קובץ גיבוי הורד בהצלחה' });
    } catch (err) {
      console.error('Export failed:', err);
      setLastAction({ type: 'error', message: `שגיאה בייצוא: ${err.message}` });
    }
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ok = await confirm({
      title: 'ייבוא מקובץ',
      description: 'ייבוא נתונים מקובץ גיבוי. הנתונים הקיימים ישולבו עם הנתונים המיובאים.',
    });
    if (!ok) {
      e.target.value = '';
      return;
    }

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await importAllData(data);
      setLastAction({ type: 'success', message: 'נתונים יובאו בהצלחה מהקובץ' });
      await loadSnapshots();
    } catch (err) {
      console.error('Import failed:', err);
      setLastAction({ type: 'error', message: `שגיאה בייבוא: ${err.message}` });
    }
    e.target.value = '';
  };

  if (!isSupabaseConfigured) {
    return (
      <div className="p-6 max-w-3xl mx-auto" dir="rtl">
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-amber-800 mb-2">ענן לא מחובר</h2>
            <p className="text-amber-700">מערכת הגיבוי דורשת חיבור ל-Supabase. הגדר את משתני הסביבה בקובץ .env</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-4xl mx-auto" dir="rtl">
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-2 flex items-center justify-center gap-3">
          <Shield className="w-8 h-8 text-blue-600" />
          גיבוי ושחזור
        </h1>
        <p className="text-gray-600">ניהול גיבויים אוטומטיים ושחזור נתונים</p>
      </div>

      {/* Status Banner */}
      {lastAction && (
        <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
          lastAction.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' :
          lastAction.type === 'error' ? 'bg-amber-50 border border-amber-200 text-amber-800' :
          'bg-blue-50 border border-blue-200 text-blue-800'
        }`}>
          {lastAction.type === 'success' ? <CheckCircle className="w-5 h-5 flex-shrink-0" /> :
           lastAction.type === 'error' ? <AlertTriangle className="w-5 h-5 flex-shrink-0" /> :
           <Clock className="w-5 h-5 flex-shrink-0" />}
          <span className="font-medium">{lastAction.message}</span>
          <button onClick={() => setLastAction(null)} className="mr-auto text-sm underline opacity-60 hover:opacity-100">סגור</button>
        </div>
      )}

      {/* Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="hover:shadow-md transition-shadow cursor-pointer border-blue-200" onClick={handleBackupNow}>
          <CardContent className="p-5 text-center">
            <Database className={`w-10 h-10 mx-auto mb-3 text-blue-600 ${isBacking ? 'animate-spin' : ''}`} />
            <h3 className="font-bold text-gray-800 mb-1">גיבוי עכשיו</h3>
            <p className="text-xs text-gray-500">שמירת snapshot לענן</p>
            <Button className="mt-3 w-full bg-blue-600 hover:bg-blue-700" disabled={isBacking}>
              {isBacking ? 'מגבה...' : 'גיבוי'}
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer border-green-200" onClick={handleExportFile}>
          <CardContent className="p-5 text-center">
            <Download className="w-10 h-10 mx-auto mb-3 text-green-600" />
            <h3 className="font-bold text-gray-800 mb-1">הורד גיבוי</h3>
            <p className="text-xs text-gray-500">ייצוא לקובץ JSON</p>
            <Button variant="outline" className="mt-3 w-full border-green-300 text-green-700 hover:bg-green-50">
              הורדה
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer border-orange-200" onClick={() => fileInputRef.current?.click()}>
          <CardContent className="p-5 text-center">
            <Upload className="w-10 h-10 mx-auto mb-3 text-orange-600" />
            <h3 className="font-bold text-gray-800 mb-1">ייבוא מקובץ</h3>
            <p className="text-xs text-gray-500">שחזור מקובץ JSON</p>
            <Button variant="outline" className="mt-3 w-full border-orange-300 text-orange-700 hover:bg-orange-50">
              בחר קובץ
            </Button>
            <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer border-gray-200" onClick={loadSnapshots}>
          <CardContent className="p-5 text-center">
            <RefreshCw className={`w-10 h-10 mx-auto mb-3 text-gray-600 ${isLoading ? 'animate-spin' : ''}`} />
            <h3 className="font-bold text-gray-800 mb-1">רענן רשימה</h3>
            <p className="text-xs text-gray-500">עדכון רשימת גיבויים</p>
            <Button variant="outline" className="mt-3 w-full" disabled={isLoading}>
              רענן
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Snapshots List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-gray-600" />
            גיבויים זמינים
            <Badge variant="outline" className="mr-2">{snapshots.length} גיבויים</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">טוען גיבויים...</div>
          ) : snapshots.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Database className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>לא נמצאו גיבויים. לחצי על "גיבוי עכשיו" ליצירת גיבוי ראשון.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {snapshots.map((snap) => (
                <div key={snap.id} className="flex items-center justify-between p-4 rounded-lg border bg-white hover:bg-gray-50 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span className="font-semibold text-gray-800">{snap.date}</span>
                      {snap.created_date && (
                        <span className="text-xs text-gray-400">
                          {format(new Date(snap.created_date), 'HH:mm', { locale: he })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>{snap.total_records || 0} רשומות</span>
                      {snap.summary && (
                        <span className="text-gray-400">
                          ({Object.keys(snap.summary).length} אוספים)
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-blue-300 text-blue-700 hover:bg-blue-50"
                    disabled={isRestoring}
                    onClick={() => handleRestore(snap)}
                  >
                    <RotateCcw className="w-4 h-4 ml-1" />
                    שחזור
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Section */}
      <div className="mt-6 p-4 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800">
        <h4 className="font-bold mb-2 flex items-center gap-2">
          <Shield className="w-4 h-4" />
          מידע על הגיבויים
        </h4>
        <ul className="space-y-1 list-disc list-inside">
          <li>גיבוי אוטומטי מתבצע כל שעה בשעות העבודה (07:00-22:00)</li>
          <li>המערכת שומרת עד 7 גיבויים אחרונים בענן</li>
          <li>ניתן גם להוריד גיבוי לקובץ מקומי (JSON) כגיבוי נוסף</li>
          <li>שחזור מגיבוי מחליף את כל הנתונים הנוכחיים</li>
        </ul>
      </div>

      {ConfirmDialogComponent}
    </div>
  );
}
