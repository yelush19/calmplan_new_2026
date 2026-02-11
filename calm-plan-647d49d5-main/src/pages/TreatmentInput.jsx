import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TreatmentInput } from '@/components/scheduling/TreatmentInput';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';

export default function TreatmentInputPage() {
    const navigate = useNavigate();

    const handlePlanCreated = (weekStartDate) => {
        const formattedDate = format(weekStartDate, 'yyyy-MM-dd');
        navigate(createPageUrl(`WeeklyPlanner?weekStartDate=${formattedDate}`));
    };

    const handleCancel = () => {
        navigate(createPageUrl('Home'));
    };

    return (
        <div className="p-2 md:p-6 lg:p-8">
            <TreatmentInput onPlanCreated={handlePlanCreated} onCancel={handleCancel} />
        </div>
    );
}