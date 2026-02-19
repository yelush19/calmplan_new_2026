import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Trash2, RefreshCw, Database, AlertTriangle } from 'lucide-react';
import { emergencyReset } from '@/api/functions';
import { mondayApi } from '@/api/functions';
import { useConfirm } from '@/components/ui/ConfirmDialog';

export default function EmergencyResetPage() {
    const { confirm, ConfirmDialogComponent } = useConfirm();
    const [isResetting, setIsResetting] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    const handleFullReset = async () => {
        const ok = await confirm({
            title: 'איפוס מלא של המערכת',
            description: 'פעולה הרסנית! כל הנתונים יימחקו ויישאר רק מה שב-Monday.\nפעולה זו בלתי הפיכה!',
            confirmText: 'מחק הכל ואפס',
            delayMs: 5000,
        });
        if (!ok) return;

        setIsResetting(true);
        setResult(null);
        setError(null);

        try {
            // שלב 1: מחיקה מלאה
            const deleteResult = await emergencyReset({ action: 'deleteAll' });

            if (!deleteResult.data.success) {
                throw new Error(`שגיאה במחיקה: ${deleteResult.data.error}`);
            }

            // שלב 2: המתנה קצרה
            await new Promise(resolve => setTimeout(resolve, 2000));

            // שלב 3: סנכרון מחדש מ-Monday
            const syncResults = [];
            
            // סנכרון לקוחות
            try {
                const clientSync = await mondayApi({ action: 'syncClients' });
                syncResults.push(`לקוחות: ${clientSync.data.created?.length || 0} נוצרו`);
            } catch (e) {
                syncResults.push(`לקוחות: שגיאה - ${e.message}`);
            }

            // סנכרון משימות דיווח
            try {
                const reportSync = await mondayApi({ action: 'syncTasks' });
                syncResults.push(`משימות דיווח: ${reportSync.data.created?.length || 0} נוצרו`);
            } catch (e) {
                syncResults.push(`משימות דיווח: שגיאה - ${e.message}`);
            }

            setResult({
                success: true,
                message: 'איפוס מלא הושלם בהצלחה!',
                details: [
                    `נמחקו: ${deleteResult.data.deleted} רשומות ישנות`,
                    ...syncResults,
                    'המערכת נקייה ומסונכרנת עם Monday בלבד!'
                ]
            });

        } catch (err) {
            setError(`שגיאה באיפוס: ${err.message}`);
        } finally {
            setIsResetting(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-6">
            {ConfirmDialogComponent}
            <div className="text-center">
                <h1 className="text-3xl font-bold text-amber-600 mb-2">איפוס מלא של המערכת</h1>
                <p className="text-gray-600">מחיקה מלאה של כל הנתונים וסנכרון מחדש מ-Monday בלבד</p>
            </div>

            <Card className="border-amber-200 bg-amber-50">
                <CardHeader>
                    <CardTitle className="flex items-center gap-3 text-amber-700">
                        <AlertTriangle className="w-6 h-6" />
                        אזהרה - פעולה הרסנית!
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="bg-white p-4 rounded-lg">
                        <h3 className="font-bold mb-2">מה יקרה:</h3>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                            <li>🗑️ מחיקה מלאה של כל המשימות, לקוחות ואירועים</li>
                            <li>🔄 סנכרון מחדש רק מ-Monday.com</li>
                            <li>✨ מערכת נקייה ללא כפילויות</li>
                            <li>📊 רק הנתונים הנכונים מ-Monday יישארו</li>
                        </ul>
                    </div>

                    <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                        <p className="text-yellow-800 font-medium">
                            ⚠️ פעולה זו בלתי הפיכה! וודא שכל הנתונים החשובים שלך נמצאים ב-Monday.com
                        </p>
                    </div>

                    <Button
                        onClick={handleFullReset}
                        disabled={isResetting}
                        className="w-full bg-amber-600 hover:bg-amber-700 text-white text-lg py-3"
                    >
                        {isResetting ? (
                            <>
                                <RefreshCw className="w-5 h-5 ml-2 animate-spin" />
                                מבצע איפוס מלא...
                            </>
                        ) : (
                            <>
                                <Trash2 className="w-5 h-5 ml-2" />
                                ביצוע איפוס מלא
                            </>
                        )}
                    </Button>
                </CardContent>
            </Card>

            {result && (
                <Alert className="border-green-200 bg-green-50">
                    <Database className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                        <div className="font-bold mb-2">{result.message}</div>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                            {result.details.map((detail, index) => (
                                <li key={index}>{detail}</li>
                            ))}
                        </ul>
                    </AlertDescription>
                </Alert>
            )}

            {error && (
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
        </div>
    );
}