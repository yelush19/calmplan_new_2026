/**
 * ── Priority Client Tasks — March 2026 ──
 *
 * Specific client action items as defined by system architect.
 * These tasks are created on first load if not already present.
 */

// ── Priority Client Map ──
export const PRIORITY_CLIENTS = [
  { id: 2345, name: 'בראנדלייט', status: 'active' },
  { id: 501,  name: 'סמארט קליק', status: 'active' },
  { id: 5868, name: 'פנדה טק', status: 'active' },
];

// ── Priority Tasks ──
export const PRIORITY_TASKS = [
  // ═══════ בראנדלייט (2345) ═══════
  {
    id: 'priority-brandlight-update-depts',
    title: 'עדכון מחלקות לעובדים חדשים',
    description: 'עדכון מחלקות לעובדים חדשים + קליטת פקודות שכר 01.2024 + 02.2024',
    client_name: 'בראנדלייט',
    category: 'שכר',
    branch: 'P1',
    priority: 'high',
    status: 'not_started',
    due_date: '2026-03-12',
    tags: ['P1', 'payroll', 'priority-client'],
    notes: 'סטטוס: קובץ מעודכן נשלח למתפעל. NEW TASK: עדכון מחלקות + קליטת פקודות שכר 01.2024 & 02.2024',
  },
  {
    id: 'priority-brandlight-payroll-commands-jan',
    title: 'בראנדלייט — קליטת פקודות שכר 01.2024',
    description: 'קליטת פקודת שכר עבור חודש ינואר 2024',
    client_name: 'בראנדלייט',
    category: 'שכר',
    branch: 'P1',
    priority: 'high',
    status: 'not_started',
    due_date: '2026-03-14',
    tags: ['P1', 'payroll', 'priority-client'],
  },
  {
    id: 'priority-brandlight-payroll-commands-feb',
    title: 'בראנדלייט — קליטת פקודות שכר 02.2024',
    description: 'קליטת פקודת שכר עבור חודש פברואר 2024',
    client_name: 'בראנדלייט',
    category: 'שכר',
    branch: 'P1',
    priority: 'high',
    status: 'not_started',
    due_date: '2026-03-14',
    tags: ['P1', 'payroll', 'priority-client'],
    dependencies: ['priority-brandlight-payroll-commands-jan'],
  },

  // ═══════ סמארט קליק (501) ═══════
  {
    id: 'priority-smartclick-bank-reconciliation',
    title: 'סמארט קליק — התאמת בנק לאומי (מ-18.02.26)',
    description: 'התאמת בנק לאומי — חוסרים מאז 18.02.26. בדיקת תנועות חסרות ועדכון.',
    client_name: 'סמארט קליק',
    category: 'התאמות',
    branch: 'P2',
    priority: 'urgent',
    status: 'not_started',
    due_date: '2026-03-10',
    tags: ['P2', 'reconciliation', 'priority-client'],
    notes: 'Bank Reconciliation issues (Leumi since 18.02.26)',
  },
  {
    id: 'priority-smartclick-new-cc-1015',
    title: 'סמארט קליק — כרטיס אשראי חדש 1015 (ILS/EUR)',
    description: 'כרטיס אשראי חדש 1015 — ש"ח ואירו. מעקב בעוד 7 ימים.',
    client_name: 'סמארט קליק',
    category: 'הנהלת חשבונות',
    branch: 'P2',
    priority: 'high',
    status: 'not_started',
    due_date: '2026-03-16',
    tags: ['P2', 'bookkeeping', 'priority-client', 'follow-up-7-days'],
    notes: 'New Credit Card 1015 (ILS/EUR) - Follow up in 7 days',
  },

  // ═══════ פנדה טק (5868) ═══════
  {
    id: 'priority-pandatech-fix-slip',
    title: 'פנדה טק — תיקון תלוש + סימון הושלם ייצור',
    description: 'קובץ נשלח. פעולה: תיקון תלוש + סימון "הושלם ייצור מתפעל" (ללא צורך במס"ב).',
    client_name: 'פנדה טק',
    category: 'שכר',
    branch: 'P1',
    priority: 'high',
    status: 'sent_for_review',
    due_date: '2026-03-11',
    tags: ['P1', 'payroll', 'priority-client', 'no-masav'],
    notes: 'File sent. Fix slip + Mark "Operator Process Done" (No Masav needed)',
    process_steps: {
      prepare_payslips: { done: true, date: '2026-03-08', notes: 'קובץ נשלח' },
      proofreading: { done: false, date: null, notes: 'תיקון תלוש נדרש' },
    },
  },
];
