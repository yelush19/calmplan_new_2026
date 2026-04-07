import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog';
import {
  RefreshCw, CheckCircle, AlertTriangle, Calendar, Plus,
  Clock, FileText, Calculator, Building, Trash2,
  ChevronDown, ChevronRight, Sparkles, Eye, EyeOff, Zap, XCircle
} from 'lucide-react';
import { Client, Task, SystemConfig } from '@/api/entities';
import { format, addMonths, setDate, startOfMonth } from 'date-fns';
import { he } from 'date-fns/locale';
import { Label } from '@/components/ui/label';
import { getDueDateForCategory, isClient874, getDeadlineTypeLabel, HEBREW_MONTH_NAMES } from '@/config/taxCalendar2026';
import { getScheduledStartForCategory, loadServiceDueDates, getDueDayForCategory, loadExecutionPeriods, DEFAULT_SERVICE_DUE_DATES } from '@/config/automationRules';
import { getServiceWeight } from '@/config/serviceWeights';
import { computeComplexityTier } from '@/lib/complexity';
import { COMPLEXITY_TIERS } from '@/lib/theme-constants';
import { onTreeChange } from '@/services/processTreeService';
import { useDesign } from '@/contexts/DesignContext';

// ============================================================
// P-Branch definitions: P1-P5 full pipeline
// ============================================================
const P_BRANCHES = {
  P1: {
    key: 'P1',
    label: 'P1 | חשבות שכר',
    color: 'bg-sky-100 text-sky-800',
    accent: 'border-sky-400',
    bgSoft: 'bg-sky-50',
    dot: 'bg-sky-500',
    order: 1,
    categories: ['שכר', 'ביטוח לאומי', 'ניכויים', 'משלוח תלושים', 'מס"ב עובדים', 'מתפעל', 'טמל + לקוח', 'קליטה להנה"ח', '126 ביטוח לאומי', '126 ניכויים', '106 שנתי'],
  },
  P2: {
    key: 'P2',
    label: 'P2 | הנהלת חשבונות',
    color: 'bg-purple-100 text-purple-800',
    accent: 'border-purple-400',
    bgSoft: 'bg-purple-50',
    dot: 'bg-purple-500',
    order: 2,
    categories: ['מע"מ', 'מע"מ 874', 'מקדמות מס', 'דוח רו"ה', 'קליטת הכנסות', 'קליטת הוצאות', 'מס"ב ספקים'],
  },
  P3: {
    key: 'P3',
    label: 'P3 | ניהול ותכנון',
    color: 'bg-amber-100 text-amber-800',
    accent: 'border-amber-400',
    bgSoft: 'bg-amber-50',
    dot: 'bg-amber-500',
    order: 3,
    categories: ['התאמות חשבונות', 'אדמיניסטרציה', 'משרד'],
  },
  P5: {
    key: 'P5',
    label: 'P5 | דוחות שנתיים',
    color: 'bg-green-100 text-green-800',
    accent: 'border-green-400',
    bgSoft: 'bg-green-50',
    dot: 'bg-green-500',
    order: 5,
    categories: ['דוח שנתי', 'הצהרת הון', 'דוחות אישיים'],
  },
};

// ============================================================
// Category definitions with branch assignment
// ============================================================
/**
 * REPORT_CATEGORIES — Service-aware task generation.
 * ZERO GHOST DATA: Only services that exist in client.service_types[] generate tasks.
 * Each category is assigned to a P-branch for hierarchical tagging.
 *
 * Filtering rules:
 *   - ביטוח לאומי: ONLY if client.service_types includes 'social_security'
 *   - ניכויים: ONLY if client.service_types includes 'deductions'
 *   - דוח רו"ה: ONLY if client.service_types includes 'pnl_reports'
 *   - Frequency is checked per-category via reporting_info[frequencyField]
 */
