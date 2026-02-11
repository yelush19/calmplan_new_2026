// Standalone function stubs - replace Base44 backend functions
// These provide basic implementations or no-ops for features that relied on Base44 backend

import { exportAllData, importAllData, clearAllData } from './localDB';

const notAvailable = async () => {
  console.warn('This function requires Monday.com integration (not available in standalone mode)');
  return { data: { success: false, error: 'Not available in standalone mode' } };
};

// Excel import/export - will need separate implementation
export const importClientsFromExcel = notAvailable;
export const importClientAccounts = notAvailable;
export const exportClientsToExcel = notAvailable;
export const exportClientAccountsTemplate = notAvailable;

// Monday.com integration stubs
export const syncClientIdsToReports = notAvailable;
export const mondayReportsAutomation = notAvailable;
export const priceWiseApi = notAvailable;
export const mondayBoardApi = notAvailable;
export const getMondayData = notAvailable;
export const filterMondayItems = notAvailable;
export const syncMondayReports = notAvailable;
export const syncReconciliationTasks = notAvailable;
export const mondayApi = notAvailable;
export const syncAllBoards = notAvailable;

// Task generation
export const generateHomeTasks = notAvailable;
export const getWeeklyPlan = notAvailable;
export const createWeeklyPlan = notAvailable;
export const generateProcessTasks = notAvailable;

// Seed data
export const seedData = async () => {
  const { default: seedDemoData } = await import('./seedDemoData');
  return seedDemoData();
};

// Backup - downloads all data as JSON
export const emergencyBackup = async () => {
  const data = exportAllData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `calmplan-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(url);
  a.remove();
  return { data: { success: true, message: 'Backup downloaded' } };
};

// Reset - clears all data
export const emergencyReset = async () => {
  if (window.confirm('Are you sure? This will delete ALL data!')) {
    clearAllData();
    window.location.reload();
  }
  return { data: { success: true } };
};
