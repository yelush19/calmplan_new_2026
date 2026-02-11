/**
 * Functions module - Real Monday.com integration
 * Replaces the Base44 backend stubs with direct API calls
 */

import * as monday from './mondayClient';
import { entities, exportAllData, clearAllData } from './localDB';

// ===== Monday.com Board API =====
// Used by MondayIntegration page to list available boards

export const mondayBoardApi = async (params) => {
  try {
    if (!monday.hasMondayToken()) {
      return { data: { success: false, error: 'לא הוגדר API Token של Monday.com' } };
    }

    switch (params.action) {
      case 'getAllBoards': {
        const boards = await monday.getAllBoards();
        return { data: { success: true, boards } };
      }
      default:
        return { data: { success: false, error: `Unknown action: ${params.action}` } };
    }
  } catch (error) {
    if (error instanceof monday.MondayRateLimitError) {
      return { data: { rate_limited: true, retry_after_seconds: error.retryAfter } };
    }
    if (error instanceof monday.MondayForbiddenError) {
      return { data: { forbidden: true } };
    }
    return { data: { success: false, error: error.message } };
  }
};

// ===== Monday.com Sync API =====
// Used by MondayIntegration page for all sync operations

export const mondayApi = async (params) => {
  try {
    if (!monday.hasMondayToken()) {
      return { data: { success: false, error: 'לא הוגדר API Token של Monday.com' } };
    }

    switch (params.action) {
      case 'syncClients':
        return await syncClientsFromBoard(params.boardId);

      case 'syncTasks':
      case 'syncFamilyTasks':
      case 'syncWellbeing':
      case 'syncWeeklyPlanning':
        return await syncTasksFromBoard(params.boardId);

      case 'syncReconciliations':
        return await syncReconciliationsFromBoard(params.boardId);

      case 'syncClientAccounts':
        return await syncClientAccountsFromBoard(params.boardId);

      case 'syncTherapists':
        return await syncTherapistsFromBoard(params.boardId);

      case 'purgeAndResync':
        return await purgeAndResync(params.boardId, params.type);

      case 'syncAllBoards':
        return await syncAllBoards();

      case 'emergencyCleanup':
        return await emergencyCleanup();

      case 'reverseSyncAllBoards':
        return { data: { success: false, error: 'סנכרון הפוך עדיין לא נתמך במצב עצמאי' } };

      case 'addColumnToBoard':
        return await handleAddColumn(params);

      case 'createMonthlyBoards':
        return { data: { success: false, error: 'יצירת לוחות חודשיים עדיין לא נתמכת במצב עצמאי' } };

      default:
        return { data: { success: false, error: `Unknown action: ${params.action}` } };
    }
  } catch (error) {
    if (error instanceof monday.MondayRateLimitError) {
      return { data: { rate_limited: true, retry_after_seconds: error.retryAfter } };
    }
    if (error instanceof monday.MondayForbiddenError) {
      return { data: { forbidden: true, error: 'גישה נדחתה - בדקי את ה-API Token' } };
    }
    console.error('[mondayApi] Error:', error);
    return { data: { success: false, error: error.message } };
  }
};

// ===== Reports Automation =====

export const mondayReportsAutomation = async (params) => {
  return { data: { success: false, error: 'יצירת דיווחים חודשיים עדיין לא נתמכת במצב עצמאי' } };
};

// ===== Sync Functions =====

