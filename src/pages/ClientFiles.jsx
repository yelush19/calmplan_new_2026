import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FolderOpen, Users } from 'lucide-react';
import { Client } from '@/api/entities';
import ClientFilesManager from '@/components/files/ClientFilesManager';

export default function ClientFiles() {
  const [searchParams] = useSearchParams();
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState(searchParams.get('clientId') || '');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    setIsLoading(true);
    try {
      const data = await Client.list(null, 500);
      const activeClients = (data || []).filter(c => c.status === 'active' || c.status === 'onboarding_pending' || c.status === 'balance_sheet_only');
      activeClients.sort((a, b) => a.name.localeCompare(b.name, 'he'));
      setClients(activeClients);
    } catch (err) {
      console.error('Error loading clients:', err);
    }
    setIsLoading(false);
  };

  const selectedClient = clients.find(c => c.id === selectedClientId);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
          <FolderOpen className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-neutral-dark">ניהול קבצים</h1>
          <p className="text-neutral-medium">אחסון, ניהול ושיתוף מסמכי לקוחות</p>
        </div>
      </div>

      {/* Client Selector */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Users className="w-5 h-5 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">בחר לקוח:</span>
            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder={isLoading ? 'טוען...' : 'בחר לקוח'} />
              </SelectTrigger>
              <SelectContent>
                {clients.map(client => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* File Manager */}
      {selectedClient ? (
        <ClientFilesManager
          clientId={selectedClient.id}
          clientName={selectedClient.name}
        />
      ) : (
        <Card className="p-12 text-center">
          <FolderOpen className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-semibold text-gray-600 mb-2">בחר לקוח להצגת קבצים</h3>
          <p className="text-gray-500">בחר לקוח מהרשימה כדי לצפות בקבצים שלו, להעלות קבצים חדשים, או לנהל מסמכים קיימים.</p>
        </Card>
      )}
    </div>
  );
}
