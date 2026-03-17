import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Plus, Filter, FileText, CheckCircle, Clock, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { Invoice, Client } from '@/api/entities';
import UnifiedAyoaLayout from '@/components/canvas/UnifiedAyoaLayout';

export default function CollectionsPage() {
    const [invoices, setInvoices] = useState([]);
    const [clients, setClients] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const STATUS_KEYS = ['draft', 'sent', 'paid', 'overdue', 'cancelled'];
    const [collapsedGroups, setCollapsedGroups] = useState(() => {
        const init = {};
        ['draft', 'sent', 'paid', 'overdue', 'cancelled'].forEach(k => { init[k] = true; });
        return init;
    });
    const [allExpanded, setAllExpanded] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [invoiceList, clientList] = await Promise.all([
                Invoice.list(null, 500).catch(() => []),
                Client.list(null, 500).catch(() => []),
            ]);
            setInvoices(invoiceList || []);
            setClients(clientList || []);
        } catch (error) {
            console.error("Error loading collections data:", error);
        }
        setIsLoading(false);
    };
    
    const statusConfig = {
        draft: { label: 'טיוטה', color: 'bg-gray-200 text-gray-800', icon: FileText },
        sent: { label: 'נשלחה', color: 'bg-blue-200 text-blue-800', icon: Clock },
        paid: { label: 'שולמה', color: 'bg-green-200 text-green-800', icon: CheckCircle },
        overdue: { label: 'בפיגור', color: 'bg-amber-200 text-amber-800', icon: AlertTriangle },
        cancelled: { label: 'בוטלה', color: 'bg-gray-400 text-white', icon: FileText }
    };

    const totalRevenue = invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const outstandingRevenue = invoices.filter(inv => ['sent', 'overdue'].includes(inv.status)).reduce((sum, inv) => sum + (inv.amount || 0), 0);

    return (
        <UnifiedAyoaLayout tasks={[]} centerLabel="גבייה" accentColor="#059669" isLoading={isLoading}>
        <div className="space-y-6 dark:bg-gray-900">
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
                        <h1 className="text-xl font-bold text-[#1E3A5F] dark:text-white">ניהול גבייה</h1>
                        <p className="text-gray-600">מעקב אחר חשבוניות ותשלומים מלקוחות</p>
                    </div>
                </div>
                <Button className="bg-green-600 hover:bg-green-700">
                    <Plus className="w-4 h-4 ms-2" />
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
                    <div className="flex items-center justify-between">
                        <CardTitle>רשימת חשבוניות</CardTitle>
                        {invoices.length > 0 && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    if (allExpanded) {
                                        const collapsed = {};
                                        STATUS_KEYS.forEach(k => { collapsed[k] = true; });
                                        setCollapsedGroups(collapsed);
                                        setAllExpanded(false);
                                    } else {
                                        setCollapsedGroups({});
                                        setAllExpanded(true);
                                    }
                                }}
                                className="text-xs gap-1"
                            >
                                {allExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                {allExpanded ? 'כווץ הכל' : 'הרחב הכל'}
                            </Button>
                        )}
                    </div>
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
                                    <Plus className="w-4 h-4 ms-2" />
                                    הפק חשבונית ראשונה
                                </Button>
                            </div>
                        ) : (
                            STATUS_KEYS.map(statusKey => {
                                const groupInvoices = invoices.filter(inv => (inv.status || 'draft') === statusKey);
                                if (groupInvoices.length === 0) return null;
                                const config = statusConfig[statusKey] || statusConfig.draft;
                                const StatusIcon = config.icon;
                                return (
                                    <div key={statusKey} className="mb-2">
                                        <button
                                            onClick={() => setCollapsedGroups(prev => ({ ...prev, [statusKey]: !prev[statusKey] }))}
                                            className="w-full flex items-center justify-between p-2 rounded-lg bg-[#F5F5F5] dark:bg-gray-800 hover:bg-[#E0E0E0] dark:hover:bg-gray-700 transition-colors text-start"
                                        >
                                            <div className="flex items-center gap-2">
                                                <ChevronDown className={`w-4 h-4 transition-transform ${collapsedGroups[statusKey] ? '-rotate-90' : ''}`} />
                                                <StatusIcon className="w-4 h-4" />
                                                <span className="font-bold text-[#000000] text-sm">{config.label}</span>
                                                <span className="text-xs text-[#455A64]">({groupInvoices.length} חשבוניות)</span>
                                            </div>
                                        </button>
                                        {!collapsedGroups[statusKey] && (
                                            <div className="mt-1 space-y-2">
                                                {groupInvoices.map(invoice => (
                                                    <div key={invoice.id} className="p-4 rounded-xl shadow-sm border hover:shadow-md transition-shadow flex flex-col md:flex-row justify-between items-center gap-4">
                                                        <div>
                                                            <p className="font-bold text-lg">{invoice.client_name || 'לקוח לא ידוע'}</p>
                                                            <p className="text-sm text-gray-600">חשבונית #{invoice.invoice_number || '—'} {invoice.issue_date ? `מתאריך ${new Date(invoice.issue_date).toLocaleDateString('he-IL')}` : ''}</p>
                                                        </div>
                                                        <div className="flex items-center gap-4">
                                                            <p className="font-bold text-xl">₪{(invoice.amount || 0).toLocaleString()}</p>
                                                            <Badge className={config.color}>
                                                                <StatusIcon className="w-4 h-4 ms-2" />
                                                                {config.label}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
        </UnifiedAyoaLayout>
    );
}