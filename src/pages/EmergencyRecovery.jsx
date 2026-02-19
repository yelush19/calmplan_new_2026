import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  AlertTriangle, Database, Download, Upload, Search, 
  FileText, Clock, Shield, RefreshCw 
} from 'lucide-react';
import { Client } from '@/api/entities';

const BackupItem = ({ source, status, data, onRestore }) => (
  <Card className="mb-4">
    <CardContent className="p-4">
      <div className="flex justify-between items-center">
        <div>
          <h4 className="font-semibold">{source}</h4>
          <p className="text-sm text-gray-500">
            {status === 'found' ? `נמצאו ${data?.length || 0} רשומות` : 'לא נמצא גיבוי'}
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant={status === 'found' ? 'default' : 'secondary'}>
            {status === 'found' ? 'נמצא' : 'ריק'}
          </Badge>
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

export default function EmergencyRecovery() {
  const [backupSources, setBackupSources] = useState([]);
  const [manualData, setManualData] = useState({
    clientName: '',
    phone: '',
    email: '',
    notes: '',
    additionalContacts: ''
  });
  const [isScanning, setIsScanning] = useState(false);
  const [recoveryLog, setRecoveryLog] = useState([]);

  useEffect(() => {
    scanForBackups();
  }, []);

  const scanForBackups = async () => {
    setIsScanning(true);
    const sources = [];

    try {
      // בדיקת localStorage
      const localStorageKeys = Object.keys(localStorage);
      const relevantKeys = localStorageKeys.filter(key => 
        key.includes('client') || key.includes('backup') || key.includes('data')
      );
      
      if (relevantKeys.length > 0) {
        const localData = relevantKeys.map(key => {
          try {
            return { key, data: JSON.parse(localStorage.getItem(key)) };
          } catch {
            return { key, data: localStorage.getItem(key) };
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
        key.includes('client') || key.includes('backup') || key.includes('data')
      );
      
      if (relevantSessionKeys.length > 0) {
        const sessionData = relevantSessionKeys.map(key => {
          try {
            return { key, data: JSON.parse(sessionStorage.getItem(key)) };
          } catch {
            return { key, data: sessionStorage.getItem(key) };
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

      // בדיקת גיבויים אוטומטיים
      try {
        const autoBackupData = localStorage.getItem('autoBackup');
        if (autoBackupData) {
          sources.push({
            source: 'גיבוי אוטומטי',
            status: 'found',
            data: JSON.parse(autoBackupData)
          });
        }
      } catch (e) {
        console.log('No auto backup found');
      }

      setBackupSources(sources);
      
    } catch (error) {
      console.error('Error scanning for backups:', error);
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
      
    } catch (error) {
      console.error('Manual save failed:', error);
      alert(`שגיאה בשמירה: ${error.message}`);
    }
  };

  const exportCurrentData = async () => {
    try {
      const allClients = await Client.list();
      const dataToExport = {
        clients: allClients,
        exportDate: new Date().toISOString(),
        version: '1.0'
      };
      
      const blob = new Blob([JSON.stringify(dataToExport, null, 2)], 
        { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `clients-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Export failed:', error);
      alert('שגיאה בייצוא הנתונים');
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <Alert className="mb-6 border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            <strong>מצב חירום: אובדן נתונים קריטיים</strong><br />
            דף זה נועד לסייע בשחזור נתוני לקוחות שאבדו במחיקה הלא מכוונת.
          </AlertDescription>
        </Alert>
        
        <h1 className="text-4xl font-bold text-amber-600 mb-4">
          🚨 שחזור נתונים חירום
        </h1>
      </motion.div>

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
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    סורק...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    סרוק מחדש
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
              <Clock className="w-5 h-5" />
              יומן שחזור
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-40 overflow-y-auto space-y-2">
              {recoveryLog.map((log, index) => (
                <div key={index} className="text-sm bg-gray-50 p-2 rounded">
                  {log}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* פעולות נוספות */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            פעולות מניעה
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button onClick={exportCurrentData} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              ייצא גיבוי נוכחי
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}