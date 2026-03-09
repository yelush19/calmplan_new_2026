import { base44 } from './base44Client';

// ── Lazy Entity Accessors ──
// Uses getter functions to avoid TDZ (Temporal Dead Zone) crashes.
// The base44.entities object may not be fully initialized when this
// module is first evaluated (due to circular import chains like
// entities → base44Client → automationEngine → entities).
// By wrapping each export in a Proxy, the actual access to
// base44.entities[name] is deferred until runtime (first method call).

function lazyEntity(name) {
  return new Proxy({}, {
    get(_, prop) {
      const entity = base44.entities?.[name];
      if (!entity) {
        console.warn(`[entities] ${name} not yet initialized, returning no-op for .${String(prop)}`);
        // Return safe no-ops for common methods
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
export const StickyNote = lazyEntity('StickyNote');
export const Project = lazyEntity('Project');
export const SystemConfig = lazyEntity('SystemConfig');
export const PeriodicReport = lazyEntity('PeriodicReport');
export const FileMetadata = lazyEntity('FileMetadata');
export const ServiceCatalog = lazyEntity('ServiceCatalog');

// auth sdk — lazy accessor to avoid TDZ crash (same pattern as entities above)
export const User = new Proxy({}, {
  get(_, prop) {
    const auth = base44.auth;
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
