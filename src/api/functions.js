/**
 * Functions module - Real Monday.com integration
 * Replaces the Base44 backend stubs with direct API calls
 */

import * as monday from './mondayClient';
import { base44, exportAllData, importAllData, clearAllData } from './base44Client';

const entities = base44.entities;
import { getDueDateForCategory, isClient874 } from '@/config/taxCalendar2026';

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
        return await reverseSyncAllBoards();

      case 'pushClientToMonday':
        return await handlePushClientToMonday(params);

      case 'pushTaskToMonday':
        return await handlePushTaskToMonday(params);

      case 'addColumnToBoard':
        return await handleAddColumn(params);

      case 'createMonthlyBoards':
        return await handleCreateMonthlyBoards(params);

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

// ===== Israeli Accounting Process Definitions =====
//
// Process types and their frequencies (per client):
//   מע"מ          - חודשי / דו-חודשי / לא רלוונטי (from vat_reporting_frequency)
//   מקדמות מס     - חודשי / דו-חודשי / לא רלוונטי (from tax_advances_frequency)
//   שכר           - חודשי / לא רלוונטי (from payroll_frequency)
//   ביטוח לאומי   - רק ללקוחות עם שכר (payroll), חודשי
//   ניכויים       - רק ללקוחות עם שכר (payroll), חודשי או דו-חודשי
//   דוח שנתי      - שנתי, יעד 31 במאי
//
// Only active clients (status === 'active') get tasks.

const PROCESS_TEMPLATES = {
  vat: {
    name: 'דיווח מע"מ',
    category: 'מע"מ',
    frequencyField: 'vat_reporting_frequency',
    dayOfMonth: 19, // online filing; 874 clients get 23 via taxCalendar
    requiresPayroll: false,
  },
  payroll: {
    name: 'דיווח שכר',
    category: 'שכר',
    frequencyField: 'payroll_frequency',
    dayOfMonth: 15,
    requiresPayroll: true,
  },
  tax_advances: {
    name: 'מקדמות מס',
    category: 'מקדמות מס',
    frequencyField: 'tax_advances_frequency',
    dayOfMonth: 19, // online filing deadline
    requiresPayroll: false,
  },
  social_security: {
    name: 'ביטוח לאומי',
    category: 'ביטוח לאומי',
    frequencyField: null, // monthly when payroll exists
    dayOfMonth: 15,
    requiresPayroll: true,
  },
  deductions: {
    name: 'ניכויים במקור',
    category: 'ניכויים',
    frequencyField: null, // monthly or bimonthly, follows payroll
    dayOfMonth: 19, // online filing deadline
    requiresPayroll: true,
  },
  annual_report: {
    name: 'דוח שנתי',
    category: 'דוח שנתי',
    frequencyField: null,
    dayOfMonth: 31,
    dueMonth: 5,
    frequency: 'yearly',
    requiresPayroll: false,
  },
};

// Map client service_types → which process templates apply
const SERVICE_TYPE_TO_TEMPLATES = {
  'bookkeeping': ['vat', 'payroll', 'tax_advances', 'social_security', 'deductions'],
  'payroll': ['payroll', 'social_security', 'deductions'],
  'tax_reports': ['annual_report', 'tax_advances'],
  'vat': ['vat'],
  'annual_reports': ['annual_report'],
  'full_service': ['vat', 'payroll', 'tax_advances', 'social_security', 'annual_report', 'deductions'],
};

// Bi-monthly period names (due month → period name)
const BIMONTHLY_PERIOD_NAMES = {
  2: 'ינואר-פברואר',
  4: 'מרץ-אפריל',
  6: 'מאי-יוני',
  8: 'יולי-אוגוסט',
  10: 'ספטמבר-אוקטובר',
  12: 'נובמבר-דצמבר',
};

const BIMONTHLY_DUE_MONTHS = [2, 4, 6, 8, 10, 12];

const MONTH_NAMES = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

/**
 * Check if client has payroll service active.
 */
