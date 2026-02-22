import { SystemConfig } from '@/api/entities';

const CONFIG_KEY = 'balance_sheet_templates';

/**
 * Default balance sheet stage templates.
 * Each stage has a set of standard tasks that can be auto-generated per client.
 */
export const DEFAULT_STAGE_TEMPLATES = {
  closing_operations: {
    label: 'פעולות סגירה',
    tasks: [
      { key: 'bank_reconciliation', title: 'התאמת בנק', description: 'התאמת יתרות בנק מול הנהלת חשבונות' },
      { key: 'credit_reconciliation', title: 'התאמת כרטיסי אשראי', description: 'התאמת חיובי אשראי' },
      { key: 'supplier_reconciliation', title: 'התאמת ספקים', description: 'בדיקת יתרות ספקים' },
      { key: 'customer_reconciliation', title: 'התאמת לקוחות', description: 'בדיקת יתרות לקוחות' },
      { key: 'inventory', title: 'עדכון מלאי', description: 'ספירת מלאי וסגירה' },
      { key: 'depreciation', title: 'חישוב פחת', description: 'חישוב והפרשת פחת שנתי' },
      { key: 'provisions', title: 'הפרשות', description: 'הפרשות חופשה, הבראה, פיצויים' },
      { key: 'payroll_reconciliation', title: 'התאמת שכר מול הנה"ח', description: 'התאמה בין מערכת שכר להנה"ח' },
      { key: 'balance_check', title: 'בדיקת יתרות חו"ז', description: 'בדיקת יתרות חובה וזכות' },
      { key: 'vat_annual', title: 'סגירת מע"מ שנתי', description: 'התאמת דיווחי מע"מ שנתי' },
    ],
  },
  editing_for_audit: {
    label: 'עריכה לביקורת',
    tasks: [
      { key: 'trial_balance', title: 'הכנת מאזן בוחן', description: 'מאזן בוחן מעודכן' },
      { key: 'financial_statements', title: 'הכנת דוחות כספיים', description: 'עריכת דוחות כספיים' },
      { key: 'notes_preparation', title: 'הכנת ביאורים', description: 'ביאורים לדוחות כספיים' },
      { key: 'tax_reconciliation', title: 'דוח התאמה למס', description: 'הכנת דוח התאמה למס הכנסה' },
      { key: 'tax_appendices', title: 'סיכום נספחי מס', description: 'הכנת נספחים ולוחות מס' },
    ],
  },
  sent_to_auditor: {
    label: 'שליחה לרו"ח',
    tasks: [
      { key: 'send_materials', title: 'שליחת חומרים לרו"ח', description: 'שליחת כל החומרים לביקורת' },
      { key: 'confirm_receipt', title: 'מעקב קבלה', description: 'אישור קבלת חומרים' },
    ],
  },
  auditor_questions_1: {
    label: 'שאלות רו"ח - סבב 1',
    tasks: [
      { key: 'answer_questions', title: 'מענה לשאלות רו"ח', description: 'טיפול בשאלות מהביקורת' },
      { key: 'complete_documents', title: 'השלמת מסמכים', description: 'השלמת מסמכים חסרים' },
    ],
  },
  auditor_questions_2: {
    label: 'שאלות רו"ח - סבב 2',
    tasks: [
      { key: 'additional_answers', title: 'מענה לשאלות נוספות', description: 'סבב שני של שאלות' },
      { key: 'final_fixes', title: 'תיקונים אחרונים', description: 'תיקונים ועדכונים אחרונים' },
    ],
  },
  signed: {
    label: 'חתימה',
    tasks: [
      { key: 'sign_reports', title: 'חתימה על דוחות', description: 'חתימה סופית על הדוחות' },
      { key: 'submit_authorities', title: 'הגשה לרשויות', description: 'הגשת הדוחות לרשויות המס' },
    ],
  },
};

/**
 * Load templates from SystemConfig (or return defaults)
 */
export async function loadBalanceSheetTemplates() {
  try {
    const configs = await SystemConfig.list(null, 50);
    const config = configs.find(c => c.config_key === CONFIG_KEY);
    if (config && config.data?.templates) {
      return { templates: config.data.templates, configId: config.id };
    }
    // Initialize with defaults
    const newConfig = await SystemConfig.create({
      config_key: CONFIG_KEY,
      data: { templates: DEFAULT_STAGE_TEMPLATES },
    });
    return { templates: DEFAULT_STAGE_TEMPLATES, configId: newConfig.id };
  } catch (err) {
    console.error('Error loading balance sheet templates:', err);
    return { templates: DEFAULT_STAGE_TEMPLATES, configId: null };
  }
}

/**
 * Save templates to SystemConfig
 */
export async function saveBalanceSheetTemplates(configId, templates) {
  try {
    if (configId) {
      await SystemConfig.update(configId, { data: { templates } });
    } else {
      const newConfig = await SystemConfig.create({
        config_key: CONFIG_KEY,
        data: { templates },
      });
      return newConfig.id;
    }
    return configId;
  } catch (err) {
    console.error('Error saving balance sheet templates:', err);
    throw err;
  }
}