async function syncClientsFromBoard(boardId) {
  const log = [];
  const timestamp = () => `[${new Date().toLocaleTimeString('he-IL')}]`;

  log.push(`${timestamp()} מתחיל סנכרון לקוחות מלוח ${boardId}...`);

  // Fetch items from Monday
  const items = await monday.getBoardItems(boardId);
  log.push(`${timestamp()} נטענו ${items.length} פריטים מ-Monday.com`);

  // Get existing local clients
  const existingClients = await entities.Client.list();
  const clientsByMondayId = {};
  existingClients.forEach(c => {
    if (c.monday_item_id) clientsByMondayId[String(c.monday_item_id)] = c;
  });

  log.push(`${timestamp()} נמצאו ${existingClients.length} לקוחות מקומיים (${Object.keys(clientsByMondayId).length} עם monday_item_id)`);

  let created = 0, updated = 0;
  const errors = [];

  for (const item of items) {
    try {
      const clientData = monday.mapMondayItemToClient(item, boardId);

      const existing = clientsByMondayId[String(item.id)];
      if (existing) {
        await entities.Client.update(existing.id, clientData);
        updated++;
      } else {
        await entities.Client.create(clientData);
        created++;
      }
    } catch (err) {
      errors.push(`שגיאה בפריט "${item.name}": ${err.message}`);
      log.push(`${timestamp()} שגיאה: ${item.name} - ${err.message}`);
    }
  }

  log.push(`${timestamp()} סנכרון הושלם: ${created} נוצרו, ${updated} עודכנו, ${errors.length} שגיאות`);

  return {
    data: {
      success: true,
      created,
      updated,
      deleted: 0,
      errors,
      log
    }
  };
}

async function syncTasksFromBoard(boardId) {
  const log = [];
  const timestamp = () => `[${new Date().toLocaleTimeString('he-IL')}]`;

  log.push(`${timestamp()} מתחיל סנכרון משימות מלוח ${boardId}...`);

  const items = await monday.getBoardItems(boardId);
  log.push(`${timestamp()} נטענו ${items.length} פריטים מ-Monday.com`);

  const existingTasks = await entities.Task.list();
  const tasksByMondayId = {};
  existingTasks.forEach(t => {
    if (t.monday_item_id) tasksByMondayId[String(t.monday_item_id)] = t;
  });

  log.push(`${timestamp()} נמצאו ${existingTasks.length} משימות מקומיות`);

  let created = 0, updated = 0;
  const errors = [];

  for (const item of items) {
    try {
      const taskData = monday.mapMondayItemToTask(item, boardId);

      const existing = tasksByMondayId[String(item.id)];
      if (existing) {
        await entities.Task.update(existing.id, taskData);
        updated++;
      } else {
        await entities.Task.create(taskData);
        created++;
      }
    } catch (err) {
      errors.push(`שגיאה בפריט "${item.name}": ${err.message}`);
      log.push(`${timestamp()} שגיאה: ${item.name} - ${err.message}`);
    }
  }

  log.push(`${timestamp()} סנכרון הושלם: ${created} נוצרו, ${updated} עודכנו, ${errors.length} שגיאות`);

  return {
    data: {
      success: true,
      created,
      updated,
      deleted: 0,
      errors,
      log
    }
  };
}

async function syncReconciliationsFromBoard(boardId) {
  const log = [];
  const timestamp = () => `[${new Date().toLocaleTimeString('he-IL')}]`;

  log.push(`${timestamp()} מתחיל סנכרון התאמות מלוח ${boardId}...`);

  const items = await monday.getBoardItems(boardId);
  log.push(`${timestamp()} נטענו ${items.length} פריטים מ-Monday.com`);

  const existingRecs = await entities.AccountReconciliation.list();
  const recsByMondayId = {};
  existingRecs.forEach(r => {
    if (r.monday_item_id) recsByMondayId[String(r.monday_item_id)] = r;
  });

  let created = 0, updated = 0;
  const errors = [];

  for (const item of items) {
    try {
      const recData = monday.mapMondayItemToReconciliation(item, boardId);

      const existing = recsByMondayId[String(item.id)];
      if (existing) {
        await entities.AccountReconciliation.update(existing.id, recData);
        updated++;
      } else {
        await entities.AccountReconciliation.create(recData);
        created++;
      }
    } catch (err) {
      errors.push(`שגיאה בפריט "${item.name}": ${err.message}`);
    }
  }

  log.push(`${timestamp()} סנכרון הושלם: ${created} נוצרו, ${updated} עודכנו`);

  return {
    data: { success: true, created, updated, deleted: 0, errors, log }
  };
}

