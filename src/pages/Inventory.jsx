/**
 * ── Inventory Page: P4 Lean Inventory System ──
 *
 * Tracks cleaning supplies and human food with Red Line logic.
 * Now backed by InventoryItem entity for cross-device sync.
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Plus, Minus, Package, AlertTriangle, CheckCircle, Trash2, RotateCcw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { InventoryItem } from '@/api/entities';
import {
  INVENTORY_CATEGORIES,
  getItemStatus,
  getStatusColor,
  getStatusLabel,
  getStatusIcon,
} from '@/engines/inventoryEngine';

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('cleaning');
  const [showShoppingList, setShowShoppingList] = useState(false);
  const [newItemName, setNewItemName] = useState('');

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      const data = await InventoryItem.list('name', 500);
      if (data.length > 0) {
        setItems(data);
      } else {
        // Seed from localStorage if available, otherwise start empty
        const { loadInventory: loadLocal } = await import(/* @vite-ignore */ '@/engines/inventoryEngine');
        const localData = loadLocal();
        const localItems = Object.values(localData);
        if (localItems.length > 0) {
          // Migrate localStorage data to entity
          const created = [];
          for (const item of localItems) {
            const c = await InventoryItem.create({
              name: item.name,
              category: item.category,
              unit: item.unit,
              red_line: item.redLine,
              quantity: item.quantity,
              is_custom: item.isCustom || false,
            });
            created.push(c);
          }
          setItems(created);
          toast.success(`${created.length} פריטים מיובאים מהמכשיר המקומי`);
        }
      }
    } catch (err) {
      console.error('Failed to load inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const result = { total: items.length, inStock: 0, low: 0, out: 0, byCategory: {} };
    items.forEach(item => {
      const status = getItemStatus(item.quantity, item.red_line || item.redLine || 1);
      if (status === 'ok') result.inStock++;
      else if (status === 'low') result.low++;
      else result.out++;
      if (!result.byCategory[item.category]) result.byCategory[item.category] = { out: 0, low: 0 };
      if (status === 'out') result.byCategory[item.category].out++;
      if (status === 'low') result.byCategory[item.category].low++;
    });
    return result;
  }, [items]);

  const shoppingList = useMemo(() => {
    return items
      .filter(item => {
        const status = getItemStatus(item.quantity, item.red_line || item.redLine || 1);
        return status === 'out' || status === 'low';
      })
      .map(item => ({
        ...item,
        needed: (item.red_line || item.redLine || 1) * 2 - item.quantity,
        urgency: getItemStatus(item.quantity, item.red_line || item.redLine || 1) === 'out' ? 'urgent' : 'low',
        status: getItemStatus(item.quantity, item.red_line || item.redLine || 1),
      }));
  }, [items]);

  const handleQuantityChange = useCallback(async (itemId, delta) => {
    setItems(prev => prev.map(item =>
      item.id === itemId ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item
    ));
    const item = items.find(i => i.id === itemId);
    if (item) {
      try {
        await InventoryItem.update(itemId, { quantity: Math.max(0, item.quantity + delta) });
      } catch (err) {
        console.error(err);
      }
    }
  }, [items]);

  const handleSetQuantity = useCallback(async (itemId, quantity) => {
    const val = Math.max(0, quantity);
    setItems(prev => prev.map(item =>
      item.id === itemId ? { ...item, quantity: val } : item
    ));
    try {
      await InventoryItem.update(itemId, { quantity: val });
    } catch (err) {
      console.error(err);
    }
  }, []);

  const handleAddCustomItem = useCallback(async () => {
    if (!newItemName.trim()) return;
    try {
      const created = await InventoryItem.create({
        name: newItemName.trim(),
        category: activeCategory,
        unit: 'יחידה',
        red_line: 1,
        quantity: 0,
        is_custom: true,
      });
      setItems(prev => [...prev, created]);
      setNewItemName('');
      toast.success(`${newItemName} נוסף למלאי`);
    } catch (err) {
      console.error(err);
      toast.error('שגיאה בהוספת פריט');
    }
  }, [newItemName, activeCategory]);

  const handleRestockAll = useCallback(async () => {
    const updated = items.map(item => ({
      ...item,
      quantity: (item.red_line || item.redLine || 1) * 2,
    }));
    setItems(updated);
    try {
      for (const item of updated) {
        await InventoryItem.update(item.id, { quantity: item.quantity });
      }
      toast.success('כל הפריטים עודכנו למלאי מלא');
    } catch (err) {
      console.error(err);
    }
  }, [items]);

  const categoryItems = useMemo(() => {
    return items.filter(item => item.category === activeCategory);
  }, [items, activeCategory]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6" dir="rtl">
        <div className="flex items-center gap-2 mb-6">
          <Package className="w-7 h-7 text-amber-600" />
          <h1 className="text-xl font-bold text-[#1E3A5F]">מלאי בית — P4</h1>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-20 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#1E3A5F] dark:text-white flex items-center gap-2">
            <Package className="w-6 h-6 text-amber-600" />
            מלאי בית — P4
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">מערכת Lean — ניהול מלאי חומרי ניקיון ומזון</p>
        </div>
        <Button
          variant="outline"
          onClick={() => setShowShoppingList(!showShoppingList)}
          className={`gap-2 ${shoppingList.length > 0 ? 'border-red-300 text-red-700 hover:bg-red-50' : ''}`}
        >
          <ShoppingCart className="w-4 h-4" />
          רשימת קניות ({shoppingList.length})
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card className="rounded-xl border dark:bg-gray-900 dark:border-gray-700">
          <CardContent className="p-3">
            <p className="text-[10px] text-gray-500 dark:text-gray-400">סה"כ</p>
            <p className="text-xl font-bold text-gray-800 dark:text-white">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
          <CardContent className="p-3">
            <p className="text-[10px] text-green-600">במלאי</p>
            <p className="text-xl font-bold text-green-700 dark:text-green-400">{stats.inStock}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
          <CardContent className="p-3">
            <p className="text-[10px] text-amber-600">נמוך</p>
            <p className="text-xl font-bold text-amber-700 dark:text-amber-400">{stats.low}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
          <CardContent className="p-3">
            <p className="text-[10px] text-red-600">חסר</p>
            <p className="text-xl font-bold text-red-700 dark:text-red-400">{stats.out}</p>
          </CardContent>
        </Card>
      </div>

      {/* Shopping List */}
      <AnimatePresence>
        {showShoppingList && shoppingList.length > 0 && (
          <motion.div
            className="bg-white dark:bg-gray-900 rounded-xl border-2 border-red-200 dark:border-red-800 p-5 mb-6 shadow-lg"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                רשימת קניות אוטומטית
              </h2>
              <Button size="sm" variant="outline" onClick={handleRestockAll} className="gap-1">
                <RotateCcw className="w-3 h-3" />
                מלא הכל
              </Button>
            </div>
            <div className="space-y-2">
              {shoppingList.map(item => (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg ${
                    item.urgency === 'urgent' ? 'bg-red-50 dark:bg-red-900/20' : 'bg-amber-50 dark:bg-amber-900/20'
                  }`}
                >
                  <span>{getStatusIcon(item.status)}</span>
                  <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200">{item.name}</span>
                  <span className="text-xs text-gray-500">צריך: {item.needed} {item.unit}</span>
                  <Badge variant={item.urgency === 'urgent' ? 'destructive' : 'secondary'} className="text-[10px]">
                    {item.urgency === 'urgent' ? 'דחוף!' : 'נמוך'}
                  </Badge>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {showShoppingList && shoppingList.length === 0 && (
        <div className="text-center py-6 mb-6 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
          <CheckCircle className="w-8 h-8 mx-auto text-green-500 mb-2" />
          <p className="text-sm text-green-700 dark:text-green-400">אין פריטים חסרים — המלאי מלא!</p>
        </div>
      )}

      {/* Category Tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {Object.entries(INVENTORY_CATEGORIES).map(([key, cat]) => (
          <Button
            key={key}
            variant={activeCategory === key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveCategory(key)}
            className="gap-2 flex-shrink-0"
          >
            <span className="text-base">{cat.icon}</span>
            {cat.label}
            {stats.byCategory[key] && (stats.byCategory[key].out > 0 || stats.byCategory[key].low > 0) && (
              <Badge variant="destructive" className="text-[10px] px-1 py-0">
                {(stats.byCategory[key].out || 0) + (stats.byCategory[key].low || 0)}
              </Badge>
            )}
          </Button>
        ))}
      </div>

      {/* Items Grid */}
      {categoryItems.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
          <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">אין פריטים בקטגוריה זו</p>
          <p className="text-xs mt-1">הוסיפו פריטים למטה</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {categoryItems.map(item => {
            const rl = item.red_line || item.redLine || 1;
            const status = getItemStatus(item.quantity, rl);
            const statusColor = getStatusColor(status);

            return (
              <motion.div
                key={item.id}
                className="bg-white dark:bg-gray-900 rounded-xl border-2 dark:border-gray-700 p-4 flex items-center gap-3 transition-all hover:shadow-md"
                style={{ borderColor: status === 'out' ? '#EF4444' : status === 'low' ? '#F59E0B' : undefined }}
                layout
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0"
                  style={{ backgroundColor: `${statusColor}20`, color: statusColor }}
                >
                  {getStatusIcon(status)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-800 dark:text-gray-200 truncate">{item.name}</span>
                    <span
                      className="text-[11px] px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                      style={{ backgroundColor: `${statusColor}20`, color: statusColor }}
                    >
                      {getStatusLabel(status)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] text-gray-400 dark:text-gray-500">
                      קו אדום: {rl} {item.unit}
                    </span>
                    {item.is_custom && (
                      <Badge variant="secondary" className="text-[10px] px-1 py-0">מותאם</Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleQuantityChange(item.id, -1)}
                    className="w-8 h-8 rounded-full hover:bg-red-100 hover:text-red-600"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </Button>
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => handleSetQuantity(item.id, parseInt(e.target.value) || 0)}
                    className="w-14 text-center text-lg font-bold border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-xl py-1 focus:border-blue-400 focus:outline-none"
                    min={0}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleQuantityChange(item.id, 1)}
                    className="w-8 h-8 rounded-full hover:bg-green-100 hover:text-green-600"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Add Custom Item */}
      <div className="mt-4 flex gap-2">
        <Input
          value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddCustomItem()}
          placeholder="הוסף פריט חדש..."
          className="dark:bg-gray-800 dark:border-gray-600"
        />
        <Button
          onClick={handleAddCustomItem}
          disabled={!newItemName.trim()}
          className="gap-2 bg-emerald-500 hover:bg-emerald-600"
        >
          <Plus className="w-4 h-4" />
          הוסף
        </Button>
      </div>
    </div>
  );
}
