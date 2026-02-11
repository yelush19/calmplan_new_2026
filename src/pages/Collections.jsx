import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Plus, Filter, FileText, CheckCircle, Clock, AlertTriangle } from 'lucide-react';

// Mock data until entities are properly set up
const mockInvoices = [];

export default function CollectionsPage() {
    const [invoices, setInvoices] = useState([]);
    const [clients, setClients] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            // Mock data for now
            setInvoices(mockInvoices);
            setClients([]);
        } catch (error) {
            console.error("Error loading collections data:", error);
        }
        setIsLoading(false);
    };
    
    const statusConfig = {
        draft: { label: 'טיוטה', color: 'bg-gray-200 text-gray-800', icon: FileText },
        sent: { label: 'נשלחה', color: 'bg-blue-200 text-blue-800', icon: Clock },
        paid: { label: 'שולמה', color: 'bg-green-200 text-green-800', icon: CheckCircle },
        overdue: { label: 'בפיגור', color: 'bg-red-200 text-red-800', icon: AlertTriangle },
        cancelled: { label: 'בוטלה', color: 'bg-gray-400 text-white', icon: FileText }
    };

    const totalRevenue = invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.amount, 0);
    const outstandingRevenue = invoices.filter(inv => ['sent', 'overdue'].includes(inv.status)).reduce((sum, inv) => sum + inv.amount, 0);

    return (
        <div className="space-y-6">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col md:flex-row justify-between items-center gap-4"
            >
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-green-100 rounded-full">
                        <DollarSign className="w-8 h-8 text-green-700" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800">ניהול גבייה</h1>
                        <p className="text-gray-600">מעקב אחר חשבוניות ותשלומים מלקוחות</p>
                    </div>
                </div>
                <Button className="bg-green-600 hover:bg-green-700">
                    <Plus className="w-4 h-4 ml-2" />
                    הפק חשבונית חדשה
                </Button>
            </motion.div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader><CardTitle>הכנסות ששולמו</CardTitle></CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold text-green-600">₪{totalRevenue.toLocaleString()}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>חובות פתוחים</CardTitle></CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold text-orange-500">₪{outstandingRevenue.toLocaleString()}</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>רשימת חשבוניות</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {isLoading ? (
                            <p>טוען חשבוניות...</p>
                        ) : invoices.length === 0 ? (
                            <div className="text-center text-gray-500 p-8">
                                <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                                <h3 className="text-xl font-semibold mb-2">אין חשבוניות להצגה</h3>
                                <p className="mb-4">התחל על ידי הפקת החשבונית הראשונה שלך</p>
                                <Button className="bg-green-600 hover:bg-green-700">
                                    <Plus className="w-4 h-4 ml-2" />
                                    הפק חשבונית ראשונה
                                </Button>
                            </div>
                        ) : (
                            invoices.map(invoice => {
                                const StatusIcon = statusConfig[invoice.status].icon;
                                return (
                                    <div key={invoice.id} className="p-4 border rounded-lg flex flex-col md:flex-row justify-between items-center gap-4">
                                        <div>
                                            <p className="font-bold text-lg">{invoice.client_name}</p>
                                            <p className="text-sm text-gray-600">חשבונית #{invoice.invoice_number} מתאריך {new Date(invoice.issue_date).toLocaleDateString('he-IL')}</p>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <p className="font-bold text-xl">₪{invoice.amount.toLocaleString()}</p>
                                            <Badge className={statusConfig[invoice.status].color}>
                                                <StatusIcon className="w-4 h-4 ml-2" />
                                                {statusConfig[invoice.status].label}
                                            </Badge>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}