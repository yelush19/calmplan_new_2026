import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, Building, User, Search } from 'lucide-react';
import { ServiceProvider } from '@/api/entities';
import { ServiceCompany } from '@/api/entities';
import ServiceProviderForm from '../components/service-providers/ServiceProviderForm';
import ServiceCompanyForm from '../components/service-providers/ServiceCompanyForm';

const TABS = {
  PROVIDERS: 'נותני שירות',
  COMPANIES: 'חברות שירות'
};

export default function ServiceProvidersPage() {
  const [activeTab, setActiveTab] = useState(TABS.PROVIDERS);
  const [serviceProviders, setServiceProviders] = useState([]);
  const [serviceCompanies, setServiceCompanies] = useState([]);
  const [filteredProviders, setFilteredProviders] = useState([]);
  const [filteredCompanies, setFilteredCompanies] = useState([]);
  const [showProviderForm, setShowProviderForm] = useState(false);
  const [showCompanyForm, setShowCompanyForm] = useState(false);
  const [editingProvider, setEditingProvider] = useState(null);
  const [editingCompany, setEditingCompany] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [companyFilter, setCompanyFilter] = useState('all');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterProviders();
  }, [searchTerm, companyFilter, serviceProviders]);

  useEffect(() => {
    filterCompanies();
  }, [searchTerm, serviceCompanies]);

  const loadData = async () => {
    try {
      const providers = await ServiceProvider.list() || [];
      const companies = await ServiceCompany.list() || [];
      setServiceProviders(providers);
      setServiceCompanies(companies);
    } catch (error) {
      console.error("שגיאה בטעינת נתונים:", error);
    }
  };

  const filterProviders = () => {
    let providers = [...serviceProviders];
    if (searchTerm) {
      providers = providers.filter(p =>
        (p.name && p.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.role && p.role.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    if (companyFilter !== 'all') {
      providers = providers.filter(p => p.service_company_id === companyFilter);
    }
    setFilteredProviders(providers);
  };
  
  const filterCompanies = () => {
    let companies = [...serviceCompanies];
    if (searchTerm) {
      companies = companies.filter(c => 
        c.name && c.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    setFilteredCompanies(companies);
  };

  const handleAddProvider = () => {
    setEditingProvider(null);
    setShowProviderForm(true);
  };

  const handleEditProvider = (provider) => {
    setEditingProvider(provider);
    setShowProviderForm(true);
  };

  const handleProviderSubmit = async (formData) => {
    try {
      const dataToSave = { ...formData };
      if (!dataToSave.service_company_id) {
        delete dataToSave.service_company_id;
      }
      
      if (editingProvider?.id) {
        await ServiceProvider.update(editingProvider.id, dataToSave);
      } else {
        await ServiceProvider.create(dataToSave);
      }
      setShowProviderForm(false);
      setEditingProvider(null);
      await loadData();
    } catch (error) {
      console.error("שגיאה בשמירת נותן שירות:", error);
      alert(`שגיאה בשמירת נותן שירות: ${error.message}`);
    }
  };

  const handleDeleteProvider = async (providerId) => {
    if (window.confirm('האם אתה בטוח שברצונך למחוק נותן שירות זה?')) {
      try {
        await ServiceProvider.delete(providerId);
        await loadData();
      } catch (error) {
        console.error("שגיאה במחיקת נותן שירות:", error);
      }
    }
  };

  const handleAddCompany = () => {
    setEditingCompany(null);
    setShowCompanyForm(true);
  };
  
  const handleEditCompany = (company) => {
    setEditingCompany(company);
    setShowCompanyForm(true);
  };

  const handleCompanySubmit = async (formData) => {
    try {
      if (editingCompany?.id) {
        await ServiceCompany.update(editingCompany.id, formData);
      } else {
        await ServiceCompany.create(formData);
      }
      setShowCompanyForm(false);
      setEditingCompany(null);
      await loadData();
    } catch (error) {
      console.error("שגיאה בשמירת חברת שירות:", error);
    }
  };

  const handleDeleteCompany = async (companyId) => {
    if (window.confirm('האם אתה בטוח שברצונך למחוק חברת שירות זו? מחיקה תמחק גם את אנשי הקשר המשויכים אליה.')) {
      try {
        const providersToDelete = serviceProviders.filter(p => p.service_company_id === companyId);
        for (const provider of providersToDelete) {
          await ServiceProvider.delete(provider.id);
        }
        await ServiceCompany.delete(companyId);
        await loadData();
      } catch (error) {
        console.error("שגיאה במחיקת חברת שירות:", error);
      }
    }
  };

  const getCompanyName = (companyId) => {
    const company = serviceCompanies.find(c => c.id === companyId);
    return company ? company.name : 'ללא חברה';
  };

  const onCancelProviderForm = () => {
    setShowProviderForm(false);
    setEditingProvider(null);
  };

  const onCancelCompanyForm = () => {
    setShowCompanyForm(false);
    setEditingCompany(null);
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen" dir="rtl">
      <Card className="max-w-7xl mx-auto">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>ניהול ספקים ונותני שירות</CardTitle>
            <div>
              {activeTab === TABS.PROVIDERS ? (
                <Button onClick={handleAddProvider}><Plus className="ml-2 h-4 w-4" /> הוסף נותן שירות</Button>
              ) : (
                <Button onClick={handleAddCompany}><Plus className="ml-2 h-4 w-4" /> הוסף חברת שירות</Button>
              )}
            </div>
          </div>
          <div className="flex border-b mt-4">
            <button
              className={`py-2 px-4 text-sm font-medium ${activeTab === TABS.PROVIDERS ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setActiveTab(TABS.PROVIDERS)}
            >
              {TABS.PROVIDERS}
            </button>
            <button
              className={`py-2 px-4 text-sm font-medium ${activeTab === TABS.COMPANIES ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setActiveTab(TABS.COMPANIES)}
            >
              {TABS.COMPANIES}
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {showProviderForm && (
            <ServiceProviderForm
              serviceCompanies={serviceCompanies}
              onSubmit={handleProviderSubmit}
              onCancel={onCancelProviderForm}
              provider={editingProvider}
            />
          )}

          {showCompanyForm && (
            <ServiceCompanyForm 
              onSubmit={handleCompanySubmit}
              onCancel={onCancelCompanyForm}
              company={editingCompany}
            />
          )}

          {!showProviderForm && !showCompanyForm && (
            <>
              <div className="mb-4 flex gap-4">
                <div className="relative w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input 
                    placeholder="חיפוש..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                {activeTab === TABS.PROVIDERS && (
                   <Select value={companyFilter} onValueChange={setCompanyFilter}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="סנן לפי חברה" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">כל החברות</SelectItem>
                      {serviceCompanies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {activeTab === TABS.PROVIDERS && (
                <div className="space-y-4">
                  {filteredProviders.map(provider => (
                    <Card key={provider.id}>
                      <CardContent className="p-4 flex justify-between items-center">
                        <div className="flex items-center gap-4">
                          <div className="bg-blue-100 p-3 rounded-full">
                            <User className="w-6 h-6 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-semibold">{provider.name}</p>
                            <p className="text-sm text-gray-500">{provider.role}</p>
                            <p className="text-sm text-gray-500">{getCompanyName(provider.service_company_id)}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleEditProvider(provider)}><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteProvider(provider.id)} className="text-red-500 hover:text-red-600"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {activeTab === TABS.COMPANIES && (
                <div className="space-y-4">
                   {filteredCompanies.map(company => (
                    <Card key={company.id}>
                      <CardContent className="p-4 flex justify-between items-center">
                        <div className="flex items-center gap-4">
                          <div className="bg-green-100 p-3 rounded-full">
                             <Building className="w-6 h-6 text-green-600" />
                          </div>
                          <div>
                            <p className="font-semibold">{company.name}</p>
                            <p className="text-sm text-gray-500">{company.phone}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleEditCompany(company)}><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteCompany(company.id)} className="text-red-500 hover:text-red-600"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}