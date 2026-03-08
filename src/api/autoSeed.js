/**
 * Auto-Seed: Loads real client data + March 2026 tasks when database is empty.
 * Runs once per browser session. Detects empty Client collection and populates
 * from bundled JSON + march2026Tasks.js.
 */
import { Client, Task } from './entities';
import realClients from '../data/_quarantine/monday_clients_import.json';
import { MARCH_2026_TASKS } from '../data/march2026Tasks';

const SEED_FLAG = 'calmplan_auto_seeded';

export async function autoSeedIfEmpty() {
  // Skip if already seeded this session
  if (sessionStorage.getItem(SEED_FLAG)) return { seeded: false };

  try {
    const existingClients = await Client.list(null, 5);

    if (existingClients && existingClients.length > 0) {
      sessionStorage.setItem(SEED_FLAG, 'true');
      return { seeded: false, existing: existingClients.length };
    }

    console.log('[AutoSeed] Empty database detected — importing real client data...');

    // ── 1. Import Clients ──
    let clientCount = 0;
    for (const client of realClients) {
      try {
        // Normalize tax_info field names for CalmPlan schema
        const normalized = {
          name: client.name,
          status: client.status || 'active',
          entity_number: client.entity_number || '',
          service_types: client.service_types || [],
          extra_services: client.extra_services || '',
          tax_info: {
            tax_id: client.tax_info?.tax_id || '',
            vat_file_number: client.tax_info?.vat_file_number || '',
            tax_deduction_file_number: client.tax_info?.tax_deduction_file_number || '',
            social_security_file_number: client.tax_info?.social_security_file_number || '',
            annual_tax_ids: client.tax_info?.annual_tax_ids_2025 || {},
          },
          reporting_info: client.reporting_info || {},
          deadlines: client.deadlines || {},
          auditor: client.auditor || '',
          contact_person: client.contact_person || '',
          contact_email: client.contact_email || '',
          notes: client.notes || '',
        };
        await Client.create(normalized);
        clientCount++;
      } catch (err) {
        console.warn(`[AutoSeed] Failed to create client ${client.name}:`, err.message);
      }
    }
    console.log(`[AutoSeed] ✅ ${clientCount} clients imported`);

    // ── 2. Import March 2026 Tasks ──
    let taskCount = 0;
    for (const task of MARCH_2026_TASKS) {
      try {
        const taskData = {
          title: task.title,
          category: task.category,
          subcategory: task.subcategory || '',
          priority: task.priority || 'medium',
          status: task.status || 'not_started',
          due_date: task.due_date,
          estimated_time: task.estimated_time || 0,
          tags: task.tags || [],
          client_name: task.client_name || '',
          dependency_ids: task.dependencies || [],
          is_convergence: task.is_convergence || false,
          recurring_pattern: task.recurring_pattern || '',
          source: 'march_2026_injection',
        };
        await Task.create(taskData);
        taskCount++;
      } catch (err) {
        console.warn(`[AutoSeed] Failed to create task ${task.title}:`, err.message);
      }
    }
    console.log(`[AutoSeed] ✅ ${taskCount} March 2026 tasks injected`);

    sessionStorage.setItem(SEED_FLAG, 'true');
    return { seeded: true, clients: clientCount, tasks: taskCount };
  } catch (err) {
    console.error('[AutoSeed] Failed:', err);
    return { seeded: false, error: err.message };
  }
}