async function syncClientAccountsFromBoard(boardId) {
  const log = [];
  const timestamp = () => `[${new Date().toLocaleTimeString('he-IL')}]`;

  log.push(`${timestamp()} מתחיל סנכרון חשבונות לקוח מלוח ${boardId}...`);

  const items = await monday.getBoardItems(boardId);
  log.push(`${timestamp()} נטענו ${items.length} פריטים מ-Monday.com`);

  const existing = await entities.ClientAccount.list();
  const byMondayId = {};
  existing.forEach(a => {
    if (a.monday_item_id) byMondayId[String(a.monday_item_id)] = a;
  });

  let created = 0, updated = 0;
  const errors = [];

  for (const item of items) {
    try {
      const data = monday.mapMondayItemToClientAccount(item, boardId);

      const ex = byMondayId[String(item.id)];
      if (ex) {
        await entities.ClientAccount.update(ex.id, data);
        updated++;
      } else {
        await entities.ClientAccount.create(data);
        created++;
      }
    } catch (err) {
      errors.push(`שגיאה בפריט "${item.name}": ${err.message}`);
    }
  }

  log.push(`${timestamp()} סנכרון הושלם: ${created} נוצרו, ${updated} עודכנו`);

  return {
    data: { success: true, created, updated, deleted: 0, errors, log }
  };
}

async function syncTherapistsFromBoard(boardId) {
  const log = [];
  const timestamp = () => `[${new Date().toLocaleTimeString('he-IL')}]`;

  log.push(`${timestamp()} מתחיל סנכרון מטפלים מלוח ${boardId}...`);

  const items = await monday.getBoardItems(boardId);
  log.push(`${timestamp()} נטענו ${items.length} פריטים מ-Monday.com`);

  const existing = await entities.Therapist.list();
  const byMondayId = {};
  existing.forEach(t => {
    if (t.monday_item_id) byMondayId[String(t.monday_item_id)] = t;
  });

  let created = 0, updated = 0;
  const errors = [];

  for (const item of items) {
    try {
      const data = monday.mapMondayItemToTherapist(item, boardId);

      const ex = byMondayId[String(item.id)];
      if (ex) {
        await entities.Therapist.update(ex.id, data);
        updated++;
      } else {
        await entities.Therapist.create(data);
        created++;
      }
    } catch (err) {
      errors.push(`שגיאה בפריט "${item.name}": ${err.message}`);
    }
  }

  log.push(`${timestamp()} סנכרון הושלם: ${created} נוצרו, ${updated} עודכנו`);

  return {
    data: { success: true, created, updated, deleted: 0, errors, log }
  };
}

// ===== Purge and Resync =====

async function purgeAndResync(boardId, type) {
  const log = [];
  const timestamp = () => `[${new Date().toLocaleTimeString('he-IL')}]`;

  log.push(`${timestamp()} מתחיל מחיקה וסנכרון מחדש עבור ${type}...`);

  // Determine which entity to purge
  const entityMap = {
    clients: { entity: entities.Client, syncFn: syncClientsFromBoard },
    reports_main: { entity: entities.Task, syncFn: syncTasksFromBoard },
    reports_126_856_2025: { entity: entities.Task, syncFn: syncTasksFromBoard },
    reports_126_856_2024: { entity: entities.Task, syncFn: syncTasksFromBoard },
    weekly_tasks: { entity: entities.Task, syncFn: syncTasksFromBoard },
    balance_sheets: { entity: entities.Task, syncFn: syncTasksFromBoard },
    family_tasks: { entity: entities.Task, syncFn: syncTasksFromBoard },
    wellbeing: { entity: entities.Task, syncFn: syncTasksFromBoard },
    weekly_planning: { entity: entities.Task, syncFn: syncTasksFromBoard },
    reconciliations: { entity: entities.AccountReconciliation, syncFn: syncReconciliationsFromBoard },
    client_accounts: { entity: entities.ClientAccount, syncFn: syncClientAccountsFromBoard },
    therapists: { entity: entities.Therapist, syncFn: syncTherapistsFromBoard },
  };

  const config = entityMap[type];
  if (!config) {
    return { data: { success: false, error: `Unknown board type: ${type}`, log } };
  }

  // Delete local items matching this board
  try {
    const allItems = await config.entity.list();
    const toDelete = allItems.filter(item => String(item.monday_board_id) === String(boardId));

    log.push(`${timestamp()} מוחק ${toDelete.length} פריטים מקומיים...`);

    for (const item of toDelete) {
      await config.entity.delete(item.id);
    }

    log.push(`${timestamp()} נמחקו ${toDelete.length} פריטים. מתחיל סנכרון מחדש...`);
  } catch (err) {
    log.push(`${timestamp()} שגיאה במחיקה: ${err.message}`);
    return { data: { success: false, error: err.message, log } };
  }

  // Re-sync from Monday
  const syncResult = await config.syncFn(boardId);

  // Merge logs
  syncResult.data.log = [...log, ...(syncResult.data.log || [])];

  return syncResult;
}

