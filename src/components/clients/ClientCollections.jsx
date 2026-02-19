
import React, { useState, useEffect } from 'react';
import { Invoice } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

const statusColors = {
  paid: "bg-green-100 text-green-800",
  sent: "bg-blue-100 text-blue-800",
  overdue: "bg-amber-100 text-amber-800",
  draft: "bg-gray-100 text-gray-800",
  cancelled: "bg-gray-200 text-gray-500 line-through",
};

const statusLabels = {
    paid: "שולמה",
    sent: "נשלחה",
    overdue: "בפיגור",
    draft: "טיוטה",
    cancelled: "בוטלה"
};

export default function ClientCollections({ clientId, clientName }) {
    const [invoices, setInvoices] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchInvoices = async () => {
            setIsLoading(true);
            // FIX: Increased read limit
            const clientInvoices = await Invoice.filter({ client_id: clientId }, null, 500);
            setInvoices(clientInvoices || []);
            setIsLoading(false);
        };

        if (clientId) {
            fetchInvoices();
        }
    }, [clientId]);
    
    const totalBilled = invoices.reduce((sum, inv) => inv.status !== 'cancelled' ? sum + inv.amount : sum, 0);
    const totalPaid = invoices.reduce((sum, inv) => inv.status === 'paid' ? sum + inv.amount : sum, 0);

    return (
        <div>
            <Card className="mb-6 bg-gray-50">
                <CardHeader>
                    <CardTitle>סיכום גבייה - {clientName}</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-blue-50 rounded-lg">
                        <h4 className="text-sm font-semibold text-blue-800">סך חיובים</h4>
                        <p className="text-2xl font-bold text-blue-900">₪{totalBilled.toLocaleString()}</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg">
                        <h4 className="text-sm font-semibold text-green-800">סך שולם</h4>
                        <p className="text-2xl font-bold text-green-900">₪{totalPaid.toLocaleString()}</p>
                    </div>
                    <div className="p-4 bg-orange-50 rounded-lg">
                        <h4 className="text-sm font-semibold text-orange-800">יתרה לתשלום</h4>
                        <p className="text-2xl font-bold text-orange-900">₪{(totalBilled - totalPaid).toLocaleString()}</p>
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">חשבוניות</h3>
                <Button><Plus className="ml-2 w-4 h-4"/>הפקת חשבונית חדשה</Button>
            </div>
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>מספר</TableHead>
                                <TableHead>תאריך הפקה</TableHead>
                                <TableHead>תאריך יעד</TableHead>
                                <TableHead>סכום</TableHead>
                                <TableHead>סטטוס</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan="5" className="text-center py-8">טוען נתונים...</TableCell></TableRow>
                            ) : invoices.length > 0 ? (
                                invoices.map(invoice => (
                                    <TableRow key={invoice.id}>
                                        <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                                        <TableCell>{new Date(invoice.issue_date).toLocaleDateString('he-IL')}</TableCell>
                                        <TableCell>{new Date(invoice.due_date).toLocaleDateString('he-IL')}</TableCell>
                                        <TableCell>₪{invoice.amount.toLocaleString()}</TableCell>
                                        <TableCell>
                                            <Badge className={statusColors[invoice.status]}>
                                                {statusLabels[invoice.status]}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow><TableCell colSpan="5" className="text-center py-8">לא נמצאו חשבוניות</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
