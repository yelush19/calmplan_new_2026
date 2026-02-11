
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Edit, Trash2, Banknote, CreditCard, BookUser, Building2 } from 'lucide-react';
import { ClientAccount } from '@/api/entities';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { motion, AnimatePresence } from 'framer-motion';

const accountTypeIcons = {
    bank: <Banknote className="w-5 h-5" />,
    credit_card: <CreditCard className="w-5 h-5" />,
    bookkeeping: <BookUser className="w-5 h-5" />,
    clearing: <Building2 className="w-5 h-5" />,
};

const accountTypeLabels = {
    bank: 'בנק',
    credit_card: 'כרטיס אשראי',
    bookkeeping: 'הנהלת חשבונות',
    clearing: 'סליקה'
};

const AccountForm = ({ account, onSave, onCancel, clientId }) => {
    const [formData, setFormData] = useState({
        account_type: account?.account_type || 'bank',
        account_name: account?.account_name || '',
        account_number: account?.account_number || '',
        bank_name: account?.bank_name || '',
        loading_system: account?.loading_system || 'bizibox',
        reconciliation_frequency: account?.reconciliation_frequency || 'monthly',
        bookkeeping_card_number: account?.bookkeeping_card_number || '',
        last_reconciliation_date: account?.last_reconciliation_date || '',
        next_reconciliation_due: account?.next_reconciliation_due || '',
        notes: account?.notes || ''
    });

    const handleInputChange = (e) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleSelectChange = (id, value) => {
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({ ...formData, client_id: clientId });
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg bg-gray-50">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="account_type">סוג חשבון</Label>
                        <Select value={formData.account_type} onValueChange={(value) => handleSelectChange('account_type', value)}>
                            <SelectTrigger id="account_type"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {Object.entries(accountTypeLabels).map(([key, label]) => (
                                    <SelectItem key={key} value={key}>{label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor="account_name">שם החשבון</Label>
                        <Input id="account_name" value={formData.account_name} onChange={handleInputChange} placeholder="לדוגמה: בנק לאומי - עסקי" required />
                    </div>
                    <div>
                        <Label htmlFor="bank_name">שם הבנק / חברה</Label>
                        <Input id="bank_name" value={formData.bank_name} onChange={handleInputChange} placeholder="בנק, חברת אשראי, סולק" />
                    </div>
                    <div>
                        <Label htmlFor="account_number">מספר חשבון</Label>
                        <Input id="account_number" value={formData.account_number} onChange={handleInputChange} placeholder="מספר חשבון מלא" />
                    </div>
                    <div>
                        <Label htmlFor="bookkeeping_card_number">מספר כרטיס בהנה״ח</Label>
                        <Input id="bookkeeping_card_number" value={formData.bookkeeping_card_number} onChange={handleInputChange} />
                    </div>
                    <div>
                        <Label htmlFor="reconciliation_frequency">תדירות התאמה</Label>
                        <Select value={formData.reconciliation_frequency} onValueChange={(value) => handleSelectChange('reconciliation_frequency', value)}>
                            <SelectTrigger id="reconciliation_frequency"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="monthly">חודשי</SelectItem>
                                <SelectItem value="quarterly">רבעוני</SelectItem>
                                <SelectItem value="yearly">שנתי</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                     <div>
                        <Label htmlFor="last_reconciliation_date">תאריך התאמה אחרון</Label>
                        <Input type="date" id="last_reconciliation_date" value={formData.last_reconciliation_date} onChange={handleInputChange} />
                    </div>
                    <div>
                        <Label htmlFor="next_reconciliation_due">תאריך יעד להתאמה הבאה</Label>
                        <Input type="date" id="next_reconciliation_due" value={formData.next_reconciliation_due} onChange={handleInputChange} />
                    </div>
                </div>
                <div>
                    <Label htmlFor="notes">הערות</Label>
                    <Textarea id="notes" value={formData.notes} onChange={handleInputChange} placeholder="הערות מיוחדות..." />
                </div>
                <div className="flex gap-2 justify-end">
                    <Button type="button" variant="ghost" onClick={onCancel}>ביטול</Button>
                    <Button type="submit">שמור חשבון</Button>
                </div>
            </form>
        </motion.div>
    );
};

export default function ClientAccountsManager({ clientId, clientName }) {
    const [accounts, setAccounts] = useState([]);
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingAccount, setEditingAccount] = useState(null);

    useEffect(() => {
        loadAccounts();
    }, [clientId]);

    const loadAccounts = async () => {
        try {
            // FIX: Increased read limit
            const clientAccounts = await ClientAccount.filter({ client_id: clientId }, null, 100);
            setAccounts(clientAccounts || []);
        } catch (error) {
            console.error("Error loading client accounts:", error);
        }
    };

    const handleSave = async (accountData) => {
        try {
            if (editingAccount) {
                await ClientAccount.update(editingAccount.id, accountData);
            } else {
                await ClientAccount.create(accountData);
            }
            await loadAccounts();
            setShowAddForm(false);
            setEditingAccount(null);
        } catch (error) {
            console.error("Error saving account:", error);
        }
    };

    const handleDelete = async (accountId) => {
        if (window.confirm('האם אתה בטוח שברצונך למחוק חשבון זה?')) {
            try {
                await ClientAccount.delete(accountId);
                await loadAccounts();
            } catch (error) {
                console.error("Error deleting account:", error);
            }
        }
    };

    const handleEdit = (account) => {
        setEditingAccount(account);
        setShowAddForm(true);
    };

    const handleCancel = () => {
        setShowAddForm(false);
        setEditingAccount(null);
    };
    
    const handleAddNew = () => {
        setEditingAccount(null);
        setShowAddForm(true);
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle>חשבונות עבור: {clientName}</CardTitle>
                    <Button onClick={handleAddNew} size="sm">
                        <Plus className="w-4 h-4 ml-2" />
                        הוסף חשבון
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <AnimatePresence>
                    {showAddForm && (
                        <AccountForm
                            key={editingAccount?.id || 'new'}
                            account={editingAccount}
                            onSave={handleSave}
                            onCancel={handleCancel}
                            clientId={clientId}
                        />
                    )}
                </AnimatePresence>

                <div className="mt-6 space-y-3">
                    {accounts.length > 0 ? (
                        accounts.map(account => (
                            <motion.div
                                key={account.id}
                                layout
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="p-4 border rounded-lg flex flex-col md:flex-row justify-between md:items-center gap-4 hover:bg-gray-50/50"
                            >
                                <div className="flex items-center gap-3 flex-1">
                                    <span className="text-blue-600">{accountTypeIcons[account.account_type]}</span>
                                    <div>
                                        <p className="font-bold">{account.account_name}</p>
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600 mt-1">
                                            <span>{account.bank_name}</span>
                                            {account.account_number && <span>****{account.account_number.slice(-4)}</span>}
                                            {account.bookkeeping_card_number && <span className="bg-gray-100 px-2 py-0.5 rounded">כרטיס הנה״ח: {account.bookkeeping_card_number}</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-sm text-gray-700 text-right">
                                     <p>
                                        התאמה אחרונה: {account.last_reconciliation_date ? new Date(account.last_reconciliation_date).toLocaleDateString('he-IL') : 'לא עודכן'}
                                    </p>
                                    <p className="font-semibold">
                                        יעד הבא: {account.next_reconciliation_due ? new Date(account.next_reconciliation_due).toLocaleDateString('he-IL') : 'לא הוגדר'}
                                    </p>
                                </div>
                                <div className="flex gap-2 items-center justify-end">
                                    <Button variant="outline" size="icon" onClick={() => handleEdit(account)}>
                                        <Edit className="w-4 h-4" />
                                    </Button>
                                    <Button variant="destructive" size="icon" onClick={() => handleDelete(account.id)}>
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </motion.div>
                        ))
                    ) : (
                        <p className="text-center text-gray-500 py-8">לא נמצאו חשבונות עבור לקוח זה.</p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
