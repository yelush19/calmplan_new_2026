// Local Storage Client - replaces Base44 SDK
// Provides CRUD operations with localStorage persistence

const STORAGE_PREFIX = 'calmplan_';

// Generate unique ID
const generateId = () => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Get current timestamp
const getTimestamp = () => new Date().toISOString();

// Create an entity class that mimics Base44 entity behavior
function createEntity(entityName) {
  const storageKey = `${STORAGE_PREFIX}${entityName}`;

  const getAll = () => {
    try {
      const data = localStorage.getItem(storageKey);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error(`Error reading ${entityName}:`, e);
      return [];
    }
  };

  const saveAll = (items) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(items));
    } catch (e) {
      console.error(`Error saving ${entityName}:`, e);
    }
  };

  return {
    // List all items with optional filters
    async list(filters = {}) {
      let items = getAll();

      // Apply filters
      if (filters && Object.keys(filters).length > 0) {
        items = items.filter(item => {
          return Object.entries(filters).every(([key, value]) => {
            if (value === undefined || value === null) return true;
            return item[key] === value;
          });
        });
      }

      return items;
    },

    // Filter items (alias for list with filters)
    async filter(filters = {}) {
      return this.list(filters);
    },

    // Get single item by ID
    async get(id) {
      const items = getAll();
      return items.find(item => item.id === id) || null;
    },

    // Create new item
    async create(data) {
      const items = getAll();
      const newItem = {
        ...data,
        id: generateId(),
        created_date: getTimestamp(),
        updated_date: getTimestamp()
      };
      items.push(newItem);
      saveAll(items);
      return newItem;
    },

    // Update existing item
    async update(id, data) {
      const items = getAll();
      const index = items.findIndex(item => item.id === id);
      if (index === -1) {
        throw new Error(`${entityName} with id ${id} not found`);
      }
      items[index] = {
        ...items[index],
        ...data,
        id, // Preserve ID
        updated_date: getTimestamp()
      };
      saveAll(items);
      return items[index];
    },

    // Delete item
    async delete(id) {
      const items = getAll();
      const filtered = items.filter(item => item.id !== id);
      saveAll(filtered);
      return { success: true };
    },

    // Bulk create
    async bulkCreate(dataArray) {
      const items = getAll();
      const newItems = dataArray.map(data => ({
        ...data,
        id: generateId(),
        created_date: getTimestamp(),
        updated_date: getTimestamp()
      }));
      items.push(...newItems);
      saveAll(items);
      return newItems;
    },

    // Bulk delete
    async bulkDelete(ids) {
      const items = getAll();
      const filtered = items.filter(item => !ids.includes(item.id));
      saveAll(filtered);
      return { success: true, deleted: ids.length };
    }
  };
}

// Auth module (simplified - no real auth, just local user)
const auth = {
  async me() {
    const user = localStorage.getItem(`${STORAGE_PREFIX}current_user`);
    if (user) {
      return JSON.parse(user);
    }
    // Create default user
    const defaultUser = {
      id: 'local_user',
      email: 'user@calmplan.local',
      full_name: 'משתמש מקומי',
      created_date: getTimestamp()
    };
    localStorage.setItem(`${STORAGE_PREFIX}current_user`, JSON.stringify(defaultUser));
    return defaultUser;
  },

  async isLoggedIn() {
    return true; // Always logged in for local version
  },

  async login() {
    return this.me();
  },

  async logout() {
    // Do nothing for local version
    return { success: true };
  }
};

// Export entities
export const entities = {
  Event: createEntity('Event'),
  Task: createEntity('Task'),
  TaskSession: createEntity('TaskSession'),
  DaySchedule: createEntity('DaySchedule'),
  WeeklyRecommendation: createEntity('WeeklyRecommendation'),
  Client: createEntity('Client'),
  Dashboard: createEntity('Dashboard'),
  AccountReconciliation: createEntity('AccountReconciliation'),
  Invoice: createEntity('Invoice'),
  ServiceProvider: createEntity('ServiceProvider'),
  ClientContact: createEntity('ClientContact'),
  ClientServiceProvider: createEntity('ClientServiceProvider'),
  ClientAccount: createEntity('ClientAccount'),
  ServiceCompany: createEntity('ServiceCompany'),
  Lead: createEntity('Lead'),
  RoadmapItem: createEntity('RoadmapItem'),
  WeeklySchedule: createEntity('WeeklySchedule'),
  FamilyMember: createEntity('FamilyMember'),
  DailyMoodCheck: createEntity('DailyMoodCheck'),
  Therapist: createEntity('Therapist'),
  TaxReport: createEntity('TaxReport'),
  TaxReport2025: createEntity('TaxReport2025'),
  TaxReport2024: createEntity('TaxReport2024'),
  WeeklyTask: createEntity('WeeklyTask'),
  BalanceSheet: createEntity('BalanceSheet')
};

export { auth };