// ===== Sync All Boards =====

async function syncAllBoards() {
  const log = [];
  const timestamp = () => `[${new Date().toLocaleTimeString('he-IL')}]`;

  log.push(`${timestamp()} מתחיל סנכרון כל הלוחות...`);

  // Load board configs from Dashboard entity
  const dashboards = await entities.Dashboard.list();
  const activeBoards = dashboards.filter(d => d.monday_board_id);

  if (activeBoards.length === 0) {
    return { data: { success: false, error: 'לא נמצאו לוחות מוגדרים', log } };
  }

  log.push(`${timestamp()} נמצאו ${activeBoards.length} לוחות פעילים`);

  const syncActionMap = {
    clients: syncClientsFromBoard,
    reports_main: syncTasksFromBoard,
    reports_126_856_2025: syncTasksFromBoard,
    reports_126_856_2024: syncTasksFromBoard,
    weekly_tasks: syncTasksFromBoard,
    balance_sheets: syncTasksFromBoard,
    family_tasks: syncTasksFromBoard,
    wellbeing: syncTasksFromBoard,
    weekly_planning: syncTasksFromBoard,
    reconciliations: syncReconciliationsFromBoard,
    client_accounts: syncClientAccountsFromBoard,
    therapists: syncTherapistsFromBoard,
  };

  const results = {};
  let totalCreated = 0, totalUpdated = 0;

  for (const board of activeBoards) {
    const syncFn = syncActionMap[board.type];
    if (!syncFn) {
      results[board.type] = { success: false, error: `No sync function for type: ${board.type}`, boardName: board.name };
      continue;
    }

    try {
      log.push(`${timestamp()} מסנכרן ${board.name || board.type}...`);
      const result = await syncFn(board.monday_board_id);

      if (result.data.success) {
        results[board.type] = {
          success: true,
          boardName: board.name,
          created: result.data.created,
          updated: result.data.updated,
        };
        totalCreated += result.data.created || 0;
        totalUpdated += result.data.updated || 0;
      } else {
        results[board.type] = {
          success: false,
          boardName: board.name,
          error: result.data.error
        };
      }

      // Small delay between boards to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (err) {
      results[board.type] = {
        success: false,
        boardName: board.name,
        error: err.message
      };
    }
  }

  log.push(`${timestamp()} סנכרון כל הלוחות הושלם: ${totalCreated} נוצרו, ${totalUpdated} עודכנו`);

  return {
    data: {
      success: true,
      results,
      totalCreated,
      totalUpdated,
      log
    }
  };
}

// ===== Emergency Cleanup =====

