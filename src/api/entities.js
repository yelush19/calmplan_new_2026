import { _registry } from './entityRegistry';

// ── Lazy Entity Accessors ──
// Reads from the shared _registry object (populated by base44Client.js).
// This completely eliminates the circular import chain that caused
// "Cannot access 'T' before initialization" TDZ crashes.
// The Proxy defers access until the first method call (runtime),
// by which point base44Client.js has finished initializing.

function lazyEntity(name) {
  return new Proxy({}, {
    get(_, prop) {
      const entity = _registry.entities?.[name];
      if (!entity) {
        console.warn(`[entities] ${name} not yet initialized, returning no-op for .${String(prop)}`);
        if (prop === 'list') return async () => [];
        if (prop === 'filter') return async () => [];
        if (prop === 'create') return async (d) => d;
        if (prop === 'update') return async (id, d) => d;
        if (prop === 'delete') return async () => ({ success: true });
        if (prop === 'deleteAll') return async () => ({ success: true });
        return undefined;
      }
      return entity[prop];
    },
  });
}

export const Event = lazyEntity('Event');
export const Task = lazyEntity('Task');
export const TaskSession = lazyEntity('TaskSession');
export const DaySchedule = lazyEntity('DaySchedule');
export const WeeklyRecommendation = lazyEntity('WeeklyRecommendation');
export const Client = lazyEntity('Client');
export const Dashboard = lazyEntity('Dashboard');
export const AccountReconciliation = lazyEntity('AccountReconciliation');
export const Invoice = lazyEntity('Invoice');
export const ServiceProvider = lazyEntity('ServiceProvider');
export const ClientContact = lazyEntity('ClientContact');
export const ClientServiceProvider = lazyEntity('ClientServiceProvider');
export const ClientAccount = lazyEntity('ClientAccount');
export const ServiceCompany = lazyEntity('ServiceCompany');
export const Lead = lazyEntity('Lead');
export const RoadmapItem = lazyEntity('RoadmapItem');
export const WeeklySchedule = lazyEntity('WeeklySchedule');
export const FamilyMember = lazyEntity('FamilyMember');
export const DailyMoodCheck = lazyEntity('DailyMoodCheck');
export const Therapist = lazyEntity('Therapist');
export const TaxReport = lazyEntity('TaxReport');
export const TaxReport2025 = lazyEntity('TaxReport2025');
export const TaxReport2024 = lazyEntity('TaxReport2024');
export const WeeklyTask = lazyEntity('WeeklyTask');
export const BalanceSheet = lazyEntity('BalanceSheet');
export const BalanceSheetWorkbook = lazyEntity('BalanceSheetWorkbook');
export const StickyNote = lazyEntity('StickyNote');
export const Project = lazyEntity('Project');
export const SystemConfig = lazyEntity('SystemConfig');
export const PeriodicReport = lazyEntity('PeriodicReport');
export const FileMetadata = lazyEntity('FileMetadata');
export const ServiceCatalog = lazyEntity('ServiceCatalog');
export const UserPreferences = lazyEntity('UserPreferences');

// auth sdk — lazy accessor via registry (no direct base44 import)
export const User = new Proxy({}, {
  get(_, prop) {
    const auth = _registry.auth;
    if (!auth) {
      console.warn(`[entities] User.auth not yet initialized, returning no-op for .${String(prop)}`);
      if (prop === 'login') return async () => ({});
      if (prop === 'logout') return async () => ({});
      if (prop === 'current') return () => null;
      return undefined;
    }
    return typeof auth[prop] === 'function' ? auth[prop].bind(auth) : auth[prop];
  },
});