function clientHasPayroll(client) {
  const services = client.service_types || [];
  const hasPayrollService = services.includes('payroll') || services.includes('full_service') || services.includes('bookkeeping');
  const payrollFreq = client.reporting_info?.payroll_frequency;
  return hasPayrollService && payrollFreq !== 'not_applicable';
}

/**
 * Get the templates applicable to a client based on service_types.
 * Filters out payroll-dependent templates if client has no payroll.
 */
function getClientTemplates(client) {
  const serviceTypes = client.service_types || [];
  if (serviceTypes.length === 0) return [];

  const templateKeys = new Set();
  serviceTypes.forEach(st => {
    const templates = SERVICE_TYPE_TO_TEMPLATES[st];
    if (templates) templates.forEach(t => templateKeys.add(t));
  });

  // Remove payroll-dependent templates if client has no payroll
  const hasPayroll = clientHasPayroll(client);
  if (!hasPayroll) {
    templateKeys.delete('payroll');
    templateKeys.delete('social_security');
    templateKeys.delete('deductions');
  }

  return [...templateKeys];
}

/**
 * Get client frequency for a template.
 * Returns: 'monthly' | 'bimonthly' | 'not_applicable' | 'yearly'
 */
function getClientFrequency(templateKey, client) {
  const template = PROCESS_TEMPLATES[templateKey];
  if (!template) return 'not_applicable';
  if (template.frequency === 'yearly') return 'yearly';
  if (template.frequencyField) {
    const freq = client.reporting_info?.[template.frequencyField] || 'monthly';
    // No quarterly - only monthly or bimonthly (except semi_annual for deductions)
    if (freq === 'quarterly') return 'bimonthly';
    return freq;
  }
  // social_security: monthly (when payroll exists)
  // deductions: use client's deductions_frequency setting
  if (templateKey === 'social_security') return client.reporting_info?.social_security_frequency || 'monthly';
  if (templateKey === 'deductions') return client.reporting_info?.deductions_frequency || 'monthly';
  return 'monthly';
}

/**
 * Check if a process template should run for a given month for a specific client.
 */
function shouldRunForMonth(templateKey, month, client) {
  const freq = getClientFrequency(templateKey, client);
  if (freq === 'not_applicable') return false;
  if (freq === 'yearly') return month === PROCESS_TEMPLATES[templateKey]?.dueMonth;
  if (freq === 'bimonthly') return BIMONTHLY_DUE_MONTHS.includes(month);
  // Semi-annual: task in month 7 (for Jan-Jun) and month 1 (for Jul-Dec)
  if (freq === 'semi_annual') return month === 7 || month === 1;
  return true; // monthly
}

/**
 * Get the description for a report item based on its frequency.
 */
function getReportDescription(templateKey, month, year, client) {
  const template = PROCESS_TEMPLATES[templateKey];
  const freq = getClientFrequency(templateKey, client);

  if (freq === 'yearly') {
    return `דוח שנתי לשנת ${year - 1}`;
  }
  if (freq === 'semi_annual') {
    // Month 7 = report for Jan-Jun, Month 1 = report for Jul-Dec (previous year)
    if (month === 7) return `${template.name} עבור ינואר-יוני ${year}`;
    if (month === 1) return `${template.name} עבור יולי-דצמבר ${year - 1}`;
    return `${template.name} חצי שנתי ${year}`;
  }
  if (freq === 'bimonthly') {
    const periodName = BIMONTHLY_PERIOD_NAMES[month] || '';
    return `${template.name} ${periodName} ${year}`;
  }
  // Monthly - report for previous month
  const reportMonthIdx = month - 2; // e.g. Feb(2) -> Jan index(0)
  const reportMonthName = MONTH_NAMES[reportMonthIdx < 0 ? 11 : reportMonthIdx];
  const reportYear = reportMonthIdx < 0 ? year - 1 : year;
  return `${template.name} ${reportMonthName} ${reportYear}`;
}

/**
 * Create monthly report items in the appropriate Monday board.
 * Uses the same logic as ClientRecurringTasks.jsx for service→template mapping.
 */
