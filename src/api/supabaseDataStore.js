// Supabase Data Store - reads/writes to the app_data table
// Table schema: app_data { id, collection (text), data (jsonb), created_at, updated_at }
// Each row = one entity collection (e.g., collection='Client' stores all clients in data[])

import { supabase, isSupabaseAvailable } from './supabaseClient';

const STORAGE_PREFIX = 'calmplan_';
const generateId = () => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
const getTimestamp = () => new Date().toISOString();

// localStorage fallback helpers
function localGet(collection) {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${collection}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function localSet(collection, items) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${collection}`, JSON.stringify(items));
  } catch (e) {
    console.error(`localStorage write error for ${collection}:`, e);
  }
}

// Supabase helpers for app_data table
async function supabaseGet(collection) {
  if (!isSupabaseAvailable()) return null;
  try {
    const { data, error } = await supabase
      .from('app_data')
      .select('data')
      .eq('collection', collection)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return []; // No rows found
      console.error(`Supabase read error for ${collection}:`, error);
      return null;
    }
    return Array.isArray(data?.data) ? data.data : [];
  } catch (e) {
    console.error(`Supabase read exception for ${collection}:`, e);
    return null;
  }
}

async function supabaseSet(collection, items) {
  if (!isSupabaseAvailable()) return false;
  try {
    const { error } = await supabase
      .from('app_data')
      .upsert(
        {
          collection,
          data: items,
          updated_at: getTimestamp(),
        },
        { onConflict: 'collection' }
      );
    if (error) {
      console.error(`Supabase write error for ${collection}:`, error);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`Supabase write exception for ${collection}:`, e);
    return false;
  }
}

// Unified read: try Supabase first, fallback to localStorage
async function getAll(collection) {
  const supabaseData = await supabaseGet(collection);
  if (supabaseData !== null) {
    // Also sync to localStorage as cache
    localSet(collection, supabaseData);
    return supabaseData;
  }
  // Fallback to localStorage
  return localGet(collection);
}

// Unified write: write to both Supabase and localStorage
async function saveAll(collection, items) {
  // Always write to localStorage as immediate cache
  localSet(collection, items);
  // Write to Supabase asynchronously
  await supabaseSet(collection, items);
}

// Create an entity class with dual persistence (Supabase + localStorage)
export function createSupabaseEntity(entityName) {
  return {
    async list(filters = {}) {
      let items = await getAll(entityName);
      if (filters && typeof filters === 'object' && Object.keys(filters).length > 0) {
        items = items.filter(item => {
          return Object.entries(filters).every(([key, value]) => {
            if (value === undefined || value === null) return true;
            return item[key] === value;
          });
        });
      }
      return items;
    },

    async filter(filters = {}) {
      return this.list(filters);
    },

    async get(id) {
      const items = await getAll(entityName);
      return items.find(item => item.id === id) || null;
    },

    async create(data) {
      const items = await getAll(entityName);
      const newItem = {
        ...data,
        id: generateId(),
        created_date: getTimestamp(),
        updated_date: getTimestamp(),
      };
      items.push(newItem);
      await saveAll(entityName, items);
      return newItem;
    },

    async update(id, data) {
      const items = await getAll(entityName);
      const index = items.findIndex(item => item.id === id);
      if (index === -1) {
        throw new Error(`${entityName} with id ${id} not found`);
      }
      items[index] = {
        ...items[index],
        ...data,
        id,
        updated_date: getTimestamp(),
      };
      await saveAll(entityName, items);
      return items[index];
    },

    async delete(id) {
      const items = await getAll(entityName);
      const filtered = items.filter(item => item.id !== id);
      await saveAll(entityName, filtered);
      return { success: true };
    },

    async bulkCreate(dataArray) {
      const items = await getAll(entityName);
      const newItems = dataArray.map(d => ({
        ...d,
        id: generateId(),
        created_date: getTimestamp(),
        updated_date: getTimestamp(),
      }));
      items.push(...newItems);
      await saveAll(entityName, items);
      return newItems;
    },

    async bulkDelete(ids) {
      const items = await getAll(entityName);
      const filtered = items.filter(item => !ids.includes(item.id));
      await saveAll(entityName, filtered);
      return { success: true, deleted: ids.length };
    },
  };
}