async function emergencyCleanup() {
  const log = [];
  const timestamp = () => `[${new Date().toLocaleTimeString('he-IL')}]`;

  log.push(`${timestamp()} מתחיל ניקוי כפילויות...`);

  // Find and remove duplicate tasks (same monday_item_id)
  const allTasks = await entities.Task.list();
  const seen = new Map();
  let deleted = 0;

  for (const task of allTasks) {
    if (task.monday_item_id) {
      if (seen.has(task.monday_item_id)) {
        // Keep the newer one, delete the older one
        const existing = seen.get(task.monday_item_id);
        const existingDate = new Date(existing.updated_date || existing.created_date);
        const currentDate = new Date(task.updated_date || task.created_date);

        if (currentDate > existingDate) {
          await entities.Task.delete(existing.id);
          seen.set(task.monday_item_id, task);
        } else {
          await entities.Task.delete(task.id);
        }
        deleted++;
      } else {
        seen.set(task.monday_item_id, task);
      }
    }
  }

  // Same for clients
  const allClients = await entities.Client.list();
  const seenClients = new Map();

  for (const client of allClients) {
    if (client.monday_item_id) {
      if (seenClients.has(client.monday_item_id)) {
        const existing = seenClients.get(client.monday_item_id);
        const existingDate = new Date(existing.updated_date || existing.created_date);
        const currentDate = new Date(client.updated_date || client.created_date);

        if (currentDate > existingDate) {
          await entities.Client.delete(existing.id);
          seenClients.set(client.monday_item_id, client);
        } else {
          await entities.Client.delete(client.id);
        }
        deleted++;
      } else {
        seenClients.set(client.monday_item_id, client);
      }
    }
  }

  const remaining = (await entities.Task.list()).length + (await entities.Client.list()).length;

  log.push(`${timestamp()} ניקוי הושלם: ${deleted} כפילויות נמחקו, ${remaining} פריטים נשארו`);

  return {
    data: { success: true, deleted, remaining, log }
  };
}

// ===== Add Column =====

async function handleAddColumn(params) {
  try {
    const column = await monday.addColumnToBoard(
      params.boardId,
      params.columnTitle,
      params.columnType,
      params.columnSettings
    );

    return {
      data: {
        success: true,
        column: { id: column.id, title: column.title }
      }
    };
  } catch (err) {
    return { data: { success: false, error: err.message } };
  }
}

// ===== Excel Import/Export (stubs) =====

export const importClientsFromExcel = async () => {
  return { data: { success: false, error: 'ייבוא מ-Excel עדיין לא נתמך במצב עצמאי' } };
};

export const importClientAccounts = async () => {
  return { data: { success: false, error: 'ייבוא חשבונות עדיין לא נתמך במצב עצמאי' } };
};

export const exportClientsToExcel = async () => {
  return { data: { success: false, error: 'ייצוא ל-Excel עדיין לא נתמך במצב עצמאי' } };
};

export const exportClientAccountsTemplate = async () => {
  return { data: { success: false, error: 'ייצוא תבנית עדיין לא נתמך במצב עצמאי' } };
};

// ===== Monday.com Specific Stubs =====

export const syncClientIdsToReports = async () => {
  return { data: { success: false, error: 'Not available in standalone mode' } };
};

export const priceWiseApi = async () => {
  return { data: { success: false, error: 'Not available in standalone mode' } };
};

export const getMondayData = async () => {
  return { data: { success: false, error: 'Use mondayApi instead' } };
};

export const filterMondayItems = async () => {
  return { data: { success: false, error: 'Use mondayApi instead' } };
};

export const syncMondayReports = async () => {
  return { data: { success: false, error: 'Use mondayApi instead' } };
};

export const syncReconciliationTasks = async () => {
  return { data: { success: false, error: 'Use mondayApi instead' } };
};

// Exported for direct use by FullSync page
export { syncAllBoards };

// ===== Task Generation (stubs) =====

export const generateHomeTasks = async () => {
  return { data: { success: false, error: 'Not available in standalone mode' } };
};

export const getWeeklyPlan = async () => {
  return { data: { success: false, error: 'Not available in standalone mode' } };
};

export const createWeeklyPlan = async () => {
  return { data: { success: false, error: 'Not available in standalone mode' } };
};

export const generateProcessTasks = async () => {
  return { data: { success: false, error: 'Not available in standalone mode' } };
};

// ===== Seed Data =====

export const seedData = async () => {
  const { default: seedDemoData } = await import('./seedDemoData');
  return seedDemoData();
};

// ===== Backup =====

export const emergencyBackup = async () => {
  const data = exportAllData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `litaycalmplan-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(url);
  a.remove();
  return { data: { success: true, message: 'Backup downloaded' } };
};

// ===== Reset =====

export const emergencyReset = async () => {
  if (window.confirm('Are you sure? This will delete ALL data!')) {
    clearAllData();
    window.location.reload();
  }
  return { data: { success: true } };
};