const REPORT_CATEGORIES = {
  'שכר': {
    label: 'שכר',
    emoji: '💰',
    cardColor: '#0EA5E9', // P1-שכר core group
    icon: FileText,
    color: 'bg-sky-100 text-sky-800',
    accent: 'border-sky-400',
    bgSoft: 'bg-sky-50',
    dot: 'bg-sky-500',
    frequencyField: 'payroll_frequency',
    serviceTypeKey: 'payroll',
    treeNodeId: 'P1_payroll',
    dayOfMonth: 9, // שכר: דדליין אחרון 9, נורמלי 7
    order: 1,
    branch: 'P1',
  },
  'ביטוח לאומי': {
    label: 'ביטוח לאומי — דיווח',
    emoji: '🏛️',
    cardColor: '#0284C7', // P1-דיווחים group
    icon: Building,
    color: 'bg-sky-100 text-sky-800',
    accent: 'border-sky-400',
    bgSoft: 'bg-sky-50',
    dot: 'bg-sky-600',
    frequencyField: 'social_security_frequency',
    serviceTypeKey: 'social_security',
    treeNodeId: 'P1_social_security',
    fallbackFrequencyField: 'payroll_frequency',
    dayOfMonth: 15,
    order: 2,
    branch: 'P1',
  },
  'ניכויים': {
    label: 'ניכויים — דיווח',
    emoji: '📋',
    cardColor: '#0284C7', // P1-דיווחים group
    icon: FileText,
    color: 'bg-sky-100 text-sky-800',
    accent: 'border-sky-400',
    bgSoft: 'bg-sky-50',
    dot: 'bg-sky-600',
    frequencyField: 'deductions_frequency',
    serviceTypeKey: 'deductions',
    treeNodeId: 'P1_deductions',
    fallbackFrequencyField: 'payroll_frequency',
    dayOfMonth: 19,
    order: 3,
    branch: 'P1',
  },
  'מע"מ': {
    label: 'מע"מ תקופתי',
    emoji: '🧾',
    cardColor: '#4682B4', // P2 group
    icon: Calculator,
    color: 'bg-slate-100 text-slate-800',
    accent: 'border-slate-400',
    bgSoft: 'bg-slate-50',
    dot: 'bg-[#4682B4]',
    frequencyField: 'vat_reporting_frequency',
    serviceTypeKey: 'vat_reporting',
    treeNodeId: 'P2_vat',
    dayOfMonth: 19,
    order: 4,
    branch: 'P2',
    exclude874: true, // לא להציג ללקוחות 874
  },
  'מע"מ 874': {
    label: 'מע"מ 874 מפורט',
    emoji: '📑',
    cardColor: '#4682B4', // P2 group
    icon: Calculator,
    color: 'bg-slate-100 text-slate-800',
    accent: 'border-slate-400',
    bgSoft: 'bg-slate-50',
    dot: 'bg-[#4682B4]',
    frequencyField: 'vat_reporting_frequency',
    serviceTypeKey: 'vat_reporting',
    treeNodeId: 'P2_vat',
    dayOfMonth: 23, // 874 מפורט: דדליין 23
    order: 4.5,
    branch: 'P2',
    only874: true, // רק ללקוחות 874
  },
  'מקדמות מס': {
    label: 'מקדמות מס',
    emoji: '📊',
    cardColor: '#4682B4', // P2 group
    icon: Building,
    color: 'bg-slate-100 text-slate-800',
    accent: 'border-slate-400',
    bgSoft: 'bg-slate-50',
    dot: 'bg-[#4682B4]',
    frequencyField: 'tax_advances_frequency',
    serviceTypeKey: 'tax_advances',
    treeNodeId: 'P2_tax_advances',
    dayOfMonth: 19, // מקדמות: דיווח מקוון עד 19
    order: 5,
    branch: 'P2',
  },
  'דוח רו"ה': {
    label: 'דוח רו"ה חודשי',
    emoji: '📈',
    cardColor: '#4682B4', // P2 group
    icon: FileText,
    color: 'bg-slate-100 text-slate-800',
    accent: 'border-slate-400',
    bgSoft: 'bg-slate-50',
    dot: 'bg-[#4682B4]',
    frequencyField: 'pnl_frequency',
    serviceTypeKey: 'pnl_reports',
    treeNodeId: 'P2_pnl',
    dayOfMonth: 15,
    order: 6,
    branch: 'P2',
  },
  // ── P3: Account Reconciliation (depends on P2 completion) ──
  'התאמות חשבונות': {
    label: 'התאמות חשבונות',
    emoji: '🔍',
    cardColor: '#F59E0B',
    icon: FileText,
    color: 'bg-amber-100 text-amber-800',
    accent: 'border-amber-400',
    bgSoft: 'bg-amber-50',
    dot: 'bg-amber-500',
    frequencyField: 'pnl_frequency',
    serviceTypeKey: 'reconciliation',
    treeNodeId: 'P2_reconciliation',
    fallbackFrequencyField: 'vat_reporting_frequency',
    dayOfMonth: 25,
    order: 7,
    branch: 'P3',
  },
  // ── P5: Annual Reports (yearly — May 31 deadline) ──
  'דוח שנתי': {
    label: 'דוח שנתי / מאזן',
    emoji: '📑',
    cardColor: '#2E7D32', // P5 group
    icon: FileText,
    color: 'bg-green-100 text-green-800',
    accent: 'border-green-400',
    bgSoft: 'bg-green-50',
    dot: 'bg-green-600',
    frequencyField: null,
    serviceTypeKey: 'annual_reports',
    treeNodeId: 'P5_annual_reports',
    dayOfMonth: 31,
    order: 8,
    branch: 'P5',
    frequency: 'yearly',
  },

  // ── P1: Periodic payroll reports (126 + 106) ──
  '126 ביטוח לאומי': {
    label: '126 ב"ל — דוח מחצית',
    emoji: '📊',
    cardColor: '#00A3E0',
    icon: FileText,
    color: 'bg-sky-100 text-sky-800',
    accent: 'border-sky-400',
    bgSoft: 'bg-sky-50',
    dot: 'bg-sky-500',
    frequencyField: 'payroll_frequency',
    serviceTypeKey: 'social_security',
    treeNodeId: 'P1_social_security',
    dayOfMonth: 18,
    order: 9,
    branch: 'P1',
    frequency: 'semi_annual',
  },
  '126 ניכויים': {
    label: '126 מ"ה ניכויים — דוח שנתי',
    emoji: '📊',
    cardColor: '#00A3E0',
    icon: FileText,
    color: 'bg-sky-100 text-sky-800',
    accent: 'border-sky-400',
    bgSoft: 'bg-sky-50',
    dot: 'bg-sky-600',
    frequencyField: 'payroll_frequency',
    serviceTypeKey: 'deductions',
    treeNodeId: 'P1_deductions',
    dayOfMonth: 30,
    order: 10,
    branch: 'P1',
    frequency: 'yearly',
  },
  '106 שנתי': {
    label: 'טופס 106 — שליחה לעובדים',
    emoji: '📬',
    cardColor: '#00A3E0',
    icon: FileText,
    color: 'bg-sky-100 text-sky-800',
    accent: 'border-sky-400',
    bgSoft: 'bg-sky-50',
    dot: 'bg-sky-700',
    frequencyField: 'payroll_frequency',
    serviceTypeKey: 'payroll',
    treeNodeId: 'P1_payroll',
    dayOfMonth: 31,
    order: 11,
    branch: 'P1',
    frequency: 'yearly',
  },

  // ============================================================
  // Tree V4.3 nodes — dynamic from process tree
  // ============================================================

  // ── P1: Additional payroll nodes ──
  'משלוח תלושים': {
    label: 'משלוח תלושים',
    emoji: '📨',
    cardColor: '#0EA5E9', // P1-שכר core group
    icon: FileText,
    color: 'bg-sky-100 text-sky-800',
    accent: 'border-sky-400',
    bgSoft: 'bg-sky-50',
    dot: 'bg-sky-500',
    frequencyField: 'payroll_frequency',
    serviceTypeKey: 'payslip_sending',
    treeNodeId: 'P1_payslip_sending',
    dayOfMonth: 9, // תלושים: עד 9 לכל חודש או קודם בחג/שבת
    order: 10,
    branch: 'P1',
  },
  'מס"ב עובדים': {
    label: 'מס"ב עובדים',
    emoji: '🏦',
    cardColor: '#0EA5E9', // P1-שכר core group
    icon: FileText,
    color: 'bg-sky-100 text-sky-800',
    accent: 'border-sky-400',
    bgSoft: 'bg-sky-50',
    dot: 'bg-sky-500',
    frequencyField: 'payroll_frequency',
    serviceTypeKey: 'masav_employees',
    treeNodeId: 'P1_masav_employees',
    dayOfMonth: 9, // מס"ב עובדים: אותם דדליינים כמו שכר 7-9
    order: 11,
    branch: 'P1',
  },
  'מתפעל': {
    label: 'פנסיות — מתפעל',
    emoji: '🤝',
    cardColor: '#0891B2', // P1-פנסיות group
    icon: FileText,
    color: 'bg-cyan-100 text-cyan-800',
    accent: 'border-cyan-400',
    bgSoft: 'bg-cyan-50',
    dot: 'bg-cyan-600',
    frequencyField: 'payroll_frequency',
    serviceTypeKey: 'social_operator',
    treeNodeId: 'P1_operator',
    dayOfMonth: 15, // מתפעל: עד 13-15 כולל העלאת מס"ב
    order: 12,
    branch: 'P1',
  },
  'טמל + לקוח': {
    label: 'פנסיות — טמל',
    emoji: '📤',
    cardColor: '#0891B2', // P1-פנסיות group
    icon: FileText,
    color: 'bg-cyan-100 text-cyan-800',
    accent: 'border-cyan-400',
    bgSoft: 'bg-cyan-50',
    dot: 'bg-cyan-600',
    frequencyField: 'payroll_frequency',
    serviceTypeKey: 'social_taml',
    treeNodeId: 'P1_taml',
    dayOfMonth: 15, // טמל: עד 13-15
    order: 13,
    branch: 'P1',
  },
  'קליטה להנה"ח': {
    label: 'קליטה להנה"ח',
    emoji: '📥',
    cardColor: '#0EA5E9', // P1-שכר core group
    icon: FileText,
    color: 'bg-sky-100 text-sky-800',
    accent: 'border-sky-400',
    bgSoft: 'bg-sky-50',
    dot: 'bg-sky-500',
    frequencyField: 'payroll_frequency',
    serviceTypeKey: 'payroll_closing',
    treeNodeId: 'P1_closing',
    dayOfMonth: 12, // קליטה להנה"ח: לאחר שליחת תלושים +3 ימים
    order: 14,
    branch: 'P1',
  },

  // ── P2: Additional bookkeeping nodes ──
  'קליטת הכנסות': {
    label: 'קליטת הכנסות',
    emoji: '💵',
    cardColor: '#4682B4', // P2 group
    icon: Calculator,
    color: 'bg-slate-100 text-slate-800',
    accent: 'border-slate-400',
    bgSoft: 'bg-slate-50',
    dot: 'bg-[#4682B4]',
    frequencyField: 'vat_reporting_frequency',  // Inherits from VAT frequency
    fallbackFrequencyField: 'tax_advances_frequency',  // If no VAT, inherit from tax advances
    serviceTypeKey: 'income_entry',
    treeNodeId: 'P2_income',
    dayOfMonth: 15,
    order: 15,
    branch: 'P2',
  },
  'קליטת הוצאות': {
    label: 'קליטת הוצאות',
    emoji: '💳',
    cardColor: '#4682B4', // P2 group
    icon: Calculator,
    color: 'bg-slate-100 text-slate-800',
    accent: 'border-slate-400',
    bgSoft: 'bg-slate-50',
    dot: 'bg-[#4682B4]',
    frequencyField: 'vat_reporting_frequency',  // Inherits from VAT frequency
    fallbackFrequencyField: 'tax_advances_frequency',  // If no VAT, inherit from tax advances
    serviceTypeKey: 'expense_entry',
    treeNodeId: 'P2_expenses',
    dayOfMonth: 15,
    order: 16,
    branch: 'P2',
  },
  'מס"ב ספקים': {
    label: 'מס"ב ספקים',
    emoji: '🏧',
    cardColor: '#4682B4', // P2 group
    icon: Calculator,
    color: 'bg-slate-100 text-slate-800',
    accent: 'border-slate-400',
    bgSoft: 'bg-slate-50',
    dot: 'bg-purple-500',
    frequencyField: null,
    serviceTypeKey: 'masav_suppliers',
    treeNodeId: 'P2_masav_suppliers',
    dayOfMonth: 15,
    order: 17,
    branch: 'P2',
  },

  // ── P3: Admin nodes ──
  'אדמיניסטרציה': {
    label: 'אדמיניסטרציה',
    emoji: '📁',
    cardColor: '#F97316',
    icon: FileText,
    color: 'bg-orange-100 text-orange-800',
    accent: 'border-amber-400',
    bgSoft: 'bg-amber-50',
    dot: 'bg-amber-500',
    frequencyField: null,
    serviceTypeKey: 'admin',
    treeNodeId: 'P3_admin',
    dayOfMonth: 25,
    order: 18,
    branch: 'P3',
  },
  'משרד': {
    label: 'ניהול משרד',
    emoji: '🏢',
    cardColor: '#EA580C',
    icon: FileText,
    color: 'bg-orange-100 text-orange-800',
    accent: 'border-amber-400',
    bgSoft: 'bg-amber-50',
    dot: 'bg-amber-500',
    frequencyField: null,
    serviceTypeKey: 'office',
    treeNodeId: 'P3_office',
    dayOfMonth: 25,
    order: 19,
    branch: 'P3',
  },

  // ── P5: Additional annual nodes ──
  'דוחות אישיים': {
    label: 'דוחות אישיים',
    emoji: '👤',
    cardColor: '#2E7D32', // P5 group
    icon: FileText,
    color: 'bg-green-100 text-green-800',
    accent: 'border-green-400',
    bgSoft: 'bg-green-50',
    dot: 'bg-green-600',
    frequencyField: null,
    serviceTypeKey: 'personal_reports',
    treeNodeId: 'P5_personal_reports',
    dayOfMonth: 31,
    order: 20,
    branch: 'P5',
    frequency: 'yearly',
  },
};

const BIMONTHLY_PERIOD_NAMES = {
  2: 'ינואר-פברואר',
  4: 'מרץ-אפריל',
  6: 'מאי-יוני',
  8: 'יולי-אוגוסט',
  10: 'ספטמבר-אוקטובר',
  12: 'נובמבר-דצמבר',
};

const QUARTERLY_PERIOD_NAMES = {
  3: 'ינואר-מרץ (Q1)',
  6: 'אפריל-יוני (Q2)',
  9: 'יולי-ספטמבר (Q3)',
  12: 'אוקטובר-דצמבר (Q4)',
};

const FREQUENCY_LABELS = {
  monthly: 'חודשי',
  bimonthly: 'דו-חודשי',
  quarterly: 'רבעוני',
  semi_annual: 'חצי שנתי',
  yearly: 'שנתי',
  not_applicable: 'לא רלוונטי',
};

function getClientFrequency(categoryKey, client) {
  const cat = REPORT_CATEGORIES[categoryKey];
  if (!cat) return 'monthly';
  // Hard-coded frequency override (e.g., annual reports = yearly)
  if (cat.frequency) return cat.frequency;
  const reporting = client.reporting_info || {};
  // Try primary frequency field first
  const field = cat.frequencyField;
  if (field) {
    const freq = reporting[field];
    if (freq && freq !== 'not_applicable') return freq;
  }
  // Fallback frequency field (e.g., social_security inherits from payroll)
  if (cat.fallbackFrequencyField) {
    const fallback = reporting[cat.fallbackFrequencyField];
    if (fallback && fallback !== 'not_applicable') return fallback;
  }
  return 'monthly';
}

/**
 * Expand 'full_service' into its constituent services.
 * full_service = vat_reporting + payroll + tax_advances + annual_reports
 * Payroll auto-links: payroll → social_security + deductions (via automation rules)
 */
const FULL_SERVICE_EXPANSION = [
  // P1 - Payroll chain
  'payroll', 'payslip_sending', 'masav_employees', 'social_operator', 'social_taml',
  'social_security', 'deductions', 'payroll_closing',
  // P2 - Bookkeeping chain
  'vat_reporting', 'tax_advances', 'income_entry', 'expense_entry',
  'masav_suppliers', 'reconciliation', 'pnl_reports',
  // P3 - Admin
  'admin', 'office',
  // P5 - Annual
  'annual_reports', 'personal_reports',
];

