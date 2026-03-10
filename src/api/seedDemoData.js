// Demo data seeder for standalone CalmPlan
import { entities } from './localDB';
import { format, addDays, addMonths, subDays } from 'date-fns';

const demoClients = [
  { name: 'אברהם כהן', status: 'active', service_types: ['full_service'], contacts: [{ name: 'אברהם כהן', phone: '050-1234567', email: 'avraham@example.com' }] },
  { name: 'שרה לוי', status: 'active', service_types: ['bookkeeping'], contacts: [{ name: 'שרה לוי', phone: '052-2345678', email: 'sarah@example.com' }] },
  { name: 'דוד ישראלי', status: 'active', service_types: ['payroll'], contacts: [{ name: 'דוד ישראלי', phone: '054-3456789', email: 'david@example.com' }] },
  { name: 'מרים גולד', status: 'active', service_types: ['tax_reports', 'vat'], contacts: [{ name: 'מרים גולד', phone: '053-4567890', email: 'miriam@example.com' }] },
  { name: 'יוסי אלון', status: 'active', service_types: ['full_service'], contacts: [{ name: 'יוסי אלון', phone: '050-5678901', email: 'yossi@example.com' }] },
];

export default async function seedDemoData() {
  try {
    // Create demo clients
    for (const client of demoClients) {
      await entities.Client.create(client);
    }

    // Create demo tasks with various due dates and statuses
    const now = new Date();
    const demoTasks = [
      { title: 'אברהם כהן - דיווח מע"מ ינואר-פברואר', client_name: 'אברהם כהן', due_date: format(subDays(now, 5), 'yyyy-MM-dd'), status: 'not_started', priority: 'urgent', category: 'מע"מ' },
      { title: 'שרה לוי - דיווח שכר ינואר', client_name: 'שרה לוי', due_date: format(subDays(now, 2), 'yyyy-MM-dd'), status: 'in_progress', priority: 'high', category: 'שכר' },
      { title: 'דוד ישראלי - מקדמות מס ינואר', client_name: 'דוד ישראלי', due_date: format(now, 'yyyy-MM-dd'), status: 'not_started', priority: 'high', category: 'מקדמות מס' },
      { title: 'מרים גולד - דיווח מע"מ ינואר-פברואר', client_name: 'מרים גולד', due_date: format(addDays(now, 3), 'yyyy-MM-dd'), status: 'not_started', priority: 'medium', category: 'מע"מ' },
      { title: 'יוסי אלון - ביטוח לאומי ינואר', client_name: 'יוסי אלון', due_date: format(addDays(now, 7), 'yyyy-MM-dd'), status: 'not_started', priority: 'medium', category: 'ביטוח לאומי' },
      { title: 'אברהם כהן - דוח שנתי 2025', client_name: 'אברהם כהן', due_date: format(addMonths(now, 3), 'yyyy-MM-dd'), status: 'not_started', priority: 'low', category: 'דוח שנתי' },
      { title: 'שרה לוי - התאמת בנק', client_name: 'שרה לוי', due_date: format(subDays(now, 10), 'yyyy-MM-dd'), status: 'completed', priority: 'medium', category: 'התאמות', completed_date: format(subDays(now, 8), 'yyyy-MM-dd') },
      { title: 'דוד ישראלי - דיווח שכר דצמבר', client_name: 'דוד ישראלי', due_date: format(subDays(now, 15), 'yyyy-MM-dd'), status: 'completed', priority: 'high', category: 'שכר', completed_date: format(subDays(now, 14), 'yyyy-MM-dd') },
    ];

    for (const task of demoTasks) {
      await entities.Task.create(task);
    }

    // Create demo events
    const demoEvents = [
      { title: 'פגישה עם אברהם כהן', start_date: format(addDays(now, 1), "yyyy-MM-dd'T'10:00"), end_date: format(addDays(now, 1), "yyyy-MM-dd'T'11:00"), description: 'סקירת דוחות' },
      { title: 'שיחת טלפון עם שרה לוי', start_date: format(addDays(now, 2), "yyyy-MM-dd'T'14:00"), end_date: format(addDays(now, 2), "yyyy-MM-dd'T'14:30") },
    ];

    for (const event of demoEvents) {
      await entities.Event.create(event);
    }

    return { data: { success: true, created: { clients: demoClients.length, tasks: demoTasks.length, events: demoEvents.length } } };
  } catch (error) {
    console.error('Error seeding demo data:', error);
    return { data: { success: false, error: error.message } };
  }
}
