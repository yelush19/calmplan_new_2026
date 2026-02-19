import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, CheckCircle, AlertTriangle, Database } from 'lucide-react';
import { syncAllBoards } from '@/api/functions';

export default function FullSyncPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState(null);
    const [error, setError] = useState(null);

    const handleFullSync = async () => {
        setIsLoading(true);
        setError(null);
        setResults(null);

        try {
            const response = await syncAllBoards();
            if (response.data.success) {
                setResults(response.data);
            } else {
                setError(response.data.error);
            }
        } catch (err) {
            setError(err.message || 'שגיאה בסנכרון');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6 p-6">
            <div className="text-center">
                <h1 className="text-3xl font-bold mb-2">סנכרון מלא - כל הלוחות</h1>
                <p className="text-gray-600">סנכרון כל 7 הלוחות מ-Monday למערכת</p>
            </div>

            <Card className="max-w-2xl mx-auto">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Database className="w-5 h-5" />
                        סנכרון מלא
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <p className="text-sm text-gray-600">
                            פעולה זו תמחק את כל הנתונים הקיימים ותטען מחדש מ-Monday
                        </p>
                        
                        <Button 
                            onClick={handleFullSync}
                            disabled={isLoading}
                            className="w-full"
                            size="lg"
                        >
                            {isLoading ? (
                                <>
                                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                    מסנכרן...
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="w-4 h-4 mr-2" />
                                    התחל סנכרון מלא
                                </>
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {error && (
                <Card className="max-w-2xl mx-auto border-amber-200 bg-amber-50">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-amber-600">
                            <AlertTriangle className="w-5 h-5" />
                            <span className="font-medium">שגיאה בסנכרון</span>
                        </div>
                        <p className="text-amber-700 mt-2">{error}</p>
                    </CardContent>
                </Card>
            )}

            {results && (
                <div className="space-y-4">
                    <Card className="max-w-2xl mx-auto border-green-200 bg-green-50">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2 text-green-600 mb-3">
                                <CheckCircle className="w-5 h-5" />
                                <span className="font-medium">סנכרון הושלם בהצלחה</span>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-4 text-center">
                                <div>
                                    <div className="text-2xl font-bold text-green-700">{results.summary.boardsSynced}</div>
                                    <div className="text-sm text-green-600">לוחות סונכרנו</div>
                                </div>
                                <div>
                                    <div className="text-2xl font-bold text-blue-700">{results.summary.totalCreated}</div>
                                    <div className="text-sm text-blue-600">פריטים נוצרו</div>
                                </div>
                                <div>
                                    <div className="text-2xl font-bold text-amber-700">{results.summary.totalDeleted}</div>
                                    <div className="text-sm text-amber-600">פריטים נמחקו</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="space-y-3">
                        {results.results.map((result, index) => (
                            <Card key={index} className="max-w-2xl mx-auto">
                                <CardContent className="p-4">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <span className="font-medium">{result.boardType}</span>
                                            <span className="text-sm text-gray-500 ml-2">({result.boardId})</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {result.success ? (
                                                <Badge className="bg-green-100 text-green-800">
                                                    הצליח
                                                </Badge>
                                            ) : (
                                                <Badge className="bg-amber-100 text-amber-800">
                                                    נכשל
                                                </Badge>
                                            )}
                                            {result.success && (
                                                <span className="text-sm text-gray-600">
                                                    {result.syncResult.created} נוצרו, {result.syncResult.deleted} נמחקו
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}