import { createSupabaseEntity } from './supabaseDataStore';
import { auth } from './localStorageClient';

// All entities now use Supabase-backed persistence (with localStorage fallback)
export const Event = createSupabaseEntity('Event');
export const Task = createSupabaseEntity('Task');
export const TaskSession = createSupabaseEntity('TaskSession');
export const DaySchedule = createSupabaseEntity('DaySchedule');
export const WeeklyRecommendation = createSupabaseEntity('WeeklyRecommendation');
export const Client = createSupabaseEntity('Client');
export const Dashboard = createSupabaseEntity('Dashboard');
export const AccountReconciliation = createSupabaseEntity('AccountReconciliation');
export const Invoice = createSupabaseEntity('Invoice');
export const ServiceProvider = createSupabaseEntity('ServiceProvider');
export const ClientContact = createSupabaseEntity('ClientContact');
export const ClientServiceProvider = createSupabaseEntity('ClientServiceProvider');
export const ClientAccount = createSupabaseEntity('ClientAccount');
export const ServiceCompany = createSupabaseEntity('ServiceCompany');
export const Lead = createSupabaseEntity('Lead');
export const RoadmapItem = createSupabaseEntity('RoadmapItem');
export const WeeklySchedule = createSupabaseEntity('WeeklySchedule');
export const FamilyMember = createSupabaseEntity('FamilyMember');
export const DailyMoodCheck = createSupabaseEntity('DailyMoodCheck');
export const Therapist = createSupabaseEntity('Therapist');
export const TaxReport = createSupabaseEntity('TaxReport');
export const TaxReport2025 = createSupabaseEntity('TaxReport2025');
export const TaxReport2024 = createSupabaseEntity('TaxReport2024');
export const WeeklyTask = createSupabaseEntity('WeeklyTask');
export const BalanceSheet = createSupabaseEntity('BalanceSheet');
export const StickyNote = createSupabaseEntity('StickyNote');

// auth sdk (still local - no Supabase auth for now):
export const User = auth;
