import React, { useState, useEffect, useRef, useCallback } from "react";
import { Client } from "@/api/entities";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { computeComplexityTier, getTierInfo } from "@/lib/complexity";
import { COMPLEXITY_TIERS } from "@/lib/theme-constants";
import { Save, CheckCircle, AlertTriangle, Loader2, Zap } from "lucide-react";

// Editable fields config
const FIELDS = ['employee_count', 'complexity_level', 'vat_volume'];

export default function BatchSetupPage() {
  const [clients, setClients] = useState([]);
  const [editBuffer, setEditBuffer] = useState({}); // { clientId: { field: value } }
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // 'success' | 'error' | null
  const inputRefs = useRef({}); // { `${rowIdx}-${fieldIdx}`: ref }

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    setIsLoading(true);
    try {
      const data = await Client.list();
      const activeClients = (data || []).filter(c =>
        c.status === 'active' || c.status === 'onboarding_pending' || !c.status
      );
      // Sort alphabetically
      activeClients.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setClients(activeClients);
    } catch (error) {
      console.error("Error loading clients:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Get the effective value (edit buffer overrides stored value)
  const getValue = useCallback((client, field) => {
    if (editBuffer[client.id]?.[field] !== undefined) {
      return editBuffer[client.id][field];
    }
    return client[field] ?? '';
  }, [editBuffer]);

  // Update a field in the edit buffer
  const updateField = useCallback((clientId, field, value) => {
    setEditBuffer(prev => ({
      ...prev,
      [clientId]: {
        ...(prev[clientId] || {}),
        [field]: value,
      },
    }));
    setSaveStatus(null);
  }, []);

  // Build a "merged" client object for tier computation
  const getMergedClient = useCallback((client) => {
    const edits = editBuffer[client.id] || {};
    return { ...client, ...edits };
  }, [editBuffer]);

  // Keyboard navigation: Tab = next field, Enter = next row same field
  const handleKeyDown = useCallback((e, rowIdx, fieldIdx) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Move to same field in next row
      const nextRef = inputRefs.current[`${rowIdx + 1}-${fieldIdx}`];
      if (nextRef) nextRef.focus();
    }
    // Tab is handled natively by the browser (moves to next focusable element)
  }, []);

  // Register an input ref for keyboard navigation
  const setInputRef = useCallback((rowIdx, fieldIdx, el) => {
    inputRefs.current[`${rowIdx}-${fieldIdx}`] = el;
  }, []);

  // Save all changes to Supabase via the entity API
  const handleSave = async () => {
    const changedIds = Object.keys(editBuffer);
    if (changedIds.length === 0) return;

    setIsSaving(true);
    setSaveStatus(null);

    try {
      for (const clientId of changedIds) {
        const changes = editBuffer[clientId];
        // Convert numeric fields
        const cleanChanges = {};
        if (changes.employee_count !== undefined) {
          cleanChanges.employee_count = changes.employee_count === '' ? null : Number(changes.employee_count);
        }
        if (changes.complexity_level !== undefined) {
          cleanChanges.complexity_level = changes.complexity_level === '' ? null : Number(changes.complexity_level);
        }
        if (changes.vat_volume !== undefined) {
          cleanChanges.vat_volume = changes.vat_volume === '' ? null : Number(changes.vat_volume);
        }

        await Client.update(clientId, cleanChanges);
      }

      // Reload to get fresh data from Supabase
      await loadClients();
      setEditBuffer({});
      setSaveStatus('success');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (error) {
      console.error("Error saving batch data:", error);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const changedCount = Object.keys(editBuffer).length;

  // Count clients missing data
  const missingDataCount = clients.filter(c =>
    !c.employee_count && !c.complexity_level
  ).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="mr-3 text-muted-foreground">טוען נתוני לקוחות...</span>
      </div>
    );
  }

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Zap className="w-6 h-6 text-amber-500" />
            אשף מוכנות - הגדרת מורכבות לקוחות
          </h1>
          <p className="text-muted-foreground mt-1">
            הזן את נתוני המורכבות עבור כל לקוח. השינויים יעדכנו מיד את מפת המוח ואת חישובי הזמנים.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {missingDataCount > 0 && (
            <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
              <AlertTriangle className="w-3 h-3 ml-1" />
              {missingDataCount} לקוחות חסרי נתונים
            </Badge>
          )}

          {saveStatus === 'success' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-1 text-green-600 text-sm font-medium"
            >
              <CheckCircle className="w-4 h-4" />
              נשמר בהצלחה
            </motion.div>
          )}

          {saveStatus === 'error' && (
            <span className="text-red-600 text-sm">שגיאה בשמירה</span>
          )}

          <Button
            onClick={handleSave}
            disabled={changedCount === 0 || isSaving}
            className="min-w-[140px]"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                שומר...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 ml-2" />
                שמור שינויים {changedCount > 0 ? `(${changedCount})` : ''}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
        <strong>ניווט מהיר:</strong> Tab = שדה הבא | Enter = שורה הבאה (אותו שדה) | הדרגה מחושבת אוטומטית ממספר עובדים
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[40px] text-center text-muted-foreground">#</TableHead>
              <TableHead className="min-w-[180px] font-semibold">שם לקוח</TableHead>
              <TableHead className="min-w-[100px] font-semibold">סוגי שירות</TableHead>
              <TableHead className="w-[130px] font-semibold">מספר עובדים</TableHead>
              <TableHead className="w-[160px] font-semibold">רמת מורכבות</TableHead>
              <TableHead className="w-[150px] font-semibold">מחזור מע"מ חודשי</TableHead>
              <TableHead className="w-[120px] font-semibold text-center">דרגה מחושבת</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((client, rowIdx) => {
              const merged = getMergedClient(client);
              const tier = computeComplexityTier(merged);
              const tierInfo = getTierInfo(tier);
              const isEdited = !!editBuffer[client.id];
              const isMissingData = !merged.employee_count && merged.complexity_level === null;

              return (
                <TableRow
                  key={client.id}
                  className={`${isEdited ? 'bg-amber-50/50' : ''} ${isMissingData ? 'bg-red-50/30' : ''}`}
                >
                  {/* Row number */}
                  <TableCell className="text-center text-muted-foreground text-xs">
                    {rowIdx + 1}
                  </TableCell>

                  {/* Client name */}
                  <TableCell className="font-medium">
                    {client.name}
                    {isEdited && (
                      <span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-2" />
                    )}
                  </TableCell>

                  {/* Service types */}
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(client.service_types || []).slice(0, 3).map(st => (
                        <Badge key={st} variant="outline" className="text-[10px] py-0">
                          {st === 'payroll' ? 'שכר' :
                           st === 'vat_reporting' ? 'מע"מ' :
                           st === 'tax_advances' ? 'מקדמות' :
                           st === 'bookkeeping' ? 'הנה"ח' :
                           st === 'annual_reports' ? 'מאזנים' :
                           st === 'reconciliation' ? 'התאמות' :
                           st === 'consulting' ? 'ייעוץ' : st}
                        </Badge>
                      ))}
                      {(client.service_types || []).length > 3 && (
                        <Badge variant="outline" className="text-[10px] py-0">
                          +{(client.service_types || []).length - 3}
                        </Badge>
                      )}
                    </div>
                  </TableCell>

                  {/* Employee count */}
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={getValue(client, 'employee_count')}
                      onChange={(e) => updateField(client.id, 'employee_count', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIdx, 0)}
                      ref={(el) => setInputRef(rowIdx, 0, el)}
                      className="h-8 w-full text-center"
                    />
                  </TableCell>

                  {/* Complexity level (manual override) */}
                  <TableCell>
                    <Select
                      value={String(getValue(client, 'complexity_level') ?? '')}
                      onValueChange={(val) => updateField(client.id, 'complexity_level', val === 'auto' ? '' : val)}
                    >
                      <SelectTrigger className="h-8"
                        ref={(el) => setInputRef(rowIdx, 1, el)}
                        onKeyDown={(e) => handleKeyDown(e, rowIdx, 1)}
                      >
                        <SelectValue placeholder="אוטומטי" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">אוטומטי</SelectItem>
                        <SelectItem value="0">{COMPLEXITY_TIERS[0].icon} {COMPLEXITY_TIERS[0].label}</SelectItem>
                        <SelectItem value="1">{COMPLEXITY_TIERS[1].icon} {COMPLEXITY_TIERS[1].label}</SelectItem>
                        <SelectItem value="2">{COMPLEXITY_TIERS[2].icon} {COMPLEXITY_TIERS[2].label}</SelectItem>
                        <SelectItem value="3">{COMPLEXITY_TIERS[3].icon} {COMPLEXITY_TIERS[3].label}</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>

                  {/* VAT volume */}
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={getValue(client, 'vat_volume')}
                      onChange={(e) => updateField(client.id, 'vat_volume', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIdx, 2)}
                      ref={(el) => setInputRef(rowIdx, 2, el)}
                      className="h-8 w-full text-center"
                    />
                  </TableCell>

                  {/* Computed tier badge */}
                  <TableCell className="text-center">
                    <motion.div
                      key={`${client.id}-${tier}`}
                      initial={{ scale: 0.8 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                    >
                      <Badge
                        className={`text-sm px-3 py-1 ${
                          tier === 0 ? 'bg-gray-100 text-gray-700 border-gray-300' :
                          tier === 1 ? 'bg-green-100 text-green-700 border-green-300' :
                          tier === 2 ? 'bg-yellow-100 text-yellow-700 border-yellow-300' :
                          'bg-red-100 text-red-700 border-red-300'
                        }`}
                        variant="outline"
                      >
                        {tierInfo.icon} {tierInfo.label}
                      </Badge>
                    </motion.div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Footer summary */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{clients.length} לקוחות פעילים</span>
        <div className="flex gap-4">
          {Object.values(COMPLEXITY_TIERS).map((t, i) => {
            const count = clients.filter(c => computeComplexityTier(getMergedClient(c)) === i).length;
            return (
              <span key={i} className="flex items-center gap-1">
                {t.icon} {t.label}: {count}
              </span>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
