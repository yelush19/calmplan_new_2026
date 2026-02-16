import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Client, Task, ClientAccount } from '@/api/entities';
import { Upload, Trash2, CheckCircle, Users, CreditCard, RefreshCw, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

// Pre-parsed import data from Monday Excel files
import importData from '../../scripts/import_data.json';

export default function DataImportTool() {
  const [status, setStatus] = useState({ clients: null, accounts: null, tasks: null });
  const [isImporting, setIsImporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [existingClients, setExistingClients] = useState([]);
  const [existingTasks, setExistingTasks] = useState([]);
  const [log, setLog] = useState([]);

  useEffect(() => {
    loadExisting();
  }, []);

  const loadExisting = async () => {
    const clients = await Client.list(null, 500).catch(() => []);
    const tasks = await Task.list(null, 5000).catch(() => []);
    setExistingClients(clients || []);
    setExistingTasks(tasks || []);
  };

  const addLog = (msg) => setLog(prev => [...prev, `${new Date().toLocaleTimeString('he-IL')} - ${msg}`]);

  // ─── Import Clients ────────────────────────────
  const importClients = async () => {
    setIsImporting(true);
    addLog('מתחיל ייבוא לקוחות...');

    let created = 0, updated = 0, skipped = 0;

    for (const client of importData.clients) {
      try {
        // Check if client already exists by name or monday_id
        const existing = existingClients.find(c =>
          c.name === client.name ||
          (client.monday_id && c.monday_id === client.monday_id) ||
          (client.entity_number && c.entity_number === client.entity_number)
        );

        if (existing) {
          // Update existing client with Monday data
          const updateData = {
            ...existing,
            entity_number: client.entity_number || existing.entity_number,
            status: client.status || existing.status,
            service_types: client.service_types?.length > 0 ? client.service_types : existing.service_types,
            tax_info: {
              ...existing.tax_info,
              tax_id: client.tax_info.tax_id || existing.tax_info?.tax_id || '',
              tax_deduction_file_number: client.tax_info.tax_deduction_file_number || existing.tax_info?.tax_deduction_file_number || '',
              annual_tax_ids: {
                ...existing.tax_info?.annual_tax_ids,
                tax_advances_id: client.tax_info.annual_tax_ids.tax_advances_id || existing.tax_info?.annual_tax_ids?.tax_advances_id || '',
                social_security_id: client.tax_info.annual_tax_ids.social_security_id || existing.tax_info?.annual_tax_ids?.social_security_id || '',
                deductions_id: client.tax_info.annual_tax_ids.deductions_id || existing.tax_info?.annual_tax_ids?.deductions_id || '',
                last_updated: new Date().toISOString(),
                updated_by: 'Monday Excel Import'
              },
              prev_year_ids: {
                ...existing.tax_info?.prev_year_ids,
                tax_advances_id: client.tax_info.prev_year_ids.tax_advances_id || existing.tax_info?.prev_year_ids?.tax_advances_id || '',
                social_security_id: client.tax_info.prev_year_ids.social_security_id || existing.tax_info?.prev_year_ids?.social_security_id || '',
                deductions_id: client.tax_info.prev_year_ids.deductions_id || existing.tax_info?.prev_year_ids?.deductions_id || '',
              }
            },
            reporting_info: {
              ...existing.reporting_info,
              ...client.reporting_info,
            },
            deadlines: client.deadlines || existing.deadlines,
            accountant: client.accountant || existing.accountant || '',
            extra_services: client.extra_services || existing.extra_services || '',
            monday_id: client.monday_id || existing.monday_id,
          };
          await Client.update(existing.id, updateData);
          updated++;
          addLog(`עדכון: ${client.name}`);
        } else {
          // Create new client
          await Client.create(client);
          created++;
          addLog(`חדש: ${client.name}`);
        }
      } catch (err) {
        addLog(`שגיאה ב-${client.name}: ${err.message}`);
        skipped++;
      }
    }

    addLog(`סיום ייבוא: ${created} חדשים, ${updated} עודכנו, ${skipped} נכשלו`);
    setStatus(prev => ({ ...prev, clients: { created, updated, skipped } }));
    setIsImporting(false);
    loadExisting();
  };

  // ─── Import Bank Accounts ────────────────────────
  const importBankAccounts = async () => {
    setIsImporting(true);
    addLog('מתחיל ייבוא חשבונות בנק...');

    // Get fresh client list for matching
    const clients = await Client.list(null, 500).catch(() => []);
    const existingAccounts = await ClientAccount.list(null, 5000).catch(() => []);

    let created = 0, skipped = 0;

    for (const account of importData.bankAccounts) {
      try {
        // Find the client this account belongs to
        const client = (clients || []).find(c => c.name === account.client_name);

        // Check if account already exists
        const exists = (existingAccounts || []).find(a =>
          a.name === account.name && a.client_name === account.client_name
        );

        if (exists) {
          skipped++;
          continue;
        }

        await ClientAccount.create({
          name: account.name,
          client_id: client?.id || '',
          client_name: account.client_name,
          account_type: account.account_type,
          account_number: account.account_number,
          bank_name: account.bank_name,
          reconciliation_system: account.reconciliation_system,
          bookkeeping_card_number: account.bookkeeping_card_number,
          reconciliation_frequency: account.reconciliation_frequency,
          last_reconciliation_date: account.last_reconciliation_date,
          next_target_date: account.next_target_date,
          status: account.status,
          notes: account.notes,
          source: 'monday_import',
        });
        created++;
      } catch (err) {
        addLog(`שגיאה: ${account.name}: ${err.message}`);
        skipped++;
      }
    }

    addLog(`סיום ייבוא חשבונות: ${created} חדשים, ${skipped} דולגו`);
    setStatus(prev => ({ ...prev, accounts: { created, skipped } }));
    setIsImporting(false);
  };

  // ─── Delete Monday Zombie Tasks ────────────────────────
  const deleteZombieTasks = async () => {
    if (!window.confirm('למחוק את כל המשימות שיובאו ממאנדיי? לא ניתן לשחזר.')) return;

    setIsDeleting(true);
    addLog('מתחיל מחיקת משימות Monday...');

    // Identify zombie tasks: tasks with no category, no description,
    // or tasks that look like they were imported from Monday
    const allTasks = await Task.list(null, 5000).catch(() => []);
    let deleted = 0;

    for (const task of (allTasks || [])) {
      const isZombie =
        // No category AND no description - likely Monday import
        (!task.category && !task.description) ||
        // Has monday_item_id marker
        task.monday_item_id ||
        // Source indicates monday
        task.source === 'monday' ||
        task.source === 'monday_import' ||
        // Has monday_board_id
        task.monday_board_id;

      if (isZombie) {
        try {
          await Task.delete(task.id);
          deleted++;
        } catch (err) {
          addLog(`שגיאה במחיקת: ${task.title}`);
        }
      }
    }

    addLog(`נמחקו ${deleted} משימות Monday מתוך ${allTasks?.length || 0} סה"כ`);
    setStatus(prev => ({ ...prev, tasks: { deleted, total: allTasks?.length || 0 } }));
    setIsDeleting(false);
    loadExisting();
  };

  // Delete ALL tasks (nuclear option)
  const deleteAllTasks = async () => {
    const count = existingTasks.length;
    if (!window.confirm(`למחוק את כל ${count} המשימות? פעולה בלתי הפיכה!`)) return;
    if (!window.confirm('בטוח? כל המשימות יימחקו לצמיתות.')) return;

    setIsDeleting(true);
    addLog('מוחק את כל המשימות...');

    try {
      await Task.deleteAll();
      addLog(`נמחקו כל ${count} המשימות`);
      setStatus(prev => ({ ...prev, tasks: { deleted: count, total: count } }));
    } catch (err) {
      addLog(`שגיאה: ${err.message}`);
    }

    setIsDeleting(false);
    loadExisting();
  };

  // Zombie tasks preview
  const zombieTasks = existingTasks.filter(t =>
    (!t.category && !t.description) || t.monday_item_id || t.source === 'monday' || t.monday_board_id
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">ייבוא נתונים מ-Monday</h1>
        <p className="text-gray-500 mt-1">ייבוא לקוחות, חשבונות בנק, ומחיקת משימות ישנות</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 text-center">
            <Users className="w-8 h-8 mx-auto mb-2 text-sky-500" />
            <p className="text-3xl font-black text-gray-800">{importData.clients.length}</p>
            <p className="text-sm text-gray-500">לקוחות ב-Excel</p>
            <p className="text-xs text-gray-400 mt-1">{existingClients.length} במערכת</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 text-center">
            <CreditCard className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
            <p className="text-3xl font-black text-gray-800">{importData.bankAccounts.length}</p>
            <p className="text-sm text-gray-500">חשבונות בנק</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 text-center">
            <Trash2 className="w-8 h-8 mx-auto mb-2 text-amber-500" />
            <p className="text-3xl font-black text-amber-600">{zombieTasks.length}</p>
            <p className="text-sm text-gray-500">משימות Monday</p>
            <p className="text-xs text-gray-400 mt-1">{existingTasks.length} סה"כ</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Import Clients */}
        <Card className="border-sky-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-sky-600" />
              ייבוא לקוחות
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 mb-3">
              מעדכן לקוחות קיימים עם מזהי מס, תדירויות דיווח, וסוג מע"מ.
              יוצר לקוחות חדשים שלא קיימים.
              <br /><strong>מזהים שנתיים = 2025 (שנה קודמת)</strong>
            </p>
            <Button
              onClick={importClients}
              disabled={isImporting}
              className="w-full bg-sky-600 hover:bg-sky-700"
            >
              {isImporting ? <RefreshCw className="w-4 h-4 ml-2 animate-spin" /> : <Upload className="w-4 h-4 ml-2" />}
              ייבא {importData.clients.length} לקוחות
            </Button>
            {status.clients && (
              <div className="mt-3 p-2 bg-sky-50 rounded-lg text-sm text-sky-800">
                <CheckCircle className="w-4 h-4 inline ml-1" />
                {status.clients.created} חדשים, {status.clients.updated} עודכנו
              </div>
            )}
          </CardContent>
        </Card>

        {/* Import Bank Accounts */}
        <Card className="border-emerald-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-600" />
              ייבוא חשבונות בנק
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 mb-3">
              מייבא חשבונות בנק, כרטיסי אשראי, סליקה, והנהלת חשבונות.
              דולג על חשבונות שכבר קיימים.
            </p>
            <Button
              onClick={importBankAccounts}
              disabled={isImporting}
              className="w-full bg-emerald-600 hover:bg-emerald-700"
            >
              {isImporting ? <RefreshCw className="w-4 h-4 ml-2 animate-spin" /> : <Upload className="w-4 h-4 ml-2" />}
              ייבא {importData.bankAccounts.length} חשבונות
            </Button>
            {status.accounts && (
              <div className="mt-3 p-2 bg-emerald-50 rounded-lg text-sm text-emerald-800">
                <CheckCircle className="w-4 h-4 inline ml-1" />
                {status.accounts.created} חדשים, {status.accounts.skipped} דולגו
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delete Zombie Tasks */}
        <Card className="border-amber-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-amber-600" />
              מחיקת משימות Monday
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 mb-3">
              מוחק משימות שיובאו ממאנדיי (ללא קטגוריה, ללא תיאור).
              {zombieTasks.length > 0 && (
                <span className="text-amber-600 font-bold"> זוהו {zombieTasks.length} משימות למחיקה</span>
              )}
            </p>
            <Button
              onClick={deleteZombieTasks}
              disabled={isDeleting || zombieTasks.length === 0}
              variant="outline"
              className="w-full text-amber-700 border-amber-200 hover:bg-amber-50"
            >
              {isDeleting ? <RefreshCw className="w-4 h-4 ml-2 animate-spin" /> : <Trash2 className="w-4 h-4 ml-2" />}
              מחק {zombieTasks.length} משימות
            </Button>
            {status.tasks && (
              <div className="mt-3 p-2 bg-amber-50 rounded-lg text-sm text-amber-800">
                <CheckCircle className="w-4 h-4 inline ml-1" />
                נמחקו {status.tasks.deleted} מתוך {status.tasks.total}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delete ALL Tasks */}
        <Card className="border-gray-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-gray-400" />
              מחיקת כל המשימות
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 mb-3">
              מוחק את כל {existingTasks.length} המשימות. מומלץ רק אם כל המשימות הן Monday ישנות.
            </p>
            <Button
              onClick={deleteAllTasks}
              disabled={isDeleting || existingTasks.length === 0}
              variant="outline"
              className="w-full text-gray-500 border-gray-200 hover:bg-gray-50"
            >
              <Trash2 className="w-4 h-4 ml-2" />
              מחק הכל ({existingTasks.length})
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Log */}
      {log.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm text-gray-500">לוג פעולות</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-60 overflow-y-auto text-xs font-mono space-y-1 bg-gray-50 p-3 rounded-lg" dir="ltr">
              {log.map((line, i) => (
                <div key={i} className="text-gray-600">{line}</div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview: zombie tasks */}
      {zombieTasks.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm text-gray-500">
              תצוגה מקדימה - משימות Monday ({zombieTasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {zombieTasks.slice(0, 30).map(task => (
                <div key={task.id} className="flex items-center gap-3 p-2 text-sm bg-gray-50 rounded">
                  <span className="font-medium flex-1 truncate">{task.title}</span>
                  <span className="text-xs text-gray-400">{task.client_name || 'ללא לקוח'}</span>
                  <Badge variant="outline" className="text-xs">{task.status || '?'}</Badge>
                </div>
              ))}
              {zombieTasks.length > 30 && (
                <p className="text-xs text-gray-400 text-center">+{zombieTasks.length - 30} נוספות...</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
