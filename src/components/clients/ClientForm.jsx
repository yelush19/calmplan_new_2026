
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building, User, FileText, Settings, Save, X, Trash2, Plus, Send, UserPlus, Phone, Mail, ChevronDown, Upload } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Client, ServiceCompany, ServiceProvider, ClientServiceProvider } from '@/api/entities';
import ClientAccountsManager from '@/components/clients/ClientAccountsManager';
import ProcessTreeManager from '@/components/clients/ProcessTreeManager';
import { loadAutomationRules, getAutoLinkedServices } from '@/config/automationRules';
import TagSelector from '@/components/ui/TagSelector';


export default function ClientForm({ client, onSubmit, onCancel, onClientUpdate }) {
  const [formData, setFormData] = useState({
    name: '',
    nickname: '',
    email: '',
    phone: '',
    address: '',
    contact_person: '',
    contacts: [],
    company: '',
    status: 'active',
    onboarding_year: String(new Date().getFullYear()),
    entity_number: '',
    monthly_fee: '',
    service_types: [],
    tax_info: {
      tax_id: '',
      vat_file_number: '',
      tax_deduction_file_number: '',
      social_security_file_number: '',
      direct_transmission: true,
      annual_tax_ids: {
        current_year: String(new Date().getFullYear()),
        social_security_id: '',
        deductions_id: '',
        tax_advances_id: '',
        tax_advances_percentage: '',
        last_updated: '',
        updated_by: ''
      },
      prev_year_ids: {
        tax_advances_id: '',
        tax_advances_percentage: '',
        social_security_id: '',
        deductions_id: ''
      }
    },
    reporting_info: {
      vat_reporting_frequency: 'monthly',
      tax_advances_frequency: 'monthly',
      deductions_frequency: 'monthly',
      social_security_frequency: 'monthly',
      payroll_frequency: 'monthly',
      pnl_frequency: 'not_applicable',
      pnl_target_day: '',
      masav_suppliers_cycles: 0,
      masav_suppliers_cycle_dates: []
    },
    business_info: {
      business_size: 'small',
      business_type: 'company',
      employee_count: 0,
      complexity_level: 'low',
      estimated_monthly_hours: {
        payroll: 0,
        vat_reporting: 0,
        bookkeeping: 0,
        reports: 0
      }
    },
    integration_info: {
      monday_group_id: '',
      monday_board_id: '',
      annual_reports_client_id: '',
      lastpass_payment_entry_id: '',
      calmplan_id: ''
    },
    communication_preferences: {
      preferred_method: 'email',
      urgent_contact: ''
    },
    billing_info: {
      payment_method: '',
      billing_cycle: 'monthly',
      fixed_retainer: '',
      billing_notes: ''
    },
    fee_status: '',
    paying_client_id: '',
    tags: [],
    notes: '',
    process_tree: {},
    shareholders: [],  // Array of { name, id_number, birth_date, license_number, phone, email, role, custom_fields: {} }
    display_fields: {  // Which fields to show on task lists/dashboards
      show_entity_number: true,
      show_deductions_file: true,
      show_deductions_id: true,
      show_advances_id: true,
      show_social_security_id: false,
      show_shareholders: false,
    },
  });

  const [onboardingLink, setOnboardingLink] = useState('');

  const [isSyncingAnnualIds, setIsSyncingAnnualIds] = useState(false);
  const [syncAnnualIdsMessage, setSyncAnnualIdsMessage] = useState(null);

  const [serviceCompanies, setServiceCompanies] = useState([]);
  const [serviceProviders, setServiceProviders] = useState([]);
  const [clientLinks, setClientLinks] = useState([]);
  const [isLoadingLinks, setIsLoadingLinks] = useState(false);

  const [selectedCompanyToLink, setSelectedCompanyToLink] = useState(null);
  const [selectedProvidersToLink, setSelectedProvidersToLink] = useState([]);
  const [automationRules, setAutomationRules] = useState([]);
  const [allClientsForLinking, setAllClientsForLinking] = useState([]);

  const isNewClient = !client?.id;

  useEffect(() => {
    if (client) {
      setFormData(prev => {
        const mergedData = {
          ...prev,
          ...client,
          tax_info: {
            ...prev.tax_info,
            ...client.tax_info,
            annual_tax_ids: {
              ...prev.tax_info.annual_tax_ids,
              ...(client.tax_info?.annual_tax_ids || {})
            },
            prev_year_ids: {
              ...prev.tax_info.prev_year_ids,
              ...(client.tax_info?.prev_year_ids || {})
            }
          },
          reporting_info: { ...prev.reporting_info, ...client.reporting_info },
          business_info: { ...prev.business_info, ...client.business_info, estimated_monthly_hours: { ...prev.business_info.estimated_monthly_hours, ...(client.business_info?.estimated_monthly_hours || {}) } },
          integration_info: { ...prev.integration_info, ...client.integration_info },
          communication_preferences: { ...prev.communication_preferences, ...client.communication_preferences },
          billing_info: { ...prev.billing_info, ...client.billing_info },
          contacts: client.contacts || [],
        };

        const primaryContact = (mergedData.contacts || []).find(c => c.is_primary);

        if (primaryContact) {
          mergedData.contact_person = primaryContact.name || '';
          mergedData.email = primaryContact.email || '';
          mergedData.phone = primaryContact.phone || '';
        }

        return mergedData;
      });

      if (client.onboarding_link_id) {
        const relativeUrl = createPageUrl(`ClientOnboarding?id=${client.onboarding_link_id}`);
        const link = `${window.location.origin}${relativeUrl}`;
        setOnboardingLink(link);
      }
    }
  }, [client]);

  useEffect(() => {
    const loadLinkData = async () => {
      if (isNewClient) return;
      setIsLoadingLinks(true);
      try {
        const [companies, providers, links] = await Promise.all([
          ServiceCompany.list(null, 500),
          ServiceProvider.list(null, 500),
          ClientServiceProvider.filter({ client_id: client.id }, null, 500)
        ]);
        setServiceCompanies(companies || []);
        setServiceProviders(providers || []);
        setClientLinks(links || []);
      } catch (error) {
        console.error("Error loading service provider data:", error);
        setServiceCompanies([]);
        setServiceProviders([]);
        setClientLinks([]);
      }
      setIsLoadingLinks(false);
    };

    loadLinkData();
  }, [client, isNewClient]);

  useEffect(() => {
    loadAutomationRules().then(({ rules }) => setAutomationRules(rules));
  }, []);

  useEffect(() => {
    Client.list(null, 500).then(data => {
      const filtered = (data || []).filter(c => c.status === 'active' && c.id !== client?.id);
      setAllClientsForLinking(filtered);
    }).catch(() => {});
  }, [client?.id]);

  const handleInputChange = (field, value, section = null, subSection = null) => {
    setFormData(prev => {
      let newData = { ...prev };

      if (subSection) {
        newData[section] = {
          ...newData[section],
          [subSection]: {
            ...newData[section][subSection],
            [field]: value
          }
        };
      } else if (section) {
        newData[section] = {
          ...newData[section],
          [field]: value
        };
      } else {
        newData[field] = value;
      }

      // סנכרון entity_number -> tax_info.tax_id and tax_info.vat_file_number
      if (field === 'entity_number') {
        const trimmedValue = (value || '').trim();
        // This will now correctly set or clear tax_id and vat_file_number based on entity_number's value
        newData.tax_info = {
          ...newData.tax_info,
          tax_id: trimmedValue,
          vat_file_number: trimmedValue
        };
      }
      // The outline suggested a block here for `if (field === 'tax_id' && section === 'tax_info')`.
      // However, `handleInputChange` is not used for `tax_info` fields; `handleTaxInfoChange` is.
      // Implementing that block here would result in dead code.
      // The `handleTaxInfoChange` already handles the `tax_id` -> `entity_number` sync.
      // Therefore, omitting the dead code block to maintain clarity and avoid redundancy.

      return newData;
    });
  };

  const handleServiceTypeChange = (serviceType, checked) => {
    setFormData(prev => {
      let newServiceTypes = checked
        ? [...(prev.service_types || []), serviceType]
        : (prev.service_types || []).filter(s => s !== serviceType);

      let newReportingInfo = { ...prev.reporting_info };

      // When unchecking payroll, also remove related services and reset frequencies
      if (serviceType === 'payroll' && !checked) {
        const payrollLinked = getAutoLinkedServices(automationRules, 'payroll', prev);
        newServiceTypes = newServiceTypes.filter(s => !payrollLinked.includes(s));
        newReportingInfo.payroll_frequency = 'not_applicable';
        newReportingInfo.social_security_frequency = 'not_applicable';
        newReportingInfo.deductions_frequency = 'not_applicable';
      }

      // When checking a service, apply automation rules to auto-add linked services
      if (checked) {
        const autoAdd = getAutoLinkedServices(automationRules, serviceType, prev);
        for (const svc of autoAdd) {
          if (!newServiceTypes.includes(svc)) newServiceTypes.push(svc);
        }
        // Set payroll-related frequencies when payroll is selected
        if (serviceType === 'payroll') {
          if (newReportingInfo.payroll_frequency === 'not_applicable') newReportingInfo.payroll_frequency = 'monthly';
          if (newReportingInfo.social_security_frequency === 'not_applicable') newReportingInfo.social_security_frequency = 'monthly';
          if (newReportingInfo.deductions_frequency === 'not_applicable') newReportingInfo.deductions_frequency = 'monthly';
        }
      }

      return {
        ...prev,
        service_types: newServiceTypes,
        reporting_info: newReportingInfo
      };
    });
  };

  const handleSelectAllServices = (checked) => {
    if (checked) {
      setFormData(prev => ({ ...prev, service_types: serviceTypes.map(s => s.value) }));
    } else {
      setFormData(prev => ({ ...prev, service_types: [] }));
    }
  };

  const addContact = () => {
    setFormData(prev => ({
      ...prev,
      contacts: [...(prev.contacts || []), {
        name: '', role: 'contact_person', phone: '', mobile: '', email: '', is_primary: false, preferred_contact_method: 'email', notes: ''
      }]
    }));
  };

  const removeContactEntry = (index) => {
    setFormData(prev => ({ ...prev, contacts: prev.contacts.filter((_, i) => i !== index) }));
  };

  const updateContact = (index, field, value) => {
    setFormData(prev => {
      let updatedContacts = [...prev.contacts];
      const updatedContact = { ...updatedContacts[index], [field]: value };
      updatedContacts[index] = updatedContact;

      let newFormData = { ...prev, contacts: updatedContacts };

      if (field === 'is_primary' && value === true) {
        newFormData.contacts = updatedContacts.map((contact, i) => {
          if (i !== index) {
            contact.is_primary = false;
          }
          return contact;
        });

        newFormData.contact_person = updatedContact.name || '';
        newFormData.email = updatedContact.email || '';
        newFormData.phone = updatedContact.phone || '';
      }
      else if (updatedContact.is_primary) {
        newFormData.contact_person = updatedContact.name || '';
        newFormData.email = updatedContact.email || '';
        newFormData.phone = updatedContact.phone || '';
      }

      return newFormData;
    });
  };

  const handleTaxInfoChange = (field, value, section, subSection) => {
    setFormData(prev => {
      let newData = { ...prev };

      if (subSection) {
        newData[section] = {
          ...newData[section],
          [subSection]: {
            ...newData[section][subSection],
            [field]: value
          }
        };
      } else {
        newData[section] = {
          ...newData[section],
          [field]: value
        };
      }

      // סנכרון tax_id -> entity_number and potentially vat_file_number
      if (field === 'tax_id') {
        newData.entity_number = value.trim();
        // Also, if vat_file_number is empty, sync it from tax_id as well
        if (!newData.tax_info.vat_file_number || newData.tax_info.vat_file_number === '') {
          newData.tax_info.vat_file_number = value.trim();
        }
      }

      if (field === 'tax_deduction_file_number') {
        const socialSecurityNumber = (value && value.length >= 9) ? (value + '00') : '';
        newData.tax_info.social_security_file_number = socialSecurityNumber;
      }

      return newData;
    });
  };

  const roleLabels = {
    owner: 'בעלים', ceo: 'מנכ"ל', cfo: 'סמנכ"ל כספים', accountant: 'רו"ח', secretary: 'מזכירה', hr_manager: 'מנהל משאבי אנוש', operations: 'תפעול', contact_person: 'איש קשר', administration: 'אדמיניסטרציה', legal_counsel: 'יועץ משפטי', insurance_agent: 'סוכן ביטוח', other: 'אחר'
  };

  const generateOnboardingLink = async () => {
    if (!client || !client.id) {
      alert('יש לשמור את הלקוח תחילה על מנת ליצור קישור קליטה.');
      return;
    }

    let linkId = client.onboarding_link_id;
    if (!linkId) {
      linkId = crypto.randomUUID();
      await Client.update(client.id, { onboarding_link_id: linkId });
      if (onClientUpdate) onClientUpdate();
    }
    const relativeUrl = createPageUrl(`ClientOnboarding?id=${linkId}`);
    const link = `${window.location.origin}${relativeUrl}`;
    setOnboardingLink(link);
    navigator.clipboard.writeText(link).then(() => {
      alert('הקישור הועתק ללוח!');
    });
  };

  const validateForm = () => {
    const errors = [];
    const warnings = [];
    const isDirectTransmission = formData.tax_info?.direct_transmission;

    if (formData.service_types?.includes('tax_advances')) {
      if (!formData.tax_info?.annual_tax_ids?.tax_advances_id) {
        if (isDirectTransmission) {
          warnings.push('שים לב: לקוח עם מקדמות ללא מזהה מקדמות (שידור ישיר)');
        } else {
          errors.push('לקוח עם שירות מקדמות חייב להכיל מזהה מקדמות');
        }
      }
      if (!isDirectTransmission && (formData.tax_info?.annual_tax_ids?.tax_advances_percentage === '' || formData.tax_info?.annual_tax_ids?.tax_advances_percentage === undefined || formData.tax_info?.annual_tax_ids?.tax_advances_percentage === null)) {
        errors.push('לקוח עם שירות מקדמות חייב להכיל אחוז מקדמות');
      }
    }

    if (formData.service_types?.includes('payroll')) {
      if (!formData.tax_info?.annual_tax_ids?.social_security_id) {
        if (isDirectTransmission) {
          warnings.push('שים לב: לקוח עם שכר ללא מזהה ביטוח לאומי (שידור ישיר)');
        } else {
          errors.push('לקוח עם שירות שכר חייב להכיל מזהה ביטוח לאומי');
        }
      }
      if (!formData.tax_info?.annual_tax_ids?.deductions_id) {
        if (isDirectTransmission) {
          warnings.push('שים לב: לקוח עם שכר ללא מזהה ניכויים (שידור ישיר)');
        } else {
          errors.push('לקוח עם שירות שכר חייב להכיל מזהה ניכויים');
        }
      }
    }

    return { errors, warnings };
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const { errors: validationErrors, warnings: validationWarnings } = validateForm();
    if (validationErrors.length > 0) {
      alert('שגיאות בטופס:\n' + validationErrors.join('\n'));
      return;
    }
    if (validationWarnings.length > 0) {
      const proceed = confirm('תזכורות:\n' + validationWarnings.join('\n') + '\n\nלהמשיך בשמירה?');
      if (!proceed) return;
    }

    const cleanedData = {
      ...formData,
      billing_info: { ...formData.billing_info, fixed_retainer: formData.billing_info?.fixed_retainer === '' || formData.billing_info?.fixed_retainer === undefined ? null : Number(formData.billing_info.fixed_retainer) },
      email: formData.email || null, phone: formData.phone || null, address: formData.address || null, contact_person: formData.contact_person || null, entity_number: formData.entity_number || null,
      tax_info: {
        ...formData.tax_info,
        tax_id: formData.tax_info?.tax_id || null,
        vat_file_number: formData.tax_info?.vat_file_number || null,
        tax_deduction_file_number: formData.tax_info?.tax_deduction_file_number || null,
        social_security_file_number: formData.tax_info?.social_security_file_number || null,
        annual_tax_ids: {
          ...formData.tax_info.annual_tax_ids,
          tax_advances_percentage: formData.tax_info.annual_tax_ids?.tax_advances_percentage === '' || formData.tax_info.annual_tax_ids?.tax_advances_percentage === undefined || formData.tax_info.annual_tax_ids?.tax_advances_percentage === null ? null : Number(formData.tax_info.annual_tax_ids?.tax_advances_percentage)
        }
      }
    };
    onSubmit(cleanedData);
  };

  const serviceTypeGroups = [
    {
      group: 'שירותי ליבה',
      services: [
        { value: 'bookkeeping', label: 'הנהלת חשבונות' },
        { value: 'vat_reporting', label: 'דיווחי מע״מ' },
        { value: 'tax_advances', label: 'מקדמות מס' },
        { value: 'payroll', label: 'שכר' },
        { value: 'social_security', label: 'ביטוח לאומי' },
        { value: 'deductions', label: 'מ״ה ניכויים' },
      ]
    },
    {
      group: 'מס"בים ותשלומים',
      services: [
        { value: 'masav_employees', label: 'מס״ב עובדים' },
        { value: 'masav_social', label: 'מס״ב סוציאליות' },
        { value: 'masav_suppliers', label: 'מס״ב ספקים' },
        { value: 'authorities_payment', label: 'תשלום רשויות' },
      ]
    },
    {
      group: 'דיווחים ודוחות',
      services: [
        { value: 'pnl_reports', label: 'דוחות רווח והפסד (PNL)' },
        { value: 'annual_reports', label: 'מאזנים / דוחות שנתיים' },
        { value: 'reconciliation', label: 'התאמות חשבונות' },
        { value: 'operator_reporting', label: 'דיווח למתפעל' },
        { value: 'taml_reporting', label: 'דיווח לטמל' },
      ]
    },
    {
      group: 'שירותים נוספים',
      services: [
        { value: 'payslip_sending', label: 'משלוח תלושים' },
        { value: 'reserve_claims', label: 'תביעות מילואים' },
        { value: 'admin', label: 'אדמיניסטרציה' },
      ]
    },
  ];

  // Flat list for backward compatibility
  const serviceTypes = serviceTypeGroups.flatMap(g => g.services);

  const serviceProviderTypeLabels = {
    cpa: "רו\"ח",
    attorney: "עו\"ד",
    auditor: "מבקר",
    bookkeeper: "מנה\"ח",
    partner: "שותף",
    consultant: "יועץ",
    other: "אחר"
  };

  const linkedProviderIds = useMemo(() => {
    return new Set(clientLinks.map(link => link.service_provider_id));
  }, [clientLinks]);

  const availableCompanies = useMemo(() => {
    const companiesWithUnlinkedProviders = new Set();
    serviceProviders.forEach(provider => {
      if (!linkedProviderIds.has(provider.id)) {
        companiesWithUnlinkedProviders.add(provider.service_company_id);
      }
    });
    return serviceCompanies.filter(company => companiesWithUnlinkedProviders.has(company.id));
  }, [serviceCompanies, serviceProviders, linkedProviderIds]);

  const unlinkedProvidersByCompany = useMemo(() => {
    const map = new Map();
    availableCompanies.forEach(company => {
      const providers = serviceProviders.filter(p => p.service_company_id === company.id && !linkedProviderIds.has(p.id));
      if (providers.length > 0) {
        map.set(company.id, providers);
      }
    });
    return map;
  }, [availableCompanies, serviceProviders, linkedProviderIds]);

  const handleCompanySelectForLinking = (companyId) => {
    setSelectedCompanyToLink(companyId);
    setSelectedProvidersToLink([]);
  };

  const handleProviderSelection = (providerId, checked) => {
    setSelectedProvidersToLink(prev => {
      if (checked) {
        return [...prev, providerId];
      } else {
        return prev.filter(id => id !== providerId);
      }
    });
  };

  const handleLinkSelectedProviders = async () => {
    if (!client?.id || selectedProvidersToLink.length === 0) return;

    setIsLoadingLinks(true);
    try {
      const linkPromises = selectedProvidersToLink.map(providerId =>
        ClientServiceProvider.create({
          client_id: client.id,
          service_provider_id: providerId,
          relationship_type: 'consultant'
        })
      );
      await Promise.all(linkPromises);

      const links = await ClientServiceProvider.filter({ client_id: client.id }, null, 500);
      setClientLinks(links || []);
      setSelectedCompanyToLink(null);
      setSelectedProvidersToLink([]);
    } catch (error) {
      console.error("Error linking providers:", error);
    }
    setIsLoadingLinks(false);
  };

  const handleUnlinkCompany = async (companyId) => {
    if (!client?.id || !companyId) return;

    const providersInCompany = serviceProviders.filter(p => p.service_company_id === companyId);
    const providerIdsInCompany = new Set(providersInCompany.map(p => p.id));

    const linksToDelete = clientLinks.filter(link => providerIdsInCompany.has(link.service_provider_id));
    if (linksToDelete.length === 0) return;

    if (!window.confirm("האם אתה בטוח שברצונך לבטל את שיוך החברה וכל אנשי הקשר שלה?")) {
      return;
    }

    setIsLoadingLinks(true);
    try {
      const deletePromises = linksToDelete.map(link => ClientServiceProvider.delete(link.id));
      await Promise.all(deletePromises);

      const links = await ClientServiceProvider.filter({ client_id: client.id }, null, 500);
      setClientLinks(links || []);

    } catch (error) {
      console.error("Error unlinking company:", error);
    }
    setIsLoadingLinks(false);
  };

  return (
    <motion.form onSubmit={handleSubmit} initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
      {formData.status === 'onboarding_pending' && (
        <div className="mb-4 p-3 bg-yellow-100 border-r-4 border-yellow-500 text-yellow-800 rounded-md">
          <p className="font-semibold">לקוח זה השלים טופס קליטה. יש לבדוק את הפרטים, למלא את המידע הפנימי (שעות, חיוב וכו׳) ולשנות את הסטטוס ל"פעיל".</p>
        </div>
      )}
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-3">
              <Building className="w-6 h-6 text-blue-600" />
              {client?.id ? `עריכת לקוח: ${client.name || formData.name || ''}` : 'לקוח חדש'}
            </CardTitle>
            {client?.id && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline">
                    <Send className="w-4 h-4 ml-2" />
                    שלח טופס קליטה ללקוח
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-96">
                  <div className="space-y-4">
                    <h4 className="font-semibold">קישור לטופס קליטה</h4>
                    <p className="text-sm text-muted-foreground">שלח קישור זה ללקוח למילוי פרטיו. לאחר שיסיים, סטטוס הלקוח ישתנה ל"ממתין לבדיקה".</p>
                    {onboardingLink ? (
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <Input value={onboardingLink} readOnly />
                        <Button size="sm" onClick={() => navigator.clipboard.writeText(onboardingLink)}>העתק</Button>
                      </div>
                    ) : (
                      <Button type="button" onClick={generateOnboardingLink}>
                        צור והעתק קישור
                      </Button>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="basic" className="space-y-6">
            <TabsList className="flex flex-wrap gap-2 h-auto p-3 rounded-2xl bg-gradient-to-l from-gray-50 to-white border-2 border-gray-100 shadow-sm sticky top-0 z-20">
              <TabsTrigger value="basic" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-sky-500 data-[state=active]:to-sky-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:scale-105 data-[state=inactive]:bg-white data-[state=inactive]:text-gray-600 data-[state=inactive]:border data-[state=inactive]:border-gray-200 data-[state=inactive]:hover:border-sky-300 data-[state=inactive]:hover:text-sky-600 rounded-full px-5 py-2.5 text-sm font-bold whitespace-nowrap transition-all duration-300">📋 פרטים</TabsTrigger>
              <TabsTrigger value="process_tree" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:scale-105 data-[state=inactive]:bg-white data-[state=inactive]:text-gray-600 data-[state=inactive]:border data-[state=inactive]:border-gray-200 data-[state=inactive]:hover:border-emerald-300 data-[state=inactive]:hover:text-emerald-600 rounded-full px-5 py-2.5 text-sm font-bold whitespace-nowrap transition-all duration-300">🌳 תהליכים</TabsTrigger>
              <TabsTrigger value="financial" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:scale-105 data-[state=inactive]:bg-white data-[state=inactive]:text-gray-600 data-[state=inactive]:border data-[state=inactive]:border-gray-200 data-[state=inactive]:hover:border-amber-300 data-[state=inactive]:hover:text-amber-600 rounded-full px-5 py-2.5 text-sm font-bold whitespace-nowrap transition-all duration-300">💰 כספי</TabsTrigger>
              <TabsTrigger value="providers" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:scale-105 data-[state=inactive]:bg-white data-[state=inactive]:text-gray-600 data-[state=inactive]:border data-[state=inactive]:border-gray-200 data-[state=inactive]:hover:border-violet-300 data-[state=inactive]:hover:text-violet-600 rounded-full px-5 py-2.5 text-sm font-bold whitespace-nowrap transition-all duration-300">👥 נ.שירותים</TabsTrigger>
              <TabsTrigger value="tax" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:scale-105 data-[state=inactive]:bg-white data-[state=inactive]:text-gray-600 data-[state=inactive]:border data-[state=inactive]:border-gray-200 data-[state=inactive]:hover:border-violet-300 data-[state=inactive]:hover:text-violet-600 rounded-full px-5 py-2.5 text-sm font-bold whitespace-nowrap transition-all duration-300">🧾 מס</TabsTrigger>
              <TabsTrigger value="accounts" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-blue-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:scale-105 data-[state=inactive]:bg-white data-[state=inactive]:text-gray-600 data-[state=inactive]:border data-[state=inactive]:border-gray-200 data-[state=inactive]:hover:border-cyan-300 data-[state=inactive]:hover:text-cyan-600 rounded-full px-5 py-2.5 text-sm font-bold whitespace-nowrap transition-all duration-300">🏦 בנק</TabsTrigger>
              <TabsTrigger value="integration" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:scale-105 data-[state=inactive]:bg-white data-[state=inactive]:text-gray-600 data-[state=inactive]:border data-[state=inactive]:border-gray-200 data-[state=inactive]:hover:border-indigo-300 data-[state=inactive]:hover:text-indigo-600 rounded-full px-5 py-2.5 text-sm font-bold whitespace-nowrap transition-all duration-300">🔗 חיבורים</TabsTrigger>
              <TabsTrigger value="shareholders" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-slate-600 data-[state=active]:to-slate-700 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:scale-105 data-[state=inactive]:bg-white data-[state=inactive]:text-gray-600 data-[state=inactive]:border data-[state=inactive]:border-gray-200 data-[state=inactive]:hover:border-slate-400 data-[state=inactive]:hover:text-slate-600 rounded-full px-5 py-2.5 text-sm font-bold whitespace-nowrap transition-all duration-300">👤 בעלי מניות</TabsTrigger>
              <TabsTrigger value="display_settings" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-slate-600 data-[state=active]:to-slate-700 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:scale-105 data-[state=inactive]:bg-white data-[state=inactive]:text-gray-600 data-[state=inactive]:border data-[state=inactive]:border-gray-200 data-[state=inactive]:hover:border-slate-400 data-[state=inactive]:hover:text-slate-600 rounded-full px-5 py-2.5 text-sm font-bold whitespace-nowrap transition-all duration-300">👁️ הצגה</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 rounded-2xl border-2 border-sky-200 bg-sky-50/30 p-5">
              <div className="grid md:grid-cols-2 gap-4">
                <div><Label htmlFor="name">שם הלקוח *</Label><Input id="name" value={formData.name} onChange={(e) => handleInputChange('name', e.target.value)} required /></div>
                <div><Label htmlFor="nickname">כינוי (מוצג במפה)</Label><Input id="nickname" value={formData.nickname || ''} onChange={(e) => handleInputChange('nickname', e.target.value)} placeholder="שם מקוצר / כינוי" /><p className="text-xs text-gray-500 mt-1">אם ריק, יוצג שם הלקוח המלא</p></div>
                <div><Label htmlFor="contact_person">איש קשר ראשי</Label><Input id="contact_person" value={formData.contact_person} onChange={(e) => handleInputChange('contact_person', e.target.value)} /></div>
                <div><Label htmlFor="email">אימייל ראשי</Label><Input id="email" type="email" value={formData.email} onChange={(e) => handleInputChange('email', e.target.value)} /></div>
                <div><Label htmlFor="phone">טלפון ראשי</Label><Input id="phone" value={formData.phone} onChange={(e) => handleInputChange('phone', e.target.value)} /></div>
                <div className="md:col-span-2"><Label htmlFor="address">כתובת</Label><Input id="address" value={formData.address} onChange={(e) => handleInputChange('address', e.target.value)} /></div>
                <div>
                  <Label htmlFor="entity_number">מספר ישות (ח.פ./ע.מ.)</Label>
                  <Input 
                    id="entity_number" 
                    value={formData.entity_number || ''} 
                    onChange={(e) => handleInputChange('entity_number', e.target.value)} 
                    placeholder="512345678"
                    className="font-mono"
                  />
                  {formData.entity_number && formData.tax_info?.tax_id === formData.entity_number && (
                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                      <span className="font-bold">✓</span> מסונכרן עם מספר זיהוי מס בפרטי המס
                    </p>
                  )}
                  {formData.entity_number && formData.tax_info?.tax_id !== formData.entity_number && formData.tax_info?.tax_id && (
                    <p className="text-xs text-orange-600 mt-1 flex items-center gap-1">
                      <span className="font-bold">⚠</span> שונה ממספר זיהוי מס בפרטי המס: {formData.tax_info.tax_id}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    💡 עדכון כאן יעדכן אוטומטית את מספר זיהוי מס ומספר תיק מע"מ
                  </p>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4 pt-4 border-t">
                <div><Label htmlFor="business_size">גודל העסק</Label><Select value={formData.business_info?.business_size} onValueChange={(value) => handleInputChange('business_size', value, 'business_info')}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="small">קטן</SelectItem><SelectItem value="medium">בינוני</SelectItem><SelectItem value="large">גדול</SelectItem></SelectContent></Select></div>
                <div><Label htmlFor="business_type">סוג העסק</Label><Select value={formData.business_info?.business_type} onValueChange={(value) => {
                  handleInputChange('business_type', value, 'business_info');
                  // Re-apply automation rules for current services with new business type
                  const currentServices = formData.service_types || [];
                  const updatedClientData = { ...formData, business_info: { ...formData.business_info, business_type: value } };
                  const allAutoAdd = [];
                  for (const svc of currentServices) {
                    allAutoAdd.push(...getAutoLinkedServices(automationRules, svc, updatedClientData));
                  }
                  if (allAutoAdd.length > 0) {
                    setFormData(prev => {
                      const st = [...(prev.service_types || [])];
                      for (const s of allAutoAdd) {
                        if (!st.includes(s)) st.push(s);
                      }
                      return { ...prev, service_types: st };
                    });
                  }
                }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="company">חברה</SelectItem><SelectItem value="freelancer">עצמאי</SelectItem><SelectItem value="nonprofit">עמותה</SelectItem><SelectItem value="partnership">שותפות</SelectItem></SelectContent></Select></div>
                <div><Label htmlFor="status">סטטוס</Label><Select value={formData.status} onValueChange={(value) => handleInputChange('status', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">פעיל</SelectItem><SelectItem value="inactive">לא פעיל</SelectItem><SelectItem value="potential">פוטנציאלי</SelectItem><SelectItem value="former">לקוח עבר</SelectItem><SelectItem value="onboarding_pending">ממתין לבדיקה</SelectItem><SelectItem value="balance_sheet_only">סגירת מאזן בלבד</SelectItem></SelectContent></Select></div>
                <div><Label htmlFor="onboarding_year">שנת קליטה</Label><Input id="onboarding_year" type="number" min="2020" max="2030" value={formData.onboarding_year || ''} onChange={(e) => handleInputChange('onboarding_year', e.target.value)} placeholder="2026" /></div>
                <div><Label htmlFor="employee_count">מס' עובדים</Label><Input id="employee_count" type="number" min="0" max="500" value={formData.business_info?.employee_count || ''} onChange={(e) => handleInputChange('employee_count', parseInt(e.target.value) || 0, 'business_info')} placeholder="0" /></div>
                <div><Label htmlFor="complexity_level">רמת מורכבות</Label><Select value={formData.business_info?.complexity_level || 'low'} onValueChange={(value) => handleInputChange('complexity_level', value, 'business_info')}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">רגיל</SelectItem><SelectItem value="medium">בינוני</SelectItem><SelectItem value="high">מורכב (ריבוי חשבונות)</SelectItem></SelectContent></Select></div>
              </div>

              <div className="border-t pt-4 mt-6">
                <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-semibold">אנשי קשר נוספים</h3><Button type="button" onClick={addContact} variant="outline" size="sm"><Plus className="w-4 h-4 ml-2" />הוסף איש קשר</Button></div>
                {formData.contacts?.map((contact, index) => (
                  <div key={index} className="bg-gray-50 p-4 rounded-lg mb-4">
                    <div className="flex justify-between items-center mb-3"><h4 className="font-medium">איש קשר #{index + 1}</h4><Button type="button" onClick={() => removeContactEntry(index)} variant="ghost" size="sm" className="text-amber-600 hover:text-amber-800"><Trash2 className="w-4 h-4" /></Button></div>
                    <div className="grid md:grid-cols-3 gap-3">
                      <div><Label>שם</Label><Input value={contact.name} onChange={(e) => updateContact(index, 'name', e.target.value)} placeholder="שם מלא" /></div>
                      <div><Label>תפקיד</Label><Select value={contact.role} onValueChange={(value) => updateContact(index, 'role', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(roleLabels).map(([key, label]) => (<SelectItem key={key} value={key}>{label}</SelectItem>))}</SelectContent></Select></div>
                      <div><Label>אימייל</Label><Input type="email" value={contact.email} onChange={(e) => updateContact(index, 'email', e.target.value)} placeholder="email@example.com" /></div>
                      <div><Label>טלפון</Label><Input value={contact.phone} onChange={(e) => updateContact(index, 'phone', e.target.value)} placeholder="03-1234567" /></div>
                      <div><Label>נייד</Label><Input value={contact.mobile} onChange={(e) => updateContact(index, 'mobile', e.target.value)} placeholder="050-1234567" /></div>
                      <div><Label>אמצעי קשר מועדף</Label><Select value={contact.preferred_contact_method} onValueChange={(value) => updateContact(index, 'preferred_contact_method', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="email">אימייל</SelectItem><SelectItem value="phone">טלפון</SelectItem><SelectItem value="mobile">נייד</SelectItem><SelectItem value="whatsapp">WhatsApp</SelectItem></SelectContent></Select></div>
                    </div>
                    <div className="mt-3 flex items-center gap-6">
                      <label className="flex items-center gap-2"><Checkbox checked={contact.is_primary} onCheckedChange={(checked) => updateContact(index, 'is_primary', checked)} />איש קשר ראשי</label>
                      <label className="flex items-center gap-2">
                        <Checkbox checked={false} onCheckedChange={(checked) => {
                          if (!checked) return;
                          // Copy contact data to shareholders
                          const newShareholder = {
                            name: contact.name || '', id_number: '', birth_date: '',
                            license_number: '', phone: contact.phone || contact.mobile || '',
                            email: contact.email || '', role: contact.role || 'בעל מניות',
                            custom_fields: {}
                          };
                          setFormData(prev => ({
                            ...prev,
                            shareholders: [...(prev.shareholders || []), newShareholder]
                          }));
                        }} />
                        <span className="text-xs text-slate-500">העתק גם לבעלי מניות</span>
                      </label>
                    </div>
                    {contact.notes !== undefined && (<div className="mt-3"><Label>הערות</Label><Input value={contact.notes} onChange={(e) => updateContact(index, 'notes', e.target.value)} placeholder="הערות נוספות..." /></div>)}
                  </div>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="process_tree" className="space-y-4 rounded-2xl border-2 border-emerald-200 bg-emerald-50/30 p-5">
              <ProcessTreeManager
                processTree={formData.process_tree}
                onChange={(updated) => setFormData(prev => ({ ...prev, process_tree: updated }))}
                clientId={client?.id}
                clientName={formData.name}
                reportingInfo={formData.reporting_info}
                clientData={formData}
              />
            </TabsContent>
            {/* ===== נתונים כספיים TAB ===== */}
            <TabsContent value="financial" className="space-y-5 rounded-2xl border-2 border-amber-200 bg-amber-50/30 p-5">
              {/* שכ"ט חודשי */}
              <div>
                <Label className="text-lg font-bold">שכ״ט חודשי</Label>
                <div className="grid md:grid-cols-2 gap-4 mt-2">
                  <div>
                    <Label htmlFor="monthly_fee">סכום שכ״ט חודשי (₪)</Label>
                    <Input
                      id="monthly_fee"
                      type="number"
                      min="0"
                      step="1"
                      value={formData.monthly_fee || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, monthly_fee: parseFloat(e.target.value) || '' }))}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label htmlFor="fee_status">סטטוס שכ״ט</Label>
                    <Select
                      value={formData.fee_status || 'normal'}
                      onValueChange={(value) => setFormData(prev => ({
                        ...prev,
                        fee_status: value === 'normal' ? '' : value,
                        paying_client_id: value !== 'linked_to_parent' ? '' : prev.paying_client_id
                      }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">רגיל - שכ״ט עצמאי</SelectItem>
                        <SelectItem value="oth">תיק עצמי (OTH) - ללא חיוב</SelectItem>
                        <SelectItem value="linked_to_parent">מתומחר עם לקוח ראשי</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500 mt-1">
                      OTH = תיק שלך/עצמי. מתומחר = נכלל בשכ״ט של לקוח אחר
                    </p>
                  </div>
                </div>
                {formData.fee_status === 'linked_to_parent' && (
                  <div className="mt-3 p-3 bg-violet-50 border border-violet-200 rounded-lg">
                    <Label htmlFor="paying_client_id">לקוח משלם (ראשי)</Label>
                    <Select
                      value={formData.paying_client_id || ''}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, paying_client_id: value }))}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="בחר לקוח ראשי..." />
                      </SelectTrigger>
                      <SelectContent>
                        {allClientsForLinking.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500 mt-1">
                      שכ״ט של לקוח זה נכלל בחיוב הלקוח הראשי
                    </p>
                  </div>
                )}
              </div>

              {/* אמצעי תשלום שכ"ט */}
              <div className="border-2 border-orange-200 rounded-lg p-3 bg-orange-50 space-y-2">
                <Label className="font-bold">אמצעי תשלום שכ״ט</Label>
                <Select
                  value={formData.authorities_payment_method || 'masav'}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, authorities_payment_method: value }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="masav">מס״ב</SelectItem>
                    <SelectItem value="credit_card">כרטיס אשראי</SelectItem>
                    <SelectItem value="bank_standing_order">הו״ק בנקאית</SelectItem>
                    <SelectItem value="standing_order">כתב אישור (כ״א)</SelectItem>
                    <SelectItem value="check">המחאה</SelectItem>
                    <SelectItem value="client_pays">לקוח</SelectItem>
                    <SelectItem value="payment_plan">הסדר</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* שעות עבודה חודשיות */}
              <div className="border-t pt-4">
                <Label className="text-lg font-bold">שעות עבודה חודשיות משוערות</Label>
                <div className="grid md:grid-cols-4 gap-4 mt-2">
                  <div>
                    <Label htmlFor="payroll_hours">שכר</Label>
                    <Input id="payroll_hours" type="number" min="0" step="0.25"
                      value={formData.business_info.estimated_monthly_hours.payroll}
                      onChange={(e) => handleInputChange('estimated_monthly_hours', { ...formData.business_info.estimated_monthly_hours, payroll: parseFloat(e.target.value) || 0 }, 'business_info')}
                      placeholder="0.5" />
                  </div>
                  <div>
                    <Label htmlFor="vat_hours">מע״מ</Label>
                    <Input id="vat_hours" type="number" min="0" step="0.25"
                      value={formData.business_info.estimated_monthly_hours.vat_reporting}
                      onChange={(e) => handleInputChange('estimated_monthly_hours', { ...formData.business_info.estimated_monthly_hours, vat_reporting: parseFloat(e.target.value) || 0 }, 'business_info')}
                      placeholder="1.25" />
                  </div>
                  <div>
                    <Label htmlFor="bookkeeping_hours">הנה״ח</Label>
                    <Input id="bookkeeping_hours" type="number" min="0" step="0.25"
                      value={formData.business_info.estimated_monthly_hours.bookkeeping}
                      onChange={(e) => handleInputChange('estimated_monthly_hours', { ...formData.business_info.estimated_monthly_hours, bookkeeping: parseFloat(e.target.value) || 0 }, 'business_info')}
                      placeholder="2.75" />
                  </div>
                  <div>
                    <Label htmlFor="reports_hours">דוחות</Label>
                    <Input id="reports_hours" type="number" min="0" step="0.25"
                      value={formData.business_info.estimated_monthly_hours.reports}
                      onChange={(e) => handleInputChange('estimated_monthly_hours', { ...formData.business_info.estimated_monthly_hours, reports: parseFloat(e.target.value) || 0 }, 'business_info')}
                      placeholder="0.75" />
                  </div>
                </div>
              </div>

              {/* העלאת הצעות מחיר וחוזים */}
              <div className="border-t pt-4">
                <Label className="text-lg font-bold">הצעות מחיר וחוזים</Label>
                <p className="text-xs text-gray-500 mt-1 mb-3">העלאת קבצי הצעות מחיר, חוזי התקשרות ומסמכים כספיים</p>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors cursor-pointer"
                  onClick={() => document.getElementById('file-upload-quotes')?.click()}
                >
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">לחץ להעלאת קובץ או גרור לכאן</p>
                  <p className="text-xs text-gray-400 mt-1">PDF, DOC, DOCX, XLS, XLSX, JPG, PNG</p>
                  <input
                    id="file-upload-quotes"
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      if (files.length > 0) {
                        const existingFiles = formData.quote_files || [];
                        const newFiles = files.map(f => ({
                          name: f.name,
                          size: f.size,
                          type: f.type,
                          uploaded_at: new Date().toISOString(),
                          file: f,
                        }));
                        setFormData(prev => ({ ...prev, quote_files: [...existingFiles, ...newFiles] }));
                      }
                    }}
                  />
                </div>
                {(formData.quote_files || []).length > 0 && (
                  <div className="mt-3 space-y-2">
                    {formData.quote_files.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded border text-sm">
                        <span className="truncate">{file.name}</span>
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6"
                          onClick={() => setFormData(prev => ({
                            ...prev,
                            quote_files: prev.quote_files.filter((_, i) => i !== idx)
                          }))}
                        >
                          <X className="w-3 h-3 text-amber-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ===== נותני שירותים TAB ===== */}
            <TabsContent value="providers" className="space-y-5 rounded-2xl border-2 border-violet-200 bg-violet-50/30 p-5">
              {client?.id ? (
                <div className="space-y-4">
                  {/* Linked Companies Display */}
                  <div className="space-y-2">
                    <Label className="text-lg font-bold">גורמי שירות מקושרים</Label>
                    {clientLinks.length === 0 && <p className="text-sm text-gray-500">לקוח זה אינו משוייך לאף גורם שירות.</p>}
                    <div className="space-y-2">
                      {serviceCompanies.map(company => {
                        const companyProviders = serviceProviders.filter(p => p.service_company_id === company.id);
                        const linkedProviders = companyProviders.filter(p => linkedProviderIds.has(p.id));
                        if (linkedProviders.length === 0) return null;
                        return (
                          <motion.div key={company.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                            className="p-3 bg-gray-50 rounded-md border">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-medium">{company.name}</h4>
                              <Button variant="ghost" size="icon" onClick={() => handleUnlinkCompany(company.id)} type="button" title="ביטול שיוך כל החברה">
                                <Trash2 className="w-4 h-4 text-amber-500" />
                              </Button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {linkedProviders.map(provider => (
                                <div key={provider.id} className="flex items-center justify-between p-2 bg-white rounded border text-sm">
                                  <span>{provider.name} ({serviceProviderTypeLabels[provider.type]})</span>
                                  <Button variant="ghost" size="icon" className="h-6 w-6"
                                    onClick={async () => {
                                      const linkToDelete = clientLinks.find(l => l.service_provider_id === provider.id);
                                      if (linkToDelete) {
                                        await ClientServiceProvider.delete(linkToDelete.id);
                                        const links = await ClientServiceProvider.filter({ client_id: client.id }, null, 500);
                                        setClientLinks(links || []);
                                      }
                                    }}
                                    type="button"
                                  >
                                    <X className="w-3 h-3 text-amber-500" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Add New Links */}
                  <div className="border-t pt-4">
                    <Label className="font-bold">שיוך גורמי שירות חדשים</Label>
                    <Select onValueChange={handleCompanySelectForLinking} value={selectedCompanyToLink || ""}>
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="בחר חברה לשיוך אנשי קשר ממנה..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCompanies.map(company => (
                          <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Provider Selection for Selected Company */}
                  {selectedCompanyToLink && unlinkedProvidersByCompany.get(selectedCompanyToLink) && (
                    <div className="bg-blue-50 p-4 rounded-md border">
                      <h4 className="font-semibold mb-3">
                        בחר אנשי קשר לשיוך מתוך: {serviceCompanies.find(c => c.id === selectedCompanyToLink)?.name}
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-48 overflow-y-auto">
                        {unlinkedProvidersByCompany.get(selectedCompanyToLink)?.map(provider => (
                          <div key={provider.id} className="flex items-center space-x-2 space-x-reverse p-2 bg-white rounded-md border">
                            <Checkbox
                              id={`provider-${provider.id}`}
                              checked={selectedProvidersToLink.includes(provider.id)}
                              onCheckedChange={(checked) => handleProviderSelection(provider.id, checked)}
                            />
                            <Label htmlFor={`provider-${provider.id}`} className="text-sm">
                              {provider.name}
                              <span className="text-gray-500 mr-1">({serviceProviderTypeLabels[provider.type]})</span>
                            </Label>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-end gap-2 mt-4">
                        <Button type="button" variant="outline" onClick={() => { setSelectedCompanyToLink(null); setSelectedProvidersToLink([]); }}>בטל</Button>
                        <Button type="button" onClick={handleLinkSelectedProviders} disabled={selectedProvidersToLink.length === 0} className="bg-blue-600 hover:bg-blue-700 text-white">
                          שייך {selectedProvidersToLink.length} גורמים
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>יש לשמור את הלקוח תחילה כדי לקשר נותני שירותים.</p>
                </div>
              )}
            </TabsContent>
            <TabsContent value="tax" className="space-y-4 rounded-2xl border-2 border-violet-200 bg-violet-50/30 p-5">
              <h3 className="text-lg font-semibold mb-4">פרטי מס בסיסיים</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tax_id">מספר זיהוי מס (ח.פ./ע.מ.)</Label>
                  <Input 
                    id="tax_id" 
                    value={formData.tax_info.tax_id} 
                    onChange={(e) => handleTaxInfoChange('tax_id', e.target.value, 'tax_info')} 
                    placeholder="512345678"
                  />
                  {formData.tax_info.tax_id && formData.entity_number === formData.tax_info.tax_id && (
                    <p className="text-xs text-green-600 mt-1">✓ מסונכרן עם מספר ישות</p>
                  )}
                  {formData.tax_info.tax_id && formData.entity_number !== formData.tax_info.tax_id && formData.entity_number !== '' && (
                    <p className="text-xs text-orange-600 mt-1">⚠ שונה ממספר הישות ({formData.entity_number})</p>
                  )}
                </div>
                <div><Label htmlFor="vat_file_number">מספר תיק מע״מ</Label><Input id="vat_file_number" value={formData.tax_info.vat_file_number} onChange={(e) => handleTaxInfoChange('vat_file_number', e.target.value, 'tax_info')} placeholder={formData.entity_number ? `יועתק מ: ${formData.entity_number}` : ''} />{formData.entity_number && formData.tax_info.vat_file_number === formData.entity_number && (<p className="text-xs text-green-600 mt-1">✓ הועתק ממספר הישות</p>)}</div>
                <div>
                  <Label htmlFor="tax_deduction_file_number">מספר תיק ניכויים</Label>
                  <Input id="tax_deduction_file_number" value={formData.tax_info.tax_deduction_file_number} onChange={(e) => handleTaxInfoChange('tax_deduction_file_number', e.target.value, 'tax_info')} />
                </div>
                <div>
                  <Label htmlFor="social_security_file_number">מספר תיק ביטוח לאומי (אוטומטי)</Label>
                  <Input
                    id="social_security_file_number"
                    value={formData.tax_info.social_security_file_number}
                    onChange={(e) => handleTaxInfoChange('social_security_file_number', e.target.value, 'tax_info')}
                    placeholder="מחושב אוטומטית מתיק ניכויים + 00"
                    className="bg-gray-50"
                  />
                </div>
              </div>
              <div className="border-t pt-4 mt-6">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                  <div className="flex justify-between items-center mb-3">
                    <Label className="text-base font-medium text-gray-800">שנת עבודה נוכחית</Label>
                    <Input
                      value={formData.tax_info.annual_tax_ids?.current_year || ''}
                      onChange={(e) => handleTaxInfoChange('current_year', e.target.value, 'tax_info', 'annual_tax_ids')}
                      className="w-24 text-center"
                      type="number"
                    />
                  </div>
                  <div className="flex items-center gap-3 mb-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                    <input
                      type="checkbox"
                      id="direct_transmission"
                      checked={formData.tax_info?.direct_transmission || false}
                      onChange={(e) => handleTaxInfoChange('direct_transmission', e.target.checked, 'tax_info')}
                      className="w-4 h-4 rounded"
                    />
                    <label htmlFor="direct_transmission" className="text-sm font-medium text-blue-800 cursor-pointer">
                      לקוח מחובר לשידורים ישירים (אין צורך במזהי פנקס)
                    </label>
                  </div>
                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-800">מזהים שנתיים עדכניים</h4>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label>מזהה מקדמות {formData.service_types?.includes('tax_advances') && !formData.tax_info?.direct_transmission && <span className="text-amber-500">*</span>}</Label>
                        <Input
                          value={formData.tax_info?.annual_tax_ids?.tax_advances_id || ''}
                          onChange={(e) => handleTaxInfoChange('tax_advances_id', e.target.value, 'tax_info', 'annual_tax_ids')}
                          placeholder="מזהה מקדמות מס"
                          className={formData.service_types?.includes('tax_advances') && !formData.tax_info?.direct_transmission && !formData.tax_info?.annual_tax_ids?.tax_advances_id ? 'border-amber-300' : ''}
                        />
                      </div>
                      <div>
                        <Label>אחוז מקדמות {formData.service_types?.includes('tax_advances') && !formData.tax_info?.direct_transmission && <span className="text-amber-500">*</span>}</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={formData.tax_info?.annual_tax_ids?.tax_advances_percentage || ''}
                          onChange={(e) => handleTaxInfoChange('tax_advances_percentage', parseFloat(e.target.value) || (e.target.value === '' ? '' : null), 'tax_info', 'annual_tax_ids')}
                          placeholder="אחוז מקדמות (0-100)"
                          className={formData.service_types?.includes('tax_advances') && !formData.tax_info?.direct_transmission && (formData.tax_info?.annual_tax_ids?.tax_advances_percentage === '' || formData.tax_info?.annual_tax_ids?.tax_advances_percentage === undefined || formData.tax_info?.annual_tax_ids?.tax_advances_percentage === null) ? 'border-amber-300' : ''}
                        />
                      </div>
                      <div>
                        <Label>מזהה ביטוח לאומי {formData.service_types?.includes('payroll') && !formData.tax_info?.direct_transmission && <span className="text-amber-500">*</span>}</Label>
                        <Input
                          value={formData.tax_info?.annual_tax_ids?.social_security_id || ''}
                          onChange={(e) => handleTaxInfoChange('social_security_id', e.target.value, 'tax_info', 'annual_tax_ids')}
                          placeholder="מזהה ביטוח לאומי שנתי"
                          className={formData.service_types?.includes('payroll') && !formData.tax_info?.direct_transmission && !formData.tax_info?.annual_tax_ids?.social_security_id ? 'border-amber-300' : ''}
                        />
                      </div>
                      <div>
                        <Label>מזהה ניכויים {formData.service_types?.includes('payroll') && !formData.tax_info?.direct_transmission && <span className="text-amber-500">*</span>}</Label>
                        <Input
                          value={formData.tax_info?.annual_tax_ids?.deductions_id || ''}
                          onChange={(e) => handleTaxInfoChange('deductions_id', e.target.value, 'tax_info', 'annual_tax_ids')}
                          placeholder="מזהה ניכויים שנתי"
                          className={formData.service_types?.includes('payroll') && !formData.tax_info?.direct_transmission && !formData.tax_info?.annual_tax_ids?.deductions_id ? 'border-amber-300' : ''}
                        />
                      </div>
                    </div>
                  </div>
                  {formData.tax_info.annual_tax_ids?.last_updated && (<div className="mt-3 text-sm text-gray-600">עודכן לאחרונה: {new Date(formData.tax_info.annual_tax_ids.last_updated).toLocaleDateString('he-IL')}</div>)}
                </div>
              </div>
              {/* Previous year IDs */}
              <div className="border-t pt-4 mt-4">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-semibold text-gray-600">מזהים שנה קודמת ({Number(formData.tax_info.annual_tax_ids?.current_year || new Date().getFullYear()) - 1})</h4>
                    <p className="text-xs text-gray-400">לשימוש בדיווחים מאוחרים של השנה הקודמת</p>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-600">מזהה מקדמות (שנה קודמת)</Label>
                      <Input
                        value={formData.tax_info?.prev_year_ids?.tax_advances_id || formData.tax_info?.annual_tax_ids_history?.[String(Number(formData.tax_info.annual_tax_ids?.current_year || new Date().getFullYear()) - 1)]?.tax_advances_id || ''}
                        onChange={(e) => handleTaxInfoChange('tax_advances_id', e.target.value, 'tax_info', 'prev_year_ids')}
                        placeholder="מזהה מקדמות שנה קודמת"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-600">אחוז מקדמות (שנה קודמת)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={formData.tax_info?.prev_year_ids?.tax_advances_percentage || ''}
                        onChange={(e) => handleTaxInfoChange('tax_advances_percentage', e.target.value, 'tax_info', 'prev_year_ids')}
                        placeholder="אחוז מקדמות שנה קודמת"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-600">מזהה ביטוח לאומי (שנה קודמת)</Label>
                      <Input
                        value={formData.tax_info?.prev_year_ids?.social_security_id || formData.tax_info?.annual_tax_ids_history?.[String(Number(formData.tax_info.annual_tax_ids?.current_year || new Date().getFullYear()) - 1)]?.social_security_id || ''}
                        onChange={(e) => handleTaxInfoChange('social_security_id', e.target.value, 'tax_info', 'prev_year_ids')}
                        placeholder="מזהה בל שנה קודמת"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-600">מזהה ניכויים (שנה קודמת)</Label>
                      <Input
                        value={formData.tax_info?.prev_year_ids?.deductions_id || formData.tax_info?.annual_tax_ids_history?.[String(Number(formData.tax_info.annual_tax_ids?.current_year || new Date().getFullYear()) - 1)]?.deductions_id || ''}
                        onChange={(e) => handleTaxInfoChange('deductions_id', e.target.value, 'tax_info', 'prev_year_ids')}
                        placeholder="מזהה ניכויים שנה קודמת"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div><Label htmlFor="preferred_method">אמצעי תקשורת מועדף</Label><Select value={formData.communication_preferences.preferred_method} onValueChange={(value) => handleInputChange('preferred_method', value, 'communication_preferences')}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="email">אימייל</SelectItem><SelectItem value="whatsapp">WhatsApp</SelectItem><SelectItem value="phone">טלפון</SelectItem><SelectItem value="teams">Teams</SelectItem></SelectContent></Select></div>
              <div className="space-y-1.5"><Label>תגיות</Label><TagSelector scope="client" selectedTags={formData.tags || []} onChange={(tags) => setFormData(prev => ({ ...prev, tags }))} /></div>
              <div><Label htmlFor="notes">הערות</Label><Textarea id="notes" value={formData.notes} onChange={(e) => handleInputChange('notes', e.target.value)} className="h-24" /></div>
            </TabsContent>
            <TabsContent value="accounts" className="space-y-4 rounded-2xl border-2 border-cyan-200 bg-cyan-50/30 p-5">
              {client?.id ? (
                <ClientAccountsManager clientId={client.id} clientName={client.name || formData.name} />
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>יש לשמור את הלקוח תחילה כדי לנהל חשבונות בנק.</p>
                </div>
              )}
            </TabsContent>
            <TabsContent value="integration" className="space-y-4 rounded-2xl border-2 border-indigo-200 bg-indigo-50/30 p-5">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="calmplan_id">מזהה CalmPlan</Label>
                  <Input
                    id="calmplan_id"
                    value={client?.id || 'ייווצר לאחר שמירה'}
                    readOnly
                    className="bg-gray-50"
                  />
                </div>
                <div><Label htmlFor="annual_reports_client_id">מזהה מערכת מאזנים</Label><Input id="annual_reports_client_id" value={formData.integration_info.annual_reports_client_id} onChange={(e) => handleInputChange('annual_reports_client_id', e.target.value, 'integration_info')} /></div>
                <div><Label htmlFor="lastpass_payment_entry_id">מזהה רשומת תשלומים (אופציונלי)</Label><Input id="lastpass_payment_entry_id" value={formData.integration_info.lastpass_payment_entry_id} onChange={(e) => handleInputChange('lastpass_payment_entry_id', e.target.value, 'integration_info')} placeholder="לקישור נוח לפרטי תשלום ברשויות" /></div>
              </div>
            </TabsContent>

            {/* ── בעלי מניות ── */}
            <TabsContent value="shareholders" className="space-y-4 rounded-2xl border-2 border-slate-200 bg-slate-50/30 p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-slate-700">בעלי מניות / בעלים</h3>
                <Button type="button" size="sm" variant="outline" onClick={() => {
                  const updated = [...(formData.shareholders || []), {
                    name: '', id_number: '', birth_date: '', license_number: '', phone: '', email: '', role: 'בעל מניות', custom_fields: {}
                  }];
                  setFormData(prev => ({ ...prev, shareholders: updated }));
                }}>
                  + הוסף בעל מניות
                </Button>
              </div>
              {(formData.shareholders || []).length === 0 && (
                <p className="text-sm text-slate-400 text-center py-4">אין בעלי מניות רשומים — לחצי "הוסף בעל מניות"</p>
              )}
              {(formData.shareholders || []).map((sh, idx) => (
                <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-600">בעל מניות #{idx + 1}</span>
                    <Button type="button" size="sm" variant="ghost" className="text-slate-400 hover:text-slate-700" onClick={() => {
                      const updated = formData.shareholders.filter((_, i) => i !== idx);
                      setFormData(prev => ({ ...prev, shareholders: updated }));
                    }}>✕ הסר</Button>
                  </div>
                  <div className="grid md:grid-cols-3 gap-3">
                    <div><Label>שם מלא</Label><Input value={sh.name} onChange={e => { const u = [...formData.shareholders]; u[idx] = { ...u[idx], name: e.target.value }; setFormData(prev => ({ ...prev, shareholders: u })); }} /></div>
                    <div><Label>תעודת זהות</Label><Input value={sh.id_number} onChange={e => { const u = [...formData.shareholders]; u[idx] = { ...u[idx], id_number: e.target.value }; setFormData(prev => ({ ...prev, shareholders: u })); }} /></div>
                    <div><Label>תאריך לידה</Label><Input type="date" value={sh.birth_date} onChange={e => { const u = [...formData.shareholders]; u[idx] = { ...u[idx], birth_date: e.target.value }; setFormData(prev => ({ ...prev, shareholders: u })); }} /></div>
                    <div><Label>רישיון נהיגה</Label><Input value={sh.license_number} onChange={e => { const u = [...formData.shareholders]; u[idx] = { ...u[idx], license_number: e.target.value }; setFormData(prev => ({ ...prev, shareholders: u })); }} /></div>
                    <div><Label>טלפון</Label><Input value={sh.phone} onChange={e => { const u = [...formData.shareholders]; u[idx] = { ...u[idx], phone: e.target.value }; setFormData(prev => ({ ...prev, shareholders: u })); }} /></div>
                    <div><Label>מייל</Label><Input type="email" value={sh.email} onChange={e => { const u = [...formData.shareholders]; u[idx] = { ...u[idx], email: e.target.value }; setFormData(prev => ({ ...prev, shareholders: u })); }} /></div>
                    <div><Label>תפקיד</Label><Input value={sh.role} onChange={e => { const u = [...formData.shareholders]; u[idx] = { ...u[idx], role: e.target.value }; setFormData(prev => ({ ...prev, shareholders: u })); }} placeholder='בעל מניות / מנכ״ל / דירקטור' /></div>
                  </div>
                  {/* Custom fields */}
                  <div className="mt-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">שדות נוספים:</span>
                      <Button type="button" size="sm" variant="ghost" className="text-xs text-blue-500" onClick={() => {
                        const fieldName = prompt('שם השדה החדש:');
                        if (!fieldName) return;
                        const u = [...formData.shareholders];
                        u[idx] = { ...u[idx], custom_fields: { ...u[idx].custom_fields, [fieldName]: '' } };
                        setFormData(prev => ({ ...prev, shareholders: u }));
                      }}>+ שדה</Button>
                    </div>
                    {Object.entries(sh.custom_fields || {}).map(([key, val]) => (
                      <div key={key} className="flex items-center gap-2 mt-1">
                        <Label className="text-xs w-24 shrink-0">{key}</Label>
                        <Input className="text-sm" value={val} onChange={e => {
                          const u = [...formData.shareholders];
                          u[idx] = { ...u[idx], custom_fields: { ...u[idx].custom_fields, [key]: e.target.value } };
                          setFormData(prev => ({ ...prev, shareholders: u }));
                        }} />
                        <Button type="button" size="sm" variant="ghost" className="text-xs text-slate-400" onClick={() => {
                          const u = [...formData.shareholders];
                          const cf = { ...u[idx].custom_fields };
                          delete cf[key];
                          u[idx] = { ...u[idx], custom_fields: cf };
                          setFormData(prev => ({ ...prev, shareholders: u }));
                        }}>✕</Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </TabsContent>

            {/* ── הגדרות הצגה ── */}
            <TabsContent value="display_settings" className="space-y-4 rounded-2xl border-2 border-slate-200 bg-slate-50/30 p-5">
              <h3 className="text-sm font-bold text-slate-700 mb-2">שדות להצגה ברשימות משימות ודאשבורדים</h3>
              <p className="text-xs text-slate-400 mb-4">סמני אילו שדות יוצגו ליד שם הלקוח בעמודי משימות, דאשבורד שכר ומיסים</p>
              {[
                { key: 'show_entity_number', label: 'ח"פ / ע.מ.' },
                { key: 'show_deductions_file', label: 'תיק ניכויים' },
                { key: 'show_deductions_id', label: 'מזהה ניכויים' },
                { key: 'show_advances_id', label: 'מזהה מקדמות' },
                { key: 'show_social_security_id', label: 'תיק ביטוח לאומי' },
                { key: 'show_shareholders', label: 'בעלי מניות' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                  <input type="checkbox"
                    checked={formData.display_fields?.[key] ?? false}
                    onChange={e => setFormData(prev => ({
                      ...prev,
                      display_fields: { ...prev.display_fields, [key]: e.target.checked }
                    }))}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600"
                  />
                  <span className="text-sm font-medium text-slate-700">{label}</span>
                </label>
              ))}
            </TabsContent>
          </Tabs>


          <div className="flex justify-end gap-3 pt-6 border-t mt-6">
            <Button type="button" variant="outline" onClick={onCancel}>
              <X className="w-4 h-4 ml-2" />
              ביטול
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
              {client?.id ? 'עדכן לקוח' : 'צור לקוח'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.form>
  );
}
