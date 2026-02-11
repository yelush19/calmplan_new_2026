
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle, AlertCircle, XCircle, RefreshCw, Database, Monitor, TriangleAlert } from 'lucide-react';
import { Client, Task, AccountReconciliation, ClientAccount, Dashboard, WeeklySchedule, Therapist } from '@/api/entities';

const StatusIcon = ({ status }) => {
  switch (status) {
    case 'working': return <CheckCircle className="w-4 h-4 text-green-500" />;
    case 'partial': return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    case 'broken': return <XCircle className="w-4 h-4 text-red-500" />;
    case 'empty': return <AlertCircle className="w-4 h-4 text-gray-400" />;
    default: return <AlertCircle className="w-4 h-4 text-gray-400" />;
  }
};

// Define Monday board categories for configuration (used in loadData)
const boardCategories = {
  main: { type: 'main', label: 'ראשי' },
  clients: { type: 'clients', label: 'לקוחות' },
  tasks: { type: 'tasks', label: 'משימות' },
  reconciliations: { type: 'reconciliations', label: 'התאמות' },
  invoices: { type: 'invoices', label: 'חשבוניות' },
  payments: { type: 'payments', label: 'תשלומים' },
  therapists: { type: 'therapists', label: 'מטפלים' },
  sessions: { type: 'sessions', label: 'פגישות' },
  events: { type: 'events', label: 'אירועים' },
  accounting: { type: 'accounting', label: 'הנהלת חשבונות' },
  admin: { type: 'admin', label: 'אדמין' },
};

