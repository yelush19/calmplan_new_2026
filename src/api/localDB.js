/**
 * LocalDB - Drop-in replacement for Base44 SDK
 * Uses localStorage for data persistence.
 * Same API: Entity.list(), Entity.create(), Entity.update(), Entity.delete(), Entity.filter()
 */

const DB_PREFIX = 'calmplan_';

function getCollection(name) {
  try {
    const data = localStorage.getItem(DB_PREFIX + name);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function setCollection(name, items) {
  localStorage.setItem(DB_PREFIX + name, JSON.stringify(items));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function createEntity(collectionName) {
  return {
    /**
     * List all items, optionally sorted and limited
     * @param {string|null} sortField - Field to sort by (prefix with - for desc)
     * @param {number} limit - Max items to return
     */
    async list(sortField = null, limit = 1000) {
      let items = getCollection(collectionName);

      if (sortField) {
        const desc = sortField.startsWith('-');
        const field = desc ? sortField.slice(1) : sortField;
        items.sort((a, b) => {
          const valA = a[field] || '';
          const valB = b[field] || '';
          if (desc) return valA > valB ? -1 : valA < valB ? 1 : 0;
          return valA < valB ? -1 : valA > valB ? 1 : 0;
        });
      }

      return items.slice(0, limit);
    },

    /**
     * Create a new item
     * @param {Object} data - Item data
     */
    async create(data) {
      const items = getCollection(collectionName);
      const newItem = {
        ...data,
        id: generateId(),
        created_date: new Date().toISOString(),
        updated_date: new Date().toISOString()
      };
      items.push(newItem);
      setCollection(collectionName, items);
      return newItem;
    },

    /**
     * Update an existing item
     * @param {string} id - Item ID
     * @param {Object} data - Updated fields
     */
    async update(id, data) {
      const items = getCollection(collectionName);
      const index = items.findIndex(item => item.id === id);
      if (index === -1) throw new Error(`Item ${id} not found in ${collectionName}`);

      // Remove id from data to avoid overwriting
      const { id: _id, ...updateData } = data;
      items[index] = {
        ...items[index],
        ...updateData,
        updated_date: new Date().toISOString()
      };
      setCollection(collectionName, items);
      return items[index];
    },

    /**
     * Delete an item
     * @param {string} id - Item ID
     */
    async delete(id) {
      const items = getCollection(collectionName);
      const filtered = items.filter(item => item.id !== id);
      setCollection(collectionName, filtered);
      return { success: true };
    },

    /**
     * Filter items by criteria
     * @param {Object} filters - Filter object (supports $in operator)
     * @param {string|null} sortField - Sort field
     * @param {number} limit - Max items
     */
    async filter(filters = {}, sortField = null, limit = 1000) {
      let items = getCollection(collectionName);

      items = items.filter(item => {
        for (const [key, condition] of Object.entries(filters)) {
          if (condition && typeof condition === 'object') {
            // Operator-based filtering
            if (condition['$in']) {
              if (!condition['$in'].includes(item[key])) return false;
            }
            if (condition['$ne'] !== undefined) {
              if (item[key] === condition['$ne']) return false;
            }
            if (condition['$eq'] !== undefined) {
              if (item[key] !== condition['$eq']) return false;
            }
            // Range operators: >=, <=, >, <
            if (condition['>='] !== undefined) {
              if (!item[key] || item[key] < condition['>=']) return false;
            }
            if (condition['<='] !== undefined) {
              if (!item[key] || item[key] > condition['<=']) return false;
            }
            if (condition['>'] !== undefined) {
              if (!item[key] || item[key] <= condition['>']) return false;
            }
            if (condition['<'] !== undefined) {
              if (!item[key] || item[key] >= condition['<']) return false;
            }
          } else {
            if (item[key] !== condition) return false;
          }
        }
        return true;
      });

      if (sortField) {
        const desc = sortField.startsWith('-');
        const field = desc ? sortField.slice(1) : sortField;
        items.sort((a, b) => {
          const valA = a[field] || '';
          const valB = b[field] || '';
          if (desc) return valA > valB ? -1 : valA < valB ? 1 : 0;
          return valA < valB ? -1 : valA > valB ? 1 : 0;
        });
      }

      return items.slice(0, limit);
    }
  };
}

/**
 * Auth module - replaces Base44 auth
 */
const auth = {
  async me() {
    const userData = localStorage.getItem(DB_PREFIX + '_user');
    if (userData) return JSON.parse(userData);
    // Default user
    return { full_name: 'ליתאי', email: 'lithai@example.com' };
  },
  async login() {
    return { success: true };
  },
  async logout() {
    return { success: true };
  }
};

// Export all entity collections
export const entities = {
  Event: createEntity('events'),
  Task: createEntity('tasks'),
  TaskSession: createEntity('task_sessions'),
  DaySchedule: createEntity('day_schedules'),
  WeeklyRecommendation: createEntity('weekly_recommendations'),
  Client: createEntity('clients'),
  Dashboard: createEntity('dashboards'),
  AccountReconciliation: createEntity('account_reconciliations'),
  Invoice: createEntity('invoices'),
  ServiceProvider: createEntity('service_providers'),
  ClientContact: createEntity('client_contacts'),
  ClientServiceProvider: createEntity('client_service_providers'),
  ClientAccount: createEntity('client_accounts'),
  ServiceCompany: createEntity('service_companies'),
  Lead: createEntity('leads'),
  RoadmapItem: createEntity('roadmap_items'),
  WeeklySchedule: createEntity('weekly_schedules'),
  FamilyMember: createEntity('family_members'),
  DailyMoodCheck: createEntity('daily_mood_checks'),
  Therapist: createEntity('therapists'),
  TaxReport: createEntity('tax_reports'),
  TaxReport2025: createEntity('tax_reports_2025'),
  TaxReport2024: createEntity('tax_reports_2024'),
  WeeklyTask: createEntity('weekly_tasks'),
  BalanceSheet: createEntity('balance_sheets'),
};

export { auth };

// Helper: Export/Import all data (for backup/restore)
export function exportAllData() {
  const allData = {};
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(DB_PREFIX)) {
      allData[key] = JSON.parse(localStorage.getItem(key));
    }
  }
  return allData;
}

export function importAllData(data) {
  for (const [key, value] of Object.entries(data)) {
    localStorage.setItem(key, JSON.stringify(value));
  }
}

export function clearAllData() {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(DB_PREFIX)) {
      localStorage.removeItem(key);
    }
  }
}