function getExpandedServices(client) {
  const raw = client.service_types || [];
  const expanded = new Set(raw);
  if (expanded.has('full_service')) {
    for (const s of FULL_SERVICE_EXPANSION) expanded.add(s);
  }
  // Check process_tree enabled nodes — map to serviceTypeKey
  const processTree = client.process_tree || {};
  for (const [nodeId, nodeState] of Object.entries(processTree)) {
    if (nodeState?.enabled) {
      // Direct nodeId → serviceTypeKey from REPORT_CATEGORIES (by treeNodeId match)
      for (const cat of Object.values(REPORT_CATEGORIES)) {
        if (cat.treeNodeId === nodeId && cat.serviceTypeKey) {
          expanded.add(cat.serviceTypeKey);
        }
      }
      // Fallback: extract service_key from nodeId (e.g., 'P1_payroll' → 'payroll')
      const serviceKey = nodeId.replace(/^P\d+_/, '');
      if (serviceKey) expanded.add(serviceKey);
    }
  }
  return expanded;
}

/**
 * STRICT service check — ZERO GHOST DATA.
 * Returns true ONLY if client has the exact service key in service_types[],
 * with full_service expansion applied.
 * Also checks that the frequency is active (not 'not_applicable').
 */
function clientHasService(categoryKey, client) {
  const cat = REPORT_CATEGORIES[categoryKey];
  if (!cat) return false;
  const services = getExpandedServices(client);
  if (!services.has(cat.serviceTypeKey)) return false;
  // Also verify frequency is active
  const freq = getClientFrequency(categoryKey, client);
  if (freq === 'not_applicable') return false;
  return true;
}

/**
 * Generate tasks for SPECIFIC selected months.
 * No filtering by "today" — the user decides which months to generate.
 *
 * Frequency logic:
 *   monthly     → task every month (report month = selected month)
 *   bimonthly   → tasks for even report months only (2,4,6,8,10,12)
 *                  covers the previous 2 months (e.g., reportMonth 2 = Jan-Feb)
 *   semi_annual → only for מ"ה ניכויים: reportMonth 6 (Jan-Jun) and 12 (Jul-Dec)
 *                  task in month 07 for 01-06, month 01 for 07-12
 *   quarterly   → report months 3, 6, 9, 12
 *   yearly      → single task per year (e.g., annual report — May 31)
 */
function generateTasksForMonths(categoryKey, client, selectedMonths, year, deadlineOverrides = {}, systemDueDates = null) {
  const frequency = getClientFrequency(categoryKey, client);
  if (frequency === 'not_applicable') return [];

  const tasks = [];
  const catLabel = REPORT_CATEGORIES[categoryKey].label;

  // Yearly: single task — triggered when any month is selected (but only once)
  if (frequency === 'yearly') {
    // Use client's custom balance sheet target date if available
    const clientTargetDate = client?.reporting_info?.balance_sheet_target_date;
    const dueDate = clientTargetDate || getDueDateForCategory(categoryKey, client, 5) || `${year}-05-31`;
    tasks.push({
      date: new Date(dueDate),
      period: `שנת ${year}`,
      description: `${catLabel} עבור שנת ${year - 1}`,
      reportMonth: 5,
    });
    return tasks;
  }

  // Semi-annual: only for ניכויים (מ"ה). Two periods per year.
  // Task appears only when the END month of the period is selected (6 for H1, 12 for H2)
  if (frequency === 'semi_annual') {
    const SEMI_ANNUAL_PERIODS = [
      { reportMonth: 6, period: 'ינואר-יוני', dueMonth: 7, description: `${catLabel} עבור ינואר-יוני ${year}` },
      { reportMonth: 12, period: 'יולי-דצמבר', dueMonth: 1, dueYear: year + 1, description: `${catLabel} עבור יולי-דצמבר ${year}` },
    ];
    for (const sp of SEMI_ANNUAL_PERIODS) {
      // Only show when the last month of the period is selected
      if (!selectedMonths.includes(sp.reportMonth)) continue;

      const dueDateStr = getDueDateForCategory(categoryKey, client, sp.reportMonth);
      const dy = sp.dueYear || year;
      const dueDate = dueDateStr ? new Date(dueDateStr) : new Date(dy, (sp.dueMonth || 7) - 1, 19);
      tasks.push({ date: dueDate, period: sp.period, description: sp.description, reportMonth: sp.reportMonth });
    }
    return tasks;
  }

  for (const reportMonth of selectedMonths) {
    // Bimonthly: only even report months
    if (frequency === 'bimonthly') {
      if (reportMonth % 2 !== 0) continue;
    }
    // Quarterly: only 3, 6, 9, 12
    if (frequency === 'quarterly') {
      if (![3, 6, 9, 12].includes(reportMonth)) continue;
    }

    // Per-month per-category override: deadlineOverrides[month][category]
    const overrideDay = deadlineOverrides[reportMonth]?.[categoryKey];

    // Priority: 1) manual deadline override, 2) system due dates from DB, 3) tax calendar
    const dueMonth = reportMonth === 12 ? 1 : reportMonth + 1;
    const dueYear = reportMonth === 12 ? year + 1 : year;
    const pad = n => String(n).padStart(2, '0');

    let dueDate;
    if (overrideDay) {
      // Manual override from injection panel
      dueDate = new Date(`${dueYear}-${pad(dueMonth)}-${pad(overrideDay)}`);
    } else if (systemDueDates) {
      // System-level due dates from AutomationRules settings (Supabase)
      const sysDay = getDueDayForCategory(systemDueDates, categoryKey);
      if (sysDay) {
        dueDate = new Date(`${dueYear}-${pad(dueMonth)}-${pad(sysDay)}`);
      }
    }
    if (!dueDate) {
      // Fallback: tax calendar with rest-day adjustments
      const dueDateStr = getDueDateForCategory(categoryKey, client, reportMonth);
      dueDate = dueDateStr ? new Date(dueDateStr) : new Date(year, reportMonth, 19);
    }

    let period;
    if (frequency === 'bimonthly') {
      period = BIMONTHLY_PERIOD_NAMES[reportMonth] || HEBREW_MONTH_NAMES[reportMonth - 1];
    } else if (frequency === 'quarterly') {
      period = QUARTERLY_PERIOD_NAMES[reportMonth] || HEBREW_MONTH_NAMES[reportMonth - 1];
    } else {
      period = `${HEBREW_MONTH_NAMES[reportMonth - 1]} ${year}`;
    }

    let description;
    if (frequency === 'bimonthly') {
      description = `${catLabel} עבור ${period} ${year}`;
    } else if (frequency === 'quarterly') {
      description = `${catLabel} עבור ${period} ${year}`;
    } else {
      description = `${catLabel} עבור חודש ${HEBREW_MONTH_NAMES[reportMonth - 1]} ${year}`;
    }

    // מס"ב ספקים: check client's cycle count from process tree
    // מס"ב ספקים: check client's cycle count (default: 2 cycles per tree definition)
    const masavCycles = categoryKey === 'מס"ב ספקים'
      ? parseInt(client?.process_tree?.P2_masav_suppliers?.masav_cycles || '2')
      : 0;

    if (masavCycles >= 2) {
      // 2 cycles: 15th and 30th of reporting month (not due month)
      const cycleDays = [15, 30];
      cycleDays.forEach((cycleDay, idx) => {
        const cycleLabel = idx === 0 ? 'סייקל 15' : 'סייקל 30';
        const cycleDueDate = new Date(year, reportMonth - 1, cycleDay);
        tasks.push({
          date: cycleDueDate,
          period,
          description: `${catLabel} (${cycleLabel}) עבור חודש ${HEBREW_MONTH_NAMES[reportMonth - 1]} ${year}`,
          reportMonth,
          _cycleIndex: idx + 1,
        });
      });
    } else {
      tasks.push({ date: dueDate, period, description, reportMonth });
    }
  }

  return tasks;
}

