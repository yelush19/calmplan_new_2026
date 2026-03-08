/**
 * ── Inventory Engine: P4 Lean Inventory System ──
 *
 * Tracks cleaning supplies and human food with Red Line (Minimum Threshold) logic.
 * When an item hits Red status (below minimum), auto-generates a shopping list task in P4.
 *
 * Status Logic:
 *   In Stock (Green) → quantity > redLine * 1.5
 *   Low (Yellow)     → quantity <= redLine * 1.5 AND quantity > redLine
 *   Out (Red)        → quantity <= redLine
 *
 * Storage: localStorage (offline-first), syncs to Supabase when available.
 */

const LS_KEY = 'calmplan_inventory';

// ── Default Categories ──
export const INVENTORY_CATEGORIES = {
  cleaning: {
    key: 'cleaning',
    label: 'חומרי ניקיון',
    icon: '🧹',
    color: '#4CAF50',
    items: [
      { id: 'floor_cleaner', name: 'נוזל רצפה', unit: 'בקבוק', redLine: 1, category: 'cleaning' },
      { id: 'dish_soap', name: 'סבון כלים', unit: 'בקבוק', redLine: 1, category: 'cleaning' },
      { id: 'laundry_detergent', name: 'אבקת כביסה', unit: 'קופסה', redLine: 1, category: 'cleaning' },
      { id: 'fabric_softener', name: 'מרכך כביסה', unit: 'בקבוק', redLine: 1, category: 'cleaning' },
      { id: 'bleach', name: 'אקונומיקה', unit: 'בקבוק', redLine: 1, category: 'cleaning' },
      { id: 'glass_cleaner', name: 'מנקה חלונות', unit: 'בקבוק', redLine: 1, category: 'cleaning' },
      { id: 'toilet_cleaner', name: 'מנקה שירותים', unit: 'בקבוק', redLine: 1, category: 'cleaning' },
      { id: 'sponges', name: 'ספוגים', unit: 'יחידה', redLine: 2, category: 'cleaning' },
      { id: 'trash_bags', name: 'שקיות אשפה', unit: 'גליל', redLine: 1, category: 'cleaning' },
      { id: 'paper_towels', name: 'מגבות נייר', unit: 'גליל', redLine: 2, category: 'cleaning' },
      { id: 'toilet_paper', name: 'נייר טואלט', unit: 'גליל', redLine: 4, category: 'cleaning' },
    ],
  },
  food: {
    key: 'food',
    label: 'מזון',
    icon: '🍎',
    color: '#FF9800',
    items: [
      { id: 'bread', name: 'לחם', unit: 'כיכר', redLine: 1, category: 'food' },
      { id: 'milk', name: 'חלב', unit: 'ליטר', redLine: 1, category: 'food' },
      { id: 'eggs', name: 'ביצים', unit: 'תבנית', redLine: 1, category: 'food' },
      { id: 'cheese', name: 'גבינה', unit: 'חבילה', redLine: 1, category: 'food' },
      { id: 'butter', name: 'חמאה', unit: 'חבילה', redLine: 1, category: 'food' },
      { id: 'rice', name: 'אורז', unit: 'ק"ג', redLine: 1, category: 'food' },
      { id: 'pasta', name: 'פסטה', unit: 'חבילה', redLine: 2, category: 'food' },
      { id: 'oil', name: 'שמן בישול', unit: 'בקבוק', redLine: 1, category: 'food' },
      { id: 'sugar', name: 'סוכר', unit: 'ק"ג', redLine: 1, category: 'food' },
      { id: 'coffee', name: 'קפה', unit: 'חבילה', redLine: 1, category: 'food' },
      { id: 'tea', name: 'תה', unit: 'קופסה', redLine: 1, category: 'food' },
      { id: 'salt', name: 'מלח', unit: 'חבילה', redLine: 1, category: 'food' },
      { id: 'canned_goods', name: 'שימורים', unit: 'פחית', redLine: 3, category: 'food' },
      { id: 'fruits', name: 'פירות', unit: 'ק"ג', redLine: 1, category: 'food' },
      { id: 'vegetables', name: 'ירקות', unit: 'ק"ג', redLine: 1, category: 'food' },
    ],
  },
};

/**
 * Get item status based on quantity vs redLine
 */
export function getItemStatus(quantity, redLine) {
  if (quantity <= redLine) return 'out';         // Red — needs immediate restock
  if (quantity <= redLine * 1.5) return 'low';    // Yellow — running low
  return 'in_stock';                              // Green — good
}

export function getStatusColor(status) {
  switch (status) {
    case 'out': return '#EF4444';      // Red
    case 'low': return '#F59E0B';      // Yellow/Amber
    case 'in_stock': return '#22C55E';  // Green
    default: return '#64748B';
  }
}

