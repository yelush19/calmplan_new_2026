/**
 * ── March 2026 Initial Task Data ──
 *
 * Pre-loaded tasks for system injection — covers all P1-P5 branches.
 * Includes dependency chains for AND-rule demonstration.
 */

export const MARCH_2026_TASKS = [
  // ══════════════════════════════════════════════
  // P1 | שכר — Payroll (Immediate/Red)
  // ══════════════════════════════════════════════
  {
    id: 'march-p1-payroll-prep',
    title: 'הכנת שכר מרץ 2026',
    category: 'שכר',
    priority: 'urgent',
    status: 'not_started',
    due_date: '2026-03-10',
    estimated_time: 120,
    tags: ['P1', 'payroll', 'monthly'],
    client_name: 'כל הלקוחות',
  },
  {
    id: 'march-p1-social-security',
    title: 'דיווח ביטוח לאומי — מרץ',
    category: 'ביטוח לאומי',
    priority: 'urgent',
    status: 'not_started',
    due_date: '2026-03-15',
    estimated_time: 60,
    tags: ['P1', 'social-security'],
    client_name: 'כל הלקוחות',
    dependencies: ['march-p1-payroll-prep'],
  },
  {
    id: 'march-p1-deductions',
    title: 'ניכויים — מרץ',
    category: 'ניכויים',
    priority: 'high',
    status: 'not_started',
    due_date: '2026-03-15',
    estimated_time: 45,
    tags: ['P1', 'deductions'],
    client_name: 'כל הלקוחות',
    dependencies: ['march-p1-payroll-prep'],
  },
  {
    id: 'march-p1-payslips',
    title: 'משלוח תלושים — מרץ',
    category: 'משלוח תלושים',
    priority: 'high',
    status: 'not_started',
    due_date: '2026-03-12',
    estimated_time: 30,
    tags: ['P1', 'payslips'],
    client_name: 'כל הלקוחות',
    dependencies: ['march-p1-payroll-prep'],
  },

  // ══════════════════════════════════════════════
  // P2 | הנה"ח — Bookkeeping (Standard/Orange)
  // ══════════════════════════════════════════════
  {
    id: 'march-p2-vat',
    title: 'דוח מע"מ חודשי — פברואר',
    category: 'מע"מ',
    priority: 'high',
    status: 'not_started',
    due_date: '2026-03-15',
    estimated_time: 90,
    tags: ['P2', 'vat', 'monthly'],
    client_name: 'כל הלקוחות',
  },
  {
    id: 'march-p2-reconciliation',
    title: 'התאמות בנק — פברואר',
    category: 'התאמות',
    priority: 'high',
    status: 'not_started',
    due_date: '2026-03-20',
    estimated_time: 120,
    tags: ['P2', 'reconciliation'],
    client_name: 'כל הלקוחות',
  },
  {
    id: 'march-p2-pnl',
    title: 'דוח רווח והפסד — פברואר',
    category: 'רווח והפסד',
    priority: 'medium',
    status: 'not_started',
    due_date: '2026-03-25',
    estimated_time: 60,
    tags: ['P2', 'pnl', 'convergence'],
    client_name: 'כל הלקוחות',
    // AND RULE: P&L depends on BOTH VAT + Reconciliation
    dependencies: ['march-p2-vat', 'march-p2-reconciliation'],
    is_convergence: true,
  },
  {
    id: 'march-p2-advances',
    title: 'מקדמות מס — מרץ',
    category: 'מקדמות מס',
    priority: 'medium',
    status: 'not_started',
    due_date: '2026-03-15',
    estimated_time: 30,
    tags: ['P2', 'tax-advances'],
    client_name: 'כל הלקוחות',
  },

  // ══════════════════════════════════════════════
  // P3 | ניהול — Management (Planning/Blue)
  // ══════════════════════════════════════════════
  {
    id: 'march-p3-client-review',
    title: 'סקירת לקוחות רבעון 1',
    category: 'אדמיניסטרציה',
    priority: 'medium',
    status: 'not_started',
    due_date: '2026-03-20',
    estimated_time: 90,
    tags: ['P3', 'admin', 'quarterly'],
    client_name: 'כללי',
  },
  {
    id: 'march-p3-marketing',
    title: 'מעקב שיווק — מרץ',
    category: 'מעקב שיווק',
    priority: 'low',
    status: 'not_started',
    due_date: '2026-03-28',
    estimated_time: 45,
    tags: ['P3', 'marketing'],
    client_name: 'כללי',
  },

  // ══════════════════════════════════════════════
  // P4 | בית — Home/Personal
  // ══════════════════════════════════════════════

  // ── Maintenance: Cleaning ──
  {
    id: 'march-p4-weekly-clean',
    title: 'ניקיון שבועי — בית',
    category: 'home',
    subcategory: 'maintenance_cleaning',
    priority: 'medium',
    status: 'not_started',
    due_date: '2026-03-06',
    estimated_time: 90,
    tags: ['P4', 'home', 'cleaning', 'weekly'],
    recurring_pattern: 'weekly',
  },
  {
    id: 'march-p4-deep-clean',
    title: 'ניקיון יסודי — חודשי',
    category: 'home',
    subcategory: 'maintenance_cleaning',
    priority: 'low',
    status: 'not_started',
    due_date: '2026-03-28',
    estimated_time: 180,
    tags: ['P4', 'home', 'cleaning', 'monthly'],
  },

  // ── Maintenance: Laundry ──
  {
    id: 'march-p4-laundry',
    title: 'כביסה וגיהוץ',
    category: 'home',
    subcategory: 'maintenance_laundry',
    priority: 'medium',
    status: 'not_started',
    due_date: '2026-03-04',
    estimated_time: 60,
    tags: ['P4', 'home', 'laundry', 'weekly'],
    recurring_pattern: 'weekly',
  },

  // ── Maintenance: Garden ──
  {
    id: 'march-p4-garden',
    title: 'טיפול בגינה — מרץ',
    category: 'home',
    subcategory: 'maintenance_garden',
    priority: 'low',
    status: 'not_started',
    due_date: '2026-03-15',
    estimated_time: 60,
    tags: ['P4', 'home', 'garden', 'monthly'],
  },

  // ── Personal: Medical ──
  {
    id: 'march-p4-medical',
    title: 'בדיקה רפואית תקופתית',
    category: 'home',
    subcategory: 'personal_medical',
    priority: 'high',
    status: 'not_started',
    due_date: '2026-03-18',
    estimated_time: 120,
    tags: ['P4', 'personal', 'medical'],
  },

  // ── Personal: Legal ──
  {
    id: 'march-p4-legal',
    title: 'חידוש ביטוח דירה',
    category: 'home',
    subcategory: 'personal_legal',
    priority: 'medium',
    status: 'not_started',
    due_date: '2026-03-20',
    estimated_time: 45,
    tags: ['P4', 'personal', 'legal', 'insurance'],
  },

  // ── Personal: Family ──
  {
    id: 'march-p4-family',
    title: 'ארוחת משפחה — שבת',
    category: 'home',
    subcategory: 'personal_family',
    priority: 'medium',
    status: 'not_started',
    due_date: '2026-03-07',
    estimated_time: 120,
    tags: ['P4', 'personal', 'family', 'weekly'],
    recurring_pattern: 'weekly',
  },

  // ── Inventory: Shopping ──
  {
    id: 'march-p4-shopping',
    title: '🛒 קניות שבועיות',
    category: 'home',
    subcategory: 'inventory_shopping',
    priority: 'medium',
    status: 'not_started',
    due_date: '2026-03-05',
    estimated_time: 60,
    tags: ['P4', 'home', 'shopping', 'weekly'],
    recurring_pattern: 'weekly',
  },
  {
    id: 'march-p4-inventory-check',
    title: '📦 בדיקת מלאי חודשית',
    category: 'home',
    subcategory: 'inventory_check',
    priority: 'low',
    status: 'not_started',
    due_date: '2026-03-01',
    estimated_time: 30,
    tags: ['P4', 'home', 'inventory', 'monthly'],
  },

  // ══════════════════════════════════════════════
  // P5 | דוחות שנתיים — Annual (Archive/Annual)
  // ══════════════════════════════════════════════
  {
    id: 'march-p5-annual-prep',
    title: 'הכנת דוח שנתי 2025 — שלב ראשון',
    category: 'דוח שנתי',
    priority: 'medium',
    status: 'not_started',
    due_date: '2026-03-30',
    estimated_time: 240,
    tags: ['P5', 'annual', '2025'],
    client_name: 'כל הלקוחות',
  },
];

