
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Phone, Mail, Edit, Building, User, DollarSign, Trash2, UserCheck } from 'lucide-react';

const statusUI = {
  active: { label: 'פעיל', badge: 'bg-green-100 text-green-800 border-green-200' },
  inactive: { label: 'לא פעיל', badge: 'bg-orange-100 text-orange-800 border-orange-200' },
  potential: { label: 'פוטנציאלי', badge: 'bg-gray-100 text-gray-800 border-gray-200' },
  former: { label: 'לקוח עבר', badge: 'bg-red-100 text-red-800 border-red-200' },
  onboarding_pending: { label: 'ממתין לקליטה', badge: 'bg-purple-100 text-purple-800 border-purple-200' },
};


export default function ClientListItem({ client, onEdit, onSelectAccounts, onSelectCollections, onSelectContracts, onDelete }) {
    const uiProps = statusUI[client.status] || statusUI.inactive;
    const mainContact = client.contacts?.find(c => c.is_primary) || client.contacts?.[0] || { name: client.contact_person, email: client.email, phone: client.phone };

    return (
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 hover:bg-neutral-bg transition-colors duration-200 border-b border-neutral-light/50">
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-neutral-dark truncate">{client.name}</h3>
                </div>
                <div className="text-sm text-neutral-medium mt-1">{mainContact?.name || ''}</div>
            </div>
            
            <div className="w-full md:w-auto flex items-center justify-start gap-4 mt-3 md:mt-0">
                <a href={`tel:${mainContact?.phone}`} className="text-sm text-neutral-medium hover:text-litay-accent flex items-center gap-2">
                  <Phone className="w-4 h-4"/> 
                  <span className="hidden sm:inline">{mainContact?.phone}</span>
                </a>
                <a href={`mailto:${mainContact?.email}`} className="text-sm text-neutral-medium hover:text-litay-accent flex items-center gap-2">
                  <Mail className="w-4 h-4"/> 
                  <span className="hidden sm:inline truncate max-w-xs">{mainContact?.email}</span>
                </a>
            </div>

            <div className="w-full md:w-auto flex items-center justify-between md:justify-end gap-4 mt-4 md:mt-0">
                <Badge className={`${uiProps.badge} flex items-center gap-1 border`}>
                    {client.status === 'onboarding_pending' && <UserCheck className="w-3 h-3"/>}
                    {uiProps.label}
                </Badge>
                <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => onEdit(client)} title="עריכת פרטים">
                        <Edit className="w-4 h-4 text-neutral-medium hover:text-litay-accent" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onSelectAccounts(client)} title="ניהול חשבונות">
                        <Building className="w-4 h-4 text-neutral-medium hover:text-litay-accent" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onSelectCollections(client)} title="ניהול גבייה">
                        <DollarSign className="w-4 h-4 text-neutral-medium hover:text-litay-accent" />
                    </Button>
                     <Button variant="ghost" size="icon" onClick={() => onDelete(client.id)} title="מחיקת לקוח">
                        <Trash2 className="w-4 h-4 text-status-error hover:text-status-error/80" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