export default function SystemOverviewPage() {
  const [systemStatus, setSystemStatus] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [boardConfigs, setBoardConfigs] = useState([]); // This state variable is not used after its initial declaration.

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      console.log('🔄 Loading all data for detailed Monday sync analysis...');

      const [dashboardsData, clientsData, tasksData, recsData, clientAccountsData, therapistsData] = await Promise.all([
        Dashboard.list().catch(() => []),
        Client.filter({}, '-updated_date', 1000).catch(() => []),
        Task.filter({}, '-updated_date', 2000).catch(() => []),
        AccountReconciliation.filter({}, '-updated_date', 1000).catch(() => []),
        ClientAccount.filter({}, '-updated_date', 1000).catch(() => []),
        Therapist.list(null, 1000).catch(() => [])
      ]);

      console.log('🔍 === DETAILED ID ANALYSIS ==='); // Kept for consistency with general analysis

      // Function to analyze ID fields for any entity
      const analyzeEntityIds = (entities, entityName) => {
        const analysis = {
          total: entities.length,
          withCalmPlanId: entities.filter(e => e.id).length, // All should have this
          withMondayBoardId: entities.filter(e => e.monday_board_id).length,
          withMondayItemId: entities.filter(e => e.monday_item_id).length,
          withAllIds: entities.filter(e => e.id && e.monday_board_id && e.monday_item_id).length,
          missingBoardId: entities.filter(e => e.id && !e.monday_board_id),
          missingItemId: entities.filter(e => e.id && e.monday_board_id && !e.monday_item_id),
          missingBoth: entities.filter(e => e.id && !e.monday_board_id && !e.monday_item_id)
        };

        console.log(`\n📊 ${entityName.toUpperCase()} ID ANALYSIS:`);
        console.log(`- Total records: ${analysis.total}`);
        console.log(`- With CalmPlan ID (id): ${analysis.withCalmPlanId}`);
        console.log(`- With Monday Board ID: ${analysis.withMondayBoardId}`);
        console.log(`- With Monday Item ID: ${analysis.withMondayItemId}`);
        console.log(`- With ALL 3 IDs: ${analysis.withAllIds}`);
        console.log(`- Missing Board ID: ${analysis.missingBoardId.length}`);
        console.log(`- Missing Item ID: ${analysis.missingItemId.length}`);
        console.log(`- Missing BOTH Monday IDs: ${analysis.missingBoth.length}`);

        // Show samples of problematic records
        if (analysis.missingBoth.length > 0) {
          console.log(`\n🚨 ${entityName} - SAMPLE RECORDS MISSING BOTH MONDAY IDs:`);
          analysis.missingBoth.slice(0, 5).forEach((record, i) => {
            console.log(`${i+1}. ID: ${record.id}, Title/Name: "${record.title || record.name || record.task_name || record.full_name || 'No name'}", Created: ${record.created_date}`);
          });
        }

        if (analysis.missingItemId.length > 0) {
          console.log(`\n⚠️ ${entityName} - SAMPLE RECORDS WITH BOARD ID BUT MISSING ITEM ID:`);
          analysis.missingItemId.slice(0, 5).forEach((record, i) => {
            console.log(`${i+1}. ID: ${record.id}, Board: ${record.monday_board_id}, Title/Name: "${record.title || record.name || record.task_name || record.full_name || 'No name'}"`);
          });
        }

        return analysis;
      };

      console.log('🔍 === MONDAY BOARD SYNC ANALYSIS ===');
      
      // Create board mapping for analysis
      const boardMappings = {
        'clients': 'לקוחות',
        'reports_main': 'תהליכי דיווח',
        'reports_126_856_2025': '126+856-2025',
        'reports_126_856_2024': '126+856-2024',
        'weekly_tasks': 'משימות שבועיות ופגישות',
        'balance_sheets': 'מאזנים',
        'reconciliations': 'התאמות בנק וסליקה',
        'client_accounts': 'חשבונות בנק וסליקה',
        'family_tasks': 'משימות משפחה',
        'weekly_planning': 'לוח טיפולים', // FIXED: was weekly_planer
        'wellbeing': 'מעקב רווחה',
        'therapists': 'לוח מטפלים'
      };

      // Expected counts per your message
      const expectedCounts = {
        'clients': 30,
        'reports_main': 94,
        'reports_126_856_2025': 14,
        'reports_126_856_2024': 16,
        'weekly_tasks': 62, // Should be 62, not 50
        'balance_sheets': 25,
        'reconciliations': 8,
        'client_accounts': 35, // Should be 35, not 34
        'family_tasks': 2,
        'weekly_planning': 10, // FIXED: was weekly_planer
        'wellbeing': 1,
        'therapists': 13
      };

      const configs = dashboardsData || [];
      let totalExpected = 0;
      let totalActual = 0;
      const actualCountsByBoardType = {}; // To store actual counts for boardBreakdown

      console.log('\n📋 BOARD BY BOARD ANALYSIS:');

      for (const config of configs) {
        let count = 0;
        let actualEntities = [];

        const expected = expectedCounts[config.type] || 0;
        totalExpected += expected;

        if (config.monday_board_id) {
            const boardIdStr = String(config.monday_board_id);
            console.log(`\n🔍 PROCESSING: ${config.type} (${boardMappings[config.type]}) - Board ID: ${boardIdStr}`);

            switch(config.type) {
                case 'clients':
                    actualEntities = (clientsData || []).filter(c => String(c.monday_board_id) === boardIdStr);
                    break;

                case 'reports_main':
                case 'reports_126_856_2025':
                case 'reports_126_856_2024':
                case 'weekly_tasks':
                case 'balance_sheets':
                case 'family_tasks':
                case 'wellbeing':
                case 'weekly_planning': // FIXED: was weekly_planer
                    actualEntities = (tasksData || []).filter(t => String(t.monday_board_id) === boardIdStr);
                    break;

                case 'reconciliations':
                    actualEntities = (recsData || []).filter(r => String(r.monday_board_id) === boardIdStr);
                    break;

                case 'client_accounts':
                    actualEntities = (clientAccountsData || []).filter(a => String(a.monday_board_id) === boardIdStr);
                    break;

                case 'therapists':
                    actualEntities = (therapistsData || []).filter(t => String(t.monday_board_id) === boardIdStr);
                    break;
            }

            count = actualEntities.length;
            actualCountsByBoardType[config.type] = count; // Store for boardBreakdown
            totalActual += count;

            console.log(`   Expected: ${expected}, Actual: ${count}, Difference: ${count - expected}`);

            if (count !== expected) {
                console.log(`   ⚠️ MISMATCH: Expected ${expected} but found ${count} for ${config.type}`);
                if (count < expected) {
                    console.log(`   📉 Missing ${expected - count} items in ${config.type}`);
                } else {
                    console.log(`   📈 Extra ${count - expected} items in ${config.type}`);
                }
            }
        } else {
            console.log(`\n❌ ${config.type} (${boardMappings[config.type]}) - NO BOARD ID SET`);
        }
      }

      console.log(`\n📊 TOTALS:`);
      console.log(`   Expected (Monday): ${totalExpected}`);
      console.log(`   Actual (Database): ${totalActual}`);
      console.log(`   Difference: ${totalActual - totalExpected}`);

      if (totalActual < totalExpected) {
          console.log(`   🚨 MISSING ${totalExpected - totalActual} items that should have been synced from Monday`);
      }

      // Continue with rest of analysis...
      // Analyze each entity type using the existing analyzeEntityIds function
      const analyses = {
        tasks: analyzeEntityIds(tasksData, 'TASKS'),
        clients: analyzeEntityIds(clientsData, 'CLIENTS'),
        reconciliations: analyzeEntityIds(recsData, 'RECONCILIATIONS'),
        clientAccounts: analyzeEntityIds(clientAccountsData, 'CLIENT_ACCOUNTS'),
        therapists: analyzeEntityIds(therapistsData, 'THERAPISTS')
      };

      // Special analysis for tasks - check for demo/protected flags (existing logic)
      console.log(`\n🔍 TASKS - SPECIAL FLAGS ANALYSIS:`);
      const taskFlags = {
        isDemo: tasksData.filter(t => t.isDemo === true).length,
        isProtected: tasksData.filter(t => t.isProtected === true).length,
        isFromMonday: tasksData.filter(t => t.isFromMonday === true).length,
        noFlags: tasksData.filter(t => !t.isDemo && !t.isProtected && !t.isFromMonday).length
      };
      console.log(`- Demo tasks: ${taskFlags.isDemo}`);
      console.log(`- Protected tasks: ${taskFlags.isProtected}`);
      console.log(`- From Monday flag: ${taskFlags.isFromMonday}`);
      console.log(`- No special flags: ${taskFlags.noFlags}`);

      // Check board IDs distribution (existing logic)
      console.log(`\n📋 TASKS - BOARD ID DISTRIBUTION:`);
      const boardIdCounts = {};
      tasksData.forEach(task => {
        const boardId = task.monday_board_id || 'NO_BOARD_ID';
        boardIdCounts[boardId] = (boardIdCounts[boardId] || 0) + 1;
      });
      Object.entries(boardIdCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .forEach(([boardId, count]) => {
          console.log(`- ${boardId}: ${count} tasks`);
        });

      // Update system status with detailed analysis, incorporating new and existing data
      const status = {
        tasks: {
          ...analyses.tasks, // Includes all ID analysis properties from analyzeEntityIds
          details: `${analyses.tasks.withAllIds}/${analyses.tasks.total} עם 3 מזהים`,
          status: analyses.tasks.withAllIds > 0 ? 'partial' : 'broken',
          taskFlags: taskFlags // Includes the special flag analysis
        },
        clients: {
          ...analyses.clients,
          details: `${analyses.clients.withAllIds}/${analyses.clients.total} עם 3 מזהים`,
          status: analyses.clients.withAllIds > 0 ? 'partial' : 'broken'
        },
        reconciliations: {
          ...analyses.reconciliations,
          details: `${analyses.reconciliations.withAllIds}/${analyses.reconciliations.total} עם 3 מזהים`,
          status: analyses.reconciliations.withAllIds > 0 ? 'partial' : 'broken'
        },
        clientAccounts: {
          ...analyses.clientAccounts,
          details: `${analyses.clientAccounts.withAllIds}/${analyses.clientAccounts.total} עם 3 מזהים`,
          status: analyses.clientAccounts.withAllIds > 0 ? 'partial' : 'broken'
        },
        therapists: { // Added therapists to systemStatus
            ...analyses.therapists,
            details: `${analyses.therapists.withAllIds}/${analyses.therapists.total} עם 3 מזהים`,
            status: analyses.therapists.withAllIds > 0 ? 'partial' : 'broken'
        },
        dashboards: { // Existing dashboard structure, adjusted status check
          totalDashboards: dashboardsData.length,
          configured: dashboardsData.filter(d => d.monday_board_id).length,
          details: `${dashboardsData.filter(d => d.monday_board_id).length}/${dashboardsData.length} מוגדרים`,
          status: dashboardsData.length === Object.keys(boardMappings).length ? 'working' : 'broken' // Check against the number of defined board mappings
        },
        // New properties from the outline
        expectedTotal: totalExpected,
        actualTotal: totalActual,
        boardBreakdown: configs.map(config => ({
          type: config.type,
          name: boardMappings[config.type],
          expected: expectedCounts[config.type] || 0,
          actual: actualCountsByBoardType[config.type] || 0
        }))
      };

      console.log('\n🎯 SUMMARY - RECORDS MISSING MONDAY CONNECTION:');
      Object.entries(analyses).forEach(([type, analysis]) => {
        // Only log if 'missingBoth' exists and has entries, as some analyses might not have it
        if (analysis.missingBoth?.length > 0) {
          console.log(`- ${type.toUpperCase()}: ${analysis.missingBoth.length} records completely disconnected from Monday`);
        }
      });

      setSystemStatus(status);
    } catch (error) {
      console.error("❌ Error loading data:", error);
      setError("שגיאה בטעינת נתונים: " + error.message);
    } finally {
        setIsLoading(false);
    }
  };

  // The analyzeEntitySync and analyzeBoards functions are no longer used as per outline and are removed.

  // Cleanup functions
  const cleanupDashboardDuplicates = async () => {
    if (!window.confirm('⚠️ זה ימחק רשומות Dashboard כפולות. המשך?')) return;
    
    setIsLoading(true);
    try {
      console.log('🧹 Starting Dashboard cleanup...');
      
      const allDashboards = await Dashboard.list();
      console.log('Found', allDashboards.length, 'dashboard records');
      
      const typeGroups = {};
      allDashboards.forEach(d => {
        if (!typeGroups[d.type]) {
          typeGroups[d.type] = [];
        }
        typeGroups[d.type].push(d);
      });
      
      let deletedCount = 0;
      for (const [type, dashboards] of Object.entries(typeGroups)) {
        if (dashboards.length > 1 && boardCategories[type]) {
          const toDelete = dashboards.slice(1);
          
          console.log(`Type ${type}: Keeping 1, deleting ${toDelete.length}`);
          
          for (const dashboard of toDelete) {
            await Dashboard.delete(dashboard.id);
            deletedCount++;
          }
        } else if (!boardCategories[type] && dashboards.length > 0) {
            console.warn(`Found unknown dashboard type "${type}". Deleting all ${dashboards.length} records.`);
            for (const dashboard of dashboards) {
                await Dashboard.delete(dashboard.id);
                deletedCount++;
            }
        }
      }
      
      console.log(`✅ Deleted ${deletedCount} duplicate or unknown dashboard records`);
      alert(`✅ נמחקו ${deletedCount} רשומות Dashboard כפולות או לא מזוהות`);
      
      await loadData();
      
    } catch (error) {
      console.error('❌ Error cleaning dashboards:', error);
      alert(`❌ שגיאה בניקוי: ${error.message}`);
    }
    setIsLoading(false);
  };

  const cleanupDemoTasks = async () => {
    if (!window.confirm('⚠️ זה ימחק את כל משימות הדמו. המשך?')) return;
    
    setIsLoading(true);
    try {
      const demoTasks = await Task.filter({ isDemo: true });
      console.log(`🧹 Found ${demoTasks.length} demo tasks to delete`);
      
      let deletedCount = 0;
      for (const task of demoTasks) {
        await Task.delete(task.id);
        deletedCount++;
      }
      
      console.log(`✅ Deleted ${deletedCount} demo tasks`);
      alert(`✅ נמחקו ${deletedCount} משימות דמו`);
      
      await loadData();
      
    } catch (error) {
      console.error('❌ Error cleaning demo tasks:', error);
      alert(`❌ שגיאה בניקוי: ${error.message}`);
    }
    setIsLoading(false);
  };

  const showOrphanedTasks = async () => {
    const orphanedTasks = await Task.filter({
      monday_board_id: null,
      monday_item_id: null,
      isDemo: { $ne: true }
    }, '-updated_date', 100);
    
    console.log('🔍 ORPHANED TASKS:', orphanedTasks.map(t => ({ id: t.id, title: t.title, isDemo: t.isDemo })));
    alert(`נמצאו ${orphanedTasks.length} משימות מקומיות (לא מקושרות ל-Monday ולא נתוני דמו). בדוק Console לפרטים.`);
  };

  const showDuplicateTasks = () => {
    // This now relies on the `duplicates` property that was calculated in the old loadData.
    // The new loadData doesn't calculate `duplicates` directly within the systemStatus.
    // If this functionality is to be preserved, `duplicates` calculation needs to be re-introduced
    // into the new `loadData` structure and then passed to `systemStatus.tasks.duplicates`.
    // For now, I'll adapt it based on the analysis output, or remove if not possible.
    // The outline did not include calculation of `taskAnalysis.duplicates` in the new `loadData`'s `systemStatus`.
    // I will remove the UI check for `systemStatus.tasks?.taskAnalysis?.duplicates?.length > 50` and the corresponding button,
    // as the data is no longer available in `systemStatus` as per the outline.
    // If needed, the old logic for `duplicates` in `loadData` could be re-added specifically.
    
    // As per the provided outline, `systemStatus.tasks.taskAnalysis.duplicates` is no longer populated.
    // Instead, the new `tasks` analysis has `missingBoth`, `missingItemId` etc.
    // The `duplicates` check was part of the old, more verbose task breakdown.
    // To enable this function, `duplicates` would need to be added to the `analyses.tasks` object.
    // Given the outline, this specific cleanup action is currently not supported by the new data structure.
    console.warn("Function showDuplicateTasks is currently not supported by the current data structure in systemStatus.");
    alert("פונקציית בדיקת כפילויות משימות אינה נתמכת כרגע במבנה הנתונים הנוכחי.");
  };

  const cleanupMondayDuplicates = async () => {
    if (!window.confirm('⚠️ זה ימחק משימות מכפילות Monday (שיש להן דגל From Monday אבל חסר להן Board/Item ID). המשך?')) return;
    
    setIsLoading(true);
    try {
      console.log('🧹 Starting Monday duplicates cleanup...');
      
      // First, let's debug what we actually have
      const allTasks = await Task.list(null, 2000);
      console.log('📊 TOTAL TASKS FOUND:', allTasks.length);
      
      const fromMondayTasks = allTasks.filter(t => t.isFromMonday === true);
      console.log('📊 TASKS WITH isFromMonday=true:', fromMondayTasks.length);
      
      const protectedTasks = allTasks.filter(t => t.isProtected === true);
      console.log('📊 TASKS WITH isProtected=true:', protectedTasks.length);
      
      const tasksWithBothIds = allTasks.filter(t => t.monday_board_id && t.monday_item_id);
      console.log('📊 TASKS WITH BOTH MONDAY IDs:', tasksWithBothIds.length);
      
      // Show samples of fromMonday tasks
      console.log('🔍 SAMPLE FROM MONDAY TASKS:');
      fromMondayTasks.slice(0, 10).forEach((task, i) => {
        console.log(`${i+1}. "${task.title}" - Board: "${task.monday_board_id}", Item: "${task.monday_item_id}", isFromMonday: ${task.isFromMonday}, isProtected: ${task.isProtected}`);
      });
      
      // NEW APPROACH: Find tasks that are either:
      // 1. From Monday but missing IDs
      // 2. Protected but missing IDs (since they seem to be the same)
      const duplicateTasks = allTasks.filter(task => 
        (task.isFromMonday === true || task.isProtected === true) &&
        (!task.monday_board_id || !task.monday_item_id)
      );
      
      console.log(`🔍 FOUND ${duplicateTasks.length} DUPLICATE TASKS (isFromMonday OR isProtected but missing Board/Item ID)`);
      
      if (duplicateTasks.length === 0) {
        // Alternative: Look for any tasks missing Monday connection
        const alternativeDuplicates = allTasks.filter(task => 
          !task.monday_board_id && 
          !task.monday_item_id && 
          !task.isDemo &&
          task.created_date
        );
        
        console.log(`🔍 ALTERNATIVE: Found ${alternativeDuplicates.length} tasks with no Monday connection (including protected)`);
        
        if (alternativeDuplicates.length > 0) {
          console.log('🚨 SAMPLE ALTERNATIVE DUPLICATES:');
          alternativeDuplicates.slice(0, 10).forEach((task, i) => {
            console.log(`${i+1}. "${task.title}" - ID: ${task.id}, Created: ${task.created_date}, isDemo: ${task.isDemo}, isProtected: ${task.isProtected}, isFromMonday: ${task.isFromMonday}`);
          });
          
          if (window.confirm(`❓ נמצאו ${alternativeDuplicates.length} משימות ללא חיבור Monday (כולל מוגנות). האם למחוק גם משימות מוגנות?`)) {
            let deletedCount = 0;
            for (const task of alternativeDuplicates) {
              await Task.delete(task.id);
              deletedCount++;
            }
            console.log(`✅ Deleted ${deletedCount} unconnected tasks (including protected)`);
            alert(`✅ נמחקו ${deletedCount} משימות לא מחוברות (כולל מוגנות)`);
            await loadData();
          }
        } else {
          alert('לא נמצאו משימות כפולות למחיקה');
        }
        return;
      }
      
      // Show sample before deletion
      console.log('🚨 SAMPLE DUPLICATE TASKS TO DELETE:');
      duplicateTasks.slice(0, 10).forEach((task, i) => {
        console.log(`${i+1}. "${task.title}" - ID: ${task.id}, Board: ${task.monday_board_id}, Item: ${task.monday_item_id}, isFromMonday: ${task.isFromMonday}, isProtected: ${task.isProtected}`);
      });
      
      const finalConfirm = window.confirm(`⚠️ נמצאו ${duplicateTasks.length} משימות כפולות. חלקן מסומנות כמוגנות. האם למחוק בכל זאת?`);
      if (!finalConfirm) {
        alert('פעולה בוטלה');
        setIsLoading(false);
        return;
      }
      
      let deletedCount = 0;
      for (const task of duplicateTasks) {
        await Task.delete(task.id);
        deletedCount++;
      }
      
      console.log(`✅ Deleted ${deletedCount} duplicate tasks (including protected ones)`);
      alert(`✅ נמחקו ${deletedCount} משימות כפולות (כולל מוגנות)`);
      
      await loadData();
      
    } catch (error) {
      console.error('❌ Error cleaning duplicates:', error);
      alert(`❌ שגיאה בניקוי כפילויות: ${error.message}`);
    }
    setIsLoading(false);
  };

  const cleanupOrphanedTasks = async () => {
    if (!window.confirm('⚠️ זה ימחק משימות יתומות (ללא דגלים מיוחדים וללא חיבור Monday). המשך?')) return;
    
    setIsLoading(true);
    try {
      console.log('🧹 Starting orphaned tasks cleanup...');
      
      // Find tasks without any Monday connection and no special flags
      const orphanedTasks = await Task.filter({
        monday_board_id: null,
        monday_item_id: null,
        isDemo: { $ne: true },
        isProtected: { $ne: true },
        isFromMonday: { $ne: true }
      });
      
      console.log(`🔍 Found ${orphanedTasks.length} orphaned tasks to delete`);
      
      if (orphanedTasks.length === 0) {
        alert('לא נמצאו משימות יתומות למחיקה');
        return;
      }
      
      // Show sample before deletion
      console.log('🚨 SAMPLE ORPHANED TASKS TO DELETE:');
      orphanedTasks.slice(0, 10).forEach((task, i) => {
        console.log(`${i+1}. "${task.title}" - ID: ${task.id}, Created: ${task.created_date}`);
      });
      
      let deletedCount = 0;
      for (const task of orphanedTasks) {
        await Task.delete(task.id);
        deletedCount++;
      }
      
      console.log(`✅ Deleted ${deletedCount} orphaned tasks`);
      alert(`✅ נמחקו ${deletedCount} משימות יתומות`);
      
      await loadData();
      
    } catch (error) {
      console.error('❌ Error cleaning orphaned tasks:', error);
      alert(`❌ שגיאה בניקוי משימות יתומות: ${error.message}`);
    }
    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Database className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">מצב המערכת</h1>
          <p className="text-gray-600">בדיקה מפורטת של כל הסנכרונים עם Monday.com</p>
        </div>
        <Button onClick={loadData} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          רענן
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>שגיאה!</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(systemStatus).filter(([key]) => 
          ['tasks', 'clients', 'reconciliations', 'clientAccounts', 'therapists', 'dashboards'].includes(key)
        ).map(([key, data]) => (
          <Card key={key} className={`border-2 ${
            data.status === 'working' ? 'border-green-200 bg-green-50' :
            data.status === 'partial' ? 'border-yellow-200 bg-yellow-50' :
            data.status === 'empty' ? 'border-gray-200 bg-gray-50' :
            'border-red-200 bg-red-50'
          }`}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <StatusIcon status={data.status} />
                {key === 'clients' ? 'לקוחות' :
                 key === 'tasks' ? 'משימות' :
                 key === 'reconciliations' ? 'התאמות' :
                 key === 'clientAccounts' ? 'חשבונות בנק' :
                 key === 'therapists' ? 'מטפלים' : // Added Therapist display name
                 key === 'dashboards' ? 'לוחות Monday' : key}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm text-gray-600">{data.details}</p>
                
                {key !== 'dashboards' && (
                  <div className="space-y-2">
                    {/* ID Status Breakdown */}
                    <div className="bg-white p-3 rounded border space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">סה"כ רשומות:</span>
                        <Badge variant="outline" className="font-bold">{data.total || 0}</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-green-700">עם 3 מזהים (מלא):</span>
                        <Badge className="bg-green-100 text-green-800 font-bold">{data.withAllIds || 0}</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-orange-700">חסר Monday Item ID:</span>
                        <Badge className="bg-orange-100 text-orange-800 font-bold">{data.missingItemId?.length || 0}</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-red-700">חסר חיבור Monday:</span>
                        <Badge className="bg-red-100 text-red-800 font-bold">{data.missingBoth?.length || 0}</Badge>
                      </div>
                    </div>
                    
                    {/* Special flags for tasks */}
                    {key === 'tasks' && data.taskFlags && (
                      <div className="bg-blue-50 p-3 rounded border space-y-1">
                        <h5 className="text-sm font-medium text-blue-800">דגלים מיוחדים:</h5>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <span>Demo: {data.taskFlags.isDemo}</span>
                          <span>Protected: {data.taskFlags.isProtected}</span>
                          <span>From Monday: {data.taskFlags.isFromMonday}</span>
                          <span>No flags: {data.taskFlags.noFlags}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {key === 'dashboards' && (
                  <div className="space-y-2">
                    <div className="bg-white p-3 rounded border space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">סה"כ רשומות Dashboard:</span>
                        <Badge variant="outline" className="font-bold text-red-600">{data.totalDashboards}</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">לוחות מוגדרים:</span>
                        <Badge className="bg-green-100 text-green-800 font-bold">{data.configured}</Badge>
                      </div>
                      {/* Duplicate types display removed as per outline */}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {/* New cards for total expected/actual and board breakdown */}
        {systemStatus.expectedTotal !== undefined && (
          <Card key="total-sync" className="border-2 border-purple-200 bg-purple-50">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Monitor className="w-4 h-4 text-purple-500" />
                סיכום סנכרון כללי
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-white p-3 rounded border space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">סה"כ פריטים צפויים (מ-Monday):</span>
                  <Badge variant="outline" className="font-bold">{systemStatus.expectedTotal}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">סה"כ פריטים בפועל (בבסיס נתונים):</span>
                  <Badge className={`font-bold ${systemStatus.actualTotal === systemStatus.expectedTotal ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {systemStatus.actualTotal}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">הפרש (חיובי = עודף, שלילי = חסר):</span>
                  <Badge className={`font-bold ${systemStatus.actualTotal - systemStatus.expectedTotal === 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {systemStatus.actualTotal - systemStatus.expectedTotal}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        {systemStatus.boardBreakdown && systemStatus.boardBreakdown.length > 0 && (
          <Card key="board-breakdown" className="md:col-span-2 lg:col-span-3 border-2 border-blue-200 bg-blue-50">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Database className="w-4 h-4 text-blue-500" />
                פירוט סנכרון לוחות Monday
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {systemStatus.boardBreakdown.map(board => (
                  <div key={board.type} className="bg-white p-3 rounded border">
                    <h5 className="font-semibold text-sm mb-1">{board.name} ({board.type})</h5>
                    <div className="text-xs space-y-1">
                      <div className="flex justify-between">
                        <span>צפוי:</span>
                        <Badge variant="outline">{board.expected}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>בפועל:</span>
                        <Badge className={`${board.actual === board.expected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {board.actual}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>הפרש:</span>
                        <Badge className={`${board.actual - board.expected === 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {board.actual - board.expected}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Summary Alert */}
      <Alert>
        <Monitor className="h-4 w-4" />
        <AlertDescription>
          <strong>מצב כללי:</strong> בדוק את הכרטיסים למעלה כדי לראות מה עובד ומה צריך תיקון. 
          ירוק = עובד מושלם (ללוחות Monday), צהוב = עובד חלקית (חלק מהרשומות מסונכרנות), אדום = לא עובד.
        </AlertDescription>
      </Alert>

      {/* Cleanup Actions */}
      <div className="mt-8 space-y-4">
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="text-orange-800">🧹 פעולות ניקוי נדרשות</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {systemStatus.tasks?.taskFlags && (systemStatus.tasks.taskFlags.isFromMonday - systemStatus.tasks.withAllIds > 0) && (
              <div className="p-4 bg-white rounded border border-red-300">
                <h4 className="font-semibold text-red-700 mb-2">🔄 כפילויות Monday - דחוף!</h4>
                <p className="text-sm text-gray-600 mb-3">
                  <strong>בעיה קריטית:</strong> יש {systemStatus.tasks.taskFlags.isFromMonday} משימות מסומנות "From Monday" 
                  אבל רק {systemStatus.tasks.withAllIds} עם IDs מלאים. 
                  <br/>
                  <strong>כלומר: {systemStatus.tasks.taskFlags.isFromMonday - systemStatus.tasks.withAllIds} כפילויות שצריך למחוק!</strong>
                </p>
                <div className="bg-red-50 p-3 rounded mb-3 text-sm">
                  <strong>מה זה אומר:</strong> המערכת סנכרנה משימות מ-Monday פעמיים - פעם אחת עם IDs נכונים, 
                  ופעם שנייה בלי IDs. הכפילויות מבלבלות את המערכת.
                </div>
                <Button 
                  onClick={cleanupMondayDuplicates}
                  variant="destructive" 
                  size="lg"
                  disabled={isLoading}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold"
                >
                  🗑️ נקה כפילויות Monday ({systemStatus.tasks.taskFlags.isFromMonday - systemStatus.tasks.withAllIds} משימות)
                </Button>
              </div>
            )}

            {systemStatus.tasks?.missingBoth?.length > 50 && (
              <div className="p-4 bg-white rounded border border-orange-300">
                <h4 className="font-semibold text-orange-700 mb-2">👻 משימות יתומות</h4>
                <p className="text-sm text-gray-600 mb-3">
                  יש {systemStatus.tasks.missingBoth.length} משימות ללא חיבור Monday וללא דגלים מיוחדים.
                  זה כנראה משימות ישנות או נתוני בדיקה.
                </p>
                <div className="flex gap-2">
                  <Button 
                    onClick={showOrphanedTasks}
                    variant="outline" 
                    size="sm"
                  >
                    🔍 בדוק משימות יתומות
                  </Button>
                  <Button 
                    onClick={cleanupOrphanedTasks}
                    variant="destructive" 
                    size="sm"
                    disabled={isLoading}
                  >
                    🗑️ נקה משימות יתומות
                  </Button>
                </div>
              </div>
            )}

            {systemStatus.dashboards?.totalDashboards > 12 && (
              <div className="p-4 bg-white rounded border">
                <h4 className="font-semibold text-red-700 mb-2">🚨 Dashboard כפילויות</h4>
                <p className="text-sm text-gray-600 mb-3">
                  יש {systemStatus.dashboards.totalDashboards} רשומות Dashboard במקום 12. יש לנקות כפילויות.
                </p>
                <Button 
                  onClick={cleanupDashboardDuplicates}
                  variant="destructive" 
                  size="sm"
                  disabled={isLoading}
                >
                  🗑️ נקה כפילויות Dashboard
                </Button>
              </div>
            )}

            {/* Emergency reset button */}
            <div className="p-4 bg-red-100 rounded border border-red-300">
              <h4 className="font-semibold text-red-800 mb-2">⚠️ ניקוי כללי - אפשרות גרעין</h4>
              <p className="text-sm text-gray-700 mb-3">
                אם הכל מבולבל - אפשר למחוק את כל המשימות שלא מסונכרנות כמו שצריך ולהתחיל מחדש עם סנכרון נקי.
              </p>
              <Button 
                onClick={() => {
                  if (window.confirm('⚠️⚠️⚠️ זה ימחק את כל המשימות שלא מסונכרנות מושלם עם Monday (כולל יתומות וכפילויות). רק משימות מסונכרנות יישארו. האם אתה בטוח?')) {
                    // Execute sequentially
                    cleanupMondayDuplicates().then(() => cleanupOrphanedTasks());
                  }
                }}
                variant="destructive" 
                size="lg"
                disabled={isLoading}
                className="w-full bg-red-800 hover:bg-red-900"
              >
                🔥 ניקוי כללי - השאר רק משימות מסונכרנות
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