// ============================================================
// Main Component — ADHD-Friendly Design
// ============================================================
export default function ClientRecurringTasks({ onGenerateComplete }) {
  const design = useDesign();
  const [clients, setClients] = useState([]);
  const [existingTasks, setExistingTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewTasks, setPreviewTasks] = useState([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState(new Set());
  const [results, setResults] = useState(null);
  const [collapsedCategories, setCollapsedCategories] = useState(new Set());

  // Month selection state — default to PREVIOUS month (work is retroactive)
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const prevMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;
  const [selectedYear, setSelectedYear] = useState(prevMonthYear);
  const [selectedMonths, setSelectedMonths] = useState(new Set([prevMonth]));
  const [forceInject, setForceInject] = useState(false);
  const [expandedCard, setExpandedCard] = useState(null); // catKey of expanded card
  const [isClearingCache, setIsClearingCache] = useState(false);
  // deadlineOverrides: { [month]: { [categoryKey]: day } } — per-month per-category
  // PERSISTED in localStorage + DB (SystemConfig) for cross-device sync
  const [deadlineOverrides, setDeadlineOverrides] = useState(() => {
    try {
      const saved = localStorage.getItem(`calmplan_deadline_overrides_${selectedYear}`);
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [deadlineOverridesConfigId, setDeadlineOverridesConfigId] = useState(null);
  const [deadlineOverridesSaved, setDeadlineOverridesSaved] = useState(true);

  // Load deadline overrides from DB on mount
  React.useEffect(() => {
    (async () => {
      try {
        const configs = await SystemConfig.filter({ config_key: `deadline_overrides_${selectedYear}` }).catch(() => []);
        if (configs.length > 0) {
          const dbData = configs[0].config_value;
          if (dbData && typeof dbData === 'object' && Object.keys(dbData).length > 0) {
            setDeadlineOverrides(dbData);
            try { localStorage.setItem(`calmplan_deadline_overrides_${selectedYear}`, JSON.stringify(dbData)); } catch {}
          }
          setDeadlineOverridesConfigId(configs[0].id);
        }
      } catch { /* ignore */ }
    })();
  }, [selectedYear]);

  // Auto-save to localStorage on change, mark as unsaved for DB
  React.useEffect(() => {
    try { localStorage.setItem(`calmplan_deadline_overrides_${selectedYear}`, JSON.stringify(deadlineOverrides)); } catch {}
    setDeadlineOverridesSaved(false);
  }, [deadlineOverrides, selectedYear]);

  // Save deadline overrides to DB
  const saveDeadlineOverridesToDB = async () => {
    try {
      if (deadlineOverridesConfigId) {
        await SystemConfig.update(deadlineOverridesConfigId, { config_value: deadlineOverrides });
      } else {
        const created = await SystemConfig.create({
          config_key: `deadline_overrides_${selectedYear}`,
          config_value: deadlineOverrides,
        });
        setDeadlineOverridesConfigId(created?.id || null);
      }
      setDeadlineOverridesSaved(true);
    } catch (err) {
      console.error('שגיאה בשמירת דדליינים:', err);
    }
  };
  const [systemDueDates, setSystemDueDates] = useState(null);
  const [systemDueDatesConfigId, setSystemDueDatesConfigId] = useState(null);
  const [systemExecutionPeriods, setSystemExecutionPeriods] = useState(null);

  useEffect(() => { loadData(); }, []);

  // Re-load when process tree structure changes (node move/add/delete)
  useEffect(() => {
    const unsub = onTreeChange(() => {
      console.log('[RecurringTasks] 📡 Tree changed — reloading data...');
      loadData();
    });
    return unsub;
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [clientsData, tasksData, dueDatesResult, periodsResult] = await Promise.all([
        Client.list(null, 500).catch(() => []),
        Task.list(null, 5000).catch(() => []),
        loadServiceDueDates().catch(() => ({ dueDates: null })),
        loadExecutionPeriods().catch(() => ({ periods: null })),
      ]);
      const activeClients = (clientsData || []).filter(c => c.status === 'active');
      console.log('[RecurringTasks] Data loaded:', {
        totalClients: (clientsData || []).length,
        activeClients: activeClients.length,
        existingTasks: (tasksData || []).length,
        hasSystemDueDates: !!dueDatesResult.dueDates,
        hasSystemPeriods: !!periodsResult.periods,
      });
      setClients(activeClients);
      setExistingTasks(tasksData || []);
      if (dueDatesResult.dueDates) {
        setSystemDueDates(dueDatesResult.dueDates);
        if (dueDatesResult.configId) setSystemDueDatesConfigId(dueDatesResult.configId);
      }
      if (periodsResult.periods) setSystemExecutionPeriods(periodsResult.periods);
    } catch (error) {
      console.error('Error loading data:', error);
    }
    setIsLoading(false);
  };

  const toggleMonth = (month) => {
    setSelectedMonths(prev => {
      const next = new Set(prev);
      if (next.has(month)) {
        next.delete(month);
      } else {
        next.add(month);
      }
      return next;
    });
  };

  const selectAllMonths = () => {
    setSelectedMonths(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]));
  };

  const selectCurrentMonth = () => {
    setSelectedMonths(new Set([prevMonth]));
    setSelectedYear(prevMonthYear);
  };

  // Clear existing recurring tasks for the selected months so re-injection works
  const clearMonthCache = async () => {
    const monthsArray = Array.from(selectedMonths).sort((a, b) => a - b);
    if (monthsArray.length === 0) return;
    setIsClearingCache(true);
    try {
      let deleted = 0;
      // Compute the due months for selected reporting months (report month + 1)
      const dueMonths = new Set();
      for (const rm of monthsArray) {
        dueMonths.add(rm); // the selected month itself
        const dueMonth = rm === 12 ? 1 : rm + 1;
        dueMonths.add(dueMonth); // the month AFTER (where due_dates fall)
      }
      for (const task of existingTasks) {
        if (task.source !== 'recurring_tasks' && !task.is_recurring && !task.workflow_phase) continue;
        if (!task.due_date) continue;
        const taskDate = new Date(task.due_date + 'T12:00:00');
        const taskMonth = taskDate.getMonth() + 1;
        const taskYear = taskDate.getFullYear();
        // Match tasks in the selected months OR their due months (month+1)
        if (taskYear === selectedYear && dueMonths.has(taskMonth)) {
          try {
            await Task.delete(task.id);
            deleted++;
          } catch (e) {
            console.error('Error deleting task:', task.id, e);
          }
        }
      }
      setResults({ cleared: deleted, message: `נמחקו ${deleted} משימות חוזרות (כולל רפאים בחודש העוקב)` });
      await loadData();
    } catch (error) {
      console.error('Error clearing month cache:', error);
    }
    setIsClearingCache(false);
  };

  // Find ghost tasks: tasks for reporting periods that haven't been injected
  // In April, current reporting period = March ("2026-03"). Anything with reporting_month >= "2026-04" OR due_date >= May = ghost
  const ghostTasks = useMemo(() => {
    if (!existingTasks) return [];
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const currentMonth = now.getMonth() + 1;
    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevMonthYear = currentMonth === 1 ? now.getFullYear() - 1 : now.getFullYear();
    const currentReportingMonth = `${prevMonthYear}-${pad(prevMonth)}`;
    const nextMonthStart = `${now.getFullYear()}-${pad(now.getMonth() + 2)}-01`;
    // Ghost = reporting_month AFTER current period. NEVER check due_date.
    const ghosts = existingTasks.filter(t => {
      if (!t.reporting_month) return false;
      const parts = t.reporting_month.split('-');
      const rmYear = parseInt(parts[0], 10);
      const rmMonth = parseInt(parts[1], 10);
      return rmYear > prevMonthYear || (rmYear === prevMonthYear && rmMonth > prevMonth);
    });
    // Group by category for display
    const byCategory = {};
    for (const t of ghosts) {
      const cat = t.category || 'אחר';
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    }
    ghosts._byCategory = byCategory;
    return ghosts;
  }, [existingTasks]);

  const [showGhostPreview, setShowGhostPreview] = useState(false);
  const [ghostDeleteCount, setGhostDeleteCount] = useState(0);

  const clearGhostTasks = async () => {
    if (ghostTasks.length === 0) return;
    setIsClearingCache(true);
    try {
      let deleted = 0;
      for (const task of ghostTasks) {
        try {
          await Task.delete(task.id);
          deleted++;
        } catch (e) {
          console.error('Error deleting ghost task:', task.id, e);
        }
      }
      setGhostDeleteCount(deleted);
      setResults({ cleared: deleted, message: `נמחקו ${deleted} משימות רפאים` });
      await loadData();
    } catch (error) {
      console.error('Error clearing ghost tasks:', error);
    }
    setIsClearingCache(false);
  };

  // ── Task dependency chain: child → parent (must finish parent before child) ──
  // P1 → P2: P&L report depends on payroll completion
  // P2 → P3: Reconciliation depends on VAT/bookkeeping
  // P2 → P5: Annual report depends on all monthly bookkeeping
  const TASK_DEPENDENCIES = {
    'דוח רו"ה': 'שכר',          // P&L depends on payroll data being ready
    'התאמות חשבונות': 'מע"מ',    // Reconciliation depends on VAT filing
    'דוח שנתי': 'דוח רו"ה',     // Annual report depends on monthly P&L
  };

  const generateTasksPreview = (overrideMonths, branchFilter = null) => {
    const monthsArray = overrideMonths instanceof Set
      ? Array.from(overrideMonths).sort((a, b) => a - b)
      : Array.from(selectedMonths).sort((a, b) => a - b);
    if (monthsArray.length === 0) return;

    // ── Coverage tracking per category ──
    const coverage = {};
    for (const catKey of Object.keys(REPORT_CATEGORIES)) {
      coverage[catKey] = { eligible: 0, generated: 0, skippedFreq: 0, skippedDup: 0, freqMismatch: 0, clients: [], freqMismatchClients: [] };
    }

    const tasksToCreate = [];
    const taskIndex = {};

    for (const client of clients) {
      const expandedServices = getExpandedServices(client);

      for (const [categoryKey, categoryDef] of Object.entries(REPORT_CATEGORIES)) {
        // ── BRANCH FILTER: skip categories not in the selected branch ──
        if (branchFilter && categoryDef.branch !== branchFilter) continue;
        // ── SERVICE FILTER: strict check against client's actual services ──
        if (!expandedServices.has(categoryDef.serviceTypeKey)) continue;

        // ── 874 FILTER: split מע"מ תקופתי vs מע"מ 874 ──
        const clientIs874 = isClient874(client);
        if (categoryDef.exclude874 && clientIs874) continue;
        if (categoryDef.only874 && !clientIs874) continue;

        const freq = getClientFrequency(categoryKey, client);
        if (freq === 'not_applicable') {
          coverage[categoryKey].skippedFreq++;
          continue;
        }
        coverage[categoryKey].eligible++;

        const dueDates = generateTasksForMonths(categoryKey, client, monthsArray, selectedYear, deadlineOverrides, systemDueDates);
        // Track frequency mismatch: client is eligible but no tasks generated for selected months
        if (dueDates.length === 0 && monthsArray.length > 0) {
          coverage[categoryKey].freqMismatch++;
          coverage[categoryKey].freqMismatchClients.push(`${client.name} (${freq})`);
        }
        for (const { date, period, description, reportMonth } of dueDates) {
          const taskTitle = `${client.name} - ${description}`;
          const dueDateStr = format(date, 'yyyy-MM-dd');

          // Duplicate check (skip in force-inject mode)
          const alreadyExists = !forceInject && existingTasks.some(t =>
            t.title === taskTitle ||
            (t.client_name === client.name && t.category === categoryKey && t.due_date === dueDateStr)
          );
          if (alreadyExists) {
            coverage[categoryKey].skippedDup++;
            continue;
          }

          const taskId = `${client.id}_${categoryKey}_${dueDateStr}`;
          const scheduledStart = getScheduledStartForCategory(categoryKey, dueDateStr, systemExecutionPeriods);
          const branchKey = categoryDef.branch;
          if (!branchKey || !P_BRANCHES[branchKey]) continue;

          // ── depends_on: link to parent task if exists ──
          const parentCategory = TASK_DEPENDENCIES[categoryKey];
          const parentTaskId = parentCategory ? `${client.id}_${parentCategory}_${dueDateStr}` : null;

          // ── Cognitive load: service weight × client complexity tier ──
          const sw = getServiceWeight(categoryKey);
          const clientTier = computeComplexityTier(client);
          const tierInfo = COMPLEXITY_TIERS[clientTier] || COMPLEXITY_TIERS[0];
          // Scale duration: use tier's maxMinutes if greater than service default
          const scaledDuration = Math.max(sw.duration, tierInfo.maxMinutes || sw.duration);
          // Cognitive load: max of service base and client tier
          const scaledCognitiveLoad = Math.max(sw.cognitiveLoad, clientTier);

          const task = {
            _previewId: taskId, title: taskTitle,
            description: `${description}\nלקוח: ${client.name}${clientIs874 ? '\nסוג: מע"מ מפורט (874)' : ''}`,
            due_date: dueDateStr, scheduled_start: scheduledStart || undefined,
            client_name: client.name, client_id: client.id,
            category: categoryKey, branch: branchKey,
            context: 'work', priority: 'high', status: 'not_started',
            is_recurring: true, source: 'recurring_tasks',
            estimated_duration: scaledDuration,
            cognitive_load: scaledCognitiveLoad,
            complexity_tier: clientTier,
            _categoryOrder: categoryDef.order, _categoryLabel: categoryDef.label,
            _categoryColor: categoryDef.color, _categoryAccent: categoryDef.accent,
            _categoryBgSoft: categoryDef.bgSoft, _categoryDot: categoryDef.dot,
            _categoryEmoji: categoryDef.emoji, _categoryCardColor: categoryDef.cardColor,
            _branchKey: branchKey, _branchLabel: P_BRANCHES[branchKey].label,
            _frequency: freq, _is874: clientIs874, period,
            _reportMonth: reportMonth,
          };
          if (parentTaskId) task.depends_on = parentTaskId;
          tasksToCreate.push(task);
          taskIndex[taskId] = task;
          coverage[categoryKey].generated++;
          coverage[categoryKey].clients.push(client.name);
        }
      }
    }

    // ── Coverage report ──
    console.group('[RecurringTasks] 📊 Coverage Report — Months:', monthsArray.join(','));
    for (const [catKey, stats] of Object.entries(coverage)) {
      const branch = REPORT_CATEGORIES[catKey]?.branch || '?';
      console.log(
        `${branch} - ${catKey}: ${stats.generated} tasks | ${stats.eligible}/${clients.length} eligible | ${stats.skippedFreq} freq-N/A | ${stats.skippedDup} dup | ${stats.freqMismatch} freq-mismatch`
      );
      if (stats.freqMismatchClients.length > 0) {
        console.log(`  ⚠ Frequency Mismatch (${catKey}):`, stats.freqMismatchClients.join(', '));
      }
    }
    // Cross-reference: find clients that have services but got 0 tasks
    const clientsWithNoTasks = clients.filter(c => {
      const services = getExpandedServices(c);
      return services.size > 0 && !tasksToCreate.some(t => t.client_id === c.id);
    });
    if (clientsWithNoTasks.length > 0) {
      console.warn('[RecurringTasks] ⚠ Clients with services but 0 tasks:', clientsWithNoTasks.map(c => ({
        name: c.name, services: Array.from(getExpandedServices(c)), reporting_info: c.reporting_info,
      })));
    }
    console.log(`[RecurringTasks] Total: ${tasksToCreate.length} tasks for ${new Set(tasksToCreate.map(t => t.client_id)).size} clients`);
    console.groupEnd();

    tasksToCreate.sort((a, b) => {
      if (a._categoryOrder !== b._categoryOrder) return a._categoryOrder - b._categoryOrder;
      const nameCompare = a.client_name.localeCompare(b.client_name, 'he');
      if (nameCompare !== 0) return nameCompare;
      return new Date(a.due_date) - new Date(b.due_date);
    });
    setPreviewTasks(tasksToCreate);
    setSelectedTaskIds(new Set(tasksToCreate.map(t => t._previewId)));
    setShowPreview(true);
    setCollapsedCategories(new Set());
  };

  const toggleTask = (taskId) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId); else next.add(taskId);
      return next;
    });
  };

  const toggleCategoryAll = (categoryKey, tasks) => {
    const catIds = tasks.map(t => t._previewId);
    const allSelected = catIds.every(id => selectedTaskIds.has(id));
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      catIds.forEach(id => { if (allSelected) next.delete(id); else next.add(id); });
      return next;
    });
  };

  const toggleCollapseCategory = (categoryKey) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryKey)) next.delete(categoryKey); else next.add(categoryKey);
      return next;
    });
  };

  const selectAll = () => setSelectedTaskIds(new Set(previewTasks.map(t => t._previewId)));
  const selectNone = () => setSelectedTaskIds(new Set());

  const removeFromPreview = (taskId) => {
    setPreviewTasks(prev => prev.filter(t => t._previewId !== taskId));
    setSelectedTaskIds(prev => { const next = new Set(prev); next.delete(taskId); return next; });
  };

  // Group tasks by P-branch → then by category within each branch
  const groupedByBranch = useMemo(() => {
    const branches = {};
    for (const task of previewTasks) {
      const bKey = task._branchKey || task.branch || 'P2';
      if (!branches[bKey]) {
        const branchDef = P_BRANCHES[bKey] || P_BRANCHES.P2;
        branches[bKey] = {
          branchKey: bKey,
          label: branchDef.label,
          color: branchDef.color,
          accent: branchDef.accent,
          bgSoft: branchDef.bgSoft,
          dot: branchDef.dot,
          order: branchDef.order,
          categories: {},
        };
      }
      const catKey = task.category;
      if (!branches[bKey].categories[catKey]) {
        branches[bKey].categories[catKey] = {
          categoryKey: catKey, label: task._categoryLabel, color: task._categoryColor,
          accent: task._categoryAccent, bgSoft: task._categoryBgSoft, dot: task._categoryDot,
          emoji: task._categoryEmoji, cardColor: task._categoryCardColor,
          order: task._categoryOrder, tasks: [],
        };
      }
      branches[bKey].categories[catKey].tasks.push(task);
    }
    // Sort branches by order, categories within each branch by order
    return Object.values(branches)
      .sort((a, b) => a.order - b.order)
      .map(branch => ({
        ...branch,
        categories: Object.values(branch.categories).sort((a, b) => a.order - b.order),
      }));
  }, [previewTasks]);

  const selectedCount = previewTasks.filter(t => selectedTaskIds.has(t._previewId)).length;

  const createTasks = async () => {
    setIsGenerating(true);
    let created = 0, errors = 0;
    const tasksToCreate = previewTasks.filter(t => selectedTaskIds.has(t._previewId));
    for (const taskData of tasksToCreate) {
      try {
        const {
          _previewId, _categoryOrder, _categoryLabel, _categoryColor,
          _categoryAccent, _categoryBgSoft, _categoryDot, _categoryEmoji, _categoryCardColor,
          _frequency, _is874, _reportMonth, _branchKey, _branchLabel, period, ...taskFields
        } = taskData;
        // Set reporting_month in YYYY-MM format for dashboard filtering
        if (_reportMonth) {
          const rmYear = taskData.due_date ? parseInt(taskData.due_date.substring(0, 4)) : new Date().getFullYear();
          // If reportMonth is December but due_date is in January of next year, use previous year
          const adjustedYear = (_reportMonth === 12 && taskFields.due_date?.substring(5, 7) === '01') ? rmYear - 1 : rmYear;
          taskFields.reporting_month = `${adjustedYear}-${String(_reportMonth).padStart(2, '0')}`;
        }
        await Task.create(taskFields);
        created++;
      } catch (error) { console.error('Error creating task:', error); errors++; }
    }
    setResults({ created, errors, total: tasksToCreate.length });
    setIsGenerating(false);
    setShowPreview(false);
    // NOTE: deadline overrides are persisted in localStorage — NOT reset after injection
    // User can manually reset via "איפוס הכל" button if needed
    await loadData();
    if (onGenerateComplete) onGenerateComplete();
  };

  // ── CSV Export: download all preview tasks as spreadsheet ──
  const exportPreviewToCSV = () => {
    const FREQ_LABELS = { monthly: 'חודשי', bimonthly: 'דו-חודשי', quarterly: 'רבעוני', semi_annual: 'חצי שנתי', yearly: 'שנתי' };
    const header = 'שם לקוח,סוג שירות,ענף (P),תדר דיווח,תאריך יעד,תלוי ב (Depends On),תקופה';
    const rows = previewTasks
      .filter(t => selectedTaskIds.has(t._previewId))
      .map(t => {
        const dependsOn = t.depends_on ? previewTasks.find(p => p._previewId === t.depends_on)?.category || '' : '';
        return [
          t.client_name,
          t._categoryLabel || t.category,
          t._branchKey || t.branch,
          FREQ_LABELS[t._frequency] || t._frequency,
          t.due_date,
          dependsOn,
          t.period || '',
        ].map(v => `"${(v || '').replace(/"/g, '""')}"`).join(',');
      });
    const bom = '\uFEFF'; // UTF-8 BOM for Excel Hebrew support
    const csv = bom + header + '\n' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `preview_tasks_${selectedYear}_${Array.from(selectedMonths).join('-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Summary grouped by P-branch
  const branchSummary = useMemo(() => {
    const result = [];
    for (const [branchKey, branchDef] of Object.entries(P_BRANCHES)) {
      const branchCategories = [];
      const uniqueBranchClients = new Set();
      let totalServices = 0;
      for (const catKey of branchDef.categories) {
        const categoryDef = REPORT_CATEGORIES[catKey];
        if (!categoryDef) continue;
        let clientCount = 0;
        const frequencies = {};
        const matchedClients = [];
        for (const client of clients) {
          if (!clientHasService(catKey, client)) continue;
          const freq = getClientFrequency(catKey, client);
          if (freq === 'not_applicable') continue;
          clientCount++;
          uniqueBranchClients.add(client.id);
          frequencies[freq] = (frequencies[freq] || 0) + 1;
          matchedClients.push({ id: client.id, name: client.name, frequency: freq });
        }
        if (clientCount > 0) {
          branchCategories.push({ key: catKey, label: categoryDef.label, icon: categoryDef.icon, dot: categoryDef.dot, emoji: categoryDef.emoji, cardColor: categoryDef.cardColor, clientCount, frequencies, matchedClients });
          totalServices += clientCount;
        }
      }
      if (uniqueBranchClients.size > 0) {
        result.push({ ...branchDef, key: branchKey, totalClients: uniqueBranchClients.size, totalServices, branchCategories });
      }
    }
    return result;
  }, [clients]);

  // Detect clients with BOTH P1_operator AND P1_taml enabled (should be mutually exclusive)
  const duplicateClients = useMemo(() => {
    return clients.filter(c => {
      const tree = c.process_tree || {};
      return tree.P1_operator?.enabled && tree.P1_taml?.enabled;
    });
  }, [clients]);

  if (isLoading) {
    return (
      <Card className="border">
        <CardContent className="p-12 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-100 flex items-center justify-center mb-4">
            <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
          </div>
          <p className="text-lg text-gray-500">טוען נתונים...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main Card — Clean & Calm */}
      <Card className="border overflow-hidden">
        <CardHeader className="bg-emerald-50 pb-6">
          <CardTitle className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white rounded-2xl border border-emerald-200 flex items-center justify-center">
              <Sparkles className="w-7 h-7 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-800">משימות חוזרות</h3>
              <p className="text-base text-emerald-600 font-normal mt-1">
                {clients.length} לקוחות פעילים
              </p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Duplicate alert — clients with both מתפעל AND טמל enabled */}
          {duplicateClients.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-bold text-red-700">
                  כפילות: {duplicateClients.length} לקוחות עם גם מתפעל וגם טמל פעילים
                </p>
                <p className="text-xs text-red-600 mt-1">
                  פנסיות וקרנות — יש לבחור נתיב אחד בלבד (מתפעל או טמל). כנסי לכרטיס לקוח ובטלי את הנתיב שלא רלוונטי.
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {duplicateClients.map(c => (
                    <span key={c.id} className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                      {c.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Branch summary — grouped under P1/P2 headers, collapsible */}
          <div className="space-y-3">
            {branchSummary.map((branch) => {
              const isBranchCollapsed = collapsedCategories.has(`branch_${branch.key}`);
              return (
              <motion.div
                key={branch.key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-2xl border-2 ${branch.accent} overflow-hidden`}
              >
                {/* Branch header — clickable to collapse */}
                <div
                  className={`px-4 py-2.5 ${branch.bgSoft} flex items-center gap-3 cursor-pointer select-none`}
                  onClick={() => toggleCollapseCategory(`branch_${branch.key}`)}
                >
                  <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: design.getBranchColor(branch.key) }} />
                  <span className="text-base font-black text-gray-800">{branch.label}</span>
                  <span className="text-sm font-bold text-gray-500 mr-auto">{branch.totalClients} לקוחות · {branch.totalServices} שירותים</span>
                  {isBranchCollapsed ?
                    <ChevronRight className="w-4 h-4 text-gray-400" /> :
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  }
                </div>
                {/* Category cards within branch — compact grid */}
                <AnimatePresence>
                {!isBranchCollapsed && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 p-2.5">
                  {branch.branchCategories.map((cat, catIdx) => {
                    const Icon = cat.icon;
                    const isExpanded = expandedCard === cat.key;
                    const branchColor = design.getBranchColor(branch.key);
                    return (
                      <motion.div
                        key={cat.key}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: catIdx * 0.03 }}
                        className={`rounded-lg transition-all cursor-pointer border ${
                          isExpanded ? 'col-span-2 md:col-span-3 lg:col-span-4' : 'hover:shadow-sm'
                        }`}
                        style={{
                          background: `${(cat.cardColor || branchColor)}08`,
                          borderColor: isExpanded ? (cat.cardColor || branchColor) : `${cat.cardColor || branchColor}25`,
                        }}
                        onClick={() => setExpandedCard(isExpanded ? null : cat.key)}
                      >
                        <div className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{cat.emoji || '📄'}</span>
                            <span className="text-sm font-bold flex-1 truncate" style={{ color: cat.cardColor || branchColor }}>{cat.label}</span>
                            <span className="text-lg font-black" style={{ color: cat.cardColor || branchColor }}>{cat.clientCount}</span>
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} style={{ color: cat.cardColor || branchColor }} />
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {Object.entries(cat.frequencies).map(([freq, count]) => (
                              <span key={freq} className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                                style={{ backgroundColor: `${cat.cardColor || branchColor}12`, color: cat.cardColor || branchColor }}>
                                {FREQUENCY_LABELS[freq] || freq} ({count})
                              </span>
                            ))}
                          </div>
                        </div>
                        {/* ── Expanded Client List ── */}
                        {isExpanded && cat.matchedClients && (
                          <div className="border-t px-3 py-2 max-h-48 overflow-y-auto" style={{ borderColor: `${cat.cardColor || branchColor}20`, background: `${cat.cardColor || branchColor}06` }}>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1">
                              {cat.matchedClients
                                .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'he'))
                                .map((mc, idx) => (
                                <div key={mc.id || idx} className="flex items-center gap-1.5 px-2 py-1 rounded border text-xs"
                                  style={{ background: 'white', borderColor: `${cat.cardColor || branchColor}20` }}>
                                  <span className="font-medium text-gray-800 truncate flex-1">{mc.name}</span>
                                  <span className="text-[10px] font-bold flex-shrink-0" style={{ color: `${cat.cardColor || branchColor}80` }}>
                                    {FREQUENCY_LABELS[mc.frequency] || mc.frequency}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                  </div>
                  </motion.div>
                )}
                </AnimatePresence>
              </motion.div>
              );
            })}
          </div>

          {/* ============================================================ */}
          {/* Month picker — user chooses which report months to generate */}
          {/* ============================================================ */}
          <div className="bg-gray-50 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-base font-bold text-gray-700">בחרי חודשי דיווח:</p>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedYear(selectedYear - 1)}
                  className="rounded-xl font-bold text-gray-500 hover:text-gray-700"
                >
                  &lt;
                </Button>
                <span className="text-lg font-black text-emerald-600 min-w-[60px] text-center">{selectedYear}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedYear(selectedYear + 1)}
                  className="rounded-xl font-bold text-gray-500 hover:text-gray-700"
                >
                  &gt;
                </Button>
              </div>
            </div>

            {/* Month grid */}
            <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
              {HEBREW_MONTH_NAMES.map((name, idx) => {
                const month = idx + 1;
                const isSelected = selectedMonths.has(month);
                const isCurrent = month === currentMonth && selectedYear === currentYear;
                return (
                  <Button
                    key={month}
                    variant={isSelected ? 'default' : 'outline'}
                    onClick={() => toggleMonth(month)}
                    className={`rounded-xl h-11 text-sm font-bold transition-all border-2 ${
                      isSelected
                        ? 'border-emerald-500 text-emerald-700 bg-emerald-50'
                        : isCurrent
                          ? 'border-emerald-300 text-emerald-600 font-black'
                          : 'border-gray-200 text-gray-600 hover:border-emerald-300'
                    }`}
                  >
                    {name}
                  </Button>
                );
              })}
            </div>

            {/* Quick selection buttons */}
            <div className="flex gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={selectCurrentMonth}
                className="rounded-xl text-sm font-bold text-emerald-600 hover:bg-emerald-100"
              >
                חודש קודם
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={selectAllMonths}
                className="rounded-xl text-sm font-bold text-emerald-600 hover:bg-emerald-100"
              >
                כל השנה
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedMonths(new Set())}
                className="rounded-xl text-sm font-bold text-gray-400 hover:bg-gray-100"
              >
                נקה
              </Button>
            </div>
          </div>

          {/* ── Deadline Overrides — per month, for holidays/special situations ── */}
          {selectedMonths.size > 0 && (
          <div className="p-4 rounded-2xl border-2 border-blue-200 bg-blue-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-bold text-gray-800">דדליינים — דריסה לפי חודש</span>
                <span className="text-[12px] text-blue-500 font-medium">(חגים / דחייה)</span>
              </div>
              <div className="flex items-center gap-2">
              {Object.keys(deadlineOverrides).length > 0 && !deadlineOverridesSaved && (
                <Button variant="outline" size="sm" onClick={saveDeadlineOverridesToDB}
                  className="text-xs h-7 px-3 border-emerald-300 text-emerald-700 hover:bg-emerald-50 font-bold">
                  שמור דדליינים
                </Button>
              )}
              {deadlineOverridesSaved && Object.keys(deadlineOverrides).length > 0 && (
                <span className="text-xs text-emerald-500 font-medium">✓ נשמר</span>
              )}
              {Object.keys(deadlineOverrides).length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => { setDeadlineOverrides({}); setDeadlineOverridesSaved(false); }}
                  className="text-xs h-7 px-2 text-red-400 hover:text-red-600 hover:bg-red-50">
                  איפוס הכל
                </Button>
              )}
              </div>
            </div>
            <p className="text-[11px] text-blue-400">ברירות מחדל מהגדרות מערכת. שנה רק מה שצריך — נשמר אוטומטית + כפתור שמור ל-DB.</p>

            {(() => {
              const DEADLINE_CATS = [
                { cat: 'שכר', label: 'שכר', group: 'P1' },
                { cat: 'ביטוח לאומי', label: 'ב"ל', group: 'P1' },
                { cat: 'ניכויים', label: 'ניכויים', group: 'P1' },
                { cat: 'מתפעל', label: 'מתפעל', group: 'P1' },
                { cat: 'מע"מ', label: 'מע"מ', group: 'P2' },
                { cat: 'מע"מ 874', label: '874', group: 'P2' },
                { cat: 'מקדמות מס', label: 'מקדמות', group: 'P2' },
                { cat: 'קליטת הכנסות', label: 'הכנסות', group: 'P2' },
                { cat: 'קליטת הוצאות', label: 'הוצאות', group: 'P2' },
                { cat: 'דוח רו"ה', label: 'רו"ה', group: 'P2' },
                { cat: 'מס"ב ספקים', label: 'מס"ב ספק', group: 'P2' },
                { cat: 'התאמות חשבונות', label: 'התאמות', group: 'P2' },
              ];
              const dueDates = systemDueDates || DEFAULT_SERVICE_DUE_DATES;
              const sortedMonths = Array.from(selectedMonths).sort((a, b) => a - b);

              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="border-b border-blue-200">
                        <th className="text-right py-1.5 px-2 font-bold text-gray-700 sticky right-0 bg-blue-50 min-w-[80px]">חודש</th>
                        {DEADLINE_CATS.map(dl => (
                          <th key={dl.cat} className="text-center py-1.5 px-1 font-medium text-gray-500 min-w-[48px]">
                            <span className={dl.group === 'P1' ? 'text-teal-600' : 'text-blue-600'}>{dl.label}</span>
                          </th>
                        ))}
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedMonths.map(month => {
                        const monthOverrides = deadlineOverrides[month] || {};
                        const overrideCount = Object.keys(monthOverrides).length;
                        return (
                          <tr key={month} className="border-b border-blue-100 hover:bg-blue-50/50">
                            <td className="py-1.5 px-2 font-bold text-gray-700 sticky right-0 bg-blue-50/80">
                              {HEBREW_MONTH_NAMES[month - 1]}
                              {overrideCount > 0 && <span className="text-amber-500 mr-1">●</span>}
                            </td>
                            {DEADLINE_CATS.map(dl => {
                              const sysDay = getDueDayForCategory(dueDates, dl.cat) ?? 19;
                              const currentDay = monthOverrides[dl.cat] ?? sysDay;
                              const isOverridden = monthOverrides[dl.cat] !== undefined;
                              return (
                                <td key={dl.cat} className="text-center py-1 px-0.5">
                                  <input type="number" min="1" max="31" value={currentDay}
                                    onChange={(e) => {
                                      const v = parseInt(e.target.value);
                                      if (v >= 1 && v <= 31) {
                                        setDeadlineOverrides(prev => {
                                          const monthData = { ...(prev[month] || {}) };
                                          if (v === sysDay) { delete monthData[dl.cat]; }
                                          else { monthData[dl.cat] = v; }
                                          const next = { ...prev };
                                          if (Object.keys(monthData).length === 0) { delete next[month]; }
                                          else { next[month] = monthData; }
                                          return next;
                                        });
                                      }
                                    }}
                                    className={`w-10 h-6 text-center text-xs font-bold border rounded focus:outline-none transition-colors ${
                                      isOverridden
                                        ? 'border-amber-400 bg-amber-50 text-amber-700'
                                        : 'border-gray-200 text-gray-500 focus:border-blue-400'
                                    }`} />
                                </td>
                              );
                            })}
                            <td className="px-1">
                              {overrideCount > 0 && (
                                <button onClick={() => setDeadlineOverrides(prev => { const next = { ...prev }; delete next[month]; return next; })}
                                  className="text-gray-300 hover:text-red-400 text-[10px]">✕</button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
          )}

          {/* ── Force Inject Mode + Clear Cache ── */}
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-50 border-2 border-amber-200">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setForceInject(!forceInject)}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                    forceInject ? 'bg-amber-500' : 'bg-gray-300'
                  }`}
                >
                  <span className={`inline-block h-5 w-5 rounded-full bg-white shadow-md transition-transform ${
                    forceInject ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
                <div>
                  <span className="text-base font-bold text-gray-800">הזרקה בכוח</span>
                  <p className="text-sm text-gray-500">
                    {forceInject
                      ? 'מצב פעיל — עוקף בדיקת כפילויות, יוצר משימות גם אם כבר קיימות'
                      : 'כבוי — משימות שכבר קיימות ידולגו'
                    }
                  </p>
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={clearMonthCache}
              disabled={isClearingCache || selectedMonths.size === 0}
              className="rounded-xl border-2 border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 font-bold gap-1 whitespace-nowrap disabled:opacity-40"
            >
              {isClearingCache ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <XCircle className="w-4 h-4" />
              )}
              נקה מטמון {selectedMonths.size > 0 ? `(${selectedMonths.size} חודשים)` : ''}
            </Button>
            {ghostTasks.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowGhostPreview(true)}
                disabled={isClearingCache}
                className="rounded-xl border-2 border-amber-300 text-amber-700 hover:bg-amber-50 hover:border-amber-400 font-bold gap-1 whitespace-nowrap disabled:opacity-40"
              >
                <AlertTriangle className="w-4 h-4" />
                ניקוי רפאים ({ghostTasks.length})
              </Button>
            )}
          </div>

          {/* Per-branch injection buttons */}
          <div className="space-y-3">
            <p className="text-base font-bold text-gray-700">הזרקה לפי ענף:</p>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(P_BRANCHES)
                .sort(([, a], [, b]) => a.order - b.order)
                .map(([branchKey, branch]) => {
                  const branchCatCount = branch.categories.length;
                  const branchClientCount = branchSummary.find(b => b.key === branchKey)?.totalClients || 0;
                  return (
                    <Button
                      key={branchKey}
                      onClick={() => {
                        if (selectedMonths.size === 0) {
                          setSelectedMonths(new Set([prevMonth]));
                          generateTasksPreview(new Set([prevMonth]), branchKey);
                        } else {
                          generateTasksPreview(null, branchKey);
                        }
                      }}
                      className="h-14 text-base font-bold rounded-2xl transition-all hover:scale-[1.02] border-2"
                      style={
                        branchKey === 'P1' ? { background: 'white', color: '#0369A1', borderColor: '#0EA5E9' } :
                        branchKey === 'P2' ? { background: 'white', color: '#2C5F8A', borderColor: '#4682B4' } :
                        branchKey === 'P3' ? { background: 'white', color: '#92400E', borderColor: '#F59E0B' } :
                                             { background: 'white', color: '#166534', borderColor: '#2E7D32' }
                      }
                      size="lg"
                    >
                      <Zap className="w-5 h-5 ml-2" />
                      <div className="flex flex-col items-start leading-tight">
                        <span>{branch.label}</span>
                        <span className="text-xs opacity-80">{branchClientCount} לקוחות · {branchCatCount} קטגוריות</span>
                      </div>
                    </Button>
                  );
                })
              }
            </div>
          </div>

          {/* Generate ALL branches button */}
          <Button
            onClick={() => generateTasksPreview()}
            disabled={selectedMonths.size === 0}
            className="w-full h-14 text-lg font-bold rounded-2xl hover:scale-[1.01] transition-all disabled:opacity-40 border-2"
            style={{ background: 'white', color: '#047857', borderColor: '#10B981' }}
            size="lg"
          >
            <Eye className="w-6 h-6 ml-3" />
            {selectedMonths.size === 0
              ? 'בחרי לפחות חודש אחד'
              : `טען הכל — כל הענפים ל-${selectedMonths.size} ${selectedMonths.size === 1 ? 'חודש' : 'חודשים'}`
            }
          </Button>

          {/* Results */}
          {results && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`p-6 rounded-2xl border-2 ${results.cleared != null ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${results.cleared != null ? 'bg-amber-500' : 'bg-emerald-500'}`}>
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  {results.cleared != null ? (
                    <p className="text-lg font-bold text-amber-800">{results.message}</p>
                  ) : (
                    <>
                      <p className="text-lg font-bold text-emerald-800">
                        נוצרו {results.created} משימות
                      </p>
                      {results.errors > 0 && (
                        <p className="text-sm text-amber-600">{results.errors} שגיאות</p>
                      )}
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* Ghost Tasks Preview Dialog */}
      {/* ============================================================ */}
      <Dialog open={showGhostPreview} onOpenChange={setShowGhostPreview}>
        <DialogContent className="sm:max-w-[600px] max-h-[70vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-gray-800">סריקת רפאים — תצוגה מקדימה</DialogTitle>
            <DialogDescription className="text-sm text-gray-500">
              משימות עם תאריך יעד מהחודש הבא ואילך — לא הוזרקו ידנית
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-3 my-4">
            <div className="text-center p-3 rounded-xl bg-gray-50 border">
              <p className="text-2xl font-black text-gray-800">{ghostDeleteCount}</p>
              <p className="text-xs text-gray-500">נמחקו</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-red-50 border border-red-200">
              <p className="text-2xl font-black text-red-600">{ghostTasks.length}</p>
              <p className="text-xs text-red-500">רפאים שזוהו</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-gray-50 border">
              <p className="text-2xl font-black text-gray-800">{existingTasks?.length || 0}</p>
              <p className="text-xs text-gray-500">סה"כ משימות</p>
            </div>
          </div>

          {ghostTasks.length > 0 && (
            <>
              <p className="text-sm font-bold text-gray-700 mb-2">לפי קטגוריה:</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {Object.entries(ghostTasks._byCategory || {})
                  .sort(([,a], [,b]) => b - a)
                  .map(([cat, count]) => (
                  <span key={cat} className="px-3 py-1 rounded-full border border-amber-200 bg-amber-50 text-sm font-bold text-amber-700">
                    {cat} {count}
                  </span>
                ))}
              </div>

              <p className="text-sm font-bold text-gray-700 mb-2">רשימת משימות:</p>
              <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
                {ghostTasks.slice(0, 50).map((t, i) => (
                  <div key={t.id || i} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                    <span className="font-bold text-gray-700 truncate flex-1">{t.title || t.category}</span>
                    <span className="text-gray-400 flex-shrink-0">{t.due_date}</span>
                    <span className="text-amber-600 flex-shrink-0">{t.status}</span>
                  </div>
                ))}
                {ghostTasks.length > 50 && (
                  <div className="px-3 py-1.5 text-xs text-gray-400 text-center">...ועוד {ghostTasks.length - 50}</div>
                )}
              </div>

              <Button
                onClick={clearGhostTasks}
                disabled={isClearingCache}
                className="w-full mt-4 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl gap-2"
              >
                {isClearingCache ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                מחק {ghostTasks.length} רפאים
              </Button>
            </>
          )}

          {ghostTasks.length === 0 && ghostDeleteCount > 0 && (
            <div className="text-center py-4">
              <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <p className="text-base font-bold text-emerald-700">נוקה! נמחקו {ghostDeleteCount} משימות רפאים</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* Preview Dialog — ADHD-Friendly — Review & Approve */}
      {/* ============================================================ */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="sm:max-w-[900px] h-[90vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl">
          {/* Header — clean, with progress */}
          <div className="px-6 pt-6 pb-4 bg-emerald-50">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-gray-800">
                {previewTasks.length > 0
                  ? `${previewTasks.length} משימות חדשות להגהה`
                  : 'הכל מעודכן!'
                }
              </DialogTitle>
              <DialogDescription className="text-base text-gray-600 mt-1">
                {previewTasks.length > 0
                  ? (forceInject
                      ? 'מצב הזרקה בכוח — משימות ייווצרו גם אם קיימות כפילויות. עברי על הרשימה ואשרי.'
                      : 'עברי על הרשימה, בטלי מה שלא צריך, ואשרי יצירה.')
                  : 'כל המשימות לחודשים שנבחרו כבר קיימות.'
                }
              </DialogDescription>
            </DialogHeader>

            {/* Force inject indicator */}
            {forceInject && previewTasks.length > 0 && (
              <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-xl bg-amber-100 border border-amber-300">
                <Zap className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-bold text-amber-700">הזרקה בכוח — כפילויות לא נחסמות</span>
              </div>
            )}

            {/* Selected months summary */}
            {previewTasks.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {Array.from(selectedMonths).sort((a, b) => a - b).map(m => (
                  <span key={m} className="text-xs font-bold bg-emerald-100 text-emerald-600 px-2.5 py-1 rounded-full">
                    {HEBREW_MONTH_NAMES[m - 1]} {selectedYear}
                  </span>
                ))}
              </div>
            )}

            {/* Cognitive load summary */}
            {previewTasks.length > 0 && (() => {
              const selected = previewTasks.filter(t => selectedTaskIds.has(t._previewId));
              const totalMinutes = selected.reduce((sum, t) => sum + (t.estimated_duration || 15), 0);
              const totalHours = (totalMinutes / 60).toFixed(1);
              const monthCount = selectedMonths.size || 1;
              const avgDailyMinutes = Math.round(totalMinutes / (monthCount * 22)); // ~22 working days/month
              const limit = design?.cognitiveLoadLimit || 480;
              const overloaded = avgDailyMinutes > limit;
              const LOAD_LABELS = ['ננו', 'פשוט', 'בינוני', 'מורכב'];
              const loadMix = [0, 0, 0, 0];
              selected.forEach(t => { loadMix[t.cognitive_load ?? 0]++; });
              return (
                <div className={`flex items-center gap-3 mt-3 px-3 py-2 rounded-xl border ${overloaded ? 'bg-red-50 border-red-300' : 'bg-blue-50 border-blue-200'}`}>
                  <span className="text-xs font-bold text-gray-700">⏱ {totalHours} שעות</span>
                  <span className="text-[12px] text-gray-500">|</span>
                  <span className={`text-xs font-bold ${overloaded ? 'text-red-600' : 'text-blue-600'}`}>
                    ~{avgDailyMinutes} דק׳/יום
                  </span>
                  <span className="text-[12px] text-gray-500">|</span>
                  {loadMix.map((count, tier) => count > 0 && (
                    <span key={tier} className="text-[12px] font-bold text-gray-600">
                      {LOAD_LABELS[tier]}: {count}
                    </span>
                  ))}
                  {overloaded && <span className="text-xs font-bold text-red-600 mr-auto">⚠ חריגה מסף יומי</span>}
                </div>
              );
            })()}

            {/* Progress bar */}
            {previewTasks.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-gray-600">
                    {selectedCount} נבחרו
                  </span>
                  <span className="text-sm text-gray-400">
                    מתוך {previewTasks.length}
                  </span>
                </div>
                <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-emerald-600 rounded-full"
                    initial={{ width: '100%' }}
                    animate={{ width: `${(selectedCount / previewTasks.length) * 100}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>
            )}
          </div>

          {previewTasks.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-20 h-20 mx-auto bg-emerald-100 rounded-3xl flex items-center justify-center mb-4">
                  <CheckCircle className="w-10 h-10 text-emerald-600" />
                </div>
                <h3 className="text-xl font-bold text-emerald-700 mb-2">הכל מעודכן!</h3>
                <p className="text-gray-500 text-base">כל המשימות לחודשים שנבחרו כבר קיימות</p>
              </div>
            </div>
          ) : (
            <>
              {/* Quick actions — big, clear */}
              <div className="flex items-center gap-3 px-6 py-3 border-b bg-white">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectAll}
                  className="rounded-xl font-bold"
                >
                  בחר הכל
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectNone}
                  className="rounded-xl font-bold"
                >
                  נקה הכל
                </Button>
              </div>

              {/* Branch → Category groups — hierarchical, color-coded */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6 bg-[#F5F5F5]">
                {groupedByBranch.map((branch, branchIdx) => {
                  const allBranchTasks = branch.categories.flatMap(c => c.tasks);
                  const branchSelectedCount = allBranchTasks.filter(t => selectedTaskIds.has(t._previewId)).length;

                  return (
                    <div key={branch.branchKey} className="space-y-3">
                      {/* Branch header */}
                      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl ${branch.bgSoft} border-2 ${branch.accent}`}>
                        <div className="w-5 h-5 rounded-full" style={{ backgroundColor: design.getBranchColor(branch.branchKey) }} />
                        <span className="text-lg font-black text-gray-800 flex-1">{branch.label}</span>
                        <span className="text-base font-bold text-gray-500">
                          {branchSelectedCount}/{allBranchTasks.length}
                        </span>
                      </div>

                      {/* Categories within this branch */}
                      {branch.categories.map((group, groupIdx) => {
                        const isCollapsed = collapsedCategories.has(group.categoryKey);
                        const groupSelectedCount = group.tasks.filter(t => selectedTaskIds.has(t._previewId)).length;
                        const allGroupSelected = groupSelectedCount === group.tasks.length;

                        return (
                          <motion.div
                            key={group.categoryKey}
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: (branchIdx * 0.05) + (groupIdx * 0.03) }}
                            className={`rounded-xl overflow-hidden border-2 ${group.accent} bg-white mr-4`}
                          >
                            {/* Category header */}
                            <div
                              className={`flex items-center gap-3 p-4 cursor-pointer ${group.bgSoft} transition-colors`}
                              onClick={() => toggleCollapseCategory(group.categoryKey)}
                            >
                              <div
                                className="flex-shrink-0"
                                onClick={(e) => { e.stopPropagation(); toggleCategoryAll(group.categoryKey, group.tasks); }}
                              >
                                <Checkbox
                                  checked={allGroupSelected}
                                  className="w-6 h-6 rounded-lg border-2"
                                />
                              </div>

                              <span className="text-xl flex-shrink-0">{group.emoji || '📄'}</span>

                              <span className="text-lg font-black flex-1" style={{ color: group.cardColor || '#1E293B' }}>
                                {group.label}
                              </span>

                              <span className="text-base font-bold text-gray-500 mx-2">
                                {groupSelectedCount}/{group.tasks.length}
                              </span>

                              {isCollapsed ?
                                <ChevronRight className="w-5 h-5 text-gray-400" /> :
                                <ChevronDown className="w-5 h-5 text-gray-400" />
                              }
                            </div>

                            {/* Task items */}
                            <AnimatePresence>
                              {!isCollapsed && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden"
                                >
                                  <div className="p-3 space-y-2">
                                    {group.tasks.map((task, taskIdx) => {
                                      const isSelected = selectedTaskIds.has(task._previewId);
                                      return (
                                        <motion.div
                                          key={task._previewId}
                                          initial={{ opacity: 0, x: -10 }}
                                          animate={{ opacity: 1, x: 0 }}
                                          transition={{ delay: taskIdx * 0.02 }}
                                          className={`flex items-center gap-4 p-4 rounded-xl transition-all cursor-pointer ${
                                            isSelected
                                              ? 'bg-white border-2 border-gray-200'
                                              : 'bg-gray-50 border-2 border-transparent opacity-40'
                                          }`}
                                          onClick={() => toggleTask(task._previewId)}
                                        >
                                          <Checkbox
                                            checked={isSelected}
                                            className="w-6 h-6 rounded-lg border-2 flex-shrink-0"
                                            onClick={(e) => e.stopPropagation()}
                                            onCheckedChange={() => toggleTask(task._previewId)}
                                          />

                                          <span className="text-lg flex-shrink-0">{task._categoryEmoji || '📄'}</span>
                                          <div className="flex-1 min-w-0">
                                            <p className="text-base font-bold text-gray-800 truncate">
                                              {task.client_name}
                                            </p>
                                            <div className="flex items-center gap-3 mt-1">
                                              <span className="text-sm text-gray-500 font-medium">
                                                {task.period}
                                              </span>
                                              <span className="text-sm font-bold text-emerald-600 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                                                {format(new Date(task.due_date), 'dd/MM')}
                                              </span>
                                              {task._is874 && (
                                                <span className="text-xs font-bold text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">
                                                  874
                                                </span>
                                              )}
                                            </div>
                                          </div>

                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-gray-300 hover:text-amber-500 h-8 w-8 p-0 rounded-lg flex-shrink-0"
                                            onClick={(e) => { e.stopPropagation(); removeFromPreview(task._previewId); }}
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </Button>
                                        </motion.div>
                                      );
                                    })}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              {/* Bottom action bar — sticky, prominent */}
              <div className="px-6 py-4 border-t-2 bg-white">
                <div className="flex gap-3">
                  <Button
                    onClick={createTasks}
                    disabled={isGenerating || selectedCount === 0}
                    className="flex-1 h-14 text-lg font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40"
                  >
                    {isGenerating ? (
                      <>
                        <RefreshCw className="w-5 h-5 ml-2 animate-spin" />
                        יוצר...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5 ml-2" />
                        אשרי יצירת {selectedCount} משימות
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={exportPreviewToCSV}
                    disabled={isGenerating || selectedCount === 0}
                    className="h-14 px-6 text-base font-bold rounded-2xl border-2"
                  >
                    CSV
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowPreview(false)}
                    disabled={isGenerating}
                    className="h-14 px-8 text-base font-bold rounded-2xl border-2"
                  >
                    ביטול
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
