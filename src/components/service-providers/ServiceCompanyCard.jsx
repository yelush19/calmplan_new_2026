import React, { useState, useEffect } from 'react';
import { ServiceProvider } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Phone, Mail, Edit, Trash2, UserPlus } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

const serviceProviderTypes = {
  cpa: "רו\"ח", attorney: "עו\"ד", auditor: "מבקר", bookkeeper: "מנה\"ח",
  partner: "שותף", consultant: "יועץ", other: "אחר"
};

const specialtiesTypes = {
  tax_planning: "תכנון מס", auditing: "ביקורת", legal_consulting: "ייעוץ משפטי",
  bookkeeping: "הנהלת חשבונות", business_consulting: "ייעוץ עסקי",
  international_tax: "מיסוי בינלאומי", mergers_acquisitions: "מיזוגים ורכישות"
};

const ProviderItem = ({ provider, onEditProvider, onDeleteProvider }) => (
    <div className="p-3 bg-white border rounded-lg">
        <div className="flex justify-between items-start">
            <div>
                <h4 className="font-semibold">{provider.name}</h4>
                <p className="text-sm text-gray-500">{serviceProviderTypes[provider.type]}</p>
            </div>
            <div className="flex gap-1">
                 <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => onEditProvider(provider)}>
                    <Edit className="w-4 h-4" />
                </Button>
                 <Button variant="ghost" size="icon" className="w-8 h-8 text-destructive" onClick={() => onDeleteProvider(provider.id)}>
                    <Trash2 className="w-4 h-4" />
                </Button>
            </div>
        </div>
        <div className="mt-2 text-sm space-y-1">
            {provider.contact_info?.primary_phone && <p className="flex items-center gap-2"><Phone className="w-3 h-3"/>{provider.contact_info.primary_phone}</p>}
            {provider.contact_info?.email && <p className="flex items-center gap-2"><Mail className="w-3 h-3"/>{provider.contact_info.email}</p>}
        </div>
         {provider.specialties?.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-2 mt-2 border-t">
                {provider.specialties.map(s => <Badge key={s} variant="outline">{specialtiesTypes[s] || s}</Badge>)}
            </div>
        )}
    </div>
);


export default function ServiceCompanyCard({ company, onEditProvider, onEditCompany, refreshData }) {
    const [providers, setProviders] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const fetchProviders = async () => {
            setIsLoading(true);
            const data = await ServiceProvider.filter({ service_company_id: company.id });
            setProviders(data || []);
            setIsLoading(false);
        };
        fetchProviders();
    }, [company.id]);

    const handleDeleteProvider = async (providerId) => {
        if (window.confirm("האם למחוק איש קשר זה?")) {
            await ServiceProvider.delete(providerId);
            const updatedProviders = providers.filter(p => p.id !== providerId);
            setProviders(updatedProviders);
        }
    };
    
    return (
        <Card className="flex flex-col">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle>{company.name}</CardTitle>
                    <Button variant="outline" size="sm" onClick={() => onEditCompany(company)}>
                        <Edit className="w-3 h-3 ml-2" /> ערוך פרטי חברה
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="flex-grow">
                 <Accordion type="single" collapsible defaultValue="item-1">
                    <AccordionItem value="item-1">
                        <AccordionTrigger>
                            {`אנשי קשר (${providers.length})`}
                        </AccordionTrigger>
                        <AccordionContent>
                           <div className="space-y-2">
                                {isLoading && <p>טוען...</p>}
                                {!isLoading && providers.length === 0 && <p className="text-sm text-gray-500">לא נמצאו אנשי קשר</p>}
                                {providers.map(provider => (
                                    <ProviderItem 
                                        key={provider.id} 
                                        provider={provider} 
                                        onEditProvider={onEditProvider}
                                        onDeleteProvider={handleDeleteProvider}
                                    />
                                ))}
                           </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </CardContent>
            <CardFooter>
                 <Button variant="ghost" className="w-full" onClick={() => onEditProvider({ service_company_id: company.id })}>
                    <UserPlus className="w-4 h-4 ml-2"/> הוסף איש קשר לחברה
                </Button>
            </CardFooter>
        </Card>
    );
}