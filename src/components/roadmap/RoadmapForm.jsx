import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

export default function RoadmapForm({ item, onSave, onCancel }) {
    const [formData, setFormData] = useState({
        title: item?.title || '',
        description: item?.description || '',
        status: item?.status || 'planned',
        phase: item?.phase || 'short_term',
        category: item?.category || 'core_feature',
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
        onSave(formData);
    };

    return (
        <Card className="my-4">
            <CardHeader>
                <CardTitle>{item ? 'עריכת פריט' : 'הוספת פריט חדש למפת הדרכים'}</CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <Label htmlFor="title">כותרת</Label>
                        <Input id="title" value={formData.title} onChange={handleInputChange} required />
                    </div>
                    <div>
                        <Label htmlFor="description">תיאור</Label>
                        <Textarea id="description" value={formData.description} onChange={handleInputChange} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <Label htmlFor="status">סטטוס</Label>
                            <Select value={formData.status} onValueChange={(v) => handleSelectChange('status', v)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="planned">מתוכנן</SelectItem>
                                    <SelectItem value="in_progress">בביצוע</SelectItem>
                                    <SelectItem value="completed">הושלם</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="phase">שלב</Label>
                            <Select value={formData.phase} onValueChange={(v) => handleSelectChange('phase', v)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="short_term">טווח קצר</SelectItem>
                                    <SelectItem value="medium_term">טווח בינוני</SelectItem>
                                    <SelectItem value="long_term">טווח ארוך</SelectItem>
                                    <SelectItem value="completed">הושלם</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="category">קטגוריה</Label>
                            <Select value={formData.category} onValueChange={(v) => handleSelectChange('category', v)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="core_feature">ליבת המערכת</SelectItem>
                                    <SelectItem value="automation">אוטומציה</SelectItem>
                                    <SelectItem value="integration">אינטגרציה</SelectItem>
                                    <SelectItem value="ux_ui">חווית משתמש</SelectItem>
                                    <SelectItem value="analytics">ניתוח נתונים</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="ghost" onClick={onCancel}>ביטול</Button>
                        <Button type="submit">שמור</Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}