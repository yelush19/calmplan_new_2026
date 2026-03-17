/**
 * ── Inventory Page: P4 Lean Inventory System ──
 *
 * Tracks cleaning supplies and human food with Red Line logic.
 * Auto-generates shopping list when items hit Red status.
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart, Plus, Minus, Package, AlertTriangle, CheckCircle, Trash2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import {
  INVENTORY_CATEGORIES,
  loadInventory,
  saveInventory,
  updateItemQuantity,
  addCustomItem,
  generateShoppingList,
  generateShoppingTask,
  getItemStatus,
  getStatusColor,
  getStatusLabel,
  getStatusIcon,
  getInventoryStats,
} from '@/engines/inventoryEngine';

export default function Inventory() {
  const [inventory, setInventory] = useState(() => loadInventory());
  const [activeCategory, setActiveCategory] = useState('cleaning');
  const [showShoppingList, setShowShoppingList] = useState(false);
  const [newItemName, setNewItemName] = useState('');

  const stats = useMemo(() => getInventoryStats(inventory), [inventory]);
  const shoppingList = useMemo(() => generateShoppingList(inventory), [inventory]);

  const handleQuantityChange = useCallback((itemId, delta) => {
    setInventory(prev => {
      const updated = { ...prev };
      if (updated[itemId]) {
        updated[itemId] = {
          ...updated[itemId],
          quantity: Math.max(0, updated[itemId].quantity + delta),
          lastUpdated: new Date().toISOString(),
        };
        saveInventory(updated);
      }
      return updated;
    });
  }, []);

  const handleSetQuantity = useCallback((itemId, quantity) => {
    setInventory(prev => {
      const updated = { ...prev };
      if (updated[itemId]) {
        updated[itemId] = {
          ...updated[itemId],
          quantity: Math.max(0, quantity),
          lastUpdated: new Date().toISOString(),
        };
        saveInventory(updated);
      }
      return updated;
    });
  }, []);

  const handleAddCustomItem = useCallback(() => {
    if (!newItemName.trim()) return;
    const updated = addCustomItem({
      name: newItemName.trim(),
      category: activeCategory,
      unit: 'יחידה',
      redLine: 1,
      quantity: 0,
    });
    setInventory(updated);
    setNewItemName('');
    toast.success(`${newItemName} נוסף למלאי`);
  }, [newItemName, activeCategory]);

  const handleGenerateShoppingTask = useCallback(async () => {
    const task = generateShoppingTask(shoppingList);
    if (!task) {
      toast.info('אין פריטים ברשימת הקניות');
      return;
    }
    // In a real app, this would create a task via the API
    toast.success(`נוצרה משימת קניות עם ${shoppingList.length} פריטים`, {
      description: task.title,
    });
  }, [shoppingList]);

  const handleRestockAll = useCallback(() => {
    setInventory(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(id => {
        updated[id] = {
          ...updated[id],
          quantity: updated[id].redLine * 2,
          lastUpdated: new Date().toISOString(),
        };
      });
      saveInventory(updated);
      return updated;
    });
    toast.success('כל הפריטים עודכנו למלאי מלא');
  }, []);

  const categoryItems = useMemo(() => {
    return Object.values(inventory).filter(item => item.category === activeCategory);
  }, [inventory, activeCategory]);

  return (
    <div className="max-w-4xl mx-auto p-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Package className="w-7 h-7 text-amber-600" />
            מלאי בית — P4
          </h1>
          <p className="text-sm text-gray-500 mt-1">מערכת Lean — ניהול מלאי חומרי ניקיון ומזון</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowShoppingList(!showShoppingList)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
              shoppingList.length > 0
                ? 'bg-red-50 text-red-700 border-2 border-red-200 hover:bg-red-100'
                : 'bg-gray-50 text-gray-500 border-2 border-gray-200'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            רשימת קניות ({shoppingList.length})
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-4 border-2 border-gray-100 shadow-sm">
          <p className="text-xs text-gray-500">סה"כ פריטים</p>
          <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
        </div>
        <div className="bg-green-50 rounded-2xl p-4 border-2 border-green-100">
          <p className="text-xs text-green-600">במלאי</p>
          <p className="text-2xl font-bold text-green-700">{stats.inStock}</p>
        </div>
        <div className="bg-amber-50 rounded-2xl p-4 border-2 border-amber-100">
          <p className="text-xs text-amber-600">נמוך</p>
          <p className="text-2xl font-bold text-amber-700">{stats.low}</p>
        </div>
        <div className="bg-red-50 rounded-2xl p-4 border-2 border-red-100">
          <p className="text-xs text-red-600">חסר</p>
          <p className="text-2xl font-bold text-red-700">{stats.out}</p>
        </div>
      </div>

      {/* Shopping List Overlay */}
      {showShoppingList && shoppingList.length > 0 && (
        <motion.div
          className="bg-white rounded-2xl border-2 border-red-200 p-5 mb-6 shadow-lg"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-red-700 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              רשימת קניות אוטומטית
            </h2>
            <div className="flex gap-2">
              <button
                onClick={handleGenerateShoppingTask}
                className="px-3 py-1.5 rounded-full bg-red-500 text-white text-xs font-medium hover:bg-red-600 transition-colors"
              >
                צור משימת P4
              </button>
              <button
                onClick={handleRestockAll}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-green-500 text-white text-xs font-medium hover:bg-green-600 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                מלא הכל
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {shoppingList.map(item => (
              <div
                key={item.id}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl ${
                  item.urgency === 'urgent' ? 'bg-red-50' : 'bg-amber-50'
                }`}
              >
                <span>{getStatusIcon(item.status)}</span>
                <span className="flex-1 text-sm font-medium text-gray-800">{item.name}</span>
                <span className="text-xs text-gray-500">צריך: {item.needed} {item.unit}</span>
                <span className={`text-xs font-bold ${item.urgency === 'urgent' ? 'text-red-600' : 'text-amber-600'}`}>
                  {item.urgency === 'urgent' ? 'דחוף!' : 'נמוך'}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Category Tabs */}
      <div className="flex gap-2 mb-4">
        {Object.entries(INVENTORY_CATEGORIES).map(([key, cat]) => (
          <button
            key={key}
            onClick={() => setActiveCategory(key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeCategory === key
                ? 'bg-white shadow-md border-2 font-bold'
                : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
            }`}
            style={activeCategory === key ? { borderColor: cat.color, color: cat.color } : {}}
          >
            <span className="text-lg">{cat.icon}</span>
            {cat.label}
            {stats.byCategory[key] && (
              <span className="text-[12px] bg-gray-100 text-gray-600 px-1.5 rounded-full">
                {stats.byCategory[key].out > 0 && `🔴${stats.byCategory[key].out}`}
                {stats.byCategory[key].low > 0 && ` 🟡${stats.byCategory[key].low}`}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Inventory Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {categoryItems.map(item => {
          const status = getItemStatus(item.quantity, item.redLine);
          const statusColor = getStatusColor(status);

          return (
            <motion.div
              key={item.id}
              className="bg-white rounded-xl border-2 p-4 flex items-center gap-3 transition-all hover:shadow-md"
              style={{ borderColor: status === 'out' ? '#EF4444' : status === 'low' ? '#F59E0B' : '#E5E7EB' }}
              layout
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold"
                style={{ backgroundColor: `${statusColor}20`, color: statusColor }}
              >
                {getStatusIcon(status)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-800">{item.name}</span>
                  <span
                    className="text-[12px] px-2 py-0.5 rounded-full font-medium"
                    style={{ backgroundColor: `${statusColor}20`, color: statusColor }}
                  >
                    {getStatusLabel(status)}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-400">
                    קו אדום: {item.redLine} {item.unit}
                  </span>
                  {item.isCustom && (
                    <span className="text-[11px] bg-purple-100 text-purple-600 px-1 rounded">מותאם</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleQuantityChange(item.id, -1)}
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-red-100 flex items-center justify-center text-gray-600 hover:text-red-600 transition-colors"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <input
                  type="number"
                  value={item.quantity}
                  onChange={(e) => handleSetQuantity(item.id, parseInt(e.target.value) || 0)}
                  className="w-14 text-center text-lg font-bold border-2 border-gray-200 rounded-xl py-1 focus:border-blue-400 focus:outline-none"
                  min={0}
                />
                <button
                  onClick={() => handleQuantityChange(item.id, 1)}
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-green-100 flex items-center justify-center text-gray-600 hover:text-green-600 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Add Custom Item */}
      <div className="mt-4 flex gap-2">
        <input
          type="text"
          value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddCustomItem()}
          placeholder="הוסף פריט חדש..."
          className="flex-1 px-4 py-2.5 rounded-xl border-2 border-gray-200 text-sm focus:border-blue-400 focus:outline-none"
        />
        <button
          onClick={handleAddCustomItem}
          disabled={!newItemName.trim()}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="w-4 h-4" />
          הוסף
        </button>
      </div>
    </div>
  );
}
