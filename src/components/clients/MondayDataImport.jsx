
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Client } from '@/api/entities';
import { Upload, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import mondayClientsData from '@/data/monday_clients_import.json';

export default function MondayDataImport({ onComplete }) {
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState(null);

  const handleImport = async () => {
    setIsImporting(true);
    const log = [];
    let updated = 0, created = 0, skipped = 0, errors = 0;

    try {
      const existingClients = await Client.list(null, 500);
      const clientsByName = {};
      existingClients.forEach(c => {
        clientsByName[c.name] = c;
      });

      for (const importClient of mondayClientsData) {
        try {
          const existing = clientsByName[importClient.name];

          // Build the update payload
          const updateData = {
            status: importClient.status,
            entity_number: importClient.entity_number || undefined,
            service_types: importClient.service_types,
            tax_info: {
              tax_id: importClient.tax_info.tax_id || undefined,
              vat_file_number: importClient.tax_info.vat_file_number || undefined,
              tax_deduction_file_number: importClient.tax_info.tax_deduction_file_number || undefined,
              social_security_file_number: importClient.tax_info.social_security_file_number || undefined,
              annual_tax_ids: {
                current_year: '2026',
                // Leave 2026 IDs empty for manual entry
                tax_advances_id: '',
                social_security_id: '',
                deductions_id: '',
                tax_advances_percentage: '',
              },
              // Store 2025 data as history
              annual_tax_ids_history: {
                '2025': importClient.tax_info.annual_tax_ids_2025 || {}
              }
            },
            reporting_info: {
              vat_reporting_frequency: importClient.reporting_info.vat_reporting_frequency,
              tax_advances_frequency: importClient.reporting_info.tax_advances_frequency,
              deductions_frequency: importClient.reporting_info.deductions_frequency,
              social_security_frequency: importClient.reporting_info.social_security_frequency,
              payroll_frequency: importClient.reporting_info.payroll_frequency,
            },
          };

          // Add deadlines info to notes if available
          const deadlines = importClient.deadlines || {};
          const deadlineNotes = [];
          if (deadlines.vat) deadlineNotes.push(`יעד מע"מ: ${deadlines.vat}`);
          if (deadlines.tax_advances) deadlineNotes.push(`יעד מקדמות: ${deadlines.tax_advances}`);
          if (deadlines.deductions) deadlineNotes.push(`יעד ניכויים: ${deadlines.deductions}`);
          if (deadlines.social_security) deadlineNotes.push(`יעד בל: ${deadlines.social_security}`);

          const extraInfo = [];
          if (importClient.extra_services) extraInfo.push(`שירותים נוספים: ${importClient.extra_services}`);
          if (importClient.auditor) extraInfo.push(`רו"ח מלווה: ${importClient.auditor}`);
          if (deadlineNotes.length > 0) extraInfo.push(deadlineNotes.join(' | '));

          if (extraInfo.length > 0) {
            const existingNotes = existing?.notes || importClient.notes || '';
            const mondaySection = `\n--- נתוני Monday 2025 ---\n${extraInfo.join('\n')}`;
            if (!existingNotes.includes('נתוני Monday 2025')) {
              updateData.notes = existingNotes + mondaySection;
            }
          }

          // Add contact info
          if (importClient.contact_person && !existing?.contact_person) {
            updateData.contact_person = importClient.contact_person;
          }
          if (importClient.contact_email && !existing?.email) {
            updateData.email = importClient.contact_email;
          }

          if (existing) {
            // Preserve existing annual_tax_ids values if they already exist
            if (existing.tax_info?.annual_tax_ids?.tax_advances_id) {
              updateData.tax_info.annual_tax_ids.tax_advances_id = existing.tax_info.annual_tax_ids.tax_advances_id;
            }
            if (existing.tax_info?.annual_tax_ids?.social_security_id) {
              updateData.tax_info.annual_tax_ids.social_security_id = existing.tax_info.annual_tax_ids.social_security_id;
            }
            if (existing.tax_info?.annual_tax_ids?.deductions_id) {
              updateData.tax_info.annual_tax_ids.deductions_id = existing.tax_info.annual_tax_ids.deductions_id;
            }
            if (existing.tax_info?.annual_tax_ids?.tax_advances_percentage) {
              updateData.tax_info.annual_tax_ids.tax_advances_percentage = existing.tax_info.annual_tax_ids.tax_advances_percentage;
            }
            // Merge existing history
            if (existing.tax_info?.annual_tax_ids_history) {
              updateData.tax_info.annual_tax_ids_history = {
                ...existing.tax_info.annual_tax_ids_history,
                ...updateData.tax_info.annual_tax_ids_history
              };
            }

            await Client.update(existing.id, updateData);
            updated++;
            log.push(`עודכן: ${importClient.name}`);
          } else {
            // Create new client
            await Client.create({
              name: importClient.name,
              ...updateData,
            });
            created++;
            log.push(`נוצר: ${importClient.name}`);
          }
        } catch (err) {
          errors++;
          log.push(`שגיאה ב-${importClient.name}: ${err.message}`);
        }
      }

      setResult({ updated, created, skipped, errors, log });
    } catch (err) {
      setResult({ updated, created, skipped, errors: errors + 1, log: [...log, `שגיאה כללית: ${err.message}`] });
    }

    setIsImporting(false);
    if (onComplete) onComplete();
  };

  return (
    <Card className="border-blue-200 bg-blue-50/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Upload className="w-5 h-5 text-blue-600" />
          ייבוא נתוני Monday.com (2025)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-600 mb-3">
          יעדכן את כרטיסי הלקוחות עם: ח"פ, מספרי פנקס, תדירויות דיווח, סוגי שירות.
          <br />
          מזהים שנתיים (מקדמות, ניכויים, בל) יאוחסנו כנתוני 2025. את 2026 תעדכני ידנית.
        </p>

        <div className="flex items-center gap-3">
          <Button
            onClick={handleImport}
            disabled={isImporting}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isImporting ? (
              <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> מייבא...</>
            ) : (
              <><Upload className="w-4 h-4 ml-2" /> ייבא {mondayClientsData.length} לקוחות</>
            )}
          </Button>
          <span className="text-xs text-gray-500">
            {mondayClientsData.length} לקוחות בקובץ הייבוא
          </span>
        </div>

        {result && (
          <div className="mt-4 p-3 rounded-lg bg-white border">
            <div className="flex items-center gap-4 text-sm mb-2">
              {result.errors === 0 ? (
                <span className="text-green-600 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" /> הושלם בהצלחה
                </span>
              ) : (
                <span className="text-amber-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" /> הושלם עם שגיאות
                </span>
              )}
              <span className="text-gray-600">{result.updated} עודכנו</span>
              <span className="text-gray-600">{result.created} נוצרו</span>
              {result.errors > 0 && <span className="text-red-600">{result.errors} שגיאות</span>}
            </div>
            <details className="text-xs text-gray-500">
              <summary className="cursor-pointer">פירוט ({result.log.length} שורות)</summary>
              <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                {result.log.map((line, i) => <div key={i}>{line}</div>)}
              </div>
            </details>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
