import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ServiceProvider, ServiceCompany } from '@/api/entities';
import { Plus, Users, RefreshCw, Trash2, Edit } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog';
import ServiceProviderForm from '../components/service-providers/ServiceProviderForm';
import ServiceCompanyForm from '../components/service-providers/ServiceCompanyForm';

export default function ServiceProvidersPage() {
  const [providers, setProviders] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [filteredProviders, setFilteredProviders] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showProviderForm, setShowProviderForm] = useState(false);
  const [editingProvider, setEditingProvider] = useState(null);

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    let filtered = [...providers];
    if (searchTerm) {
      filtered = filtered.filter(p =>
        p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.specialization?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    setFilteredProviders(filtered);
  }, [providers, searchTerm]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [providersData, companiesData] = await Promise.all([
        ServiceProvider.list().catch(() => []),
        ServiceCompany.list().catch(() => [])
      ]);
      setProviders(providersData || []);
      setCompanies(companiesData || []);
    } catch (error) {
      console.error('Error loading data:', error);
    }
    setIsLoading(false);
  };

  const handleEditProvider = (provider) => {
    setEditingProvider(provider);
    setShowProviderForm(true);
  };

  const handleProviderSubmit = async (formData) => {
    try {
      const dataToSave = { ...formData };
      if (!dataToSave.service_company_id) delete dataToSave.service_company_id;
      if (editingProvider?.id) {
        await ServiceProvider.update(editingProvider.id, dataToSave);
      } else {
        await ServiceProvider.create(dataToSave);
      }
      setShowProviderForm(false);
      setEditingProvider(null);
      await loadData();
    } catch (error) {
      console.error("Error saving provider:", error);
      alert(`Error: ${error.message}`);
    }
  };

  const handleDeleteProvider = async (providerId) => {
    if (window.confirm('למחוק ספק זה?')) {
      try {
        await ServiceProvider.delete(providerId);
        await loadData();
      } catch (error) {
        console.error('Error deleting provider:', error);
      }
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[400px]"><RefreshCw className="w-6 h-6 animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Users className="w-8 h-8 text-primary" />
          <h1 className="text-2xl font-bold">ספקים ונותני שירותים</h1>
          <Badge>{filteredProviders.length}</Badge>
        </div>
        <Button onClick={() => { setEditingProvider(null); setShowProviderForm(true); }}>
          <Plus className="w-4 h-4 ml-2" />
          הוסף ספק
        </Button>
      </motion.div>

      <Input placeholder="חיפוש ספק..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-md" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProviders.map(provider => (
          <Card key={provider.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-lg">{provider.name}</h3>
                  {provider.specialization && <p className="text-sm text-gray-500">{provider.specialization}</p>}
                  {provider.phone && <p className="text-sm text-gray-500">{provider.phone}</p>}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => handleEditProvider(provider)}><Edit className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteProvider(provider.id)}><Trash2 className="w-4 h-4 text-amber-500" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredProviders.length === 0 && (
        <Card className="p-8 text-center"><Users className="w-12 h-12 mx-auto text-gray-300 mb-3" /><p className="text-gray-500">אין ספקים. הוסף ספק חדש.</p></Card>
      )}

      <Dialog open={showProviderForm} onOpenChange={setShowProviderForm}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{editingProvider?.id ? 'עריכת ספק' : 'ספק חדש'}</DialogTitle>
            <DialogDescription>מלא את פרטי הספק</DialogDescription>
          </DialogHeader>
          <ServiceProviderForm provider={editingProvider} companies={companies} onSubmit={handleProviderSubmit} onCancel={() => setShowProviderForm(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
