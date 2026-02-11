import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Client, AccountReconciliation, ClientAccount } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Loader2 } from 'lucide-react';

export default function ReconciliationForm({ onClose, onSave }) {
    const [formData, setFormData] = useState({
        client_id: '',
        client_account_id: '',
        period: '',
        account_name: '',
        reconciliation_type: 'bank_credit',
        internal_type: '',
        status: 'not_started',
        notes: ''
    });
    const [clients, setClients] = useState([]);
    const [clientAccounts, setClientAccounts] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isClientsLoading, setIsClientsLoading] = useState(true);
    const [isAccountsLoading, setIsAccountsLoading] = useState(false);

    useEffect(() => {
        const fetchClients = async () => {
            const clientsData = await Client.list();
            setClients(clientsData || []);
            setIsClientsLoading(false);
        };
        fetchClients();
    }, []);

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleClientChange = async (clientId) => {
        handleChange('client_id', clientId);
        handleChange('client_account_id', ''); // Reset account selection
        setClientAccounts([]);
        if (clientId) {
            setIsAccountsLoading(true);
            try {
                const accounts = await ClientAccount.filter({ client_id: clientId });
                setClientAccounts(accounts || []);
            } catch (error) {
                console.error("Failed to fetch client accounts", error);
                setClientAccounts([]);
            } finally {
                setIsAccountsLoading(false);
            }
        }
    };
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const selectedClient = clients.find(c => c.id === formData.client_id);
            const selectedAccount = clientAccounts.find(a => a.id === formData.client_account_id);
            const dataToSave = {
                ...formData,
                client_name: selectedClient ? selectedClient.name : 'N/A',
                account_name: selectedAccount ? selectedAccount.account_name : formData.account_name,
            };
            if (dataToSave.reconciliation_type !== 'internal') {
                delete dataToSave.internal_type;
            }
            await AccountReconciliation.create(dataToSave);
            onSave();
        } catch (error) {
            console.error("Failed to create reconciliation:", error);
            // You can add user-facing error handling here
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="w-full max-w-lg">
                <form onSubmit={handleSubmit}>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>יצירת התאמה חדשה</CardTitle>
                            <Button variant="ghost" size="icon" onClick={onClose} type="button">
                                <X className="w-5 h-5" />
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label htmlFor="client">לקוח</Label>
                                {isClientsLoading ? <Loader2 className="animate-spin" /> : (
                                    <Select onValueChange={handleClientChange} value={formData.client_id}>
                                        <SelectTrigger id="client"><SelectValue placeholder="בחר לקוח..." /></SelectTrigger>
                                        <SelectContent>
                                            {clients.map(client => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>
                             {isAccountsLoading ? (
                                <Loader2 className="animate-spin" />
                             ) : clientAccounts.length > 0 ? (
                                <div>
                                    <Label htmlFor="client_account">חשבון</Label>
                                    <Select onValueChange={(value) => handleChange('client_account_id', value)} value={formData.client_account_id}>
                                        <SelectTrigger id="client_account"><SelectValue placeholder="בחר חשבון..." /></SelectTrigger>
                                        <SelectContent>
                                            {clientAccounts.map(account => <SelectItem key={account.id} value={account.id}>{account.account_name} ({account.bank_name})</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                             ) : formData.client_id ? (
                                <div>
                                    <Label htmlFor="account_name">שם החשבון (ידני)</Label>
                                    <Input id="account_name" placeholder="לא נמצאו חשבונות, הזן שם ידנית" value={formData.account_name} onChange={e => handleChange('account_name', e.target.value)} required />
                                </div>
                             ) : null}

                             <div>
                                <Label htmlFor="period">תקופה (YYYY-MM)</Label>
                                <Input id="period" type="month" value={formData.period} onChange={e => handleChange('period', e.target.value)} required />
                            </div>
                            
                             <div>
                                <Label htmlFor="reconciliation_type">סוג התאמה</Label>
                                <Select onValueChange={value => handleChange('reconciliation_type', value)} value={formData.reconciliation_type}>
                                    <SelectTrigger id="reconciliation_type"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="bank_credit">בנק ואשראי</SelectItem>
                                        <SelectItem value="internal">פנימית</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {formData.reconciliation_type === 'internal' && (
                                <div>
                                    <Label htmlFor="internal_type">סוג התאמה פנימית</Label>
                                    <Select onValueChange={value => handleChange('internal_type', value)} value={formData.internal_type}>
                                        <SelectTrigger id="internal_type"><SelectValue placeholder="בחר סוג..." /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="clients">לקוחות</SelectItem>
                                            <SelectItem value="suppliers">ספקים</SelectItem>
                                            <SelectItem value="institutions">מוסדות</SelectItem>
                                            <SelectItem value="other">אחר</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                            <div>
                                <Label htmlFor="notes">הערות</Label>
                                <Textarea id="notes" placeholder="הערות נוספות..." value={formData.notes} onChange={e => handleChange('notes', e.target.value)} />
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button type="submit" className="w-full" disabled={isLoading}>
                                {isLoading ? <Loader2 className="animate-spin mr-2" /> : null}
                                {isLoading ? 'יוצר...' : 'צור התאמה'}
                            </Button>
                        </CardFooter>
                    </Card>
                </form>
            </motion.div>
        </div>
    );
}