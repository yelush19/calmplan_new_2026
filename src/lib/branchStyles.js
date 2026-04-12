// ═══════════════════════════════════════════════════════════════
// Branch Styles — Single Source of Truth for P1-P6 Branch Colors
// ═══════════════════════════════════════════════════════════════
//
// Iron rule: NO hardcoded Tailwind branch colors (bg-purple-100, etc.).
// All branch coloring flows through this module so that DesignContext
// overrides (user-customized palette) propagate everywhere live.
//
// Runtime flow:
//   1. PILLAR_COLORS (theme-constants.js) = compile-time defaults
//   2. DesignContext loads user overrides and writes CSS vars:
//        --cp-p1, --cp-p2, --cp-p3, --cp-p4, --cp-p5, --cp-p6
//   3. Components consume via getBranchVar('P1') → 'var(--cp-p1)'
//      OR via getBranchStyle('P1') for the full bg/border/text set.
//
// The CSS-var path means Badges, cards and dashboards pick up the
// user's custom palette without any React re-render — the browser
// repaints automatically when the variable changes.
// ═══════════════════════════════════════════════════════════════

import { PILLAR_COLORS } from '@/lib/theme-constants';

// ─── Branch key normalization ───────────────────────────────────
// Accepts many labels users or configs pass in and returns a canonical P-key.
const BRANCH_KEY_ALIASES = {
  // canonical
  P1: 'P1', P2: 'P2', P3: 'P3', P4: 'P4', P5: 'P5', P6: 'P6',
  // Hebrew labels
  'שכר': 'P1',
  'חשבות שכר': 'P1',
  'הנה"ח': 'P2',
  'הנה״ח': 'P2',
  'הנהלת חשבונות': 'P2',
  'מע"מ': 'P2',
  'מע״מ': 'P2',
  'מקדמות': 'P2',
  'מקדמות מס': 'P2',
  'התאמות': 'P2',
  'ניהול': 'P3',
  'ניהול משרד': 'P3',
  'אדמיניסטרציה': 'P3',
  'בית': 'P4',
  'בית / אישי': 'P4',
  'אישי': 'P4',
  'דוחות שנתיים': 'P5',
  'מאזנים': 'P5',
  'פרוייקטים': 'P6',
};

// Task categories → branch key (matches BOARD_CATEGORIES mapping)
const CATEGORY_TO_BRANCH = {
  work_payroll: 'P1',
  work_deductions: 'P1',
  work_social_security: 'P1',
  work_vat_reporting: 'P2',
  work_tax_advances: 'P2',
  work_bookkeeping: 'P2',
  work_reconciliation: 'P2',
  work_additional: 'P2',
  work_extra: 'P2',
  work_other: 'P2',
  work_authorities: 'P2',
  work_client_management: 'P3',
  work_admin: 'P3',
  work_annual_reports: 'P5',
  work_balance_sheets: 'P5',
  work_capital_statement: 'P5',
  work_financial_reports: 'P5',
  personal: 'P4',
  home: 'P4',
  meals: 'P4',
  routines: 'P4',
};

/**
 * Normalize any branch identifier (P-key, Hebrew label, category) to a P-key.
 * Returns null if unresolvable — callers should fall back to neutral styling.
 */
export function normalizeBranchKey(input) {
  if (!input) return null;
  if (BRANCH_KEY_ALIASES[input]) return BRANCH_KEY_ALIASES[input];
  if (CATEGORY_TO_BRANCH[input]) return CATEGORY_TO_BRANCH[input];
  // Fuzzy: startsWith P1/P2/...
  const m = String(input).match(/^P([1-6])/);
  if (m) return `P${m[1]}`;
  return null;
}

/**
 * Return the CSS var expression for a branch — use inside style props.
 * Example:  <div style={{ backgroundColor: getBranchVar('P1') }} />
 * Falls back to the PILLAR_COLORS compile-time hex when the key is unknown.
 */
export function getBranchVar(branchKey) {
  const k = normalizeBranchKey(branchKey);
  if (!k) return PILLAR_COLORS.P2.color; // neutral blue fallback
  return `var(--cp-${k.toLowerCase()}, ${PILLAR_COLORS[k].color})`;
}

/**
 * Return the raw hex color for a branch (compile-time, no CSS var indirection).
 * Use when you need an actual string (e.g., SVG fill attribute that doesn't
 * animate with CSS vars, or for tints/gradients computed in JS).
 */
export function getBranchHex(branchKey) {
  const k = normalizeBranchKey(branchKey);
  if (!k) return PILLAR_COLORS.P2.color;
  return PILLAR_COLORS[k].color;
}

/**
 * Return the light tint hex for a branch (used for soft pastel backgrounds).
 */
export function getBranchLightHex(branchKey) {
  const k = normalizeBranchKey(branchKey);
  if (!k) return PILLAR_COLORS.P2.light;
  return PILLAR_COLORS[k].light;
}

/**
 * Return a full style object for a branch — drop into any inline style={...}.
 *
 * @param {string} branchKey - P1..P6 or an alias (category/label).
 * @param {object} opts
 * @param {'solid'|'soft'|'outline'} opts.variant - visual style
 * @returns {{backgroundColor, color, borderColor}}
 */
export function getBranchStyle(branchKey, { variant = 'solid' } = {}) {
  const k = normalizeBranchKey(branchKey);
  if (!k) {
    return { backgroundColor: '#FFFFFF', color: '#000000', borderColor: '#E0E0E0' };
  }
  const cssVar = `var(--cp-${k.toLowerCase()}, ${PILLAR_COLORS[k].color})`;
  const lightHex = PILLAR_COLORS[k].light;

  if (variant === 'soft') {
    // Soft pastel — good for Badge text + tasks list chips
    return {
      backgroundColor: lightHex,
      color: cssVar,
      borderColor: cssVar,
    };
  }
  if (variant === 'outline') {
    return {
      backgroundColor: '#FFFFFF',
      color: cssVar,
      borderColor: cssVar,
    };
  }
  // solid
  return {
    backgroundColor: cssVar,
    color: '#FFFFFF',
    borderColor: cssVar,
  };
}

/**
 * Label for a branch (Hebrew) — convenience wrapper.
 */
export function getBranchLabel(branchKey) {
  const k = normalizeBranchKey(branchKey);
  if (!k) return '';
  return PILLAR_COLORS[k].label || k;
}
