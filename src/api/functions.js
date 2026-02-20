// Local functions - mock implementations for Base44 functions
import { entities } from './localStorageClient';

// Helper to create a mock function that logs and returns empty/success
const createMockFunction = (name) => async (params) => {
  console.log(`${name} called (mock):`, params);
  return { success: true, message: `${name} is not available in local mode` };
};

// Import/Export functions (mock)
export const importClientsFromExcel = createMockFunction('importClientsFromExcel');
export const importClientAccounts = createMockFunction('importClientAccounts');
export const exportClientsToExcel = createMockFunction('exportClientsToExcel');
export const exportClientAccountsTemplate = createMockFunction('exportClientAccountsTemplate');

// Sync functions (mock)
export const syncClientIdsToReports = createMockFunction('syncClientIdsToReports');
export const mondayReportsAutomation = createMockFunction('mondayReportsAutomation');
export const syncMondayReports = createMockFunction('syncMondayReports');
export const syncReconciliationTasks = createMockFunction('syncReconciliationTasks');
export const syncAllBoards = createMockFunction('syncAllBoards');

// Monday.com functions (mock)
export const priceWiseApi = createMockFunction('priceWiseApi');
export const mondayBoardApi = createMockFunction('mondayBoardApi');
export const getMondayData = async () => ({ items: [], boards: [] });
export const filterMondayItems = async () => ({ items: [] });
export const mondayApi = createMockFunction('mondayApi');

// Task generation
export const generateHomeTasks = async (params) => {
  console.log('generateHomeTasks called:', params);
  return { tasks: [] };
};

export const generateProcessTasks = async (params) => {
  console.log('generateProcessTasks called:', params);
  return { tasks: [] };
};

// Weekly planning
export const getWeeklyPlan = async (params) => {
  const schedules = await entities.WeeklySchedule.list();
  return schedules[0] || null;
};

export const createWeeklyPlan = async (params) => {
  const plan = await entities.WeeklySchedule.create(params);
  return plan;
};

// Data management
export const seedData = async () => {
  console.log('Seeding initial data...');

  const existingTasks = await entities.Task.list();
  if (existingTasks.length > 0) {
    return { success: true, message: 'Data already exists' };
  }

  const sampleTasks = [
    { title: 'משימה לדוגמה 1', status: 'pending', priority: 'high', category: 'work' },
    { title: 'משימה לדוגמה 2', status: 'in_progress', priority: 'medium', category: 'personal' },
  ];

  for (const task of sampleTasks) {
    await entities.Task.create(task);
  }

  return { success: true, message: 'Sample data created' };
};

export const emergencyBackup = async () => {
  const backup = {};
  const entityNames = Object.keys(entities);

  for (const name of entityNames) {
    backup[name] = await entities[name].list();
  }

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `calmplan_backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();

  return { success: true, message: 'Backup downloaded' };
};

export const emergencyReset = async () => {
  const keys = Object.keys(localStorage).filter(k => k.startsWith('calmplan_'));
  keys.forEach(k => localStorage.removeItem(k));
  return { success: true, message: 'All data cleared' };
};