export const mondayReportsAutomation = async (params) => {
  const { targetYear, targetMonth } = params;
  const log = [];
  const timestamp = () => `[${new Date().toLocaleTimeString('he-IL')}]`;

  try {
    if (!monday.hasMondayToken()) {
      return { data: { success: false, error: 'לא הוגדר API Token של Monday.com' } };
    }

    const year = targetYear || new Date().getFullYear();
    const month = targetMonth || (new Date().getMonth() + 1);
    const monthNum = String(month).padStart(2, '0');

    log.push(`${timestamp()} מתחיל יצירת דיווחים לחודש ${monthNum}.${year}...`);

    // Find the monthly board from Dashboard entities
    const dashboards = await entities.Dashboard.list();
    const monthlyBoard = dashboards.find(d =>
      d.type === `reports_${year}_${monthNum}` && d.monday_board_id
    );

    if (!monthlyBoard) {
      return {
        data: {
          success: false,
          error: `לא נמצא לוח דיווח לחודש ${monthNum}.${year}. יש ליצור קודם לוחות חודשיים בדף האינטגרציה.`,
          log
        }
      };
    }

    const boardId = monthlyBoard.monday_board_id;
    log.push(`${timestamp()} נמצא לוח: ${monthlyBoard.name} (ID: ${boardId})`);

    // Get board columns to map our fields
    const columns = await monday.getBoardColumns(boardId);
    const colMap = {};
    for (const col of columns) {
      const titleLower = col.title;
      if (titleLower.includes('לקוח')) colMap.client = col.id;
      if (titleLower.includes('סוג')) colMap.reportType = col.id;
      if (titleLower.includes('תאריך')) colMap.dueDate = col.id;
      if (col.type === 'color') colMap.status = col.id;
    }

    // Get all active clients
    const allClients = await entities.Client.list();
    const activeClients = allClients.filter(c => c.status === 'active');

    log.push(`${timestamp()} נמצאו ${activeClients.length} לקוחות פעילים`);

    let created = 0;
    const errors = [];

    for (const client of activeClients) {
      const templateKeys = getClientTemplates(client);

      for (const templateKey of templateKeys) {
        if (!shouldRunForMonth(templateKey, month, client)) continue;

        const template = PROCESS_TEMPLATES[templateKey];
        const description = getReportDescription(templateKey, month, year, client);
        const itemName = `${client.name} - ${description}`;
        // Use tax calendar for the correct due date
        const calendarCategory = template.category;
        const calendarDueDate = getDueDateForCategory(calendarCategory, client, month === 12 ? 12 : month);
        const dueDate = calendarDueDate || `${year}-${monthNum}-19`;

        const columnValues = {};
        if (colMap.status) columnValues[colMap.status] = { label: 'ממתין' };
        if (colMap.client) columnValues[colMap.client] = client.name;
        if (colMap.reportType) columnValues[colMap.reportType] = template.category;
        if (colMap.dueDate) columnValues[colMap.dueDate] = { date: dueDate };

        try {
          await monday.createMondayItem(boardId, itemName, columnValues);
          created++;
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (err) {
          errors.push(`${itemName}: ${err.message}`);
        }
      }
    }

    log.push(`${timestamp()} סיום: נוצרו ${created} דיווחים. ${errors.length} שגיאות.`);

    return {
      data: {
        success: true,
        message: `נוצרו ${created} דיווחים לחודש ${monthNum}.${year}`,
        created,
        errors,
        log
      }
    };
  } catch (error) {
    if (error instanceof monday.MondayRateLimitError) {
      return { data: { rate_limited: true, retry_after_seconds: error.retryAfter } };
    }
    return { data: { success: false, error: error.message, log } };
  }
};

// ===== Sync Functions =====

async function syncClientsFromBoard(boardId) {
  const log = [];
  const timestamp = () => `[${new Date().toLocaleTimeString('he-IL')}]`;

  log.push(`${timestamp()} מתחיל סנכרון לקוחות מלוח ${boardId}...`);

  // Fetch column definitions for title-based mapping
  let columnDefs = null;
  try {
    columnDefs = await monday.getBoardColumns(boardId);
    log.push(`${timestamp()} נטענו ${columnDefs.length} הגדרות עמודות`);
  } catch (err) {
    log.push(`${timestamp()} אזהרה: לא ניתן לטעון הגדרות עמודות, ממשיך עם מיפוי בסיסי`);
  }

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
      const clientData = monday.mapMondayItemToClient(item, boardId, columnDefs);

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

// ===== Monthly Boards Creation =====

const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
];

// Column definitions per board process type
const BOARD_PROCESS_TYPES = {
  reports: {
    namePrefix: 'דיווחים',
    dashboardPrefix: 'reports',
    columns: [
      { title: 'סטטוס', type: 'status' },
      { title: 'לקוח', type: 'text' },
      { title: 'סוג דיווח', type: 'text' },
      { title: 'תאריך יעד', type: 'date' },
      { title: 'אחראי', type: 'people' },
      { title: 'הערות', type: 'long_text' },
    ],
  },
  reconciliations: {
    namePrefix: 'התאמות',
    dashboardPrefix: 'reconciliations',
    columns: [
      { title: 'סטטוס', type: 'status' },
      { title: 'לקוח', type: 'text' },
      { title: 'חשבון בנק', type: 'text' },
      { title: 'יתרה בנקאית', type: 'numeric' },
      { title: 'יתרה ספרים', type: 'numeric' },
      { title: 'הפרש', type: 'numeric' },
      { title: 'תאריך התאמה', type: 'date' },
      { title: 'הערות', type: 'long_text' },
    ],
  },
  balance_sheets: {
    namePrefix: 'מאזנים',
    dashboardPrefix: 'balance_sheets',
    columns: [
      { title: 'סטטוס', type: 'status' },
      { title: 'לקוח', type: 'text' },
      { title: 'שנת מס', type: 'text' },
      { title: 'סוג דוח', type: 'text' },
      { title: 'תאריך יעד', type: 'date' },
      { title: 'אחראי', type: 'people' },
      { title: 'הערות', type: 'long_text' },
    ],
  },
};

async function handleCreateMonthlyBoards(params) {
  const log = [];
  const timestamp = () => `[${new Date().toLocaleTimeString('he-IL')}]`;
  const year = params.year || new Date().getFullYear();
  const processTypes = params.processTypes || ['reports'];

  const allCreatedBoards = [];
  const allErrors = [];

  for (const processType of processTypes) {
    const config = BOARD_PROCESS_TYPES[processType];
    if (!config) {
      allErrors.push(`סוג תהליך לא מוכר: ${processType}`);
      continue;
    }

    log.push(`${timestamp()} מתחיל יצירת 12 לוחות ${config.namePrefix} חודשיים לשנת ${year}...`);

    for (let month = 0; month < 12; month++) {
      const monthName = HEBREW_MONTHS[month];
      const boardName = `${config.namePrefix} ${monthName} ${year}`;
      const monthNum = String(month + 1).padStart(2, '0');

      try {
        log.push(`${timestamp()} יוצר לוח: ${boardName}...`);

        const board = await monday.createBoard(boardName, 'public');

        if (!board || !board.id) {
          allErrors.push(`שגיאה ביצירת לוח ${boardName}: לא התקבל ID`);
          continue;
        }

        const boardId = String(board.id);

        // Add columns to the board
        for (const col of config.columns) {
          try {
            await monday.addColumnToBoard(boardId, col.title, col.type);
            await new Promise(resolve => setTimeout(resolve, 200));
          } catch (colErr) {
            log.push(`${timestamp()} אזהרה: לא הצלחתי להוסיף עמודה "${col.title}" ללוח ${boardName}: ${colErr.message}`);
          }
        }

        // Save board config to Dashboard entity
        const boardType = `${config.dashboardPrefix}_${year}_${monthNum}`;
        await entities.Dashboard.create({
          type: boardType,
          name: boardName,
          monday_board_id: boardId,
          year: year,
          month: month + 1,
          month_name: monthName,
          process_type: processType,
        });

        allCreatedBoards.push({
          boardId,
          month: month + 1,
          monthName,
          boardName,
          processType,
        });

        log.push(`${timestamp()} נוצר בהצלחה: ${boardName} (ID: ${boardId})`);
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (err) {
        allErrors.push(`שגיאה בלוח ${boardName}: ${err.message}`);
        log.push(`${timestamp()} שגיאה: ${boardName} - ${err.message}`);
      }
    }
  }

  const totalExpected = processTypes.length * 12;
  log.push(`${timestamp()} סיום: נוצרו ${allCreatedBoards.length}/${totalExpected} לוחות. ${allErrors.length} שגיאות.`);

  return {
    data: {
      success: allCreatedBoards.length > 0,
      year,
      createdBoards: allCreatedBoards,
      errors: allErrors,
      log
    }
  };
}

// ===== Reverse Sync: CalmPlan → Monday =====

async function handlePushClientToMonday(params) {
  const log = [];
  const timestamp = () => `[${new Date().toLocaleTimeString('he-IL')}]`;

  try {
    const { clientId, boardId } = params;

    // Get the client from local DB
    const allClients = await entities.Client.list();
    const client = allClients.find(c => c.id === clientId);
    if (!client) {
      return { data: { success: false, error: 'לקוח לא נמצא' } };
    }

    // Use provided boardId or client's stored board ID
    const targetBoardId = boardId || client.monday_board_id;
    if (!targetBoardId) {
      return { data: { success: false, error: 'לא נמצא לוח Monday מקושר ללקוח' } };
    }

    log.push(`${timestamp()} מעדכן את "${client.name}" בלוח Monday ${targetBoardId}...`);

    const result = await monday.pushClientToMonday(client, targetBoardId);

    // If created new, save the monday_item_id back to local
    if (result.action === 'created' && result.itemId) {
      await entities.Client.update(clientId, {
        monday_item_id: String(result.itemId),
        monday_board_id: String(targetBoardId),
      });
      log.push(`${timestamp()} נוצר פריט חדש ב-Monday (ID: ${result.itemId})`);
    } else {
      log.push(`${timestamp()} עודכן פריט קיים ב-Monday (ID: ${result.itemId})`);
    }

    return { data: { success: true, result, log } };
  } catch (error) {
    log.push(`${timestamp()} שגיאה: ${error.message}`);
    return { data: { success: false, error: error.message, log } };
  }
}

async function handlePushTaskToMonday(params) {
  const log = [];
  const timestamp = () => `[${new Date().toLocaleTimeString('he-IL')}]`;

  try {
    const { taskId, boardId } = params;

    const allTasks = await entities.Task.list();
    const task = allTasks.find(t => t.id === taskId);
    if (!task) {
      return { data: { success: false, error: 'משימה לא נמצאה' } };
    }

    const targetBoardId = boardId || task.monday_board_id;
    if (!targetBoardId) {
      return { data: { success: false, error: 'לא נמצא לוח Monday מקושר למשימה' } };
    }

    log.push(`${timestamp()} מעדכן את "${task.title}" בלוח Monday ${targetBoardId}...`);

    const result = await monday.pushTaskToMonday(task, targetBoardId);

    if (result.action === 'created' && result.itemId) {
      await entities.Task.update(taskId, {
        monday_item_id: String(result.itemId),
        monday_board_id: String(targetBoardId),
      });
      log.push(`${timestamp()} נוצרה משימה חדשה ב-Monday (ID: ${result.itemId})`);
    } else {
      log.push(`${timestamp()} עודכנה משימה קיימת ב-Monday (ID: ${result.itemId})`);
    }

    return { data: { success: true, result, log } };
  } catch (error) {
    log.push(`${timestamp()} שגיאה: ${error.message}`);
    return { data: { success: false, error: error.message, log } };
  }
}

async function reverseSyncAllBoards() {
  const log = [];
  const timestamp = () => `[${new Date().toLocaleTimeString('he-IL')}]`;

  log.push(`${timestamp()} מתחיל סנכרון הפוך (CalmPlan → Monday)...`);

  // Load board configs
  const dashboards = await entities.Dashboard.list();
  const activeBoards = dashboards.filter(d => d.monday_board_id);

  if (activeBoards.length === 0) {
    return { data: { success: false, error: 'לא נמצאו לוחות מוגדרים', log } };
  }

  let totalUpdated = 0, totalCreated = 0;
  const errors = [];

  // Reverse sync clients
  const clientBoards = activeBoards.filter(b => b.type === 'clients');
  for (const board of clientBoards) {
    log.push(`${timestamp()} מסנכרן לקוחות ללוח "${board.name || board.type}"...`);

    const clients = await entities.Client.list();
    const boardClients = clients.filter(c =>
      String(c.monday_board_id) === String(board.monday_board_id)
    );

    for (const client of boardClients) {
      try {
        const result = await monday.pushClientToMonday(client, board.monday_board_id);
        if (result.action === 'created') {
          await entities.Client.update(client.id, {
            monday_item_id: String(result.itemId),
          });
          totalCreated++;
        } else {
          totalUpdated++;
        }
      } catch (err) {
        errors.push(`לקוח "${client.name}": ${err.message}`);
      }

      // Rate limit protection
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  // Reverse sync tasks
  const taskBoardTypes = [
    'reports_main', 'reports_126_856_2025', 'reports_126_856_2024',
    'weekly_tasks', 'balance_sheets', 'family_tasks', 'wellbeing', 'weekly_planning'
  ];
  const taskBoards = activeBoards.filter(b => taskBoardTypes.includes(b.type));

  for (const board of taskBoards) {
    log.push(`${timestamp()} מסנכרן משימות ללוח "${board.name || board.type}"...`);

    const tasks = await entities.Task.list();
    const boardTasks = tasks.filter(t =>
      String(t.monday_board_id) === String(board.monday_board_id)
    );

    for (const task of boardTasks) {
      try {
        const result = await monday.pushTaskToMonday(task, board.monday_board_id);
        if (result.action === 'created') {
          await entities.Task.update(task.id, {
            monday_item_id: String(result.itemId),
          });
          totalCreated++;
        } else {
          totalUpdated++;
        }
      } catch (err) {
        errors.push(`משימה "${task.title}": ${err.message}`);
      }

      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  log.push(`${timestamp()} סנכרון הפוך הושלם: ${totalCreated} נוצרו, ${totalUpdated} עודכנו, ${errors.length} שגיאות`);

  return {
    data: {
      success: true,
      totalCreated,
      totalUpdated,
      errors,
      log
    }
  };
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

/**
 * Generate process tasks for clients based on their services.
 * Uses the same template/service mapping as ClientRecurringTasks.jsx.
 * taskType: 'all' | 'mondayReports' | 'balanceSheets' | 'reconciliations'
 */
export const generateProcessTasks = async (params = {}) => {
  const { taskType = 'all' } = params;
  const log = [];
  const timestamp = () => `[${new Date().toLocaleTimeString('he-IL')}]`;
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const monthNum = String(currentMonth).padStart(2, '0');

  // PayrollDashboard process categories for local task categories
  const TEMPLATE_TO_WORK_CATEGORY = {
    vat: 'work_vat_reporting',
    payroll: 'work_payroll',
    tax_advances: 'work_tax_advances',
    social_security: 'work_social_security',
    deductions: 'work_deductions',
    annual_report: 'work_client_management',
  };

  try {
    const allClients = await entities.Client.list();
    const activeClients = allClients.filter(c => c.status === 'active');
    const existingTasks = await entities.Task.list();

    log.push(`${timestamp()} נמצאו ${activeClients.length} לקוחות פעילים, ${existingTasks.length} משימות קיימות`);

    const results = {
      summary: { tasksCreated: 0, mondayTasksCreated: 0, errors: 0 },
      details: []
    };

    // --- Monthly/Periodic Reports (שכר, מע"מ, מקדמות, ביטוח לאומי, ניכויים) ---
    if (taskType === 'all' || taskType === 'mondayReports') {
      log.push(`${timestamp()} יוצר משימות דיווח תקופתיות...`);

      for (const client of activeClients) {
        const templateKeys = getClientTemplates(client);

        for (const templateKey of templateKeys) {
          // Skip annual reports here (handled in balanceSheets section)
          if (templateKey === 'annual_report' && taskType === 'mondayReports') continue;

          if (!shouldRunForMonth(templateKey, currentMonth, client)) continue;

          const template = PROCESS_TEMPLATES[templateKey];
          const description = getReportDescription(templateKey, currentMonth, currentYear, client);
          const title = `${client.name} - ${description}`;
          const workCategory = TEMPLATE_TO_WORK_CATEGORY[templateKey] || template.category;

          // Skip if similar task already exists (check both work categories and Hebrew categories)
          const hebrewCategory = template.category; // e.g. 'מע"מ'
          const exists = existingTasks.some(t =>
            t.title === title ||
            (t.client_name === client.name &&
              (t.category === workCategory || t.category === hebrewCategory) &&
              t.due_date && t.due_date.startsWith(`${currentYear}-${monthNum}`))
          );
          if (exists) continue;

          // Use tax calendar for accurate due dates
          const calendarDueDate = getDueDateForCategory(template.category, client, currentMonth);
          const taskDueDate = calendarDueDate || `${currentYear}-${monthNum}-19`;
          try {
            await entities.Task.create({
              title,
              category: workCategory,
              client_related: true,
              client_name: client.name,
              client_id: client.id,
              status: 'not_started',
              priority: 'high',
              due_date: taskDueDate,
              is_recurring: true,
            });
            results.summary.tasksCreated++;
          } catch (err) {
            results.summary.errors++;
          }
        }
      }

      // Also push to Monday if token exists
      if (monday.hasMondayToken()) {
        try {
          const reportResult = await mondayReportsAutomation({ targetYear: currentYear, targetMonth: currentMonth });
          if (reportResult?.data?.created) {
            results.summary.mondayTasksCreated = reportResult.data.created;
          }
        } catch (e) {
          log.push(`${timestamp()} אזהרה: לא ניתן ליצור ב-Monday: ${e.message}`);
        }
      }
    }

    // --- Balance Sheets / Annual Reports (דוח שנתי) ---
    if (taskType === 'all' || taskType === 'balanceSheets') {
      log.push(`${timestamp()} יוצר משימות דוחות שנתיים / מאזנים...`);

      for (const client of activeClients) {
        const templateKeys = getClientTemplates(client);
        if (!templateKeys.includes('annual_report')) continue;

        const title = `${client.name} - דוח שנתי לשנת ${currentYear - 1}`;
        const exists = existingTasks.some(t => t.title === title);
        if (exists) continue;

        try {
          await entities.Task.create({
            title,
            category: 'work_client_management',
            client_related: true,
            client_name: client.name,
            client_id: client.id,
            status: 'not_started',
            priority: 'medium',
            due_date: `${currentYear}-05-31`,
            is_recurring: true,
          });
          results.summary.tasksCreated++;
        } catch (err) {
          results.summary.errors++;
        }
      }
    }

    // --- Reconciliations (התאמות חשבונות) ---
    if (taskType === 'all' || taskType === 'reconciliations') {
      log.push(`${timestamp()} יוצר משימות התאמות...`);

      for (const client of activeClients) {
        const clientServices = client.service_types || [];
        if (clientServices.length > 0 &&
            !clientServices.includes('bookkeeping') &&
            !clientServices.includes('full_service')) continue;

        const title = `${client.name} - התאמת חשבונות ${monthNum}/${currentYear}`;
        const exists = existingTasks.some(t => t.title === title);
        if (exists) continue;

        try {
          await entities.Task.create({
            title,
            category: 'work_reconciliation',
            client_related: true,
            client_name: client.name,
            client_id: client.id,
            status: 'not_started',
            priority: 'medium',
            due_date: `${currentYear}-${monthNum}-25`,
            is_recurring: true,
          });
          results.summary.tasksCreated++;
        } catch (err) {
          results.summary.errors++;
        }
      }
    }

    log.push(`${timestamp()} סיום: נוצרו ${results.summary.tasksCreated} משימות מקומיות, ${results.summary.mondayTasksCreated} ב-Monday`);

    return {
      data: {
        success: true,
        message: `נוצרו ${results.summary.tasksCreated} משימות חדשות`,
        results,
        log
      }
    };
  } catch (error) {
    return { data: { success: false, error: error.message, log } };
  }
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
