
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Database, CheckCircle, AlertCircle, Loader2, Trash2, ShieldCheck, PlusCircle, Search, FileText, Download, AlertTriangle } from 'lucide-react';
import { seedData } from '@/api/functions';
import { Task, Event, Client, WeeklySchedule } from '@/api/entities';

const StatCard = ({ title, count, icon: Icon, color }) => (
  <Card className={`border-l-4 ${color}`}>
    <CardContent className="p-4 flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-2xl font-bold">{count}</p>
      </div>
      <Icon className="w-8 h-8 text-gray-300" />
    </CardContent>
  </Card>
);

const BackupItem = ({ source, status, data, onRestore }) => (
  <Card className="mb-4">
    <CardContent className="p-4">
      <div className="flex justify-between items-center">
        <div>
          <h4 className="font-semibold">{source}</h4>
          <p className="text-sm text-gray-500">
            {status === 'found' ? `נמצאו ${Array.isArray(data) ? data.length : 0} רשומות` : 'לא נמצא גיבוי'}
          </p>
        </div>
        <div className="flex gap-2">
          <span className={`px-2 py-1 rounded text-xs ${status === 'found' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
            {status === 'found' ? 'נמצא' : 'ריק'}
          </span>
          {status === 'found' && (
            <Button size="sm" onClick={() => onRestore(source, data)}>
              שחזר
            </Button>
          )}
        </div>
      </div>
    </CardContent>
  </Card>
);

export default function TestDataManager() {
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({ demo: 0, real: 0, monday: 0 });
  const [activeTab, setActiveTab] = useState('management'); // 'management' or 'recovery'
  
  // Recovery state
  const [backupSources, setBackupSources] = useState([]);
  const [manualData, setManualData] = useState({
    clientName: '',
    phone: '',
    email: '',
    notes: '',
    additionalContacts: ''
  });
  const [recoveryLog, setRecoveryLog] = useState([]);

  const fetchStats = async () => {
    try {
      const allTasks = await Task.list(null, 5000);
      const allClients = await Client.list(null, 1000);
      const demoCount = (allTasks || []).filter(t => t.isDemo).length;
      const mondayCount = (allTasks || []).filter(t => t.isFromMonday).length;
      setStats({
        demo: demoCount,
        real: (allTasks?.length || 0) - demoCount - mondayCount,
        monday: mondayCount
      });
    } catch (e) {
      console.error("Failed to fetch stats", e);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleCreateDemoData = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      const { data } = await seedData({ action: 'seed' });
      if (data.success) {
        setResult(data);
      } else {
        setError(data.error || 'שגיאה לא ידועה');
      }
    } catch (err) {
      setError(`שגיאה: ${err.message}`);
    } finally {
      setIsLoading(false);
      await fetchStats();
    }
  };

  const handleDeleteDemoData = async () => {
    const allTasks = await Task.list(null, 5000);
    const demoTasks = allTasks.filter(t => t.isDemo);
    
    if (demoTasks.length === 0) {
        alert("לא נמצאו נתוני דמו למחיקה.");
        return;
    }

    if (!window.confirm(`⚠️ האם למחוק ${demoTasks.length} רשומות דמו? רשומות אמיתיות לא יימחקו.`)) {
      return;
    }

    setIsDeleting(true);
    setError(null);
    setResult(null);

    try {
      for (const task of demoTasks) {
        await Task.delete(task.id);
      }
      
      const message = `${demoTasks.length} רשומות דמו נמחקו בהצלחה.`;
      setResult({ success: true, message });

    } catch (err) {
      setError(`שגיאה במחיקת נתוני דמו: ${err.message}`);
    } finally {
      setIsDeleting(false);
      await fetchStats();
    }
  };

  // הוספת פונקציה למחיקת כפילויות
  const handleDeleteDuplicates = async () => {
    const allTasks = await Task.list(null, 10000);
    const duplicateTasks = allTasks.filter(t => !t.isFromMonday && !t.isDemo);
    
    if (duplicateTasks.length === 0) {
        alert("לא נמצאו כפילויות למחיקה.");
        return;
    }

    if (!window.confirm(`⚠️ האם למחוק ${duplicateTasks.length} כפילויות? רק משימות מוגנות ונתוני דמו יישארו.`)) {
      return;
    }

    setIsDeleting(true);
    setError(null);
    setResult(null);

    try {
      for (const task of duplicateTasks) {
        await Task.delete(task.id);
      }
      
      const message = `${duplicateTasks.length} כפילויות נמחקו בהצלחה.`;
      setResult({ success: true, message });

    } catch (err) {
      setError(`שגיאה במחיקת כפילויות: ${err.message}`);
    } finally {
      setIsDeleting(false);
      await fetchStats();
    }
  };

  // Recovery functions
  const scanForBackups = async () => {
    setIsScanning(true);
    const sources = [];

    try {
      // בדיקת localStorage
      const localStorageKeys = Object.keys(localStorage);
      const relevantKeys = localStorageKeys.filter(key => 
        key.toLowerCase().includes('client') || 
        key.toLowerCase().includes('backup') || 
        key.toLowerCase().includes('data') ||
        key.toLowerCase().includes('calm') ||
        key.toLowerCase().includes('treatment')
      );
      
      if (relevantKeys.length > 0) {
        const localData = relevantKeys.map(key => {
          try {
            const data = localStorage.getItem(key);
            return { 
              key, 
              data: data.startsWith('{') || data.startsWith('[') ? JSON.parse(data) : data,
              raw: data 
            };
          } catch {
            return { key, data: localStorage.getItem(key), raw: localStorage.getItem(key) };
          }
        });
        sources.push({
          source: 'localStorage',
          status: 'found',
          data: localData
        });
      } else {
        sources.push({ source: 'localStorage', status: 'empty', data: null });
      }

      // בדיקת sessionStorage
      const sessionKeys = Object.keys(sessionStorage);
      const relevantSessionKeys = sessionKeys.filter(key => 
        key.toLowerCase().includes('client') || 
        key.toLowerCase().includes('backup') || 
        key.toLowerCase().includes('data') ||
        key.toLowerCase().includes('calm') ||
        key.toLowerCase().includes('treatment')
      );
      
      if (relevantSessionKeys.length > 0) {
        const sessionData = relevantSessionKeys.map(key => {
          try {
            const data = sessionStorage.getItem(key);
            return { 
              key, 
              data: data.startsWith('{') || data.startsWith('[') ? JSON.parse(data) : data,
              raw: data 
            };
          } catch {
            return { key, data: sessionStorage.getItem(key), raw: sessionStorage.getItem(key) };
          }
        });
        sources.push({
          source: 'sessionStorage',
          status: 'found',
          data: sessionData
        });
      } else {
        sources.push({ source: 'sessionStorage', status: 'empty', data: null });
      }

      // בדיקת IndexedDB (Browser Database)
      if ('indexedDB' in window) {
        try {
          const databases = await indexedDB.databases();
          if (databases.length > 0) {
            sources.push({
              source: 'IndexedDB',
              status: 'found',
              data: databases.map(db => ({ name: db.name, version: db.version }))
            });
          } else {
            sources.push({ source: 'IndexedDB', status: 'empty', data: null });
          }
        } catch (e) {
          sources.push({ source: 'IndexedDB', status: 'error', data: null });
        }
      }

      setBackupSources(sources);
      
    } catch (error) {
      console.error('Error scanning for backups:', error);
      setError(`שגיאה בסריקה: ${error.message}`);
    }
    
    setIsScanning(false);
  };

  const handleRestore = async (source, data) => {
    try {
      let restoredCount = 0;
      
      if (Array.isArray(data)) {
        for (const item of data) {
          if (item.data && typeof item.data === 'object' && item.data.name) {
            const clientData = {
              ...item.data,
              isRecovered: true,
              recoveredFrom: source,
              recoveredAt: new Date().toISOString()
            };
            
            await Client.create(clientData);
            restoredCount++;
          }
        }
      }
      
      const logEntry = `שוחזרו ${restoredCount} לקוחות מ-${source} בשעה ${new Date().toLocaleTimeString('he-IL')}`;
      setRecoveryLog(prev => [...prev, logEntry]);
      
      alert(`שוחזרו בהצלחה ${restoredCount} רשומות מ-${source}`);
      await fetchStats();
      
    } catch (error) {
      console.error('Restore failed:', error);
      alert(`שגיאה בשחזור מ-${source}: ${error.message}`);
    }
  };

  const handleManualSave = async () => {
    if (!manualData.clientName.trim()) {
      alert('נא להזין לפחות שם לקוח');
      return;
    }

    try {
      const clientData = {
        name: manualData.clientName,
        phone: manualData.phone || null,
        email: manualData.email || null,
        notes: manualData.notes || '',
        contacts: manualData.additionalContacts ? 
          [{ name: manualData.additionalContacts, role: 'contact_person' }] : [],
        isManuallyRecovered: true,
        recoveredAt: new Date().toISOString()
      };

      await Client.create(clientData);
      
      const logEntry = `הוזן ידנית לקוח: ${manualData.clientName} בשעה ${new Date().toLocaleTimeString('he-IL')}`;
      setRecoveryLog(prev => [...prev, logEntry]);
      
      // נקה את הטופס
      setManualData({
        clientName: '',
        phone: '',
        email: '',
        notes: '',
        additionalContacts: ''
      });
      
      alert('הלקוח נשמר בהצלחה');
      await fetchStats();
      
    } catch (error) {
      console.error('Manual save failed:', error);
      alert(`שגיאה בשמירה: ${error.message}`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <h1 className="text-4xl font-bold text-gray-800 mb-4">🧪 ניהול נתוני בדיקה</h1>
        <p className="text-gray-600 text-lg">ממשק בטוח ליצירה, מחיקה ושחזור של נתוני דמו.</p>
      </motion.div>

      {/* Emergency Alert */}
      {stats.demo === 0 && stats.real === 0 && stats.monday === 0 && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800">🚨 מצב חירום: אין נתונים במערכת</AlertTitle>
          <AlertDescription className="text-amber-700">
            כל הנתונים נמחקו. עבור לטאב "שחזור חירום" כדי לנסות לשחזר נתונים או הזן אותם מחדש.
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <Button 
          variant={activeTab === 'management' ? 'default' : 'outline'}
          onClick={() => setActiveTab('management')}
        >
          <Database className="w-4 h-4 mr-2" />
          ניהול נתונים
        </Button>
        <Button 
          variant={activeTab === 'recovery' ? 'default' : 'outline'}
          onClick={() => setActiveTab('recovery')}
          className="text-amber-600 border-amber-200"
        >
          <AlertTriangle className="w-4 h-4 mr-2" />
          שחזור חירום
        </Button>
      </div>

      {activeTab === 'management' && (
        <>
          <Card>
            <CardHeader><CardTitle>סטטיסטיקת נתונים נוכחית</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard title="נתוני דמו" count={stats.demo} icon={Trash2} color="border-orange-500" />
              <StatCard title="נתוני אמת" count={stats.real} icon={Database} color="border-blue-500" />
              <StatCard title="מקור חיצוני (מוגן)" count={stats.monday} icon={ShieldCheck} color="border-green-500" />
            </CardContent>
          </Card>
          
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Database className="w-6 h-6 text-primary" />
                  פעולות על נתונים
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button 
                    onClick={handleDeleteDuplicates} 
                    disabled={isDeleting || isLoading || stats.real === 0} 
                    size="lg" 
                    className="bg-amber-500 hover:bg-amber-600 text-white px-8 py-4 text-lg"
                  >
                    {isDeleting ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Trash2 className="w-5 h-5 mr-2" />}
                    מחק כפילויות ({stats.real})
                  </Button>
                  
                  <Button onClick={handleDeleteDemoData} disabled={isDeleting || isLoading || stats.demo === 0} size="lg" className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 text-lg">
                    {isDeleting ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Trash2 className="w-5 h-5 mr-2" />}
                    מחק רק נתוני דמו ({stats.demo})
                  </Button>
                  
                  <Button onClick={handleCreateDemoData} disabled={isLoading || isDeleting} size="lg" className="bg-primary hover:bg-accent text-white px-8 py-4 text-lg">
                    {isLoading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <PlusCircle className="w-5 h-5 mr-2" />}
                    צור נתוני דמו
                  </Button>
                </div>
                {result && (
                  <Alert className="border-green-200 bg-green-50">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">{result.message}</AlertDescription>
                  </Alert>
                )}
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </>
      )}

      {activeTab === 'recovery' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* סריקת גיבויים */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="w-5 h-5" />
                  סריקה לגיבויים קיימים
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <Button 
                    onClick={scanForBackups} 
                    disabled={isScanning}
                    className="w-full"
                  >
                    {isScanning ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        סורק את הדפדפן...
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4 mr-2" />
                        בדוק גיבויים בדפדפן
                      </>
                    )}
                  </Button>
                </div>
                
                {backupSources.map((backup, index) => (
                  <BackupItem
                    key={index}
                    source={backup.source}
                    status={backup.status}
                    data={backup.data}
                    onRestore={handleRestore}
                  />
                ))}
              </CardContent>
            </Card>

            {/* הזנה ידנית */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  הזנה ידנית של נתונים
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Input
                    placeholder="שם לקוח *"
                    value={manualData.clientName}
                    onChange={(e) => setManualData(prev => ({ ...prev, clientName: e.target.value }))}
                  />
                  <Input
                    placeholder="טלפון"
                    value={manualData.phone}
                    onChange={(e) => setManualData(prev => ({ ...prev, phone: e.target.value }))}
                  />
                  <Input
                    placeholder="אימייל"
                    type="email"
                    value={manualData.email}
                    onChange={(e) => setManualData(prev => ({ ...prev, email: e.target.value }))}
                  />
                  <Input
                    placeholder="איש קשר נוסף"
                    value={manualData.additionalContacts}
                    onChange={(e) => setManualData(prev => ({ ...prev, additionalContacts: e.target.value }))}
                  />
                  <Textarea
                    placeholder="הערות והיסטוריה חשובה..."
                    rows={4}
                    value={manualData.notes}
                    onChange={(e) => setManualData(prev => ({ ...prev, notes: e.target.value }))}
                  />
                  <Button onClick={handleManualSave} className="w-full">
                    <Database className="w-4 h-4 mr-2" />
                    שמור לקוח
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* לוג שחזור */}
          {recoveryLog.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  יומן שחזור
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-40 overflow-y-auto space-y-2">
                  {recoveryLog.map((log, index) => (
                    <div key={index} className="text-sm bg-green-50 p-2 rounded border-r-4 border-green-500">
                      ✅ {log}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