export function getStatusLabel(status) {
  switch (status) {
    case 'out': return 'חסר';
    case 'low': return 'נמוך';
    case 'in_stock': return 'במלאי';
    default: return 'לא ידוע';
  }
}

export function getStatusIcon(status) {
  switch (status) {
    case 'out': return '🔴';
    case 'low': return '🟡';
    case 'in_stock': return '🟢';
    default: return '⚪';
  }
}

/**
 * Load inventory from localStorage
 */
export function loadInventory() {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }

  // Initialize with defaults — all items start with quantity = redLine * 2 (In Stock)
  const inventory = {};
  Object.values(INVENTORY_CATEGORIES).forEach(cat => {
    cat.items.forEach(item => {
      inventory[item.id] = {
        ...item,
        quantity: item.redLine * 2,
        lastUpdated: new Date().toISOString(),
      };
    });
  });
  saveInventory(inventory);
  return inventory;
}

/**
 * Save inventory to localStorage
 */
export function saveInventory(inventory) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(inventory));
  } catch { /* ignore */ }
}

/**
 * Update item quantity
 */
export function updateItemQuantity(itemId, newQuantity) {
  const inventory = loadInventory();
  if (inventory[itemId]) {
    inventory[itemId].quantity = Math.max(0, newQuantity);
    inventory[itemId].lastUpdated = new Date().toISOString();
    saveInventory(inventory);
  }
  return inventory;
}

/**
 * Add a custom item to inventory
 */
export function addCustomItem(item) {
  const inventory = loadInventory();
  const id = item.id || `custom_${Date.now()}`;
  inventory[id] = {
    id,
    name: item.name,
    unit: item.unit || 'יחידה',
    redLine: item.redLine || 1,
    category: item.category || 'cleaning',
    quantity: item.quantity || 0,
    isCustom: true,
    lastUpdated: new Date().toISOString(),
  };
  saveInventory(inventory);
  return inventory;
}

/**
 * Generate auto shopping list from items at Red status
 * Returns items that need to be purchased
 */
export function generateShoppingList(inventory) {
  if (!inventory) inventory = loadInventory();
  const list = [];

  Object.values(inventory).forEach(item => {
    const status = getItemStatus(item.quantity, item.redLine);
    if (status === 'out' || status === 'low') {
      const needed = (item.redLine * 2) - item.quantity; // Restock to 2x redLine
      list.push({
        ...item,
        status,
        needed: Math.max(1, Math.ceil(needed)),
        urgency: status === 'out' ? 'urgent' : 'normal',
      });
    }
  });

  // Sort: out items first, then low
  list.sort((a, b) => {
    if (a.status === 'out' && b.status !== 'out') return -1;
    if (a.status !== 'out' && b.status === 'out') return 1;
    return 0;
  });

  return list;
}

/**
 * Generate a P4 task for the shopping list
 */
export function generateShoppingTask(shoppingList) {
  if (!shoppingList || shoppingList.length === 0) return null;

  const urgentItems = shoppingList.filter(i => i.urgency === 'urgent');
  const normalItems = shoppingList.filter(i => i.urgency === 'normal');

  const description = [
    urgentItems.length > 0 ? `🔴 דחוף: ${urgentItems.map(i => `${i.name} (${i.needed} ${i.unit})`).join(', ')}` : '',
    normalItems.length > 0 ? `🟡 נמוך: ${normalItems.map(i => `${i.name} (${i.needed} ${i.unit})`).join(', ')}` : '',
  ].filter(Boolean).join('\n');

  return {
    title: `🛒 רשימת קניות (${shoppingList.length} פריטים)`,
    description,
    category: 'home',
    priority: urgentItems.length > 0 ? 'high' : 'medium',
    status: 'not_started',
    due_date: new Date().toISOString().split('T')[0],
    tags: ['shopping', 'auto-generated', 'P4'],
    estimated_time: 60, // minutes
  };
}

/**
 * Get inventory stats summary
 */
export function getInventoryStats(inventory) {
  if (!inventory) inventory = loadInventory();
  const items = Object.values(inventory);
  const stats = {
    total: items.length,
    inStock: 0,
    low: 0,
    out: 0,
    byCategory: {},
  };

  items.forEach(item => {
    const status = getItemStatus(item.quantity, item.redLine);
    if (status === 'in_stock') stats.inStock++;
    else if (status === 'low') stats.low++;
    else stats.out++;

    if (!stats.byCategory[item.category]) {
      stats.byCategory[item.category] = { inStock: 0, low: 0, out: 0 };
    }
    stats.byCategory[item.category][status === 'in_stock' ? 'inStock' : status]++;
  });

  return stats;
}