/**
 * P4 Home Sub-Branch Structure
 * Defines the hierarchical tree for the Home (P4) mind map branch
 */
export const P4_HOME_STRUCTURE = {
  maintenance: {
    label: 'תחזוקה',
    icon: '🔧',
    color: '#6D4C41',
    children: {
      cleaning: { label: 'ניקיון', icon: '🧹', color: '#4CAF50' },
      laundry: { label: 'כביסה', icon: '👕', color: '#42A5F5' },
      garden: { label: 'גינה', icon: '🌿', color: '#66BB6A' },
      supplies: { label: 'חומרי ניקיון', icon: '🧴', color: '#8BC34A' },
    },
  },
  personal: {
    label: 'אישי',
    icon: '👤',
    color: '#7B1FA2',
    children: {
      medical: { label: 'רפואי', icon: '🏥', color: '#F59E0B' },
      legal: { label: 'משפטי/ביטוח', icon: '⚖️', color: '#5C6BC0' },
      family: { label: 'משפחה', icon: '👨‍👩‍👧‍👦', color: '#8B5CF6' },
    },
  },
  inventory: {
    label: 'מלאי',
    icon: '📦',
    color: '#FF9800',
    children: {
      food: { label: 'מזון', icon: '🍎', color: '#FF7043' },
      cleaning: { label: 'חומרי ניקיון', icon: '🧹', color: '#66BB6A' },
      shopping: { label: 'קניות', icon: '🛒', color: '#FFA726' },
    },
  },
};
