import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, FileText, Upload, Trash2, Download, Calendar } from 'lucide-react';
import { UploadFile } from '@/api/integrations';
import { Client } from '@/api/entities';

export default function ClientContractsManager({ clientId, clientName }) {
    const [contracts, setContracts] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (clientId) {
            loadContracts();
        }
    }, [clientId]);

    const loadContracts = async () => {
        setIsLoading(true);
        try {
            const client = await Client.get(clientId);
            setContracts(client?.contracts || []);
        } catch (error) {
            console.error("Error loading contracts:", error);
            setContracts([]);
        }
        setIsLoading(false);
    };

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const { file_url } = await UploadFile({ file });
            
            const newContract = {
                id: crypto.randomUUID(),
                file_url,
                file_name: file.name,
                signed_date: new Date().toISOString().split('T')[0],
                version: `v${contracts.length + 1}`,
                upload_date: new Date().toISOString().split('T')[0],
                status: 'active'
            };

            const updatedContracts = [...contracts, newContract];
            setContracts(updatedContracts);

            // Update client with new contracts
            await Client.update(clientId, { contracts: updatedContracts });
            
        } catch (error) {
            console.error("Error uploading contract:", error);
        } finally {
            setIsUploading(false);
            event.target.value = '';
        }
    };

    const removeContract = async (contractId) => {
        if (confirm('האם אתה בטוח שברצונך למחוק חוזה זה?')) {
            try {
                const updatedContracts = contracts.filter(c => c.id !== contractId);
                setContracts(updatedContracts);
                await Client.update(clientId, { contracts: updatedContracts });
            } catch (error) {
                console.error("Error removing contract:", error);
            }
        }
    };

    const updateContractDetails = async (contractId, field, value) => {
        try {
            const updatedContracts = contracts.map(contract => 
                contract.id === contractId ? { ...contract, [field]: value } : contract
            );
            setContracts(updatedContracts);
            await Client.update(clientId, { contracts: updatedContracts });
        } catch (error) {
            console.error("Error updating contract:", error);
        }
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center gap-2">
                        <FileText className="w-6 h-6 text-primary" />
                        ניהול חוזים - {clientName}
                    </CardTitle>
                    <div className="relative">
                        <Button disabled={isUploading} asChild>
                            <label className="cursor-pointer flex items-center h-full">
                                <Upload className={`w-4 h-4 ml-2 ${isUploading ? 'animate-spin' : ''}`} />
                                {isUploading ? 'מעלה...' : 'הוסף חוזה'}
                            </label>
                        </Button>
                        <input
                            type="file"
                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            onChange={handleFileUpload}
                            disabled={isUploading}
                        />
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {isLoading ? (
                        <div className="text-center text-gray-500 py-8">טוען חוזים...</div>
                    ) : contracts.length === 0 ? (
                        <div className="text-center text-gray-500 py-8">
                            <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                            <p>לא הועלו חוזים עדיין</p>
                            <p className="text-sm">השתמש בכפתור "הוסף חוזה" להעלאת חוזה חתום</p>
                        </div>
                    ) : (
                        contracts.map((contract) => (
                            <Card key={contract.id} className="bg-gray-50">
                                <CardContent className="p-4">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <FileText className="w-4 h-4 text-blue-600" />
                                                <a 
                                                    href={contract.file_url} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="font-medium text-blue-700 hover:underline"
                                                >
                                                    {contract.file_name}
                                                </a>
                                                <Badge variant="secondary">{contract.version}</Badge>
                                                <Badge 
                                                    variant={contract.status === 'active' ? 'default' : 'secondary'}
                                                    className={contract.status === 'active' ? 'bg-green-100 text-green-800' : ''}
                                                >
                                                    {contract.status === 'active' ? 'פעיל' : 'לא פעיל'}
                                                </Badge>
                                            </div>
                                            <div className="grid md:grid-cols-2 gap-4 mt-3">
                                                <div>
                                                    <Label className="text-xs text-gray-600">תאריך חתימה</Label>
                                                    <Input
                                                        type="date"
                                                        value={contract.signed_date || ''}
                                                        onChange={(e) => updateContractDetails(contract.id, 'signed_date', e.target.value)}
                                                        className="h-8 text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <Label className="text-xs text-gray-600">סטטוס</Label>
                                                    <select
                                                        value={contract.status || 'active'}
                                                        onChange={(e) => updateContractDetails(contract.id, 'status', e.target.value)}
                                                        className="w-full h-8 px-2 text-sm border rounded"
                                                    >
                                                        <option value="active">פעיל</option>
                                                        <option value="expired">פג תוקף</option>
                                                        <option value="superseded">הוחלף</option>
                                                    </select>
                                                </div>
                                            </div>
                                            {contract.upload_date && (
                                                <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                                                    <Calendar className="w-3 h-3" />
                                                    הועלה: {new Date(contract.upload_date).toLocaleDateString('he-IL')}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                asChild
                                            >
                                                <a href={contract.file_url} download>
                                                    <Download className="w-4 h-4" />
                                                </a>
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => removeContract(contract.id)}
                                                className="text-amber-600 hover:bg-amber-50"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </CardContent>
        </Card>
    );
}